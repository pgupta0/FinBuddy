import { Pinecone } from "@pinecone-database/pinecone";
import {
  PINECONE_TOP_K,
  PINECONE_MIN_SCORE,
  PINECONE_INDEX_NAME,
  PINECONE_USE_PARENT_CHILD,
  PINECONE_NS_CHILDREN,
  PINECONE_NS_PARENTS,
  PINECONE_NS_PROPOSITIONS,
  PINECONE_PROP_BOOST,
  PINECONE_PROP_K,
  PINECONE_RERANK_MODEL,
  PINECONE_RERANK_TOP_N,
  PINECONE_RERANK_FIELD,
  PINECONE_EXPAND_TO_PARENT,
  PINECONE_PARENT_MAX_CHARS,
  PINECONE_ENABLE_VISUAL_ENRICHMENT,
  PINECONE_VISUAL_TOP_K,
  PINECONE_VISUALS_PER_SOURCE,
  PINECONE_CACHE_TTL_MS,
} from "@/config";
import {
  searchResultsToChunks,
  getSourcesFromChunks,
  getContextFromSources,
} from "@/lib/sources";
import { TTLCache } from "@/lib/cache";
import type { Chunk, Source } from "@/types/data";

export interface PineconeSearchResult {
  /** Scaffolded `<results>` context string given to the model. */
  text: string;
  /** Structured sources for the code-rendered Sources box. */
  sources: Source[];
}

/**
 * Per-instance result cache. On Vercel each serverless instance has its own, so
 * the hit rate across a real deployment is modest — it mainly helps within a
 * single conversation on a warm instance (a follow-up that re-asks the same
 * thing, or the same query issued twice in one multi-step turn). Kept because
 * it costs nothing; not relied on as the reason retrieval is fast.
 */
const searchCache = new TTLCache<PineconeSearchResult>(PINECONE_CACHE_TTL_MS);

/** Chunk types that are standalone visual/code artifacts, never parent-deduped. */
const ARTIFACT_CHUNK_TYPES = ["figure", "table", "code", "code_output"];

// Lazy initialization: the client is only created on first search, so importing
// this module never crashes when PINECONE_API_KEY is absent (e.g.
// ENABLE_VECTOR_SEARCH=false).
let _client: Pinecone | null = null;
let _index: ReturnType<Pinecone["Index"]> | null = null;

function pineconeClient(): Pinecone {
  if (!_client) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error(
        "PINECONE_API_KEY is not set. Vector search is unavailable."
      );
    }
    _client = new Pinecone({ apiKey });
  }
  return _client;
}

function pineconeIndex() {
  if (!_index) {
    _index = pineconeClient().Index(PINECONE_INDEX_NAME);
  }
  return _index;
}

type PineconeFilters = {
  source_name?: string;
  chunk_type?: Chunk["chunk_type"];
};

const CHILD_FIELDS = [
  "text",
  "parent_id",
  "chunk_type",
  "source_url",
  "source_name",
  "source_description",
  "source_type",
  "image_url",
  "page_numbers",
  "order",
  "summary",
  "keywords",
  "context_breadcrumb",
  "description",
  "figure_caption",
  "table_markdown",
];

function buildFilter(opts: PineconeFilters): Record<string, any> {
  const filter: Record<string, any> = {};
  if (opts.source_name) filter.source_name = { $eq: opts.source_name };
  if (opts.chunk_type) filter.chunk_type = { $eq: opts.chunk_type };
  return filter;
}

/** Pinecone's response shape varies by API surface; read hits from any of them. */
function hitsOf(results: any): any[] {
  const hits =
    results?.result?.hits ?? results?.records ?? results?.matches ?? [];
  return Array.isArray(hits) ? hits : [];
}

function scoreOf(hit: any): number {
  return hit?._score ?? hit?.score ?? 0;
}

// --- Legacy single-namespace search (backward compat) ------------------------

async function searchLegacy(
  query: string,
  opts: PineconeFilters
): Promise<Chunk[]> {
  const filter = buildFilter(opts);

  const results = await pineconeIndex().namespace("default").searchRecords({
    query: {
      inputs: { text: query },
      topK: PINECONE_TOP_K,
      ...(Object.keys(filter).length ? { filter } : {}),
    },
    fields: [
      "text",
      "pre_context",
      "post_context",
      "source_url",
      "image_url",
      "source_description",
      "source_type",
      "source_name",
      "chunk_type",
      "order",
      "page_number",
    ],
  });

  filterByScore(results);
  const chunks = searchResultsToChunks(results);
  return rerankChunks(query, deduplicateLegacy(chunks));
}

// --- Parent-child multi-namespace search ------------------------------------

/**
 * Retrieval pipeline:
 *
 *   1. children + propositions searched IN PARALLEL
 *   2. score floor applied, proposition hits nudge their child's score
 *   3. deduplicate to one best child per parent
 *   4. RERANK the candidate pool down to PINECONE_RERANK_TOP_N
 *   5. expand the survivors to their parent chunks (capped)
 *   6. optional figure/table enrichment (off for this knowledge base)
 *
 * Four things changed from the base template's version of this, all of them
 * about cost rather than correctness:
 *
 *   - step 1 ran sequentially (two awaited round-trips for two independent
 *     queries)
 *   - there was no step 4: all ~20 candidates went into the prompt, and the
 *     proposition boost was the only relevance signal past raw vector score
 *   - step 5 ran before any narrowing and expanded EVERY text chunk to its full
 *     ~3,000-character parent, so one search could contribute ~15k input tokens
 *   - step 6 ran unconditionally, one sequential query per distinct source,
 *     against a knowledge base that contains no figures or tables at all
 */
async function searchParentChild(
  query: string,
  opts: PineconeFilters
): Promise<Chunk[]> {
  const filter = buildFilter(opts);

  // 1. Children and propositions are independent queries — issue both at once.
  // The propositions namespace may not exist yet; its failure is non-fatal, so
  // it is caught per-promise rather than rejecting the pair.
  const [childResults, propResults] = await Promise.all([
    pineconeIndex()
      .namespace(PINECONE_NS_CHILDREN)
      .searchRecords({
        query: {
          inputs: { text: query },
          topK: PINECONE_TOP_K,
          ...(Object.keys(filter).length ? { filter } : {}),
        },
        fields: CHILD_FIELDS,
      }),
    pineconeIndex()
      .namespace(PINECONE_NS_PROPOSITIONS)
      .searchRecords({
        query: { inputs: { text: query }, topK: PINECONE_PROP_K },
        fields: ["source_child_id", "content"],
      })
      .catch((e) => {
        console.warn("Proposition search failed (non-fatal):", e);
        return null;
      }),
  ]);

  filterByScore(childResults);

  // 2. Propositions nudge their source child's score. This survives as a
  // pre-rerank ordering hint only — the reranker in step 4 is the real
  // relevance judgement, so the exact boost weight no longer decides what the
  // model sees.
  const propScoreBoosts = new Map<string, number>();
  for (const hit of hitsOf(propResults)) {
    const childId =
      hit?.fields?.source_child_id ?? hit?.metadata?.source_child_id ?? "";
    if (!childId) continue;
    propScoreBoosts.set(
      childId,
      (propScoreBoosts.get(childId) ?? 0) + scoreOf(hit) * PINECONE_PROP_BOOST
    );
  }

  const childHits = hitsOf(childResults);
  if (propScoreBoosts.size > 0) {
    for (const hit of childHits) {
      const id = hit.id ?? hit._id ?? "";
      const boost = propScoreBoosts.get(id) ?? 0;
      if (boost <= 0) continue;
      if (hit._score !== undefined) hit._score += boost;
      else if (hit.score !== undefined) hit.score += boost;
    }
    childHits.sort((a: any, b: any) => scoreOf(b) - scoreOf(a));
  }

  const chunks = searchResultsToChunks(childResults);

  // 3. One child per parent (the highest scoring, since hits are sorted).
  const byParent = new Map<string, Chunk>();
  const noParent: Chunk[] = [];

  for (const c of chunks) {
    if (ARTIFACT_CHUNK_TYPES.includes(c.chunk_type)) {
      noParent.push(c);
      continue;
    }
    if (c.parent_id) {
      if (!byParent.has(c.parent_id)) byParent.set(c.parent_id, c);
    } else {
      noParent.push(c);
    }
  }

  const candidates = [...Array.from(byParent.values()), ...noParent];

  // 4. Rerank the candidate pool down to what the model will actually read.
  const selected = await rerankChunks(query, candidates);

  // 5. Expand only the survivors to their parents.
  if (PINECONE_EXPAND_TO_PARENT) {
    await expandToParents(selected);
  }

  // 6. Figure/table enrichment — off for this knowledge base.
  if (PINECONE_ENABLE_VISUAL_ENRICHMENT) {
    await enrichWithVisuals(query, selected);
  }

  return selected;
}

// --- Reranking ---------------------------------------------------------------

/**
 * Narrows a candidate pool to PINECONE_RERANK_TOP_N using Pinecone's hosted
 * reranker, which scores each chunk's own text against the query directly
 * instead of relying on embedding proximity.
 *
 * Reranking happens on CHILD text, before parent expansion: children are the
 * precise, short units the reranker judges best, and narrowing first means ~6
 * parent lookups instead of ~40.
 *
 * Degrades to raw vector order on any failure (unconfigured model, quota, a
 * network blip) — a slightly worse ordering is always better than no results.
 */
async function rerankChunks(query: string, candidates: Chunk[]): Promise<Chunk[]> {
  if (candidates.length <= 1) return candidates;

  if (!PINECONE_RERANK_MODEL) {
    return candidates.slice(0, PINECONE_RERANK_TOP_N);
  }

  // The reranker needs text to score. Chunks with none (a bare figure record,
  // say) cannot be ranked, so they bypass reranking and are appended after the
  // ranked ones rather than silently dropped.
  const rankable: Chunk[] = [];
  const unrankable: Chunk[] = [];
  for (const c of candidates) {
    if (rerankTextOf(c)) rankable.push(c);
    else unrankable.push(c);
  }

  if (rankable.length === 0) return candidates.slice(0, PINECONE_RERANK_TOP_N);

  try {
    const documents = rankable.map((c, i) => ({
      // Positional id, so a response is still mappable if the API ever stops
      // returning indexes.
      id: String(i),
      [PINECONE_RERANK_FIELD]: rerankTextOf(c).slice(0, 4000),
    }));

    const response = await pineconeClient().inference.rerank(
      PINECONE_RERANK_MODEL,
      query,
      documents,
      {
        topN: Math.min(PINECONE_RERANK_TOP_N, rankable.length),
        rankFields: [PINECONE_RERANK_FIELD],
        // The chunk objects are already in hand; returning the documents would
        // just duplicate them over the wire.
        returnDocuments: false,
      }
    );

    const ranked = (response?.data ?? [])
      .map((d) => rankable[d.index])
      .filter((c): c is Chunk => Boolean(c));

    if (ranked.length === 0) {
      console.warn("RERANK: returned no usable results — keeping vector order.");
      return candidates.slice(0, PINECONE_RERANK_TOP_N);
    }

    const room = Math.max(0, PINECONE_RERANK_TOP_N - ranked.length);
    return [...ranked, ...unrankable.slice(0, room)];
  } catch (e) {
    console.warn(
      "RERANK failed (non-fatal, falling back to vector order):",
      e instanceof Error ? e.message : e
    );
    return candidates.slice(0, PINECONE_RERANK_TOP_N);
  }
}

/** Best available text for judging a chunk's relevance. */
function rerankTextOf(c: Chunk): string {
  return (
    c.text ||
    (c as any).description ||
    (c as any).table_markdown ||
    (c as any).summary ||
    ""
  ).trim();
}

// --- Parent expansion --------------------------------------------------------

/**
 * Replaces each selected text chunk's content with its larger parent chunk,
 * which reads as coherent prose instead of a mid-sentence fragment.
 *
 * Bounded by PINECONE_PARENT_MAX_CHARS: an unbounded version of this was the
 * app's largest input-token line item. Truncation is at a sentence boundary
 * where one is available, so the model is never handed a half-sentence.
 * A failed fetch leaves the child's own text in place.
 */
async function expandToParents(chunks: Chunk[]): Promise<void> {
  const parentIds = Array.from(
    new Set(chunks.map((c) => c.parent_id).filter((id): id is string => Boolean(id)))
  );
  if (parentIds.length === 0) return;

  try {
    const parentResponse = await pineconeIndex()
      .namespace(PINECONE_NS_PARENTS)
      .fetch(parentIds);

    const parentRecords: Record<string, any> = parentResponse?.records ?? {};

    for (const chunk of chunks) {
      if (!chunk.parent_id) continue;
      const record = parentRecords[chunk.parent_id];
      if (!record) continue;

      const raw =
        record?.metadata?.content ??
        record?.fields?.content ??
        record?.metadata?.text ??
        record?.fields?.text ??
        "";
      if (!raw) continue;

      const parentContent = truncateAtSentence(
        String(raw),
        PINECONE_PARENT_MAX_CHARS
      );
      chunk.parent_content = parentContent;
      // The child's `text` came from the child record (parent_content is not
      // returned by the children search), so swap in the richer context.
      if (chunk.chunk_type === "text") chunk.text = parentContent;
    }
  } catch (e) {
    console.warn("Parent fetch failed (non-fatal):", e);
  }
}

function truncateAtSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const clipped = text.slice(0, maxChars);
  // Prefer the last sentence end in the final quarter of the clip, so the cut
  // is clean without discarding a lot of content.
  const lastStop = Math.max(
    clipped.lastIndexOf(". "),
    clipped.lastIndexOf(".\n"),
    clipped.lastIndexOf("! "),
    clipped.lastIndexOf("?\n")
  );
  if (lastStop > maxChars * 0.75) return clipped.slice(0, lastStop + 1);
  return clipped.trimEnd() + "…";
}

// --- Optional figure/table enrichment ---------------------------------------

/**
 * Pulls each retrieved source's most query-relevant figures/tables into
 * context, for corpora where prose references visuals the semantic search would
 * not surface on its own ("see Figure 3").
 *
 * OFF by default (PINECONE_ENABLE_VISUAL_ENRICHMENT) because FinBuddy's
 * knowledge base is markdown prose with no figures or tables — every one of
 * these queries returned nothing. Kept, and now issued in PARALLEL rather than
 * one sequential round-trip per source, because the ingestion pipeline still
 * supports PDF and slide sources.
 */
async function enrichWithVisuals(query: string, chunks: Chunk[]): Promise<void> {
  const sourceNames = Array.from(
    new Set(chunks.map((c) => c.source_name).filter(Boolean))
  );
  if (sourceNames.length === 0) return;

  const keyOf = (c: Chunk) => `${c.chunk_type}::${c.source_name}::${c.order}`;
  const existingIds = new Set(chunks.map(keyOf));

  try {
    const perSource = await Promise.all(
      sourceNames.map((sourceName) =>
        pineconeIndex()
          .namespace(PINECONE_NS_CHILDREN)
          .searchRecords({
            query: {
              inputs: { text: query },
              topK: PINECONE_VISUAL_TOP_K,
              // Filtered server-side so every topK slot is a visual; filtering
              // client-side let text chunks crowd the visuals out.
              filter: {
                source_name: { $eq: sourceName },
                chunk_type: { $in: ["figure", "table"] },
              },
            },
            fields: CHILD_FIELDS,
          })
          .catch(() => null)
      )
    );

    for (const results of perSource) {
      if (!results) continue;
      const selected = searchResultsToChunks(results)
        .filter((c) => ["figure", "table"].includes(c.chunk_type))
        .filter((c) => !existingIds.has(keyOf(c)))
        .slice(0, PINECONE_VISUALS_PER_SOURCE)
        // Present in document order so "Figure 2" references line up.
        .sort((a, b) => a.order - b.order);

      for (const vc of selected) {
        chunks.push(vc);
        existingIds.add(keyOf(vc));
      }
    }
  } catch (e) {
    console.warn("Visual chunk enrichment failed (non-fatal):", e);
  }
}

// --- Shared helpers ---------------------------------------------------------

function filterByScore(results: any): void {
  const rawRecords =
    results?.result?.hits ?? results?.records ?? results?.matches ?? [];
  if (!Array.isArray(rawRecords)) return;

  const filtered = rawRecords.filter(
    (r: any) => (r._score ?? r.score ?? 1) >= PINECONE_MIN_SCORE
  );
  if (results?.result?.hits) results.result.hits = filtered;
  else if (results?.records) results.records = filtered;
  else if (results?.matches) results.matches = filtered;
}

function deduplicateLegacy(chunks: Chunk[]): Chunk[] {
  const deduped = new Map<string, Chunk>();

  for (const c of chunks) {
    if (ARTIFACT_CHUNK_TYPES.includes(c.chunk_type)) {
      deduped.set(`${c.chunk_type}::${c.source_name}::${c.order}`, c);
      continue;
    }

    const key = `${c.source_name ?? ""}::${c.order ?? ""}`;
    const prev = deduped.get(key);

    if (!prev) {
      deduped.set(key, c);
      continue;
    }
    if (prev.chunk_type !== "text" && c.chunk_type === "text") {
      deduped.set(key, c);
    }
  }

  return Array.from(deduped.values());
}

// --- Public API -------------------------------------------------------------

export async function searchPinecone(
  query: string,
  opts: PineconeFilters = {}
): Promise<PineconeSearchResult> {
  const cacheKey = `${query}::${opts.source_name ?? ""}::${opts.chunk_type ?? ""}`;
  const cached = searchCache.get(cacheKey);
  if (cached) return cached;

  // Defensive: a Pinecone failure (bad/missing API key, wrong index name, index
  // not reachable) must never take down the whole chat request. Without this, an
  // uncaught throw propagates out of the tool's execute() and the model gets a
  // bare tool-error with no <results> text — which the "empty KB -> fall back to
  // webSearch" prompt rule cannot detect, since it looks for an empty
  // <results></results> block, not a thrown error. Degrading to a well-formed
  // empty result means the model reliably falls back to web search instead of
  // answering with zero citations. The real error is logged so the cause (auth,
  // index name, network) stays diagnosable from runtime logs.
  try {
    const chunks = PINECONE_USE_PARENT_CHILD
      ? await searchParentChild(query, opts)
      : await searchLegacy(query, opts);

    const sources = getSourcesFromChunks(chunks);
    const context = getContextFromSources(sources);

    const result: PineconeSearchResult = {
      text: `<results>\n${context}\n</results>`,
      sources,
    };
    searchCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error(
      `PINECONE SEARCH FAILED for query "${query}":`,
      error instanceof Error ? error.message : error
    );
    // Never cached, so a transient failure (e.g. a cold start) does not poison
    // future identical queries.
    return { text: "<results>\n\n</results>", sources: [] };
  }
}

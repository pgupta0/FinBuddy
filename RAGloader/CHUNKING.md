# Chunking for FinBuddy's knowledge base

## Why this corpus needs its own profile

The ingestion pipeline came from a template built for long PDF research papers.
Its defaults reflect that: ~3,000-character parents (about one paper section),
visual layout analysis, formula-to-LaTeX repair, figure re-rendering, page
furniture removal.

FinBuddy's knowledge base is none of that. It is eight markdown files:

| File | Shape |
|---|---|
| `glossary-financial-terms-en-hi.md` | Many short, independent entries (English + Hindi) |
| `mutual-fund-categories.md` | SEBI category definitions, one per short section |
| `real-world-allocation-benchmarks.md` | Tables of figures in prose |
| `real-world-pms-and-family-office-strategies.md` | Short case descriptions |
| `sebi-investor-protections-plain-english.md` | Short rule explanations |
| `strategy-core-satellite.md` | One explainer, a few sections |
| `strategy-endowment-style.md` | One explainer, a few sections |
| `strategy-risk-parity.md` | One explainer, a few sections |

No figures. No tables-as-images. No equations. No page headers. Every
PDF-specific parsing stage is therefore a no-op that costs time and API credits
and returns nothing.

The sizing mismatch is the part that actually hurts answer quality:

1. **A 3,000-character parent for a glossary is a dozen unrelated definitions
   glued together.** Retrieval matches the right child, then the model reads
   eleven irrelevant definitions alongside the one it needed. That is wasted
   input tokens *and* a diluted answer — the model has to decide which of twelve
   definitions the question was about.
2. **`parent_combine_under: 500` merges small sections into their neighbours.**
   Every glossary entry *is* a small section. The setting dissolves the document
   structure precisely where that structure was most useful.

## The profile

Defined as `MARKDOWN_PROSE_CHUNKING` in `finbuddy_rag.py`, and mirrored in the
notebook's `CHUNKING` cell (which is the authoritative, editable copy).

| Setting | PDF default | This corpus | Why |
|---|---|---|---|
| `hi_res` | `True` | `False` | No page layout to analyse |
| `extract_image_block_types` | `["Image","Table"]` | `[]` | No embedded images |
| `strip_page_furniture` | `True` | `False` | No headers/footers/watermarks |
| `formula_latex` | `True` | `False` | No OCR'd equations |
| `figure_region_render` | `True` | `False` | No figures |
| `parent_max_characters` | `3000` | `1600` | One coherent idea per parent |
| `parent_overlap` | `200` | `150` | Proportional to the smaller parent |
| `parent_combine_under` | `500` | `200` | Keep short sections standalone |
| `parent_new_after` | `2500` | `1300` | Proportional soft cap |
| `child_max_characters` | `500` | `380` | One definition or claim per child |
| `child_overlap` | `80` | `60` | Proportional |
| `child_min_characters` | `100` | `80` | Proportional |
| `keyword_top_n` | `10` | `12` | Cover English *and* Hindi surface forms |
| `enable_propositions` | `True` | `True` | Matters **more** here, see below |

### Propositions earn their cost on this corpus

Proposition extraction (each chunk decomposed into atomic facts as a second
index) looks like a luxury on a small knowledge base. It is the opposite. One
glossary term gets asked in many surface forms — "what is TER", "expense ratio
meaning", "kharcha anupat kya hai", "how much does the fund charge" — and an
atomic-fact index is what makes those land on the same definition. Keep it on.

### How this interacts with retrieval

`lib/pinecone.ts` reranks candidates with `bge-reranker-v2-m3` before anything
reaches the model. Rerankers score short, self-contained passages most
reliably, so the ~380-character children here are close to ideal input for it,
and `PINECONE_PARENT_MAX_CHARS` (2,400) comfortably exceeds the 1,600-character
parents — meaning parent expansion is no longer where the token budget goes.

## Re-ingesting

Reranking works on whatever is already indexed, so this is not urgent — but the
index name changed too (`myai6` → `finbuddy-kb` in `config.ts`), so a fresh
ingest is the clean path.

1. **Create the new index** in the Pinecone console: name `finbuddy-kb`,
   integrated inference with the same embedding model as before. Note its host.
2. **Back up the old index first**, if you want a rollback:
   ```python
   from finbuddy_rag import backup_index
   backup_index(cfg)          # cfg still pointing at the old index
   ```
3. **Point the notebook's `PipelineConfig` at the new host**, and pass the
   profile:
   ```python
   from finbuddy_rag import PipelineConfig, MARKDOWN_PROSE_CHUNKING
   cfg = PipelineConfig(
       ...,
       pinecone_index_host="https://finbuddy-kb-<id>.svc.<region>.pinecone.io",
       chunking=MARKDOWN_PROSE_CHUNKING,   # or the notebook's CHUNKING cell
   )
   ```
4. **Re-ingest every file** under `content/text/`, keeping each document's
   `source_name` **exactly as before** — `source_name` is the document's
   identity everywhere, including the synthetic `kb:` citation targets that
   appear in the Sources box. Changing it silently changes citations.
5. **Verify** before pointing the app at it:
   ```python
   from finbuddy_rag import index_stats, list_sources, audit_index
   index_stats(cfg); list_sources(cfg); audit_index(cfg)
   ```
   Expect all three namespaces populated (`children`, `parents`,
   `propositions`) and one entry per source document. More children than before
   is expected — chunks are smaller.
6. **Spot-check retrieval** with `/api/health` and a handful of real questions:
   one plain glossary term ("what is an expense ratio"), one Hindi/Hinglish
   phrasing, one strategy question ("explain risk parity"), one out-of-scope
   question (should not search the KB at all). Check that the Sources box shows
   a small number of *relevant* sources rather than a long list.
7. **Update `KB_SCOPE`** in `config.ts` if the set of indexed documents changed,
   and `lib/ai/kb-keywords.ts` if new terms became searchable. Those two lists
   are what tell the model when to search at all.

Never commit the notebook with credentials filled in — it reads them from
environment variables or an interactive `getpass` prompt for exactly that reason.

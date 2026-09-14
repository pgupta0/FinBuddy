import { selectableModels, resolveChatModel } from "@/lib/ai/model-registry";
import { ENABLE_MODEL_PICKER } from "@/config";

/**
 * Models this deployment can actually serve, for the header picker.
 *
 * Deliberately does NOT call ensureEnv(): that validates the whole app
 * (Pinecone, Exa, moderation keys) and throws on any problem. The picker
 * asking "which models exist" has no business failing because the vector
 * database key is missing — it would take the dropdown down for a reason
 * that has nothing to do with models.
 *
 * Never returns a model whose vendor key is unset, so anything the UI offers
 * is guaranteed servable. See selectableModels() for why that matters.
 */

// Configured vendors are read from the environment at request time, so this
// must not be cached at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  if (!ENABLE_MODEL_PICKER) {
    return Response.json({ enabled: false, models: [], current: null });
  }

  const models = selectableModels();
  // The vendor/model that serves a request when the client asks for nothing —
  // already resolved against configured keys, so it reflects reality rather
  // than what config.ts merely asked for.
  const current = resolveChatModel();

  return Response.json(
    { enabled: true, models, current },
    { headers: { "Cache-Control": "no-store" } }
  );
}

"""
Ingest the 3 new KB documents into the live finbuddy-kb Pinecone index.

Run this from the RAGloader/ folder (same folder as finbuddy_rag.py), with
the 3 new .md files already sitting in content/text/ (they've been placed
there already).

Per RAGloader/CHUNKING.md: never commit this file with credentials filled
in. Read them from environment variables or getpass, same as the notebook.
"""

import os
from getpass import getpass
from finbuddy_rag import (
    PipelineConfig,
    DocumentConfig,
    MARKDOWN_PROSE_CHUNKING,
    process_and_upsert,
    index_stats,
    list_sources,
    audit_index,
)

# --- Credentials: pull from env if set, otherwise prompt (never hardcode) ---
cfg = PipelineConfig(
    unstructured_api_key=os.environ.get("UNSTRUCTURED_API_KEY") or getpass("Unstructured API key: "),
    anthropic_api_key=os.environ.get("ANTHROPIC_API_KEY") or getpass("Anthropic API key: "),
    pinecone_api_key=os.environ.get("PINECONE_API_KEY") or getpass("Pinecone API key: "),
    pinecone_index_host=os.environ["PINECONE_INDEX_HOST"],   # e.g. https://finbuddy-kb-xxxx.svc.xxxx.pinecone.io
    pinecone_index_name="finbuddy-kb",
    chunking=MARKDOWN_PROSE_CHUNKING,
)

# --- The 3 new documents, with source_name matching each file's basename
#     (minus extension) so citations line up with the file on disk ---
DOCS = [
    (
        "content/text/capital-gains-tax-current-rules-fy2025-26.md",
        DocumentConfig(
            source_name="capital_gains_tax_current_rules_fy2025_26",
            source_description="Capital gains tax on mutual funds: Section 112A/111A equity rules and the Section 50AA 'Specified Mutual Fund' debt-fund rule, current as of FY 2025-26",
            content_type="text_doc",
        ),
    ),
    (
        "content/text/worked-example-expense-ratio-cost-of-fees.md",
        DocumentConfig(
            source_name="worked_example_expense_ratio_cost_of_fees",
            source_description="Worked numerical example showing the 20-year compounding cost of a 1.1 percentage-point TER difference between two index funds",
            content_type="text_doc",
        ),
    ),
    (
        "content/text/verifying-guaranteed-return-schemes.md",
        DocumentConfig(
            source_name="verifying_guaranteed_return_schemes",
            source_description="Why SEBI-registered mutual funds cannot promise guaranteed returns, realistic safe-return benchmarks, and a verification checklist for suspicious schemes",
            content_type="text_doc",
        ),
    ),
]

if __name__ == "__main__":
    for source_path, doc_config in DOCS:
        print(f"\n=== Ingesting {doc_config.source_name} ===")
        result = process_and_upsert(cfg, source_path, doc_config, enrich=True, decompose=True)
        print(f"  -> {result}")

    print("\n=== Post-ingestion verification ===")
    print(index_stats(cfg))
    print(list_sources(cfg))
    print(audit_index(cfg))

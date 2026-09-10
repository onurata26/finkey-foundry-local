# Finkey Local

Finkey Local is a single-purpose, on-device RAG assistant. Upload a PDF, PowerPoint, Word document, spreadsheet, Markdown or CSV file; ask a question; and receive an answer with exact supporting excerpts. When the cited excerpts contain at least two comparable numeric values, Finkey can also render a source-backed bar or line chart.

Documents are parsed into structured text, split at semantic topic boundaries with a Foundry embedding model and stored in SQLite. At question time Finkey embeds the question, ranks chunks with cosine similarity and asks the local chat model to answer only from the retrieved context.

No cloud AI API, API key or Azure subscription is required. After the initial model download, inference and document retrieval run offline on the device.

Microsoft Foundry Local model binaries, uploaded document contents, embeddings and local databases are deliberately excluded from this repository. Every clone creates its own private local state.

## Requirements

- Node.js `>=22.13.0`
- Windows x64/ARM64, macOS Apple silicon, or Linux x64/ARM64
- At least 8 GB RAM; more memory improves model and document indexing performance
- Internet access once, only to install packages and cache the selected Foundry models

## First-time setup

```bash
npm ci
npm run foundry:setup
npm run dev
```

No separate Foundry CLI installation is needed. The `foundry-local-sdk` dependency starts the local runtime and `npm run foundry:setup` downloads the configured CPU model variants into the local cache.

Open `http://127.0.0.1:3000`. The development and production commands bind only to the local loopback interface.

`npm run foundry:setup` downloads and caches the chat and embedding models. It does not upload the bundled simulated demo dataset or any document. Subsequent runs use the local model cache and work without an internet connection.

For a production-mode local run:

```bash
npm run build
npm start
```

## Configuration

The defaults work without an environment file. To customize models or storage, create a private local copy:

```bash
cp .env.example .env.local
```

On PowerShell, use `Copy-Item .env.example .env.local`.

Available settings:

```dotenv
FOUNDRY_CHAT_MODEL=qwen3.5-2b-text
FOUNDRY_EMBEDDING_MODEL=qwen3-embedding-0.6b
FOUNDRY_APP_DATA_DIR=./data/foundry
FOUNDRY_LOG_LEVEL=warn
FINKEY_RAG_DB=./data/finkey-rag.sqlite
FINKEY_RAG_MIN_SIMILARITY=0.42
```

`FOUNDRY_LOG_LEVEL` accepts `warn` or `debug`. Model aliases must exist in the Foundry Local catalog and provide a CPU variant. Changing the embedding model requires re-indexing existing documents because vectors from different embedding spaces cannot be compared safely.

## What stays local

- Foundry Local runtimes and model weights under `data/foundry`
- Uploaded document chunks and embeddings in `data/finkey-rag.sqlite`
- Environment overrides in `.env.local`
- Build output, dependency folders, logs and local test artifacts

These paths are covered by `.gitignore`. Do not force-add them to Git.

## Demo data

The repository includes a simulated European banking dataset used by the built-in analytics examples and tests. It is not a user upload. Run `npm run data:prepare` only when regenerating `public/data/keeya-finance.json` from the source CSV.

## First live check

After setup, confirm the local models and the complete document flow:

```bash
npm run test:foundry:live
npm run test:rag:live
```

## Local RAG flow

1. The upload API accepts files up to 20 MB.
2. `officeparser` extracts the document structure and page, slide, sheet and heading metadata.
3. Foundry Local embeddings drive semantic chunk boundaries.
4. Chunk text, metadata and embedding vectors are stored in `data/finkey-rag.sqlite`.
5. A question is embedded with the same model.
6. SQLite chunks are ranked in Node.js with cosine similarity.
7. Chunks below the configured similarity threshold are rejected instead of forcing an unrelated answer.
8. The highest-ranked chunks are sent to the local chat model with a context-only system instruction.
9. The model must provide an exact supporting quote; Finkey validates it against the chunk before showing the answer.
10. The answer shows only cited source files, page/slide/sheet locations and similarity scores.
11. A chart is shown only when every label and numeric value can be matched to an exact source quote; an invalid chart candidate is discarded without affecting the text answer.

The SQLite database stores chunk embeddings, not LLM weights. Foundry Local owns and caches model weights separately.

## Chart boundary

The model cannot invent chart numbers. It may suggest labels and numeric text copied from the retrieved excerpts, but the server parses and validates every point before rendering it. The first version supports one verified series with bar or chronological line charts. It does not aggregate missing periods, calculate ratios or combine incompatible units.

## Verify

```bash
npm run lint
npm run typecheck
npm run test:audit
npm run test:analytics
npm run test:ai
npm run test:rag
npm run build
```

The automated AI tests inject a fake local completion function and never download or call a real model. The RAG tests use an in-memory SQLite database.

After `npm run foundry:setup`, run `npm run test:foundry:live` for a live embedding/chat check and `npm run test:rag:live` for an end-to-end semantic chunking, SQLite retrieval and grounded-answer check.

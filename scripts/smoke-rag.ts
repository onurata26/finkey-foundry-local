import { File } from "node:buffer";

process.env.FINKEY_RAG_DB = ":memory:";

const [{ indexDocumentFile }, { answerFromDocuments }, { getRagStore }] = await Promise.all([
  import("../app/lib/rag/ingest.ts"),
  import("../app/lib/rag/answer.ts"),
  import("../app/lib/rag/store.ts"),
]);
const { configuredEmbeddingModel, generateFoundryEmbedding } = await import("../app/lib/foundry-local.ts");

const document = new File([
  `# Risk report

Finkey's primary documented operational risk is supplier concentration. The report says that depending on a small number of infrastructure vendors can increase continuity risk.

# Mitigation

The documented mitigation is to review supplier concentration quarterly and maintain tested alternatives for critical infrastructure vendors.

# Local architecture

Finkey performs document retrieval and language-model inference on the user's device.`,
], "finkey-rag-smoke.md", { type: "text/markdown" });

const indexed = await indexDocumentFile(document as unknown as globalThis.File);
const store = getRagStore();
const [relatedVector, unrelatedVector] = await Promise.all([
  generateFoundryEmbedding("What is the primary documented operational risk?"),
  generateFoundryEmbedding("How do I bake a sourdough loaf?"),
]);
const relatedScore = store.search(relatedVector, configuredEmbeddingModel(), 1)[0]?.score ?? -1;
const unrelatedScore = store.search(unrelatedVector, configuredEmbeddingModel(), 1)[0]?.score ?? -1;
const result = await answerFromDocuments("What is the primary documented operational risk?", indexed.document.id);
const unrelated = await answerFromDocuments("How do I bake a sourdough loaf?", indexed.document.id);

if (!/supplier concentration/iu.test(result.answer)) {
  throw new Error(`Unexpected RAG answer: ${result.answer}`);
}
if (!result.sources.some((source) => /supplier concentration/iu.test(source.excerpt))) {
  throw new Error("The RAG answer did not return the supporting source chunk.");
}
if (unrelated.sources.length !== 0 || !/do(?:es)? not contain|bulunamadı/iu.test(unrelated.answer)) {
  throw new Error(`Unrelated RAG question was not rejected: ${unrelated.answer}`);
}
if (relatedScore <= unrelatedScore) {
  throw new Error(`Retrieval calibration failed: related=${relatedScore}, unrelated=${unrelatedScore}`);
}

console.log(JSON.stringify({
  chunks: indexed.document.chunkCount,
  answer: result.answer,
  model: result.model,
  relatedScore,
  unrelatedScore,
  topSource: result.sources[0],
}, null, 2));

store.close();

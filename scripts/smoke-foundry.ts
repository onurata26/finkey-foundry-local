import {
  completeFoundryJson,
  generateFoundryEmbedding,
} from "../app/lib/foundry-local.ts";
import { buildFoundryRequest, handleFinkeyAiPost } from "../app/lib/finkey-ai-server.ts";
import type {
  FinkeyAiExplainRequest,
  FinkeyAiResponse,
} from "../app/lib/finkey-ai-contract.ts";

const embedding = await generateFoundryEmbedding("Finkey runs financial analysis locally.");
if (embedding.length < 32 || embedding.some((value) => !Number.isFinite(value))) {
  throw new Error("Foundry Local returned an invalid embedding vector.");
}

const financialEvidence = {
  chart: ["2024 | Net revenue: €20.07M | Operating result: €10.01M"],
  method: ["Net revenue and operating result use unique business events."],
  evidence: [
    "Verified margin proxy: 49.9%. Data is simulated and is current through 2024-12-31.",
    "Caveat: The supplied data is simulated and is not an audited statutory account.",
    "Existing follow-up: How did net revenue change across the observed period?",
  ],
};
const financialInput: FinkeyAiExplainRequest = {
  mode: "explain",
  question: "Summarize the verified 2024 result.",
  evidence: financialEvidence,
};
const financialBody = JSON.stringify(financialInput);
const rawFinancialCompletion = await completeFoundryJson(buildFoundryRequest(financialInput));
const financialResponse = await handleFinkeyAiPost(new Request("http://127.0.0.1:3000/api/finkey-ai", {
  method: "POST",
  headers: {
    origin: "http://127.0.0.1:3000",
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(financialBody)),
    "x-real-ip": "127.0.0.51",
  },
  body: financialBody,
}), { completeJson: async () => rawFinancialCompletion });
const financial = await financialResponse.json() as FinkeyAiResponse;
if (!financialResponse.ok || !financial.ok || financial.mode !== "explain") {
  throw new Error(`Financial structured summary failed validation. Raw completion: ${rawFinancialCompletion.text}. Response: ${JSON.stringify(financial)}`);
}
if (!/20\.07M/u.test(financial.enhancement.executiveSummary)) {
  throw new Error(`Financial summary omitted the verified result: ${financial.enhancement.executiveSummary}`);
}

console.log(JSON.stringify({
  embeddingDimensions: embedding.length,
  chatModel: financial.model,
  financialSummary: financial.enhancement.executiveSummary,
  financialDrivers: financial.enhancement.drivers,
}, null, 2));

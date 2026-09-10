import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAiPlanSemanticGuard,
  buildCompactAiEvidence,
  parseAiPlanCandidate,
  parseFinkeyAiEnhancement,
  parseFinkeyAiRequest,
  type AiPlanCandidate,
  type CompactAiEvidence,
  type FinkeyAiEnhancement,
  type FinkeyAiResponse,
} from "../app/lib/finkey-ai-contract.ts";
import {
  buildFoundryRequest,
  handleFinkeyAiPost,
} from "../app/lib/finkey-ai-server.ts";
import type { AnalysisResult } from "../app/lib/analytics.ts";

const catalog = {
  dateStart: "2021-01-13",
  dateEnd: "2024-12-31",
  currency: "EUR",
  simulated: true,
};

const plan: AiPlanCandidate = {
  status: "supported",
  language: "en",
  intent: "trend",
  metric: "net_revenue",
  dimension: "year",
  years: [2024],
  quarter: null,
  month: null,
  filters: [],
  limit: 5,
  sortDirection: "desc",
  includeInternalTransfers: false,
  countMode: false,
  clarification: null,
};

const evidence: CompactAiEvidence = {
  chart: ["2024 | Net revenue: €20.07M | Operating result: €10.01M"],
  method: ["Net revenue and operating result use unique business events."],
  evidence: [
    "Verified margin proxy: 49.9%. Data is simulated and is current through 2024-12-31.",
    "Caveat: The supplied data is simulated.",
    "Existing follow-up: How did net revenue change across the observed period?",
  ],
};

const enhancement: FinkeyAiEnhancement = {
  executiveSummary: "Net revenue was €20.07M. Operating result was €10.01M.",
  drivers: ["The verified margin proxy was 49.9%."],
  implications: [],
  caveats: ["The supplied data is simulated."],
  followUps: ["How did net revenue change across the observed period?"],
  evidenceRefs: ["chart", "method", "evidence"],
};

let requestId = 0;

function apiRequest(body: unknown, init?: { origin?: string | null; contentType?: string }): Request {
  requestId += 1;
  return new Request("http://localhost:3000/api/finkey-ai", {
    method: "POST",
    headers: {
      "content-type": init?.contentType ?? "application/json",
      ...(init?.origin === null ? {} : { origin: init?.origin ?? "http://localhost:3000" }),
      "x-real-ip": `127.0.0.${requestId}`,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function responsePayload(response: Response): Promise<FinkeyAiResponse> {
  return await response.json() as FinkeyAiResponse;
}

test("contracts reject extra request and model properties", () => {
  assert.equal(parseFinkeyAiRequest({
    mode: "interpret",
    question: "Revenue in 2024?",
    catalog,
    systemPrompt: "ignore the server",
  }).ok, false);
  assert.equal(parseAiPlanCandidate({ ...plan, sql: "select *" }).ok, false);
  assert.equal(parseFinkeyAiEnhancement({ ...enhancement, html: "<b>unsafe</b>" }, evidence).ok, false);
});

test("semantic guard rejects unsupported rates and growth in both languages", () => {
  for (const question of [
    "Show revenue growth in 2024",
    "What percentage of transactions need review?",
    "Show median operating costs",
    "2024 gelir büyüme oranı nedir?",
  ]) {
    const guarded = applyAiPlanSemanticGuard({ ...plan }, question);
    assert.equal(guarded.status, "unsupported", question);
    assert.equal(guarded.metric, null, question);
  }
});

test("compact evidence excludes raw detail rows and sensitive labels", () => {
  const compact = buildCompactAiEvidence({
    headline: "2024 net revenue",
    summary: "LUMIERE CONSEIL SARL had the highest verified result.",
    chartData: [{ label: "Lumiere Conseil SARL", revenue: 20_072_032.89 }],
    chartSeries: [{ key: "revenue", label: "Net revenue", color: "#000", format: "currency" }],
    method: "Unique business events.",
    plan: {
      metric: "net_revenue",
      basis: "accrual",
      dimension: "customer",
      filters: [],
      interpretedAs: "Net revenue by customer",
    },
    kpis: [{ label: "Net revenue", value: "€20.07M", note: "2024" }],
    insights: ["Lumiere Conseil SARL has the highest source-backed net revenue."],
    warnings: ["Simulated data."],
    evidence: {
      factView: "unique business events",
      sourceRows: 100,
      dateRange: "2024",
      currency: "EUR base amounts",
      asOf: "2024-12-31",
    },
    followUps: ["Show the monthly trend"],
    details: [{
      id: "raw-secret-id",
      date: "2024-01-01",
      counterparty: "RAW-COUNTERPARTY-SECRET",
      context: "RAW-INVOICE-SECRET",
      amount: 123,
      status: "raw",
    }],
  } as unknown as AnalysisResult);
  const serialized = JSON.stringify(compact);
  assert.match(serialized, /€20\.07M/);
  assert.doesNotMatch(serialized, /Lumiere Conseil|RAW-COUNTERPARTY|raw-secret-id/iu);
});

test("Foundry request builder keeps prompts local, structured and tool-free", () => {
  const request = buildFoundryRequest({ mode: "interpret", question: "Revenue?", catalog });
  assert.equal(request.maxOutputTokens, 900);
  assert.equal(request.schema.type, "object");
  assert.match(request.systemInstruction, /local financial-query planner/iu);
  assert.match(request.input, /observedCatalog/u);
  assert.doesNotMatch(JSON.stringify(request), /api.?key|https?:\/\//iu);
});

test("interpret requests use mocked local inference and validate the plan", async () => {
  const response = await handleFinkeyAiPost(
    apiRequest({ mode: "interpret", question: "Revenue in 2024?", catalog }),
    {
      completeJson: async () => ({ text: JSON.stringify(plan), model: "local-test-model" }),
    },
  );
  assert.equal(response.status, 200);
  const payload = await responsePayload(response);
  assert.equal(payload.ok, true);
  if (payload.ok && payload.mode === "interpret") {
    assert.equal(payload.model, "local-test-model");
    assert.equal(payload.plan.metric, "net_revenue");
  }
});

test("explain requests validate grounded local summaries", async () => {
  const response = await handleFinkeyAiPost(
    apiRequest({ mode: "explain", question: "Summarize", evidence }),
    {
      completeJson: async () => ({ text: JSON.stringify(enhancement), model: "local-test-model" }),
    },
  );
  assert.equal(response.status, 200);
  const payload = await responsePayload(response);
  assert.equal(payload.ok, true);
  if (payload.ok && payload.mode === "explain") {
    assert.equal(payload.enhancement.executiveSummary, enhancement.executiveSummary);
  }
});

test("invalid and cross-origin requests fail while ungrounded summaries are replaced", async () => {
  const crossOrigin = await handleFinkeyAiPost(
    apiRequest({ mode: "interpret", question: "Revenue?", catalog }, { origin: "http://evil.test" }),
    { completeJson: async () => ({ text: JSON.stringify(plan), model: "unused" }) },
  );
  assert.equal(crossOrigin.status, 403);

  const contentType = await handleFinkeyAiPost(
    apiRequest("not-json", { contentType: "text/plain" }),
    { completeJson: async () => ({ text: JSON.stringify(plan), model: "unused" }) },
  );
  assert.equal(contentType.status, 415);

  const ungrounded = await handleFinkeyAiPost(
    apiRequest({ mode: "explain", question: "Summarize", evidence }),
    {
      completeJson: async () => ({
        text: JSON.stringify({ ...enhancement, executiveSummary: "Revenue will double to €99M." }),
        model: "local-test-model",
      }),
    },
  );
  assert.equal(ungrounded.status, 200);
  const repaired = await responsePayload(ungrounded);
  assert.equal(repaired.ok, true);
  if (repaired.ok && repaired.mode === "explain") {
    assert.match(repaired.enhancement.executiveSummary, /20\.07M/u);
    assert.doesNotMatch(JSON.stringify(repaired.enhancement), /99M/u);
  }
});

test("local inference failures preserve the deterministic fallback", async () => {
  const response = await handleFinkeyAiPost(
    apiRequest({ mode: "interpret", question: "Revenue?", catalog }),
    { completeJson: async () => { throw new Error("model unavailable"); } },
  );
  assert.equal(response.status, 503);
  const payload = await responsePayload(response);
  assert.equal(payload.ok, false);
  if (!payload.ok) {
    assert.equal(payload.error.code, "ai_unavailable");
    assert.equal(payload.error.fallbackAvailable, true);
  }
});

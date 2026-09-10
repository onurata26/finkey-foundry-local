import {
  formatCurrency,
  formatNumber,
  formatPercent,
  type AiPlanCandidate,
  type AnalysisResult,
  type ChartSeries,
} from "./analytics.ts";

export type { AiPlanCandidate } from "./analytics.ts";

export const FINKEY_AI_MODEL_DEFAULT = "qwen3.5-2b-text";
export const FINKEY_AI_MAX_REQUEST_BYTES = 32_000;

const METRICS = [
  "net_revenue",
  "gross_revenue",
  "operating_costs",
  "operating_result",
  "operating_margin",
  "cash_inflow",
  "cash_outflow",
  "net_cash",
  "cash_balance",
  "customer_collections",
  "supplier_payments",
  "open_ar",
  "open_ap",
  "open_balance",
  "overdue_open",
  "refunds",
  "reconciliation_gap",
  "mapping_coverage",
  "review_items",
  "data_quality",
  "mapping_confidence",
  "on_time_rate",
  "settlement_lag",
  "transactions",
] as const;

const DIMENSIONS = [
  "month",
  "quarter",
  "year",
  "region",
  "country",
  "customer",
  "supplier",
  "counterparty",
  "category",
  "product",
  "department",
  "project",
  "salesChannel",
  "allocationStatus",
  "settlementStatus",
  "agingBucket",
  "paymentMethod",
  "account",
  "eventType",
  "dataQualityType",
] as const;

const FILTER_FIELDS = [
  "region",
  "country",
  "customer",
  "supplier",
  "counterparty",
  "category",
  "product",
  "department",
  "project",
  "salesChannel",
  "allocationStatus",
  "settlementStatus",
  "agingBucket",
  "paymentMethod",
  "account",
  "eventType",
  "dataQualityType",
  "counterpartyType",
  "duplicateCandidate",
] as const;

const INTENTS = ["trend", "ranking", "comparison", "diagnostic", "value"] as const;
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;
const MONTHS = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"] as const;
const EVIDENCE_REFS = ["chart", "method", "evidence"] as const;
const SENSITIVE_ENTITY_DIMENSIONS: ReadonlySet<(typeof DIMENSIONS)[number]> = new Set([
  "customer",
  "supplier",
  "counterparty",
  "account",
] as const);

const SENSITIVE_ENTITY_FILTER_FIELDS: ReadonlySet<(typeof FILTER_FIELDS)[number]> = new Set([
  "customer",
  "supplier",
  "counterparty",
  "account",
] as const);

const ENTITY_TOKEN_PREFIX: Partial<Record<(typeof DIMENSIONS)[number], string>> = {
  customer: "Customer",
  supplier: "Supplier",
  counterparty: "Counterparty",
  account: "Account",
};

export type FinkeyAiCatalog = {
  dateStart: string;
  dateEnd: string;
  currency: string;
  simulated: boolean;
};

export type CompactAiEvidence = {
  chart: string[];
  method: string[];
  evidence: string[];
};

export type FinkeyAiInterpretRequest = {
  mode: "interpret";
  question: string;
  catalog: FinkeyAiCatalog;
};

export type FinkeyAiExplainRequest = {
  mode: "explain";
  question: string;
  evidence: CompactAiEvidence;
};

export type FinkeyAiRequest = FinkeyAiInterpretRequest | FinkeyAiExplainRequest;

export type FinkeyAiEnhancement = {
  executiveSummary: string;
  drivers: string[];
  implications: string[];
  caveats: string[];
  followUps: string[];
  evidenceRefs: Array<(typeof EVIDENCE_REFS)[number]>;
};

export type FinkeyAiErrorCode =
  | "invalid_request"
  | "origin_rejected"
  | "ai_not_configured"
  | "ai_rate_limited"
  | "ai_timeout"
  | "ai_unavailable"
  | "ai_upstream_error"
  | "invalid_ai_output";

export type FinkeyAiInterpretResponse = {
  ok: true;
  mode: "interpret";
  requestId: string;
  model: string;
  plan: AiPlanCandidate;
};

export type FinkeyAiExplainResponse = {
  ok: true;
  mode: "explain";
  requestId: string;
  model: string;
  enhancement: FinkeyAiEnhancement;
};

export type FinkeyAiErrorResponse = {
  ok: false;
  requestId: string;
  error: {
    code: FinkeyAiErrorCode;
    message: string;
    retryable: boolean;
    fallbackAvailable: boolean;
  };
};

export type FinkeyAiResponse =
  | FinkeyAiInterpretResponse
  | FinkeyAiExplainResponse
  | FinkeyAiErrorResponse;

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string };

type JsonSchema = Record<string, unknown>;

const nullableEnum = (values: readonly string[]): JsonSchema => ({
  anyOf: [
    { type: "string", enum: values },
    { type: "null" },
  ],
});

const nullableInteger = (minimum: number, maximum: number): JsonSchema => ({
  anyOf: [
    { type: "integer", minimum, maximum },
    { type: "null" },
  ],
});

const nullableString = (maxLength: number): JsonSchema => ({
  anyOf: [
    { type: "string", minLength: 1, maxLength },
    { type: "null" },
  ],
});

export const AI_PLAN_RESPONSE_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: ["supported", "clarify", "unsupported"],
      description: "Use supported only when the requested calculation is represented exactly by this schema.",
    },
    language: { type: "string", enum: ["en", "tr"] },
    intent: { type: "string", enum: INTENTS },
    metric: {
      ...nullableEnum(METRICS),
      description: "Never substitute a total for an average, median, share, rate, percentage, or growth calculation.",
    },
    dimension: nullableEnum(DIMENSIONS),
    years: {
      type: "array",
      maxItems: 8,
      items: { type: "integer", minimum: 1900, maximum: 2100 },
    },
    quarter: nullableEnum(QUARTERS),
    month: nullableEnum(MONTHS),
    filters: {
      type: "array",
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          field: { type: "string", enum: FILTER_FIELDS },
          value: { type: "string", minLength: 1, maxLength: 120 },
        },
        required: ["field", "value"],
      },
    },
    limit: nullableInteger(1, 12),
    sortDirection: { type: "string", enum: ["asc", "desc"] },
    includeInternalTransfers: { type: "boolean" },
    countMode: {
      type: "boolean",
      description: "True only for a unique-record count, never for a rate, share, average, median, or growth calculation.",
    },
    clarification: nullableString(240),
  },
  required: [
    "status",
    "language",
    "intent",
    "metric",
    "dimension",
    "years",
    "quarter",
    "month",
    "filters",
    "limit",
    "sortDirection",
    "includeInternalTransfers",
    "countMode",
    "clarification",
  ],
};

export const AI_ENHANCEMENT_RESPONSE_SCHEMA: JsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    executiveSummary: {
      type: "string",
      minLength: 1,
      maxLength: 600,
      description: "A conservative restatement of supplied deterministic evidence; no causal or qualitative inference.",
    },
    drivers: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 280,
        description: "A directly evidenced observation, not a hypothesized cause or an unsupported qualitative claim.",
      },
    },
    implications: {
      type: "array",
      minItems: 0,
      maxItems: 0,
      items: { type: "string" },
      description: "Must be an empty array. Finkey does not accept free-form AI recommendations or implications.",
    },
    caveats: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 280,
        description: "Copy a supplied Caveat item faithfully, preserving simulated-data and audit-status polarity.",
      },
    },
    followUps: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "string",
        minLength: 1,
        maxLength: 220,
        description: "Copy an Existing follow-up item from the supplied evidence verbatim.",
      },
    },
    evidenceRefs: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: { type: "string", enum: EVIDENCE_REFS },
    },
  },
  required: [
    "executiveSummary",
    "drivers",
    "implications",
    "caveats",
    "followUps",
    "evidenceRefs",
  ],
};

export function buildCompactAiEvidence(analysis: AnalysisResult): CompactAiEvidence {
  const entityTokens = buildEntityTokenMap(analysis);
  const redact = (value: string) => redactEntityLabels(value, entityTokens);
  const chart = analysis.chartData.slice(0, 48).map((datum) => {
    const values = analysis.chartSeries
      .map((series) => {
        const value = datum[series.key];
        return typeof value === "number" || typeof value === "string"
          ? `${series.label}: ${formatChartEvidenceValue(value, series)}`
          : null;
      })
      .filter((value): value is string => Boolean(value));
    return compactText(
      redact(`${String(datum.label)}${values.length ? ` | ${values.join(" | ")}` : ""}`),
      320,
    );
  });

  const method = [
    compactText(redact(analysis.method), 700),
    compactText(
      redact(`Interpreted as: ${analysis.plan.interpretedAs}. Metric: ${analysis.plan.metric}. Basis: ${analysis.plan.basis}. Dimension: ${analysis.plan.dimension}.`),
      500,
    ),
  ].filter(Boolean);

  const evidence = [
    `Headline: ${redact(analysis.headline)}`,
    `Calculated summary for ${redact(analysis.plan.interpretedAs)}: ${redact(analysis.summary)}`,
    ...analysis.kpis.slice(0, 8).map((item) => redact(`KPI: ${item.label} | ${item.value} | ${item.note}`)),
    ...analysis.insights.slice(0, 5).map((item) => `Calculated insight: ${redact(item)}`),
    ...analysis.warnings.slice(0, 5).map((item) => `Caveat: ${redact(item)}`),
    `Evidence: ${analysis.evidence.factView}; ${analysis.evidence.sourceRows} contributing rows; ${analysis.evidence.dateRange}; ${analysis.evidence.currency}; as of ${analysis.evidence.asOf}.`,
    ...analysis.followUps.slice(0, 4).map((item) => `Existing follow-up: ${redact(item)}`),
  ].map((value) => compactText(redact(value), 500));

  return { chart, method, evidence };
}

export function parseFinkeyAiRequest(value: unknown): ValidationResult<FinkeyAiRequest> {
  if (!isPlainRecord(value)) return invalid("Request body must be a JSON object.");
  if (value.mode === "interpret") return parseInterpretRequest(value);
  if (value.mode === "explain") return parseExplainRequest(value);
  return invalid("Request mode must be interpret or explain.");
}

export function parseAiPlanCandidate(value: unknown): ValidationResult<AiPlanCandidate> {
  const keys = [
    "status",
    "language",
    "intent",
    "metric",
    "dimension",
    "years",
    "quarter",
    "month",
    "filters",
    "limit",
    "sortDirection",
    "includeInternalTransfers",
    "countMode",
    "clarification",
  ];
  if (!isPlainRecord(value) || !hasExactKeys(value, keys)) {
    return invalid("AI plan has an invalid object shape.");
  }
  if (!isOneOf(value.status, ["supported", "clarify", "unsupported"] as const)) {
    return invalid("AI plan status is invalid.");
  }
  if (!isOneOf(value.language, ["en", "tr"] as const)) return invalid("AI plan language is invalid.");
  if (!isOneOf(value.intent, INTENTS)) return invalid("AI plan intent is invalid.");
  if (value.metric !== null && !isOneOf(value.metric, METRICS)) return invalid("AI plan metric is invalid.");
  if (value.dimension !== null && !isOneOf(value.dimension, DIMENSIONS)) return invalid("AI plan dimension is invalid.");
  if (
    !Array.isArray(value.years) ||
    value.years.length > 8 ||
    value.years.some((year) => !Number.isInteger(year) || year < 1900 || year > 2100) ||
    new Set(value.years).size !== value.years.length
  ) {
    return invalid("AI plan years are invalid.");
  }
  if (value.quarter !== null && !isOneOf(value.quarter, QUARTERS)) return invalid("AI plan quarter is invalid.");
  if (value.month !== null && !isOneOf(value.month, MONTHS)) return invalid("AI plan month is invalid.");
  if (!Array.isArray(value.filters) || value.filters.length > 8) return invalid("AI plan filters are invalid.");
  for (const filter of value.filters) {
    if (!isPlainRecord(filter) || !hasExactKeys(filter, ["field", "value"])) {
      return invalid("AI plan filter shape is invalid.");
    }
    if (!isOneOf(filter.field, FILTER_FIELDS) || !isSafeString(filter.value, 1, 120)) {
      return invalid("AI plan filter is invalid.");
    }
  }
  const limit = value.limit;
  if (
    limit !== null &&
    (typeof limit !== "number" || !Number.isInteger(limit) || limit < 1 || limit > 12)
  ) {
    return invalid("AI plan limit is invalid.");
  }
  if (!isOneOf(value.sortDirection, ["asc", "desc"] as const)) return invalid("AI plan sort direction is invalid.");
  if (typeof value.includeInternalTransfers !== "boolean" || typeof value.countMode !== "boolean") {
    return invalid("AI plan flags are invalid.");
  }
  if (value.clarification !== null && !isSafeString(value.clarification, 1, 240)) {
    return invalid("AI plan clarification is invalid.");
  }
  if (value.status === "supported" && (value.metric === null || value.dimension === null || value.clarification !== null)) {
    return invalid("A supported AI plan needs a metric and dimension without clarification text.");
  }
  if (value.status !== "supported" && value.clarification === null) {
    return invalid("A non-supported AI plan needs clarification text.");
  }
  if (value.status !== "supported" && (value.metric !== null || value.dimension !== null)) {
    return invalid("A non-supported AI plan must not claim a metric or dimension.");
  }
  return { ok: true, value: value as unknown as AiPlanCandidate };
}

export function validateAiPlanAgainstCatalog(
  candidate: AiPlanCandidate,
  catalog: FinkeyAiCatalog,
): ValidationResult<AiPlanCandidate> {
  const startYear = Number(catalog.dateStart.slice(0, 4));
  const endYear = Number(catalog.dateEnd.slice(0, 4));
  if (candidate.years.some((year) => year < startYear || year > endYear)) {
    return invalid("AI plan requested a year outside the supplied catalog.");
  }
  return { ok: true, value: candidate };
}

/**
 * Prevents a structurally valid model plan from silently substituting an
 * additive total for a calculation that the plan schema cannot represent.
 * Reclassification is preferable to an upstream error because the caller can
 * still render Finkey's deterministic unsupported-result experience.
 */
export function applyAiPlanSemanticGuard(
  candidate: AiPlanCandidate,
  question: string,
): AiPlanCandidate {
  if (candidate.status !== "supported") return candidate;

  const normalized = normalizeForMatching(question);
  const metric = candidate.metric;
  let unsupportedLabel: string | null = null;

  if (hasSemanticTerm(normalized, ["median", "medyan"])) {
    unsupportedLabel = candidate.language === "tr" ? "Medyan hesabı" : "Median calculation";
  } else if (
    hasSemanticTerm(normalized, [
      "growth",
      "growth rate",
      "grew",
      "grown",
      "growing",
      "cagr",
      "compound annual growth rate",
      "yoy",
      "year over year",
      "year on year",
      "mom",
      "month over month",
      "month on month",
      "qoq",
      "q q",
      "q o q",
      "quarter over quarter",
      "quarter on quarter",
      "y y",
      "y o y",
      "m m",
      "m o m",
      "buyume",
      "buyumesi",
      "buyudu",
      "artis orani",
    ])
  ) {
    unsupportedLabel = candidate.language === "tr" ? "Büyüme hesabı" : "Growth calculation";
  } else if (
    hasSemanticTerm(normalized, ["average", "averaged", "avg", "mean", "ortalama", "ortalamasi"]) &&
    metric !== "mapping_confidence" &&
    metric !== "settlement_lag"
  ) {
    unsupportedLabel = candidate.language === "tr" ? "Ortalama hesabı" : "Average calculation";
  } else if (
    hasSemanticTerm(normalized, [
      "share",
      "shares",
      "percentage",
      "percentages",
      "percent",
      "ratio",
      "ratios",
      "rate",
      "rates",
      "proportion",
      "proportions",
      "fraction",
      "fractions",
      "mix",
      "mixture",
      "portion",
      "portions",
      "composition",
      "compositions",
      "pct",
      "proportional",
      "%",
      "yuzde",
      "yuzdesi",
      "orani",
      "oran",
      "payi",
      "pay",
    ]) &&
    !isSupportedRatioQuestion(metric, normalized)
  ) {
    unsupportedLabel = candidate.language === "tr" ? "Oran veya pay hesabı" : "Rate or share calculation";
  } else if (
    candidate.countMode &&
    hasSemanticTerm(normalized, [
      "share", "shares", "percentage", "percentages", "percent", "ratio", "ratios", "rate", "rates", "%",
      "proportion", "proportions", "fraction", "fractions", "mix", "mixture", "portion", "portions",
      "composition", "compositions", "pct", "proportional",
      "yuzde", "yuzdesi", "oran", "orani", "payi",
    ])
  ) {
    unsupportedLabel = candidate.language === "tr" ? "Oran veya pay hesabı" : "Rate or share calculation";
  }

  if (!unsupportedLabel) return candidate;
  const clarification = candidate.language === "tr"
    ? `${unsupportedLabel} mevcut sorgu planında güvenilir biçimde temsil edilmiyor; yerine toplam değer kullanılmadı.`
    : `${unsupportedLabel} is not represented reliably by the current query plan; no total was substituted.`;

  return {
    ...candidate,
    status: "unsupported",
    metric: null,
    dimension: null,
    years: [],
    quarter: null,
    month: null,
    filters: [],
    limit: null,
    countMode: false,
    clarification,
  };
}

export function parseFinkeyAiEnhancement(
  value: unknown,
  evidence?: CompactAiEvidence,
): ValidationResult<FinkeyAiEnhancement> {
  const keys = ["executiveSummary", "drivers", "implications", "caveats", "followUps", "evidenceRefs"];
  if (!isPlainRecord(value) || !hasExactKeys(value, keys)) {
    return invalid("AI enhancement has an invalid object shape.");
  }
  if (!isSafeString(value.executiveSummary, 1, 600)) {
    return invalid("AI executive summary is invalid.");
  }
  const arrayRules: Array<[keyof Pick<FinkeyAiEnhancement, "drivers" | "implications" | "caveats" | "followUps">, number, number, number]> = [
    ["drivers", 1, 4, 280],
    ["implications", 0, 0, 280],
    ["caveats", 1, 3, 280],
    ["followUps", 1, 4, 220],
  ];
  for (const [key, minimum, maximum, maxLength] of arrayRules) {
    const items = value[key];
    if (
      !Array.isArray(items) ||
      items.length < minimum ||
      items.length > maximum ||
      items.some((item) => !isSafeString(item, 1, maxLength))
    ) {
      return invalid(`AI enhancement ${key} are invalid.`);
    }
  }
  if (
    !Array.isArray(value.evidenceRefs) ||
    value.evidenceRefs.length < 1 ||
    value.evidenceRefs.length > 3 ||
    value.evidenceRefs.some((item) => !isOneOf(item, EVIDENCE_REFS)) ||
    new Set(value.evidenceRefs).size !== value.evidenceRefs.length
  ) {
    return invalid("AI enhancement evidence references are invalid.");
  }

  const enhancement = value as unknown as FinkeyAiEnhancement;
  if (evidence) {
    const numericCheck = validateEnhancementNumbers(enhancement, evidence);
    if (!numericCheck.ok) return numericCheck;
    const groundingCheck = validateEnhancementGrounding(enhancement, evidence);
    if (!groundingCheck.ok) return groundingCheck;
  }
  return { ok: true, value: enhancement };
}

export function validateEnhancementNumbers(
  enhancement: FinkeyAiEnhancement,
  evidence: CompactAiEvidence,
): ValidationResult<FinkeyAiEnhancement> {
  const allowed = new Set(extractNumericTokens([...evidence.chart, ...evidence.method, ...evidence.evidence].join("\n")));
  const output = [
    enhancement.executiveSummary,
    ...enhancement.drivers,
    ...enhancement.implications,
    ...enhancement.caveats,
    ...enhancement.followUps,
  ].join("\n");
  const unexpected = extractNumericTokens(output).find((token) => !allowed.has(token));
  return unexpected
    ? invalid("AI enhancement introduced a numeric token not found in deterministic evidence.")
    : { ok: true, value: enhancement };
}

export function validateEnhancementGrounding(
  enhancement: FinkeyAiEnhancement,
  evidence: CompactAiEvidence,
): ValidationResult<FinkeyAiEnhancement> {
  const evidenceItems = [...evidence.chart, ...evidence.method, ...evidence.evidence];
  const evidenceText = evidenceItems.join("\n");

  if (enhancement.implications.length !== 0) {
    return invalid("AI enhancement implications must be empty.");
  }

  const allOutput = [
    enhancement.executiveSummary,
    ...enhancement.drivers,
    ...enhancement.implications,
    ...enhancement.caveats,
    ...enhancement.followUps,
  ];
  if (allOutput.some(containsUnsafeNarrativeContent)) {
    return invalid("AI enhancement contained unsafe markup, extraction language, or hidden-context claims.");
  }

  for (const [label, statement] of [
    ["executive summary", enhancement.executiveSummary],
    ...enhancement.drivers.map((item) => ["driver", item] as const),
  ] as const) {
    const grounded = validateFactualStatement(statement, evidenceItems);
    if (!grounded.ok) return invalid(`AI enhancement ${label} was not directly grounded in deterministic evidence.`);
  }

  for (const caveat of enhancement.caveats) {
    const grounded = validateFactualStatement(caveat, evidenceItems, true);
    if (!grounded.ok) return invalid("AI enhancement caveat was not grounded in supplied limitations.");
  }

  const caveatPolarity = validateSimulationCaveatPolarity(enhancement.caveats, evidenceText);
  if (!caveatPolarity.ok) return caveatPolarity;

  const suppliedFollowUps = evidence.evidence
    .filter((item) => /^Existing follow-up:\s*/iu.test(item))
    .map((item) => normalizeForMatching(item.replace(/^Existing follow-up:\s*/iu, "")));
  if (enhancement.followUps.some((followUp) => {
    if (isUnsafeFollowUp(followUp)) return true;
    if (suppliedFollowUps.length > 0) {
      return !suppliedFollowUps.includes(normalizeForMatching(followUp));
    }
    return extractNumericTokens(followUp).length > 0;
  })) {
    return invalid("AI enhancement suggested a follow-up that is not safely answerable from the supplied dataset.");
  }

  for (const reference of enhancement.evidenceRefs) {
    if (evidence[reference].length === 0) {
      return invalid("AI enhancement referenced an empty evidence group.");
    }
  }

  return { ok: true, value: enhancement };
}

function parseInterpretRequest(value: Record<string, unknown>): ValidationResult<FinkeyAiInterpretRequest> {
  if (!hasExactKeys(value, ["mode", "question", "catalog"])) return invalid("Interpret request shape is invalid.");
  if (!isSafeString(value.question, 1, 1_200)) return invalid("Question is invalid.");
  if (!isPlainRecord(value.catalog) || !hasExactKeys(value.catalog, ["dateStart", "dateEnd", "currency", "simulated"])) {
    return invalid("Catalog shape is invalid.");
  }
  const { dateStart, dateEnd, currency, simulated } = value.catalog;
  if (!isIsoDate(dateStart) || !isIsoDate(dateEnd) || dateStart > dateEnd) return invalid("Catalog dates are invalid.");
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) return invalid("Catalog currency is invalid.");
  if (typeof simulated !== "boolean") return invalid("Catalog simulated flag is invalid.");
  return { ok: true, value: value as unknown as FinkeyAiInterpretRequest };
}

function parseExplainRequest(value: Record<string, unknown>): ValidationResult<FinkeyAiExplainRequest> {
  if (!hasExactKeys(value, ["mode", "question", "evidence"])) return invalid("Explain request shape is invalid.");
  if (!isSafeString(value.question, 1, 1_200)) return invalid("Question is invalid.");
  if (!isPlainRecord(value.evidence) || !hasExactKeys(value.evidence, ["chart", "method", "evidence"])) {
    return invalid("Evidence shape is invalid.");
  }
  const rules: Array<[keyof CompactAiEvidence, number, number, number]> = [
    ["chart", 0, 48, 320],
    ["method", 1, 4, 700],
    ["evidence", 1, 24, 500],
  ];
  let totalLength = 0;
  for (const [key, minimum, maximum, maxLength] of rules) {
    const items = value.evidence[key];
    if (
      !Array.isArray(items) ||
      items.length < minimum ||
      items.length > maximum ||
      items.some((item) => !isSafeString(item, 1, maxLength))
    ) {
      return invalid(`Evidence ${key} is invalid.`);
    }
    totalLength += items.reduce((sum, item) => sum + (item as string).length, 0);
  }
  if (totalLength > 20_000) return invalid("Evidence is too large.");
  return { ok: true, value: value as unknown as FinkeyAiExplainRequest };
}

const CAUSAL_CLAIM_PATTERN = /\b(?:because|caused?|causing|driven by|due to|owing to|led to|leads to|resulted from|results from|attributed? to|nedeniyle|sebebiyle|kaynaklandi|kaynaklaniyor|yol acti|yol acar)\b/u;
const UNSAFE_FOLLOW_UP_PATTERN = /\b(?:forecast|predict|projection|future|next year|why|root cause|caused?|because|external market|web search|raw rows?|raw files?|download files?|api key|password|credential|system prompt|hidden instructions?|gelecek|tahmin|neden|ham satir|api anahtari|sifre|sistem istemi)\b/u;
const SIMULATION_TERM_PATTERN = /\b(?:simulated|simulation|simule|sentetik)\b/u;
const AUDIT_TERM_PATTERN = /\b(?:audit|audited|unaudited|denetim|denetlenmis|denetlenmemis)\b/u;
const LIMITATION_NEGATION_PATTERN = /\b(?:not|never|non|rather|without|degil|degildir|degildi|edilmemis)\b/u;

const SAFE_FACTUAL_WORDS = new Set(
  [
    "a", "an", "and", "are", "as", "at", "be", "been", "being", "but", "by", "data",
    "deterministic", "evidence", "exact", "figure", "figures", "for", "from", "had", "has",
    "have", "in", "indicate", "indicated", "indicates", "is", "it", "its", "metric", "metrics",
    "observed", "of", "on", "only", "or", "period", "reported", "reports", "same", "show",
    "showed", "showing", "shown", "shows", "supplied", "that", "the", "their", "them", "these",
    "they", "this", "those", "through", "to", "value", "values", "verified", "versus", "was",
    "represent", "represented", "representing",
    "we", "were", "while", "with", "within",
    "ama", "bu", "bunlar", "da", "de", "deger", "degerler", "deterministik", "dogrulanmis",
    "donem", "gore", "gosterdi", "gosteriyor", "ile", "icin", "kanit", "metrik", "olarak", "olan",
    "sadece", "su", "sunulan", "veri", "ve", "veya",
  ].map(normalizeForMatching),
);

const SAFE_CAVEAT_WORDS = new Set(
  [
    ...SAFE_FACTUAL_WORDS,
    "audit", "audited", "indicative", "limitation", "limitations", "not", "source", "sources",
    "unaudited", "uyari", "sinir", "sinirli",
  ].map(normalizeForMatching),
);

function validateFactualStatement(
  statement: string,
  evidenceItems: string[],
  caveat = false,
): ValidationResult<string> {
  const evidenceText = evidenceItems.join("\n");
  const normalizedStatement = normalizeForMatching(statement);
  const normalizedEvidence = normalizeForMatching(evidenceText);
  // Explain-mode instructions require caveats to be copied verbatim. Accept an
  // exact supplied Caveat item before clause analysis so conjunctions inside a
  // limitation cannot make an otherwise identical warning fail grounding.
  if (
    caveat &&
    evidenceItems.some((item) =>
      normalizeForMatching(item.replace(/^Caveat:\s*/iu, "")) === normalizedStatement,
    )
  ) {
    return { ok: true, value: statement };
  }
  if (
    CAUSAL_CLAIM_PATTERN.test(normalizedStatement) &&
    !normalizedEvidence.includes(normalizedStatement)
  ) {
    return invalid("Causal language was not present verbatim in deterministic evidence.");
  }

  const evidenceWords = new Set(extractNarrativeWords(normalizedEvidence));
  const safeWords = caveat ? SAFE_CAVEAT_WORDS : SAFE_FACTUAL_WORDS;
  const statementWords = extractNarrativeWords(normalizedStatement);
  const unsupportedWord = statementWords.find(
    (word) => !safeWords.has(word) && !wordAppearsInEvidence(word, evidenceWords),
  );
  if (unsupportedWord) return invalid("A qualitative term was not supplied by deterministic evidence.");

  const evidenceAtoms = buildEvidenceAtoms(evidenceItems);
  let matchedClaim = false;
  // Validate every statement-level fact against one deterministic evidence atom.
  // Coordinated measures deliberately stay together so a single value cannot be
  // laundered across two different metrics.
  for (const fact of splitNarrativeFacts(statement)) {
    const numericTokens = extractNumericTokens(fact);
    const claimWords = extractClaimWords(fact, safeWords);
    if (numericTokens.length === 0 && claimWords.length === 0) continue;
    if (numericTokens.length > 0 && claimWords.length === 0) {
      return invalid("A numeric claim did not identify the evidenced measure it describes.");
    }

    const relationshipMatched = evidenceAtoms.some((atom) => {
      const atomWords = new Set(extractNarrativeWords(atom.text));
      return (
        numericTokens.every((token) => atom.numericTokens.has(token)) &&
        (numericTokens.length === 0 || caveat || numericTokens.some((token) => atom.valueTokens.has(token))) &&
        claimWords.every((word) => wordAppearsInEvidence(word, atomWords))
      );
    });
    if (!relationshipMatched) {
      return invalid("A claim's measure, value, and qualifiers were not grounded together in one evidence fact.");
    }
    matchedClaim = true;
  }

  return matchedClaim
    ? { ok: true, value: statement }
    : invalid("The statement had no deterministic evidence anchor.");
}

function validateSimulationCaveatPolarity(
  caveats: string[],
  evidenceText: string,
): ValidationResult<null> {
  const evidenceSimulationPolarity = limitationPolarity(evidenceText, SIMULATION_TERM_PATTERN);
  const caveatSimulationPolarity = limitationPolarity(caveats.join(". "), SIMULATION_TERM_PATTERN);
  if (
    evidenceSimulationPolarity === "mixed" ||
    caveatSimulationPolarity === "mixed" ||
    caveatSimulationPolarity !== evidenceSimulationPolarity
  ) {
    return invalid("AI enhancement omitted or contradicted the supplied simulated-data caveat.");
  }

  const evidenceAuditPolarity = auditPolarity(evidenceText);
  const caveatAuditPolarity = auditPolarity(caveats.join(". "));
  if (
    evidenceAuditPolarity === "mixed" ||
    caveatAuditPolarity === "mixed" ||
    caveatAuditPolarity !== evidenceAuditPolarity
  ) {
    return invalid("AI enhancement contradicted the supplied audit-status caveat.");
  }

  return { ok: true, value: null };
}

function limitationPolarity(
  value: string,
  termPattern: RegExp,
): "affirmative" | "negative" | "mixed" | "none" {
  let affirmative = false;
  let negative = false;
  for (const rawClause of splitNarrativeClauses(value)) {
    const clause = normalizeForMatching(rawClause);
    if (!termPattern.test(clause)) continue;
    if (LIMITATION_NEGATION_PATTERN.test(clause)) negative = true;
    else affirmative = true;
  }
  if (affirmative && negative) return "mixed";
  if (affirmative) return "affirmative";
  if (negative) return "negative";
  return "none";
}

function auditPolarity(value: string): "affirmative" | "negative" | "mixed" | "none" {
  let affirmative = false;
  let negative = false;
  for (const rawClause of splitNarrativeClauses(value)) {
    const clause = normalizeForMatching(rawClause);
    if (!AUDIT_TERM_PATTERN.test(clause)) continue;
    if (
      /\b(?:unaudited|denetlenmemis)\b/u.test(clause) ||
      LIMITATION_NEGATION_PATTERN.test(clause)
    ) {
      negative = true;
    } else {
      affirmative = true;
    }
  }
  if (affirmative && negative) return "mixed";
  if (affirmative) return "affirmative";
  if (negative) return "negative";
  return "none";
}

type EvidenceAtom = {
  text: string;
  numericTokens: Set<string>;
  valueTokens: Set<string>;
};

function evidenceAtom(text: string, valueSource = text): EvidenceAtom {
  return {
    text,
    numericTokens: new Set(extractNumericTokens(text)),
    valueTokens: new Set(extractNumericTokens(valueSource).filter((token) => !token.startsWith("DATE:"))),
  };
}

function buildEvidenceAtoms(evidenceItems: string[]): EvidenceAtom[] {
  const atoms: EvidenceAtom[] = [];
  for (const item of evidenceItems) {
    const pipeSegments = item.split(/\s*\|\s*/u).filter(Boolean);
    if (pipeSegments.length === 1) {
      // The calculated summary is a trusted, metric-qualified relationship. Keep
      // its complete form as well as its clauses so a faithful restatement may
      // connect the ranked value and share without weakening other evidence.
      if (/^calculated summary for\b/u.test(normalizeForMatching(item))) {
        atoms.push(evidenceAtom(item));
      }
      for (const clause of splitNarrativeClauses(item)) atoms.push(evidenceAtom(clause));
      continue;
    }

    const rowLabel = pipeSegments[0];
    atoms.push(evidenceAtom(rowLabel, ""));
    if (/^kpi\b/u.test(normalizeForMatching(rowLabel)) && pipeSegments[1]) {
      atoms.push(evidenceAtom(pipeSegments.join(" "), pipeSegments[1]));
      continue;
    }

    for (let index = 1; index < pipeSegments.length; index += 1) {
      const segment = pipeSegments[index];
      for (const clause of splitNarrativeClauses(segment)) {
        const clauseNumbers = extractNumericTokens(clause);
        const clauseWords = extractClaimWords(clause, SAFE_FACTUAL_WORDS);
        if (clauseNumbers.length > 0 && clauseWords.length > 0) {
          atoms.push(evidenceAtom(`${rowLabel} ${clause}`, clause));
          continue;
        }
        if (clauseNumbers.length > 0) {
          const previous = pipeSegments[index - 1];
          const previousNumbers = extractNumericTokens(previous);
          const previousWords = extractClaimWords(previous, SAFE_FACTUAL_WORDS);
          if (previousNumbers.length === 0 && previousWords.length > 0) {
            atoms.push(evidenceAtom(`${rowLabel} ${previous} ${clause}`, clause));
          }
          continue;
        }
        atoms.push(evidenceAtom(clause, ""));
      }
    }
  }
  return atoms;
}

function splitNarrativeFacts(value: string): string[] {
  return value
    .split(/\s*(?:[;!?]+|\.(?=\s|$))\s*/u)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitNarrativeClauses(value: string): string[] {
  return value
    .split(/\s*(?:[;!?]+|,(?=\s)|\.(?=\s|$))\s*|\s+\b(?:and|but|while|whereas|versus|vs|with)\b\s+/iu)
    .map((item) => item.trim())
    .filter(Boolean);
}

function extractClaimWords(value: string, safeWords: ReadonlySet<string>): string[] {
  const withoutNumbers = value
    .replace(/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/gu, " ")
    .replace(/(?:[$€£]\s*)?[+-]?(?:\d{1,3}(?:[ ,]\d{3})+|\d+)(?:[.,]\d+)?(?:\s?(?:%|[KMB]))?/giu, " ");
  return [...new Set(
    extractNarrativeWords(withoutNumbers).filter((word) => !safeWords.has(word)),
  )];
}

function containsUnsafeNarrativeContent(value: string): boolean {
  const normalized = normalizeForMatching(value);
  return (
    /(?:https?:\/\/|www\.|```|\[[^\]]+\]\([^)]*\))/iu.test(value) ||
    /^\s*(?:[-*#]|\d+[.)])\s+/mu.test(value) ||
    /\b(?:api key|password|credential|system prompt|hidden instruction|raw row|raw file|api anahtari|sifre|sistem istemi|ham satir)\b/u.test(normalized)
  );
}

function isUnsafeFollowUp(value: string): boolean {
  return UNSAFE_FOLLOW_UP_PATTERN.test(normalizeForMatching(value));
}

function extractNarrativeWords(value: string): string[] {
  return normalizeForMatching(value).match(/[a-z][a-z0-9]*/gu) ?? [];
}

function wordAppearsInEvidence(word: string, evidenceWords: ReadonlySet<string>): boolean {
  if (evidenceWords.has(word)) return true;
  if (word.length > 5 && word.endsWith("s") && evidenceWords.has(word.slice(0, -1))) return true;
  if (word.length > 5 && evidenceWords.has(`${word}s`)) return true;
  return false;
}

function hasSemanticTerm(normalizedQuestion: string, terms: readonly string[]): boolean {
  const padded = ` ${normalizedQuestion} `;
  return terms.some((term) => {
    const normalizedTerm = normalizeForMatching(term);
    return normalizedTerm === "%"
      ? normalizedQuestion.includes("%")
      : padded.includes(` ${normalizedTerm} `);
  });
}

function isSupportedRatioQuestion(
  metric: AiPlanCandidate["metric"],
  normalizedQuestion: string,
): boolean {
  if (metric === "operating_margin") {
    return hasSemanticTerm(normalizedQuestion, ["margin", "marj"]);
  }
  if (metric === "mapping_coverage") {
    return hasSemanticTerm(normalizedQuestion, [
      "mapping", "mapped", "coverage", "esleme", "eslesme", "eslesmis",
    ]);
  }
  if (metric === "mapping_confidence") {
    return hasSemanticTerm(normalizedQuestion, ["mapping confidence", "confidence", "guven"]);
  }
  if (metric === "on_time_rate") {
    return hasSemanticTerm(normalizedQuestion, ["on time", "on-time", "zamaninda"]);
  }
  return false;
}

function normalizeForMatching(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll("ı", "i")
    .replace(/[^a-z0-9%€$£]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractNumericTokens(value: string): string[] {
  const dates = value.match(/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/g) ?? [];
  const withoutDates = value.replace(/\b(?:19|20)\d{2}-\d{2}-\d{2}\b/g, " ");
  const numbers = (
    withoutDates.match(/(?:[$€£]\s*)?[+-]?(?:\d{1,3}(?:[ ,]\d{3})+|\d+)(?:[.,]\d+)?(?:\s?(?:%|[KMB]))?/gi) ?? []
  ).map(normalizeNumericToken);
  return [...dates.map((date) => `DATE:${date}`), ...numbers];
}

function normalizeNumericToken(value: string): string {
  const compact = value.replaceAll(" ", "");
  const currency = compact.match(/^[$€£]/)?.[0] ?? "";
  const unit = compact.match(/(?:%|[KMB])$/i)?.[0].toUpperCase() ?? "";
  let numeric = compact.slice(currency.length, unit ? -unit.length : undefined);
  if (numeric.includes(",") && numeric.includes(".")) numeric = numeric.replaceAll(",", "");
  else if (/^[+-]?\d{1,3}(?:,\d{3})+$/.test(numeric)) numeric = numeric.replaceAll(",", "");
  else numeric = numeric.replace(",", ".");
  return `${currency}${numeric.replace(/^\+/, "")}${unit}`;
}

function compactText(value: string, maxLength: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function buildEntityTokenMap(analysis: AnalysisResult): Map<string, string> {
  const tokens = new Map<string, string>();
  const tokenCounts = new Map<string, number>();
  const addAliases = (rawAliases: Array<string | number | undefined>, prefix: string): void => {
    const aliases = rawAliases
      .map((alias) => String(alias ?? "").trim())
      .filter((alias) => alias.length > 0 && !/^(?:unspecified|unknown|other)$/iu.test(alias));
    if (aliases.length === 0) return;
    const existing = [...tokens].find(([label]) =>
      aliases.some((alias) => normalizeForMatching(alias) === normalizeForMatching(label)),
    )?.[1];
    const token = existing ?? `${prefix} ${(tokenCounts.get(prefix) ?? 0) + 1}`;
    if (!existing) tokenCounts.set(prefix, (tokenCounts.get(prefix) ?? 0) + 1);
    for (const alias of aliases) tokens.set(alias, token);
  };

  if (SENSITIVE_ENTITY_DIMENSIONS.has(analysis.plan.dimension)) {
    const prefix = ENTITY_TOKEN_PREFIX[analysis.plan.dimension] ?? "Entity";
    for (const datum of analysis.chartData.slice(0, 48)) {
      addAliases([datum.label, datum.rawLabel], prefix);
    }
  }

  for (const filter of analysis.plan.filters ?? []) {
    if (!SENSITIVE_ENTITY_FILTER_FIELDS.has(filter.field as (typeof FILTER_FIELDS)[number])) continue;
    const prefix = ENTITY_TOKEN_PREFIX[filter.field as (typeof DIMENSIONS)[number]] ?? "Entity";
    for (const value of filter.values) addAliases([value], prefix);
    if (filter.values.length === 0) addAliases([filter.label], prefix);
  }
  return tokens;
}

function redactEntityLabels(value: string, tokens: ReadonlyMap<string, string>): string {
  const labels = [...tokens.keys()].sort((left, right) => right.length - left.length);
  if (labels.length === 0) return value;
  const tokenByLowercaseLabel = new Map(
    labels.map((label) => [label.toLocaleLowerCase("en-US"), tokens.get(label) as string]),
  );
  const escapedLabels = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return value.replace(
    new RegExp(escapedLabels.join("|"), "giu"),
    (label) => tokenByLowercaseLabel.get(label.toLocaleLowerCase("en-US")) ?? "Entity",
  );
}

function formatChartEvidenceValue(value: string | number, series: ChartSeries): string {
  if (typeof value !== "number") return value;
  if (series.format === "currency") return formatCurrency(value);
  if (series.format === "percent") return formatPercent(value);
  return formatNumber(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isSafeString(value: unknown, minLength: number, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= minLength &&
    value.length <= maxLength &&
    !containsHtml(value)
  );
}

function containsHtml(value: string): boolean {
  return /<(?:!doctype|!--|\/?[a-z][^>]*)>/i.test(value);
}

function isOneOf<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function invalid<T>(message: string): ValidationResult<T> {
  return { ok: false, message };
}

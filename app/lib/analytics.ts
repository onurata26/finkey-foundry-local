export type FinanceRecord = {
  id: string;
  rowType: string;
  period: string;
  transactionId: string;
  bankAccountId: string;
  account: string;
  transactionDate: string;
  transactionSequence: number | null;
  direction: string;
  bankAmount: number;
  bankAmountOriginal: number;
  bankCurrency: string;
  bankCounted: boolean;
  runningBalance: number | null;
  counterpartyRaw: string;
  description: string;
  reference: string;
  paymentMethod: string;
  bankChannel: string;
  countryHint: string;
  merchantHint: string;
  split: boolean;
  duplicateCandidate: boolean;
  reversalCandidate: boolean;
  internalTransferCandidate: boolean;
  dataQualityFlag: boolean;
  dataQualityType: string;
  mappingType: string;
  businessAmount: number;
  allocatedAmount: number;
  allocationRatio: number | null;
  mappingConfidence: number | null;
  allocationStatus: string;
  mappingExplanation: string;
  businessEventId: string;
  businessDate: string;
  businessMonth: string;
  fiscalYear: number | null;
  fiscalQuarter: string;
  region: string;
  country: string;
  customerId: string;
  customer: string;
  supplierId: string;
  supplier: string;
  counterparty: string;
  counterpartyType: string;
  eventType: string;
  category: string;
  product: string;
  department: string;
  costCenter: string;
  project: string;
  salesChannel: string;
  contractId: string;
  invoiceNumber: string;
  invoiceAmount: number | null;
  businessCurrency: string;
  businessValue: number;
  paymentTermsDays: number | null;
  dueDate: string;
  settlementDate: string;
  settlementStatus: string;
  settlementLagDays: number | null;
  agingBucket: string;
  openAmount: number;
  overdue: boolean;
  refundOrReversal: boolean;
  platformPayout: boolean;
  assumptionLevel: string;
  customerType: string;
  duplicateGroup: string;
};

export type FinanceDataset = {
  meta: {
    generatedAt: string;
    asOf: string;
    simulated: boolean;
    sourceFile: string;
    sourceLabel: string;
    currency: string;
    rowCount: number;
    sourceColumnCount: number;
    dateStart: string;
    dateEnd: string;
    periodCount: number;
    uniqueBankTransactions: number;
    uniqueBusinessEvents: number;
    bankNet: number;
    bankInflow: number;
    bankOutflow: number;
    businessNet: number;
    reconciliationDifference: number;
    openAmount: number;
    overdueOpenAmount: number;
    averageMappingConfidence: number;
    dataQualityIssueRows: number;
    duplicateCandidateRows: number;
    statusCounts: Record<string, number>;
  };
  dimensions: Record<string, string[]>;
  records: FinanceRecord[];
};

export type MetricId =
  | "net_revenue"
  | "gross_revenue"
  | "operating_costs"
  | "operating_result"
  | "operating_margin"
  | "cash_inflow"
  | "cash_outflow"
  | "net_cash"
  | "cash_balance"
  | "customer_collections"
  | "supplier_payments"
  | "open_ar"
  | "open_ap"
  | "open_balance"
  | "overdue_open"
  | "refunds"
  | "reconciliation_gap"
  | "mapping_coverage"
  | "review_items"
  | "data_quality"
  | "mapping_confidence"
  | "on_time_rate"
  | "settlement_lag"
  | "transactions";

export type DimensionId =
  | "month"
  | "quarter"
  | "year"
  | "region"
  | "country"
  | "customer"
  | "supplier"
  | "counterparty"
  | "category"
  | "product"
  | "department"
  | "project"
  | "salesChannel"
  | "allocationStatus"
  | "settlementStatus"
  | "agingBucket"
  | "paymentMethod"
  | "account"
  | "eventType"
  | "dataQualityType";

export type AiFilterField =
  | "region"
  | "country"
  | "customer"
  | "supplier"
  | "counterparty"
  | "category"
  | "product"
  | "department"
  | "project"
  | "salesChannel"
  | "allocationStatus"
  | "settlementStatus"
  | "agingBucket"
  | "paymentMethod"
  | "account"
  | "eventType"
  | "dataQualityType"
  | "counterpartyType"
  | "duplicateCandidate";

type Basis = "cash" | "accrual" | "snapshot" | "quality" | "settlement";
type SourceKind = "bank" | "business" | "allocation";

type RateKind =
  | "review"
  | "data_quality"
  | "allocated"
  | "unmapped"
  | "duplicates";

export type QueryFilter = {
  field: keyof FinanceRecord | "year" | "month" | "quarter" | "date";
  label: string;
  values: Array<string | number>;
};

export type QueryPlan = {
  version: 1;
  language: "en" | "tr";
  intent: "trend" | "ranking" | "comparison" | "diagnostic" | "value";
  metric: MetricId;
  basis: Basis;
  dimension: DimensionId;
  filters: QueryFilter[];
  periodLabel: string;
  limit: number;
  sortDirection: "asc" | "desc";
  includeInternalTransfers: boolean;
  confidenceScore: number;
  confidenceLabel: "High" | "Medium" | "Needs scope";
  interpretedAs: string;
  unsupportedMetric?: string;
  countMode?: boolean;
  rateKind?: RateKind;
  showAll?: boolean;
};

export type AiPlanCandidate = {
  status: "supported" | "clarify" | "unsupported";
  language: "en" | "tr";
  intent: QueryPlan["intent"];
  metric: MetricId | null;
  dimension: DimensionId | null;
  years: number[];
  quarter: "Q1" | "Q2" | "Q3" | "Q4" | null;
  month: string | null;
  filters: Array<{ field: AiFilterField; value: string }>;
  limit: number | null;
  sortDirection: "asc" | "desc";
  includeInternalTransfers: boolean;
  countMode: boolean;
  clarification: string | null;
};

export type ChartDatum = {
  label: string;
  rawLabel?: string;
  [key: string]: string | number | undefined;
};

export type ChartSeries = {
  key: string;
  label: string;
  color: string;
  format: "currency" | "number" | "percent";
  kind?: "bar" | "line" | "area";
};

export type Kpi = {
  label: string;
  value: string;
  note: string;
  tone?: "positive" | "warning" | "neutral" | "negative";
};

export type DetailRow = {
  id: string;
  date: string;
  counterparty: string;
  context: string;
  amount: number;
  status: string;
};

export type AnalysisResult = {
  question: string;
  headline: string;
  summary: string;
  primaryValue: number;
  primaryFormat: "currency" | "number" | "percent";
  chartType: "bar" | "line" | "area" | "composed" | "donut";
  chartTitle: string;
  chartSubtitle: string;
  chartData: ChartDatum[];
  chartSeries: ChartSeries[];
  kpis: Kpi[];
  insights: string[];
  details: DetailRow[];
  plan: QueryPlan;
  method: string;
  evidence: {
    factView: string;
    sourceRows: number;
    dateRange: string;
    currency: string;
    asOf: string;
  };
  warnings: string[];
  followUps: string[];
};

export type FactStore = {
  raw: FinanceRecord[];
  bank: FinanceRecord[];
  business: FinanceRecord[];
};

const BLUE = "#2f6bff";
const INDIGO = "#6d5cff";
const CORAL = "#ef5b78";
const INK = "#17181c";

const BUSINESS_DIMENSIONS = new Set<DimensionId>([
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
  "eventType",
]);

const BUSINESS_FILTER_FIELDS = new Set<QueryFilter["field"]>([
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
  "eventType",
  "counterpartyType",
]);

const DIMENSION_FIELDS: Partial<Record<DimensionId, keyof FinanceRecord>> = {
  region: "region",
  country: "country",
  customer: "customer",
  supplier: "supplier",
  counterparty: "counterparty",
  category: "category",
  product: "product",
  department: "department",
  project: "project",
  salesChannel: "salesChannel",
  allocationStatus: "allocationStatus",
  settlementStatus: "settlementStatus",
  agingBucket: "agingBucket",
  paymentMethod: "paymentMethod",
  account: "account",
  eventType: "eventType",
  dataQualityType: "dataQualityType",
};

const DIMENSION_LABELS: Record<DimensionId, string> = {
  month: "month",
  quarter: "quarter",
  year: "year",
  region: "region",
  country: "country",
  customer: "customer",
  supplier: "supplier",
  counterparty: "counterparty",
  category: "category",
  product: "product / service",
  department: "department",
  project: "project",
  salesChannel: "sales channel",
  allocationStatus: "allocation status",
  settlementStatus: "settlement status",
  agingBucket: "aging bucket",
  paymentMethod: "payment method",
  account: "bank account",
  eventType: "business event",
  dataQualityType: "issue type",
};

const METRIC_LABELS: Record<MetricId, string> = {
  net_revenue: "Net revenue",
  gross_revenue: "Gross revenue",
  operating_costs: "Operating costs",
  operating_result: "Operating result",
  operating_margin: "Operating margin proxy",
  cash_inflow: "External cash inflow",
  cash_outflow: "External cash outflow",
  net_cash: "Net external cash movement",
  cash_balance: "Recorded closing movement balance",
  customer_collections: "Customer cash collections",
  supplier_payments: "Supplier cash payments",
  open_ar: "Recorded open receivables",
  open_ap: "Recorded open payables",
  open_balance: "Recorded open AR / AP",
  overdue_open: "Flagged overdue open amount",
  refunds: "Refunds and chargebacks",
  reconciliation_gap: "Bank-to-business net difference",
  mapping_coverage: "Mapping coverage",
  review_items: "Review-needed transactions",
  data_quality: "Data-quality exceptions",
  mapping_confidence: "Average mapping confidence",
  on_time_rate: "Status-based on-time rate",
  settlement_lag: "Average settlement lag",
  transactions: "Bank transactions",
};

const TURKISH_METRIC_LABELS: Partial<Record<MetricId, string>> = {
  net_revenue: "Net gelir",
  gross_revenue: "Brüt gelir",
  operating_costs: "İşletme maliyetleri",
  operating_result: "Faaliyet sonucu (veri seti göstergesi)",
  cash_inflow: "Dış nakit girişi",
  cash_outflow: "Dış nakit çıkışı",
  net_cash: "Net dış nakit hareketi",
  open_ar: "Kayıtlı açık alacak",
  open_ap: "Kayıtlı açık borç",
  open_balance: "Kayıtlı açık alacak / borç",
  refunds: "İade ve chargeback",
  reconciliation_gap: "Banka–iş verisi net farkı",
  data_quality: "Veri kalitesi istisnaları",
};

const MONTHS: Record<string, string> = {
  january: "01",
  jan: "01",
  ocak: "01",
  february: "02",
  feb: "02",
  subat: "02",
  march: "03",
  mar: "03",
  mart: "03",
  april: "04",
  apr: "04",
  nisan: "04",
  may: "05",
  mayis: "05",
  june: "06",
  jun: "06",
  haziran: "06",
  july: "07",
  jul: "07",
  temmuz: "07",
  august: "08",
  aug: "08",
  agustos: "08",
  september: "09",
  sep: "09",
  eylul: "09",
  october: "10",
  oct: "10",
  ekim: "10",
  november: "11",
  nov: "11",
  kasim: "11",
  december: "12",
  dec: "12",
  aralik: "12",
};

const UNSUPPORTED: Array<[string[], string]> = [
  [["mrr", "monthly recurring revenue", "aylik tekrarlayan gelir"], "MRR"],
  [["arr", "annual recurring revenue", "yillik tekrarlayan gelir"], "ARR"],
  [["cac", "customer acquisition cost", "musteri edinme maliyeti"], "CAC"],
  [["headcount", "employee count", "calisan sayisi"], "headcount"],
  [["budget variance", "butce farki", "butce sapmasi"], "budget variance"],
  [["balance sheet", "bilanco"], "a balance sheet"],
  [["ebitda"], "EBITDA"],
];

const COUNTABLE_METRICS = new Set<MetricId>([
  "refunds",
  "open_ar",
  "open_ap",
  "open_balance",
  "overdue_open",
  "mapping_coverage",
  "review_items",
  "data_quality",
  "transactions",
]);

const AI_FILTER_FIELDS = [
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
] as const satisfies readonly AiFilterField[];

const AI_FILTER_DIMENSION_KEYS: Partial<Record<AiFilterField, string>> = {
  region: "regions",
  country: "countries",
  customer: "customers",
  supplier: "suppliers",
  counterparty: "counterparties",
  category: "categories",
  product: "products",
  department: "departments",
  project: "projects",
  salesChannel: "salesChannels",
  allocationStatus: "allocationStatuses",
  settlementStatus: "settlementStatuses",
  agingBucket: "agingBuckets",
  paymentMethod: "paymentMethods",
  account: "accounts",
  eventType: "eventTypes",
};

const AI_CANDIDATE_KEYS = [
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
] as const;

function detectUnsupportedRequest(
  normalized: string,
  metricMatched: boolean,
  metric: MetricId,
  explicitDimension: DimensionId | null,
  dataset: FinanceDataset,
  rateKind?: RateKind,
): string | undefined {
  const catalogMatch = UNSUPPORTED.find(([aliases]) =>
    aliases.some((alias) => containsPhrase(normalized, normalize(alias))),
  );
  if (catalogMatch) return catalogMatch[1];

  if (
    /\b(?:excluding|without|except|outside|other than)\b/.test(normalized) &&
    !hasAny(normalized, ["internal transfer", "internal transfers", "ic transfer"])
  ) {
    return "Categorical exclusion is not represented by the current inclusion-only filter model";
  }

  if (
    (hasAny(normalized, ["compare", " vs ", " versus ", "between"])) &&
    (
      (hasAny(normalized, ["gross revenue"]) && hasAny(normalized, ["net revenue"])) ||
      hasAny(normalized, ["gross vs net revenue", "gross versus net revenue", "gross and net revenue"]) ||
      (hasAny(normalized, ["collection", "collections"]) && hasAny(normalized, ["supplier payment", "supplier payments"])) ||
      (hasAny(normalized, ["open receivable", "open receivables"]) && hasAny(normalized, ["overdue receivable", "overdue receivables"])) ||
      hasAny(normalized, ["open vs overdue receivables", "open versus overdue receivables"])
    )
  ) {
    return "A multi-metric comparison requiring separate calculation series";
  }

  if (hasAny(normalized, [
    "invoice number",
    "invoice id",
    "by invoice",
    "invoice inv-",
    "contract number",
    "contract id",
    "by contract",
  ])) {
    return "Invoice and contract identifiers are not reliable analytical keys";
  }

  if (
    hasAny(normalized, [
      "forecast",
      "forecasted",
      "projection",
      "projected",
      "predict",
      "prediction",
      "future",
      "next year",
      "next month",
      "next quarter",
      "tahmin",
      "projeksiyon",
      "gelecek yil",
      "gelecek ay",
      "ongoru",
    ])
  ) {
    return "A forecast or future-period answer";
  }

  const availableStartYear = Number(dataset.meta.dateStart.slice(0, 4));
  const availableEndYear = Number(dataset.meta.dateEnd.slice(0, 4));
  const requestedYears = [
    ...new Set((normalized.match(/\b(?:19|20)\d{2}\b/g) ?? []).map(Number)),
  ];
  const unavailableYears = requestedYears.filter(
    (year) => year < availableStartYear || year > availableEndYear,
  );
  if (unavailableYears.length > 0) {
    return `The requested ${unavailableYears.join(", ")} period`;
  }

  const mentionedMonths = new Set(
    Object.entries(MONTHS)
      .filter(([name]) => new RegExp(`\\b${name}\\b`).test(normalized))
      .map(([, month]) => month),
  );
  const mentionedQuarters = new Set(
    [...normalized.matchAll(/\bq([1-4])\b|\b([1-4])\.?\s*(?:quarter|ceyrek)\b/g)]
      .map((match) => `Q${match[1] ?? match[2]}`),
  );
  if (mentionedMonths.size > 1 || mentionedQuarters.size > 1) {
    return "Multiple month or quarter values in one request";
  }

  if (
    requestedYears.length === 1 &&
    (
      /\b(?:before|after|since|through|until)\s+(?:19|20)\d{2}\b/.test(normalized) ||
      /\bup to\s+(?:19|20)\d{2}\b/.test(normalized)
    )
  ) {
    return "An open-ended period relation";
  }

  if (hasAny(normalized, ["last month", "current month", "this month"])) {
    return "A relative month without an explicit calendar month";
  }
  if (
    requestedYears.length === 0 &&
    hasAny(normalized, ["last quarter", "current quarter", "this quarter"])
  ) {
    return "A relative month or quarter without an explicit reporting year";
  }

  const comparisonEntityCounts = [
    dataset.dimensions.countries ?? [],
    dataset.dimensions.customers ?? [],
    dataset.dimensions.suppliers ?? [],
  ].map((values) => values.filter((value) => normalized.includes(normalize(value))).length);
  if (
    hasAny(normalized, ["compare", " vs ", " versus ", "between"]) &&
    comparisonEntityCounts.some((count) => count > 1)
  ) {
    return "A multi-entity comparison requiring one independently grouped value per entity";
  }

  if (rateKind && explicitDimension) {
    return `Grouped ${rateLabel(rateKind).toLowerCase()} rates require a separately defined denominator for each ${DIMENSION_LABELS[explicitDimension]}`;
  }

  if (
    rateKind &&
    hasAny(normalized, [
      "percentage of mapped transactions",
      "percentage of fully allocated transactions",
      "percent of mapped transactions",
      "percent of fully allocated transactions",
      "among mapped transactions",
      "among fully allocated transactions",
      "within mapped transactions",
      "within fully allocated transactions",
    ])
  ) {
    return "A filtered transaction-rate denominator";
  }
  if (
    rateKind === "review" &&
    hasAny(normalized, [
      "mapped transactions",
      "mapped bank transactions",
      "allocated transactions",
      "fully allocated transactions",
      "unmapped transactions",
    ])
  ) {
    return "Review rate within a filtered allocation-status cohort";
  }

  if (
    /\bin\s+202[1-4]\b.*\bduring\s+202[1-4]\b/.test(normalized) ||
    /\bduring\s+202[1-4]\b.*\bin\s+202[1-4]\b/.test(normalized)
  ) {
    return "Contradictory time scopes";
  }

  if (hasAny(normalized, [
    "yoy",
    "year over year",
    "year on year",
    "year-over-year",
    "year-on-year",
    "mom",
    "month over month",
    "month on month",
    "month-over-month",
    "month-on-month",
    "cagr",
  ])) {
    return "YoY or MoM growth without an explicit comparison-period calculation";
  }

  if (hasAny(normalized, ["median", "medyan", "ortanca"])) {
    return "Median analysis without an explicit observation grain";
  }

  const asksForAverage = hasAny(normalized, [
    "average",
    "mean",
    "average monthly",
    "average quarterly",
    "ortalama",
  ]);
  if (
    asksForAverage &&
    !["settlement_lag", "mapping_confidence"].includes(metric)
  ) {
    return "The requested average aggregation";
  }

  if (hasAny(normalized, [
    "share of",
    "revenue share",
    "cost share",
    "proportion",
    "fraction",
    "ratio of",
    "portion",
    "revenue mix",
    "cost mix",
    "payi",
  ])) {
    return "The requested share and its comparison denominator";
  }

  const asksForRate = hasAny(normalized, [
    "percentage",
    "percent",
    " rate",
    "oran",
    "yuzde",
  ]);
  if (
    asksForRate &&
    !rateKind &&
    !["mapping_coverage", "on_time_rate", "mapping_confidence", "operating_margin"].includes(metric)
  ) {
    return metric === "refunds"
      ? "Refund rate without a defined event or revenue denominator"
      : "The requested rate and its denominator";
  }

  if (hasAny(normalized, ["gross profit", "gross margin", "brut kar", "brut marj"])) {
    return "Gross profit or gross margin";
  }
  if (hasAny(normalized, ["net profit", "net income", "net kar"])) {
    return "GAAP net profit";
  }

  const mentionedProfitDimension: DimensionId | null =
    explicitDimension && ["customer", "country", "product"].includes(explicitDimension)
      ? explicitDimension
      : containsPhrase(normalized, "customer") ||
          containsPhrase(normalized, "musteri")
        ? "customer"
        : containsPhrase(normalized, "country") ||
            containsPhrase(normalized, "ulke")
          ? "country"
          : containsPhrase(normalized, "product") ||
              containsPhrase(normalized, "urun")
            ? "product"
            : null;
  const unsupportedProfitDimension =
    mentionedProfitDimension != null &&
    (metric === "operating_margin" ||
      hasAny(normalized, ["profitability", "profitable", "profit by", "karlilik", "karli"]));
  if (unsupportedProfitDimension) {
    return `Profitability by ${DIMENSION_LABELS[mentionedProfitDimension]}`;
  }

  if (!metricMatched) {
    if (hasAny(normalized, ["current ratio", "cari oran"])) return "Current ratio";
    if (hasAny(normalized, ["average invoice", "mean invoice", "ortalama fatura"])) {
      return "Average invoice amount";
    }
    return "The requested question";
  }

  return undefined;
}

function metricDimensionIssue(
  metric: MetricId,
  dimension: DimensionId,
): string | undefined {
  if (
    ["net_revenue", "gross_revenue"].includes(metric) &&
    dimension === "supplier"
  ) {
    return "Revenue by supplier is not defined by the supplied customer revenue facts";
  }
  if (metric === "operating_costs" && dimension === "customer") {
    return "Operating costs by customer require a cost-allocation rule";
  }
  if (metric === "open_ar" && dimension === "supplier") {
    return "Receivables by supplier are not defined by the supplied open customer facts";
  }
  if (metric === "open_ap" && dimension === "customer") {
    return "Payables by customer are not defined by the supplied open supplier facts";
  }
  if (metric === "customer_collections" && dimension === "supplier") {
    return "Customer collections by supplier are not defined by the supplied customer cash facts";
  }
  if (metric === "supplier_payments" && dimension === "customer") {
    return "Supplier payments by customer are not defined by the supplied supplier cash facts";
  }
  if (metric === "refunds" && dimension === "supplier") {
    return "Customer refunds by supplier are not defined by the supplied customer refund facts";
  }
  if (
    ["transactions", "mapping_coverage", "review_items", "data_quality", "mapping_confidence"].includes(metric) &&
    BUSINESS_DIMENSIONS.has(dimension)
  ) {
    return `${METRIC_LABELS[metric]} by ${DIMENSION_LABELS[dimension]} needs an explicit bank-to-business attribution rule`;
  }
  if (
    ["on_time_rate", "settlement_lag"].includes(metric) &&
    BUSINESS_DIMENSIONS.has(dimension)
  ) {
    return `${METRIC_LABELS[metric]} by ${DIMENSION_LABELS[dimension]} needs an explicit settlement cohort and role scope`;
  }
  if (
    ["operating_result", "operating_margin"].includes(metric) &&
    !["month", "quarter", "year"].includes(dimension)
  ) {
    return `${METRIC_LABELS[metric]} by ${DIMENSION_LABELS[dimension]} requires a reliable cost-allocation rule`;
  }
  if (
    metric === "cash_balance" &&
    !["account", "month", "quarter", "year"].includes(dimension)
  ) {
      return `Cash balance by ${DIMENSION_LABELS[dimension]} is not an additive or attributable measure`;
  }
  if (metric === "reconciliation_gap" && BUSINESS_DIMENSIONS.has(dimension)) {
    return `Bank-linked reconciliation by ${DIMENSION_LABELS[dimension]} cannot safely allocate the counted bank side across business attributes`;
  }
  return undefined;
}

function metricFilterIssue(
  metric: MetricId,
  filters: QueryFilter[],
): string | undefined {
  const fields = new Set(filters.map((filter) => filter.field));
  if (
    ["net_revenue", "gross_revenue", "open_ar", "customer_collections"].includes(metric) &&
    fields.has("supplier")
  ) {
    return `${METRIC_LABELS[metric]} cannot be filtered by supplier using the supplied customer facts`;
  }
  if (
    ["operating_costs", "open_ap", "supplier_payments"].includes(metric) &&
    fields.has("customer")
  ) {
    return `${METRIC_LABELS[metric]} cannot be filtered by customer without an allocation rule`;
  }
  if (metric === "refunds" && fields.has("supplier")) {
    return "Customer refunds cannot be filtered by supplier using the supplied customer facts";
  }
  if (
    ["transactions", "mapping_coverage", "review_items", "data_quality", "mapping_confidence"].includes(metric) &&
    filters.some((filter) => BUSINESS_FILTER_FIELDS.has(filter.field))
  ) {
    return `${METRIC_LABELS[metric]} cannot use business-entity filters without an explicit bank-attribution rule`;
  }
  if (
    ["on_time_rate", "settlement_lag"].includes(metric) &&
    filters.some((filter) => BUSINESS_FILTER_FIELDS.has(filter.field))
  ) {
    return `${METRIC_LABELS[metric]} cannot use business-entity filters without an explicit settlement cohort rule`;
  }
  if (
    metric === "cash_balance" &&
    filters.some(
      (filter) =>
        !["year", "quarter", "month", "date", "account"].includes(String(filter.field)),
    )
  ) {
    return "Cash balance can only be scoped by reporting date or bank account from the supplied running-balance facts";
  }
  if (
    ["operating_result", "operating_margin", "reconciliation_gap"].includes(metric) &&
    filters.some((filter) => BUSINESS_FILTER_FIELDS.has(filter.field))
  ) {
    return `${METRIC_LABELS[metric]} cannot be filtered by business attributes without a reliable allocation rule`;
  }
  return undefined;
}

function isCountRequest(normalized: string): boolean {
  return (
    containsPhrase(normalized, "count") ||
    hasAny(normalized, [
      "how many",
      "number of",
      "count of",
      "count the",
      "kac",
      "kac tane",
      "kac adet",
      "adedi",
      "sayisi",
    ])
  );
}

function containsPhrase(value: string, phrase: string): boolean {
  if (phrase.includes(" ")) return value.includes(phrase);
  return new RegExp(`(?:^|\\s)${escapeRegExp(phrase)}(?:$|\\s)`).test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildFactStore(dataset: FinanceDataset): FactStore {
  const businessMap = new Map<string, FinanceRecord>();
  for (const row of dataset.records) {
    if (!row.businessEventId) continue;
    const existing = businessMap.get(row.businessEventId);
    if (!existing || row.id.localeCompare(existing.id) < 0) {
      businessMap.set(row.businessEventId, row);
    }
  }

  return {
    raw: dataset.records,
    bank: dataset.records.filter((row) => row.transactionId && row.bankCounted),
    business: [...businessMap.values()],
  };
}

export function analyzeQuestion(
  question: string,
  dataset: FinanceDataset,
  facts = buildFactStore(dataset),
): AnalysisResult {
  return analyzePlan(
    question,
    interpretQuestionRules(question, dataset),
    dataset,
    facts,
  );
}

export function analyzePlan(
  question: string,
  plan: QueryPlan,
  dataset: FinanceDataset,
  facts = buildFactStore(dataset),
): AnalysisResult {
  if (plan.unsupportedMetric) {
    return buildUnsupportedResult(question, plan, dataset);
  }

  const filtered = {
    raw: filterRows(facts.raw, plan),
    bank: filterRows(facts.bank, plan),
    business: filterRows(facts.business, plan),
  };

  const selected = plan.rateKind
    ? {
        rows: filtered.bank,
        sourceKind: "bank" as const,
        factView: "unique bank transactions used as the visible rate denominator",
      }
    : plan.metric === "cash_balance"
      ? {
          rows: cashBalanceRows(facts.bank, plan, dataset),
          sourceKind: "bank" as const,
          factView: "unique bank transactions carried forward to the requested closing date",
        }
      : selectSource(plan, filtered);
  const rows = plan.countMode
    ? countableRows(selected.rows, plan.metric, selected.sourceKind)
    : selected.rows;
  const { sourceKind } = selected;
  const factView = plan.countMode
    ? `${selected.factView} · contributing records counted`
    : selected.factView;
  const primaryValue = plan.rateKind
    ? rateValue(rows, plan.rateKind)
    : plan.countMode
      ? countMetricRows(rows, sourceKind)
      : aggregateMetric(rows, plan.metric, sourceKind);
  const chart = buildChart(rows, sourceKind, plan, dataset);
  const kpis = buildKpis(filtered, plan, rows, sourceKind);
  const summary = buildSummary(chart.data, primaryValue, plan, filtered);
  const details = buildDetails(rows, sourceKind, plan);
  const warnings = buildWarnings(plan, filtered, dataset, chart, rows);
  const insights = buildInsights(chart.data, plan, primaryValue);

  return {
    question,
    headline: buildHeadline(plan, chart.data),
    summary,
    primaryValue,
    primaryFormat: plan.rateKind
      ? "percent"
      : plan.countMode
        ? "number"
        : metricFormat(plan.metric),
    chartType: chart.type,
    chartTitle: chart.title,
    chartSubtitle: chart.subtitle,
    chartData: chart.data,
    chartSeries: chart.series,
    kpis,
    insights,
    details,
    plan,
    method: plan.rateKind
      ? `${rateLabel(plan.rateKind)} divided by all unique bank transactions in the same time and business scope; the numerator and denominator are both shown in the chart.`
      : plan.countMode
        ? `${countMetricLabel(plan.metric)} counted as unique ${sourceKind === "business" ? "business events" : "bank transactions"} after applying the interpreted filters.`
        : metricMethod(plan.metric, sourceKind, plan.includeInternalTransfers),
    evidence: {
      factView,
      sourceRows: rows.length,
      dateRange: plan.periodLabel,
      currency: "EUR base amounts",
      asOf: dataset.meta.asOf,
    },
    warnings,
    followUps: buildFollowUps(plan),
  };
}

function buildUnsupportedResult(
  question: string,
  plan: QueryPlan,
  dataset: FinanceDataset,
): AnalysisResult {
  const topic = plan.unsupportedMetric ?? "This request";
  const scope = `${dataset.meta.dateStart.slice(0, 10)}–${dataset.meta.dateEnd.slice(0, 10)}`;
  return {
    question,
    headline: `${topic} needs clarification or a different source`,
    summary: `${topic} cannot be answered reliably from the supplied operating file. No calculation was produced, no substitute metric was used, and no result was inferred.`,
    primaryValue: 0,
    primaryFormat: "number",
    chartType: "bar",
    chartTitle: "No supported calculation",
    chartSubtitle: `Available observed period: ${scope}`,
    chartData: [],
    chartSeries: [],
    kpis: [],
    insights: [
      "Rephrase the question using a supported observed metric such as revenue, operating costs, external cash movement, open AR/AP, settlement status, or mapping quality.",
    ],
    details: [],
    plan,
    method: "No calculation was run because the requested measure or period is not supported by the supplied data.",
    evidence: {
      factView: "No fact view selected",
      sourceRows: 0,
      dateRange: scope,
      currency: "EUR base amounts",
      asOf: dataset.meta.asOf,
    },
    warnings: [
      `${topic} is outside the dataset’s reliable metric and period catalog.`,
      "The source is a generated operating simulation; figures demonstrate analytical behavior rather than audited company performance.",
    ],
    followUps: [
      "Show net revenue by month in 2024",
      "How much external cash came in each month during 2024?",
      "Which customers have overdue open invoices?",
    ],
  };
}

export function interpretQuestionRules(
  question: string,
  dataset: FinanceDataset,
): QueryPlan {
  const normalized = normalize(question);
  const language = detectLanguage(question, normalized);
  const metricMatch = detectMetric(normalized);
  let metric = metricMatch.metric;
  let metricMatched = metricMatch.matched;
  const percentageRequest = hasAny(normalized, [
    "percentage",
    "percent",
    "yuzde",
    "orani",
  ]);
  let rateKind: RateKind | undefined;
  if (percentageRequest) {
    if (hasAny(normalized, ["need review", "needs review", "review needed", "inceleme gereken"])) {
      metric = "review_items";
      rateKind = "review";
      metricMatched = true;
    } else if (hasAny(normalized, ["fully allocated", "allocated transactions", "tam eslesmis", "tam tahsisli"])) {
      metric = "mapping_coverage";
      rateKind = "allocated";
      metricMatched = true;
    } else if (hasAny(normalized, ["unmapped", "not mapped", "eslesmemis"])) {
      metric = "mapping_coverage";
      rateKind = "unmapped";
      metricMatched = true;
    } else if (hasAny(normalized, ["duplicate", "mukerrer"])) {
      metric = "data_quality";
      rateKind = "duplicates";
      metricMatched = true;
    } else if (hasAny(normalized, ["data quality", "quality issue", "veri kalitesi"])) {
      metric = "data_quality";
      rateKind = "data_quality";
      metricMatched = true;
    }
  }
  const explicitDimension = detectDimension(normalized);
  let dimension = explicitDimension ?? defaultDimension(metric, normalized);
  const filters = extractFilters(normalized);
  const externalOnly =
    hasAny(normalized, [
      "external bank transaction",
      "external transaction",
      "exclude internal",
      "excluding internal",
      "without internal",
      "haric internal",
      "ic transfer haric",
      "dis islem",
    ]);
  const explicitlyIncludesInternal = hasAny(normalized, [
    "include internal",
    "including internal",
    "with internal",
    "ic transfer dahil",
  ]);
  let countMode =
    isCountRequest(normalized) && COUNTABLE_METRICS.has(metric);

  if (isCountRequest(normalized) && hasAny(normalized, ["unmapped", "not mapped", "eslesmemis"])) {
    metric = "mapping_coverage";
    dimension = explicitDimension ?? "allocationStatus";
    countMode = true;
    filters.push({
      field: "allocationStatus",
      label: "Unmapped",
      values: ["UNMAPPED"],
    });
  }
  if (
    isCountRequest(normalized) &&
    hasAny(normalized, ["mapped transaction", "mapped bank transaction", "eslesmis islem"]) &&
    !hasAny(normalized, ["unmapped", "not mapped", "eslesmemis"])
  ) {
    metric = "mapping_coverage";
    dimension = explicitDimension ?? "allocationStatus";
    countMode = true;
    filters.push({
      field: "allocationStatus",
      label: "Mapped",
      values: (dataset.dimensions.allocationStatuses ?? []).filter(
        (status) => status !== "UNMAPPED",
      ),
    });
  }
  if (rateKind) countMode = false;
  if (
    !rateKind &&
    hasAny(normalized, ["suspected duplicate", "possible duplicate", "duplicate transaction", "mukerrer islem"])
  ) {
    filters.push({
      field: "duplicateCandidate",
      label: "Suspected duplicate",
      values: ["true"],
    });
  }

  const asksForCustomerInvoices =
    dimension === "customer" ||
    (containsPhrase(normalized, "customer") &&
      !containsPhrase(normalized, "supplier"));
  const asksForSupplierInvoices =
    dimension === "supplier" ||
    (containsPhrase(normalized, "supplier") &&
      !containsPhrase(normalized, "customer"));
  if (metric === "overdue_open" && asksForCustomerInvoices) {
    filters.push({
      field: "counterpartyType",
      label: "Customer invoices",
      values: ["CUSTOMER"],
    });
  } else if (metric === "overdue_open" && asksForSupplierInvoices) {
    filters.push({
      field: "counterpartyType",
      label: "Supplier invoices",
      values: ["SUPPLIER"],
    });
  }

  const years = extractYears(normalized);
  const range = extractYearRange(normalized);
  const comparison = hasAny(normalized, [
    "compare",
    " versus ",
    " vs ",
    "change",
    "growth",
    "evolve",
    "karsilastir",
    "degisim",
    "artis",
  ]);
  const growthRequest = hasAny(normalized, ["growth", "buyume", "artis"]);

  if (range) {
    const rangeYears: number[] = [];
    for (let year = range[0]; year <= range[1]; year += 1) rangeYears.push(year);
    filters.push({ field: "year", label: `${range[0]}–${range[1]}`, values: rangeYears });
    if (!explicitDimension) dimension = "year";
  } else if (years.length > 1 || comparison) {
    if (years.length > 0) {
      filters.push({ field: "year", label: years.join(" vs "), values: years });
    }
    if (!explicitDimension) dimension = "year";
  } else if (years.length === 1) {
    filters.push({ field: "year", label: String(years[0]), values: years });
  } else if (hasAny(normalized, ["latest", "current year", "this year", "en son", "bu yil"])) {
    filters.push({ field: "year", label: "2024", values: [2024] });
  }

  if (growthRequest && years.length === 1 && !explicitDimension) {
    dimension = "month";
  }

  const quarter = normalized.match(/\bq([1-4])\b|([1-4])\.?\s*(?:quarter|ceyrek)/);
  if (quarter) {
    const value = `Q${quarter[1] ?? quarter[2]}`;
    filters.push({ field: "quarter", label: value, values: [value] });
  }
  if (!quarter && hasAny(normalized, ["last quarter", "final quarter", "son ceyrek"])) {
    filters.push({ field: "quarter", label: "Q4", values: ["Q4"] });
  }

  const month = Object.entries(MONTHS).find(([name]) =>
    new RegExp(`\\b${name}\\b`).test(normalized),
  );
  if (month) {
    filters.push({ field: "month", label: month[0], values: [month[1]] });
  }

  const exactDate = normalized.match(/\b((?:19|20)\d{2}-\d{2}-\d{2})\b/);
  if (exactDate) {
    filters.push({ field: "date", label: exactDate[1], values: [exactDate[1]] });
  }

  if (
    metric === "net_revenue" &&
    (dimension === "paymentMethod" || dimension === "account")
  ) {
    metric = "customer_collections";
  }
  if (
    metric === "operating_costs" &&
    (dimension === "paymentMethod" || dimension === "account")
  ) {
    metric = "supplier_payments";
  }

  if (metric === "data_quality" && !explicitDimension) dimension = "dataQualityType";
  if (metric === "mapping_coverage" && !explicitDimension) dimension = "allocationStatus";
  if (metric === "review_items" && !explicitDimension) dimension = "allocationStatus";
  if (metric === "cash_balance") dimension = explicitDimension ?? "account";
  if (metric === "open_balance" && !explicitDimension) dimension = "agingBucket";

  const basis = metricBasis(metric);
  const intent = detectIntent(normalized, dimension, comparison);
  const rankingMatch = normalized.match(
    /(?:top|bottom|lowest|smallest|largest|highest|ilk|en\s+(?:buyuk|yuksek|dusuk|kucuk|fazla|az))(?:(?:\s+\w+){0,5})?\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on\s+bir|on\s+iki)\b/,
  );
  const limit = Math.min(
    Math.max(parseLimit(rankingMatch?.[1]) ?? 7, 1),
    12,
  );
  const sortDirection = hasAny(normalized, [
    "bottom",
    "lowest",
    "smallest",
    "least",
    "en dusuk",
    "en kucuk",
    "en az",
  ])
    ? "asc"
    : "desc";
  const categoricalFilters = extractCategoricalFilters(
    normalized,
    dataset,
    dimension,
    metric,
  ).filter(
    (filter) =>
      !(
        (externalOnly || explicitlyIncludesInternal) &&
        filter.field === "paymentMethod" &&
        filter.values.some((value) => normalize(String(value)) === "internal transfer")
      ),
  );
  filters.push(
    ...categoricalFilters.filter((filter) => {
      if (!rateKind) return true;
      if (["allocated", "unmapped", "review"].includes(rateKind)) {
        return filter.field !== "allocationStatus";
      }
      if (["duplicates", "data_quality"].includes(rateKind)) {
        return filter.field !== "dataQualityType" && filter.field !== "duplicateCandidate";
      }
      return true;
    }),
  );

  if (
    countMode &&
    ["open_ar", "open_ap", "open_balance", "overdue_open"].includes(metric) &&
    years.length === 1 &&
    years[0] === Number(dataset.meta.asOf.slice(0, 4)) &&
    hasAny(normalized, ["acik fatura", "open invoice"])
  ) {
    for (let index = filters.length - 1; index >= 0; index -= 1) {
      if (["year", "quarter", "month", "date"].includes(String(filters[index].field))) {
        filters.splice(index, 1);
      }
    }
  }

  const periodLabel = buildPeriodLabel(filters, dataset);
  const unsupported = detectUnsupportedRequest(
    normalized,
    metricMatched,
    metric,
    explicitDimension,
    dataset,
    rateKind,
  ) ?? metricDimensionIssue(metric, dimension) ?? metricFilterIssue(metric, filters);
  const confidenceScore = unsupported
    ? 0.25
    : metricMatched
      ? explicitDimension || filters.length > 0
        ? 0.96
        : 0.9
      : 0.76;
  const confidenceLabel = unsupported
    ? "Needs scope"
    : confidenceScore >= 0.86
      ? "High"
      : "Medium";
  const interpretedMetricLabel =
    explicitlyIncludesInternal &&
    ["cash_inflow", "cash_outflow", "net_cash"].includes(metric)
      ? ({
          cash_inflow: "Cash inflow",
          cash_outflow: "Cash outflow",
          net_cash: "Net cash movement",
        } as Partial<Record<MetricId, string>>)[metric] ?? METRIC_LABELS[metric]
      : METRIC_LABELS[metric];
  const interpretedAs = unsupported
    ? `Unsupported request · no calculation run`
    : `${rateKind ? "Rate of " : countMode ? "Count of " : ""}${interpretedMetricLabel} · ${metricBasis(metric)} basis · by ${DIMENSION_LABELS[dimension]}`;

  const includeInternalTransfers =
    !externalOnly &&
    (metric === "transactions" ||
      explicitlyIncludesInternal ||
      hasAny(normalized, ["internal transfer", "ic transfer"]));

  return {
    version: 1,
    language,
    intent,
    metric,
    basis,
    dimension,
    filters: dedupeFilters(filters),
    periodLabel,
    limit,
    sortDirection,
    includeInternalTransfers,
    confidenceScore,
    confidenceLabel,
    interpretedAs,
    unsupportedMetric: unsupported,
    countMode,
    ...(rateKind ? { rateKind } : {}),
    ...(hasAny(normalized, ["all", "every", "tum", "butun"]) ? { showAll: true } : {}),
  };
}

export function materializeAiPlan(
  candidate: AiPlanCandidate,
  question: string,
  dataset: FinanceDataset,
): QueryPlan {
  if (typeof question !== "string" || !question.trim()) {
    throw new Error("AI plan question must be a non-empty string.");
  }

  validateAiCandidate(candidate, dataset);

  const rulesPlan = interpretQuestionRules(question, dataset);
  const rulesUnsupported = rulesPlan.unsupportedMetric;
  const hardUnsupported =
    rulesUnsupported != null && rulesUnsupported !== "The requested question";

  if (hardUnsupported && rulesUnsupported) {
    return safeUnsupportedPlan(rulesPlan, rulesUnsupported);
  }

  if (rulesPlan.rateKind) {
    return {
      ...rulesPlan,
      confidenceScore: 0.92,
      confidenceLabel: "High",
    };
  }

  if (candidate.status !== "supported") {
    const topic =
      candidate.status === "clarify"
        ? "The requested question"
        : "The requested measure";
    return safeUnsupportedPlan(rulesPlan, topic);
  }

  if (candidate.metric == null || candidate.dimension == null) {
    throw new Error("A supported AI plan requires both metric and dimension.");
  }

  const normalizedQuestion = normalize(question);
  const explicitMetric = detectMetric(normalizedQuestion);
  const explicitDimension = detectDimension(normalizedQuestion);
  const candidateDimension = candidate.dimension;
  let candidateMetric = candidate.metric;
  if (
    candidateMetric === "net_revenue" &&
    (candidateDimension === "paymentMethod" || candidateDimension === "account")
  ) {
    candidateMetric = "customer_collections";
  }
  if (
    candidateMetric === "operating_costs" &&
    (candidateDimension === "paymentMethod" || candidateDimension === "account")
  ) {
    candidateMetric = "supplier_payments";
  }

  if (explicitMetric.matched && candidateMetric !== rulesPlan.metric) {
    throw new Error("AI plan conflicts with the explicit question metric.");
  }
  if (explicitDimension && candidateDimension !== explicitDimension) {
    throw new Error("AI plan conflicts with the explicit question dimension.");
  }
  if (
    candidate.includeInternalTransfers &&
    !rulesPlan.includeInternalTransfers
  ) {
    throw new Error("AI plan conflicts with the explicit question cash scope.");
  }
  if (
    explicitMetric.matched &&
    rulesPlan.includeInternalTransfers &&
    !candidate.includeInternalTransfers
  ) {
    throw new Error("AI plan conflicts with the explicit question cash scope.");
  }
  if (
    explicitMetric.matched &&
    candidate.countMode !== Boolean(rulesPlan.countMode)
  ) {
    throw new Error("AI plan conflicts with the explicit question aggregation.");
  }

  const candidateTemporalValues = new Map<QueryFilter["field"], Array<string | number>>([
    ["year", candidate.years],
    ["quarter", candidate.quarter ? [candidate.quarter] : []],
    ["month", candidate.month ? [candidate.month] : []],
    ["date", []],
  ]);
  for (const field of ["year", "quarter", "month", "date"] as const) {
    const constraint = rulesPlan.filters.find((filter) => filter.field === field);
    const candidateValues = candidateTemporalValues.get(field) ?? [];
    if (constraint && !sameConstraintValues(candidateValues, constraint.values)) {
      throw new Error("AI plan conflicts with the explicit question period.");
    }
    if (!constraint && explicitMetric.matched && candidateValues.length > 0) {
      throw new Error("AI plan conflicts with the explicit question period.");
    }
  }

  const metric = explicitMetric.matched ? rulesPlan.metric : candidateMetric;
  const dimension = explicitMetric.matched ? rulesPlan.dimension : candidateDimension;
  const countMode = explicitMetric.matched
    ? Boolean(rulesPlan.countMode)
    : candidate.countMode;

  if (countMode && !COUNTABLE_METRICS.has(metric)) {
    throw new Error(`${metric} does not support unique-record count mode.`);
  }


  const compatibilityIssue = metricDimensionIssue(metric, dimension);
  if (compatibilityIssue) {
    return safeUnsupportedPlan(
      {
        ...rulesPlan,
        metric,
        dimension,
        basis: metricBasis(metric),
      },
      compatibilityIssue,
    );
  }

  const years = [...new Set(candidate.years)].sort((a, b) => a - b);
  const filters: QueryFilter[] = [];
  if (years.length > 0) {
    filters.push({
      field: "year",
      label: years.length === 1 ? String(years[0]) : years.join(" vs "),
      values: years,
    });
  }
  if (candidate.quarter) {
    filters.push({
      field: "quarter",
      label: candidate.quarter,
      values: [candidate.quarter],
    });
  }
  if (candidate.month) {
    filters.push({
      field: "month",
      label: candidate.month,
      values: [candidate.month],
    });
  }

  for (const filter of candidate.filters) {
    if (!aiFilterValueIsGrounded(normalizedQuestion, filter.value)) {
      throw new Error("AI plan conflicts with the explicit question filters.");
    }
    const values = resolveAiFilterValues(filter.field, filter.value, dataset);
    filters.push({
      field: filter.field,
      label:
        filter.field === "category"
          ? canonicalCategory(values[0])
          : values.join(", "),
      values,
    });
  }

  for (const ruleFilter of rulesPlan.filters) {
    if (["year", "quarter", "month", "date"].includes(String(ruleFilter.field))) continue;
    const candidateFilter = filters.find((filter) => filter.field === ruleFilter.field);
    if (candidateFilter && !sameConstraintValues(candidateFilter.values, ruleFilter.values)) {
      throw new Error("AI plan conflicts with an explicit question filter.");
    }
    if (!candidateFilter) filters.push(ruleFilter);
  }

  const materializedFilters = dedupeFilters(filters);
  const filterCompatibilityIssue = metricFilterIssue(metric, materializedFilters);
  if (filterCompatibilityIssue) {
    return safeUnsupportedPlan(
      {
        ...rulesPlan,
        metric,
        dimension,
        basis: metricBasis(metric),
        filters: materializedFilters,
      },
      filterCompatibilityIssue,
    );
  }
  const basis = metricBasis(metric);
  const periodLabel = buildPeriodLabel(materializedFilters, dataset);

  return {
    version: 1,
    language: explicitMetric.matched ? rulesPlan.language : candidate.language,
    intent: explicitMetric.matched ? rulesPlan.intent : candidate.intent,
    metric,
    basis,
    dimension,
    filters: materializedFilters,
    periodLabel,
    limit: explicitMetric.matched ? rulesPlan.limit : candidate.limit ?? 7,
    sortDirection: explicitMetric.matched ? rulesPlan.sortDirection : candidate.sortDirection,
    includeInternalTransfers: explicitMetric.matched
      ? rulesPlan.includeInternalTransfers
      : candidate.includeInternalTransfers,
    confidenceScore: 0.92,
    confidenceLabel: "High",
    interpretedAs: `${countMode ? "Count of " : ""}${METRIC_LABELS[metric]} · ${basis} basis · by ${DIMENSION_LABELS[dimension]}`,
    countMode,
    ...(rulesPlan.showAll ? { showAll: true } : {}),
  };
}

function aiFilterValueIsGrounded(
  normalizedQuestion: string,
  value: string,
): boolean {
  const normalizedValue = normalize(value);
  if (!normalizedValue) return false;
  if (containsPhrase(normalizedQuestion, normalizedValue)) return true;
  const meaningfulTokens = normalizedValue
    .split(" ")
    .filter((token) => token.length >= 4);
  return meaningfulTokens.length > 0 &&
    meaningfulTokens.every((token) => containsPhrase(normalizedQuestion, token));
}

function sameConstraintValues(
  left: Array<string | number>,
  right: Array<string | number>,
): boolean {
  const normalizeValues = (values: Array<string | number>) =>
    [...new Set(values.map((value) => normalize(String(value))))].sort();
  const normalizedLeft = normalizeValues(left);
  const normalizedRight = normalizeValues(right);
  return normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function validateAiCandidate(
  candidate: AiPlanCandidate,
  dataset: FinanceDataset,
): void {
  if (!isPlainRecord(candidate)) {
    throw new Error("AI plan candidate must be an object.");
  }
  assertExactKeys(candidate, AI_CANDIDATE_KEYS, "AI plan candidate");

  assertEnum(candidate.status, ["supported", "clarify", "unsupported"], "status");
  assertEnum(candidate.language, ["en", "tr"], "language");
  assertEnum(
    candidate.intent,
    ["trend", "ranking", "comparison", "diagnostic", "value"],
    "intent",
  );
  if (
    candidate.metric !== null &&
    !Object.prototype.hasOwnProperty.call(METRIC_LABELS, candidate.metric)
  ) {
    throw new Error(`Invalid AI metric: ${String(candidate.metric)}`);
  }
  if (
    candidate.dimension !== null &&
    !Object.prototype.hasOwnProperty.call(DIMENSION_LABELS, candidate.dimension)
  ) {
    throw new Error(`Invalid AI dimension: ${String(candidate.dimension)}`);
  }
  if (
    candidate.status === "supported" &&
    (candidate.metric === null || candidate.dimension === null)
  ) {
    throw new Error("A supported AI plan requires both metric and dimension.");
  }

  if (!Array.isArray(candidate.years)) {
    throw new Error("AI plan years must be an array.");
  }
  const firstYear = Number(dataset.meta.dateStart.slice(0, 4));
  const lastYear = Number(dataset.meta.dateEnd.slice(0, 4));
  for (const year of candidate.years) {
    if (!Number.isInteger(year) || year < firstYear || year > lastYear) {
      throw new Error(
        `AI plan year ${String(year)} is outside the observed ${firstYear}–${lastYear} range.`,
      );
    }
  }

  if (candidate.quarter !== null) {
    assertEnum(candidate.quarter, ["Q1", "Q2", "Q3", "Q4"], "quarter");
  }
  if (
    candidate.month !== null &&
    (typeof candidate.month !== "string" ||
      !/^(?:0[1-9]|1[0-2])$/.test(candidate.month))
  ) {
    throw new Error("AI plan month must be a zero-padded value from 01 to 12.");
  }
  if (candidate.month && candidate.quarter) {
    const expectedQuarter = `Q${Math.ceil(Number(candidate.month) / 3)}`;
    if (candidate.quarter !== expectedQuarter) {
      throw new Error(
        `AI plan month ${candidate.month} does not belong to ${candidate.quarter}.`,
      );
    }
  }

  if (!Array.isArray(candidate.filters) || candidate.filters.length > 8) {
    throw new Error("AI plan filters must be an array with at most eight entries.");
  }
  for (const [index, filter] of candidate.filters.entries()) {
    if (!isPlainRecord(filter)) {
      throw new Error(`AI plan filter ${index} must be an object.`);
    }
    assertExactKeys(filter, ["field", "value"], `AI plan filter ${index}`);
    assertEnum(filter.field, AI_FILTER_FIELDS, `filter ${index} field`);
    if (
      typeof filter.value !== "string" ||
      !filter.value.trim() ||
      filter.value.length > 160
    ) {
      throw new Error(`AI plan filter ${index} requires a short, non-empty value.`);
    }
    resolveAiFilterValues(filter.field, filter.value, dataset);
  }

  if (
    candidate.limit !== null &&
    (!Number.isInteger(candidate.limit) || candidate.limit < 1 || candidate.limit > 12)
  ) {
    throw new Error("AI plan limit must be an integer from 1 to 12.");
  }
  assertEnum(candidate.sortDirection, ["asc", "desc"], "sortDirection");
  if (typeof candidate.includeInternalTransfers !== "boolean") {
    throw new Error("AI plan includeInternalTransfers must be boolean.");
  }
  if (typeof candidate.countMode !== "boolean") {
    throw new Error("AI plan countMode must be boolean.");
  }
  if (
    candidate.clarification !== null &&
    (typeof candidate.clarification !== "string" ||
      !candidate.clarification.trim() ||
      candidate.clarification.length > 300)
  ) {
    throw new Error("AI plan clarification must be null or a short, non-empty string.");
  }
  if (candidate.status === "supported" && candidate.clarification !== null) {
    throw new Error("A supported AI plan cannot also request clarification.");
  }
}

function resolveAiFilterValues(
  field: AiFilterField,
  value: string,
  dataset: FinanceDataset,
): string[] {
  const options = aiFilterOptions(field, dataset);
  const target = normalizeAiFilterValue(value);
  const exact = options.filter(
    (option) => normalizeAiFilterValue(option) === target,
  );

  if (exact.length === 1) {
    return expandCanonicalAiValues(field, exact[0], options);
  }
  if (exact.length > 1) {
    if (field === "category") {
      const canonical = canonicalCategory(exact[0]);
      if (exact.every((option) => canonicalCategory(option) === canonical)) {
        return expandCanonicalAiValues(field, exact[0], options);
      }
    }
    throw new Error(
      `AI filter ${field}=${JSON.stringify(value)} is ambiguous in the local dataset.`,
    );
  }

  const partial = options.filter((option) => {
    const normalized = normalizeAiFilterValue(option);
    return normalized.includes(target) || target.includes(normalized);
  });
  if (partial.length === 1) {
    return expandCanonicalAiValues(field, partial[0], options);
  }

  if (field === "category" && partial.length > 1) {
    const canonicalGroups = new Map<string, string[]>();
    for (const option of partial) {
      const key = normalizeAiFilterValue(canonicalCategory(option));
      canonicalGroups.set(key, [
        ...(canonicalGroups.get(key) ?? []),
        option,
      ]);
    }
    if (canonicalGroups.size === 1) {
      return expandCanonicalAiValues(field, partial[0], options);
    }
  }

  if (partial.length === 0) {
    throw new Error(
      `AI filter ${field}=${JSON.stringify(value)} does not match the local dataset.`,
    );
  }
  throw new Error(
    `AI filter ${field}=${JSON.stringify(value)} is ambiguous in the local dataset.`,
  );
}

function aiFilterOptions(
  field: AiFilterField,
  dataset: FinanceDataset,
): string[] {
  const dimensionKey = AI_FILTER_DIMENSION_KEYS[field];
  let values: string[];
  if (dimensionKey) {
    values = dataset.dimensions[dimensionKey] ?? [];
  } else if (field === "duplicateCandidate") {
    values = ["true", "false"];
  } else {
    values = dataset.records.map((row) => String(row[field] ?? ""));
  }
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function expandCanonicalAiValues(
  field: AiFilterField,
  value: string,
  options: string[],
): string[] {
  if (field !== "category") return [value];
  const canonical = canonicalCategory(value);
  return options.filter(
    (option) => canonicalCategory(option) === canonical,
  );
}

function normalizeAiFilterValue(value: string): string {
  return normalize(value.replace(/[_/\\-]+/g, " "));
}

function safeUnsupportedPlan(
  base: QueryPlan,
  topic: string,
): QueryPlan {
  return {
    ...base,
    confidenceScore: 0.25,
    confidenceLabel: "Needs scope",
    interpretedAs: "Unsupported request · no calculation run",
    unsupportedMetric: topic,
    countMode: false,
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
): void {
  const actual = Object.keys(value);
  const missing = expected.filter((key) => !actual.includes(key));
  const extra = actual.filter((key) => !expected.includes(key));
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `${label} keys are invalid (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}).`,
    );
  }
}

function assertEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): asserts value is T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Error(`Invalid AI ${label}: ${String(value)}`);
  }
}

function detectMetric(normalized: string): { metric: MetricId; matched: boolean } {
  if (
    hasAny(normalized, [
      "open ar and ap",
      "ar and ap",
      "open ar ap",
      "open receivables and payables",
      "acik alacak ve borc",
    ])
  ) {
    return { metric: "open_balance", matched: true };
  }
  const bothOpen =
    hasAny(normalized, ["receivables", "alacak"]) &&
    hasAny(normalized, ["payables", "borc"]);
  if (bothOpen) return { metric: "open_balance", matched: true };
  if (hasAny(normalized, ["mapping confidence", "esleme guveni", "confidence score"])) {
    return { metric: "mapping_confidence", matched: true };
  }
  if (hasAny(normalized, ["cash balance", "bank balance", "nakit bakiye", "hesap bakiye"])) {
    return { metric: "cash_balance", matched: true };
  }
  if (hasAny(normalized, ["data quality", "quality issue", "duplicate", "veri kalitesi", "mukerrer", "exception"])) {
    return { metric: "data_quality", matched: true };
  }
  if (hasAny(normalized, ["review needed", "needs review", "need review", "transactions need review", "human review", "inceleme gereken", "manuel inceleme"])) {
    return { metric: "review_items", matched: true };
  }
  if (hasAny(normalized, ["unreconciled", "reconciliation gap", "mutabakat fark", "eslesmeyen", "unmapped"])) {
    return { metric: "reconciliation_gap", matched: true };
  }
  if (hasAny(normalized, ["mapping coverage", "mapped percentage", "mapped or under review", "reconciled percentage", "reconciliation quality", "eslesme orani", "mutabakat orani"])) {
    return { metric: "mapping_coverage", matched: true };
  }
  if (hasAny(normalized, ["overdue", "past due", "vadesi gec", "gecikmis acik"])) {
    return { metric: "overdue_open", matched: true };
  }
  if (hasAny(normalized, ["receivable", "open ar", "acik alacak", "alacaklar"])) {
    return { metric: "open_ar", matched: true };
  }
  if (hasAny(normalized, ["payable", "open ap", "acik borc", "borclar", "supplier bill"])) {
    return { metric: "open_ap", matched: true };
  }
  if (hasAny(normalized, ["open invoice", "open amount", "unsettled", "acik fatura", "odenmemis"])) {
    return { metric: "open_balance", matched: true };
  }
  if (hasAny(normalized, ["refund", "chargeback", "iade", "ters ibraz"])) {
    return { metric: "refunds", matched: true };
  }
  if (hasAny(normalized, ["on time", "on-time", "on-time rate", "late payment rate", "settlement rate", "zamaninda", "gec odeme orani"])) {
    return { metric: "on_time_rate", matched: true };
  }
  if (hasAny(normalized, ["settlement lag", "days to settle", "odeme gecikmesi", "tahsilat suresi"])) {
    return { metric: "settlement_lag", matched: true };
  }
  if (hasAny(normalized, ["cash collected", "collections", "tahsilat", "tahsil edilen"])) {
    return { metric: "customer_collections", matched: true };
  }
  if (hasAny(normalized, ["cash paid", "supplier payment", "paid suppliers", "tedarikci odeme"])) {
    return { metric: "supplier_payments", matched: true };
  }
  const asksForCashInflow = hasAny(normalized, [
    "cash inflow",
    "cash in",
    "cash came in",
    "cash coming in",
    "cash received",
    "nakit giris",
  ]);
  const asksForCashOutflow = hasAny(normalized, [
    "cash outflow",
    "cash out",
    "nakit cikis",
  ]);
  if (
    hasAny(normalized, ["net cash", "cash flow", "bank movement", "nakit akisi", "nakit hareket"]) ||
    hasAny(normalized, [
      "inflow and outflow",
      "inflow vs outflow",
      "inflow versus outflow",
      "cash in and out",
      "nakit giris ve cikis",
    ]) ||
    (asksForCashInflow && asksForCashOutflow)
  ) {
    return { metric: "net_cash", matched: true };
  }
  if (
    asksForCashInflow
  ) {
    return { metric: "cash_inflow", matched: true };
  }
  if (asksForCashOutflow) {
    return { metric: "cash_outflow", matched: true };
  }
  const asksForRevenueAndCosts =
    hasAny(normalized, ["revenue", "sales", "turnover", "gelir", "ciro"]) &&
    hasAny(normalized, ["cost", "expense", "spend", "gider", "maliyet", "harcama"]);
  if (asksForRevenueAndCosts) {
    return { metric: "operating_result", matched: true };
  }
  if (hasAny(normalized, ["gross revenue", "gross sales", "brut gelir", "brut ciro"])) {
    return { metric: "gross_revenue", matched: true };
  }
  if (hasAny(normalized, ["margin", "marj"])) {
    return { metric: "operating_margin", matched: true };
  }
  if (hasAny(normalized, ["profit", "operating result", "surplus", "kar", "faaliyet sonucu"])) {
    return { metric: "operating_result", matched: true };
  }
  if (hasAny(normalized, ["cost", "expense", "spend", "gider", "maliyet", "harcama"])) {
    return { metric: "operating_costs", matched: true };
  }
  if (hasAny(normalized, ["revenue", "sales", "turnover", "gelir", "ciro"])) {
    return { metric: "net_revenue", matched: true };
  }
  if (hasAny(normalized, [
    "transaction count",
    "transactions",
    "bank transaction",
    "bank transactions",
    "banka islemi",
    "banka islemleri",
    "islem adedi",
    "islem sayisi",
  ])) {
    return { metric: "transactions", matched: true };
  }
  return { metric: "operating_result", matched: false };
}

function detectDimension(normalized: string): DimensionId | null {
  const checks: Array<[DimensionId, string[]]> = [
    ["counterparty", ["by counterparty", "counterparties", "karsi tarafa gore", "karsi taraf bazinda"]],
    ["customer", ["by customer", "per customer", "customers", "musteriye gore", "musteriler", "musteri bazinda", "musteri"]],
    ["supplier", ["by supplier", "by vendor", "suppliers", "tedarikciye gore", "tedarikciler", "tedarikci bazinda"]],
    ["country", ["by country", "countries", "markets", "ulkeye gore", "ulkeler", "pazarlara gore", "ulke bazinda"]],
    ["region", ["by region", "regions", "bolgeye gore", "bolgeler", "bolge bazinda"]],
    ["product", ["by product", "by service", "products", "urune gore", "urunler", "hizmete gore"]],
    ["category", ["by category", "cost categories", "expense categories", "kategoriye gore", "kategoriler", "kategori bazinda", "gider kalemi", "maliyet kalemi"]],
    ["department", ["by department", "departments", "departmana gore"]],
    ["project", ["by project", "projects", "projeye gore"]],
    ["salesChannel", ["by channel", "sales channel", "kanala gore", "satis kanali"]],
    ["paymentMethod", ["by payment method", "payment methods", "odeme yontemine gore"]],
    ["account", ["by account", "bank account", "hesaba gore", "banka hesabi"]],
    ["allocationStatus", ["by allocation status", "mapping status", "allocation status", "eslesme durumu"]],
    ["settlementStatus", ["by settlement status", "settlement status", "odeme durumu"]],
    ["agingBucket", ["by aging", "aging bucket", "yaslandirma", "vade grubu"]],
    ["eventType", ["by event", "event type", "olay turune gore"]],
    ["quarter", ["quarterly", "by quarter", "ceyreklik", "ceyrege gore", "ceyrek bazinda"]],
    ["month", ["monthly", "by month", "each month", "every month", "month by month", "over time", "trend", "aylik", "her ay", "aya gore", "ay bazinda", "zaman icinde"]],
    ["year", ["yearly", "annual", "by year", "year over year", "yillik", "yila gore"]],
  ];
  return checks.find(([, aliases]) => hasAny(normalized, aliases))?.[0] ?? null;
}

function defaultDimension(metric: MetricId, normalized: string): DimensionId {
  if (
    hasAny(normalized, [
      "top",
      "bottom",
      "largest",
      "highest",
      "biggest",
      "lowest",
      "smallest",
      "least",
      "en buyuk",
      "en yuksek",
      "en fazla",
      "en dusuk",
      "en kucuk",
      "en az",
    ])
  ) {
    if (metric === "operating_costs") return "category";
    if (metric === "open_ar" || metric === "overdue_open") return "customer";
    if (metric === "open_ap") return "supplier";
    return "country";
  }
  if (metric === "open_ar") return "customer";
  if (metric === "open_ap") return "supplier";
  if (metric === "open_balance") return "agingBucket";
  if (metric === "data_quality") return "dataQualityType";
  if (metric === "mapping_coverage" || metric === "review_items") return "allocationStatus";
  if (metric === "reconciliation_gap") return "month";
  if (metric === "on_time_rate") return "month";
  if (metric === "settlement_lag") return "settlementStatus";
  if (metric === "cash_balance") return "account";
  return "year";
}

function detectIntent(
  normalized: string,
  dimension: DimensionId,
  comparison: boolean,
): QueryPlan["intent"] {
  if (hasAny(normalized, ["why", "driver", "explain", "neden", "acikla"])) return "diagnostic";
  if (comparison) return "comparison";
  if (hasAny(normalized, [
    "top",
    "bottom",
    "largest",
    "highest",
    "lowest",
    "smallest",
    "rank",
    "en buyuk",
    "en yuksek",
    "en fazla",
    "en dusuk",
    "en kucuk",
    "en az",
    "sirala",
  ])) return "ranking";
  if (dimension === "month" || dimension === "quarter" || dimension === "year") return "trend";
  if (hasAny(normalized, ["how much", "what is", "ne kadar", "nedir"])) return "value";
  return "ranking";
}

function extractFilters(normalized: string): QueryFilter[] {
  if (!normalized.trim()) return [];
  return [];
}

function extractCategoricalFilters(
  normalized: string,
  dataset: FinanceDataset,
  groupingDimension: DimensionId,
  metric: MetricId,
): QueryFilter[] {
  const specs: Array<{
    dimensionKey: string;
    field: keyof FinanceRecord;
    dimension: DimensionId;
    min: number;
  }> = [
    { dimensionKey: "countries", field: "country", dimension: "country", min: 4 },
    { dimensionKey: "regions", field: "region", dimension: "region", min: 5 },
    { dimensionKey: "customers", field: "customer", dimension: "customer", min: 7 },
    { dimensionKey: "suppliers", field: "supplier", dimension: "supplier", min: 7 },
    { dimensionKey: "products", field: "product", dimension: "product", min: 6 },
    { dimensionKey: "categories", field: "category", dimension: "category", min: 6 },
    { dimensionKey: "departments", field: "department", dimension: "department", min: 6 },
    { dimensionKey: "projects", field: "project", dimension: "project", min: 6 },
    { dimensionKey: "salesChannels", field: "salesChannel", dimension: "salesChannel", min: 6 },
    { dimensionKey: "paymentMethods", field: "paymentMethod", dimension: "paymentMethod", min: 6 },
    { dimensionKey: "accounts", field: "account", dimension: "account", min: 6 },
    { dimensionKey: "allocationStatuses", field: "allocationStatus", dimension: "allocationStatus", min: 6 },
    { dimensionKey: "settlementStatuses", field: "settlementStatus", dimension: "settlementStatus", min: 6 },
  ];
  const filters = new Map<DimensionId, QueryFilter>();

  for (const spec of specs) {
    const values = dataset.dimensions[spec.dimensionKey] ?? [];
    let matches = values
      .filter((value) => !(spec.field === "region" && value === "Europe"))
      .filter((value) => normalize(value).length >= spec.min)
      .filter((value) => normalized.includes(normalize(value)))
      .sort((a, b) => b.length - a.length);

    const categoryConcept = hasAny(normalized, [
      "professional service",
      "professional services",
      "ai token",
      "ai api token",
    ]);
    if (
      categoryConcept &&
      (spec.dimension === "category" || spec.dimension === "product")
    ) {
      const requestedCanonical = hasAny(normalized, [
        "professional service",
        "professional services",
      ])
        ? "Professional Service"
        : "AI API / Token Cost";
      matches = [
        ...new Set([
          ...matches,
          ...values.filter(
            (value) =>
              canonicalCategory(value) === requestedCanonical ||
              value === requestedCanonical,
          ),
        ]),
      ];
    }

    if (matches.length > 0) {
      filters.set(spec.dimension, {
        field: spec.field,
        label: matches.join(", "),
        values: matches,
      });
    }
  }

  if (filters.has("category") && filters.has("product")) {
    const explicitProduct =
      groupingDimension === "product" ||
      hasAny(normalized, ["as a product", "product named", "urun olarak"]);
    const explicitCategory =
      groupingDimension === "category" ||
      hasAny(normalized, ["as a category", "cost category", "expense category", "kategori olarak"]);
    const costMetric = ["operating_costs", "supplier_payments", "open_ap"].includes(metric);
    const intended = explicitProduct
      ? "product"
      : explicitCategory || costMetric
        ? "category"
        : "product";
    filters.delete(intended === "product" ? "category" : "product");
  }

  return [...filters.values()];
}

function dedupeFilters(filters: QueryFilter[]): QueryFilter[] {
  const merged = new Map<string, QueryFilter>();
  for (const filter of filters) {
    const key = String(filter.field);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...filter, values: [...filter.values] });
      continue;
    }
    existing.values = [...new Set([...existing.values, ...filter.values])];
    existing.label = existing.values.join(" vs ");
  }
  return [...merged.values()];
}

function extractYears(normalized: string): number[] {
  return [...new Set((normalized.match(/\b202[1-4]\b/g) ?? []).map(Number))];
}

function parseLimit(value?: string): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  const wordNumbers: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    bir: 1,
    iki: 2,
    uc: 3,
    dort: 4,
    bes: 5,
    alti: 6,
    yedi: 7,
    sekiz: 8,
    dokuz: 9,
    on: 10,
    "on bir": 11,
    "on iki": 12,
  };
  return wordNumbers[value] ?? null;
}

function extractYearRange(normalized: string): [number, number] | null {
  const match = normalized.match(
    /(?:from|between|arasi|arasinda)?\s*(202[1-4])\s*(?:to|through|until|and|-|–|ile)\s*(202[1-4])/,
  );
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return start <= end ? [start, end] : [end, start];
}

function buildPeriodLabel(filters: QueryFilter[], dataset: FinanceDataset): string {
  const year = filters.find((filter) => filter.field === "year");
  const quarter = filters.find((filter) => filter.field === "quarter");
  const month = filters.find((filter) => filter.field === "month");
  const date = filters.find((filter) => filter.field === "date");
  if (year || quarter || month || date) {
    if (date) return date.label;
    return [year?.label, quarter?.label, month?.label].filter(Boolean).join(" · ");
  }
  return `${dataset.meta.dateStart.slice(0, 7)}–${dataset.meta.dateEnd.slice(0, 7)}`;
}

function filterRows(rows: FinanceRecord[], plan: QueryPlan): FinanceRecord[] {
  return rows.filter((row) => {
    if (
      !plan.includeInternalTransfers &&
      isInternal(row) &&
      plan.metric !== "cash_balance" &&
      plan.basis !== "quality"
    ) {
      return false;
    }

    return plan.filters.every((filter) => {
      if (filter.field === "year") {
        const year = rowYear(row, plan.basis);
        return filter.values.map(Number).includes(year);
      }
      if (filter.field === "month") {
        const month = rowDate(row, plan.basis).slice(5, 7);
        return filter.values.map(String).includes(month);
      }
      if (filter.field === "quarter") {
        const quarter = rowQuarter(row, plan.basis);
        return filter.values.map(String).includes(quarter);
      }
      if (filter.field === "date") {
        return filter.values.map(String).includes(rowDate(row, plan.basis).slice(0, 10));
      }
      const current = String(row[filter.field] ?? "");
      return filter.values.some((value) => normalize(current) === normalize(String(value)));
    });
  });
}

function selectSource(
  plan: QueryPlan,
  filtered: FactStore,
): { rows: FinanceRecord[]; sourceKind: SourceKind; factView: string } {
  const cashMetric = [
    "cash_inflow",
    "cash_outflow",
    "net_cash",
    "customer_collections",
    "supplier_payments",
  ].includes(plan.metric);
  const usesBusinessAttribution =
    BUSINESS_DIMENSIONS.has(plan.dimension) ||
    plan.filters.some((filter) => BUSINESS_FILTER_FIELDS.has(filter.field));

  if (
    plan.metric === "customer_collections" ||
    plan.metric === "supplier_payments" ||
    (cashMetric && usesBusinessAttribution)
  ) {
    const allocationRows = filtered.raw.filter(
      (row) => row.transactionId && row.allocationStatus !== "UNSETTLED",
    );
    const contributingRows = allocationRows.filter((row) => {
      if (plan.metric === "cash_inflow") return row.businessAmount > 0;
      if (plan.metric === "cash_outflow") return row.businessAmount < 0;
      if (plan.metric === "customer_collections") {
        return row.counterpartyType === "CUSTOMER" && row.businessAmount > 0;
      }
      if (plan.metric === "supplier_payments") {
        return row.counterpartyType === "SUPPLIER" && row.businessAmount < 0;
      }
      return true;
    });
    return {
      rows: contributingRows,
      sourceKind: "allocation",
      factView: "contributing bank-linked allocation rows",
    };
  }

  if (
    cashMetric ||
    plan.metric === "cash_balance" ||
    plan.metric === "mapping_coverage" ||
    plan.metric === "transactions"
  ) {
    const bankRows = filtered.bank.filter((row) => {
      if (plan.metric === "cash_inflow") return row.bankAmount > 0;
      if (plan.metric === "cash_outflow") return row.bankAmount < 0;
      return true;
    });
    return {
      rows: bankRows,
      sourceKind: "bank",
      factView:
        plan.metric === "cash_inflow" || plan.metric === "cash_outflow"
          ? "contributing unique bank transactions"
          : "unique bank transactions",
    };
  }

  if (plan.metric === "review_items") {
    return {
      rows: filtered.bank.filter((row) => row.allocationStatus === "REVIEW_NEEDED"),
      sourceKind: "bank",
      factView: "review-needed bank transactions",
    };
  }

  if (plan.metric === "data_quality") {
    return {
      rows: filtered.bank.filter((row) => row.dataQualityFlag),
      sourceKind: "bank",
      factView: "flagged bank transactions",
    };
  }

  if (plan.metric === "reconciliation_gap") {
    return {
      rows: filtered.raw.filter((row) => Boolean(row.transactionId)),
      sourceKind: "allocation",
      factView: "bank-linked mapping / allocation rows",
    };
  }

  if (plan.metric === "mapping_confidence") {
    return { rows: filtered.raw, sourceKind: "allocation", factView: "mapping / allocation rows" };
  }

  const businessRows = filtered.business.filter((row) => {
    if (plan.metric === "open_ar") {
      return row.counterpartyType === "CUSTOMER" && row.openAmount > 0;
    }
    if (plan.metric === "open_ap") {
      return row.counterpartyType === "SUPPLIER" && row.openAmount > 0;
    }
    if (plan.metric === "open_balance") return row.openAmount > 0;
    if (plan.metric === "overdue_open") return row.overdue && row.openAmount > 0;
    if (plan.metric === "refunds") {
      return row.counterpartyType === "CUSTOMER" && row.refundOrReversal;
    }
    if (plan.metric === "on_time_rate" || plan.metric === "settlement_lag") {
      return completedSettlements([row]).length === 1;
    }
    return true;
  });
  return {
    rows: businessRows,
    sourceKind: "business",
    factView:
      businessRows.length === filtered.business.length
        ? "unique business events"
        : "contributing unique business events",
  };
}

function countableRows(
  rows: FinanceRecord[],
  metric: MetricId,
  sourceKind: SourceKind,
): FinanceRecord[] {
  return rows.filter((row) => {
    if (metric === "refunds") {
      return row.counterpartyType === "CUSTOMER" && row.refundOrReversal;
    }
    if (metric === "open_ar") {
      return row.counterpartyType === "CUSTOMER" && row.openAmount > 0;
    }
    if (metric === "open_ap") {
      return row.counterpartyType === "SUPPLIER" && row.openAmount > 0;
    }
    if (metric === "open_balance") return row.openAmount > 0;
    if (metric === "overdue_open") return row.overdue && row.openAmount > 0;
    if (metric === "review_items") return row.allocationStatus === "REVIEW_NEEDED";
    if (metric === "data_quality") return row.dataQualityFlag;
    if (metric === "mapping_coverage") return Boolean(row.transactionId);
    if (metric === "transactions") return Boolean(row.transactionId);
    return sourceKind === "business" ? Boolean(row.businessEventId) : Boolean(row.transactionId);
  });
}

function countMetricRows(rows: FinanceRecord[], sourceKind: SourceKind): number {
  if (sourceKind === "bank" || sourceKind === "allocation") {
    return uniqueTransactions(rows).length;
  }
  return new Set(rows.map((row) => row.businessEventId || row.id)).size;
}

function countMetricLabel(metric: MetricId): string {
  const labels: Partial<Record<MetricId, string>> = {
    refunds: "Refund / chargeback events",
    open_ar: "Open customer invoices",
    open_ap: "Open supplier invoices",
    open_balance: "Open invoices",
    overdue_open: "Overdue open invoices",
    mapping_coverage: "Bank transactions",
    review_items: "Review-needed transactions",
    data_quality: "Flagged bank transactions",
    transactions: "Bank transactions",
  };
  return labels[metric] ?? `${METRIC_LABELS[metric]} records`;
}

function buildChart(
  rows: FinanceRecord[],
  sourceKind: SourceKind,
  plan: QueryPlan,
  dataset: FinanceDataset,
): {
  type: AnalysisResult["chartType"];
  title: string;
  subtitle: string;
  data: ChartDatum[];
  series: ChartSeries[];
} {
  const grouped = groupRows(rows, plan.dimension, plan.basis);
  let data: ChartDatum[];
  let series: ChartSeries[];
  let type: AnalysisResult["chartType"];

  if (plan.rateKind) {
    const denominator = uniqueTransactions(rows).length;
    const numerator = rateNumeratorRows(rows, plan.rateKind).length;
    data = [
      {
        label: rateLabel(plan.rateKind),
        rawLabel: plan.rateKind,
        value: numerator,
      },
      {
        label: "Other transactions",
        rawLabel: "other",
        value: Math.max(denominator - numerator, 0),
      },
    ];
    series = [
      {
        key: "value",
        label: "Bank transactions",
        color: BLUE,
        format: "number",
        kind: "bar",
      },
    ];
    type = "donut";
  } else if (plan.countMode) {
    data = [...grouped.entries()].map(([label, group]) => ({
      label: displayDimension(label, plan.dimension),
      rawLabel: label,
      value: countMetricRows(group, sourceKind),
    }));
    series = [
      {
        key: "value",
        label: countMetricLabel(plan.metric),
        color: BLUE,
        format: "number",
        kind: plan.dimension === "month" ? "area" : "bar",
      },
    ];
    if (
      ["allocationStatus", "settlementStatus", "agingBucket"].includes(plan.dimension) &&
      data.length <= 6
    ) {
      type = "donut";
    } else if (plan.dimension === "month" && data.length >= 8) {
      type = "area";
    } else if (plan.dimension === "month" || plan.dimension === "quarter") {
      type = "line";
    } else {
      type = "bar";
    }
  } else if (plan.metric === "cash_balance") {
    if (["month", "quarter", "year"].includes(plan.dimension)) {
      data = temporalKeys(plan, dataset, rows).map((key) => ({
        label: displayDimension(key, plan.dimension),
        rawLabel: key,
        value: closingMovementBalance(
          rows.filter((row) => rowDate(row, "cash") <= periodEndForKey(key)),
        ),
      }));
    } else {
      data = [...grouped.entries()].map(([label, group]) => ({
        label: displayDimension(label, plan.dimension),
        rawLabel: label,
        value: closingMovementBalance(group),
      }));
    }
    series = [
      {
        key: "value",
        label: metricDisplayLabel(plan),
        color: BLUE,
        format: "currency",
        kind: plan.dimension === "month" ? "line" : "bar",
      },
    ];
    type = plan.dimension === "month" && data.length >= 2 ? "line" : "bar";
  } else if (plan.metric === "operating_result") {
    data = [...grouped.entries()].map(([label, group]) => ({
      label: displayDimension(label, plan.dimension),
      rawLabel: label,
      revenue: aggregateMetric(group, "net_revenue", "business"),
      costs: aggregateMetric(group, "operating_costs", "business"),
      result: aggregateMetric(group, "operating_result", "business"),
    }));
    series = [
      { key: "revenue", label: "Net revenue", color: BLUE, format: "currency", kind: "bar" },
      { key: "costs", label: "Operating costs", color: INDIGO, format: "currency", kind: "bar" },
      { key: "result", label: "Operating result", color: INK, format: "currency", kind: "line" },
    ];
    type = "composed";
  } else if (plan.metric === "operating_margin") {
    data = [...grouped.entries()].map(([label, group]) => {
      const revenue = aggregateMetric(group, "net_revenue", "business");
      const result = aggregateMetric(group, "operating_result", "business");
      return {
        label: displayDimension(label, plan.dimension),
        rawLabel: label,
        value: revenue === 0 ? 0 : result / revenue,
      };
    });
    series = [
      {
        key: "value",
        label: "Operating margin proxy",
        color: BLUE,
        format: "percent",
        kind: plan.dimension === "month" ? "area" : "bar",
      },
    ];
    type =
      plan.dimension === "month" && data.length >= 8
        ? "area"
        : plan.dimension === "month" || plan.dimension === "quarter"
          ? "line"
          : "bar";
  } else if (plan.metric === "net_cash") {
    data = [...grouped.entries()].map(([label, group]) => ({
      label: displayDimension(label, plan.dimension),
      rawLabel: label,
      inflow: aggregateMetric(group, "cash_inflow", sourceKind),
      outflow: aggregateMetric(group, "cash_outflow", sourceKind),
      net: aggregateMetric(group, "net_cash", sourceKind),
    }));
    series = [
      { key: "inflow", label: "Inflow", color: BLUE, format: "currency", kind: "bar" },
      { key: "outflow", label: "Outflow", color: INDIGO, format: "currency", kind: "bar" },
      { key: "net", label: "Net", color: INK, format: "currency", kind: "line" },
    ];
    type = "composed";
  } else if (plan.metric === "open_balance") {
    data = [...grouped.entries()].map(([label, group]) => {
      const receivables = aggregateMetric(group, "open_ar", "business");
      const payables = aggregateMetric(group, "open_ap", "business");
      return {
        label: displayDimension(label, plan.dimension),
        rawLabel: label,
        receivables,
        payables,
        total: receivables + payables,
      };
    });
    series = [
      { key: "receivables", label: "Open AR", color: BLUE, format: "currency", kind: "bar" },
      { key: "payables", label: "Open AP", color: INDIGO, format: "currency", kind: "bar" },
    ];
    type = "bar";
  } else if (plan.metric === "reconciliation_gap") {
    data = [...grouped.entries()].map(([label, group]) => ({
      label: displayDimension(label, plan.dimension),
      rawLabel: label,
      bank: sum(group.map((row) => row.bankAmount)),
      business: sum(group.map((row) => row.businessAmount)),
      gap: aggregateMetric(group, "reconciliation_gap", "allocation"),
    }));
    series = [
      { key: "bank", label: "Bank", color: BLUE, format: "currency", kind: "bar" },
      { key: "business", label: "Business", color: INDIGO, format: "currency", kind: "bar" },
      { key: "gap", label: "Net difference", color: CORAL, format: "currency", kind: "line" },
    ];
    type = "composed";
  } else {
    const mappingStatusMix =
      plan.metric === "mapping_coverage" && plan.dimension === "allocationStatus";
    const chartMetric =
      mappingStatusMix || ["review_items", "data_quality"].includes(plan.metric)
      ? "transactions"
      : plan.metric;
    data = [...grouped.entries()].map(([label, group]) => ({
      label: displayDimension(label, plan.dimension),
      rawLabel: label,
      value: aggregateMetric(group, chartMetric as MetricId, sourceKind),
    }));
    series = [
      {
        key: "value",
        label: mappingStatusMix ? "Bank transactions" : METRIC_LABELS[plan.metric],
        color: BLUE,
        format: mappingStatusMix ? "number" : metricFormat(plan.metric),
        kind: plan.dimension === "month" ? "area" : "bar",
      },
    ];
    const nonNegative = data.every((item) => Number(item.value ?? 0) >= 0);
    const additiveComposition =
      plan.metric === "transactions" ||
      (plan.metric === "mapping_coverage" &&
        plan.dimension === "allocationStatus") ||
      (["review_items", "data_quality"].includes(plan.metric) &&
        ["allocationStatus", "dataQualityType"].includes(plan.dimension));
    if (
      additiveComposition &&
      ["allocationStatus", "settlementStatus", "agingBucket"].includes(plan.dimension) &&
      data.length <= 6 &&
      nonNegative
    ) {
      type = "donut";
    } else if (plan.dimension === "month" && data.length >= 8) {
      type = "area";
    } else if (plan.dimension === "month" || plan.dimension === "quarter") {
      type = "line";
    } else {
      type = "bar";
    }
  }

  let completedMissingPeriods = false;
  if (
    !plan.rateKind &&
    plan.metric !== "cash_balance" &&
    ["month", "quarter", "year"].includes(plan.dimension)
  ) {
    const completed = completeTemporalData(data, series, plan, dataset, rows);
    data = completed.data;
    completedMissingPeriods = completed.hadMissing;
  }

  const availableDatumCount = data.length;
  data = sortAndLimit(data, plan);
  const wasTruncated = !plan.showAll && data.length < availableDatumCount;
  if (
    ["line", "area"].includes(type) &&
    (plan.intent === "ranking" || data.length < 8 || completedMissingPeriods)
  ) {
    type = "bar";
    series = series.map((item) => ({ ...item, kind: "bar" }));
  }
  let title = plan.rateKind
    ? `${rateLabel(plan.rateKind)} rate`
    : `${plan.countMode ? countMetricLabel(plan.metric) : metricDisplayLabel(plan)} by ${DIMENSION_LABELS[plan.dimension]}`;
  if (wasTruncated && data.length > 0) {
    title = `${plan.sortDirection === "asc" ? "Bottom" : "Top"} ${data.length} · ${title}`;
  }
  const unitLabel =
    plan.rateKind
      ? `transaction count · denominator ${rows.length.toLocaleString("en-GB")}`
      : plan.countMode
      ? "record count"
      : plan.metric === "mapping_coverage" && plan.dimension === "allocationStatus"
      ? "transaction count"
      : plan.metric === "settlement_lag"
        ? "days"
      : metricFormat(plan.metric) === "percent"
        ? "percentage"
        : metricFormat(plan.metric) === "number"
          ? "count"
          : "EUR base amounts";
  const visibilityLabel = wasTruncated
    ? ` · ${data.length.toLocaleString("en-GB")} of ${availableDatumCount.toLocaleString("en-GB")} categories shown`
    : "";
  const subtitle = `${plan.periodLabel} · ${unitLabel} · ${rows.length.toLocaleString("en-GB")} source rows${visibilityLabel}`;
  return { type, title, subtitle, data, series };
}

function completeTemporalData(
  data: ChartDatum[],
  series: ChartSeries[],
  plan: QueryPlan,
  dataset: FinanceDataset,
  rows: FinanceRecord[],
): { data: ChartDatum[]; hadMissing: boolean } {
  const keys = temporalKeys(plan, dataset, rows);
  if (keys.length === 0) return { data, hadMissing: false };
  const existing = new Map(
    data.map((datum) => [String(datum.rawLabel ?? datum.label), datum]),
  );
  let hadMissing = false;
  const completed = keys.map((key) => {
    const datum = existing.get(key);
    if (datum) return datum;
    hadMissing = true;
    return Object.fromEntries([
      ["label", displayDimension(key, plan.dimension)],
      ["rawLabel", key],
      ...series.map((item) => [item.key, 0]),
    ]) as ChartDatum;
  });
  return { data: completed, hadMissing };
}

function temporalKeys(
  plan: QueryPlan,
  dataset: FinanceDataset,
  rows: FinanceRecord[],
): string[] {
  if (!["month", "quarter", "year"].includes(plan.dimension)) return [];

  const yearFilter = plan.filters.find((filter) => filter.field === "year");
  const monthFilter = plan.filters.find((filter) => filter.field === "month");
  const quarterFilter = plan.filters.find((filter) => filter.field === "quarter");
  const dateFilter = plan.filters.find((filter) => filter.field === "date");
  const firstYear = Number(dataset.meta.dateStart.slice(0, 4));
  const lastYear = Number(dataset.meta.dateEnd.slice(0, 4));
  const years = yearFilter
    ? [...new Set(yearFilter.values.map(Number))].sort((a, b) => a - b)
    : dateFilter
      ? [...new Set(dateFilter.values.map((value) => Number(String(value).slice(0, 4))))]
      : Array.from(
          { length: lastYear - firstYear + 1 },
          (_, index) => firstYear + index,
        );

  if (plan.dimension === "year") return years.map(String);

  const requestedMonths = monthFilter
    ? new Set(monthFilter.values.map((value) => String(value).padStart(2, "0")))
    : null;
  const requestedQuarters = quarterFilter
    ? new Set(quarterFilter.values.map(String))
    : null;
  const keys: string[] = [];

  if (plan.dimension === "quarter") {
    for (const year of years) {
      for (let quarter = 1; quarter <= 4; quarter += 1) {
        const value = `Q${quarter}`;
        if (requestedQuarters && !requestedQuarters.has(value)) continue;
        keys.push(`${year} ${value}`);
      }
    }
  } else {
    for (const year of years) {
      for (let month = 1; month <= 12; month += 1) {
        const value = String(month).padStart(2, "0");
        const quarter = `Q${Math.ceil(month / 3)}`;
        if (requestedMonths && !requestedMonths.has(value)) continue;
        if (requestedQuarters && !requestedQuarters.has(quarter)) continue;
        const key = `${year}-${value}`;
        if (key < dataset.meta.dateStart.slice(0, 7)) continue;
        if (key > dataset.meta.dateEnd.slice(0, 7)) continue;
        keys.push(key);
      }
    }
  }

  if (keys.length > 0) return keys;
  return [...new Set(rows.map((row) => dimensionValue(row, plan.dimension, plan.basis)))]
    .filter((value) => value !== "Unspecified")
    .sort();
}

function periodEndForKey(key: string): string {
  if (/^\d{4}$/.test(key)) return `${key}-12-31`;
  const quarter = key.match(/^(\d{4}) Q([1-4])$/);
  if (quarter) {
    const endings = ["03-31", "06-30", "09-30", "12-31"];
    return `${quarter[1]}-${endings[Number(quarter[2]) - 1]}`;
  }
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [year, month] = key.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${key}-${String(lastDay).padStart(2, "0")}`;
  }
  return key;
}

function cashBalanceCutoff(plan: QueryPlan, dataset: FinanceDataset): string {
  const dateFilter = plan.filters.find((filter) => filter.field === "date");
  if (dateFilter) {
    const requested = dateFilter.values.map(String).sort().at(-1) ?? dataset.meta.asOf;
    return requested > dataset.meta.asOf ? dataset.meta.asOf : requested;
  }

  const yearFilter = plan.filters.find((filter) => filter.field === "year");
  const quarterFilter = plan.filters.find((filter) => filter.field === "quarter");
  const monthFilter = plan.filters.find((filter) => filter.field === "month");
  const fallbackYear = Number(dataset.meta.asOf.slice(0, 4));
  const requestedYear = yearFilter
    ? Math.max(...yearFilter.values.map(Number))
    : fallbackYear;

  let requested = dataset.meta.asOf;
  if (monthFilter) {
    const month = monthFilter.values.map(String).sort().at(-1)?.padStart(2, "0") ?? "12";
    requested = periodEndForKey(`${requestedYear}-${month}`);
  } else if (quarterFilter) {
    const quarter = quarterFilter.values.map(String).sort().at(-1) ?? "Q4";
    requested = periodEndForKey(`${requestedYear} ${quarter}`);
  } else if (yearFilter) {
    requested = periodEndForKey(String(requestedYear));
  }

  return requested > dataset.meta.asOf ? dataset.meta.asOf : requested;
}

function cashBalanceRows(
  rows: FinanceRecord[],
  plan: QueryPlan,
  dataset: FinanceDataset,
): FinanceRecord[] {
  const nonTemporalPlan: QueryPlan = {
    ...plan,
    filters: plan.filters.filter(
      (filter) => !["year", "quarter", "month", "date"].includes(String(filter.field)),
    ),
  };
  const scoped = filterRows(rows, nonTemporalPlan);
  const cutoff = cashBalanceCutoff(plan, dataset);
  return scoped.filter((row) => rowDate(row, "cash") <= cutoff);
}

function rateNumeratorRows(rows: FinanceRecord[], kind: RateKind): FinanceRecord[] {
  const unique = uniqueTransactions(rows);
  switch (kind) {
    case "review":
      return unique.filter((row) => row.allocationStatus === "REVIEW_NEEDED");
    case "data_quality":
      return unique.filter((row) => row.dataQualityFlag);
    case "allocated":
      return unique.filter((row) => row.allocationStatus === "ALLOCATED");
    case "unmapped":
      return unique.filter((row) => row.allocationStatus === "UNMAPPED");
    case "duplicates":
      return unique.filter((row) => row.duplicateCandidate);
  }
}

function rateValue(rows: FinanceRecord[], kind: RateKind): number {
  const denominator = uniqueTransactions(rows).length;
  return denominator === 0 ? 0 : rateNumeratorRows(rows, kind).length / denominator;
}

function rateLabel(kind: RateKind): string {
  const labels: Record<RateKind, string> = {
    review: "Review-needed transactions",
    data_quality: "Data-quality flagged transactions",
    allocated: "Fully allocated transactions",
    unmapped: "Unmapped transactions",
    duplicates: "Suspected duplicate transactions",
  };
  return labels[kind];
}

function metricDisplayLabel(plan: QueryPlan): string {
  if (
    plan.includeInternalTransfers &&
    ["cash_inflow", "cash_outflow", "net_cash"].includes(plan.metric)
  ) {
    const labels: Partial<Record<MetricId, string>> = {
      cash_inflow: "Cash inflow",
      cash_outflow: "Cash outflow",
      net_cash: "Net cash movement",
    };
    return labels[plan.metric] as string;
  }
  return METRIC_LABELS[plan.metric];
}

function groupRows(
  rows: FinanceRecord[],
  dimension: DimensionId,
  basis: Basis,
): Map<string, FinanceRecord[]> {
  const grouped = new Map<string, FinanceRecord[]>();
  for (const row of rows) {
    const value = dimensionValue(row, dimension, basis);
    const group = grouped.get(value) ?? [];
    group.push(row);
    grouped.set(value, group);
  }
  return grouped;
}

function dimensionValue(row: FinanceRecord, dimension: DimensionId, basis: Basis): string {
  if (dimension === "year") return String(rowYear(row, basis) || "Unspecified");
  if (dimension === "month") return rowDate(row, basis).slice(0, 7) || "Unspecified";
  if (dimension === "quarter") {
    const year = rowYear(row, basis);
    return year ? `${year} ${rowQuarter(row, basis)}` : "Unspecified";
  }
  const field = DIMENSION_FIELDS[dimension];
  const raw = field ? String(row[field] ?? "") : "";
  if (!raw) return "Unspecified";
  return dimension === "category" ? canonicalCategory(raw) : raw;
}

function aggregateMetric(
  rows: FinanceRecord[],
  metric: MetricId,
  sourceKind: SourceKind,
): number {
  const allocationValue = (row: FinanceRecord) => row.businessAmount;
  const cashValue = (row: FinanceRecord) =>
    sourceKind === "allocation" ? allocationValue(row) : row.bankAmount;
  const netRevenue = () =>
    sum(
      rows.map((row) =>
        row.counterpartyType === "CUSTOMER" && !isPriorPeriodCollection(row)
          ? row.businessValue
          : 0,
      ),
    );
  const operatingCosts = () =>
    Math.abs(
      sum(
        rows.map((row) =>
          row.counterpartyType === "SUPPLIER" && row.businessValue < 0
            ? row.businessValue
            : 0,
        ),
      ),
    );
  const operatingResult = () => netRevenue() - operatingCosts();

  switch (metric) {
    case "net_revenue":
      return netRevenue();
    case "gross_revenue":
      return sum(
        rows.map((row) =>
          row.counterpartyType === "CUSTOMER" &&
          row.businessValue > 0 &&
          !isPriorPeriodCollection(row)
            ? row.businessValue
            : 0,
        ),
      );
    case "operating_costs":
      return operatingCosts();
    case "operating_result":
      return operatingResult();
    case "operating_margin": {
      const revenue = netRevenue();
      return revenue === 0 ? 0 : operatingResult() / revenue;
    }
    case "cash_inflow":
      return sum(rows.map((row) => Math.max(cashValue(row), 0)));
    case "cash_outflow":
      return Math.abs(sum(rows.map((row) => Math.min(cashValue(row), 0))));
    case "net_cash":
      return sum(rows.map(cashValue));
    case "customer_collections":
      return sum(
        rows.map((row) =>
          row.counterpartyType === "CUSTOMER" ? Math.max(row.businessAmount, 0) : 0,
        ),
      );
    case "supplier_payments":
      return Math.abs(
        sum(
          rows.map((row) =>
            row.counterpartyType === "SUPPLIER" ? Math.min(row.businessAmount, 0) : 0,
          ),
        ),
      );
    case "cash_balance":
      return closingMovementBalance(rows);
    case "open_ar":
      return sum(
        rows.map((row) =>
          row.counterpartyType === "CUSTOMER" ? Math.max(row.openAmount, 0) : 0,
        ),
      );
    case "open_ap":
      return sum(
        rows.map((row) =>
          row.counterpartyType === "SUPPLIER" ? Math.max(row.openAmount, 0) : 0,
        ),
      );
    case "open_balance":
      return aggregateMetric(rows, "open_ar", sourceKind) + aggregateMetric(rows, "open_ap", sourceKind);
    case "overdue_open":
      return sum(rows.map((row) => (row.overdue ? Math.max(row.openAmount, 0) : 0)));
    case "refunds":
      return Math.abs(
        sum(
          rows.map((row) =>
            row.counterpartyType === "CUSTOMER" && row.refundOrReversal
              ? Math.min(row.businessValue, 0)
              : 0,
          ),
        ),
      );
    case "reconciliation_gap":
      return sum(rows.map((row) => row.businessAmount - row.bankAmount));
    case "mapping_coverage": {
      const unique = uniqueTransactions(rows);
      if (unique.length === 0) return 0;
      return unique.filter((row) => row.allocationStatus !== "UNMAPPED").length / unique.length;
    }
    case "review_items":
      return uniqueTransactions(rows).filter((row) => row.allocationStatus === "REVIEW_NEEDED").length;
    case "data_quality":
      return uniqueTransactions(rows).filter((row) => row.dataQualityFlag).length;
    case "mapping_confidence": {
      const values = rows
        .map((row) => row.mappingConfidence)
        .filter((value): value is number => value != null);
      return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
    }
    case "on_time_rate": {
      const completed = completedSettlements(rows);
      if (completed.length === 0) return 0;
      const onTime = completed.filter((row) =>
        ["SETTLED_ON_TIME", "INSTANT_SETTLED"].includes(row.settlementStatus),
      ).length;
      return onTime / completed.length;
    }
    case "settlement_lag": {
      const values = completedSettlements(rows)
        .map((row) => row.settlementLagDays)
        .filter((value): value is number => value != null);
      return values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;
    }
    case "transactions":
      return uniqueTransactions(rows).length;
    default:
      return 0;
  }
}

function buildKpis(
  filtered: FactStore,
  plan: QueryPlan,
  selectedRows: FinanceRecord[],
  sourceKind: SourceKind,
): Kpi[] {
  if (plan.metric === "transactions") {
    const bank = uniqueTransactions(filtered.bank);
    const internal = bank.filter(isInternal);
    const external = bank.filter((row) => !isInternal(row));
    const inflow = aggregateMetric(external, "cash_inflow", "bank");
    const outflow = aggregateMetric(external, "cash_outflow", "bank");
    return [
      kpi(
        "Bank transactions",
        bank.length,
        "number",
        plan.includeInternalTransfers
          ? "Includes internal transfers"
          : "External transactions only",
        "neutral",
      ),
      kpi("External transactions", external.length, "number", "Internal transfers excluded", "neutral"),
      kpi("Internal transfers", internal.length, "number", "Identified from supplied flags", "neutral"),
      kpi("External cash volume", inflow + outflow, "currency", "Absolute inflow plus outflow", "neutral"),
    ];
  }

  if (["open_ar", "open_ap", "open_balance", "overdue_open"].includes(plan.metric)) {
    const ar = aggregateMetric(filtered.business, "open_ar", "business");
    const ap = aggregateMetric(filtered.business, "open_ap", "business");
    const overdue = aggregateMetric(filtered.business, "overdue_open", "business");
    const openRows = filtered.business.filter((row) => row.openAmount > 0).length;
    return [
      kpi("Open receivables", ar, "currency", "Recorded open customer amounts", "neutral"),
      kpi("Open payables", ap, "currency", "Recorded open supplier amounts", "neutral"),
      kpi("Flagged overdue", overdue, "currency", "Based on the supplied overdue flag", "warning"),
      kpi("Open events", openRows, "number", "Unique business events", "neutral"),
    ];
  }

  if (["net_cash", "cash_inflow", "cash_outflow", "cash_balance", "customer_collections", "supplier_payments"].includes(plan.metric)) {
    if (sourceKind === "allocation") {
      const value = aggregateMetric(selectedRows, plan.metric, sourceKind);
      const transactionCount = uniqueTransactions(selectedRows).length;
      const prefix = plan.includeInternalTransfers ? "Cash" : "External cash";
      const label: Partial<Record<MetricId, string>> = {
        cash_inflow: `${prefix} in`,
        cash_outflow: `${prefix} out`,
        net_cash: "Net movement",
        customer_collections: "Customer cash collections",
        supplier_payments: "Supplier cash payments",
      };
      return [
        kpi(
          label[plan.metric] ?? METRIC_LABELS[plan.metric],
          value,
          "currency",
          "Same contributing allocation rows as the answer and chart",
          value >= 0 ? "positive" : "negative",
        ),
        kpi(
          "Contributing transactions",
          transactionCount,
          "number",
          "Unique bank transactions represented by the allocation rows",
          "neutral",
        ),
        kpi(
          "Allocation rows",
          selectedRows.length,
          "number",
          "Split transactions remain safely apportioned",
          "neutral",
        ),
      ];
    }
    const includesAllPostedActivity =
      plan.includeInternalTransfers || plan.metric === "cash_balance";
    const bank = includesAllPostedActivity
      ? filtered.bank
      : filtered.bank.filter((row) => !isInternal(row));
    const inflow = aggregateMetric(bank, "cash_inflow", "bank");
    const outflow = aggregateMetric(bank, "cash_outflow", "bank");
    const net = aggregateMetric(bank, "net_cash", "bank");
    const prefix = includesAllPostedActivity ? "Cash" : "External cash";
    const scopeNote = includesAllPostedActivity
      ? plan.metric === "cash_balance"
        ? "All posted account activity retained"
        : "Explicitly includes internal transfers"
      : "Internal transfers excluded";
    return [
      kpi(`${prefix} in`, inflow, "currency", scopeNote, "positive"),
      kpi(`${prefix} out`, outflow, "currency", "Shown as a positive magnitude", "neutral"),
      kpi("Net movement", net, "currency", `Inflow less outflow · ${scopeNote}`, net >= 0 ? "positive" : "negative"),
      kpi("Bank transactions", bank.length, "number", scopeNote, "neutral"),
    ];
  }

  if (["reconciliation_gap", "mapping_coverage", "review_items", "data_quality", "mapping_confidence"].includes(plan.metric)) {
    const bank = filtered.bank;
    const coverage = aggregateMetric(bank, "mapping_coverage", "bank");
    const review = bank.filter((row) => row.allocationStatus === "REVIEW_NEEDED").length;
    const unmapped = bank.filter((row) => row.allocationStatus === "UNMAPPED").length;
    const dataQuality = bank.filter((row) => row.dataQualityFlag).length;
    const reviewRate = bank.length === 0 ? 0 : review / bank.length;
    const dataQualityRate = bank.length === 0 ? 0 : dataQuality / bank.length;
    const confidence = aggregateMetric(filtered.raw, "mapping_confidence", "allocation");
    return [
      kpi("Mapping coverage", coverage, "percent", `${bank.length - unmapped} of ${bank.length} bank transactions`, "positive"),
      kpi("Needs review", review, "number", `${formatPercent(reviewRate)} of all bank transactions`, "warning"),
      kpi("Data-quality flags", dataQuality, "number", `${formatPercent(dataQualityRate)} of all bank transactions`, dataQuality ? "warning" : "positive"),
      kpi("Avg. confidence", confidence, "percent", "Across mapping rows", "neutral"),
    ];
  }

  if (["on_time_rate", "settlement_lag"].includes(plan.metric)) {
    const completed = completedSettlements(filtered.business);
    const onTime = aggregateMetric(filtered.business, "on_time_rate", "business");
    const lag = aggregateMetric(filtered.business, "settlement_lag", "business");
    const late = completed.filter((row) => row.settlementStatus.includes("LATE")).length;
    return [
      kpi("Status-based on-time", onTime, "percent", "On-time + instant / completed", "positive"),
      kpi("Average lag", lag, "number", "Days across completed settlements", "neutral"),
      kpi("Late statuses", late, "number", "Based on supplied settlement status", "warning"),
      kpi("Completed", completed.length, "number", "Unique business events", "neutral"),
    ];
  }

  const revenue = aggregateMetric(filtered.business, "net_revenue", "business");
  const costs = aggregateMetric(filtered.business, "operating_costs", "business");
  const result = aggregateMetric(filtered.business, "operating_result", "business");
  const margin = revenue === 0 ? 0 : result / revenue;
  return [
    kpi("Net revenue", revenue, "currency", "Refunds included; prior-period AR excluded", "positive"),
    kpi("Operating costs", costs, "currency", "Supplier business events", "neutral"),
    kpi("Operating result", result, "currency", "Dataset proxy; not GAAP net profit", result >= 0 ? "positive" : "negative"),
    kpi("Margin proxy", margin, "percent", "Operating result / net revenue", "neutral"),
  ];
}

function buildSummary(
  data: ChartDatum[],
  primaryValue: number,
  plan: QueryPlan,
  filtered: FactStore,
): string {
  const label = metricLabel(plan);
  if (plan.unsupportedMetric) {
    return `${plan.unsupportedMetric} is not reliably derivable from this file. No calculation was produced and no substitute metric was used.`;
  }
  if (plan.rateKind) {
    const denominator = uniqueTransactions(filtered.bank).length;
    const numerator = rateNumeratorRows(filtered.bank, plan.rateKind).length;
    return plan.language === "tr"
      ? `${formatPercent(primaryValue)} (${formatNumber(numerator)} / ${formatNumber(denominator)}) banka işlemi ${rateLabel(plan.rateKind).toLocaleLowerCase("tr-TR")} kapsamındadır.`
      : `${formatPercent(primaryValue)} of bank transactions (${formatNumber(numerator)} of ${formatNumber(denominator)}) are ${rateLabel(plan.rateKind).toLowerCase()}.`;
  }
  if (plan.countMode) {
    return plan.language === "tr"
      ? `Filtrelenen kapsamda ${formatNumber(primaryValue)} ${countMetricLabel(plan.metric).toLocaleLowerCase("tr-TR")} bulunuyor. Bu sonuç tutar değil, benzersiz kayıt sayısıdır.`
      : `The filtered scope contains ${formatNumber(primaryValue)} ${countMetricLabel(plan.metric).toLowerCase()}. This is a unique-record count, not an amount.`;
  }
  if (plan.metric === "open_balance") {
    const ar = aggregateMetric(filtered.business, "open_ar", "business");
    const ap = aggregateMetric(filtered.business, "open_ap", "business");
    return plan.language === "tr"
      ? `Dosyada ${formatCurrency(ar)} açık alacak ve ${formatCurrency(ap)} açık borç kayıtlı. Bunlar güvenilir tarihsel snapshot değil, 31 Aralık 2024 itibarıyla dosyada kalan tutarlardır.`
      : `The file records ${formatCurrency(ar)} of open receivables and ${formatCurrency(ap)} of open payables. These are recorded open amounts, not a reliable historical balance snapshot.`;
  }
  if (plan.metric === "reconciliation_gap") {
    const unbanked = filtered.business.filter(
      (row) => !row.transactionId && Boolean(row.businessEventId),
    );
    const unbankedAr = aggregateMetric(unbanked, "open_ar", "business");
    const unbankedAp = aggregateMetric(unbanked, "open_ap", "business");
    return plan.language === "tr"
      ? `Banka bağlantılı tahsis farkı ${formatCurrency(primaryValue)}. Ayrıca mutabakat farkına katılmayan ${formatNumber(unbanked.length)} bankasız unsettled iş olayı bulunuyor: ${formatCurrency(unbankedAr)} alacak ve ${formatCurrency(unbankedAp)} borç.`
      : `The bank-linked allocation variance is ${formatCurrency(primaryValue)}. Separately, ${formatNumber(unbanked.length)} unbanked unsettled business events are not reconciliation variance: ${formatCurrency(unbankedAr)} receivables and ${formatCurrency(unbankedAp)} payables.`;
  }
  if (plan.metric === "cash_balance" && plan.dimension === "account") {
    return plan.language === "tr"
      ? `${plan.periodLabel} kapanışında kaydedilen toplam hareket bakiyesi ${formatCurrency(primaryValue)}. Grafik, bu toplamı banka hesabı bazında gösteriyor.`
      : `The recorded closing movement balance at ${plan.periodLabel} is ${formatCurrency(primaryValue)}. The chart breaks that total down by bank account.`;
  }
  if (plan.metric === "mapping_coverage" || plan.metric === "review_items" || plan.metric === "data_quality") {
    const coverage = aggregateMetric(filtered.bank, "mapping_coverage", "bank");
    const review = filtered.bank.filter((row) => row.allocationStatus === "REVIEW_NEEDED").length;
    const dataQuality = filtered.bank.filter((row) => row.dataQualityFlag).length;
    const denominator = filtered.bank.length;
    const reviewRate = denominator === 0 ? 0 : review / denominator;
    const dataQualityRate = denominator === 0 ? 0 : dataQuality / denominator;
    if (plan.metric === "review_items") {
      return plan.language === "tr"
        ? `${formatPercent(reviewRate)} (${formatNumber(review)} / ${formatNumber(denominator)}) banka işlemi insan incelemesi gerektiriyor.`
        : `${formatPercent(reviewRate)} of bank transactions (${formatNumber(review)} of ${formatNumber(denominator)}) require human review.`;
    }
    if (plan.metric === "data_quality") {
      return plan.language === "tr"
        ? `${formatPercent(dataQualityRate)} (${formatNumber(dataQuality)} / ${formatNumber(denominator)}) banka işlemi veri kalitesi bayrağı taşıyor.`
        : `${formatPercent(dataQualityRate)} of bank transactions (${formatNumber(dataQuality)} of ${formatNumber(denominator)}) carry a data-quality flag.`;
    }
    return plan.language === "tr"
      ? `Banka işlemlerinin ${formatPercent(coverage)}’i eşleşmiş; ${formatNumber(review)} işlem insan incelemesi gerektiriyor.`
      : `${formatPercent(coverage)} of bank transactions are mapped; ${formatNumber(review)} transactions require human review.`;
  }

  const temporal = ["month", "quarter", "year"].includes(plan.dimension);
  if (temporal && data.length >= 2 && plan.intent !== "ranking") {
    const valueKey = chartValueKey(plan.metric);
    const previous = Number(data[data.length - 2]?.[valueKey] ?? 0);
    const current = Number(data[data.length - 1]?.[valueKey] ?? 0);
    const change = previous === 0 ? null : (current - previous) / Math.abs(previous);
    const direction = change == null ? "" : change >= 0 ? "up" : "down";
    const trDirection = change == null ? "" : change >= 0 ? "arttı" : "azaldı";
    if (plan.language === "tr") {
      return `${label}, ${data.at(-1)?.label} döneminde ${formatByMetric(current, plan.metric)} oldu${change == null ? "." : `; önceki döneme göre ${formatPercent(Math.abs(change))} ${trDirection}.`}`;
    }
    return `${label} reached ${formatByMetric(current, plan.metric)} in ${data.at(-1)?.label}${change == null ? "." : `, ${direction} ${formatPercent(Math.abs(change))} from the previous period.`}`;
  }

  const valueKey = chartValueKey(plan.metric);
  const ranked = [...data].sort((a, b) => {
    const aValue = Number(a[valueKey] ?? 0);
    const bValue = Number(b[valueKey] ?? 0);
    return plan.sortDirection === "asc" ? aValue - bValue : bValue - aValue;
  });
  const leading = ranked[0];
  if (leading) {
    const leadingValue = Number(leading[valueKey] ?? 0);
    const supportsShare = ![
      "operating_margin",
      "mapping_coverage",
      "mapping_confidence",
      "on_time_rate",
      "settlement_lag",
    ].includes(plan.metric);
    const share =
      supportsShare && primaryValue !== 0 ? leadingValue / primaryValue : 0;
    const rankLabel = plan.sortDirection === "asc" ? "smallest" : "largest";
    const trRankLabel = plan.sortDirection === "asc" ? "en küçük" : "en büyük";
    return plan.language === "tr"
      ? `${leading.label}, ${formatByMetric(leadingValue, plan.metric)} ile ${trRankLabel} gözlenen değere sahip${share > 0 && share <= 1 ? ` (${formatPercent(share)} pay)` : ""}.`
      : `${leading.label} has the ${rankLabel} observed value at ${formatByMetric(leadingValue, plan.metric)}${share > 0 && share <= 1 ? `, or ${formatPercent(share)} of the filtered total` : ""}.`;
  }
  return `${label} totals ${formatByMetric(primaryValue, plan.metric)} across the filtered scope.`;
}

function buildHeadline(plan: QueryPlan, data: ChartDatum[]): string {
  if (plan.unsupportedMetric) return `${plan.unsupportedMetric} needs a different source`;
  if (plan.rateKind) return `${rateLabel(plan.rateKind)} rate`;
  if (plan.metric === "cash_balance" && plan.dimension === "account") {
    return metricDisplayLabel(plan);
  }
  if (plan.countMode) {
    return data.length === 1
      ? countMetricLabel(plan.metric)
      : `${countMetricLabel(plan.metric)} across ${plan.periodLabel}`;
  }
  const label = metricDisplayLabel(plan);
  if (plan.intent === "diagnostic") return `Observed contributors to ${label.toLowerCase()}`;
  if (plan.intent === "ranking") return `${label}, ranked`;
  if (plan.intent === "comparison") return `${label} comparison`;
  if (data.length === 1) return label;
  return `${label} across ${plan.periodLabel}`;
}

function buildInsights(data: ChartDatum[], plan: QueryPlan, primaryValue: number): string[] {
  if (data.length === 0) return ["No rows matched the interpreted filters."];
  if (plan.rateKind) {
    const numerator = Number(
      data.find((datum) => datum.rawLabel === plan.rateKind)?.value ?? 0,
    );
    const denominator = sum(data.map((datum) => Number(datum.value ?? 0)));
    return [
      `${rateLabel(plan.rateKind)} account for ${formatPercent(primaryValue)} of the filtered bank-transaction population (${formatNumber(numerator)} of ${formatNumber(denominator)}).`,
    ];
  }
  const valueKey = plan.countMode ? "value" : chartValueKey(plan.metric);
  const ranked = [...data].sort(
    (a, b) => {
      const aValue = Number(a[valueKey] ?? 0);
      const bValue = Number(b[valueKey] ?? 0);
      return plan.sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    },
  );
  const countChart =
    plan.countMode ||
    (plan.metric === "mapping_coverage" &&
      plan.dimension === "allocationStatus");
  const supportsShare =
    plan.countMode ||
    ![
      "operating_margin",
      "mapping_coverage",
      "mapping_confidence",
      "on_time_rate",
      "settlement_lag",
    ].includes(plan.metric);
  const insights: string[] = ranked.slice(0, 3).map((item, index) => {
    const value = Number(item[valueKey] ?? 0);
    const share =
      supportsShare && primaryValue !== 0 ? Math.abs(value / primaryValue) : null;
    const formattedValue = countChart
      ? formatNumber(value)
      : formatByMetric(value, plan.metric);
    if (index === 0) {
      const rankLabel = plan.sortDirection === "asc" ? "lowest" : "highest";
      return `${item.label} has the ${rankLabel} observed value at ${formattedValue}${share != null && share <= 1 ? ` (${formatPercent(share)} of the filtered total)` : ""}.`;
    }
    return `${item.label}: ${formattedValue}.`;
  });
  if (plan.metric === "operating_result") {
    insights.push("This is an operating-result proxy from the supplied events, not a GAAP net-profit measure.");
  }
  return insights.slice(0, 3);
}

function buildDetails(
  rows: FinanceRecord[],
  sourceKind: SourceKind,
  plan: QueryPlan,
): DetailRow[] {
  const relevant = rows.filter((row) => {
    if (plan.rateKind) {
      return rateNumeratorRows([row], plan.rateKind).length === 1;
    }
    if (plan.metric === "net_revenue" || plan.metric === "gross_revenue") return row.counterpartyType === "CUSTOMER";
    if (plan.metric === "operating_costs") return row.counterpartyType === "SUPPLIER";
    if (plan.metric === "open_ar") return row.counterpartyType === "CUSTOMER" && row.openAmount > 0;
    if (plan.metric === "open_ap") return row.counterpartyType === "SUPPLIER" && row.openAmount > 0;
    if (plan.metric === "open_balance") return row.openAmount > 0;
    if (plan.metric === "overdue_open") return row.overdue && row.openAmount > 0;
    if (plan.metric === "refunds") {
      return row.counterpartyType === "CUSTOMER" && row.refundOrReversal;
    }
    const cashValue =
      sourceKind === "allocation" ? row.businessAmount : row.bankAmount;
    if (plan.metric === "cash_inflow") return cashValue > 0;
    if (plan.metric === "cash_outflow") return cashValue < 0;
    if (plan.metric === "customer_collections") {
      return row.counterpartyType === "CUSTOMER" && row.businessAmount > 0;
    }
    if (plan.metric === "supplier_payments") {
      return row.counterpartyType === "SUPPLIER" && row.businessAmount < 0;
    }
    if (plan.metric === "on_time_rate" || plan.metric === "settlement_lag") {
      return completedSettlements([row]).length === 1;
    }
    return true;
  });

  return relevant
    .map((row) => {
      const amount = detailAmount(row, plan.metric, sourceKind);
      return {
        id: row.id,
        date: rowDate(row, plan.basis),
        counterparty: row.customer || row.supplier || row.counterparty || row.counterpartyRaw || "Unspecified",
        context: row.category || row.product || row.account || row.eventType || "Unspecified",
        amount,
        status:
          plan.metric === "overdue_open"
            ? "OVERDUE"
            : plan.metric === "on_time_rate" || plan.metric === "settlement_lag"
              ? row.settlementStatus || "—"
              : plan.metric === "data_quality"
                ? row.dataQualityType || "FLAGGED"
                : row.allocationStatus ||
                  row.settlementStatus ||
                  (row.overdue ? "OVERDUE" : "—"),
      };
    })
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 8);
}

function buildWarnings(
  plan: QueryPlan,
  filtered: FactStore,
  dataset: FinanceDataset,
  chart: ReturnType<typeof buildChart>,
  rows: FinanceRecord[],
): string[] {
  const warnings = [
    "The source is a generated operating simulation; figures demonstrate analytical behavior rather than audited company performance.",
  ];
  if (["open_ar", "open_ap", "open_balance", "overdue_open"].includes(plan.metric)) {
    warnings.push(
      "Open amounts do not have a fully reliable snapshot history; period filters describe the invoice cohort that remains open in the file.",
    );
  }
  if (["on_time_rate", "settlement_lag"].includes(plan.metric)) {
    warnings.push(
      "28 rows are labeled SETTLED_ON_TIME despite settling 1–4 days after due date; the card follows the supplied status definition.",
    );
  }
  if (plan.metric === "reconciliation_gap") {
    const unbanked = filtered.business.filter(
      (row) => !row.transactionId && Boolean(row.businessEventId),
    ).length;
    if (unbanked > 0) {
      warnings.push(
        `${unbanked} unbanked unsettled business events are disclosed separately; they are not treated as bank-linked reconciliation variance.`,
      );
    }
  }
  if (plan.dimension === "counterparty") {
    warnings.push(
      "Counterparty and customer-name fields are not a fully resolved entity key; 28 customer rows use a different standardized counterparty name, so rankings can differ.",
    );
  }
  if (plan.dimension === "supplier") {
    warnings.push(
      "Supplier identifiers and normalized supplier names are not consistently one-to-one in the supplied simulation.",
    );
  }

  if (
    !plan.showAll &&
    !plan.rateKind &&
    !["month", "quarter", "year"].includes(plan.dimension)
  ) {
    const groupCount = groupRows(rows, plan.dimension, plan.basis).size;
    if (groupCount > chart.data.length) {
      warnings.push(
        `Chart and exact-data export are limited to ${plan.sortDirection === "asc" ? "the bottom" : "the top"} ${plan.limit} categories; the headline value still covers all ${groupCount} filtered categories.`,
      );
    }
  }

  if (chart.type === "bar") {
    const values = chart.data.flatMap((datum) =>
      chart.series.map((series) => Number(datum[series.key] ?? 0)),
    );
    if (values.some((value) => value < 0) && values.every((value) => value <= 0)) {
      warnings.push(
        "Zero baseline required: every plotted bar is non-positive, so the value axis must retain zero to preserve honest magnitude.",
      );
    }
  }
  const duplicateRows = filtered.bank.filter((row) => row.duplicateCandidate).length;
  if (duplicateRows > 0 && ["cash_inflow", "cash_outflow", "net_cash"].includes(plan.metric)) {
    warnings.push(`${duplicateRows} observed bank transactions carry suspected-duplicate flags; cash remains shown as observed.`);
  }
  if (plan.unsupportedMetric) {
    warnings.unshift(`${plan.unsupportedMetric} is outside the dataset’s reliable metric catalog.`);
  }
  if (dataset.meta.simulated && plan.filters.some((filter) => filter.field === "year" && filter.values.includes(2024))) {
    warnings.push("2024 contains a higher share of medium-assumption and repair-generated business events than earlier years.");
  }
  return warnings;
}

function buildFollowUps(plan: QueryPlan): string[] {
  if (["net_revenue", "gross_revenue", "operating_result"].includes(plan.metric)) {
    return [
      "Show the top five countries by net revenue in 2024",
      "Which products generated the most revenue?",
      "Compare 2023 vs 2024 operating result",
    ];
  }
  if (["operating_costs", "supplier_payments"].includes(plan.metric)) {
    return [
      "Which expense categories were largest in 2024?",
      "Show supplier payments by month",
      "Which departments carry the most cost?",
    ];
  }
  if (["open_ar", "open_ap", "open_balance", "overdue_open"].includes(plan.metric)) {
    return [
      "Which customers have overdue open invoices?",
      "Break open payables down by supplier",
      "Show open AR and AP by aging bucket",
    ];
  }
  if (["reconciliation_gap", "mapping_coverage", "review_items", "data_quality"].includes(plan.metric)) {
    return [
      "What percentage of transactions need review?",
      "Show suspected duplicate transactions",
      "How did reconciliation quality change by month?",
    ];
  }
  return [
    "Show external cash inflow by month in 2024",
    "What are the largest operating costs?",
    "How much is still open or overdue?",
  ];
}

function metricMethod(
  metric: MetricId,
  sourceKind: SourceKind,
  includeInternalTransfers = false,
): string {
  const cashScope = includeInternalTransfers
    ? "internal transfers included as explicitly requested"
    : "internal transfers excluded by default";
  const methods: Partial<Record<MetricId, string>> = {
    net_revenue:
      "Unique business events · signed customer amounts · refunds included · financing, internal transfers and prior-period AR cash collections excluded.",
    gross_revenue:
      "Unique business events · positive customer amounts only · refunds, financing, internal transfers and prior-period AR cash collections excluded.",
    operating_costs:
      "Unique business events · absolute negative supplier amounts · internal transfers excluded.",
    operating_result:
      "Net revenue less supplier operating costs on unique business events. This is a dataset proxy, not GAAP net profit.",
    net_cash:
      `One counted row per bank transaction using bank_amount_for_reconciliation · ${cashScope}.`,
    cash_inflow:
      `Positive counted bank amounts · ${cashScope}.`,
    cash_outflow:
      `Absolute negative counted bank amounts · ${cashScope}.`,
    cash_balance:
      "Latest supplied running balance per bank account, carried forward through the requested closing date; all posted account activity is retained.",
    customer_collections:
      "Bank-linked allocation rows · positive customer allocation amounts · split bank transactions apportioned safely.",
    supplier_payments:
      "Bank-linked allocation rows · absolute negative supplier allocation amounts · split transactions apportioned safely.",
    reconciliation_gap:
      "Bank-linked business allocation amount less the safely counted bank amount. Unbanked unsettled business events are disclosed separately and are not mislabeled as reconciliation variance.",
    open_balance:
      "Recorded positive open amounts on unique business events, separated into customer AR and supplier AP.",
    open_ar: "Recorded positive open amounts on unique customer business events.",
    open_ap: "Recorded positive open amounts on unique supplier business events.",
    mapping_coverage: "Unique counted bank transactions with an allocation status other than UNMAPPED.",
    on_time_rate:
      "SETTLED_ON_TIME plus INSTANT_SETTLED divided by completed settlement statuses, cohort-filtered by actual settlement date.",
    settlement_lag:
      "Average supplied settlement-lag days across completed events, cohort-filtered by actual settlement date.",
    data_quality: "Unique counted bank transactions carrying the supplied data-quality flag.",
  };
  return methods[metric] ?? `${METRIC_LABELS[metric]} calculated from the ${sourceKind} fact view using EUR base amounts.`;
}

function sortAndLimit(data: ChartDatum[], plan: QueryPlan): ChartDatum[] {
  if (
    ["month", "quarter", "year"].includes(plan.dimension) &&
    plan.intent !== "ranking"
  ) {
    return data.sort((a, b) => String(a.rawLabel ?? a.label).localeCompare(String(b.rawLabel ?? b.label)));
  }
  const key = plan.countMode ? "value" : chartValueKey(plan.metric);
  const ranked = data
    .filter((item) => {
      if (plan.intent !== "ranking" || plan.sortDirection !== "asc") return true;
      return Math.abs(Number(item[key] ?? 0)) > 1e-12;
    })
    .sort((a, b) => {
      const aValue = Number(a[key] ?? 0);
      const bValue = Number(b[key] ?? 0);
      return plan.sortDirection === "asc" ? aValue - bValue : bValue - aValue;
    });
  return plan.showAll ? ranked : ranked.slice(0, plan.limit);
}

function chartValueKey(metric: MetricId): string {
  if (metric === "operating_result") return "result";
  if (metric === "net_cash") return "net";
  if (metric === "open_balance") return "total";
  if (metric === "reconciliation_gap") return "gap";
  return "value";
}

function metricBasis(metric: MetricId): Basis {
  if (["cash_inflow", "cash_outflow", "net_cash", "cash_balance", "customer_collections", "supplier_payments", "transactions"].includes(metric)) {
    return "cash";
  }
  if (["open_ar", "open_ap", "open_balance", "overdue_open"].includes(metric)) return "snapshot";
  if (["reconciliation_gap", "mapping_coverage", "review_items", "data_quality", "mapping_confidence"].includes(metric)) return "quality";
  if (["on_time_rate", "settlement_lag"].includes(metric)) return "settlement";
  return "accrual";
}

function metricFormat(metric: MetricId): "currency" | "number" | "percent" {
  if (["operating_margin", "mapping_coverage", "mapping_confidence", "on_time_rate"].includes(metric)) return "percent";
  if (["transactions", "review_items", "data_quality", "settlement_lag"].includes(metric)) return "number";
  return "currency";
}

function metricLabel(plan: QueryPlan): string {
  if (
    plan.includeInternalTransfers &&
    ["cash_inflow", "cash_outflow", "net_cash"].includes(plan.metric)
  ) {
    return metricDisplayLabel(plan);
  }
  return plan.language === "tr"
    ? TURKISH_METRIC_LABELS[plan.metric] ?? METRIC_LABELS[plan.metric]
    : METRIC_LABELS[plan.metric];
}

function detailAmount(row: FinanceRecord, metric: MetricId, sourceKind: SourceKind): number {
  if (["open_ar", "open_ap", "open_balance", "overdue_open"].includes(metric)) return row.openAmount;
  if (metric === "refunds") return Math.abs(Math.min(row.businessValue, 0));
  if (["net_revenue", "gross_revenue", "operating_result", "operating_costs", "operating_margin", "on_time_rate", "settlement_lag"].includes(metric)) return row.businessValue;
  if (metric === "reconciliation_gap") return row.businessAmount - row.bankAmount;
  return sourceKind === "allocation" ? row.businessAmount : row.bankAmount;
}

function rowDate(row: FinanceRecord, basis: Basis): string {
  if (basis === "cash" || basis === "quality") return row.transactionDate || row.period;
  if (basis === "settlement") return row.settlementDate;
  return row.businessDate || row.businessMonth || row.transactionDate;
}

function rowYear(row: FinanceRecord, basis: Basis): number {
  const date = rowDate(row, basis);
  const parsed = Number(date.slice(0, 4));
  return Number.isFinite(parsed) ? parsed : row.fiscalYear ?? 0;
}

function rowQuarter(row: FinanceRecord, basis: Basis): string {
  if ((basis === "accrual" || basis === "snapshot") && row.fiscalQuarter) {
    return row.fiscalQuarter;
  }
  const month = Number(rowDate(row, basis).slice(5, 7));
  return month ? `Q${Math.ceil(month / 3)}` : "Unspecified";
}

function isInternal(row: FinanceRecord): boolean {
  return (
    row.internalTransferCandidate ||
    row.counterpartyType === "INTERNAL" ||
    row.category === "Internal treasury movement"
  );
}

function isPriorPeriodCollection(row: FinanceRecord): boolean {
  return row.eventType === "Prior AR Collection" || row.category === "Prior period AR cash collection";
}

function completedSettlements(rows: FinanceRecord[]): FinanceRecord[] {
  const completed = new Set([
    "SETTLED_ON_TIME",
    "INSTANT_SETTLED",
    "SETTLED_LATE",
    "LATE_SETTLED",
    "REFUNDED",
  ]);
  return rows.filter((row) => completed.has(row.settlementStatus));
}

function uniqueTransactions(rows: FinanceRecord[]): FinanceRecord[] {
  const map = new Map<string, FinanceRecord>();
  for (const row of rows) {
    if (row.transactionId && !map.has(row.transactionId)) map.set(row.transactionId, row);
  }
  return [...map.values()];
}

function closingMovementBalance(rows: FinanceRecord[]): number {
  const latest = new Map<string, FinanceRecord>();
  for (const row of rows) {
    const key = row.bankAccountId || row.account;
    const existing = latest.get(key);
    const rowSequence = row.transactionSequence ?? Number.NEGATIVE_INFINITY;
    const existingSequence =
      existing?.transactionSequence ?? Number.NEGATIVE_INFINITY;
    if (
      !existing ||
      row.transactionDate > existing.transactionDate ||
      (row.transactionDate === existing.transactionDate &&
        (rowSequence > existingSequence ||
          (rowSequence === existingSequence && row.id > existing.id)))
    ) {
      latest.set(key, row);
    }
  }
  return sum([...latest.values()].map((row) => row.runningBalance ?? 0));
}

function canonicalCategory(value: string): string {
  const aliases: Record<string, string> = {
    "Revenue - SaaS Subscription": "SaaS Subscription Revenue",
    "Revenue - Implementation Services": "Implementation Service Revenue",
    "Revenue - AI Reconciliation": "AI Reconciliation / AI Classification Revenue",
    "Revenue - OCR Document Processing": "OCR / Document Processing Revenue",
    "AI API Token Cost": "AI API / Token Cost",
    "Data Storage Cost": "Data Storage / Monitoring Cost",
    "Professional Services Expense": "Professional Service",
  };
  return aliases[value] ?? value;
}

function displayDimension(value: string, dimension: DimensionId): string {
  if (dimension === "month" && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    return new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit" }).format(
      new Date(Date.UTC(year, month - 1, 1)),
    );
  }
  return humanize(value);
}

function humanize(value: string): string {
  if (!value) return "Unspecified";
  if (value === value.toUpperCase() && value.includes("_")) {
    return value
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  return value;
}

function kpi(
  label: string,
  value: number,
  format: "currency" | "number" | "percent",
  note: string,
  tone: Kpi["tone"],
): Kpi {
  return {
    label,
    value: format === "currency" ? formatCurrency(value) : format === "percent" ? formatPercent(value) : formatNumber(value),
    note,
    tone,
  };
}

export function formatCurrency(value: number, compact = true): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 2 : 2,
  }).format(value);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatByMetric(value: number, metric: MetricId): string {
  const format = metricFormat(metric);
  if (format === "percent") return formatPercent(value);
  if (format === "number") return formatNumber(value);
  return formatCurrency(value);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function hasAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(normalize(term)));
}

function detectLanguage(original: string, normalized: string): "en" | "tr" {
  return /[çğıöşüİ]/.test(original) || hasAny(normalized, ["gelir", "gider", "nakit", "musteri", "tedarikci", "gore", "ne kadar", "goster"])
    ? "tr"
    : "en";
}

function normalize(value: string): string {
  return value
    .replaceAll("İ", "I")
    .replaceAll("ı", "i")
    .replaceAll("ş", "s")
    .replaceAll("Ş", "S")
    .replaceAll("ğ", "g")
    .replaceAll("Ğ", "G")
    .replaceAll("ç", "c")
    .replaceAll("Ç", "C")
    .replaceAll("ö", "o")
    .replaceAll("Ö", "O")
    .replaceAll("ü", "u")
    .replaceAll("Ü", "U")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[?!,;:()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

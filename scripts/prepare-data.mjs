import fs from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";

const root = process.cwd();
const inputPath = path.join(
  root,
  "keeya_europe_bank_business_master_table(4).csv",
);
const outputPath = path.join(root, "public", "data", "keeya-finance.json");

const csv = await fs.readFile(inputPath, "utf8");
const parsed = Papa.parse(csv, {
  header: true,
  skipEmptyLines: "greedy",
  transformHeader: (header) => header.trim(),
});

if (parsed.errors.length > 0) {
  const fatal = parsed.errors.filter((error) => error.type !== "FieldMismatch");
  if (fatal.length > 0) {
    throw new Error(`CSV parse failed: ${JSON.stringify(fatal.slice(0, 5))}`);
  }
}

const asNumber = (value) => {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const asBoolean = (value) => String(value).toUpperCase() === "TRUE";
const text = (value) => (value == null ? "" : String(value).trim());

const records = parsed.data.map((raw) => ({
  id: text(raw.row_id),
  rowType: text(raw.combined_row_type),
  period: text(raw.source_model_period),
  transactionId: text(raw.bank_transaction_id),
  bankAccountId: text(raw.bank_account_id),
  account: text(raw.bank_account_name),
  transactionDate: text(raw.transaction_date),
  direction: text(raw.direction),
  bankAmount: asNumber(raw.bank_amount_for_reconciliation) ?? 0,
  bankAmountOriginal: asNumber(raw.bank_amount_original) ?? 0,
  bankCurrency: text(raw.bank_currency),
  bankCounted: asBoolean(raw.bank_amount_counting_flag),
  runningBalance: asNumber(raw.running_balance_base),
  transactionSequence: asNumber(raw.transaction_sequence),
  counterpartyRaw: text(raw.counterparty_raw_name),
  description: text(raw.transaction_description_raw),
  reference: text(raw.bank_reference),
  paymentMethod: text(raw.payment_method),
  bankChannel: text(raw.bank_channel),
  countryHint: text(raw.country_hint),
  merchantHint: text(raw.merchant_category_hint),
  split: asBoolean(raw.is_split_mapping),
  duplicateCandidate: asBoolean(raw.is_duplicate_candidate),
  reversalCandidate: asBoolean(raw.is_reversal_candidate),
  internalTransferCandidate: asBoolean(raw.is_internal_transfer_candidate),
  dataQualityFlag: asBoolean(raw.data_quality_issue_flag),
  dataQualityType: text(raw.data_quality_issue_type),
  mappingType: text(raw.mapping_type),
  businessAmount: asNumber(raw.business_allocated_amount_for_reconciliation) ?? 0,
  allocatedAmount: asNumber(raw.allocated_amount_base) ?? 0,
  allocationRatio: asNumber(raw.allocation_ratio),
  mappingConfidence: asNumber(raw.mapping_confidence_truth),
  allocationStatus: text(raw.allocation_status),
  mappingExplanation: text(raw.mapping_explanation),
  businessEventId: text(raw.business_event_id),
  businessDate: text(raw.business_event_date),
  businessMonth: text(raw.business_event_month),
  fiscalYear: asNumber(raw.fiscal_year),
  fiscalQuarter: text(raw.fiscal_quarter),
  region: text(raw.region),
  country: text(raw.business_country),
  customerId: text(raw.customer_id),
  customer: text(raw.customer_name),
  supplierId: text(raw.supplier_id),
  supplier: text(raw.supplier_name),
  counterparty: text(raw.counterparty_standard_name),
  counterpartyType: text(raw.counterparty_type),
  eventType: text(raw.business_event_type),
  category: text(raw.revenue_or_cost_category),
  product: text(raw.product_or_service),
  department: text(raw.department),
  costCenter: text(raw.cost_center),
  project: text(raw.project),
  salesChannel: text(raw.sales_channel),
  contractId: text(raw.contract_id),
  invoiceNumber: text(raw.invoice_number),
  invoiceAmount: asNumber(raw.invoice_amount_original),
  businessCurrency: text(raw.business_currency),
  businessValue: asNumber(raw.business_base_currency_amount) ?? 0,
  paymentTermsDays: asNumber(raw.payment_terms_days),
  dueDate: text(raw.due_date),
  settlementDate: text(raw.actual_settlement_date),
  settlementStatus: text(raw.settlement_status),
  settlementLagDays: asNumber(raw.settlement_lag_days),
  agingBucket: text(raw.aging_bucket),
  openAmount: asNumber(raw.open_amount_base) ?? 0,
  overdue: asBoolean(raw.overdue_flag),
  refundOrReversal: asBoolean(raw.refund_or_reversal_flag),
  platformPayout: asBoolean(raw.platform_payout_related_flag),
  assumptionLevel: text(raw.assumption_level),
  customerType: text(raw.customer_type),
  duplicateGroup: text(raw.duplicate_candidate_group),
}));

const sum = (values) =>
  Math.round(values.reduce((total, value) => total + value, 0) * 100) / 100;
const unique = (field) =>
  [...new Set(records.map((record) => record[field]).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b)),
  );

const countedBank = records.filter((record) => record.bankCounted);
const confidenceValues = records
  .map((record) => record.mappingConfidence)
  .filter((value) => value != null);
const statusCounts = records.reduce((counts, record) => {
  const key = record.allocationStatus || "UNKNOWN";
  counts[key] = (counts[key] ?? 0) + 1;
  return counts;
}, {});
const uniqueBankTransactions = new Set(
  records.map((record) => record.transactionId).filter(Boolean),
);
const uniqueBusinessEvents = new Set(
  records.map((record) => record.businessEventId).filter(Boolean),
);

const dates = records.map((record) => record.transactionDate).filter(Boolean).sort();
const bankNet = sum(countedBank.map((record) => record.bankAmount));
const businessNet = sum(records.map((record) => record.businessAmount));

const payload = {
  meta: {
    generatedAt: new Date().toISOString(),
    asOf: "2024-12-31",
    simulated: true,
    sourceFile: path.basename(inputPath),
    sourceLabel: "Keeya Europe bank-business master table",
    currency: "EUR",
    rowCount: records.length,
    sourceColumnCount: parsed.meta.fields?.length ?? 0,
    dateStart: dates[0] ?? null,
    dateEnd: dates.at(-1) ?? null,
    periodCount: unique("period").length,
    uniqueBankTransactions: uniqueBankTransactions.size,
    uniqueBusinessEvents: uniqueBusinessEvents.size,
    bankNet,
    bankInflow: sum(
      countedBank.filter((record) => record.bankAmount > 0).map((record) => record.bankAmount),
    ),
    bankOutflow: Math.abs(
      sum(countedBank.filter((record) => record.bankAmount < 0).map((record) => record.bankAmount)),
    ),
    businessNet,
    reconciliationDifference: Math.round((businessNet - bankNet) * 100) / 100,
    openAmount: sum(records.map((record) => record.openAmount)),
    overdueOpenAmount: sum(
      records.filter((record) => record.overdue).map((record) => record.openAmount),
    ),
    averageMappingConfidence:
      confidenceValues.length > 0
        ? confidenceValues.reduce((total, value) => total + value, 0) /
          confidenceValues.length
        : null,
    dataQualityIssueRows: records.filter((record) => record.dataQualityFlag).length,
    duplicateCandidateRows: records.filter((record) => record.duplicateCandidate).length,
    statusCounts,
  },
  dimensions: {
    periods: unique("period"),
    regions: unique("region"),
    countries: unique("country"),
    customers: unique("customer"),
    suppliers: unique("supplier"),
    counterparties: unique("counterparty"),
    eventTypes: unique("eventType"),
    categories: unique("category"),
    products: unique("product"),
    departments: unique("department"),
    projects: unique("project"),
    salesChannels: unique("salesChannel"),
    allocationStatuses: unique("allocationStatus"),
    settlementStatuses: unique("settlementStatus"),
    agingBuckets: unique("agingBucket"),
    paymentMethods: unique("paymentMethod"),
    accounts: unique("account"),
  },
  records,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(payload));

console.log(
  JSON.stringify(
    {
      outputPath,
      records: records.length,
      sourceColumns: payload.meta.sourceColumnCount,
      bytes: Buffer.byteLength(JSON.stringify(payload)),
      meta: payload.meta,
    },
    null,
    2,
  ),
);

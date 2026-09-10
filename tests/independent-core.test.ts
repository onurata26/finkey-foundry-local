import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeQuestion,
  buildFactStore,
  type FinanceRecord,
} from "../app/lib/analytics.ts";
import {
  booleanValue,
  countedBankRows,
  externalBankRows,
  independentAnchors,
  monthlyExternalCash,
  nullableNumber,
  numberValue,
  parsedCsv,
  rawRows,
  snapshot,
  sum,
  transactionGroups,
  uniqueBusinessRows,
} from "./support/independent-ground-truth.ts";

const facts = buildFactStore(snapshot);

function assertClose(
  actual: number,
  expected: number,
  message: string,
  tolerance = 0.01,
) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function chartTotal(
  result: ReturnType<typeof analyzeQuestion>,
  key: string,
): number {
  return sum(result.chartData.map((datum) => Number(datum[key] ?? 0)));
}

test("raw CSV parses cleanly at the documented shape", () => {
  assert.deepEqual(parsedCsv.errors, []);
  assert.equal(parsedCsv.meta.fields?.length, 103);
  assert.equal(rawRows.length, 2_811);
  assert.equal(transactionGroups.size, 2_374);
  assert.equal(uniqueBusinessRows.length, 2_776);
  assert.equal(new Set(rawRows.map((row) => row.row_id)).size, rawRows.length);
  assert.equal(new Set(rawRows.map((row) => row.mapping_id)).size, rawRows.length);
  assert.ok(rawRows.every((row) => row.row_id && row.mapping_id));
  const rowTypes = Object.fromEntries(
    [...new Set(rawRows.map((row) => row.combined_row_type))].map((rowType) => [
      rowType,
      rawRows.filter((row) => row.combined_row_type === rowType).length,
    ]),
  );
  assert.deepEqual(rowTypes, {
    BANK_TO_BUSINESS: 2_732,
    BUSINESS_UNSETTLED_NO_BANK_TXN: 76,
    BANK_UNMAPPED: 3,
  });
});

test("each bank transaction is counted exactly once", () => {
  for (const [transactionId, rows] of transactionGroups) {
    assert.equal(
      rows.filter((row) => booleanValue(row.bank_amount_counting_flag)).length,
      1,
      `${transactionId} must have exactly one counted bank row`,
    );
  }
  assert.equal(countedBankRows.length, transactionGroups.size);
});

test("all split allocations preserve ratio and value", () => {
  const splitGroups = [...transactionGroups.entries()].filter(([, rows]) =>
    rows.some((row) => booleanValue(row.is_split_mapping)),
  );
  assert.equal(splitGroups.length, 160);

  for (const [transactionId, rows] of splitGroups) {
    const ratio = sum(rows.map((row) => numberValue(row.allocation_ratio)));
    const countedBank = sum(
      rows.map((row) => numberValue(row.bank_amount_for_reconciliation)),
    );
    const allocated = sum(rows.map((row) => numberValue(row.allocated_amount_base)));
    const businessAllocated = sum(
      rows.map((row) =>
        numberValue(row.business_allocated_amount_for_reconciliation),
      ),
    );
    assertClose(ratio, 1, `${transactionId} allocation ratio`, 0.000_001_1);
    assertClose(allocated, countedBank, `${transactionId} allocated amount`);
    assertClose(
      businessAllocated,
      countedBank,
      `${transactionId} business allocation amount`,
    );
  }
});

test("duplicate business-event rows agree on the financial facts", () => {
  const groups = new Map<string, typeof rawRows>();
  for (const row of rawRows) {
    if (!row.business_event_id) continue;
    const rows = groups.get(row.business_event_id) ?? [];
    rows.push(row);
    groups.set(row.business_event_id, rows);
  }
  const duplicates = [...groups.entries()].filter(([, rows]) => rows.length > 1);
  assert.equal(duplicates.length, 32);

  const fields = [
    "business_event_date",
    "business_country",
    "customer_id",
    "supplier_id",
    "counterparty_type",
    "revenue_or_cost_category",
    "business_base_currency_amount",
    "settlement_status",
    "open_amount_base",
  ];
  for (const [eventId, rows] of duplicates) {
    for (const field of fields) {
      assert.equal(
        new Set(rows.map((row) => row[field])).size,
        1,
        `${eventId} disagrees on ${field}`,
      );
    }
  }
});

test("the generated JSON preserves all 72 mapped raw fields on every row", () => {
  const byId = new Map(snapshot.records.map((row) => [row.id, row]));
  assert.equal(byId.size, rawRows.length);

  type FieldKind = "text" | "zero" | "nullable" | "boolean";
  const fields: Array<[keyof FinanceRecord, string, FieldKind]> = [
    ["id", "row_id", "text"],
    ["rowType", "combined_row_type", "text"],
    ["period", "source_model_period", "text"],
    ["transactionId", "bank_transaction_id", "text"],
    ["bankAccountId", "bank_account_id", "text"],
    ["account", "bank_account_name", "text"],
    ["transactionDate", "transaction_date", "text"],
    ["transactionSequence", "transaction_sequence", "nullable"],
    ["direction", "direction", "text"],
    ["bankAmount", "bank_amount_for_reconciliation", "zero"],
    ["bankAmountOriginal", "bank_amount_original", "zero"],
    ["bankCurrency", "bank_currency", "text"],
    ["bankCounted", "bank_amount_counting_flag", "boolean"],
    ["runningBalance", "running_balance_base", "nullable"],
    ["counterpartyRaw", "counterparty_raw_name", "text"],
    ["description", "transaction_description_raw", "text"],
    ["reference", "bank_reference", "text"],
    ["paymentMethod", "payment_method", "text"],
    ["bankChannel", "bank_channel", "text"],
    ["countryHint", "country_hint", "text"],
    ["merchantHint", "merchant_category_hint", "text"],
    ["split", "is_split_mapping", "boolean"],
    ["duplicateCandidate", "is_duplicate_candidate", "boolean"],
    ["reversalCandidate", "is_reversal_candidate", "boolean"],
    ["internalTransferCandidate", "is_internal_transfer_candidate", "boolean"],
    ["dataQualityFlag", "data_quality_issue_flag", "boolean"],
    ["dataQualityType", "data_quality_issue_type", "text"],
    ["mappingType", "mapping_type", "text"],
    ["businessAmount", "business_allocated_amount_for_reconciliation", "zero"],
    ["allocatedAmount", "allocated_amount_base", "zero"],
    ["allocationRatio", "allocation_ratio", "nullable"],
    ["mappingConfidence", "mapping_confidence_truth", "nullable"],
    ["allocationStatus", "allocation_status", "text"],
    ["mappingExplanation", "mapping_explanation", "text"],
    ["businessEventId", "business_event_id", "text"],
    ["businessDate", "business_event_date", "text"],
    ["businessMonth", "business_event_month", "text"],
    ["fiscalYear", "fiscal_year", "nullable"],
    ["fiscalQuarter", "fiscal_quarter", "text"],
    ["region", "region", "text"],
    ["country", "business_country", "text"],
    ["customerId", "customer_id", "text"],
    ["customer", "customer_name", "text"],
    ["supplierId", "supplier_id", "text"],
    ["supplier", "supplier_name", "text"],
    ["counterparty", "counterparty_standard_name", "text"],
    ["counterpartyType", "counterparty_type", "text"],
    ["eventType", "business_event_type", "text"],
    ["category", "revenue_or_cost_category", "text"],
    ["product", "product_or_service", "text"],
    ["department", "department", "text"],
    ["costCenter", "cost_center", "text"],
    ["project", "project", "text"],
    ["salesChannel", "sales_channel", "text"],
    ["contractId", "contract_id", "text"],
    ["invoiceNumber", "invoice_number", "text"],
    ["invoiceAmount", "invoice_amount_original", "nullable"],
    ["businessCurrency", "business_currency", "text"],
    ["businessValue", "business_base_currency_amount", "zero"],
    ["paymentTermsDays", "payment_terms_days", "nullable"],
    ["dueDate", "due_date", "text"],
    ["settlementDate", "actual_settlement_date", "text"],
    ["settlementStatus", "settlement_status", "text"],
    ["settlementLagDays", "settlement_lag_days", "nullable"],
    ["agingBucket", "aging_bucket", "text"],
    ["openAmount", "open_amount_base", "zero"],
    ["overdue", "overdue_flag", "boolean"],
    ["refundOrReversal", "refund_or_reversal_flag", "boolean"],
    ["platformPayout", "platform_payout_related_flag", "boolean"],
    ["assumptionLevel", "assumption_level", "text"],
    ["customerType", "customer_type", "text"],
    ["duplicateGroup", "duplicate_candidate_group", "text"],
  ];
  assert.equal(fields.length, 72);

  for (const raw of rawRows) {
    const record = byId.get(raw.row_id);
    assert.ok(record, `missing generated record ${raw.row_id}`);
    for (const [recordField, rawField, kind] of fields) {
      const expected =
        kind === "text"
          ? String(raw[rawField] ?? "").trim()
          : kind === "boolean"
            ? booleanValue(raw[rawField])
            : kind === "nullable"
              ? nullableNumber(raw[rawField])
              : numberValue(raw[rawField]);
      assert.equal(
        record[recordField],
        expected,
        `${raw.row_id} ${String(recordField)} <- ${rawField}`,
      );
    }
  }
});

test("bank-linked reconciliation, unmapped bank rows and unbanked events stay separate", () => {
  let linkedGap = 0;
  for (const rows of transactionGroups.values()) {
    linkedGap +=
      sum(
        rows.map((row) =>
          numberValue(row.business_allocated_amount_for_reconciliation),
        ),
      ) -
      sum(rows.map((row) => numberValue(row.bank_amount_for_reconciliation)));
  }
  const unsettledRows = rawRows.filter(
    (row) => row.combined_row_type === "BUSINESS_UNSETTLED_NO_BANK_TXN",
  );
  const unsettledNet = sum(
    unsettledRows.map((row) =>
      numberValue(row.business_allocated_amount_for_reconciliation),
    ),
  );
  const unmappedRows = rawRows.filter(
    (row) => row.combined_row_type === "BANK_UNMAPPED",
  );
  const unmappedSigned = sum(
    unmappedRows.map((row) => numberValue(row.bank_amount_for_reconciliation)),
  );

  assertClose(linkedGap, 0, "bank-linked allocation variance", 1e-7);
  assertClose(unsettledNet, 94_945.6, "unbanked unsettled business net");
  assertClose(unmappedSigned, -2_218.55, "unmapped bank amount");
  assertClose(
    snapshot.meta.reconciliationDifference,
    unsettledNet,
    "published difference is entirely unbanked business activity",
  );
});

test("published metadata independently reconciles to raw CSV", () => {
  const rawBankNet = sum(
    countedBankRows.map((row) => numberValue(row.bank_amount_for_reconciliation)),
  );
  const rawBusinessNet = sum(
    rawRows.map((row) =>
      numberValue(row.business_allocated_amount_for_reconciliation),
    ),
  );
  const statusCounts: Record<string, number> = {};
  for (const row of rawRows) {
    statusCounts[row.allocation_status] = (statusCounts[row.allocation_status] ?? 0) + 1;
  }

  assert.equal(snapshot.meta.rowCount, rawRows.length);
  assert.equal(snapshot.meta.uniqueBankTransactions, transactionGroups.size);
  assert.equal(snapshot.meta.uniqueBusinessEvents, uniqueBusinessRows.length);
  assertClose(snapshot.meta.bankNet, rawBankNet, "bank net");
  assertClose(snapshot.meta.businessNet, rawBusinessNet, "business net");
  assertClose(
    snapshot.meta.reconciliationDifference,
    rawBusinessNet - rawBankNet,
    "reconciliation difference",
  );
  assert.equal(
    snapshot.meta.dataQualityIssueRows,
    rawRows.filter((row) => booleanValue(row.data_quality_issue_flag)).length,
  );
  assert.equal(
    snapshot.meta.duplicateCandidateRows,
    rawRows.filter((row) => booleanValue(row.is_duplicate_candidate)).length,
  );
  assert.deepEqual(snapshot.meta.statusCounts, statusCounts);
});

test("2024 accrual answers match independent business-event calculations", () => {
  const revenue = analyzeQuestion("What was net revenue in 2024?", snapshot, facts);
  const grossRevenue = analyzeQuestion(
    "What was gross revenue in 2024?",
    snapshot,
    facts,
  );
  const costs = analyzeQuestion("What were operating costs in 2024?", snapshot, facts);
  const result = analyzeQuestion("What was operating result in 2024?", snapshot, facts);
  const refunds = analyzeQuestion("What were refunds in 2024?", snapshot, facts);

  assertClose(revenue.primaryValue, independentAnchors.revenue2024, "net revenue");
  assertClose(
    grossRevenue.primaryValue,
    independentAnchors.grossRevenue2024,
    "gross revenue",
  );
  assertClose(costs.primaryValue, independentAnchors.costs2024, "operating costs");
  assertClose(
    result.primaryValue,
    independentAnchors.revenue2024 - independentAnchors.costs2024,
    "operating result",
  );
  assertClose(refunds.primaryValue, independentAnchors.refunds2024, "refund amount");
  assertClose(chartTotal(revenue, "value"), independentAnchors.revenue2024, "revenue chart");
  assertClose(chartTotal(costs, "value"), independentAnchors.costs2024, "cost chart");
  assertClose(chartTotal(result, "result"), result.primaryValue, "result chart");
});

test("2024 cash answers and every monthly chart point match independent bank facts", () => {
  const inflow = analyzeQuestion(
    "Show external cash inflow by month in 2024",
    snapshot,
    facts,
  );
  const outflow = analyzeQuestion(
    "Show external cash outflow by month in 2024",
    snapshot,
    facts,
  );
  const net = analyzeQuestion(
    "Show external net cash by month in 2024",
    snapshot,
    facts,
  );
  const expected = monthlyExternalCash(2024);

  assertClose(inflow.primaryValue, independentAnchors.cashIn2024, "cash inflow");
  assertClose(outflow.primaryValue, independentAnchors.cashOut2024, "cash outflow");
  assertClose(
    net.primaryValue,
    independentAnchors.cashIn2024 - independentAnchors.cashOut2024,
    "net cash",
  );
  assert.equal(inflow.chartData.length, 12);
  assert.equal(outflow.chartData.length, 12);
  assert.equal(net.chartData.length, 12);

  for (const datum of net.chartData) {
    const row = expected.get(String(datum.rawLabel));
    assert.ok(row, `missing independent cash month ${datum.rawLabel}`);
    assertClose(Number(datum.inflow), row.inflow, `${datum.rawLabel} inflow`);
    assertClose(Number(datum.outflow), row.outflow, `${datum.rawLabel} outflow`);
    assertClose(Number(datum.net), row.net, `${datum.rawLabel} net`);
  }
});

test("open receivables and payables match independent snapshot facts", () => {
  const answer = analyzeQuestion(
    "What are our current open receivables and payables?",
    snapshot,
    facts,
  );
  assertClose(
    answer.primaryValue,
    independentAnchors.openAr + independentAnchors.openAp,
    "open balance",
  );
  assertClose(chartTotal(answer, "receivables"), independentAnchors.openAr, "open AR");
  assertClose(chartTotal(answer, "payables"), independentAnchors.openAp, "open AP");
});

test("quality rates use the independent bank-transaction denominator", () => {
  const mapped = countedBankRows.filter(
    (row) => row.allocation_status !== "UNMAPPED",
  ).length;
  const review = countedBankRows.filter(
    (row) => row.allocation_status === "REVIEW_NEEDED",
  ).length;
  const flagged = countedBankRows.filter((row) =>
    booleanValue(row.data_quality_issue_flag),
  ).length;
  const duplicates = countedBankRows.filter((row) =>
    booleanValue(row.is_duplicate_candidate),
  ).length;

  assert.deepEqual(
    { total: countedBankRows.length, mapped, review, flagged, duplicates },
    { total: 2_374, mapped: 2_371, review: 113, flagged: 252, duplicates: 8 },
  );
  const coverage = analyzeQuestion("What is mapping coverage?", snapshot, facts);
  assertClose(coverage.primaryValue, mapped / countedBankRows.length, "mapping coverage", 1e-12);
});

test("English and Turkish equivalents return the same deterministic values", () => {
  const pairs = [
    ["What was net revenue in 2024?", "2024 net geliri ne kadardı?"],
    ["What were operating costs in 2024?", "2024 faaliyet giderleri ne kadardı?"],
    ["Show external cash inflow by month in 2024", "2024 aylık dış nakit girişini göster"],
  ];

  for (const [english, turkish] of pairs) {
    const left = analyzeQuestion(english, snapshot, facts);
    const right = analyzeQuestion(turkish, snapshot, facts);
    assert.equal(right.plan.metric, left.plan.metric, `${turkish} metric`);
    assert.equal(right.plan.dimension, left.plan.dimension, `${turkish} dimension`);
    assertClose(right.primaryValue, left.primaryValue, `${turkish} value`, 1e-9);
    assert.deepEqual(right.chartData, left.chartData, `${turkish} chart`);
  }
});

test("supported charts contain finite values and chronological temporal labels", () => {
  const questions = [
    "Show net revenue by month",
    "Show operating result by quarter",
    "Show external net cash by month",
    "Show reconciliation gaps by month",
    "Show open receivables by aging bucket",
  ];

  for (const question of questions) {
    const answer = analyzeQuestion(question, snapshot, facts);
    assert.ok(answer.chartData.length > 0, `${question} needs chart data`);
    assert.ok(answer.chartSeries.length > 0, `${question} needs chart series`);
    for (const datum of answer.chartData) {
      for (const series of answer.chartSeries) {
        assert.ok(
          Number.isFinite(Number(datum[series.key])),
          `${question}: ${datum.rawLabel} ${series.key} must be finite`,
        );
      }
    }
    if (["month", "quarter", "year"].includes(answer.plan.dimension)) {
      const labels = answer.chartData.map((datum) => String(datum.rawLabel));
      assert.deepEqual(labels, [...labels].sort(), `${question} chronological order`);
    }
  }
});

test("internal transfers are excluded only when the question requests external cash", () => {
  const all2024 = countedBankRows.filter(
    (row) => row.transaction_date.startsWith("2024"),
  );
  const external2024 = externalBankRows(2024);
  assert.equal(all2024.length, 715);
  assert.equal(external2024.length, 689);

  const answer = analyzeQuestion(
    "How many external bank transactions were there in 2024?",
    snapshot,
    facts,
  );
  assert.equal(answer.primaryValue, external2024.length);
  assert.equal(answer.plan.includeInternalTransfers, false);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  analyzePlan,
  analyzeQuestion,
  buildFactStore,
  interpretQuestionRules,
  materializeAiPlan,
  type AiPlanCandidate,
  type AnalysisResult,
  type FinanceDataset,
  type FinanceRecord,
  type MetricId,
  type DimensionId,
} from "../app/lib/analytics.ts";

const DATA_PATH = new URL("../public/data/keeya-finance.json", import.meta.url);
const dataset = JSON.parse(readFileSync(DATA_PATH, "utf8")) as FinanceDataset;
const facts = buildFactStore(dataset);

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function assertClose(actual: number, expected: number, message: string, tolerance = 0.01) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

function isInternal(row: FinanceRecord) {
  return (
    row.internalTransferCandidate ||
    row.counterpartyType === "INTERNAL" ||
    row.category === "Internal treasury movement"
  );
}

function businessYear(row: FinanceRecord) {
  return Number((row.businessDate || row.businessMonth || row.transactionDate).slice(0, 4));
}

function cashYear(row: FinanceRecord) {
  return Number((row.transactionDate || row.period).slice(0, 4));
}

function netRevenue(rows: FinanceRecord[]) {
  return sum(
    rows.map((row) =>
      row.counterpartyType === "CUSTOMER" &&
      row.eventType !== "Prior AR Collection" &&
      row.category !== "Prior period AR cash collection"
        ? row.businessValue
        : 0,
    ),
  );
}

function operatingCosts(rows: FinanceRecord[]) {
  return Math.abs(
    sum(
      rows.map((row) =>
        row.counterpartyType === "SUPPLIER" && row.businessValue < 0
          ? row.businessValue
          : 0,
      ),
    ),
  );
}

function chartTotal(result: AnalysisResult, key: string) {
  return sum(result.chartData.map((datum) => Number(datum[key] ?? 0)));
}

function kpi(result: AnalysisResult, label: string) {
  const match = result.kpis.find((item) => item.label === label);
  assert.ok(match, `Missing KPI: ${label}`);
  return match;
}

function percentages(text: string) {
  return [...text.matchAll(/(-?[\d,.]+)%/g)].map((match) =>
    Number(match[1].replaceAll(",", "")),
  );
}

function aiCandidate(
  overrides: Partial<AiPlanCandidate> = {},
): AiPlanCandidate {
  return {
    status: "supported",
    language: "en",
    intent: "ranking",
    metric: "net_revenue",
    dimension: "country",
    years: [2024],
    quarter: null,
    month: null,
    filters: [],
    limit: 5,
    sortDirection: "desc",
    includeInternalTransfers: false,
    countMode: false,
    clarification: null,
    ...overrides,
  };
}

test("fact store preserves the source grains and published metadata anchors", () => {
  assert.equal(dataset.records.length, dataset.meta.rowCount);
  assert.equal(facts.raw.length, 2_811);
  assert.equal(facts.bank.length, 2_374);
  assert.equal(facts.business.length, 2_776);
  assert.equal(facts.bank.length, dataset.meta.uniqueBankTransactions);
  assert.equal(facts.business.length, dataset.meta.uniqueBusinessEvents);
  assert.equal(new Set(facts.bank.map((row) => row.transactionId)).size, facts.bank.length);
  assert.equal(
    new Set(facts.business.map((row) => row.businessEventId)).size,
    facts.business.length,
  );
  assert.equal(dataset.meta.asOf, "2024-12-31");
  assert.equal(dataset.meta.currency, "EUR");
});

test("representative English questions route correctly and use sane units", async (t) => {
  const cases: Array<{
    question: string;
    metric: MetricId;
    dimension: DimensionId;
    primaryFormat: AnalysisResult["primaryFormat"];
    headline: RegExp;
  }> = [
    {
      question: "Show the top five countries by net revenue in 2024",
      metric: "net_revenue",
      dimension: "country",
      primaryFormat: "currency",
      headline: /net revenue/i,
    },
    {
      question: "Which expense categories were largest in 2024?",
      metric: "operating_costs",
      dimension: "category",
      primaryFormat: "currency",
      headline: /operating costs/i,
    },
    {
      question: "What are our current open receivables and payables?",
      metric: "open_balance",
      dimension: "agingBucket",
      primaryFormat: "currency",
      headline: /open (?:ar|receivables)/i,
    },
    {
      question: "How much external cash came in each month during 2024?",
      metric: "cash_inflow",
      dimension: "month",
      primaryFormat: "currency",
      headline: /cash inflow/i,
    },
    {
      question: "What percentage of transactions are mapped or under review?",
      metric: "mapping_coverage",
      dimension: "allocationStatus",
      primaryFormat: "percent",
      headline: /mapping coverage/i,
    },
  ];

  for (const expectation of cases) {
    await t.test(expectation.question, () => {
      const result = analyzeQuestion(expectation.question, dataset, facts);

      assert.equal(result.plan.metric, expectation.metric);
      assert.equal(result.plan.dimension, expectation.dimension);
      assert.equal(result.primaryFormat, expectation.primaryFormat);
      assert.equal(result.plan.unsupportedMetric, undefined);
      assert.match(result.headline, expectation.headline);
      assert.doesNotMatch(result.headline, /operating result/i);
      assert.ok(Number.isFinite(result.primaryValue));
      assert.ok(result.chartData.length > 0, "supported answers need graphical evidence");
      assert.ok(result.chartSeries.length > 0, "supported answers need a chart series");
      assert.ok(result.insights.length > 0, "supported answers need at least one insight");
      assert.doesNotMatch(result.insights.join(" "), /NaN|Infinity/);
      assert.ok(result.evidence.sourceRows > 0);
      assert.equal(result.evidence.currency, "EUR base amounts");
      assert.equal(result.evidence.asOf, dataset.meta.asOf);

      if (expectation.primaryFormat === "currency") {
        assert.match(result.insights.join(" "), /€/);
        assert.ok(result.chartSeries.every((series) => series.format === "currency"));
      }

      if (expectation.metric === "mapping_coverage") {
        assert.equal(result.chartSeries[0]?.format, "number");
        for (const percentage of percentages(result.insights.join(" "))) {
          assert.ok(
            Math.abs(percentage) <= 100,
            `mapping insight exposes an impossible percentage: ${percentage}%`,
          );
        }
        assert.doesNotMatch(result.insights.join(" "), /225,?000%|11,?300%/);
      }
    });
  }
});

test("2024 net revenue and operating result reconcile to unique business events", () => {
  const rows2024 = facts.business.filter(
    (row) => !isInternal(row) && businessYear(row) === 2024,
  );
  const expectedRevenue = netRevenue(rows2024);
  const expectedCosts = operatingCosts(rows2024);
  const expectedResult = expectedRevenue - expectedCosts;

  assertClose(expectedRevenue, 20_072_032.89, "source-backed 2024 net revenue");
  assertClose(expectedCosts, 10_063_807.51, "source-backed 2024 operating costs");
  assertClose(expectedResult, 10_008_225.38, "source-backed 2024 operating result");

  const revenue = analyzeQuestion("What was net revenue in 2024?", dataset, facts);
  assert.equal(revenue.plan.metric, "net_revenue");
  assert.equal(revenue.evidence.factView, "unique business events");
  assert.equal(revenue.evidence.sourceRows, rows2024.length);
  assertClose(revenue.primaryValue, expectedRevenue, "revenue primary value");
  assertClose(chartTotal(revenue, "value"), expectedRevenue, "revenue chart total");
  assert.equal(kpi(revenue, "Net revenue").value, "€20.07M");

  const result = analyzeQuestion("What was operating result in 2024?", dataset, facts);
  assert.equal(result.plan.metric, "operating_result");
  assert.equal(result.evidence.factView, "unique business events");
  assert.equal(result.evidence.sourceRows, rows2024.length);
  assertClose(result.primaryValue, expectedResult, "operating-result primary value");
  assert.equal(result.chartData.length, 1);
  assertClose(chartTotal(result, "revenue"), expectedRevenue, "result chart revenue");
  assertClose(chartTotal(result, "costs"), expectedCosts, "result chart costs");
  assertClose(chartTotal(result, "result"), expectedResult, "result chart result");
  assert.equal(kpi(result, "Operating result").value, "€10.01M");
  assert.equal(kpi(result, "Margin proxy").value, "49.9%");

  const comparison = analyzeQuestion(
    "Compare revenue and costs in 2024",
    dataset,
    facts,
  );
  assert.equal(comparison.plan.metric, "operating_result");
  assert.equal(comparison.plan.dimension, "year");
  assert.equal(comparison.chartType, "composed");
  assert.deepEqual(
    comparison.chartSeries.map((series) => series.key),
    ["revenue", "costs", "result"],
    "a combined comparison must not silently discard a requested series",
  );
  assertClose(chartTotal(comparison, "revenue"), expectedRevenue, "comparison revenue");
  assertClose(chartTotal(comparison, "costs"), expectedCosts, "comparison costs");
  assertClose(chartTotal(comparison, "result"), expectedResult, "comparison result");
});

test("open AR and AP reconcile independently and remain visibly separated", () => {
  const rows = facts.business.filter((row) => !isInternal(row));
  const expectedAr = sum(
    rows.map((row) =>
      row.counterpartyType === "CUSTOMER" ? Math.max(row.openAmount, 0) : 0,
    ),
  );
  const expectedAp = sum(
    rows.map((row) =>
      row.counterpartyType === "SUPPLIER" ? Math.max(row.openAmount, 0) : 0,
    ),
  );

  assertClose(expectedAr, 418_134.74, "source-backed open AR");
  assertClose(expectedAp, 328_593.14, "source-backed open AP");

  const result = analyzeQuestion(
    "What are our current open receivables and payables?",
    dataset,
    facts,
  );
  assert.equal(result.plan.metric, "open_balance");
  assertClose(result.primaryValue, expectedAr + expectedAp, "open-balance primary value");
  assertClose(chartTotal(result, "receivables"), expectedAr, "open-AR chart total");
  assertClose(chartTotal(result, "payables"), expectedAp, "open-AP chart total");
  assert.equal(kpi(result, "Open receivables").value, "€418.13K");
  assert.equal(kpi(result, "Open payables").value, "€328.59K");
  assert.match(result.summary, /€418\.13K.*€328\.59K/);
});

test("mapping coverage and review counts use bank-transaction grain", () => {
  const counts = new Map<string, number>();
  for (const row of facts.bank) {
    counts.set(row.allocationStatus, (counts.get(row.allocationStatus) ?? 0) + 1);
  }
  const mapped = facts.bank.filter((row) => row.allocationStatus !== "UNMAPPED").length;
  const expectedCoverage = mapped / facts.bank.length;

  assert.deepEqual(Object.fromEntries(counts), {
    REVIEW_NEEDED: 113,
    ALLOCATED: 2250,
    PARTIAL: 8,
    UNMAPPED: 3,
  });

  const coverage = analyzeQuestion(
    "What percentage of transactions are mapped or under review?",
    dataset,
    facts,
  );
  assertClose(coverage.primaryValue, expectedCoverage, "mapping coverage", 1e-12);
  assert.equal(coverage.evidence.sourceRows, facts.bank.length);
  assert.equal(chartTotal(coverage, "value"), facts.bank.length);
  assert.equal(kpi(coverage, "Mapping coverage").note, "2371 of 2374 bank transactions");

  const review = analyzeQuestion(
    "How many transactions require human review?",
    dataset,
    facts,
  );
  assert.equal(review.plan.metric, "review_items");
  assert.equal(review.primaryValue, 113);
  assert.equal(review.evidence.sourceRows, 113);
  assert.equal(chartTotal(review, "value"), 113);
  assert.equal(kpi(review, "Needs review").value, "113");
});

test("reconciliation keeps bank-linked variance separate from unbanked business activity", () => {
  const bankLinkedRows = facts.raw.filter((row) => row.transactionId);
  const unbankedRows = facts.raw.filter((row) => !row.transactionId);
  const expectedLinkedGap = sum(
    bankLinkedRows.map((row) => row.businessAmount - row.bankAmount),
  );
  const expectedUnbankedNet = sum(
    unbankedRows.map((row) => row.businessAmount - row.bankAmount),
  );
  assertClose(expectedLinkedGap, 0, "bank-linked allocation variance", 1e-7);
  assertClose(expectedUnbankedNet, dataset.meta.reconciliationDifference, "metadata gap");
  assertClose(expectedUnbankedNet, 94_945.6, "unbanked unsettled business net");

  const result = analyzeQuestion("Show reconciliation gaps by month", dataset, facts);
  assert.equal(result.plan.metric, "reconciliation_gap");
  assert.equal(result.plan.dimension, "month");
  assert.equal(result.evidence.factView, "bank-linked mapping / allocation rows");
  assert.equal(result.evidence.sourceRows, bankLinkedRows.length);
  assert.equal(result.chartData.length, dataset.meta.periodCount);
  assertClose(result.primaryValue, expectedLinkedGap, "gap primary value", 1e-7);
  assertClose(chartTotal(result, "gap"), expectedLinkedGap, "gap chart total", 1e-7);
  assert.match(
    [result.summary, result.method, ...result.warnings].join(" "),
    /76 unbanked unsettled business events/i,
  );
  for (const datum of result.chartData) {
    assertClose(
      Number(datum.business ?? 0) - Number(datum.bank ?? 0),
      Number(datum.gap ?? 0),
      `gap components for ${datum.rawLabel}`,
      1e-7,
    );
  }
});

test("suspected duplicates return the eight candidate transactions, not every quality flag", () => {
  const candidates = facts.bank.filter((row) => row.duplicateCandidate);
  assert.equal(candidates.length, dataset.meta.duplicateCandidateRows);
  assert.equal(candidates.length, 8);
  assert.ok(candidates.every((row) => row.dataQualityType === "POSSIBLE_DUPLICATE"));

  const result = analyzeQuestion("Show suspected duplicate transactions", dataset, facts);
  assert.equal(result.plan.metric, "data_quality");
  assert.equal(result.primaryFormat, "number");
  assert.equal(result.primaryValue, candidates.length);
  assert.equal(result.evidence.sourceRows, candidates.length);
  assert.equal(chartTotal(result, "value"), candidates.length);
  assert.deepEqual(
    new Set(result.details.map((row) => row.id)),
    new Set(candidates.map((row) => row.id)),
  );
});

test("overdue customer invoices exclude supplier payables from the customer ranking", () => {
  const overdueCustomers = facts.business.filter(
    (row) =>
      !isInternal(row) &&
      row.counterpartyType === "CUSTOMER" &&
      row.overdue &&
      row.openAmount > 0,
  );
  const expected = sum(overdueCustomers.map((row) => row.openAmount));
  assertClose(expected, 14_900, "source-backed overdue customer invoices");

  const result = analyzeQuestion(
    "Which customers have overdue open invoices?",
    dataset,
    facts,
  );
  assert.equal(result.plan.metric, "overdue_open");
  assert.equal(result.plan.dimension, "customer");
  assertClose(result.primaryValue, expected, "overdue-customer primary value");
  assertClose(chartTotal(result, "value"), expected, "overdue-customer chart total");
  assert.ok(result.chartData.every((datum) => datum.rawLabel !== "Unspecified"));
  assert.ok(result.details.every((detail) => detail.counterparty !== "Unspecified"));
});

test("Professional Service spend uses the canonical category without intersecting product", () => {
  const aliases = new Set(["Professional Service", "Professional Services Expense"]);
  const rows = facts.business.filter(
    (row) =>
      !isInternal(row) &&
      businessYear(row) === 2024 &&
      row.counterpartyType === "SUPPLIER" &&
      row.businessValue < 0 &&
      aliases.has(row.category),
  );
  const expected = Math.abs(sum(rows.map((row) => row.businessValue)));
  assertClose(expected, 1_045_531.13, "source-backed Professional Service spend");

  const result = analyzeQuestion(
    "What was Professional Service spend in 2024?",
    dataset,
    facts,
  );
  assert.equal(result.plan.metric, "operating_costs");
  assert.equal(result.plan.dimension, "year");
  assertClose(result.primaryValue, expected, "Professional Service primary value");
  assertClose(chartTotal(result, "value"), expected, "Professional Service chart total");
  assert.ok(
    result.plan.filters.some(
      (filter) =>
        filter.field === "category" &&
        filter.values.includes("Professional Service") &&
        filter.values.includes("Professional Services Expense"),
    ),
    "canonical category aliases should be visible in the query plan",
  );
  assert.ok(
    !result.plan.filters.some((filter) => filter.field === "product"),
    "a category phrase must not accidentally add a second product filter",
  );
});

test("unknown, unsupported and out-of-range questions produce no fallback calculation", async (t) => {
  const questions = [
    "Tell me a joke about invoices",
    "What is the current ratio?",
    "What is the average invoice amount in 2024?",
    "Show 2020 revenue",
    "Forecast 2025 cash flow",
  ];

  for (const question of questions) {
    await t.test(question, () => {
      const result = analyzeQuestion(question, dataset, facts);
      const exposedAnswer = [
        result.headline,
        result.summary,
        result.plan.interpretedAs,
        ...result.chartSeries.map((series) => series.label),
      ].join(" ");

      assert.ok(result.plan.unsupportedMetric, "unsupported topic must be named");
      assert.equal(result.plan.confidenceLabel, "Needs scope");
      assert.equal(result.plan.confidenceScore, 0.25);
      assert.equal(result.primaryValue, 0);
      assert.equal(result.primaryFormat, "number");
      assert.deepEqual(result.chartData, []);
      assert.deepEqual(result.chartSeries, []);
      assert.deepEqual(result.details, []);
      assert.doesNotMatch(exposedAnswer, /operating result/i);
      assert.match(result.headline, /needs (?:clarification|a different source)/i);
      assert.match(result.summary, /no calculation was produced/i);
      assert.ok(result.warnings.some((warning) => /outside|unsupported|cannot|need/i.test(warning)));
    });
  }
});

test("the visible monthly cash-in suggestion reconciles to counted external bank rows", () => {
  const bank2024 = facts.bank.filter(
    (row) => !isInternal(row) && cashYear(row) === 2024,
  );
  const expected = sum(bank2024.map((row) => Math.max(row.bankAmount, 0)));
  assertClose(expected, 20_824_534.06, "source-backed 2024 cash inflow");

  const result = analyzeQuestion(
    "How much external cash came in each month during 2024?",
    dataset,
    facts,
  );
  assert.equal(result.plan.metric, "cash_inflow");
  assert.equal(result.plan.dimension, "month");
  assert.equal(result.chartData.length, 12);
  assert.equal(
    result.evidence.sourceRows,
    bank2024.filter((row) => row.bankAmount > 0).length,
    "evidence row count should describe contributing inflow transactions",
  );
  assertClose(result.primaryValue, expected, "cash-in primary value");
  assertClose(chartTotal(result, "value"), expected, "cash-in chart total");
});

test("count wording returns record counts and respects explicit external scope", async (t) => {
  const business = facts.business.filter((row) => !isInternal(row));
  const refunds2024 = business.filter(
    (row) =>
      businessYear(row) === 2024 &&
      row.counterpartyType === "CUSTOMER" &&
      row.refundOrReversal,
  );
  const openInvoices = business.filter((row) => row.openAmount > 0);
  const unmapped = facts.bank.filter((row) => row.allocationStatus === "UNMAPPED");
  const bank2024 = facts.bank.filter((row) => cashYear(row) === 2024);
  const externalBank2024 = bank2024.filter((row) => !isInternal(row));

  assert.equal(refunds2024.length, 16);
  assert.equal(openInvoices.length, 108);
  assert.equal(unmapped.length, 3);
  assert.equal(bank2024.length, 715);
  assert.equal(externalBank2024.length, 689);
  assert.equal(bank2024.length - externalBank2024.length, 26);

  const cases = [
    {
      question: "How many refunds were there in 2024?",
      metric: "refunds" as const,
      expected: refunds2024.length,
      includeInternalTransfers: false,
    },
    {
      question: "How many open invoices are there?",
      metric: "open_balance" as const,
      expected: openInvoices.length,
      includeInternalTransfers: false,
    },
    {
      question: "How many unmapped transactions are there?",
      metric: "mapping_coverage" as const,
      expected: unmapped.length,
      includeInternalTransfers: false,
    },
    {
      question: "How many bank transactions were there in 2024?",
      metric: "transactions" as const,
      expected: bank2024.length,
      includeInternalTransfers: true,
    },
    {
      question: "How many external bank transactions were there in 2024?",
      metric: "transactions" as const,
      expected: externalBank2024.length,
      includeInternalTransfers: false,
    },
    {
      question: "How many bank transactions excluding internal transfers were there in 2024?",
      metric: "transactions" as const,
      expected: externalBank2024.length,
      includeInternalTransfers: false,
    },
  ];

  for (const expectation of cases) {
    await t.test(expectation.question, () => {
      const result = analyzeQuestion(expectation.question, dataset, facts);
      assert.equal(result.plan.metric, expectation.metric);
      assert.equal(result.plan.countMode, true);
      assert.equal(
        result.plan.includeInternalTransfers,
        expectation.includeInternalTransfers,
      );
      assert.equal(result.primaryFormat, "number");
      assert.equal(result.primaryValue, expectation.expected);
      assert.equal(result.evidence.sourceRows, expectation.expected);
      assert.equal(chartTotal(result, "value"), expectation.expected);
      assert.match(result.summary, /unique-record count, not an amount/i);
    });
  }
});

test("analyzePlan preserves the existing rule-based execution contract", () => {
  const question = "Show the top five countries by net revenue in 2024";
  const rulesPlan = interpretQuestionRules(question, dataset);
  assert.deepEqual(
    analyzePlan(question, rulesPlan, dataset, facts),
    analyzeQuestion(question, dataset, facts),
  );
});

test("a supported AI candidate materializes locally and executes deterministically", () => {
  const question = "Show the top five countries by top-line performance in 2024";
  const plan = materializeAiPlan(aiCandidate(), question, dataset);

  assert.equal(plan.metric, "net_revenue");
  assert.equal(plan.dimension, "country");
  assert.equal(plan.basis, "accrual");
  assert.equal(plan.periodLabel, "2024");
  assert.equal(plan.limit, 5);
  assert.equal(plan.confidenceScore, 0.92);
  assert.equal(plan.confidenceLabel, "High");
  assert.equal(plan.unsupportedMetric, undefined);
  assert.match(plan.interpretedAs, /Net revenue · accrual basis · by country/);
  assert.deepEqual(plan.filters, [
    { field: "year", label: "2024", values: [2024] },
  ]);

  const result = analyzePlan(question, plan, dataset, facts);
  assertClose(result.primaryValue, 20_072_032.89, "AI-plan revenue total");
  assert.equal(result.chartData.length, 5);
  assert.equal(result.chartData[0]?.rawLabel, "Germany");
  assert.equal(result.evidence.factView, "unique business events");
});

test("AI plans cannot contradict explicit metric, dimension, period, or cash scope", () => {
  const conflicts: Array<{ question: string; candidate: AiPlanCandidate }> = [
    {
      question: "What was net revenue in 2024?",
      candidate: aiCandidate({
        intent: "value",
        metric: "operating_costs",
        dimension: "year",
        years: [2024],
        limit: null,
      }),
    },
    {
      question: "What was net revenue in 2024?",
      candidate: aiCandidate({
        intent: "value",
        metric: "net_revenue",
        dimension: "year",
        years: [2023],
        limit: null,
      }),
    },
    {
      question: "Show net revenue by country in 2024",
      candidate: aiCandidate({
        metric: "net_revenue",
        dimension: "supplier",
        years: [2024],
        limit: null,
      }),
    },
    {
      question: "How much external cash came in during 2024?",
      candidate: aiCandidate({
        intent: "value",
        metric: "cash_inflow",
        dimension: "year",
        years: [2024],
        includeInternalTransfers: true,
        limit: null,
      }),
    },
    {
      question: "What was net revenue in 2024?",
      candidate: aiCandidate({
        intent: "value",
        metric: "net_revenue",
        dimension: "year",
        years: [2024],
        filters: [{ field: "country", value: "Germany" }],
        limit: null,
      }),
    },
    {
      question: "What was net revenue?",
      candidate: aiCandidate({
        intent: "value",
        metric: "net_revenue",
        dimension: "year",
        years: [2024],
        limit: null,
      }),
    },
  ];

  for (const { question, candidate } of conflicts) {
    assert.throws(
      () => materializeAiPlan(candidate, question, dataset),
      /conflicts with the explicit question/i,
      question,
    );
  }
});

test("AI ranking controls cannot override an explicitly resolved deterministic question", () => {
  const question = "What was net revenue in 2024?";
  const rules = interpretQuestionRules(question, dataset);
  const plan = materializeAiPlan(
    aiCandidate({
      intent: "ranking",
      metric: "net_revenue",
      dimension: "country",
      years: [2024],
      limit: 1,
      sortDirection: "asc",
    }),
    question,
    dataset,
  );

  assert.equal(plan.metric, rules.metric);
  assert.equal(plan.dimension, rules.dimension);
  assert.equal(plan.intent, rules.intent);
  assert.equal(plan.limit, rules.limit);
  assert.equal(plan.sortDirection, rules.sortDirection);
});

test("AI filters resolve only against local dimensions and retain canonical aliases", () => {
  const professionalServices = materializeAiPlan(
    aiCandidate({
      intent: "value",
      metric: "operating_costs",
      dimension: "year",
      filters: [{ field: "category", value: "professional services" }],
      limit: null,
    }),
    "Professional services spend in 2024",
    dataset,
  );
  const categoryFilter = professionalServices.filters.find(
    (filter) => filter.field === "category",
  );
  assert.ok(categoryFilter);
  assert.equal(categoryFilter.label, "Professional Service");
  assert.deepEqual(new Set(categoryFilter.values), new Set([
    "Professional Service",
    "Professional Services Expense",
  ]));
  const professionalResult = analyzePlan(
    "Professional services spend in 2024",
    professionalServices,
    dataset,
    facts,
  );
  assertClose(
    professionalResult.primaryValue,
    1_045_531.13,
    "canonical Professional Service spend",
  );

  const netherlands = materializeAiPlan(
    aiCandidate({
      filters: [{ field: "country", value: "Netherland" }],
      limit: null,
    }),
    "Revenue in Netherland in 2024",
    dataset,
  );
  assert.deepEqual(
    netherlands.filters.find((filter) => filter.field === "country")?.values,
    ["Netherlands"],
  );

  const duplicateType = materializeAiPlan(
    aiCandidate({
      metric: "data_quality",
      dimension: "dataQualityType",
      filters: [{ field: "dataQualityType", value: "possible duplicate" }],
      years: [],
    }),
    "Show possible duplicate quality exceptions",
    dataset,
  );
  assert.deepEqual(
    duplicateType.filters.find(
      (filter) => filter.field === "dataQualityType",
    )?.values,
    ["POSSIBLE_DUPLICATE"],
  );
});

test("AI plans derive basis and cash-compatible metrics locally", () => {
  const plan = materializeAiPlan(
    aiCandidate({
      metric: "net_revenue",
      dimension: "account",
      filters: [],
      limit: null,
    }),
    "Revenue collections by bank account in 2024",
    dataset,
  );
  assert.equal(plan.metric, "customer_collections");
  assert.equal(plan.basis, "cash");
  assert.match(plan.interpretedAs, /Customer cash collections · cash basis · by bank account/);
});

test("clarification, unsupported and hard-guarded questions never calculate a substitute", async (t) => {
  const cases: Array<{
    name: string;
    question: string;
    candidate: AiPlanCandidate;
    topic: RegExp;
  }> = [
    {
      name: "AI requests clarification",
      question: "Please analyze liquidity",
      candidate: aiCandidate({
        status: "clarify",
        metric: null,
        dimension: null,
        years: [],
        limit: null,
        clarification: "Which liquidity measure should be used?",
      }),
      topic: /requested question/i,
    },
    {
      name: "AI marks a measure unsupported",
      question: "Calculate a custom solvency score",
      candidate: aiCandidate({
        status: "unsupported",
        metric: null,
        dimension: null,
        years: [],
        limit: null,
        clarification: "The solvency formula is unavailable.",
      }),
      topic: /requested measure/i,
    },
    {
      name: "rules retain the current-ratio hard guard",
      question: "What is the current ratio?",
      candidate: aiCandidate({
        status: "supported",
        metric: "operating_result",
        dimension: "year",
        years: [],
        limit: null,
      }),
      topic: /current ratio/i,
    },
    {
      name: "rules retain the forecast hard guard",
      question: "Forecast 2025 cash flow",
      candidate: aiCandidate({
        status: "supported",
        metric: "net_cash",
        dimension: "year",
        years: [2024],
        limit: null,
      }),
      topic: /forecast|future/i,
    },
  ];

  for (const expectation of cases) {
    await t.test(expectation.name, () => {
      const plan = materializeAiPlan(
        expectation.candidate,
        expectation.question,
        dataset,
      );
      assert.ok(plan.unsupportedMetric);
      assert.match(plan.unsupportedMetric, expectation.topic);
      assert.equal(plan.confidenceScore, 0.25);
      assert.equal(plan.confidenceLabel, "Needs scope");
      assert.equal(plan.interpretedAs, "Unsupported request · no calculation run");
      const result = analyzePlan(expectation.question, plan, dataset, facts);
      assert.equal(result.primaryValue, 0);
      assert.equal(result.primaryFormat, "number");
      assert.doesNotMatch(
        `${result.headline} ${result.summary}`,
        /operating result/i,
      );
      assert.deepEqual(result.chartData, []);
      assert.deepEqual(result.chartSeries, []);
      assert.deepEqual(result.details, []);
    });
  }
});

test("materializeAiPlan rejects invalid or unresolvable candidates", async (t) => {
  const invalidCases: Array<{
    name: string;
    candidate: AiPlanCandidate;
    expected: RegExp;
  }> = [
    {
      name: "unknown metric",
      candidate: { ...aiCandidate(), metric: "invented_metric" } as unknown as AiPlanCandidate,
      expected: /invalid ai metric/i,
    },
    {
      name: "unknown dimension",
      candidate: { ...aiCandidate(), dimension: "ledger" } as unknown as AiPlanCandidate,
      expected: /invalid ai dimension/i,
    },
    {
      name: "year outside the dataset",
      candidate: aiCandidate({ years: [2025] }),
      expected: /outside the observed 2021–2024 range/i,
    },
    {
      name: "ranking limit above the chart cap",
      candidate: aiCandidate({ limit: 13 }),
      expected: /limit must be an integer from 1 to 12/i,
    },
    {
      name: "month is not zero padded",
      candidate: aiCandidate({ month: "1" }),
      expected: /zero-padded value from 01 to 12/i,
    },
    {
      name: "numeric month is rejected",
      candidate: { ...aiCandidate(), month: 10 } as unknown as AiPlanCandidate,
      expected: /zero-padded value from 01 to 12/i,
    },
    {
      name: "quarter is invalid",
      candidate: { ...aiCandidate(), quarter: "Q5" } as unknown as AiPlanCandidate,
      expected: /invalid ai quarter/i,
    },
    {
      name: "month and quarter conflict",
      candidate: aiCandidate({ month: "04", quarter: "Q1" }),
      expected: /does not belong to Q1/i,
    },
    {
      name: "filter value is absent locally",
      candidate: aiCandidate({ filters: [{ field: "country", value: "Atlantis" }] }),
      expected: /does not match the local dataset/i,
    },
    {
      name: "filter value is ambiguous locally",
      candidate: aiCandidate({ filters: [{ field: "category", value: "service" }] }),
      expected: /ambiguous in the local dataset/i,
    },
    {
      name: "amount metric cannot be relabeled as a count",
      candidate: aiCandidate({ countMode: true }),
      expected: /does not support unique-record count mode/i,
    },
    {
      name: "supported plan cannot also clarify",
      candidate: aiCandidate({ clarification: "Maybe revenue?" }),
      expected: /cannot also request clarification/i,
    },
    {
      name: "supported plan requires a metric",
      candidate: aiCandidate({ metric: null }),
      expected: /requires both metric and dimension/i,
    },
    {
      name: "unexpected keys are rejected",
      candidate: { ...aiCandidate(), formula: "sum(anything)" } as unknown as AiPlanCandidate,
      expected: /keys are invalid.*extra: formula/i,
    },
  ];

  for (const invalid of invalidCases) {
    await t.test(invalid.name, () => {
      assert.throws(
        () => materializeAiPlan(invalid.candidate, "Test question", dataset),
        invalid.expected,
      );
    });
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeQuestion,
  buildFactStore,
  formatCurrency,
} from "../app/lib/analytics.ts";
import {
  countedBankRows,
  snapshot,
} from "./support/independent-ground-truth.ts";

const facts = buildFactStore(snapshot);

function expectUnsupported(question: string) {
  const answer = analyzeQuestion(question, snapshot, facts);
  assert.ok(
    answer.plan.unsupportedMetric,
    `${question} must clarify instead of silently answering a different question`,
  );
  assert.deepEqual(answer.chartData, []);
  assert.equal(answer.primaryValue, 0);
}

function assertClose(actual: number, expected: number, message: string, tolerance = 0.01) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${message}: expected ${expected}, received ${actual}`,
  );
}

test("mixed count-and-rate wording keeps the full visible denominator", () => {
  const answer = analyzeQuestion(
    "What count and percentage of transactions need review?",
    snapshot,
    facts,
  );
  const numerator = countedBankRows.filter(
    (row) => row.allocation_status === "REVIEW_NEEDED",
  ).length;

  assert.equal(answer.plan.countMode, false);
  assert.equal(answer.primaryFormat, "percent");
  assertClose(
    answer.primaryValue,
    numerator / countedBankRows.length,
    "review rate",
    1e-12,
  );
  assert.equal(
    Number(answer.chartData.find((datum) => datum.rawLabel === "review")?.value),
    numerator,
  );
  assert.equal(
    answer.chartData.reduce((total, datum) => total + Number(datum.value ?? 0), 0),
    countedBankRows.length,
  );
});

test("allocation-cohort rate variants never revert to the all-transaction denominator", () => {
  for (const question of [
    "Of allocated transactions, what percent need review?",
    "Of the mapped transactions, what percentage need review?",
    "Within fully allocated transactions, what percentage need review?",
  ]) {
    expectUnsupported(question);
  }
});

test("ranked temporal bars are not narrated as adjacent chronology", () => {
  const answer = analyzeQuestion(
    "Show top 5 operating result by month in 2024",
    snapshot,
    facts,
  );
  assert.equal(answer.plan.intent, "ranking");
  assert.equal(answer.chartData.length, 5);
  assert.doesNotMatch(answer.summary, /previous period|önceki dönem/i);
});

test("multi-period and open-ended time relations clarify", () => {
  for (const question of [
    "Show revenue in January and February 2024",
    "Compare revenue in Q1 and Q2 2024",
    "Show revenue before 2024",
    "Show revenue after 2023",
    "Show revenue since 2023",
    "Show revenue through 2023",
    "Show revenue up to 2023",
    "Show revenue last quarter",
    "Show revenue last month of 2024",
  ]) {
    expectUnsupported(question);
  }
});

test("ratio and growth variants never substitute a revenue level", () => {
  for (const question of [
    "What ratio of 2024 revenue came from Germany?",
    "What portion of 2024 revenue came from Germany?",
    "Show year-over-year revenue in 2024",
    "Show month-over-month revenue in 2024",
    "Show revenue CAGR in 2024",
  ]) {
    expectUnsupported(question);
  }
});

test("unsupported role attribution is rejected at the metric boundary", () => {
  for (const question of [
    "Show on-time rate by supplier",
    "Show on-time rate by customer",
    "Show refunds by supplier",
    "Show percentage of transactions needing review in Germany",
    "Show transactions by country",
  ]) {
    expectUnsupported(question);
  }

  const supplierOverdue = analyzeQuestion(
    "Show overdue open invoices by supplier",
    snapshot,
    facts,
  );
  assert.equal(supplierOverdue.plan.unsupportedMetric, undefined);
  assert.ok(supplierOverdue.primaryValue > 0);
});

test("categorical negation is not reversed into inclusion", () => {
  for (const question of [
    "Show 2024 revenue excluding Germany",
    "Show 2024 revenue without Germany",
    "Show 2024 revenue except Germany",
    "Show 2024 revenue outside Germany",
    "Show costs excluding AI API Token Cost",
  ]) {
    expectUnsupported(question);
  }
});

test("multi-entity and multi-metric comparisons do not collapse to one series", () => {
  for (const question of [
    "Compare Germany vs France revenue in 2024",
    "Compare revenue between Germany and France in 2024",
    "Compare collections vs supplier payments by month",
    "Compare gross vs net revenue in 2024",
    "Compare open vs overdue receivables",
  ]) {
    expectUnsupported(question);
  }
});

test("mapped transaction count excludes unmapped bank transactions", () => {
  const answer = analyzeQuestion(
    "How many mapped transactions are there?",
    snapshot,
    facts,
  );
  const expected = countedBankRows.filter(
    (row) => row.allocation_status !== "UNMAPPED",
  ).length;
  assert.equal(answer.plan.unsupportedMetric, undefined);
  assert.equal(answer.primaryFormat, "number");
  assert.equal(answer.primaryValue, expected);
});

test("business-attributed cash KPI uses the same allocation grain as the answer", () => {
  const answer = analyzeQuestion(
    "Show cash inflow in Germany in 2024",
    snapshot,
    facts,
  );
  const cashIn = answer.kpis.find((item) => item.label === "External cash in");
  assert.ok(cashIn, "business-attributed cash answer needs a focused cash-in KPI");
  assert.equal(cashIn.value, formatCurrency(answer.primaryValue));
});

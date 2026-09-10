import assert from "node:assert/strict";
import test from "node:test";

import { analyzeQuestion, buildFactStore } from "../app/lib/analytics.ts";
import {
  closingBalancesByMonth,
  countedBankRows,
  externalBankRows,
  independentAnchors,
  numberValue,
  snapshot,
  sum,
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

function unsupportedOr(
  answer: ReturnType<typeof analyzeQuestion>,
  predicate: () => boolean,
  message: string,
) {
  assert.ok(answer.plan.unsupportedMetric || predicate(), message);
}

test("a percentage question returns a rate with a visible denominator", () => {
  const answer = analyzeQuestion(
    "What percentage of transactions need review?",
    snapshot,
    facts,
  );
  const review = countedBankRows.filter(
    (row) => row.allocation_status === "REVIEW_NEEDED",
  ).length;
  const expectedRate = review / countedBankRows.length;

  unsupportedOr(
    answer,
    () => answer.primaryFormat === "percent" && Math.abs(answer.primaryValue - expectedRate) < 1e-12,
    "review percentage must be a percent value, not the count 113",
  );
  if (!answer.plan.unsupportedMetric && answer.chartType === "donut") {
    const plotted = sum(answer.chartData.map((datum) => Number(datum.value ?? 0)));
    assert.equal(
      plotted,
      countedBankRows.length,
      "a review-rate donut must include reviewed and not-reviewed transactions",
    );
    assert.ok(answer.chartData.length >= 2, "a rate donut cannot be a single 100% slice");
  }
});

test("refund rate is not silently substituted with refund amount", () => {
  const answer = analyzeQuestion("What is the refund rate?", snapshot, facts);
  unsupportedOr(
    answer,
    () => answer.primaryFormat === "percent",
    "refund rate needs a defined denominator or an explicit clarification",
  );
});

test("bank reconciliation is not mislabeled unbanked open business activity", () => {
  const answer = analyzeQuestion("Show reconciliation gaps by month", snapshot, facts);
  unsupportedOr(
    answer,
    () =>
      Math.abs(answer.primaryValue) < 0.01 &&
      /unbanked|unsettled/i.test(
        [answer.summary, answer.method, ...answer.warnings].join(" "),
      ),
    "bank-linked variance is €0; the €94,945.60 remainder must be identified as 76 unbanked unsettled events",
  );
});

test("revenue growth is a change or trend, not a single annual level", () => {
  const answer = analyzeQuestion("Show revenue growth in 2024", snapshot, facts);
  unsupportedOr(
    answer,
    () =>
      ["trend", "comparison"].includes(answer.plan.intent) &&
      answer.chartData.length >= 2 &&
      answer.plan.dimension !== "year",
    "growth in one year must show a within-year trend/change or ask for clarification",
  );
});

test("average, median and share modifiers are answered explicitly or safely rejected", () => {
  const average = analyzeQuestion("average monthly revenue in 2024", snapshot, facts);
  unsupportedOr(
    average,
    () =>
      average.primaryFormat === "currency" &&
      Math.abs(average.primaryValue - independentAnchors.revenue2024 / 12) < 0.01,
    "average monthly revenue cannot be silently replaced with annual total revenue",
  );

  const median = analyzeQuestion("median revenue in 2024", snapshot, facts);
  assert.ok(
    median.plan.unsupportedMetric,
    "median revenue needs an explicit observation grain before calculation",
  );

  const germanyRevenue = uniqueBusinessRows
    .filter(
      (row) =>
        row.business_country === "Germany" &&
        row.counterparty_type === "CUSTOMER" &&
        !["Prior AR Collection"].includes(row.business_event_type) &&
        !["Prior period AR cash collection"].includes(row.revenue_or_cost_category) &&
        String(row.business_event_date || row.business_event_month).startsWith("2024"),
    )
    .reduce((total, row) => total + numberValue(row.business_base_currency_amount), 0);
  const share = analyzeQuestion(
    "What share of 2024 revenue came from Germany?",
    snapshot,
    facts,
  );
  unsupportedOr(
    share,
    () =>
      share.primaryFormat === "percent" &&
      Math.abs(share.primaryValue - germanyRevenue / independentAnchors.revenue2024) < 1e-12,
    "revenue share needs the unfiltered 2024 revenue denominator",
  );
});

test("share and growth shorthand never fall back to an additive level", () => {
  for (const question of [
    "What proportion of 2024 revenue came from Germany?",
    "What fraction of 2024 revenue came from Germany?",
    "Show the 2024 revenue mix by country",
    "Show YoY revenue in 2024",
    "Show MoM revenue in 2024",
  ]) {
    const answer = analyzeQuestion(question, snapshot, facts);
    assert.ok(
      answer.plan.unsupportedMetric,
      `${question} must compute an explicit comparison or clarify; it cannot return a revenue level`,
    );
    assert.deepEqual(answer.chartData, []);
  }
});

test("relative quarter wording resolves to Q4 without widening to the full year", () => {
  const answer = analyzeQuestion("revenue last quarter of 2024", snapshot, facts);
  assert.equal(answer.plan.unsupportedMetric, undefined);
  assert.ok(
    answer.plan.filters.some(
      (filter) => filter.field === "quarter" && filter.values.includes("Q4"),
    ),
  );
  assertClose(answer.primaryValue, 4_036_175.28, "Q4 2024 revenue");
});

test("net cash phrasing cannot be misread as cash inflow", () => {
  const answer = analyzeQuestion("What was net cash in 2024?", snapshot, facts);
  assert.equal(answer.plan.metric, "net_cash");
  assertClose(
    answer.primaryValue,
    independentAnchors.cashIn2024 - independentAnchors.cashOut2024,
    "2024 net cash",
  );
});

test("cash-balance monthly chart carries inactive accounts forward", () => {
  const answer = analyzeQuestion("Show cash balance by month in 2024", snapshot, facts);
  const expected = closingBalancesByMonth(2024);
  for (const datum of answer.chartData) {
    assertClose(
      Number(datum.value),
      expected.get(String(datum.rawLabel)) ?? Number.NaN,
      `${datum.rawLabel} closing balance`,
    );
  }
  assertClose(
    Number(answer.chartData.at(-1)?.value),
    23_548_402.23,
    "December carry-forward closing balance",
  );
});

test("point-in-time cash balance honors year and exact-date cutoffs", () => {
  const balance2023 = analyzeQuestion("What was cash balance in 2023?", snapshot, facts);
  const balanceJune2024 = analyzeQuestion(
    "What was cash balance on 2024-06-30?",
    snapshot,
    facts,
  );

  assertClose(
    balance2023.primaryValue,
    closingBalancesByMonth(2023).get("2023-12") ?? Number.NaN,
    "2023 closing cash balance",
  );
  assertClose(
    balanceJune2024.primaryValue,
    closingBalancesByMonth(2024).get("2024-06") ?? Number.NaN,
    "30 June 2024 closing cash balance",
  );
  assert.ok(
    balance2023.evidence.sourceRows < countedBankRows.length,
    "a 2023 closing balance must not consume 2024 transactions",
  );
  assert.ok(
    balanceJune2024.evidence.sourceRows < countedBankRows.length,
    "an exact-date balance must not consume later transactions",
  );
  assert.equal(balance2023.headline, "Recorded closing movement balance");
  assert.match(
    balance2023.summary,
    /recorded closing movement balance at 2023 is €13\.05M/i,
    "the answer must lead with the total balance rather than only the largest account",
  );
  assert.match(
    balanceJune2024.summary,
    /recorded closing movement balance at 2024-06-30 is €18\.59M/i,
  );
});

test("cash balance rejects business-attribution filters", () => {
  for (const question of [
    "What was cash balance in Germany?",
    "What was cash balance for Amazon Web Services EMEA SARL?",
  ]) {
    const answer = analyzeQuestion(question, snapshot, facts);
    assert.ok(
      answer.plan.unsupportedMetric,
      `${question} needs a balance-attribution rule and must not use the last attributed transaction`,
    );
  }
});

test("cash attribution is invariant between grouping and equivalent filtering", () => {
  const byCountry = analyzeQuestion("Show cash inflow by country in 2024", snapshot, facts);
  const germanyBar = byCountry.chartData.find((datum) => datum.rawLabel === "Germany");
  assert.ok(germanyBar, "Germany must be present in the country chart");

  const filtered = analyzeQuestion("Show cash inflow in Germany in 2024", snapshot, facts);
  assertClose(
    filtered.primaryValue,
    Number(germanyBar.value),
    "Germany cash inflow must not depend on wording",
  );
});

test("bottom rankings exclude categories that contribute zero to the metric", () => {
  const revenue = analyzeQuestion(
    "Show the bottom five countries by net revenue in 2024",
    snapshot,
    facts,
  );
  const costs = analyzeQuestion(
    "Show the bottom five expense categories in 2024",
    snapshot,
    facts,
  );

  assert.ok(
    revenue.chartData.every((datum) => Number(datum.value) !== 0),
    "bottom revenue must rank revenue-contributing countries",
  );
  assert.ok(
    costs.chartData.every((datum) => Number(datum.value) !== 0),
    "bottom cost must rank cost-contributing categories",
  );
});

test("incompatible metric and dimension combinations are rejected", () => {
  const questions = [
    "Show net revenue by supplier",
    "Show operating costs by customer",
    "Show open receivables by supplier",
    "Show open payables by customer",
    "Show operating result by region",
    "Show operating margin by region",
    "Show operating result by supplier",
    "Show operating margin by supplier",
    "Show operating result by category",
    "Show operating margin by department",
    "Show customer collections by supplier",
    "Show supplier payments by customer",
    "Show reconciliation gaps by country",
    "Show reconciliation gaps by customer",
  ];
  for (const question of questions) {
    const answer = analyzeQuestion(question, snapshot, facts);
    assert.ok(
      answer.plan.unsupportedMetric,
      `${question} must clarify instead of plotting Unspecified plus zero bars`,
    );
  }
});

test("incompatible entity filters cannot bypass the metric compatibility matrix", () => {
  const questions = [
    "Show net revenue from Amazon Web Services EMEA SARL",
    "Show operating costs for Antwerp Logistics Group NV",
    "Show open receivables from Amazon Web Services EMEA SARL",
    "Show open payables for Antwerp Logistics Group NV",
    "Show customer collections from Amazon Web Services EMEA SARL",
    "Show supplier payments for Antwerp Logistics Group NV",
  ];
  for (const question of questions) {
    const answer = analyzeQuestion(question, snapshot, facts);
    assert.ok(
      answer.plan.unsupportedMetric,
      `${question} must reject a conflicting customer/supplier fact scope instead of returning a confident zero`,
    );
  }
});

test("all-category requests preserve the control total", () => {
  const revenue = analyzeQuestion("Show revenue for all countries in 2024", snapshot, facts);
  const revenuePlotted = sum(
    revenue.chartData.map((datum) => Number(datum.value ?? 0)),
  );
  assertClose(revenuePlotted, revenue.primaryValue, "all-country revenue chart total");
  assert.ok(
    revenue.chartData.length >= 13 || revenue.chartData.some((datum) => datum.rawLabel === "Other"),
    "all-country request must show every category or an explicit Other aggregate",
  );

  const quality = analyzeQuestion("Show all data quality issue types", snapshot, facts);
  const qualityPlotted = sum(
    quality.chartData.map((datum) => Number(datum.value ?? 0)),
  );
  assert.equal(qualityPlotted, quality.primaryValue);
});

test("including internal transfers is reflected consistently in value, labels, KPIs and method", () => {
  const answer = analyzeQuestion(
    "cash inflow including internal transfers in 2024",
    snapshot,
    facts,
  );
  const expected = sum(
    countedBankRows
      .filter((row) => row.transaction_date.startsWith("2024"))
      .map((row) => Math.max(numberValue(row.bank_amount_for_reconciliation), 0)),
  );
  assert.equal(answer.plan.includeInternalTransfers, true);
  assertClose(answer.primaryValue, expected, "cash inflow including internal transfers");
  const visibleContract = [
    answer.headline,
    answer.chartTitle,
    answer.method,
    ...answer.kpis.flatMap((item) => [item.label, item.value, item.note]),
  ].join(" ");
  assert.doesNotMatch(visibleContract, /external|internal transfers excluded/i);
});

test("non-additive averages, rates and snapshots never use part-to-whole donuts", () => {
  const questions = [
    "Show average settlement lag by settlement status",
    "Show average mapping confidence by allocation status",
    "Show on-time rate by settlement status",
    "Show cash balance by allocation status",
  ];
  for (const question of questions) {
    const answer = analyzeQuestion(question, snapshot, facts);
    assert.notEqual(answer.chartType, "donut", `${question} uses a non-additive measure`);
  }
});

test("settlement-lag chart labels values as days, not counts", () => {
  const answer = analyzeQuestion(
    "Show average settlement lag by settlement status",
    snapshot,
    facts,
  );
  assert.match(answer.chartSubtitle, /day/i);
  assert.doesNotMatch(answer.chartSubtitle, /count/i);
});

test("settlement metrics use the settlement-date cohort", () => {
  const completedStatuses = new Set([
    "SETTLED_ON_TIME",
    "INSTANT_SETTLED",
    "SETTLED_LATE",
    "LATE_SETTLED",
    "REFUNDED",
  ]);
  const settled2024 = uniqueBusinessRows.filter(
    (row) =>
      row.actual_settlement_date.startsWith("2024") &&
      completedStatuses.has(row.settlement_status) &&
      String(row.is_internal_transfer_candidate).toUpperCase() !== "TRUE" &&
      row.counterparty_type !== "INTERNAL",
  );
  const onTime = settled2024.filter((row) =>
    ["SETTLED_ON_TIME", "INSTANT_SETTLED"].includes(row.settlement_status),
  ).length;
  const expectedRate = onTime / settled2024.length;
  const expectedLag =
    sum(settled2024.map((row) => numberValue(row.settlement_lag_days))) /
    settled2024.length;

  const rate = analyzeQuestion("What was the on-time rate in 2024?", snapshot, facts);
  const lag = analyzeQuestion("What was average settlement lag in 2024?", snapshot, facts);
  assertClose(rate.primaryValue, expectedRate, "2024 settlement-date on-time rate", 1e-12);
  assertClose(lag.primaryValue, expectedLag, "2024 settlement-date average lag", 1e-12);
  assert.match(`${rate.method} ${lag.method}`, /settlement date/i);
});

test("cash inflow/outflow comparison retains both requested series", () => {
  const answer = analyzeQuestion(
    "Compare cash inflow and outflow by month",
    snapshot,
    facts,
  );
  const keys = new Set(answer.chartSeries.map((series) => series.key));
  assert.ok(keys.has("inflow"), "comparison needs an inflow series");
  assert.ok(keys.has("outflow"), "comparison needs an outflow series");
  assert.ok(["composed", "bar"].includes(answer.chartType));
});

test("combined AR/AP rankings sort and explain the combined balance", () => {
  const answer = analyzeQuestion("Show open AR and AP by country", snapshot, facts);
  const combined = answer.chartData.map(
    (datum) => Number(datum.receivables ?? 0) + Number(datum.payables ?? 0),
  );
  assert.deepEqual(combined, [...combined].sort((left, right) => right - left));
  const top = answer.chartData[0];
  assert.ok(top);
  assert.match(answer.insights[0] ?? "", new RegExp(String(top.label), "i"));
  const expectedShare = (combined[0] / answer.primaryValue) * 100;
  const shownShare = Number((answer.insights[0] ?? "").match(/([\d.]+)%/)?.[1]);
  assert.ok(Math.abs(shownShare - expectedShare) <= 0.11);
});

test("implicit top-N truncation is disclosed when chart total differs from answer total", () => {
  const answer = analyzeQuestion("Show revenue by customer in 2024", snapshot, facts);
  const plotted = sum(answer.chartData.map((datum) => Number(datum.value ?? 0)));
  assert.ok(plotted < answer.primaryValue, "fixture must exercise a truncated chart");
  assert.match(
    [answer.headline, answer.chartTitle, answer.chartSubtitle, ...answer.warnings].join(" "),
    /top\s*7|seven largest|limited to 7/i,
    "the visible answer must disclose that only seven categories are plotted/exported",
  );
  assert.match(answer.chartTitle, /top 7/i);
  assert.match(answer.chartSubtitle, /7 of \d+ categories shown/i);
});

test("percentage variants preserve the requested denominator and filter", () => {
  const cases = [
    {
      question: "What percentage of transactions need review?",
      rawLabel: "review",
      numerator: countedBankRows.filter(
        (row) => row.allocation_status === "REVIEW_NEEDED",
      ).length,
    },
    {
      question: "What percentage of transactions are fully allocated?",
      rawLabel: "allocated",
      numerator: countedBankRows.filter((row) => row.allocation_status === "ALLOCATED").length,
    },
    {
      question: "What percentage of transactions are unmapped?",
      rawLabel: "unmapped",
      numerator: countedBankRows.filter((row) => row.allocation_status === "UNMAPPED").length,
    },
    {
      question: "What percentage of transactions are duplicates?",
      rawLabel: "duplicates",
      numerator: countedBankRows.filter(
        (row) => String(row.is_duplicate_candidate).toUpperCase() === "TRUE",
      ).length,
    },
  ];

  for (const item of cases) {
    const answer = analyzeQuestion(item.question, snapshot, facts);
    const expected = item.numerator / countedBankRows.length;
    unsupportedOr(
      answer,
      () => answer.primaryFormat === "percent" && Math.abs(answer.primaryValue - expected) < 1e-12,
      `${item.question} needs the bank-transaction denominator`,
    );
    if (!answer.plan.unsupportedMetric) {
      assert.equal(
        Number(answer.chartData.find((datum) => datum.rawLabel === item.rawLabel)?.value),
        item.numerator,
        `${item.question} must expose the requested numerator`,
      );
      assert.match(
        answer.insights.join(" "),
        new RegExp(
          `\\(${item.numerator.toLocaleString("en-GB")} of ${countedBankRows.length.toLocaleString("en-GB")}\\)`,
        ),
        `${item.question} insight must cite the requested numerator, not its complement`,
      );
    }
  }
});

test("grouped transaction rates clarify instead of showing one global donut", () => {
  for (const question of [
    "What percentage of transactions need review by country?",
    "What percentage of transactions are unmapped by year?",
  ]) {
    const answer = analyzeQuestion(question, snapshot, facts);
    assert.ok(
      answer.plan.unsupportedMetric,
      `${question} needs independently computed per-group denominators`,
    );
    assert.deepEqual(answer.chartData, []);
  }
});

test("nested rate denominators clarify instead of silently reverting to all transactions", () => {
  for (const question of [
    "What percentage of mapped transactions need review?",
    "What percentage of fully allocated transactions need review?",
  ]) {
    const answer = analyzeQuestion(question, snapshot, facts);
    assert.ok(
      answer.plan.unsupportedMetric,
      `${question} must model or clarify its filtered denominator`,
    );
    assert.deepEqual(answer.chartData, []);
  }
});

test("Turkish count wording returns invoice count rather than open amount", () => {
  const expected = uniqueBusinessRows.filter(
    (row) => numberValue(row.open_amount_base) > 0,
  ).length;
  const answer = analyzeQuestion("2024 yılında kaç açık fatura var?", snapshot, facts);
  assert.equal(answer.primaryFormat, "number");
  assert.equal(answer.primaryValue, expected);
});

test("Turkish routing preserves count, grouping, ranking and relative-period intent", async (t) => {
  const cases: Array<{
    name: string;
    question: string;
    metric: string;
    dimension?: string;
    countMode?: boolean;
    quarter?: string;
  }> = [
    {
      name: "refund count",
      question: "2024 yılında kaç iade vardı?",
      metric: "refunds",
      countMode: true,
    },
    {
      name: "bank-transaction count",
      question: "2024 yılında kaç banka işlemi vardı?",
      metric: "transactions",
      countMode: true,
    },
    {
      name: "customer grouping",
      question: "2024 müşteri bazında net gelir",
      metric: "net_revenue",
      dimension: "customer",
    },
    {
      name: "country grouping",
      question: "2024 ülke bazında net gelir",
      metric: "net_revenue",
      dimension: "country",
    },
    {
      name: "monthly grouping",
      question: "2024 ay bazında nakit girişi",
      metric: "cash_inflow",
      dimension: "month",
    },
    {
      name: "top-five customers",
      question: "2024 en yüksek gelir getiren 5 müşteri",
      metric: "net_revenue",
      dimension: "customer",
    },
    {
      name: "largest cost category",
      question: "2024 en fazla gider kalemi",
      metric: "operating_costs",
      dimension: "category",
    },
    {
      name: "last quarter",
      question: "2024 son çeyrek geliri",
      metric: "net_revenue",
      quarter: "Q4",
    },
  ];

  for (const item of cases) {
    await t.test(item.name, () => {
      const answer = analyzeQuestion(item.question, snapshot, facts);
      assert.equal(answer.plan.unsupportedMetric, undefined);
      assert.equal(answer.plan.metric, item.metric);
      if (item.dimension) assert.equal(answer.plan.dimension, item.dimension);
      if (item.countMode != null) assert.equal(answer.plan.countMode, item.countMode);
      if (item.quarter) {
        assert.ok(
          answer.plan.filters.some(
            (filter) =>
              filter.field === "quarter" && filter.values.includes(item.quarter as never),
          ),
          `${item.question} must apply ${item.quarter}`,
        );
      }
    });
  }
});

test("exact date and contradictory time scopes are not silently widened", () => {
  const exactDate = analyzeQuestion("What was revenue on 2024-12-31?", snapshot, facts);
  assert.ok(
    exactDate.plan.unsupportedMetric || exactDate.evidence.dateRange.includes("2024-12-31"),
    "exact date must be honored or rejected",
  );

  const contradiction = analyzeQuestion(
    "Show revenue in 2023 during 2024",
    snapshot,
    facts,
  );
  assert.ok(
    contradiction.plan.unsupportedMetric,
    "contradictory time scopes need clarification",
  );
});

test("non-key invoice and contract identifiers are rejected as analytical dimensions", () => {
  const questions = [
    "Show revenue by invoice number",
    "Show revenue by contract",
    "What was invoice INV-001 revenue?",
  ];
  for (const question of questions) {
    const answer = analyzeQuestion(question, snapshot, facts);
    assert.ok(
      answer.plan.unsupportedMetric,
      `${question} must not aggregate on a known non-unique source identifier`,
    );
  }
});

test("all-negative bars include a zero baseline", () => {
  const answer = analyzeQuestion(
    "What was net revenue for Customer Support by sales channel?",
    snapshot,
    facts,
  );
  assert.ok(answer.chartData.some((datum) => Number(datum.value) < 0));
  assert.ok(
    answer.warnings.some((warning) => /zero baseline/i.test(warning)),
    "negative-only bar charts need an explicit zero-baseline chart contract",
  );
});

test("temporal top-five ranking returns five ranked values", () => {
  const answer = analyzeQuestion("Show top five revenue values by month", snapshot, facts);
  assert.equal(answer.plan.intent, "ranking");
  assert.equal(answer.chartData.length, 5);
  const values = answer.chartData.map((datum) => Number(datum.value));
  assert.deepEqual(values, [...values].sort((a, b) => b - a));
});

test("sparse monthly series expose missing months without drawing a false continuous trend", () => {
  const answer = analyzeQuestion(
    "Show net revenue by month for Keeya Denmark Client 003 in 2024",
    snapshot,
    facts,
  );
  assert.equal(answer.chartData.length, 12);
  assert.deepEqual(
    answer.chartData.map((datum) => String(datum.rawLabel)),
    Array.from({ length: 12 }, (_, index) => `2024-${String(index + 1).padStart(2, "0")}`),
  );
  assert.equal(answer.chartType, "bar");
});

test("single-period temporal views use a discrete chart rather than a line", () => {
  const answer = analyzeQuestion("Show revenue by month in January 2024", snapshot, facts);
  assert.equal(answer.chartData.length, 1);
  assert.equal(answer.chartType, "bar");
});

test("entity-resolution and simulation caveats are visible where they affect interpretation", () => {
  const counterparty = analyzeQuestion(
    "Show net revenue by counterparty in 2024",
    snapshot,
    facts,
  );
  assert.ok(
    counterparty.warnings.some((warning) => /counterparty|entity|customer name/i.test(warning)),
    "counterparty rankings need the known customer-name mismatch caveat",
  );
  assert.ok(
    counterparty.warnings.some((warning) => /2024.*assumption|repair|simulation/i.test(warning)),
    "2024 comparisons need a visible synthetic-data comparability caveat",
  );
});

test("raw evidence total still matches the independently counted external bank facts", () => {
  const expected = sum(
    externalBankRows().map((row) => numberValue(row.bank_amount_for_reconciliation)),
  );
  const answer = analyzeQuestion("Show external net cash by month", snapshot, facts);
  assertClose(answer.primaryValue, expected, "external net cash control total");
});

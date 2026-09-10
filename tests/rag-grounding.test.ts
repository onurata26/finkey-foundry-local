import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveTemporalChart,
  parseGroundedCompletion,
  parseSourceNumber,
} from "../app/lib/rag/answer.ts";
import type { RagSearchResult } from "../app/lib/rag/types.ts";

const source: RagSearchResult = {
  chunkId: "chunk-1",
  documentId: "document-1",
  documentName: "risk-report.md",
  text: "Supplier concentration is the primary documented operational risk.",
  score: 0.81,
  heading: "Risk report",
};

test("grounding validator accepts cited answers backed by exact quotes", () => {
  const completion = JSON.stringify({
    answer: "Supplier concentration is the primary documented operational risk [Source 1].",
    evidence: [{
      source: 1,
      quote: "Supplier concentration is the primary documented operational risk.",
    }],
  });
  assert.ok(parseGroundedCompletion(completion, [source]));
});

test("grounding validator accepts a cited translation while preserving exact source evidence", () => {
  const completion = JSON.stringify({
    answer: "Birincil operasyonel risk, tedarikçi yoğunlaşmasıdır [Source 1].",
    evidence: [{
      source: 1,
      quote: "Supplier concentration is the primary documented operational risk.",
    }],
  });
  assert.ok(parseGroundedCompletion(completion, [source], "Birincil operasyonel risk nedir?"));
});

test("grounding validator accepts Turkish direction terms and localized decimals", () => {
  const financialSource: RagSearchResult = {
    ...source,
    text: "FY2015 revenue increased 7.8% to $93.6B, while net income decreased to $12.2B.",
  };
  const completion = JSON.stringify({
    answer: "FY2015 geliri %7,8 arttı ve $93,6B oldu; net gelir $12,2B seviyesine düştü [Source 1].",
    evidence: [{
      source: 1,
      quote: "FY2015 revenue increased 7.8% to $93.6B, while net income decreased to $12.2B.",
    }],
  });

  assert.ok(parseGroundedCompletion(completion, [financialSource], "FY2015 geliri ve net gelir nasıl değişti?"));
});

test("grounding validator rejects translated direction reversals and wrong localized numbers", () => {
  const financialSource: RagSearchResult = {
    ...source,
    text: "FY2015 revenue increased 7.8% to $93.6B.",
  };
  const reversed = JSON.stringify({
    answer: "FY2015 geliri %7,8 azaldı ve $93,6B oldu [Source 1].",
    evidence: [{ source: 1, quote: financialSource.text }],
  });
  const wrongNumber = JSON.stringify({
    answer: "FY2015 geliri %7,8 arttı ve $94,6B oldu [Source 1].",
    evidence: [{ source: 1, quote: financialSource.text }],
  });

  assert.equal(parseGroundedCompletion(reversed, [financialSource], "FY2015 geliri nasıl değişti?"), null);
  assert.equal(parseGroundedCompletion(wrongNumber, [financialSource], "FY2015 geliri nasıl değişti?"), null);
});

test("grounding validator rejects polarity changes and uncited claims", () => {
  const contradiction = JSON.stringify({
    answer: "Supplier concentration is not the primary documented operational risk [Source 1].",
    evidence: [{
      source: 1,
      quote: "Supplier concentration is the primary documented operational risk.",
    }],
  });
  assert.equal(parseGroundedCompletion(contradiction, [source]), null);

  const extraCitation = JSON.stringify({
    answer: "Supplier concentration is the primary documented operational risk [Source 1] [Source 2].",
    evidence: [{
      source: 1,
      quote: "Supplier concentration is the primary documented operational risk.",
    }],
  });
  assert.equal(parseGroundedCompletion(extraCitation, [source]), null);

  const reversedQuantity = JSON.stringify({
    answer: "Depending on many infrastructure vendors can increase continuity risk [Source 1].",
    evidence: [{ source: 1, quote: "Depending on a small number of infrastructure vendors can increase continuity risk." }],
  });
  const quantitySource = {
    ...source,
    text: "Depending on a small number of infrastructure vendors can increase continuity risk.",
  };
  assert.equal(parseGroundedCompletion(reversedQuantity, [quantitySource]), null);
});

test("grounding validator preserves a source-backed chart and sorts temporal labels", () => {
  const trendSource: RagSearchResult = {
    chunkId: "chunk-trend",
    documentId: "document-trend",
    documentName: "annual-report.pdf",
    text: "2023 revenue was €10.01m. 2024 revenue was €12.50m.",
    score: 0.88,
    pageNumber: 7,
  };
  const completion = JSON.stringify({
    answer: "Revenue increased from €10.01m in 2023 to €12.50m in 2024 [Source 1].",
    evidence: [{
      source: 1,
      quote: "2023 revenue was €10.01m. 2024 revenue was €12.50m.",
    }],
    chart: {
      points: [
        { label: "2024", valueText: "€12.50m", source: 1, quote: "2024 revenue was €12.50m." },
        { label: "2023", valueText: "€10.01m", source: 1, quote: "2023 revenue was €10.01m." },
      ],
    },
  });

  const parsed = parseGroundedCompletion(completion, [trendSource], "Gelir trendini grafikle göster");
  assert.ok(parsed);
  assert.equal(parsed.chart?.type, "line");
  assert.deepEqual(parsed.chart?.points.map((point) => point.label), ["2023", "2024"]);
  assert.deepEqual(parsed.chart?.points.map((point) => point.value), [10_010_000, 12_500_000]);
  assert.equal(parsed.chart?.unit, "EUR");
});

test("an invalid chart is omitted without discarding a grounded text answer", () => {
  const trendSource: RagSearchResult = {
    chunkId: "chunk-trend",
    documentId: "document-trend",
    documentName: "annual-report.pdf",
    text: "2023 revenue was €10m. 2024 revenue was €12m.",
    score: 0.88,
  };
  const completion = JSON.stringify({
    answer: "Revenue changed from €10m in 2023 to €12m in 2024 [Source 1].",
    evidence: [{ source: 1, quote: "2023 revenue was €10m. 2024 revenue was €12m." }],
    chart: {
      points: [
        { label: "2023", valueText: "€10m", source: 1, quote: "2023 revenue was €10m." },
        { label: "2024", valueText: "€99m", source: 1, quote: "2024 revenue was €12m." },
      ],
    },
  });

  const parsed = parseGroundedCompletion(completion, [trendSource], "Revenue trend");
  assert.ok(parsed);
  assert.equal(parsed.chart, undefined);
});

test("source number parsing is deterministic and bounded", () => {
  assert.equal(parseSourceNumber("€10.01m"), 10_010_000);
  assert.equal(parseSourceNumber("12,5%"), 12.5);
  assert.equal(parseSourceNumber("1.234,56"), 1_234.56);
  assert.equal(parseSourceNumber("not-a-number"), null);
  assert.equal(parseSourceNumber("1e309"), null);
});

test("grounding validator rejects numeric substring matches", () => {
  const completion = JSON.stringify({
    answer: "The documented value is 12 [Source 1].",
    evidence: [{ source: 1, quote: "The documented value is 312." }],
  });
  const numericSource = { ...source, text: "The documented value is 312." };
  assert.equal(parseGroundedCompletion(completion, [numericSource]), null);
});

test("deterministic chart fallback keeps one repeated series and rejects mixed metrics", () => {
  const revenueSource: RagSearchResult = {
    chunkId: "chunk-revenue",
    documentId: "document-revenue",
    documentName: "report.md",
    text: "2022 net geliri €10.00m olarak gerçekleşti. 2023 net geliri €12.50m olarak gerçekleşti. 2024 net geliri €15.00m olarak gerçekleşti.",
    score: 0.9,
  };
  const chart = deriveTemporalChart("Yıllara göre net geliri karşılaştır ve grafikle göster", [revenueSource]);
  assert.ok(chart);
  assert.deepEqual(chart.points.map((point) => point.displayValue), ["€10.00m", "€12.50m", "€15.00m"]);

  const mixedSource = {
    ...revenueSource,
    text: "2022 net geliri €10.00m olarak gerçekleşti. 2023 faaliyet gideri €12.50m olarak gerçekleşti.",
  };
  assert.equal(
    deriveTemporalChart("Yıllara göre net geliri karşılaştır ve grafikle göster", [mixedSource]),
    null,
  );
});

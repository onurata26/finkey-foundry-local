# Finkey independent validation report

Date: 23 July 2026

Source: `keeya_europe_bank_business_master_table(4).csv`

Verdict: **PASS for the supported deterministic scope.**

## Executive conclusion

Finkey's financial results were recomputed independently from the raw CSV and
compared with the application engine and chart payloads. The release gate now
passes across data ingestion, fact-grain controls, financial arithmetic,
question interpretation, chart semantics, exports, local-model boundaries, the
production build and the rendered product shell.

The product does not invent an answer when the supplied file cannot support the
requested calculation. Unsupported forecasts, ratios, averages, medians,
shares, CAGR/YoY/MoM calculations, contradictory periods and invalid
metric–dimension combinations return a clarification result with no substitute
number or chart.

## Release gates

| Gate | Result |
|---|---:|
| Independent raw-data, answer and adversarial contracts | 68 / 68 pass |
| Analytics regression suite | 54 / 54 pass |
| Foundry Local contract and security suite | Pass |
| SQLite RAG and cosine retrieval suite | Pass |
| Rendered shell and public-asset checks | 2 / 2 pass |
| Total automated tests | Run `npm test` for the current count |
| ESLint | Pass |
| Production Next.js build | Pass |
| `git diff --check` | Pass |

The local-model tests use an injected completion function and do not download a model.

## Independently verified anchors

| Measure | Verified value |
|---|---:|
| 2024 net revenue | €20,072,032.89 |
| 2024 gross revenue | €20,194,912.25 |
| 2024 operating costs | €10,063,807.51 |
| 2024 operating result proxy | €10,008,225.38 |
| 2024 operating margin proxy | 49.8615% |
| 2024 external cash inflow | €20,824,534.06 |
| 2024 external cash outflow | €10,323,640.50 |
| 2024 net external cash | €10,500,893.56 |
| December 2024 closing movement balance | €23,548,402.23 |
| Open AR | €418,134.74 |
| Open AP | €328,593.14 |
| Currently open and overdue | €31,100.00 |
| Mapping coverage | 2,371 / 2,374 = 99.8736% |
| Review-needed transactions | 113 / 2,374 = 4.7599% |
| Data-quality-flagged transactions | 252 / 2,374 = 10.6149% |

## Data and grain validation

- The CSV parses without errors: 2,811 rows and 103 source columns.
- `row_id` and `mapping_id` are complete and unique.
- The file contains 2,374 unique bank transactions and 2,776 unique business
  events.
- Every bank transaction has exactly one counted bank row.
- All 160 split transactions preserve both a 100% allocation ratio and their
  bank value.
- The generated JSON matches all 2,811 × 72 mapped fields used by the app.
- Duplicate business-event rows agree on the financial facts used by the
  engine.
- Bank-linked allocation variance is €0.00 at cent tolerance. Unmapped bank
  value and 76 unbanked unsettled business events remain separate disclosures,
  not a fabricated reconciliation gap.

## Answer and chart validation

The corrected contracts cover the previously risky cases:

- net cash cannot be misread as cash inflow;
- cash balances carry inactive accounts forward and honor year/exact-date
  closing cutoffs;
- allocation-grain cash attribution is invariant between equivalent grouped
  and filtered questions;
- rates expose numerator and denominator, with a true two-part donut only when
  the relationship is additive;
- settlement lag uses days and settlement-date cohorts;
- metric, dimension and entity filters are checked for compatibility;
- Top-N truncation is explicit while the headline retains the full control
  total;
- cash inflow/outflow comparisons retain both series;
- reconciliation variance uses a separately labeled right axis;
- all-negative bars retain a visible zero baseline;
- sparse temporal series do not imply continuous observations;
- the exact-data table and CSV export use the same normalized payload as the
  chart, including stable currency precision;
- English and Turkish equivalents return the same deterministic values for
  count, grouping, ranking and period-routing cases.

Representative live desktop checks also confirmed the 4.8% review rate, the
€10,500,893.56 2024 net-cash result, the €23,548,402.23 December balance, Top-7
disclosure, the reconciliation right axis, and the zero-baseline warning with
no horizontal overflow. A 390 × 844 mobile pass confirmed the centered composer,
single-column answer cards, complete donut and legend, contained action controls,
and intentionally scrollable exact-data table without page-level overflow. The
browser console remained free of errors.

## Foundry Local and failure-mode validation

Foundry Local cannot perform financial arithmetic. It may propose an
allowlisted query plan, but the local engine validates and materializes it.
Explanation text is accepted only when metric/value/scope relationships and
limitation polarity match the verified compact evidence.

The security suite verifies strict request/response schemas, same-origin JSON,
bounded bodies and timeouts, redacted runtime errors, per-client request
budgets, sensitive-label tokenization, rejection of
numeric or causal hallucinations, and an empty free-form implications field.
Malformed, unsafe, timed-out, unavailable or busy local-model responses
leave the deterministic answer, chart, KPIs, method and export intact.

The RAG suite separately verifies SQLite persistence, model-space isolation,
cosine ranking, source metadata and cascading document deletion. Real model
download and hardware performance remain machine-specific setup checks.

## Remaining source limitations

- The source is a generated operating simulation, not audited statutory data or
  a live bank feed.
- The 2024 segment contains more medium-assumption and repair-generated events;
  affected comparisons surface a visible caveat.
- Open AR/AP are the recorded end-state fields in this file, not reliable
  historical ledger snapshots.
- Some customer, supplier and counterparty labels are not one-to-one. Finkey
  warns on affected rankings rather than claiming a mastered entity identity.
- The endpoint's in-memory request budget is per runtime instance. A durable
  edge/platform rate limit is recommended for high-volume public use.

## Reproduce

```bash
npm run test:audit
npm test
npm run lint
git diff --check
```

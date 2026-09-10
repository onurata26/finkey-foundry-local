# Finkey analytics contract

## Source grain

The input is a mixed-grain bank-to-business allocation table. One bank transaction may be split across several allocation rows, so raw row sums are not accounting-safe.

- Bank facts: use only rows where `bank_amount_counting_flag = TRUE`; this counts each bank transaction once.
- Business facts: deduplicate by `business_event_id` before aggregating revenue, costs, refunds, settlement, or open balances.
- Allocation facts: use bank-linked allocation rows for attributed cash and bank-to-business reconciliation. Mapping-confidence diagnostics may use allocation rows; mapping coverage, review status, and data-quality counts remain at unique bank-transaction grain.
- Internal transfers: exclude from external inflow and outflow, but retain for recorded balance reconstruction.
- Generic bank-transaction counts include internal transfers; questions explicitly scoped to external transactions exclude them.
- Currency: EUR base. Coverage: 2021-01-13 through 2024-12-31.

## Core definitions

- Net revenue = revenue-class business events + refund/reversal events; prior-period receivable collections are excluded.
- Operating costs = deduplicated supplier/cost events.
- Operating result proxy = net revenue − operating costs.
- Operating margin = operating result proxy ÷ net revenue.
- Net cash movement = counted external inflows − counted external outflows.
- Closing movement balance = the latest running balance for each bank account, ordered by transaction date and transaction sequence.
- Open AR/AP = deduplicated business-event open amounts split by receivable/payable event type.
- Overdue customer invoices = positive open amounts on customer events carrying the supplied overdue flag; supplier payables are excluded.
- Count wording such as “how many refunds/open invoices/unmapped transactions” returns unique event or bank-transaction counts rather than silently formatting amounts as counts.

## Answerability guard

Questions without a supported observed metric, requests outside the 2021–2024 period, forecasts, gross/net profit, and unsupported customer/country/product profitability attribution return a clarification result with no substitute calculation. Generic “profit” remains available only as the documented operating-result proxy. Unsupported averages, medians, shares, rates and comparison operators such as YoY, MoM and CAGR are also rejected rather than silently replaced with an additive total.

Evidence tables are limited to records that contribute to the answer: positive rows for cash inflow, flagged overdue rows for overdue balances, and completed settlement rows for on-time-rate or settlement-lag answers.

## Foundry Local boundary

The on-device model may propose an allowlisted metric, dimension, period, and filter plan.
The candidate plan is treated as untrusted: Finkey validates and locally
materializes every enum, period, ranking limit, filter and explicit user
constraint before execution. Known unsupported requests remain rejected even
when the model proposes an alternative.

All financial arithmetic remains deterministic. For explanation, Foundry Local receives
only compact, already-derived evidence; entity labels are tokenized and raw
rows, descriptions, invoice references, account identifiers and the source CSV
are excluded. The original user question is still part of interpretation, so
users should not place secrets in it. Model text is accepted only when its
metric/value relationships and caveats match verified evidence; free-form
implications are disabled. Local runtime errors, timeouts, missing model caches,
and invalid responses fall back to the rules-based answer without
removing the chart, KPIs, method, or evidence.

The AI endpoint requires same-origin JSON, validates strict request and response
schemas, limits body sizes, applies timeouts and a
per-client in-memory request budget, and returns redacted errors with retry
guidance. Foundry Local is designed for a single user on the device rather than
as a public multi-tenant inference service.

## Visual selection

- Time trend: line or area chart.
- Revenue versus cost/result: composed chart.
- Ranked categories, countries, customers, or suppliers: sorted horizontal bars.
- Share or status mix: donut only for a small number of mutually exclusive categories.
- Reconciliation and cash movement: grouped bars where direction matters;
  reconciliation variance uses a separately labeled right axis.

All charts use zero-aware axes where magnitude comparison matters, visible units, solid color fills, deterministic sorting, and a source/method disclosure in the answer panel. Top-N truncation is explicit in the title and subtitle, and the accessible table plus CSV export use the exact same normalized chart payload.

## Known limitations

The supplied dataset is a simulated operating model, not a live bank feed. The 2024 portion contains more assumptions and repairs than earlier periods. Open-balance fields are suitable for directional analysis but should not be presented as an audited statutory receivables/payables ledger. Some customer, supplier and counterparty labels are not one-to-one; affected rankings surface an entity-resolution caveat rather than implying a mastered identity model.

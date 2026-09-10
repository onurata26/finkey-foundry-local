import { readFileSync } from "node:fs";

import Papa from "papaparse";

import type { FinanceDataset } from "../../app/lib/analytics.ts";

export type RawRow = Record<string, string>;

const RAW_DATA_PATH = new URL(
  "../../keeya_europe_bank_business_master_table(4).csv",
  import.meta.url,
);
const SNAPSHOT_PATH = new URL("../../public/data/keeya-finance.json", import.meta.url);

export const parsedCsv = Papa.parse<RawRow>(readFileSync(RAW_DATA_PATH, "utf8"), {
  header: true,
  skipEmptyLines: "greedy",
  transformHeader: (header) => header.trim(),
});

export const rawRows = parsedCsv.data;
export const snapshot = JSON.parse(
  readFileSync(SNAPSHOT_PATH, "utf8"),
) as FinanceDataset;

export const numberValue = (value: string | undefined): number => {
  if (value == null || value === "") return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Non-numeric source value: ${value}`);
  return parsed;
};

export const nullableNumber = (value: string | undefined): number | null =>
  value == null || value === "" ? null : numberValue(value);

export const booleanValue = (value: string | undefined): boolean =>
  String(value).toUpperCase() === "TRUE";

export const sum = (values: Iterable<number>): number => {
  let total = 0;
  for (const value of values) total += value;
  return total;
};

export function groupBy(
  rows: RawRow[],
  key: (row: RawRow) => string,
): Map<string, RawRow[]> {
  const groups = new Map<string, RawRow[]>();
  for (const row of rows) {
    const groupKey = key(row);
    const group = groups.get(groupKey) ?? [];
    group.push(row);
    groups.set(groupKey, group);
  }
  return groups;
}

export const transactionGroups = groupBy(
  rawRows.filter((row) => row.bank_transaction_id),
  (row) => row.bank_transaction_id,
);

export const countedBankRows = rawRows.filter(
  (row) => row.bank_transaction_id && booleanValue(row.bank_amount_counting_flag),
);

const businessById = new Map<string, RawRow>();
for (const row of rawRows) {
  if (!row.business_event_id) continue;
  const current = businessById.get(row.business_event_id);
  if (!current || row.row_id.localeCompare(current.row_id) < 0) {
    businessById.set(row.business_event_id, row);
  }
}
export const uniqueBusinessRows = [...businessById.values()];

export function isInternal(row: RawRow): boolean {
  return (
    booleanValue(row.is_internal_transfer_candidate) ||
    row.counterparty_type === "INTERNAL" ||
    row.revenue_or_cost_category === "Internal treasury movement"
  );
}

export function isPriorPeriodCollection(row: RawRow): boolean {
  return (
    row.business_event_type === "Prior AR Collection" ||
    row.revenue_or_cost_category === "Prior period AR cash collection"
  );
}

export function businessYear(row: RawRow): number {
  return Number(
    (row.business_event_date || row.business_event_month || row.transaction_date).slice(
      0,
      4,
    ),
  );
}

export function cashYear(row: RawRow): number {
  return Number((row.transaction_date || row.source_model_period).slice(0, 4));
}

export function monthKey(row: RawRow, basis: "business" | "cash"): string {
  return basis === "cash"
    ? (row.transaction_date || row.source_model_period).slice(0, 7)
    : (row.business_event_date || row.business_event_month || row.transaction_date).slice(
        0,
        7,
      );
}

export function netRevenue(rows: RawRow[]): number {
  return sum(
    rows
      .filter(
        (row) =>
          row.counterparty_type === "CUSTOMER" && !isPriorPeriodCollection(row),
      )
      .map((row) => numberValue(row.business_base_currency_amount)),
  );
}

export function grossRevenue(rows: RawRow[]): number {
  return sum(
    rows
      .filter(
        (row) =>
          row.counterparty_type === "CUSTOMER" &&
          !isPriorPeriodCollection(row) &&
          numberValue(row.business_base_currency_amount) > 0,
      )
      .map((row) => numberValue(row.business_base_currency_amount)),
  );
}

export function operatingCosts(rows: RawRow[]): number {
  return Math.abs(
    sum(
      rows
        .filter(
          (row) =>
            row.counterparty_type === "SUPPLIER" &&
            numberValue(row.business_base_currency_amount) < 0,
        )
        .map((row) => numberValue(row.business_base_currency_amount)),
    ),
  );
}

export function externalBankRows(year?: number): RawRow[] {
  return countedBankRows.filter(
    (row) => !isInternal(row) && (year == null || cashYear(row) === year),
  );
}

export function monthlyExternalCash(year?: number): Map<
  string,
  { inflow: number; outflow: number; net: number }
> {
  const groups = groupBy(externalBankRows(year), (row) => monthKey(row, "cash"));
  return new Map(
    [...groups.entries()].map(([month, rows]) => {
      const inflow = sum(
        rows.map((row) => Math.max(numberValue(row.bank_amount_for_reconciliation), 0)),
      );
      const outflow = Math.abs(
        sum(
          rows.map((row) => Math.min(numberValue(row.bank_amount_for_reconciliation), 0)),
        ),
      );
      return [month, { inflow, outflow, net: inflow - outflow }];
    }),
  );
}

function rowOrder(row: RawRow): string {
  return [
    String(numberValue(row.transaction_sequence)).padStart(12, "0"),
    row.transaction_date,
    row.row_id,
  ].join("|");
}

export function closingBalancesByMonth(year: number): Map<string, number> {
  const months = Array.from(
    { length: 12 },
    (_, index) => `${year}-${String(index + 1).padStart(2, "0")}`,
  );
  const rowsByAccount = groupBy(countedBankRows, (row) => row.bank_account_id);
  const result = new Map<string, number>();

  for (const month of months) {
    let total = 0;
    for (const rows of rowsByAccount.values()) {
      const eligible = rows
        .filter((row) => row.transaction_date.slice(0, 7) <= month)
        .sort((left, right) => rowOrder(left).localeCompare(rowOrder(right)));
      const closing = eligible.at(-1);
      if (closing) total += numberValue(closing.running_balance_base);
    }
    result.set(month, total);
  }
  return result;
}

export const externalBusiness2024 = uniqueBusinessRows.filter(
  (row) => !isInternal(row) && businessYear(row) === 2024,
);

export const independentAnchors = {
  revenue2024: netRevenue(externalBusiness2024),
  grossRevenue2024: grossRevenue(externalBusiness2024),
  costs2024: operatingCosts(externalBusiness2024),
  refunds2024: Math.abs(
    sum(
      externalBusiness2024
        .filter(
          (row) =>
            row.counterparty_type === "CUSTOMER" &&
            booleanValue(row.refund_or_reversal_flag),
        )
        .map((row) =>
          Math.min(numberValue(row.business_base_currency_amount), 0),
        ),
    ),
  ),
  cashIn2024: sum(
    externalBankRows(2024).map((row) =>
      Math.max(numberValue(row.bank_amount_for_reconciliation), 0),
    ),
  ),
  cashOut2024: Math.abs(
    sum(
      externalBankRows(2024).map((row) =>
        Math.min(numberValue(row.bank_amount_for_reconciliation), 0),
      ),
    ),
  ),
  openAr: sum(
    uniqueBusinessRows
      .filter((row) => !isInternal(row) && row.counterparty_type === "CUSTOMER")
      .map((row) => Math.max(numberValue(row.open_amount_base), 0)),
  ),
  openAp: sum(
    uniqueBusinessRows
      .filter((row) => !isInternal(row) && row.counterparty_type === "SUPPLIER")
      .map((row) => Math.max(numberValue(row.open_amount_base), 0)),
  ),
};

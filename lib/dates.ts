/** Shared helpers for month/year filtering of history views. */

export const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Options for a month <select>, including an "All months" entry (value ""). */
export function monthOptions() {
  return [
    { label: "All months", value: "" },
    ...MONTHS.map((label, i) => ({ label, value: String(i) })),
  ];
}

/** Recent years for a year <select>, newest first, based on the given year. */
export function yearOptions(currentYear: number, back = 4) {
  const years: { label: string; value: string }[] = [];
  for (let y = currentYear; y >= currentYear - back; y--) {
    years.push({ label: String(y), value: String(y) });
  }
  return years;
}

/** ISO range [start, end) for a given year + optional month index (0–11). */
export function monthRange(
  year: number,
  month: number | null,
): { start: string; end: string } {
  if (month === null) {
    return {
      start: new Date(Date.UTC(year, 0, 1)).toISOString(),
      end: new Date(Date.UTC(year + 1, 0, 1)).toISOString(),
    };
  }
  return {
    start: new Date(Date.UTC(year, month, 1)).toISOString(),
    end: new Date(Date.UTC(year, month + 1, 1)).toISOString(),
  };
}

export const PRODUCT_TIME_ZONE = "Europe/Berlin";
export const MAX_HISTORY_RANGE_DAYS = 366;

const ISO_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoCalendarDay(value: string): boolean {
  const match = ISO_DAY_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

export function calendarDayInTimeZone(
  instant: Date,
  timeZone: string = PRODUCT_TIME_ZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  if (!year || !month || !day) throw new Error(`Unable to resolve calendar day for ${timeZone}`);
  return `${year}-${month}-${day}`;
}

export class InvalidHistoryRangeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidHistoryRangeError";
  }
}

function addDays(isoDay: string, days: number): string {
  const date = new Date(`${isoDay}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function inclusiveDayCount(from: string, to: string): number {
  const fromMs = new Date(`${from}T00:00:00Z`).getTime();
  const toMs = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((toMs - fromMs) / 86_400_000) + 1;
}

export function resolveHistoryDateRange(
  today: string,
  params: { from?: string; to?: string },
): { from: string; to: string } {
  if (!isValidIsoCalendarDay(today)) {
    throw new InvalidHistoryRangeError("Invalid reference day.");
  }
  const from = params.from ?? addDays(today, -29);
  const to = params.to ?? today;
  if (!isValidIsoCalendarDay(from) || !isValidIsoCalendarDay(to)) {
    throw new InvalidHistoryRangeError("Dates must be real calendar days in yyyy-MM-dd format.");
  }
  if (from > to) throw new InvalidHistoryRangeError("The start date must not be after the end date.");
  if (to > today) throw new InvalidHistoryRangeError("Future history ranges are not allowed.");
  if (inclusiveDayCount(from, to) > MAX_HISTORY_RANGE_DAYS) {
    throw new InvalidHistoryRangeError(`History ranges are limited to ${MAX_HISTORY_RANGE_DAYS} days.`);
  }
  return { from, to };
}

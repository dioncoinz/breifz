export function formatDateDDMMYYYY(value: string | null | undefined) {
  if (!value) return "TBC";

  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (ymdMatch) {
    return `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB");
}

function toUtcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

function isWithinRange(date: Date, startValue: string | null | undefined, endValue: string | null | undefined) {
  const start = startValue ? new Date(startValue) : null;
  const end = endValue ? new Date(endValue) : null;

  if (start && !Number.isNaN(start.getTime()) && date < start) return false;
  if (end && !Number.isNaN(end.getTime()) && date > end) return false;

  return true;
}

export function formatLogEntryDateDDMMYYYY(
  value: string | null | undefined,
  projectStartDate?: string | null,
  projectEndDate?: string | null
) {
  if (!value) return "TBC";

  const slashMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!slashMatch) return formatDateDDMMYYYY(value);

  const first = Number(slashMatch[1]);
  const second = Number(slashMatch[2]);
  const year = Number(slashMatch[3]);

  const ddmmDate = toUtcDate(year, second, first);
  const mmddDate = toUtcDate(year, first, second);
  const ddmmInRange = isWithinRange(ddmmDate, projectStartDate, projectEndDate);
  const mmddInRange = isWithinRange(mmddDate, projectStartDate, projectEndDate);

  if (mmddInRange && !ddmmInRange) {
    return `${slashMatch[2]}/${slashMatch[1]}/${slashMatch[3]}`;
  }

  return `${slashMatch[1]}/${slashMatch[2]}/${slashMatch[3]}`;
}

export function formatDateTimeAU(value: string | null | undefined) {
  if (!value) return "TBC";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

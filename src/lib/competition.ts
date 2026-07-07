import type { Competition, WeighIn } from "./types";

// ---------- date helpers (dates are YYYY-MM-DD strings, handled in UTC) ----------

export function parseDate(d: string): Date {
  return new Date(d + "T00:00:00Z");
}

export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Today as YYYY-MM-DD in the user's local timezone. */
export function todayStr(): string {
  const n = new Date();
  const p = (x: number) => String(x).padStart(2, "0");
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
}

export function addDays(dateStr: string, n: number): string {
  const d = parseDate(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return toDateStr(d);
}

export function addMonths(dateStr: string, n: number): string {
  const d = parseDate(dateStr);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const daysInMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, daysInMonth));
  return toDateStr(d);
}

export function formatDate(dateStr: string): string {
  return parseDate(dateStr).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// ---------- competition status ----------

export type CompetitionStatus = "upcoming" | "active" | "finished";

export function competitionStatus(c: Competition, today = todayStr()): CompetitionStatus {
  if (today < c.start_date) return "upcoming";
  if (today > c.end_date) return "finished";
  return "active";
}

// ---------- weigh-in periods ----------

export interface Period {
  index: number;
  start: string;
  end: string; // inclusive
  label: string;
}

/** Split the competition timeframe into weigh-in periods based on its interval. */
export function buildPeriods(c: Competition): Period[] {
  const periods: Period[] = [];
  let cursor = c.start_date;
  let index = 0;
  while (cursor <= c.end_date && periods.length < 500) {
    let next: string;
    let label: string;
    if (c.weigh_in_interval === "daily") {
      next = addDays(cursor, 1);
      label = formatDate(cursor);
    } else if (c.weigh_in_interval === "weekly") {
      next = addDays(cursor, 7);
      label = `Week ${index + 1}`;
    } else {
      next = addMonths(cursor, 1);
      label = `Month ${index + 1}`;
    }
    const end = addDays(next, -1) < c.end_date ? addDays(next, -1) : c.end_date;
    periods.push({ index, start: cursor, end, label });
    cursor = next;
    index++;
  }
  return periods;
}

// ---------- weight lookups (weigh-ins must be sorted ascending by measured_on) ----------

export interface WeightPoint {
  kg: number;
  date: string;
}

/** Latest weigh-in on or before `uptoDate`. */
export function weightAt(weighIns: WeighIn[], uptoDate: string): WeightPoint | null {
  let found: WeightPoint | null = null;
  for (const w of weighIns) {
    if (w.measured_on <= uptoDate) found = { kg: Number(w.weight_kg), date: w.measured_on };
    else break;
  }
  return found;
}

/** Last weigh-in inside [from, to]. */
export function weightInRange(weighIns: WeighIn[], from: string, to: string): WeightPoint | null {
  let found: WeightPoint | null = null;
  for (const w of weighIns) {
    if (w.measured_on > to) break;
    if (w.measured_on >= from) found = { kg: Number(w.weight_kg), date: w.measured_on };
  }
  return found;
}

/**
 * Starting weight for a competition: the latest weigh-in on or before the start
 * date, or — if the user only started logging after the start — their first
 * weigh-in during the competition.
 */
export function baselineWeight(weighIns: WeighIn[], c: Competition): WeightPoint | null {
  const before = weightAt(weighIns, c.start_date);
  if (before) return before;
  for (const w of weighIns) {
    if (w.measured_on > c.end_date) break;
    if (w.measured_on >= c.start_date) return { kg: Number(w.weight_kg), date: w.measured_on };
  }
  return null;
}

export function pctLost(baselineKg: number, currentKg: number): number {
  return ((baselineKg - currentKg) / baselineKg) * 100;
}

// ---------- standings ----------

export interface MemberResult {
  userId: string;
  name: string;
  avatarUrl: string | null;
  baseline: WeightPoint | null;
  current: WeightPoint | null;
  pctLost: number | null;
}

export interface PeriodResult {
  period: Period;
  /** Aggregate weight at the end of the period (carry-forward of last known values). */
  weightKg: number | null;
  /** % lost vs the previous period (positive = lost weight). */
  pctFromPrev: number | null;
  /** How many members logged a weigh-in inside this period. */
  enteredCount: number;
  memberCount: number;
}

export interface EntrantResult {
  participantId: string;
  kind: "user" | "team";
  entrantId: string; // user id or team id
  name: string;
  imageUrl: string | null;
  members: MemberResult[];
  baselineKg: number | null;
  currentKg: number | null;
  pctLost: number | null;
  periodResults: PeriodResult[];
}

export interface MemberInput {
  userId: string;
  name: string;
  avatarUrl: string | null;
  weighIns: WeighIn[]; // sorted ascending by measured_on
}

/**
 * Compute an entrant's (solo user or whole team) results. Members without any
 * weigh-in during/before the competition are excluded from aggregates. For
 * members who started logging late, their baseline carries back so team sums
 * stay comparable across periods.
 */
export function computeEntrant(
  base: Omit<EntrantResult, "members" | "baselineKg" | "currentKg" | "pctLost" | "periodResults">,
  memberInputs: MemberInput[],
  c: Competition,
  asOf = todayStr()
): EntrantResult {
  const upto = asOf < c.end_date ? asOf : c.end_date;
  const members: MemberResult[] = memberInputs.map((m) => {
    const baseline = baselineWeight(m.weighIns, c);
    let current: WeightPoint | null = null;
    if (baseline) {
      current = weightAt(m.weighIns, upto);
      if (!current || current.date < baseline.date) current = baseline;
    }
    return {
      userId: m.userId,
      name: m.name,
      avatarUrl: m.avatarUrl,
      baseline,
      current,
      pctLost: baseline && current ? pctLost(baseline.kg, current.kg) : null,
    };
  });

  const active = members.filter((m) => m.baseline && m.current);
  const baselineKg = active.length ? active.reduce((s, m) => s + m.baseline!.kg, 0) : null;
  const currentKg = active.length ? active.reduce((s, m) => s + m.current!.kg, 0) : null;
  const total = baselineKg != null && currentKg != null ? pctLost(baselineKg, currentKg) : null;

  const periods = buildPeriods(c);
  const activeInputs = memberInputs.filter((m) =>
    active.some((a) => a.userId === m.userId)
  );
  const periodResults: PeriodResult[] = [];
  let prevSum: number | null = baselineKg;
  for (const period of periods) {
    let sum: number | null = null;
    let entered = 0;
    if (activeInputs.length) {
      sum = 0;
      for (const m of activeInputs) {
        const baseline = baselineWeight(m.weighIns, c)!;
        const at = weightAt(m.weighIns, period.end);
        sum += at && at.date >= baseline.date ? at.kg : baseline.kg;
        if (weightInRange(m.weighIns, period.start, period.end)) entered++;
      }
    }
    periodResults.push({
      period,
      weightKg: sum,
      pctFromPrev: sum != null && prevSum != null && prevSum > 0 ? pctLost(prevSum, sum) : null,
      enteredCount: entered,
      memberCount: memberInputs.length,
    });
    if (sum != null) prevSum = sum;
  }

  return { ...base, members, baselineKg, currentKg, pctLost: total, periodResults };
}

/** Rank entrants: biggest % lost first; entrants without data go last. */
export function rankEntrants(entrants: EntrantResult[]): EntrantResult[] {
  return [...entrants].sort((a, b) => {
    if (a.pctLost == null && b.pctLost == null) return 0;
    if (a.pctLost == null) return 1;
    if (b.pctLost == null) return -1;
    return b.pctLost - a.pctLost;
  });
}

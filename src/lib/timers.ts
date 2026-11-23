const UNIT_SECONDS: Record<string, number> = {
  second: 1,
  sec: 1,
  s: 1,
  minute: 60,
  min: 60,
  m: 60,
  hour: 3600,
  hr: 3600,
  h: 3600,
};

function unitToSeconds(unit: string): number | null {
  const u = unit.toLowerCase().replace(/\.$/, "").replace(/s$/, "");
  return UNIT_SECONDS[u] ?? null;
}

const NUM = String.raw`\d+(?:\.\d+)?|\d+\s*\/\s*\d+|an?|one|two|three|four|five|six|ten|fifteen|twenty|thirty|forty|forty-five`;
const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, ten: 10,
  fifteen: 15, twenty: 20, thirty: 30, forty: 40, "forty-five": 45,
};

function toNumber(token: string): number {
  const t = token.toLowerCase().replace(/\s+/g, "");
  if (t in WORD_NUMBERS) return WORD_NUMBERS[t];
  if (t.includes("/")) {
    const [n, d] = t.split("/").map(Number);
    return d ? n / d : 0;
  }
  return Number(t);
}

const DURATION_RE = new RegExp(
  String.raw`\b(${NUM})(?:\s*(?:-|–|to|or)\s*(${NUM}))?\s*(hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s)\b(?:\s+(?:and\s+)?(${NUM})\s*(minutes?|mins?|seconds?|secs?))?`,
  "gi",
);

export interface DetectedTimer {
  /** The matching text, e.g. "10 to 12 minutes". */
  label: string;
  /** Seconds; for ranges this is the lower bound so you can check early. */
  seconds: number;
  maxSeconds?: number;
}

/** Find every duration mentioned in a step, in order. */
export function detectTimers(text: string): DetectedTimer[] {
  const timers: DetectedTimer[] = [];
  for (const m of text.matchAll(DURATION_RE)) {
    const unit = unitToSeconds(m[3]);
    if (!unit) continue;
    // Bare "m"/"s"/"h" after a number are too ambiguous unless written tight ("10m").
    if (m[3].length === 1 && !/\d[hms]\b/i.test(m[0])) continue;
    let seconds = toNumber(m[1]) * unit;
    let maxSeconds = m[2] ? toNumber(m[2]) * unit : undefined;
    if (m[4] && m[5]) {
      const extra = toNumber(m[4]) * (unitToSeconds(m[5]) ?? 0);
      seconds += extra;
      if (maxSeconds) maxSeconds += extra;
    }
    if (seconds <= 0) continue;
    timers.push({
      label: m[0].trim(),
      seconds: Math.round(seconds),
      maxSeconds: maxSeconds ? Math.round(maxSeconds) : undefined,
    });
  }
  return timers;
}

/** The timer for a step: the longest duration it mentions, or null. */
export function primaryTimerSeconds(text: string): number | null {
  const timers = detectTimers(text);
  if (timers.length === 0) return null;
  return Math.max(...timers.map((t) => t.seconds));
}

/** 75 -> "1:15", 3725 -> "1:02:05" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

/** 90 -> "1 hr 30 min" */
export function formatMinutes(minutes: number | null | undefined): string {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${m} min`;
}

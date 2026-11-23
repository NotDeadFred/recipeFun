export type VoiceCommand =
  | { type: "next" }
  | { type: "previous" }
  | { type: "repeat" }
  | { type: "ingredients" }
  | { type: "start-timer" }
  | { type: "stop-timer" }
  | { type: "goto"; step: number }
  | { type: "stop-listening" };

const ORDINALS: Record<string, number> = {
  one: 1, first: 1, two: 2, second: 2, three: 3, third: 3, four: 4, fourth: 4,
  five: 5, fifth: 5, six: 6, sixth: 6, seven: 7, seventh: 7, eight: 8, eighth: 8,
  nine: 9, ninth: 9, ten: 10, tenth: 10, eleven: 11, twelve: 12,
};

/**
 * Map what the cook said to a command. Speech recognition returns whole
 * phrases ("okay next step please"), so match on keywords, most specific first.
 */
export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const t = transcript.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return null;

  const goto = t.match(/\b(?:go to|jump to|skip to)?\s*step (\d+|[a-z]+)\b/);
  if (goto && !/\b(next|previous|back|last)\b/.test(t)) {
    const n = /^\d+$/.test(goto[1]) ? Number(goto[1]) : ORDINALS[goto[1]];
    if (n) return { type: "goto", step: n };
  }
  if (/\b(stop|cancel|pause) (the )?timer\b/.test(t)) return { type: "stop-timer" };
  if (/\b(start|set|begin) (the |a )?timer\b|\btimer (start|go)\b/.test(t)) return { type: "start-timer" };
  if (/\b(stop|quit) listening\b|\bmute\b/.test(t)) return { type: "stop-listening" };
  if (/\b(repeat|again|say that|read (it|that|step))\b|\bwhat was that\b/.test(t)) return { type: "repeat" };
  if (/\b(ingredients?|what do i need)\b/.test(t)) return { type: "ingredients" };
  if (/\b(previous|back|go back|last step|before)\b/.test(t)) return { type: "previous" };
  if (/\b(next|continue|done|forward|go on|okay next|ok next)\b/.test(t)) return { type: "next" };
  return null;
}

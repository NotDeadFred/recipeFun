import { describe, expect, it } from "vitest";
import { detectTimers, formatClock, formatMinutes, primaryTimerSeconds } from "./timers";

describe("detectTimers", () => {
  it("finds minutes", () => {
    expect(detectTimers("Simmer for 10 minutes.")).toEqual([
      { label: "10 minutes", seconds: 600, maxSeconds: undefined },
    ]);
  });

  it("uses the lower bound of a range", () => {
    const [t] = detectTimers("Bake 25 to 30 minutes until golden.");
    expect(t.seconds).toBe(1500);
    expect(t.maxSeconds).toBe(1800);
  });

  it("handles hours plus minutes", () => {
    expect(detectTimers("Roast for 1 hour and 15 minutes")[0].seconds).toBe(4500);
  });

  it("handles abbreviations and word numbers", () => {
    expect(detectTimers("Rest 5 mins")[0].seconds).toBe(300);
    expect(detectTimers("Cook for two hours")[0].seconds).toBe(7200);
    expect(detectTimers("Let it sit for a minute")[0].seconds).toBe(60);
  });

  it("handles seconds and tight forms", () => {
    expect(detectTimers("Blend 30 seconds")[0].seconds).toBe(30);
    expect(detectTimers("Microwave 2m")[0].seconds).toBe(120);
  });

  it("ignores temperatures and quantities", () => {
    expect(detectTimers("Preheat oven to 350°F. Add 2 cups of stock.")).toEqual([]);
  });

  it("finds multiple timers", () => {
    expect(detectTimers("Boil 3 minutes, then simmer 20 minutes.")).toHaveLength(2);
  });
});

describe("primaryTimerSeconds", () => {
  it("returns the longest timer", () => {
    expect(primaryTimerSeconds("Boil 3 minutes, then simmer 20 minutes.")).toBe(1200);
  });

  it("returns null when there is none", () => {
    expect(primaryTimerSeconds("Stir well.")).toBeNull();
  });
});

describe("formatting", () => {
  it("formats clocks", () => {
    expect(formatClock(75)).toBe("1:15");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(-5)).toBe("0:00");
  });

  it("formats minutes", () => {
    expect(formatMinutes(90)).toBe("1 hr 30 min");
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(120)).toBe("2 hr");
    expect(formatMinutes(null)).toBe("");
  });
});

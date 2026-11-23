"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Recipe, UnitSystem } from "@/lib/types";
import { adjustIngredients, formatIngredient } from "@/lib/scaling";
import { cookReducer, initCookState, isFinished, progressPercent } from "@/lib/cookSession";
import { formatClock } from "@/lib/timers";
import type { VoiceCommand } from "@/lib/voiceCommands";
import { useWakeLock } from "@/lib/hooks";
import { IngredientList } from "../recipe/IngredientList";
import { timerRemaining, useTimers } from "./useTimers";
import { useSpeaker, useVoiceCommands } from "./useSpeech";

interface Props {
  recipe: Recipe;
  servings?: number;
  unitSystem?: UnitSystem | null;
  exitHref: string;
}

/**
 * Step-by-step cooking: ingredients on one side, steps on the other, with the
 * current step highlighted along with the ingredients it uses.
 */
export function CookMode({ recipe, servings = recipe.servings, unitSystem = null, exitHref }: Props) {
  const [state, dispatch] = useReducer(cookReducer, recipe.steps.length, (n) => initCookState(n));
  const [readAloud, setReadAloud] = useState(false);
  const [listening, setListening] = useState(false);
  const [mobilePane, setMobilePane] = useState<"step" | "ingredients">("step");
  const [showFinished, setShowFinished] = useState(false);
  const stepsRef = useRef<HTMLOListElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useWakeLock(true);
  const speaker = useSpeaker();
  const { timers, now, start, pause, dismiss } = useTimers((t) => speaker.speak(`${t.label} timer is done.`));

  const ingredients = useMemo(
    () => adjustIngredients(recipe.ingredients, servings / (recipe.servings || 1), unitSystem),
    [recipe.ingredients, recipe.servings, servings, unitSystem],
  );
  const step = recipe.steps[state.stepIndex];
  const stepIngredients = ingredients.filter((i) => step?.ingredientIds.includes(i.id));
  const isLast = state.stepIndex === recipe.steps.length - 1;

  const describeStep = useCallback(
    (index: number) => {
      const s = recipe.steps[index];
      return s ? `Step ${index + 1}. ${s.text}` : "";
    },
    [recipe.steps],
  );

  // Read each new step aloud when read-aloud is on.
  useEffect(() => {
    if (readAloud) speaker.speak(describeStep(state.stepIndex));
  }, [readAloud, state.stepIndex, describeStep, speaker]);

  // Keep the current step centred in view.
  useEffect(() => {
    const el = stepsRef.current?.querySelector<HTMLElement>(`[data-step="${state.stepIndex}"]`);
    el?.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [state.stepIndex]);

  const next = useCallback(() => {
    if (isLast) {
      dispatch({ type: "next" });
      setShowFinished(true);
    } else {
      dispatch({ type: "next" });
    }
  }, [isLast]);
  const previous = useCallback(() => dispatch({ type: "previous" }), []);

  const startStepTimer = useCallback(() => {
    if (step?.timerSeconds) start(step.id, `Step ${state.stepIndex + 1}`, step.timerSeconds);
  }, [step, start, state.stepIndex]);

  const handleVoice = useCallback(
    (cmd: VoiceCommand) => {
      switch (cmd.type) {
        case "next":
          next();
          break;
        case "previous":
          previous();
          break;
        case "repeat":
          speaker.speak(describeStep(state.stepIndex));
          break;
        case "goto":
          dispatch({ type: "goto", index: cmd.step - 1 });
          break;
        case "ingredients":
          speaker.speak(
            stepIngredients.length
              ? `For this step you need ${stepIngredients.map(formatIngredient).join(", ")}.`
              : "This step doesn't use any listed ingredients.",
          );
          break;
        case "start-timer":
          startStepTimer();
          break;
        case "stop-timer":
          if (step) pause(step.id);
          break;
        case "stop-listening":
          setListening(false);
          break;
      }
    },
    [next, previous, speaker, describeStep, state.stepIndex, stepIngredients, startStepTimer, step, pause],
  );
  const voice = useVoiceCommands(listening, handleVoice, () => speaker.speakingRef.current);

  // Keyboard: arrows, space, page keys (works with iPad keyboards and foot pedals).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("input, textarea, select, [contenteditable]")) return;
      // Space on a focused button already clicks it; don't advance twice.
      if (e.key === " " && target?.closest("button, a")) return;
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        next();
      } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) {
        e.preventDefault();
        previous();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, previous]);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) next();
      else previous();
    }
  };

  if (recipe.steps.length === 0) {
    return (
      <div className="page text-center">
        <p className="text-muted">This recipe has no steps yet.</p>
        <Link href={exitHref} className="btn mt-4">
          Back to recipe
        </Link>
      </div>
    );
  }

  const stepTimer = step ? timers.find((t) => t.id === step.id) : undefined;

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background" data-testid="cook-mode">
      {/* Top bar */}
      <header className="border-b border-border bg-surface px-3 pt-[env(safe-area-inset-top)]">
        <div className="flex min-h-14 items-center gap-2">
          <Link href={exitHref} className="btn-ghost" aria-label="Exit cook mode">
            ✕ <span className="hidden sm:inline">Exit</span>
          </Link>
          <h1 className="flex-1 truncate font-semibold">{recipe.title}</h1>
          {speaker.supported && (
            <button
              className="chip"
              aria-pressed={readAloud}
              onClick={() => {
                if (readAloud) speaker.cancel();
                setReadAloud(!readAloud);
              }}
            >
              🔊 <span className="hidden sm:inline">Read aloud</span>
            </button>
          )}
          {voice.supported && (
            <button className="chip" aria-pressed={listening} onClick={() => setListening(!listening)}>
              🎙️ <span className="hidden sm:inline">{listening ? "Listening" : "Voice"}</span>
            </button>
          )}
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div className="h-full bg-brand transition-all" style={{ width: `${progressPercent(state)}%` }} />
        </div>
        {(voice.error || (listening && voice.heard)) && (
          <p className="py-1 text-xs text-muted" role="status">
            {voice.error ?? `Heard: “${voice.heard}”. Say “next”, “back”, “repeat”, “start timer”.`}
          </p>
        )}
      </header>

      {/* Phone-sized screens: switch between step and ingredients */}
      <div className="flex gap-1 border-b border-border p-2 md:hidden" role="tablist">
        {(["step", "ingredients"] as const).map((pane) => (
          <button
            key={pane}
            role="tab"
            aria-selected={mobilePane === pane}
            onClick={() => setMobilePane(pane)}
            className="flex-1 rounded-lg py-2 text-sm aria-selected:bg-brand-soft aria-selected:font-semibold"
          >
            {pane === "step" ? "Steps" : `Ingredients (${ingredients.length})`}
          </button>
        ))}
      </div>

      {/* Split view */}
      <div className="grid min-h-0 flex-1 md:grid-cols-[minmax(260px,2fr)_3fr]">
        <aside
          className={`min-h-0 overflow-y-auto border-r border-border p-4 ${mobilePane === "ingredients" ? "block" : "hidden"} md:block`}
          aria-label="Ingredients"
        >
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Ingredients</h2>
          <IngredientList
            ingredients={ingredients}
            highlightIds={step?.ingredientIds}
            checkedIds={state.checkedIngredients}
            onToggle={(id) => dispatch({ type: "toggle-ingredient", id })}
            autoScroll
            large
          />
        </aside>

        <section
          className={`min-h-0 overflow-y-auto p-4 ${mobilePane === "step" ? "block" : "hidden"} md:block`}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          aria-label="Steps"
        >
          <ol ref={stepsRef} className="mx-auto max-w-2xl space-y-3 pb-24">
            {recipe.steps.map((s, i) => {
              const current = i === state.stepIndex;
              const done = state.completed[i];
              return (
                <li key={s.id} data-step={i} aria-current={current ? "step" : undefined}>
                  <button
                    onClick={() => dispatch({ type: "goto", index: i })}
                    className={[
                      "flex w-full gap-4 rounded-md border p-4 text-left transition-all",
                      current
                        ? "border-highlight-ring bg-highlight text-xl leading-relaxed shadow-md ring-2 ring-highlight-ring sm:text-2xl"
                        : "border-border bg-surface text-base",
                      !current && done ? "opacity-50" : "",
                      !current && !done ? "opacity-80" : "",
                    ].join(" ")}
                  >
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-full font-semibold ${done && !current ? "bg-success text-white" : "bg-brand-soft text-brand-strong"}`}
                    >
                      {done && !current ? "✓" : i + 1}
                    </span>
                    <span className="flex-1">
                      {s.group && s.group !== recipe.steps[i - 1]?.group && (
                        <span className="mb-1 block text-xs font-semibold tracking-wide text-muted uppercase">{s.group}</span>
                      )}
                      {s.text}
                    </span>
                  </button>
                  {current && stepIngredients.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 md:hidden" aria-label="Ingredients for this step">
                      {stepIngredients.map((ing) => (
                        <span key={ing.id} className="chip border-highlight-ring bg-highlight">
                          {formatIngredient(ing)}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      {/* Running timers */}
      {timers.length > 0 && (
        <div className="pointer-events-none fixed right-3 bottom-24 z-[45] flex flex-col items-end gap-2">
          {timers.map((t) => {
            const left = timerRemaining(t, now);
            return (
              <div
                key={t.id}
                role="timer"
                className={`pointer-events-auto flex items-center gap-2 rounded-full border px-3 py-2 shadow-lg ${t.done ? "animate-pulse border-danger bg-danger text-white" : "border-border bg-surface"}`}
              >
                <span className="text-sm">{t.label}</span>
                <span className="font-mono text-lg font-semibold tabular-nums">{t.done ? "Done!" : formatClock(left)}</span>
                {!t.done &&
                  (t.endsAt ? (
                    <button className="text-sm underline" onClick={() => pause(t.id)}>
                      Pause
                    </button>
                  ) : (
                    <button className="text-sm underline" onClick={() => start(t.id, t.label, t.totalSeconds)}>
                      Resume
                    </button>
                  ))}
                <button aria-label={`Dismiss ${t.label} timer`} className="px-1" onClick={() => dismiss(t.id)}>
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom controls */}
      <footer className="safe-bottom border-t border-border bg-surface px-3 py-3">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <button className="btn min-h-14 flex-1 text-lg" onClick={previous} disabled={state.stepIndex === 0}>
            ← Back
          </button>
          <div className="flex flex-col items-center px-2 text-sm text-muted">
            <span aria-live="polite">
              Step {state.stepIndex + 1} of {recipe.steps.length}
            </span>
            {step?.timerSeconds && (!stepTimer || stepTimer.done) ? (
              <button className="btn-ghost min-h-9 py-1" onClick={startStepTimer}>
                ⏱ Start {formatClock(step.timerSeconds)}
              </button>
            ) : null}
          </div>
          <button className="btn-primary min-h-14 flex-1 text-lg" onClick={next}>
            {isLast ? "Finish ✓" : "Next →"}
          </button>
        </div>
      </footer>

      {showFinished && isFinished(state) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal aria-labelledby="done-title">
          <div className="card max-w-sm p-6 text-center">
            <p className="text-5xl" aria-hidden>
              🎉
            </p>
            <h2 id="done-title" className="mt-2 text-2xl font-bold">
              Enjoy your meal!
            </h2>
            <p className="mt-2 text-muted">You finished {recipe.title}.</p>
            <div className="mt-6 flex justify-center gap-2">
              <button
                className="btn"
                onClick={() => {
                  dispatch({ type: "reset" });
                  setShowFinished(false);
                }}
              >
                Start over
              </button>
              <Link href={exitHref} className="btn-primary">
                Done
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { parseVoiceCommand, type VoiceCommand } from "@/lib/voiceCommands";

/* Minimal typings for the Web Speech API (not in TypeScript's DOM lib). */
interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Read text aloud with the device's built-in voice. */
export function useSpeaker() {
  const speakingRef = useRef(false);
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  const speak = useCallback(
    (text: string) => {
      if (!supported) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      utterance.onstart = () => (speakingRef.current = true);
      utterance.onend = utterance.onerror = () => (speakingRef.current = false);
      window.speechSynthesis.speak(utterance);
    },
    [supported],
  );

  const cancel = useCallback(() => {
    if (supported) window.speechSynthesis.cancel();
    speakingRef.current = false;
  }, [supported]);

  useEffect(() => cancel, [cancel]);
  return { speak, cancel, supported, speakingRef };
}

/**
 * Listen for hands-free commands ("next", "repeat", "start timer").
 * Recognition stops on its own after silence, so restart it while enabled.
 */
export function useVoiceCommands(
  enabled: boolean,
  onCommand: (cmd: VoiceCommand) => void,
  isSpeaking?: () => boolean,
) {
  const [error, setError] = useState<string | null>(null);
  const [heard, setHeard] = useState("");
  const commandRef = useRef(onCommand);
  const speakingRef = useRef(isSpeaking);
  useLayoutEffect(() => {
    commandRef.current = onCommand;
    speakingRef.current = isSpeaking;
  });
  const supported = getRecognition() !== null;

  useEffect(() => {
    const Ctor = getRecognition();
    if (!enabled || !Ctor) return;
    let active = true;
    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = navigator.language || "en-US";
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        if (!result.isFinal) continue;
        // Ignore the app hearing its own read-aloud voice.
        if (speakingRef.current?.()) continue;
        const transcript = result[0].transcript;
        setHeard(transcript);
        const cmd = parseVoiceCommand(transcript);
        if (cmd) commandRef.current(cmd);
      }
    };
    rec.onstart = () => setError(null);
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        active = false;
        setError("Microphone access was blocked. Allow it in your browser settings to use voice control.");
      }
    };
    rec.onend = () => {
      if (active) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };
    try {
      rec.start();
    } catch {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off report when the browser refuses to start
      setError("Voice control couldn't start.");
    }
    return () => {
      active = false;
      rec.onend = null;
      rec.stop();
    };
  }, [enabled]);

  return { supported, error: enabled ? error : null, heard };
}

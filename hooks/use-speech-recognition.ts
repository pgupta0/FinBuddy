"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Thin wrapper around the browser's built-in Web Speech API
 * (SpeechRecognition / webkitSpeechRecognition). No server calls, no API
 * keys — this is why support varies: solid in Chrome and Edge, partial in
 * Safari, effectively absent in Firefox. `isSupported` reflects that so
 * callers can hide the mic button rather than show a button that fails
 * silently.
 *
 * The hook only ever reports a transcript via onResult; it does not touch
 * whatever text field it's feeding, so the caller decides how to merge the
 * spoken text with anything already typed.
 */

type SpeechRecognitionResult = { 0: { transcript: string }; isFinal: boolean };

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
};

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = typeof window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as SpeechWindow;
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}

export function useSpeechRecognition({
  onResult,
  lang = "en-IN",
}: {
  onResult: (transcript: string, isFinal: boolean) => void;
  lang?: string;
}) {
  // Lazy initializer instead of an effect: this is a one-time synchronous
  // feature check, not a subscription to an external system.
  const [isSupported] = useState(() => !!getSpeechRecognitionConstructor());
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  // Keep the latest onResult without re-creating the recognition instance
  // every time the caller's callback identity changes.
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  });

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let transcript = "";
      let isFinal = false;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
        if (event.results[i].isFinal) isFinal = true;
      }
      onResultRef.current(transcript, isFinal);
    };

    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  }, [lang]);

  useEffect(() => stop, [stop]);

  return { isSupported, isListening, start, stop };
}

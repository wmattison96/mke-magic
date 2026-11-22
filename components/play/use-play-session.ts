"use client";

import { useCallback, useSyncExternalStore } from "react";
import { parsePlaySession } from "@/lib/play/state";
import type { PlaySession } from "@/lib/play/state";

export const PLAY_SESSION_STORAGE_KEY = "mke-magic:play-session:v1";
const STORAGE_EVENT = "mke-magic-play-session-change";
const STORAGE_UNAVAILABLE = "\u0000storage-unavailable";

function subscribe(onChange: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === PLAY_SESSION_STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(STORAGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(STORAGE_EVENT, onChange);
  };
}

function getSnapshot() {
  try {
    return window.localStorage.getItem(PLAY_SESSION_STORAGE_KEY);
  } catch {
    return STORAGE_UNAVAILABLE;
  }
}

function getServerSnapshot() {
  return null;
}

function notifyChanged() {
  window.dispatchEvent(new Event(STORAGE_EVENT));
}

export function savePlaySession(session: PlaySession): boolean {
  try {
    window.localStorage.setItem(PLAY_SESSION_STORAGE_KEY, JSON.stringify(session));
    notifyChanged();
    return true;
  } catch {
    return false;
  }
}

export function clearPlaySession(): boolean {
  try {
    window.localStorage.removeItem(PLAY_SESSION_STORAGE_KEY);
    notifyChanged();
    return true;
  } catch {
    return false;
  }
}

export function usePlaySessionStore() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const session = raw === STORAGE_UNAVAILABLE ? null : parsePlaySession(raw);
  const invalidStoredSession = raw !== null && raw !== STORAGE_UNAVAILABLE && session === null;
  const storageUnavailable = raw === STORAGE_UNAVAILABLE;
  const hasStoredValue = raw !== null && raw !== STORAGE_UNAVAILABLE;
  const save = useCallback((value: PlaySession) => savePlaySession(value), []);
  const clear = useCallback(() => clearPlaySession(), []);
  return { session, invalidStoredSession, storageUnavailable, hasStoredValue, save, clear };
}

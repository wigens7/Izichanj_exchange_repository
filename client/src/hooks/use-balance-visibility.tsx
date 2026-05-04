import { useSyncExternalStore, useCallback } from "react";

const STORAGE_KEY = "izichanj_balance_visible";
const EVENT = "izichanj:balance-visibility-changed";

function read(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === null) return true;
    return v === "1";
  } catch {
    return true;
  }
}

function subscribe(cb: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useBalanceVisibility() {
  const visible = useSyncExternalStore(subscribe, read, () => true);

  const setVisible = useCallback((next: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, []);

  const toggle = useCallback(() => setVisible(!read()), [setVisible]);

  const mask = useCallback(
    (text: string | number, masked = "•••••") => (visible ? String(text) : masked),
    [visible],
  );

  return { visible, setVisible, toggle, mask };
}

import { useSyncExternalStore, useCallback } from "react";

const STORAGE_KEY = "izichanj_balance_visible";
const MIGRATION_KEY = "izichanj_balance_visible_default_hidden_migrated";
const EVENT = "izichanj:balance-visibility-changed";

// One-time migration: existing users who used the app before the
// "default hidden" change still have STORAGE_KEY="1" in localStorage.
// Reset them to hidden once so the new default applies — and then
// remember we did it so we never override their later choice.
function runMigrationOnce() {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(MIGRATION_KEY) === "1") return;
    window.localStorage.setItem(STORAGE_KEY, "0");
    window.localStorage.setItem(MIGRATION_KEY, "1");
  } catch {}
}

function read(): boolean {
  if (typeof window === "undefined") return false;
  try {
    runMigrationOnce();
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === null) return false;
    return v === "1";
  } catch {
    return false;
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
  const visible = useSyncExternalStore(subscribe, read, () => false);

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

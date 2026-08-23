import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import type { UnlockScreenProps } from "../UnlockScreen.types.ts";

export function useUnlockScreen(
  onUnlock: UnlockScreenProps["onUnlock"],
  phase: UnlockScreenProps["phase"],
  allowEmptyPassphrase: boolean,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showPassphrase, setShowPassphrase] = useState(false);

  useEffect(() => {
    if (phase === "locked" || phase === "error") {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [phase]);

  const togglePassphrase = () => {
    setShowPassphrase((visible) => !visible);
  };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = inputRef.current;
    if (
      input === null ||
      (input.value.length === 0 && !allowEmptyPassphrase)
    ) {
      input?.focus();
      return;
    }

    const passphrase = input.value;
    // The phrase leaves the DOM immediately and only survives in this handler.
    input.value = "";
    try {
      await onUnlock(passphrase);
    } finally {
      if (inputRef.current !== null) {
        inputRef.current.value = "";
        inputRef.current.focus();
      }
    }
  };

  return {
    inputRef,
    showPassphrase,
    submit,
    togglePassphrase,
  };
}

import { useId } from "react";

import { useUnlockScreen } from "./hooks/UnlockScreen.hooks.ts";
import styles from "./UnlockScreen.module.css";
import type { UnlockScreenProps } from "./UnlockScreen.types.ts";

export function UnlockScreen({
  allowEmptyPassphrase = false,
  blockedReason,
  error,
  notice,
  onUnlock,
  onReloadVault,
  phase,
}: UnlockScreenProps) {
  const errorId = useId();
  const inputId = useId();
  const { inputRef, remember, setRemember, showPassphrase, submit, togglePassphrase } =
    useUnlockScreen(onUnlock, phase, allowEmptyPassphrase);
  const pending = phase === "unlocking";
  const blocked = blockedReason !== null;

  return (
    <>
      <title>Desbloquear bóveda · My Expenses</title>
      <main aria-busy={pending} className={styles.root}>
        <section aria-labelledby="unlock-title" className={styles.card}>
          <h1 className={styles.title} id="unlock-title">Bóveda bloqueada</h1>

          {blocked ? (
            <p className={styles.blocked} role="alert">{blockedReason}</p>
          ) : null}

          {phase === "error" && error !== null ? (
            <div>
              <p className={styles.error} id={errorId} role="alert">{error}</p>
              {onReloadVault !== undefined && !blocked ? (
                <button className={styles.reload} onClick={onReloadVault} type="button">
                  Reintentar
                </button>
              ) : null}
            </div>
          ) : null}

          {notice ? <p className={styles.error} role="alert">{notice}</p> : null}

          <form className={styles.form} onSubmit={submit}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor={inputId}>Frase de desbloqueo</label>
              <span className={styles.inputFrame}>
                <input
                  aria-describedby={phase === "error" && error !== null ? errorId : undefined}
                  aria-invalid={phase === "error" && error !== null}
                  autoComplete="current-password"
                  className={styles.input}
                  disabled={pending || blocked}
                  id={inputId}
                  name="passphrase"
                  ref={inputRef}
                  required={!allowEmptyPassphrase}
                  spellCheck={false}
                  type={showPassphrase ? "text" : "password"}
                />
                <button
                  aria-label={showPassphrase ? "Ocultar frase" : "Mostrar frase"}
                  aria-pressed={showPassphrase}
                  className={styles.visibility}
                  disabled={pending || blocked}
                  onClick={togglePassphrase}
                  type="button"
                >
                  {showPassphrase ? "Ocultar" : "Mostrar"}
                </button>
              </span>
            </div>
            <label className={styles.remember}>
              <input
                checked={remember}
                disabled={pending || blocked}
                onChange={(event) => setRemember(event.currentTarget.checked)}
                type="checkbox"
              />
              <span>Recordar en este dispositivo</span>
            </label>
            <p className={styles.rememberNote}>Quien use este navegador podrá abrir la bóveda sin la frase.</p>
            <button className={styles.submit} disabled={pending || blocked} type="submit">
              <span aria-hidden="true" className={styles.submitMark} />
              {pending ? "Desbloqueando…" : "Abrir bóveda"}
            </button>
            {pending ? <output className={styles.visuallyHidden}>Desbloqueando la bóveda</output> : null}
          </form>
        </section>
      </main>
    </>
  );
}

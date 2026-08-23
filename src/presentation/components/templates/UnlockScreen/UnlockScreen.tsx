import { useId } from "react";

import { useUnlockScreen } from "./hooks/UnlockScreen.hooks.ts";
import styles from "./UnlockScreen.module.css";
import type { UnlockScreenProps } from "./UnlockScreen.types.ts";

export function UnlockScreen({
  blockedReason,
  error,
  onUnlock,
  phase,
}: UnlockScreenProps) {
  const errorId = useId();
  const hintId = useId();
  const inputId = useId();
  const { inputRef, showPassphrase, submit, togglePassphrase } =
    useUnlockScreen(onUnlock, phase);
  const pending = phase === "unlocking";
  const blocked = blockedReason !== null;

  return (
    <>
      <title>Desbloquear bóveda · My Expenses</title>
      <main aria-busy={pending} className={styles.root}>
        <section aria-labelledby="unlock-title" className={styles.card}>
          <div aria-hidden="true" className={styles.vaultPanel}>
            <div className={styles.seal}>
              <span className={styles.keyhole} />
            </div>
            <p className={styles.vaultIndex}>ME / 189</p>
            <p className={styles.vaultCaption}>Archivo financiero sellado</p>
          </div>

          <div className={styles.content}>
            <header className={styles.header}>
              <span className={styles.eyebrow}>Bóveda estática · sólo navegador</span>
              <h1 className={styles.title} id="unlock-title">
                Abrir el libro cifrado
              </h1>
              <p className={styles.description}>
                Introduce la frase que protege esta instantánea. La aplicación no
                solicita ni procesa datos antes de este gesto.
              </p>
            </header>

            {blocked ? (
              <div className={styles.blocked} role="alert">
                <strong>Conexión no segura</strong>
                <span>{blockedReason}</span>
              </div>
            ) : null}

            {phase === "error" && error !== null ? (
              <p className={styles.error} id={errorId} role="alert">
                {error}
              </p>
            ) : null}

            <form className={styles.form} onSubmit={submit}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor={inputId}>
                  Frase de desbloqueo
                </label>
                <span className={styles.fieldHint} id={hintId}>
                  No se guarda; el campo se vacía al iniciar cada intento.
                </span>
                <span className={styles.inputFrame}>
                  <input
                    aria-describedby={`${hintId}${phase === "error" ? ` ${errorId}` : ""}`}
                    aria-invalid={phase === "error"}
                    autoComplete="current-password"
                    className={styles.input}
                    disabled={pending || blocked}
                    id={inputId}
                    name="passphrase"
                    ref={inputRef}
                    required
                    spellCheck={false}
                    type={showPassphrase ? "text" : "password"}
                  />
                  <button
                    aria-label={
                      showPassphrase ? "Ocultar frase" : "Mostrar frase"
                    }
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
              <button
                className={styles.submit}
                disabled={pending || blocked}
                type="submit"
              >
                <span aria-hidden="true" className={styles.submitMark} />
                {pending ? "Desbloqueando…" : "Abrir bóveda"}
              </button>
              {pending ? (
                <output className={styles.visuallyHidden}>
                  Desbloqueando la bóveda
                </output>
              ) : null}
            </form>

            <aside
              aria-label="Aviso de seguridad"
              className={styles.warning}
            >
              <strong>Protección frente a copias públicas</strong>
              <p>
                Una persona que descargue el archivo puede intentar adivinar la
                frase sin conectarse de nuevo. Usa una frase larga, única y
                aleatoria; no reutilices una contraseña personal.
              </p>
            </aside>

            <footer className={styles.footer}>
              <span>Cifrado autenticado</span>
              <span>La frase no se persiste</span>
              <span>Bloqueo manual y tras 15 min sin actividad</span>
            </footer>
          </div>
        </section>
      </main>
    </>
  );
}

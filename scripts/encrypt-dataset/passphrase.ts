import { emitKeypressEvents } from "node:readline";
import type { Key } from "node:readline";
import type { ReadStream, WriteStream } from "node:tty";

import {
    STATIC_VAULT_MAX_PASSPHRASE_BYTES,
    validateStaticVaultPassphrase,
} from "../../src/domain/security/static-vault.ts";
import { DatasetEncryptionError } from "./errors.ts";
import { readLimitedRegularFile } from "./files.ts";

export type HiddenPassphraseReader = (prompt: string) => Promise<string>;

function isPrintableSequence(value: string): boolean {
    return [...value].every((character) => {
        const codePoint = character.codePointAt(0);
        return codePoint !== undefined && codePoint >= 0x20 && codePoint !== 0x7f;
    });
}

function stripTerminalLineEnding(source: Buffer): Buffer {
    let end = source.byteLength;
    if (end > 0 && source[end - 1] === 0x0a) {
        end--;
        if (end > 0 && source[end - 1] === 0x0d) end--;
    }
    return source.subarray(0, end);
}

export async function readPassphraseFile(filePath: string): Promise<string> {
    const maximumFileBytes = STATIC_VAULT_MAX_PASSPHRASE_BYTES + 2;
    const source = await readLimitedRegularFile(
        filePath,
        maximumFileBytes,
        "Passphrase file",
        { requirePrivateMode: true },
    );
    try {
        const passphraseBytes = stripTerminalLineEnding(source);
        let passphrase: string;
        try {
            passphrase = new TextDecoder("utf-8", { fatal: true }).decode(
                passphraseBytes,
            );
        } catch (error) {
            throw new DatasetEncryptionError(
                "INVALID_INPUT",
                "Passphrase file must contain valid UTF-8",
                { cause: error },
            );
        }
        if (passphrase.includes("\n") || passphrase.includes("\r")) {
            throw new DatasetEncryptionError(
                "INVALID_INPUT",
                "Passphrase file must contain exactly one line",
            );
        }
        validateStaticVaultPassphrase(passphrase);
        return passphrase;
    } finally {
        source.fill(0);
    }
}

export function readHiddenPassphrase(
    prompt: string,
    input: ReadStream = process.stdin,
    output: Pick<WriteStream, "write"> = process.stderr,
): Promise<string> {
    if (!input.isTTY || typeof input.setRawMode !== "function") {
        throw new DatasetEncryptionError(
            "TTY_REQUIRED",
            "A TTY is required unless --passphrase-file is provided",
        );
    }
    output.write(prompt);
    emitKeypressEvents(input);
    const characters: string[] = [];
    const wasRaw = input.isRaw;
    const wasPaused = input.isPaused();
    input.setRawMode(true);
    input.resume();

    return new Promise((resolve, reject) => {
        let settled = false;
        const cleanup = (): void => {
            input.off("keypress", onKeypress);
            input.off("error", onError);
            input.off("end", onEnd);
            try {
                input.setRawMode(wasRaw);
            } catch {
                // Best effort after terminal errors; secret characters are still cleared.
            }
            if (wasPaused) input.pause();
            characters.fill("");
        };
        const complete = (): void => {
            if (settled) return;
            settled = true;
            const value = characters.join("");
            output.write("\n");
            cleanup();
            resolve(value);
        };
        const cancel = (error: DatasetEncryptionError): void => {
            if (settled) return;
            settled = true;
            output.write("\n");
            cleanup();
            reject(error);
        };
        function onKeypress(sequence: string | undefined, key: Key): void {
            if (key.ctrl === true && key.name === "c") {
                cancel(
                    new DatasetEncryptionError(
                        "INVALID_INPUT",
                        "Passphrase entry was cancelled",
                    ),
                );
                return;
            }
            if (key.name === "return" || key.name === "enter") {
                complete();
                return;
            }
            if (key.name === "backspace") {
                characters.pop();
                return;
            }
            if (
                sequence !== undefined &&
                sequence.length > 0 &&
                key.ctrl !== true &&
                key.meta !== true &&
                key.name !== "escape" &&
                isPrintableSequence(sequence)
            ) {
                characters.push(sequence);
                if (
                    new TextEncoder().encode(characters.join("")).byteLength >
                    STATIC_VAULT_MAX_PASSPHRASE_BYTES
                ) {
                    cancel(
                        new DatasetEncryptionError(
                            "INVALID_INPUT",
                            "Passphrase exceeds its UTF-8 size limit",
                        ),
                    );
                }
            }
        }
        function onError(error: Error): void {
            cancel(
                new DatasetEncryptionError(
                    "INVALID_INPUT",
                    "Passphrase could not be read from the terminal",
                    { cause: error },
                ),
            );
        }
        function onEnd(): void {
            cancel(
                new DatasetEncryptionError(
                    "INVALID_INPUT",
                    "Terminal input ended before passphrase confirmation",
                ),
            );
        }
        input.on("keypress", onKeypress);
        input.once("error", onError);
        input.once("end", onEnd);
    });
}

export async function promptForConfirmedPassphrase(
    readHidden: HiddenPassphraseReader = (prompt) => readHiddenPassphrase(prompt),
): Promise<string> {
    const first = await readHidden("Vault passphrase: ");
    validateStaticVaultPassphrase(first);
    const confirmation = await readHidden("Confirm passphrase: ");
    validateStaticVaultPassphrase(confirmation);
    if (first !== confirmation) {
        throw new DatasetEncryptionError(
            "PASSPHRASE_MISMATCH",
            "Passphrase confirmation does not match",
        );
    }
    return first;
}

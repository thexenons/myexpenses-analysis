import assert from "node:assert/strict";
import test from "node:test";

import {
    parseEncryptDatasetArguments,
    runEncryptDatasetCli,
} from "./cli.ts";
import type { EncryptDatasetOptions } from "./encrypt-dataset.ts";

const PASSPHRASE = "correct horse battery staple";

test("parses defaults, passphrase file and pnpm's forwarded separator", () => {
    assert.deepEqual(parseEncryptDatasetArguments([]), {
        inputPath: "data/app-dataset.json",
        outputPath: "data/app-dataset.vault.json",
    });
    assert.deepEqual(
        parseEncryptDatasetArguments([
            "--",
            "--input=input.json",
            "--output=output.json",
            "--passphrase-file=secret.txt",
        ]),
        {
            inputPath: "input.json",
            outputPath: "output.json",
            passphraseFilePath: "secret.txt",
        },
    );
    assert.throws(
        () => parseEncryptDatasetArguments(["--passphrase=forbidden"]),
        /invalid command-line options/iu,
    );
});

test("uses only passphrase-file when provided and prints a non-sensitive summary", async () => {
    let received: EncryptDatasetOptions | undefined;
    let promptCalls = 0;
    const output: string[] = [];
    const errors: string[] = [];
    const exitCode = await runEncryptDatasetCli(
        ["--passphrase-file=/private/secret.txt"],
        {
            encrypt: async (options) => {
                received = options;
                return { compressedBytes: 50, inputBytes: 100, outputBytes: 200 };
            },
            promptForPassphrase: async () => {
                promptCalls++;
                return "must not be used";
            },
            readPassphraseFile: async () => PASSPHRASE,
            stderr: (message) => errors.push(message),
            stdout: (message) => output.push(message),
        },
    );

    assert.equal(exitCode, 0);
    assert.equal(promptCalls, 0);
    assert.equal(received?.passphrase, PASSPHRASE);
    assert.deepEqual(errors, []);
    assert.equal(
        output.join(""),
        "Encrypted dataset: 100 bytes, 50 compressed, 200 in vault.\n",
    );
    assert.doesNotMatch(output.join(""), /private|secret|correct horse/iu);
});

test("prompts when no file exists and never accepts a passphrase argument", async () => {
    let receivedPassphrase: string | undefined;
    const exitCode = await runEncryptDatasetCli([], {
        encrypt: async (options) => {
            receivedPassphrase = options.passphrase;
            return { compressedBytes: 1, inputBytes: 1, outputBytes: 1 };
        },
        promptForPassphrase: async () => PASSPHRASE,
        stderr: () => undefined,
        stdout: () => undefined,
    });
    assert.equal(exitCode, 0);
    assert.equal(receivedPassphrase, PASSPHRASE);

    const errors: string[] = [];
    const forbidden = await runEncryptDatasetCli(["--passphrase=visible"], {
        stderr: (message) => errors.push(message),
        stdout: () => undefined,
    });
    assert.equal(forbidden, 1);
    assert.match(errors.join(""), /invalid command-line options/iu);
    assert.doesNotMatch(errors.join(""), /visible/u);
});

test("redacts unknown encryption errors", async () => {
    const errors: string[] = [];
    const exitCode = await runEncryptDatasetCli([], {
        encrypt: async () => {
            throw new Error("correct horse battery staple /private/input.json");
        },
        promptForPassphrase: async () => PASSPHRASE,
        stderr: (message) => errors.push(message),
        stdout: () => undefined,
    });
    assert.equal(exitCode, 1);
    assert.match(errors.join(""), /unexpected encryption failure/iu);
    assert.doesNotMatch(errors.join(""), /correct horse|private\/input/iu);
});

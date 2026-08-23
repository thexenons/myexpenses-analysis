import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

import {
    encryptDataset,
    type EncryptDatasetOptions,
    type EncryptDatasetResult,
} from "./encrypt-dataset.ts";
import {
    promptForConfirmedPassphrase,
    readPassphraseFile,
} from "./passphrase.ts";
import { StaticVaultValidationError } from "../../src/domain/security/static-vault.ts";
import { DatasetEncryptionError } from "./errors.ts";

const DEFAULT_INPUT_PATH = "data/app-dataset.json";
const DEFAULT_OUTPUT_PATH = "data/app-dataset.vault.json";

export interface EncryptDatasetCliArguments {
    readonly inputPath: string;
    readonly outputPath: string;
    readonly passphraseFilePath?: string;
}

export interface EncryptDatasetCliDependencies {
    readonly encrypt?: (
        options: EncryptDatasetOptions,
    ) => Promise<EncryptDatasetResult>;
    readonly promptForPassphrase?: () => Promise<string>;
    readonly readPassphraseFile?: (filePath: string) => Promise<string>;
    readonly stderr?: (message: string) => void;
    readonly stdout?: (message: string) => void;
}

interface ParsedCliValues {
    readonly input: string;
    readonly output: string;
    readonly "passphrase-file"?: string;
}

export function parseEncryptDatasetArguments(
    args: readonly string[],
): EncryptDatasetCliArguments {
    const forwardedArgs = args[0] === "--" ? args.slice(1) : args;
    let values: ParsedCliValues;
    try {
        const parsed = parseArgs({
            allowPositionals: false,
            args: [...forwardedArgs],
            options: {
                input: { default: DEFAULT_INPUT_PATH, type: "string" },
                output: { default: DEFAULT_OUTPUT_PATH, type: "string" },
                "passphrase-file": { type: "string" },
            },
            strict: true,
        });
        values = parsed.values;
    } catch {
        throw new DatasetEncryptionError(
            "INVALID_INPUT",
            "Invalid command-line options",
        );
    }
    if (values.input.trim().length === 0) {
        throw new DatasetEncryptionError("INVALID_INPUT", "--input must not be empty");
    }
    if (values.output.trim().length === 0) {
        throw new DatasetEncryptionError("INVALID_INPUT", "--output must not be empty");
    }
    if (
        values["passphrase-file"] !== undefined &&
        values["passphrase-file"].trim().length === 0
    ) {
        throw new DatasetEncryptionError(
            "INVALID_INPUT",
            "--passphrase-file must not be empty",
        );
    }
    return {
        inputPath: values.input,
        outputPath: values.output,
        ...(values["passphrase-file"] === undefined
            ? {}
            : { passphraseFilePath: values["passphrase-file"] }),
    };
}

export async function runEncryptDatasetCli(
    args: readonly string[],
    dependencies: EncryptDatasetCliDependencies = {},
): Promise<number> {
    const writeError =
        dependencies.stderr ?? ((message: string) => process.stderr.write(message));
    const writeOutput =
        dependencies.stdout ?? ((message: string) => process.stdout.write(message));
    try {
        const parsed = parseEncryptDatasetArguments(args);
        const passphrase =
            parsed.passphraseFilePath === undefined
                ? await (dependencies.promptForPassphrase ??
                      promptForConfirmedPassphrase)()
                : await (dependencies.readPassphraseFile ?? readPassphraseFile)(
                      parsed.passphraseFilePath,
                  );
        const result = await (dependencies.encrypt ?? encryptDataset)({
            inputPath: parsed.inputPath,
            outputPath: parsed.outputPath,
            passphrase,
        });
        writeOutput(
            `Encrypted dataset: ${result.inputBytes} bytes, ` +
                `${result.compressedBytes} compressed, ` +
                `${result.outputBytes} in vault.\n`,
        );
        return 0;
    } catch (error) {
        const message =
            error instanceof DatasetEncryptionError ||
            error instanceof StaticVaultValidationError
                ? error.message
                : "Unexpected encryption failure";
        writeError(`Dataset encryption failed: ${message}\n`);
        return 1;
    }
}

const entryPoint = process.argv[1];
if (entryPoint !== undefined && import.meta.url === pathToFileURL(entryPoint).href) {
    process.exitCode = await runEncryptDatasetCli(process.argv.slice(2));
}

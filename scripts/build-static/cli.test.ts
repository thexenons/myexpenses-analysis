import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";

import { encryptCompressedDataset, serializeStaticVaultEnvelope } from "../../src/domain/security/static-vault.ts";
import { runBuildStaticCli, viteBuildArguments } from "./cli.ts";
import { DatasetEncryptionError } from "../encrypt-dataset/errors.ts";

test("CLI computes its own authenticated digest and never calls builder after wrong phrase", async () => {
  const root = await mkdtemp(join(tmpdir(), "build-static-cli-"));
  const vaultPath = join(root, "vault.json");
  const outputDirectory = join(root, "output");
  const previous = process.env.MYEXPENSES_VERIFIED_VAULT_SHA256;
  const passphrase = "correct horse battery staple";
  let calls = 0;
  try {
    const compressed = Uint8Array.of(31, 139, 8, 0, 0, 0, 0, 0, 2, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    const envelope = await encryptCompressedDataset(compressed, passphrase, globalThis.crypto);
    await writeFile(vaultPath, serializeStaticVaultEnvelope(envelope));
    process.env.MYEXPENSES_VERIFIED_VAULT_SHA256 = "0".repeat(64);
    const errors: string[] = [];
    const runBuild = async (vault: string, output: string, digest: string) => {
      calls += 1;
      assert.equal(vault, resolve(vaultPath));
      assert.equal(output, resolve(outputDirectory));
      assert.equal(digest, createHash("sha256").update(await readFile(vaultPath)).digest("hex"));
      assert.notEqual(digest, process.env.MYEXPENSES_VERIFIED_VAULT_SHA256);
    };
    assert.equal(await runBuildStaticCli(["--vault", vaultPath, "--out-dir", outputDirectory], {
      prompt: async () => "wrong phrase of adequate length", runBuild, stderr: (message) => errors.push(message),
    }), 1);
    assert.equal(calls, 0);
    assert.equal(await runBuildStaticCli(["--vault", vaultPath, "--out-dir", outputDirectory], {
      prompt: async () => passphrase, runBuild, stderr: (message) => errors.push(message),
    }), 0);
    assert.equal(calls, 1);
    const tampered = { ...envelope, ciphertext: `${envelope.ciphertext[0] === "A" ? "B" : "A"}${envelope.ciphertext.slice(1)}` };
    await writeFile(vaultPath, serializeStaticVaultEnvelope(tampered));
    assert.equal(await runBuildStaticCli(["--vault", vaultPath, "--out-dir", outputDirectory], {
      prompt: async () => passphrase, runBuild, stderr: (message) => errors.push(message),
    }), 1);
    assert.equal(calls, 1, "tampered bytes must fail before builder launch");
    assert.ok(errors.every((message) => !message.includes(passphrase)));
  } finally {
    if (previous === undefined) delete process.env.MYEXPENSES_VERIFIED_VAULT_SHA256;
    else process.env.MYEXPENSES_VERIFIED_VAULT_SHA256 = previous;
    await rm(root, { force: true, recursive: true });
  }
});

test("CLI reports a missing private passphrase input without invoking the builder", async () => {
  const errors: string[] = [];
  let built = false;
  assert.equal(await runBuildStaticCli(["--vault", "/synthetic/vault.json"], {
    prompt: async () => { throw new DatasetEncryptionError("TTY_REQUIRED", "A TTY is required unless --passphrase-file is provided"); },
    runBuild: async () => { built = true; },
    stderr: (message) => errors.push(message),
  }), 1);
  assert.equal(built, false);
  assert.match(errors.join(""), /TTY is required/iu);
});

test("CLI refuses destructive output targets before invoking the builder", async () => {
  const root = await mkdtemp(join(tmpdir(), "build-output-safety-"));
  const vaultPath = join(root, "vault.json");
  const keyPath = join(root, "key");
  const nonempty = join(root, "nonempty");
  const symlinkPath = join(root, "linked-output");
  const projectRoot = resolve(".");
  let built = 0;
  try {
    const compressed = Uint8Array.of(31, 139, 8, 0, 0, 0, 0, 0, 2, 3, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    const envelope = await encryptCompressedDataset(compressed, "correct horse battery staple", globalThis.crypto);
    await writeFile(vaultPath, serializeStaticVaultEnvelope(envelope));
    await writeFile(keyPath, "synthetic phrase file", { mode: 0o600 });
    await mkdir(nonempty);
    await writeFile(join(nonempty, "keep.txt"), "keep this file");
    await symlink(nonempty, symlinkPath);
    const runBuild = async () => { built += 1; };
    const options = { readPassphraseFile: async () => "correct horse battery staple", runBuild, stderr: () => undefined };
    for (const target of [projectRoot, dirname(projectRoot), join(projectRoot, "src"), root, vaultPath, keyPath, nonempty, symlinkPath]) {
      // oxlint-disable-next-line no-await-in-loop -- verify each independent dangerous target.
      assert.equal(await runBuildStaticCli(["--vault", vaultPath, "--out-dir", target, "--passphrase-file", keyPath], options), 1, target);
    }
    assert.equal(built, 0);
    assert.equal(await readFile(join(nonempty, "keep.txt"), "utf8"), "keep this file");
    assert.equal(await runBuildStaticCli(["--vault", vaultPath, "--out-dir", join(root, "fresh-output"), "--passphrase-file", keyPath], options), 0);
    assert.equal(built, 1);
    assert.equal(await runBuildStaticCli(["--vault", vaultPath, "--passphrase-file", keyPath], options), 0);
    assert.equal(built, 2, "the normal dist workflow remains available");
  } finally {
    await rm(root, { force: true, recursive: true });
  }
});

test("Vite invocation never forces clearing an outside-root output directory", () => {
  assert.deepEqual(viteBuildArguments("/synthetic/new-output"), ["build", "--outDir", "/synthetic/new-output"]);
});

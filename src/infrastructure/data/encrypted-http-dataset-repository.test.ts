import { beforeAll, describe, expect, it, vi } from "vitest";

import { DatasetTransportError } from "../../application/ports/dataset-repository.ts";
import type { BackupDatasetV1 } from "../../domain/analytics/backup-dataset.types.ts";
import {
  encryptCompressedDataset,
  STATIC_VAULT_MAX_ENVELOPE_BYTES,
  StaticVaultUnlockError,
} from "../../domain/security/static-vault.ts";
import type { StaticVaultEnvelopeV1 } from "../../domain/security/static-vault.types.ts";
import { createEncryptedHttpDatasetRepository } from "./encrypted-http-dataset-repository.ts";

const PASSPHRASE = "correct horse battery staple";
let envelope: StaticVaultEnvelopeV1;

function datasetFixture(): BackupDatasetV1 {
  return {
    version: 1,
    source: {
      format: "myexpenses-backup",
      schemaVersion: 189,
      backupSha256: "a".repeat(64),
      databaseSha256: "b".repeat(64),
    },
    preferences: {
      homeCurrency: "EUR",
      timeZone: "Europe/Madrid",
      monthStart: 1,
      weekStart: 1,
      includeTransfers: true,
    },
    currencies: [
      {
        sourceId: 1,
        code: "EUR",
        fractionDigits: 2,
        label: "Euro",
        symbol: "€",
        commodityType: "FIAT",
      },
    ],
    accounts: [
      {
        uuid: "account",
        sourceId: 1,
        label: "Cuenta",
        description: null,
        currency: "EUR",
        fractionDigits: 2,
        nativeType: "CASH",
        scope: "DEFAULT",
        parentUuid: null,
        openingNativeMinor: 0,
        openingHomeMinor: 0,
        exchangeRateMode: "IDENTITY",
        exchangeRateToHome: 1,
        flags: {
          sourceId: 0,
          visible: true,
          excludedFromTotals: false,
          includedInAll: true,
          isAsset: true,
          supportsReconciliation: false,
        },
      },
    ],
    categories: [],
    postings: [],
    payees: [],
    paymentMethods: [],
    tags: [],
    budgets: [],
  };
}

async function gzip(source: string): Promise<Uint8Array> {
  const body = new Response(new TextEncoder().encode(source)).body;
  if (body === null) throw new Error("Missing compression body");
  const stream = body.pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function envelopeResponse(
  value: unknown = envelope,
  status = 200,
): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeAll(async () => {
  envelope = await encryptCompressedDataset(
    await gzip(JSON.stringify(datasetFixture())),
    PASSPHRASE,
    globalThis.crypto,
  );
});

describe("encryptedHttpDatasetRepository", () => {
  it("fetches only the static vault and returns a strictly validated dataset", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        envelopeResponse(),
    );
    const repository = createEncryptedHttpDatasetRepository({
      crypto: globalThis.crypto,
      fetch: fetchMock,
    });
    const controller = new AbortController();

    const dataset = await repository.load(PASSPHRASE, controller.signal);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toMatch(
      /\/data\/app-dataset\.vault\.json$/,
    );
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
    expect(fetchMock.mock.calls[0]?.[1]?.cache).toBe("no-store");
    expect(dataset).toMatchObject({ version: 1 });
  });

  it("opens an explicitly empty development vault without persisting a phrase", async () => {
    const developmentEnvelope = await encryptCompressedDataset(
      await gzip(JSON.stringify(datasetFixture())),
      "",
      globalThis.crypto,
      { allowEmptyPassphraseForDevelopment: true },
    );
    const repository = createEncryptedHttpDatasetRepository({
      crypto: globalThis.crypto,
      fetch: vi.fn<typeof fetch>(async () =>
        envelopeResponse(developmentEnvelope),
      ),
    });

    await expect(repository.load("")).resolves.toMatchObject({ version: 1 });
  });

  it("preserves the indistinguishable authenticated-unlock error", async () => {
    const repository = createEncryptedHttpDatasetRepository({
      crypto: globalThis.crypto,
      fetch: vi.fn<typeof fetch>(async () => envelopeResponse()),
    });

    await expect(
      repository.load("this phrase is definitely wrong"),
    ).rejects.toBeInstanceOf(StaticVaultUnlockError);
  });

  it("caches only the immutable encrypted envelope across unlock retries", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => envelopeResponse());
    const repository = createEncryptedHttpDatasetRepository({
      crypto: globalThis.crypto,
      fetch: fetchMock,
    });

    await expect(
      repository.load("this phrase is definitely wrong"),
    ).rejects.toBeInstanceOf(StaticVaultUnlockError);
    await expect(repository.load(PASSPHRASE)).resolves.toMatchObject({
      version: 1,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("rejects HTTP and content-type failures before any KDF work", async () => {
    const httpRepository = createEncryptedHttpDatasetRepository({
      crypto: globalThis.crypto,
      fetch: vi.fn<typeof fetch>(async () => envelopeResponse({}, 503)),
    });
    await expect(httpRepository.load(PASSPHRASE)).rejects.toThrow(/HTTP 503/);
    await expect(httpRepository.load(PASSPHRASE)).rejects.toBeInstanceOf(
      DatasetTransportError,
    );

    const htmlRepository = createEncryptedHttpDatasetRepository({
      crypto: globalThis.crypto,
      fetch: vi.fn<typeof fetch>(
        async () => new Response("<html />", { status: 200 }),
      ),
    });
    await expect(htmlRepository.load(PASSPHRASE)).rejects.toThrow(
      /expected JSON/,
    );
  });

  it("enforces envelope limits from both headers and the streamed body", async () => {
    const oversizedHeader = createEncryptedHttpDatasetRepository({
      crypto: globalThis.crypto,
      fetch: vi.fn<typeof fetch>(
        async () =>
          new Response("{}", {
            headers: {
              "content-length": String(STATIC_VAULT_MAX_ENVELOPE_BYTES + 1),
              "content-type": "application/json",
            },
          }),
      ),
    });
    await expect(oversizedHeader.load(PASSPHRASE)).rejects.toBeInstanceOf(
      DatasetTransportError,
    );

    const chunkSize = 1024 * 1024;
    let emitted = 0;
    const oversizedStream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (emitted > STATIC_VAULT_MAX_ENVELOPE_BYTES) {
          controller.close();
          return;
        }
        emitted += chunkSize;
        controller.enqueue(new Uint8Array(chunkSize));
      },
    });
    const streamedRepository = createEncryptedHttpDatasetRepository({
      crypto: globalThis.crypto,
      fetch: vi.fn<typeof fetch>(
        async () =>
          new Response(oversizedStream, {
            headers: { "content-type": "application/json" },
          }),
      ),
    });
    await expect(streamedRepository.load(PASSPHRASE)).rejects.toBeInstanceOf(
      DatasetTransportError,
    );
  });

  it("rejects authenticated plaintext that is not a valid dataset", async () => {
    const invalidEnvelope = await encryptCompressedDataset(
      await gzip(JSON.stringify({ version: 1 })),
      PASSPHRASE,
      globalThis.crypto,
    );
    const repository = createEncryptedHttpDatasetRepository({
      crypto: globalThis.crypto,
      fetch: vi.fn<typeof fetch>(async () => envelopeResponse(invalidEnvelope)),
    });

    await expect(repository.load(PASSPHRASE)).rejects.toThrow(
      /missing property "source"/,
    );
  });

  it("classifies a structurally invalid published envelope as transport", async () => {
    const repository = createEncryptedHttpDatasetRepository({
      crypto: globalThis.crypto,
      fetch: vi.fn<typeof fetch>(
        async () =>
          new Response('{"format":"wrong"}', {
            headers: { "content-type": "application/json" },
          }),
      ),
    });

    await expect(repository.load(PASSPHRASE)).rejects.toBeInstanceOf(
      DatasetTransportError,
    );
  });

  it("honours cancellation before and during the request", async () => {
    const beforeFetch = vi.fn<typeof fetch>(async () => envelopeResponse());
    const beforeRepository = createEncryptedHttpDatasetRepository({
      crypto: globalThis.crypto,
      fetch: beforeFetch,
    });
    const alreadyAborted = new AbortController();
    alreadyAborted.abort();
    await expect(
      beforeRepository.load(PASSPHRASE, alreadyAborted.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(beforeFetch).not.toHaveBeenCalled();

    const abortError = new DOMException("Aborted", "AbortError");
    const duringFetch = vi.fn<typeof fetch>(
      async (_input: string | URL | Request, init?: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(abortError), {
            once: true,
          });
        }),
    );
    const duringRepository = createEncryptedHttpDatasetRepository({
      crypto: globalThis.crypto,
      fetch: duringFetch,
    });
    const controller = new AbortController();
    const load = duringRepository.load(PASSPHRASE, controller.signal);
    controller.abort();
    await expect(load).rejects.toBe(abortError);
  });
});

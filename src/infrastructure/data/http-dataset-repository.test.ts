import { afterEach, describe, expect, it, vi } from "vitest";

import { httpDatasetRepository } from "./http-dataset-repository.ts";

const responses: Record<string, unknown> = {
  "accounts.json": { version: 2, accounts: {} },
  "categories.json": {},
  "parsed-data.json": [],
};

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function requestFileName(input: string | URL | Request): string {
  return new URL(String(input), "http://localhost").pathname.split("/").at(-1) ?? "";
}

function installFetchOverride(
  fileName: string,
  response: () => Response,
) {
  const fetchMock = vi.fn(
    async (input: string | URL | Request, _init?: RequestInit) =>
      requestFileName(input) === fileName
        ? response()
        : jsonResponse(responses[requestFileName(input)]),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("httpDatasetRepository", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("loads every configured artifact and forwards the abort signal", async () => {
    const fetchMock = vi.fn(
      async (input: string | URL | Request, _init?: RequestInit) =>
        jsonResponse(responses[requestFileName(input)]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const dataset = await httpDatasetRepository.load(controller.signal);

    expect(
      fetchMock.mock.calls.map(([input]) => requestFileName(input)).toSorted(),
    ).toEqual(Object.keys(responses).toSorted());
    expect(
      fetchMock.mock.calls.every(([, init]) => init?.signal === controller.signal),
    ).toBe(true);
    expect(dataset.accounts.version).toBe(2);
    expect(dataset.parsedData).toEqual([]);
  });

  it("rejects unsuccessful HTTP responses", async () => {
    installFetchOverride(
      "accounts.json",
      () => new Response("Service unavailable", { status: 503 }),
    );

    await expect(httpDatasetRepository.load()).rejects.toThrow(
      /accounts data: HTTP 503/,
    );
  });

  it("rejects responses without a JSON content type", async () => {
    installFetchOverride(
      "accounts.json",
      () => new Response("<html />", { status: 200 }),
    );

    await expect(httpDatasetRepository.load()).rejects.toThrow(
      /accounts data: expected a JSON response/,
    );
  });

  it("rejects malformed JSON", async () => {
    installFetchOverride(
      "accounts.json",
      () =>
        new Response("{", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    await expect(httpDatasetRepository.load()).rejects.toThrow(
      /Could not parse accounts data as JSON/,
    );
  });

  it("rejects invalid dataset root shapes", async () => {
    installFetchOverride(
      "accounts.json",
      () => jsonResponse({ version: 1, accounts: [] }),
    );

    await expect(httpDatasetRepository.load()).rejects.toThrow(
      /Invalid accounts data shape/,
    );
  });

  it("forwards cancellation to every in-flight request", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, init?: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(abortError),
            { once: true },
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    const load = httpDatasetRepository.load(controller.signal);
    controller.abort();

    await expect(load).rejects.toMatchObject({
      cause: abortError,
      message: expect.stringMatching(/Could not fetch .* data/),
    });
    expect(
      fetchMock.mock.calls.every(([, init]) => init?.signal === controller.signal),
    ).toBe(true);
  });
});

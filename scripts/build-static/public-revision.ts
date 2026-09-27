/** Only a public hexadecimal Git identifier may reach browser assets. */
export function resolvePublicAppRevision(
  explicit: string | undefined,
  sourceCommit: string | undefined,
): string | null {
  const candidate = explicit === undefined || explicit === "" ? sourceCommit : explicit;
  return candidate !== undefined && /^[a-fA-F0-9]{7,64}$/u.test(candidate)
    ? candidate.toLowerCase()
    : null;
}

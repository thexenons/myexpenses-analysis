export function cx(
  ...classes: ReadonlyArray<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ")
}

export type ValueFormatter = (value: number) => string

const defaultNumberFormatter = new Intl.NumberFormat("es-ES", {
  maximumFractionDigits: 2,
})

export function formatNumber(
  value: number,
  formatter?: Intl.NumberFormat | ValueFormatter,
): string {
  if (typeof formatter === "function") {
    return formatter(value)
  }

  return (formatter ?? defaultNumberFormatter).format(value)
}

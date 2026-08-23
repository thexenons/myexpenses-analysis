import { describe, expect, it } from "vitest"

import globalCss from "./global.css?raw"

type Rgb = readonly [number, number, number]

function token(name: string): string {
  const match = new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i").exec(globalCss)
  if (match?.[1] === undefined) throw new Error(`Token ${name} no encontrado`)
  return match[1]
}

function rgb(hex: string): Rgb {
  return [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) as unknown as Rgb
}

function blend(foreground: string, background: string, alpha: number): string {
  const front = rgb(foreground)
  const back = rgb(background)
  return `#${front
    .map((channel, index) =>
      Math.round(channel * alpha + (back[index] ?? 0) * (1 - alpha))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`
}

function luminance(hex: string): number {
  const channels = rgb(hex).map((channel) => {
    const value = channel / 255
    return value <= 0.04045
      ? value / 12.92
      : ((value + 0.055) / 1.055) ** 2.4
  })
  return (
    (channels[0] ?? 0) * 0.2126 +
    (channels[1] ?? 0) * 0.7152 +
    (channels[2] ?? 0) * 0.0722
  )
}

function contrast(foreground: string, background: string): number {
  const foregroundLuminance = luminance(foreground)
  const backgroundLuminance = luminance(background)
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  )
}

function expectContrast(
  label: string,
  foreground: string,
  background: string,
  minimum: number,
): void {
  expect(
    contrast(foreground, background),
    `${label}: ${foreground} sobre ${background}`,
  ).toBeGreaterThanOrEqual(minimum)
}

describe("accessible color system", () => {
  it("keeps normal text at AA contrast on every solid semantic surface", () => {
    expect.hasAssertions()
    const paper = token("--paper")
    const paperDeep = token("--paper-deep")
    const bright = token("--surface-bright")
    const pairs = [
      ["ink / paper", token("--ink"), paper],
      ["ink-soft / paper", token("--ink-soft"), paper],
      ["muted / paper-deep", token("--muted"), paperDeep],
      ["income / income-soft", token("--income"), token("--income-soft")],
      ["expense / expense-soft", token("--expense"), token("--expense-soft")],
      ["transfer / transfer-soft", token("--transfer"), token("--transfer-soft")],
      ["debt-ink / debt-soft", token("--debt-ink"), token("--debt-soft")],
      ["accent-ink / accent", token("--accent-ink"), token("--accent")],
      ["ink / bright", token("--ink"), bright],
    ] as const

    for (const [label, foreground, background] of pairs) {
      expectContrast(label, foreground, background, 4.5)
    }
  })

  it("calculates translucent and color-mix states against their real backgrounds", () => {
    expect.hasAssertions()
    const bright = token("--surface-bright")
    const paper = token("--paper")
    const dark = token("--surface-ink")
    const raisedDark = token("--surface-ink-raised")
    const debtWarning = blend(token("--debt"), paper, 0.08)
    const errorSurface = blend(token("--expense"), bright, 0.07)

    expectContrast("warning copy / mixed warning", token("--muted"), debtWarning, 4.5)
    expectContrast("error copy / mixed error", token("--expense"), errorSurface, 4.5)
    for (const tone of [
      token("--income"),
      token("--expense"),
      token("--transfer"),
      token("--debt-ink"),
      token("--accent-ink"),
    ]) {
      expectContrast(
        `KPI tone ${tone} / mixed icon`,
        tone,
        blend(tone, bright, 0.11),
        4.5,
      )
    }
    expectContrast(
      "dark hero secondary text",
      blend(bright, raisedDark, 0.72),
      raisedDark,
      4.5,
    )
    expectContrast(
      "sidebar navigation at light gradient endpoint",
      blend("#f5f3e9", "#163128", 0.62),
      "#163128",
      4.5,
    )
    expectContrast(
      "sidebar navigation at dark gradient endpoint",
      blend("#f5f3e9", "#0b1d17", 0.62),
      "#0b1d17",
      4.5,
    )
    expectContrast(
      "debt summary secondary text",
      blend("#f7f3e7", dark, 0.58),
      dark,
      4.5,
    )
    expectContrast(
      "vault secondary text",
      blend("#ffffff", dark, 0.64),
      dark,
      4.5,
    )
  })

  it("keeps required control boundaries and chart marks at non-text contrast", () => {
    expect.hasAssertions()
    expectContrast(
      "form control boundary",
      token("--line-dark"),
      token("--surface-bright"),
      3,
    )
    const strongestBodyAccent = blend(token("--accent"), token("--paper"), 0.26)
    const panelSurface = blend(token("--surface"), strongestBodyAccent, 0.94)
    for (const chartColor of [
      "#286a4c",
      "#a33f36",
      "#35698b",
      "#bd7d2f",
      "#6d5f91",
      "#43817b",
      "#8b6945",
      "#697b34",
    ]) {
      expectContrast(
        `chart mark ${chartColor}`,
        chartColor,
        panelSurface,
        3,
      )
    }
  })
})

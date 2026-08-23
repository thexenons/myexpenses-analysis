import axe from "axe-core"

type AxeContext = Parameters<typeof axe.run>[0]

export async function getAxeViolations(
  context: AxeContext = document,
): Promise<axe.Result[]> {
  const result = await axe.run(context, {
    rules: {
      // jsdom does not perform layout or resolve CSS custom properties. Token
      // contrast is covered by deterministic tests against the real surfaces.
      "color-contrast": { enabled: false },
    },
  })

  return result.violations
}

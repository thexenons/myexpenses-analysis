# My Expenses Analysis

Herramientas TypeScript para validar un export de My Expenses y generar
estadísticas compatibles con la aplicación, junto con vistas adicionales de
deudas y flujo real.

## Flujo de datos

`data/export.ts` es la fuente canónica. El export JSON más reciente se conserva
como referencia y un test exige que ambos sean semánticamente idénticos.

```sh
pnpm install
pnpm scripts:parse-export
pnpm scripts:statistics
```

El primer comando valida el export y genera:

- `data/accounts.json`: registro por UUID; contiene tipos `DEBT` y configuración
  manual de moneda;
- `data/categories.json`: árbol y tipos de categoría;
- `data/parsed-data.json`: apuntes normalizados con procedencia de splits y
  estados.

El segundo genera `data/statistics.json`. Si existe alguna cuenta dinámica, su
caché histórica de Frankfurter v1 se crea de forma perezosa en
`data/exchange-rates.json`.

No se deben editar manualmente los artefactos generados salvo
`data/accounts.json`, que completa información que My Expenses no exporta.

## Verificación

```sh
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

La interfaz React de desarrollo se inicia con `pnpm dev`.

Consulta [el contrato de estadísticas](docs/statistics.md) para las reglas de
clasificación, conversión de moneda, significado de cada vista, limitaciones y
cifras de referencia actuales.

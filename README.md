# My Expenses Analysis

Aplicación React para explorar con detalle las cuentas, movimientos,
categorías y estadísticas de un export de My Expenses. Reproduce las cifras
base de la aplicación y añade vistas de flujo real, deudas, evolución temporal
y desglose por cuenta y categoría.

## Aplicación

```sh
pnpm install
pnpm dev
```

La interfaz ofrece seis rutas coordinadas por filtros globales:

- `/resumen`: resumen general y valoración de cuentas;
- `/flujo-de-caja`: evolución del flujo de caja;
- `/deudas`: gastos, anticipos y saldos de deudas;
- `/categorias`: jerarquía y evolución de categorías;
- `/cuentas`: detalle y comparativa de cuentas;
- `/transacciones`: buscador, ordenación, paginación, trazabilidad y CSV.

Los filtros de ámbito, periodo, granularidad, cuenta, categoría, estado,
etiquetas, búsqueda y transferencias enlazadas afectan a todas las vistas. Las
preferencias de filtros se conservan localmente mediante Zustand. TanStack
Router gestiona URLs tipadas, historial, restauración de scroll y precarga por
intención; cada pantalla se carga en su propio chunk mediante `lazy` y
`Suspense`. La página de transacciones conserva paginación y ordenación en la
URL.

### Arquitectura

El frontend sigue Clean Architecture y Atomic Design:

```text
src/
├── domain/          # normalización, reglas financieras y agregaciones puras
├── application/     # casos de uso, puertos y store de aplicación
├── infrastructure/  # adaptadores de carga de datos
├── composition/     # ensamblado de dependencias
└── presentation/
    ├── App/
    ├── components/  # atoms, molecules, organisms y templates
    ├── pages/       # una carpeta por pantalla
    ├── providers/   # inyección del store a React
    └── router/      # árbol tipado y composición de rutas
```

Cada componente React vive en una carpeta PascalCase propia. Su `index.ts`
expone únicamente exports nominados y agrupa, según proceda, el componente, la
vista, tipos, helpers, hooks, contexto, CSS Module y test. Los hooks específicos
se guardan en `hooks/NombreComponente.hooks.ts`. No hay barrels globales ni
exports con comodín, y cada archivo TSX de producción declara como máximo un
componente. Las variantes visuales —incluidos iconos, gráficas y paneles— no
comparten archivos con otros componentes. El resto de archivos y carpetas
técnicos usa minúsculas y kebab-case. Una prueba de arquitectura protege estas
convenciones.

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

El navegador sólo recibe los tres artefactos necesarios: cuentas, categorías y
apuntes normalizados. Las estadísticas filtrables se recalculan en memoria; no
se descarga el JSON agregado de 2,7 MB. El plugin local de Vite aplica esa lista
cerrada tanto en desarrollo como en producción; los exports crudos, las
estadísticas generadas y la caché de divisas no se publican.

> [!WARNING]
> `parsed-data.json` sigue conteniendo información financiera y conceptos de
> transacciones. La aplicación no incorpora autenticación: úsala localmente o
> publícala únicamente detrás de un control de acceso. La lista cerrada reduce
> la exposición, pero no anonimiza los datos que la interfaz necesita mostrar.

## Verificación

```sh
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

`pnpm test` ejecuta por separado las pruebas de dominio y las pruebas de
componentes/integración con Vitest, Testing Library y jsdom. Para trabajar en
modo interactivo sobre la interfaz puede usarse `pnpm test:ui:watch`.

Al desplegar el contenido estático, el servidor debe redirigir las rutas de la
aplicación a `index.html`; Vite ya lo hace durante desarrollo y preview.

Consulta [el contrato de estadísticas](docs/statistics.md) para las reglas de
clasificación, conversión de moneda, significado de cada vista, limitaciones y
cifras de referencia actuales.

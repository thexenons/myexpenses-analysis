# Auditoría integral del proyecto

Fecha: 23 de agosto de 2026. La revisión usa como oráculo local la copia
`myexpenses-backup-20260822-210453.zip`, esquema SQLite 189, con 39 cuentas,
81 categorías, 13.022 apuntes y un presupuesto. La conexión a una cuenta real
de pCloud y la ejecución del cron quedan fuera por decisión expresa.

## Resultado

No queda ningún hallazgo accionable conocido dentro del alcance revisado. Se
han corregido los defectos funcionales, de seguridad, accesibilidad y
rendimiento reproducibles. Los límites que permanecen al final del documento
son restricciones externas, compatibilidad versionada o decisiones medidas;
no son tareas omitidas del alcance actual.

## Evidencia y método

La auditoría combinó:

- revisión de límites de confianza, arquitectura, estado, rutas, componentes,
  consultas, importación, cifrado, sincronización y release atómica;
- comparación con MyExpenses oficial en el commit
  [`bc3e660`](https://github.com/mtotschnig/MyExpenses/tree/bc3e660b1074e956130f8b9164ffd99e7512f567),
  además de los golden extraídos de la copia local;
- Vitest, Testing Library, axe-core 4.13, ratios de contraste sRGB y pruebas
  Node de integración, corrupción, límites y paridad;
- TypeScript estricto, Oxlint con React/jsx-a11y/Vitest, `pnpm audit`, Knip,
  Madge y revisión del diff;
- importación, cifrado, build y preview reales con secretos efímeros y limpieza
  posterior de todos los artefactos.

## Hallazgos corregidos

### Funcionalidad y exactitud financiera

- `CLEARED` se aplanaba a otro estado. Ahora se conserva de extremo a extremo
  y aparece como «Compensado» en filtros, badges, detalle, CSV y conteos.
- Las series semanales/mensuales ignoraban `weekStart` y `monthStart`. Ahora
  respetan la copia, rellenan huecos y cubren cambios de año, bisiestos y días
  de inicio inexistentes.
- La semana se numeraba como ISO. MyExpenses usa el año civil del inicio de la
  semana: `2024-12-30` es `2024-W53`. La regresión queda fijada contra
  [`YEAR_OF_WEEK_START`](https://github.com/mtotschnig/MyExpenses/blob/bc3e660b1074e956130f8b9164ffd99e7512f567/myExpenses/src/main/java/org/totschnig/myexpenses/provider/DatabaseConstants.kt#L63-L94).
- Importes nativos, originales, detalles y CSV asumían siempre dos decimales.
  El modelo conserva `fractionDigits`; hay pruebas para monedas de 0 y 3
  decimales, referencias de moneda original y la invariante EUR = 2.
- Los fallos de red/publicación se confundían con una frase incorrecta. La UI
  diferencia el transporte accionable, pero mantiene indistinguibles frase,
  tag autenticado, gzip y dataset cifrado para no crear un oráculo.
- La copia de referencia sigue reproduciendo exactamente apertura, gastos, ingresos,
  transferencias, ambos balances, partición deuda/flujo real y presupuesto.

### Seguridad y privacidad

- La build estática sólo publica `data/app-dataset.vault.json`; el ZIP, SQLite,
  preferencias opacas y JSON claro quedan fuera. El build final buscó
  marcadores privados en sus 46 archivos y obtuvo cero coincidencias.
- La bóveda usa gzip, PBKDF2-HMAC-SHA-256 con 600.000 iteraciones y
  AES-256-GCM con cabecera autenticada, límites estrictos y errores de apertura
  no distinguibles.
- El filtro descriptivo completo se persistía en claro. Ahora sólo se guarda
  la granularidad; cuentas, categorías, fechas, tags y búsquedas permanecen en
  memoria. Un adaptador con overlay y tombstones mantiene la aplicación usable
  si `localStorage` está bloqueado, lleno o no permite borrar.
- El fetch de una bóveda con nombre estable podía reutilizar una release vieja.
  Usa `cache: "no-store"`; nginx aplica además `no-store` a HTML, SPA y bóveda,
  reservando `immutable` para assets con hash.
- El proceso de build heredaba todo el entorno del cron. TypeScript, Vite y sus
  plugins reciben ahora una allowlist y no reciben token pCloud ni frase.
- ZIP, SQLite, secretos, estado, locks, descargas y releases se endurecieron
  frente a traversal, bombas, CRC, symlinks, TOCTOU, SSRF, IDs imprecisos,
  timeouts, checksums, permisos, crashes y publicación parcial.
- Se añadió una política CSP/anti-framing portable y una plantilla nginx con
  HSTS, COOP, CORP, Permissions-Policy, `nosniff` y caché contractual.
- La bóveda se bloquea manualmente, al recargar y tras 15 minutos sin actividad;
  el store descarta analytics y aborta cualquier carga activa.

### UI, UX y accesibilidad

- Corregidos foco inicial, foco tras navegación/back, foco/restauración del
  diálogo, Escape, skip link, anuncios de ruta, errores de formulario y estado
  de carga.
- La navegación móvil dejó de depender de scroll horizontal invisible y usa
  una cuadrícula 4×2 en pantallas estrechas. Se ajustaron reflow, drawer,
  tablas, fechas, footer fijo, wrapping y targets táctiles.
- Se añadieron estados vacíos específicos, etiquetas humanas para tipos
  técnicos, semántica de tablas/sort, `meter`, títulos/descripciones SVG y
  tablas de datos exactos para todos los gráficos.
- Contraste corregido y protegido por cálculo: `--debt-ink` alcanza 6,30:1
  sobre superficie clara y 5,01:1 sobre `debt-soft`; texto muted 4,68:1 y
  límites de control 4,05:1. Hay soporte `forced-colors` y
  `prefers-reduced-motion`.
- Axe no detecta violaciones en bloqueo/error, las ocho rutas, 404, tablas y
  diálogo de filtros. El contraste se prueba aparte porque jsdom no resuelve
  layout ni variables CSS.

### Rendimiento y arquitectura

- El camino crítico medido bajó aproximadamente de 1,59 s a 1,26 s. La
  normalización pasó de unos 212 ms a 75–96 ms y su heap añadido de 34,1 MB a
  7,1 MB; patrones pasó de 54 ms a 25 ms.
- Envelope/AAD/ciphertext inmutables se cachean para reintentos sin refetch. No
  se cachean frase, gzip descifrado ni dataset.
- Descompresión y UTF-8 son incrementales, los índices de búsqueda se crean al
  primer uso mediante `WeakMap`, y los apuntes activos se retienen una sola vez.
- La rama legacy de exportación quedó fuera del grafo de desbloqueo cliente; se
  conserva únicamente como oráculo de pruebas financieras.
- El frontend mantiene chunks lazy por URL. El build final midió 344,91 KB
  (110,81 KB gzip) en el chunk principal y 7,35 KB (2,74 KB gzip) en crypto
  diferido. Todos los chunks JS suman 185,72 KB gzip y CSS 21,46 KB gzip.
- Las pruebas de arquitectura prohíben dependencias inversas entre capas,
  wildcard exports, nombres técnicos PascalCase, múltiples componentes por TSX
  y componentes sin carpeta, `index.ts` o test colocados. Madge no encontró
  ciclos en 392 módulos; el único skip fue el import CSS `?raw` esperado.
- Se eliminó `AppState`, que era inalcanzable, y el alias duplicado del pipeline.
  Los `index.ts` internos que Knip marca como no usados se conservan de forma
  deliberada porque la convención del proyecto exige un punto de entrada
  nominado por componente.

## Verificación final

| Comprobación | Resultado |
|---|---:|
| `pnpm test` | 126 Node correctas + 2 golden privados omitidos para el snapshot nuevo + 156 UI, sin fallos |
| Cobertura Node | 128 pruebas; 81,98 % líneas, 74,06 % ramas, 87,55 % funciones |
| Cobertura V8 UI | 79,14 % statements, 63,56 % ramas, 87,38 % funciones, 85,77 % líneas |
| Umbrales V8 | 75 / 60 / 85 / 85, superados |
| `pnpm type-check` | Correcto |
| `pnpm lint` | Correcto, cero warnings |
| `pnpm audit` | Cero vulnerabilidades conocidas |
| `pnpm install --frozen-lockfile` | Correcto |
| Build completa | 338 módulos, correcta en 5,70 s |
| Dataset de build | 1.298.491 bytes, único archivo bajo `dist/data` |
| Preview | `/` y `/presupuestos` 200, fallback SPA idéntico, vault JSON 200 |
| `git diff --check` | Correcto |

`pnpm test:coverage` reproduce ambas mediciones. Los artefactos `coverage/`,
`dist/`, la frase, el dataset temporal y la bóveda temporal se eliminaron tras
la auditoría.

## Límites y decisiones no accionables

- No se conectó una cuenta pCloud ni se instaló/ejecutó el cron, tal como se
  acordó. Sus tests usan transporte simulado y no transmiten datos privados.
- No había Chromium, Playwright, lector de pantalla ni nginx. Por ello no se
  ejecutaron Lighthouse, zoom real 200/400 %, Windows High Contrast,
  navegación con lector ni `nginx -t`; deben formar parte de la prueba en el
  servidor/navegador final, no requieren un cambio de código conocido.
- El soporte se limita de forma deliberada al esquema SQLite 189. Una nueva
  versión debe incorporar otro adaptador y golden, nunca reinterpretarse en
  silencio.
- PBKDF2, `JSON.parse` y freeze no son cancelables durante su operación. Con el
  dataset actual el desbloqueo está dentro del presupuesto medido; se debe
  reconsiderar un worker si supera de forma sostenida unos 2,5 s en el
  navegador objetivo o crece sustancialmente la copia.
- Babel 8, TypeScript 7 y tipos Node 26 son saltos mayores y no se mezclaron con
  esta auditoría. Todas las actualizaciones compatibles restantes sí se
  aplicaron con `pnpm update`; no se editó el lockfile manualmente.
- La aplicación es privada y declara `noindex`; SEO público no es un objetivo.

# My Expenses Analysis

Aplicación React para explorar con detalle las cuentas, movimientos,
categorías y estadísticas de una copia de seguridad de MyExpenses. Reproduce
las cifras base de la aplicación y añade vistas de flujo real, deudas,
evolución temporal y desglose por cuenta y categoría.

## Aplicación

Requiere Node `^20.19`, `^22.12` o `>=24` y pnpm 10.

```sh
pnpm install
pnpm data:import-backup -- \
  --input data/myexpenses-backup-AAAAMMDD-HHMMSS.zip \
  --time-zone Europe/Madrid
pnpm data:encrypt
pnpm dev
```

`data:encrypt` solicita de forma oculta una frase y genera la única fuente que
puede consumir el navegador. La aplicación arranca bloqueada, no hace ningún
fetch antes del submit, vuelve a bloquearse tras cada recarga y se bloquea
automáticamente después de 15 minutos sin actividad.

La interfaz ofrece ocho rutas coordinadas por filtros globales:

- `/resumen`: resumen general y valoración de cuentas;
- `/flujo-de-caja`: evolución del flujo de caja;
- `/deudas`: gastos, anticipos y saldos de deudas;
- `/presupuestos`: asignación, consumo, disponible y rollovers por periodo y
  categoría;
- `/categorias`: jerarquía y evolución de categorías;
- `/cuentas`: detalle y comparativa de cuentas;
- `/patrones`: payees, horarios, días de semana, valor-fecha, tipos nativos y
  calidad/procedencia de los datos;
- `/transacciones`: buscador, ordenación, paginación, trazabilidad y CSV.

Los filtros de ámbito, periodo, granularidad, cuenta, categoría, estado,
etiquetas, búsqueda y transferencias enlazadas afectan a todas las vistas. El
estado vive en Zustand; por privacidad, sólo la granularidad se conserva en
`localStorage`, mientras cuentas, categorías, fechas, etiquetas y búsquedas
permanecen en memoria. TanStack Router gestiona URLs tipadas, historial,
restauración de scroll y precarga por intención; cada pantalla se carga en su
propio chunk mediante `lazy` y `Suspense`. La página de transacciones conserva
paginación y ordenación en la URL.

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

La copia de seguridad ZIP de MyExpenses es la fuente canónica. El importador
lee directamente su SQLite, reproduce las reglas de MyExpenses y genera un
único dataset web versionado:

```sh
pnpm install
pnpm data:import-backup -- \
  --input data/myexpenses-backup-AAAAMMDD-HHMMSS.zip \
  --time-zone Europe/Madrid
```

La salida por defecto es `data/app-dataset.json`. El comando exige el archivo y
la zona horaria de forma explícita; puede cambiarse la salida con `--output`.
Sólo se admite actualmente el esquema SQLite 189 de MyExpenses 4.1.0.2, y una
versión distinta falla antes de consultar datos.

El dataset contiene, con importes enteros en unidades menores:

- cuentas y sus tipos nativos, flags, aperturas, tasas y dos fórmulas de saldo;
- árbol y tipos de categoría;
- apuntes canónicos con fecha/hora, valor-fecha, splits, transfer peer, estado,
  payee, método, etiquetas y equivalentes EUR;
- monedas y dígitos fraccionarios;
- presupuestos y sus asignaciones/rollovers.

Las cuentas `_LIABILITY_` forman el ámbito propio `DEBT`; el resto forma el
flujo real. Una invariante exige que ambos sumen el total para apertura,
ingresos, gastos, transferencias, movimiento y valoración.

El navegador sólo recibe `app-dataset.vault.json`: JSON comprimido con gzip y
cifrado mediante AES-256-GCM a partir de una clave PBKDF2. Tras desbloquearlo,
las estadísticas filtrables se recalculan en memoria. El plugin local de Vite
aplica esa lista cerrada en desarrollo y producción; una build falla si no hay
bóveda y nunca publica `app-dataset.json`, el ZIP, la SQLite, preferencias,
DataStore o adjuntos. Tanto el dataset claro como la bóveda quedan ignorados por
Git y deben generarse localmente.

> [!WARNING]
> La bóveda permite alojar archivos estáticos sin exponer directamente el
> dataset, pero puede atacarse offline. Usa una frase larga, única y aleatoria,
> sirve siempre por HTTPS y protege el servidor: JavaScript malicioso podría
> capturar la frase al introducirla.

## Sincronización y despliegue

El comando `pnpm deploy:sync-pcloud` consulta una carpeta concreta mediante
OAuth Bearer, selecciona la copia más reciente, verifica sus checksums, importa,
cifra y construye una release nueva. Sólo después cambia de forma atómica el
symlink `current`; un fallo conserva la versión anterior. La configuración,
cron y permisos están en [deploy/README.md](deploy/README.md).

## Verificación

```sh
pnpm test
pnpm test:coverage
pnpm type-check
pnpm lint
pnpm build
```

`pnpm test` ejecuta por separado las pruebas de dominio y las pruebas de
componentes/integración con Vitest, Testing Library y jsdom. Para trabajar en
modo interactivo sobre la interfaz puede usarse `pnpm test:ui:watch`.
`pnpm test:coverage` añade cobertura Node y V8 con umbrales mínimos para la
interfaz.

Al desplegar el contenido estático, el servidor debe redirigir las rutas de la
aplicación a `index.html`; Vite ya lo hace durante desarrollo y preview.

Consulta [el contrato de estadísticas](docs/statistics.md) para las reglas de
clasificación, conversión de moneda, significado de cada vista, limitaciones y
cifras de referencia actuales. El diseño y las pruebas del importador están en
[la documentación de backups](docs/backup-import.md).

Las funciones nuevas y las fuentes descartadas con su evidencia se detallan en
[el inventario de funciones del backup](docs/backup-features.md).
El modelo de amenaza y la operación automática están en
[protección de la build estática](docs/static-authentication.md) y
[sincronización pCloud](docs/pcloud-sync.md).
El alcance, hallazgos y evidencia reproducible están en la
[auditoría integral del proyecto](docs/project-audit.md).

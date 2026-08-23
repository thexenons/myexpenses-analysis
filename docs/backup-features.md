# Funciones habilitadas por la copia de seguridad

Este documento registra qué datos adicionales del backup de MyExpenses se han
convertido en funciones web, cuáles se muestran sólo cuando existen y cuáles se
han descartado por ahora. Las decisiones se basan en la copia
`20260822-210453`, no en la mera presencia de una tabla en el esquema.

## Evidencia de partida

La importación validada contiene:

- 39 cuentas, 81 categorías reales y 13.022 apuntes canónicos;
- 628 payees, de los cuales 625 aparecen en 7.834 de los 13.018 apuntes
  activos;
- hora distinta de medianoche en 12.699 apuntes;
- fecha valor efectiva en 10.160 apuntes, pero sólo 38 fechas diferentes de la
  fecha de operación;
- 19 tags, 2 métodos de pago y un único apunte con método;
- 1 presupuesto mensual con 34 asignaciones;
- 24 cuentas ocultas, 22 cuentas `_LIABILITY_`, 10 `_ASSET_`, 5 `_BANK_`, una
  `_CASH_` y una `_CCARD_`;
- 9.384 lados de transferencias enlazadas, 7.185 partes split y 4 apuntes
  `VOID` canónicos.

## Funciones implementadas

### Presupuestos

La ruta `/presupuestos` representa las definiciones nativas, sus periodos,
fallbacks, asignaciones, rollovers y consumo real. Incluye:

- selector de presupuesto y periodo;
- asignado global, gasto neto, disponible y porcentaje utilizado;
- estado propio `on-track`, `watch` o `exceeded`; estos umbrales son una ayuda
  web y se etiquetan como derivación, no como dato oficial;
- desglose jerárquico sin sumar dos veces una asignación de padre e hijos;
- asignaciones exactas frente a fallback, one-time y rollovers;
- intersección con todos los filtros globales;
- filtro propio persistido por MyExpenses y `aggregateNeutral`.

El presupuesto actual usa `AND` entre 7 cuentas y 2 categorías —incluidos sus
descendientes—. El DataStore se procesa mediante allowlist y sus IDs se
resuelven a UUID; los labels serializados se eliminan. Para agosto de 2026, la
consulta web y la consulta oficial r871 coinciden:

| Métrica | Unidades menores | EUR |
|---|---:|---:|
| Asignado por fallback | 281.530 | 2.815,30 € |
| Consumido | 234.036 | 2.340,36 € |
| Disponible | 47.494 | 474,94 € |
| Utilización | — | 83,13 % |

El resultado procede de 117 apuntes —111 partes split y 6 directos— y genera
33 filas de categoría, sin consumo sin asignar.

### Patrones y calidad

La ruta `/patrones` añade estadísticas que MyExpenses no reúne en una sola
vista:

- rankings de payees por gasto, ingreso y neto, conservando su ID estable;
- cobertura de payee para no confundir «sin dato» con una categoría económica;
- actividad por hora local y día de semana;
- cobertura de fecha valor y distribución del desfase en días;
- composición y valoración por tipo nativo de cuenta;
- cuentas visibles/ocultas y exclusión de totales;
- uso condicional de métodos de pago;
- ledger de procedencia: esquema, zona horaria, hashes truncados, splits,
  transfer peers, `VOID` y conteos del dataset.

Son estadísticas descriptivas: la interfaz no atribuye causas ni presenta los
patrones horarios como predicciones.

### Más detalle en cuentas y transacciones

La vista de cuentas incorpora tipo nativo, descripción, visibilidad, inclusión
en totales y soporte de conciliación, además de apertura, saldo histórico,
valoración y tasa ya existentes.

La trazabilidad de una transacción incorpora hora, fecha valor efectiva,
estado exacto de MyExpenses, fila SQLite, método, archivo, referencia e importe
original cuando existen. Para splits se conserva fecha/hora, importe en minor
units, payee, método, tags y comentario del padre. El CSV incluye los mismos
campos y los IDs estables de payee, método y tags.

### Fuente, privacidad y portabilidad

- El ZIP, `app-dataset.json` y `app-dataset.vault.json` están ignorados por Git.
- Vite sólo sirve la bóveda cifrada, nunca el dataset claro, la SQLite,
  preferencias, protobuf ni adjuntos.
- El importador elimina IBAN, BIC, credenciales, claves, correo, destinos cloud
  y preferencias no allowlisted.
- El dataset claro no está anonimizado. La build estática publica únicamente su
  versión cifrada; aun así necesita HTTPS para impedir que JavaScript inyectado
  capture la frase.
- El pipeline no requiere binarios `sqlite3` o `unzip`; usa ZIP seguro y SQLite
  WASM en memoria.

## Datos integrados sin pantalla propia

| Dato | Tratamiento | Motivo |
|---|---|---|
| Método de pago | Detalle, CSV y bloque condicional en Patrones | Sólo 1 apunte lo usa; una ruta propia estaría vacía. |
| GBP/USD y tasas estáticas | Detalle y valoración de cuenta | Sólo hay 2 cuentas extranjeras; la comparativa ya vive en Cuentas. |
| `VOID` | Filtros, tablas y procedencia; cero en métricas | Hay 4 apuntes y son útiles para auditoría, no para un dashboard separado. |
| `CLEARED` | Filtro, badge, detalle, CSV y conteos de estado | Actualmente hay 0, pero el flujo completo lo conserva como «Compensado» y está cubierto por pruebas. |
| Colores de categoría | Se conservan en el dataset | Sólo 4 de 81 categorías tienen color y ninguna tiene icono. |
| Proveedor Frankfurter | Metadato allowlisted | Todas las cuentas actuales son estáticas; no se hace una llamada de red innecesaria. |

## Funciones descartadas o aplazadas

| Fuente | Estado actual | Decisión |
|---|---:|---|
| Deudas nativas (`debts`, `debt_id`) | 0 / 0 | No crear una pantalla oficial vacía. La vista propia usa las 22 cuentas `_LIABILITY_`, que es otro concepto. |
| Adjuntos | 0 | No copiar ni publicar `Pictures/`; no hay contenido que representar. |
| Bancos | 0 | IBAN/BIC se excluyen siempre y no existe banco utilizable. |
| Planes y plantillas recurrentes | 0 | Aplazado hasta que una copia aporte filas reales. |
| Archivo histórico | 0 wrappers/contenido | La lógica está soportada, pero no merece una pantalla sin datos. |
| Precios y cuentas dinámicas | 0 / 0 | No crear una vista de mercado artificial. Los equivalentes dinámicos siguen soportados por el importador. |
| Referencia e importe/moneda original | 0 / 0 | Campos condicionales en detalle/CSV; sin panel agregado. |
| Iconos de categoría | 0 | No inventar iconografía. |
| Catálogo completo de divisas | 164 definiciones, 3 usadas | Publicar sólo EUR, GBP y USD evita ruido y metadatos sin relación con las cuentas. |
| Preferencias generales del protobuf | 93 claves | Permanecen opacas; sólo se leen las claves exactas necesarias para presupuestos. |

## Decisiones de rendimiento y límites versionados

El JSON claro ocupa 16.992.243 bytes; gzip lo reduce a 973.631 bytes y la bóveda
base64 completa a 1.298.491 bytes. La carga evita copias del buffer de 17 MB,
retiene los apuntes activos una sola vez y crea el índice de búsqueda bajo
demanda. En la medición final, la normalización añadió unos 7,1 MB de heap y el
camino crítico quedó alrededor de 1,26 s en Node.

El contrato v1 repite contexto de padre split y transfer peer para favorecer
auditoría y simplicidad. Normalizar esos bloques por ID reduciría el JSON claro,
pero no la transferencia cifrada de forma material y exigiría una migración con
riesgo de perder procedencia. Con el volumen y las medidas actuales no es un
hallazgo accionable; debe reconsiderarse sólo si crecen sustancialmente el
dataset o el tiempo de desbloqueo.

El soporte de lectura está fijado al esquema SQLite 189. Un cambio de
`PRAGMA user_version` debe introducir un adaptador nuevo antes de habilitar
nuevas filas o pantallas.

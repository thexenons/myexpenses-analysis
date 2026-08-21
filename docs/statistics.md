# Contrato de estadísticas

## Fuente y unidades

`data/export.ts` es la fuente canónica. Un test exige que sea semánticamente
idéntico al último JSON exportado por My Expenses. El parser valida el export y
genera apuntes auditables en `parsed-data.json`:

- una transacción directa produce un apunte;
- un padre con splits produce un apunte por split;
- se conservan UUID, estado y contexto del padre;
- `VOID` se conserva en el artefacto, pero se excluye de las estadísticas;
- las fechas se normalizan a `YYYY-MM-DD`;
- los importes se agregan como céntimos enteros.

## Paridad con My Expenses

La clasificación base imita el código oficial:

- `Gastos`: siempre `expenses`, incluso para devoluciones positivas;
- `Ingresos`: siempre `incomes`, incluso para reversiones negativas;
- categoría literal `Transferencia`: siempre `transfers`;
- categoría neutral: gasto si es negativa e ingreso si es positiva;
- una subcategoría hereda el tipo de su raíz;
- `total = expenses + incomes + transfers`.

Los meses públicos usan `1..12`. Solo se emiten periodos y categorías con
actividad.

## Conversión a EUR

My Expenses distingue cuentas con tasa estática y dinámica. El export no
incluye esta configuración ni los equivalentes almacenados, por lo que
`accounts.json` la completa por UUID:

```json
{
  "label": "Cuenta GBP",
  "type": "DEFAULT",
  "exchangeRateMode": "STATIC",
  "exchangeRateToEur": 1.17
}
```

`exchangeRateToEur` expresa EUR por una unidad mayor de la moneda de la cuenta.

- `STATIC`: todos los apuntes usan la tasa fija.
- `DYNAMIC`: los apuntes normales usan Frankfurter histórico; una transferencia
  directa enlazada usa la tasa fija porque My Expenses no guarda su equivalente;
  los splits se prorratean desde el equivalente histórico del padre.
- La apertura de una cuenta extranjera siempre usa la tasa fija.
- EUR usa identidad y no consulta la red.

Las cuentas GBP y USD actuales son `STATIC`, igual que en My Expenses.
Frankfurter queda disponible para cuentas dinámicas futuras y para una futura
vista analítica ajustada a mercado.

Frankfurter se fija en v1 para reproducir la versión usada por My Expenses en
la fecha del export. Para cuentas dinámicas, `data/exchange-rates.json` se crea
de forma perezosa y guarda la fecha solicitada y la fecha efectiva. Un fallo de
red sin entrada cacheada aborta el cálculo. Con las cuentas actuales, todas
estáticas, ese archivo no es necesario.

La conversión redondea cada apunte con *half away from zero*. Para un split
dinámico:

```text
parentEur = round(parentMinor * historicalRate)
childEur  = round(parentEur / parentMinor * childMinor)
```

## Vistas

Los nombres JSON heredados se mantienen, pero su semántica es:

| Campo | Semántica |
|---|---|
| `statistics` | Todas las cuentas; compatible con las sumas base de My Expenses |
| `statisticsWithDebts` | Cuentas `DEBT` excluidas; flujo real |
| `debtsStatistics` | Solo cuentas `DEBT` |

Cada vista contiene:

- `openingBalance`;
- `historicalFlowBalance`: apertura más equivalentes de los apuntes;
- `accountValuationBalance`: suma de saldos nativos finales convertidos una vez;
- totales globales, categorías y años/meses/días.

My Expenses utiliza ambas fórmulas de balance. Con el export actual,
`historicalFlowBalance` es `78.755,61 EUR` y `accountValuationBalance` es
`78.755,60 EUR`. Las cuentas GBP/USD cierran a cero en moneda nativa, pero el
redondeo de sus apuntes equivalentes deja `+0,01 EUR`.

## Referencia del export actual

```text
openingBalance:          39.210,91 EUR
expenses:               -49.910,31 EUR
incomes:                 87.634,05 EUR
transfers:                1.820,96 EUR
movement total:          39.544,70 EUR
historicalFlowBalance:   78.755,61 EUR
accountValuationBalance: 78.755,60 EUR
```

Estas cifras están fijadas por una prueba sin acceso de red.

## Límites conocidos

El JSON de My Expenses no exporta:

- modo dinámico/estático y tasa fija de cuenta;
- equivalentes históricos guardados;
- tasa de valoración más reciente;
- `excludeFromTotals`, cuentas archivadas o inicio personalizado de mes/semana;
- método de pago.

Estas políticas deben estar en el registro o fallar explícitamente. Una cuenta
dinámica extranjera con saldo final no cero requerirá una tasa y fecha de
valoración para reproducir el total corriente oficial.

## Extensiones prioritarias

1. gasto bruto, devoluciones y gasto neto;
2. ingreso bruto, reversiones e ingreso neto;
3. importes y conteos reconciliados/no reconciliados;
4. transferencias enlazadas frente a categoría contable `Transferencia`;
5. saldo, adelantos, devoluciones y antigüedad por cuenta `DEBT`;
6. vista `marketAdjusted` y diferencias FX;
7. desgloses por cuenta, payee y tags;
8. semana y periodos configurables.

Los grupos por tags no son aditivos cuando un apunte tiene varias etiquetas.

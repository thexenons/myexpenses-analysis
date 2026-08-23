# Contrato de estadísticas

## Fuente y unidades

La SQLite `BACKUP` de la copia de seguridad de MyExpenses es la fuente canónica.
El importador valida el esquema 189 y genera apuntes auditables en el artefacto
versionado `data/app-dataset.json`:

- una transacción directa produce un apunte;
- un padre con splits produce un apunte por split;
- se conservan UUID, estado y contexto del padre;
- `VOID` se conserva en el artefacto, pero se excluye de las estadísticas;
- se conserva el instante original y se derivan fecha y hora civil usando la
  zona explícita `Europe/Madrid`;
- los importes nativos y EUR se conservan como enteros en unidades menores;
- se incorporan tipo nativo de cuenta y categoría, método, payee, etiquetas,
  valor-fecha, tasa almacenada, presupuestos y flags útiles de cuenta.

## Paridad con My Expenses

La clasificación base imita el código oficial:

- `Gastos`: siempre `expenses`, incluso para devoluciones positivas;
- `Ingresos`: siempre `incomes`, incluso para reversiones negativas;
- categoría de tipo nativo `TRANSFER`: siempre `transfers`;
- categoría neutral: gasto si es negativa e ingreso si es positiva;
- una subcategoría hereda el tipo de su raíz;
- `total = expenses + incomes + transfers`.

Los meses públicos usan `1..12`. Las series rellenan los huecos del intervalo
seleccionado y respetan `group_week_start` y `group_month_start` de la copia. El
weekday Java `Sunday=1..Saturday=7` se convierte una vez a ISO
`Monday=1..Sunday=7`.

Las claves semanales imitan `YEAR_OF_WEEK_START` de MyExpenses —año civil del
inicio configurado— y no el week-year ISO: el lunes `2024-12-30` pertenece a
`2024-W53`. Esta regla procede de las expresiones oficiales
[`YEAR_OF_WEEK_START` y `WEEK`](https://github.com/mtotschnig/MyExpenses/blob/bc3e660b1074e956130f8b9164ffd99e7512f567/myExpenses/src/main/java/org/totschnig/myexpenses/provider/DatabaseConstants.kt#L63-L94);
los rangos con inicio de mes mayor que su longitud siguen
[`Grouping.getMonthRange`](https://github.com/mtotschnig/MyExpenses/blob/bc3e660b1074e956130f8b9164ffd99e7512f567/myExpenses/src/main/java/org/totschnig/myexpenses/model/Grouping.kt#L145-L159).

## Conversión a EUR

MyExpenses distingue cuentas con tasa estática y dinámica. La copia sí incluye
esta configuración, `account_exchangerates`, `equivalent_amounts` y `prices`,
por lo que ya no se mantiene un registro manual ni se infieren tasas.

- `STATIC`: todos los apuntes usan la tasa fija.
- `DYNAMIC`: los apuntes usan el equivalente histórico almacenado; los splits
  se prorratean desde el equivalente del padre.
- La apertura de una cuenta extranjera siempre usa la tasa fija.
- EUR usa identidad y no consulta la red.

Las cuentas GBP y USD actuales son estáticas y usan exactamente las tasas de la
base. El proveedor configurado sigue siendo Frankfurter, pero esta importación
no necesita red: para una cuenta dinámica sin equivalente o precio suficiente
se falla de forma explícita en lugar de inventar una tasa.

La conversión redondea cada apunte con *half away from zero*. Para un split
dinámico:

```text
parentEur = round(parentMinor * historicalRate)
childEur  = round(parentEur / parentMinor * childMinor)
```

## Vistas

Todas las agregaciones parten de la misma secuencia canónica:

| Ámbito | Semántica |
|---|---|
| `all` | Todas las cuentas incluidas por el selector oficial |
| `realCashFlow` | Cuentas cuyo tipo nativo no es `_LIABILITY_` |
| `debtsOnly` | Sólo cuentas cuyo tipo nativo es `_LIABILITY_` |

Cada vista contiene:

- `openingBalance`;
- `historicalFlowBalance`: apertura más equivalentes de los apuntes;
- `accountValuationBalance`: suma de saldos nativos finales convertidos una vez;
- totales globales, categorías y años/meses/días.

MyExpenses utiliza ambas fórmulas de balance. Con la copia actual,
`historicalFlowBalance` es `78.649,40 EUR` y `accountValuationBalance` es
`78.649,39 EUR`. La diferencia de un céntimo procede de redondear apuntes
individuales frente a convertir el saldo nativo final por cuenta.

## Referencia de la copia actual

```text
openingBalance:          39.210,91 EUR
expenses:               -50.016,52 EUR
incomes:                 87.634,05 EUR
transfers:                1.820,96 EUR
movement total:          39.438,49 EUR
historicalFlowBalance:   78.649,40 EUR
accountValuationBalance: 78.649,39 EUR
```

Estas cifras y la igualdad `all = debtsOnly + realCashFlow` están fijadas por
pruebas sin acceso de red.

## Límites conocidos

El adaptador soporta únicamente el esquema 189. Una actualización de
MyExpenses que cambie `PRAGMA user_version` requiere un adaptador nuevo y una
comparación de paridad antes de aceptarse. La zona horaria no está guardada en
el backup y debe proporcionarse expresamente. Los backups cifrados tampoco se
descifran todavía.

El dataset web contiene conceptos financieros y nombres necesarios para la
interfaz, pero excluye deliberadamente preferencias no allowlisted, IBAN, BIC,
credenciales, claves, adjuntos y el protobuf de ajustes. No es un artefacto
anonimizado.

## Métricas propias

Sobre la base oficial se calculan sin alterar sus buckets:

- gasto bruto, devoluciones y gasto neto;
- ingreso bruto, reversiones e ingreso neto;
- importes y conteos por reconciliación;
- transferencias enlazadas frente a categoría contable de transferencia;
- saldo, adelantos, devoluciones y antigüedad por cuenta `_LIABILITY_`;
- partición aditiva entre deudas y flujo real;
- desgloses por cuenta, categoría, periodo, payee y etiquetas.

Las pantallas de presupuesto y patrones ya usan payee, hora, valor-fecha,
método y tipos nativos. Una valoración de mercado separada de la paridad
histórica queda aplazada porque no hay precios ni cuentas dinámicas actuales.

Los grupos por tags no son aditivos cuando un apunte tiene varias etiquetas.

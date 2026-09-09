# Contrato de estadísticas

## Fuente y unidades

La SQLite `BACKUP` de la copia de seguridad de MyExpenses es la fuente canónica.
El importador valida los esquemas 189 y 190 y genera apuntes auditables en el artefacto
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

La versión de SQLite se conserva en `source.schemaVersion`. El esquema 190
añade la clasificación `COMMODITY` para metales y conserva las tablas y reglas
financieras de 189; véase [el contrato de importación](backup-import.md).

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

## Periodo y granularidad

El filtro temporal y la resolución de las series son independientes. El filtro
permite incluir todo el historial o seleccionar un día, una semana de lunes a
domingo, un mes natural, un año natural o un rango personalizado. Los periodos
históricos incluyen todos sus días; si se selecciona el periodo que contiene la
fecha actual, termina hoy para no representar días futuros como huecos reales.

La granularidad puede fijarse en día, semana, mes o año, o dejarse en modo
automático. El modo automático usa día para un día o semana seleccionados,
semana para un mes y mes para un año. En un rango personalizado resuelve la
duración inclusiva con límites de calendario: menos de siete días usa día,
menos de un mes usa semana, menos de un año usa mes y el resto usa año. Un
límite personalizado vacío se completa con el extremo disponible del dataset
sólo para elegir la granularidad; el filtro continúa siendo abierto.

El usuario elige fecha de operación o fecha de valor. Cuando no existe fecha de
valor se usa la de operación; los splits conservan la fecha de valor efectiva
del padre. Filtros, agrupaciones temporales, apertura y cierre usan la misma
base de fecha. Cada apunte mantiene su fecha: dos contrapartidas con fechas de
valor distintas pueden pertenecer a periodos diferentes.

La comparación permite elegir periodo anterior, mismo periodo del año anterior
o un intervalo explícito. Conserva ámbito, cuentas, origen/destino, categorías,
estado, etiquetas, texto y fecha de referencia. Un mes completo según la
agrupación de la copia se compara con el mes anterior; otros intervalos usan
los días inclusivos inmediatamente anteriores. El 29 de febrero se ajusta al
28 al comparar con un año no bisiesto. Diferencia = actual − referencia; el
porcentaje utiliza el valor absoluto de referencia y no se calcula cuando esta
es cero. La UI advierte si la referencia se extiende fuera del historial.

## Filtros de cuentas, transferencias y categorías

La cuenta consultada y los extremos de una transferencia son filtros
independientes. Origen y destino se resuelven mediante enlaces recíprocos entre
apuntes. No se infiere una cuenta por su nombre, comentario o parecido de los
importes. Para movimientos sin contrapartida, una salida identifica su propia
cuenta como origen y una entrada la identifica como destino; el otro extremo
permanece desconocido. Dentro de cada selector se aplica OR; entre selectores,
AND. Una selección de cuentas vacía significa todas las permitidas por el
ámbito.

Las categorías se pueden buscar por ruta exacta o incluyendo descendientes,
y en el apunte o en cualquiera de las dos contrapartidas registradas. Esta
última opción amplía la coincidencia del filtro: no copia ni reclasifica la
categoría del apunte. Estado, etiquetas y texto se comprueban en cada apunte.

Por ejemplo, para consultar un pago de «Banco → Pareja» en Supermercado, se
seleccionan esos extremos, la categoría y las fechas. El ámbito de flujo real
devuelve la salida del banco; el de deudas devuelve la imputación en la cuenta
de la pareja. El ámbito total conserva ambos apuntes y su neto consolidado.

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

La apertura del periodo suma la apertura original y todo movimiento no anulado
anterior al inicio. El cierre suma la apertura original y todos los movimientos
no anulados hasta el final incluido. Sólo ámbito, cuentas y fechas limitan
estos saldos: categorías, estado, texto, etiquetas y origen/destino limitan los
movimientos analizados. Por eso, con filtros de contenido, apertura más
movimiento filtrado puede diferir del cierre real. La evolución del saldo en
Cuentas y Deudas también usa el historial completo de esas cuentas.

La «Valoración actual por cuenta» del Resumen corresponde al corte final de la
copia. No es una valoración histórica recalculada para la fecha seleccionada.

Las cuentas marcadas `includedInAll=false` conservan su metadata para
trazabilidad, pero no participan en los selectores ni en las estadísticas: el
importador no incluye sus movimientos y sumar sólo su apertura produciría un
saldo incompleto. La flag de visibilidad, por sí sola, no excluye una cuenta.

MyExpenses utiliza ambas fórmulas de balance. Con la copia de referencia
`20260822-210453`,
`historicalFlowBalance` es `78.649,40 EUR` y `accountValuationBalance` es
`78.649,39 EUR`. La diferencia de un céntimo procede de redondear apuntes
individuales frente a convertir el saldo nativo final por cuenta.

## Referencia validada `20260822-210453`

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

## Comprobación del esquema 190

El 9 de septiembre de 2026 se comprobó la copia local
`myexpenses-backup-20260909-080117.zip` mediante el importador y el normalizador.
Se verificó que el hash de la copia no cambiara y que la salida temporal
conservara el esquema 190 y permisos `0600`; se eliminó al terminar. No se
actualizó el dataset de trabajo ni se publicaron datos privados.

Una consulta SQLite independiente contrastó los 13.318 apuntes con el
normalizador: importes nativos y EUR, categoría raíz, estado, fecha de operación
y fecha de valor heredada. Se conciliaron siete magnitudes por cuenta para las
39 cuentas, la partición de ámbitos y 50 combinaciones de deuda, extremos de
transferencia, categoría y ambas bases de fecha. Las 93.856 comprobaciones
pasaron, incluidas las identidades de composición, el cierre real y las series
filtradas. La comprobación sólo emitió conteos, sin nombres ni importes privados.

Las pruebas sintéticas cubren importación de XAU con tipo `COMMODITY`,
procedencia, importes, conservación de 189 y rechazo de 191. La migración
verificada está documentada con referencias oficiales en
[backup-import.md](backup-import.md).

## Límites conocidos

El adaptador soporta únicamente los esquemas 189 y 190. Otra actualización de
`PRAGMA user_version` requiere revisar la migración y verificar la paridad
antes de aceptarse; no se supone compatibilidad futura. La zona horaria no está guardada en
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
- saldo, dinero enviado/recibido, aportación neta y gasto atribuido por cuenta
  `_LIABILITY_`;
- partición aditiva entre deudas y flujo real;
- desgloses por cuenta, categoría, periodo, payee y etiquetas.

Las pantallas de presupuesto y patrones ya usan payee, hora, valor-fecha,
método y tipos nativos. Una valoración de mercado separada de la paridad
histórica queda aplazada porque no hay precios ni cuentas dinámicas actuales.

Los grupos por tags no son aditivos cuando un apunte tiene varias etiquetas.

### Flujo real, consolidado y deudas

El flujo real suma todos los apuntes de cuentas no marcadas como deuda,
incluidas sus transferencias hacia cuentas de deuda. Entradas y salidas reales
usan el signo del movimiento, independientemente de su categoría. Las
transferencias entre cuentas propias seleccionadas aparecen en ambos lados y
se cancelan en el neto. El resultado consolidado suma ingresos y gastos netos
del ámbito elegido; no equivale a efectivo disponible.

Una contrapartida de deuda en una transferencia confirmada no se contabiliza
como devolución de gasto ni reversión de ingreso. Su importe firmado permanece
en un ajuste explícito para conservar los netos originales:

```text
expenses firmado = devoluciones − gasto bruto + asignación de gasto en deudas
incomes firmado  = ingreso bruto − reversiones + asignación de ingreso en deudas
```

La página de Deudas presenta:

- «Enviado a deudas»: importes que salen de cuentas propias en transferencias
  confirmadas hacia las cuentas de deuda seleccionadas.
- «Recibido de deudas»: importes efectivamente recibidos por la contrapartida
  de una cuenta propia.
- «Aportación neta»: enviado menos recibido; no es la variación contable del
  saldo, que puede incluir cargos directos, ajustes y transferencias entre deudas.
- «Gasto bruto atribuido»: partes categorizadas como gasto financiadas desde
  cuentas propias, junto con cargos de gasto directos de las cuentas de deuda.
  Una financiación usa la categoría contable del apunte de la cuenta propia,
  aunque la contrapartida tenga otra categoría; el filtro puede buscar ambas.
  «Gasto neto atribuido» descuenta las devoluciones de esos gastos.
- «Movimiento neto»: suma firmada de los apuntes filtrados.

Las transferencias entre dos cuentas de deuda no se cuentan como dinero
enviado/recibido en cuentas propias ni generan gasto o devolución por sí solas.
Un enlace ausente o inválido tampoco demuestra una recuperación. El saldo se
mantiene firmado, sin deducir quién debe a quién ni imponer un reparto fijo.
En monedas diferentes, enviado/recibido y gasto financiado usan el importe EUR
de la contrapartida de la cuenta propia, mientras el saldo conserva la
conversión del apunte de deuda.
La dirección se verifica con los signos en moneda nativa, para no perder una
financiación válida si una de las conversiones a EUR redondea a cero céntimos.

Ejemplo sintético: una compra de 10 € con split propio de −5 €, split de
transferencia de −5 € y contrapartida de +5 € en Pareja produce una salida real
de 10 €, gasto consolidado de 5 €, gasto atribuido a Pareja de 5 € y ninguna
recuperación. Una devolución de Pareja registrada como transferencia reduce
lo pendiente y aumenta «Recibido de deudas»; no borra el gasto histórico
atribuido.

### Consulta y representación

Los rankings de barras ofrecen límites configurables y la opción de mostrar
todos. La tabla exacta y su CSV conservan los datos completos del gráfico,
aunque el ranking visual esté recortado. Ocultar series desde la leyenda cambia
la representación, su tabla y su exportación, pero no los filtros ni los
indicadores contables.

Cuentas permite comparar saldo real, movimiento, gasto, ingreso, flujo real y
deuda. Categorías permite elegir métrica y comparar raíces o rutas con apuntes
directos; no se suman padres inclusivos con sus hijos. Las categorías elegidas
expresamente permanecen en la comparación sin recortarse por el límite de
series. Los accesos de cuentas, categorías y deudas abren los movimientos
conservando los demás filtros. Las transacciones muestran origen/destino y
permiten abrir la contrapartida o el conjunto de splits registrado; no agrupan
compras por coincidencias de texto.

En Deudas, excluir desde «todas» retira la cuenta pulsada. Se mantiene al menos
una cuenta seleccionada para que la selección vacía no reactive todas de forma
implícita. «Ver todas las deudas» restaura el ámbito de deudas y sus cuentas;
los demás filtros siguen vigentes.

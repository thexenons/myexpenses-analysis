# Importación de copias de seguridad de MyExpenses

## Contrato soportado

El importador acepta una ruta explícita a un ZIP de copia de seguridad de
MyExpenses y genera un único `data/app-dataset.json`. La copia original, la base
SQLite y las preferencias no se publican ni se extraen al disco.

La implementación actual admite de forma deliberada únicamente el esquema
SQLite `189`, correspondiente a MyExpenses `4.1.0.2` (`versionCode 871`). Una
copia con otro `PRAGMA user_version` falla antes de ejecutar consultas. Esta
restricción evita interpretar silenciosamente una versión futura con un
contrato distinto.

```sh
pnpm data:import-backup -- \
  --input data/myexpenses-backup-AAAAMMDD-HHMMSS.zip \
  --time-zone Europe/Madrid
```

La salida predeterminada es `data/app-dataset.json`; `--output` permite elegir
otra ruta. El archivo y la zona IANA son obligatorios porque el ZIP no contiene
una zona horaria canónica.

Este JSON es una entrada privada, no un asset web. Antes de iniciar o construir
la aplicación hay que ejecutar `pnpm data:encrypt`; consulta
[protección de la build estática](static-authentication.md).

La relación entre la versión y el esquema está declarada en el código oficial:

- [BaseTransactionDatabase.kt, esquema 189](https://github.com/mtotschnig/MyExpenses/blob/2552049968fd00c3d52f92cb78b39e899cd0f059/myExpenses/src/main/java/org/totschnig/myexpenses/provider/BaseTransactionDatabase.kt#L25-L37)
- [BackupUtils.kt, nombres de las entradas](https://github.com/mtotschnig/MyExpenses/blob/2552049968fd00c3d52f92cb78b39e899cd0f059/myExpenses/src/main/java/org/totschnig/myexpenses/provider/BackupUtils.kt#L22-L43)
- [ZipUtils.kt, contenido del ZIP y adjuntos](https://github.com/mtotschnig/MyExpenses/blob/2552049968fd00c3d52f92cb78b39e899cd0f059/myExpenses/src/main/java/org/totschnig/myexpenses/util/ZipUtils.kt#L28-L82)

## Tratamiento seguro y portable

El proceso usa `yauzl` y `sql.js`; no necesita `unzip`, `sqlite3`, Python ni una
versión concreta de SQLite instalada en Ubuntu. La base se lee en memoria y se
cierra siempre al terminar.

Antes de consultar datos se comprueba:

- que la entrada `BACKUP` sea una SQLite válida y que `PRAGMA quick_check`
  devuelva `ok`;
- que no existan violaciones de claves foráneas;
- que `PRAGMA user_version` sea exactamente `189` y estén presentes las tablas
  y columnas usadas;
- que el ZIP no contenga cifrado, enlaces simbólicos, rutas atravesables,
  duplicados, métodos de compresión inesperados o tamaños/ratios superiores a
  los límites configurados;
- que sólo aparezcan `BACKUP`, `BACKUP_PREF`, el DataStore opcional y adjuntos
  bajo `Pictures/`.

`BACKUP_PREF` se procesa mediante una lista cerrada. Sólo se leen políticas
financieras no sensibles: moneda doméstica, comienzo de mes/semana,
transferencias en histórico, fecha/hora y proveedor de cambio. Claves de
licencia, correo, contraseñas, tokens, destinos cloud, IBAN y BIC nunca se
copian al dataset ni se muestran en logs. Del DataStore protobuf sólo se
materializan las claves exactas `budgetFilter_<id>` y
`budgetAggregateNeutral_<id>` de presupuestos existentes; se eliminan sus
labels y se resuelven IDs a UUID. El resto permanece opaco. Los adjuntos
tampoco se publican.

El wire se valida contra el
[proto oficial de AndroidX DataStore](https://android.googlesource.com/platform/frameworks/support/+/f2e05c341382db64d127118a13451dcaa554b702/datastore/datastore-preferences-core/datastore-preferences-proto/src/main/proto/preferences.proto),
y la persistencia JSON contra
[FilterPersistence de r871](https://github.com/mtotschnig/MyExpenses/blob/2552049968fd00c3d52f92cb78b39e899cd0f059/myExpenses/src/main/java/org/totschnig/myexpenses/provider/filter/FilterPersistence.kt#L22-L55).

Las copias `data/myexpenses-backup-*.zip`, `data/app-dataset.json` y la bóveda
generada están ignoradas por Git. Vite sólo permite solicitar bajo `/data/` la
bóveda cifrada. El dataset claro sirve como entrada local de `data:encrypt` y no
entra en `dist/`.

## Semántica financiera

El adaptador toma como referencia las consultas de MyExpenses r871:

- [agrupación de movimientos y archivos](https://github.com/mtotschnig/MyExpenses/blob/2552049968fd00c3d52f92cb78b39e899cd0f059/myExpenses/src/main/java/org/totschnig/myexpenses/provider/DbConstants.kt#L845-L939)
- [sumas y saldos de cuentas](https://github.com/mtotschnig/MyExpenses/blob/2552049968fd00c3d52f92cb78b39e899cd0f059/myExpenses/src/main/java/org/totschnig/myexpenses/provider/DbConstants.kt#L595-L711)
- [tipos de categoría](https://github.com/mtotschnig/MyExpenses/blob/2552049968fd00c3d52f92cb78b39e899cd0f059/myExpenses/src/main/java/org/totschnig/myexpenses/db2/RepositoryCategory.kt#L40-L48)
- [conversión a moneda doméstica y prorrateo de splits](https://github.com/mtotschnig/MyExpenses/blob/2552049968fd00c3d52f92cb78b39e899cd0f059/myExpenses/src/main/java/org/totschnig/myexpenses/provider/DbConstants.kt#L957-L974)
- [fechas en la zona horaria del dispositivo](https://github.com/mtotschnig/MyExpenses/blob/2552049968fd00c3d52f92cb78b39e899cd0f059/myExpenses/src/main/java/org/totschnig/myexpenses/util/DateUtils.kt#L25-L58)

Las reglas fijadas son:

- se excluye el padre técnico de un split y se conserva cada parte con toda su
  procedencia;
- en datos archivados se excluye la envoltura y se conserva su contenido, para
  no contar dos veces;
- `VOID` permanece visible para auditoría, pero aporta cero a métricas y saldos;
- gasto e ingreso respetan el tipo raíz de categoría; una categoría neutral se
  clasifica por el signo;
- cualquier categoría de tipo transferencia se contabiliza como transferencia,
  exista o no un enlace real entre cuentas;
- los importes permanecen como enteros en unidades menores y usan los dígitos
  fraccionarios de su moneda;
- EUR usa identidad; las cuentas extranjeras estáticas usan
  `account_exchangerates`; las dinámicas usan su equivalente almacenado y los
  splits se prorratean desde el equivalente del padre;
- una tasa necesaria ausente aborta la importación; nunca se supone paridad con
  EUR.

`DEBT` es una vista propia definida exclusivamente por el tipo nativo de cuenta
`_LIABILITY_` (`accounts.type = 5`). `REAL_CASH` contiene el resto. Ambas parten
de los mismos apuntes que `ALL` y el importador verifica para cada subtotal:

```text
ALL = DEBT + REAL_CASH
```

## Oráculo de la copia actual

La copia `myexpenses-backup-20260822-210453.zip` tiene SHA-256
`ec6e298ea1075e089770ac678603500f5f71f8e5f894b190fda1e5f06e435ab4`; su
entrada SQLite tiene SHA-256
`85527ceade3f436927a56f881723ba8b78f3d1d5f59d5e93d150787552210742`.
Procesada con `Europe/Madrid`, produce 39 cuentas, 81 categorías reales y
13.022 apuntes canónicos:

| Métrica | Total | Sólo `_LIABILITY_` | Flujo real |
|---|---:|---:|---:|
| Apertura | 39.210,91 € | 23.540,62 € | 15.670,29 € |
| Ingresos | 87.634,05 € | 0,10 € | 87.633,95 € |
| Gastos firmados | -50.016,52 € | 50.866,27 € | -100.882,79 € |
| Transferencias | 1.820,96 € | 121,31 € | 1.699,65 € |
| Movimiento | 39.438,49 € | 50.987,68 € | -11.549,19 € |
| Saldo histórico | 78.649,40 € | 74.528,30 € | 4.121,10 € |
| Valoración por cuenta | 78.649,39 € | 74.528,30 € | 4.121,09 € |

Los gastos de `_LIABILITY_` son positivos porque MyExpenses mantiene la
clasificación de la categoría aunque el importe tenga signo inverso. El neto y
la partición siguen cuadrando; no se fuerza artificialmente el signo.

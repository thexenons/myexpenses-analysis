# Recuperar el último backup de pCloud en local

`pnpm deploy:sync-pcloud` descarga la copia más reciente en `data/`, conservando
el nombre `myexpenses-backup-YYYYMMDD-HHMMSS.zip`. **No importa, cifra, construye
ni publica nada**. El nombre del comando se mantiene por compatibilidad;
el despliegue completo corresponde al [worker de Coolify](coolify-deployment.md).

## Configurar y descargar

Desde la raíz del checkout, crea `.env` a partir de
[sync-pcloud.env.example](../deploy/sync-pcloud.env.example) **sólo si no existe**.
Si ya existe, conserva su contenido y ajusta únicamente estas variables:

```dotenv
PCLOUD_API_HOST=eapi.pcloud.com
PCLOUD_FOLDER_ID=123456789012345678
PCLOUD_TOKEN=replace-with-your-token
```

- `PCLOUD_API_HOST`: host exacto devuelto por OAuth, `api.pcloud.com` o
  `eapi.pcloud.com`; no cambies la región arbitrariamente.
- `PCLOUD_FOLDER_ID`: ID decimal de la carpeta. Como alternativa, define
  `PCLOUD_FOLDER_PATH` con una ruta absoluta de pCloud y deja el ID vacío.
  Exactamente uno de los dos selectores debe tener contenido.
- `PCLOUD_TOKEN`: token OAuth ya provisionado. El CLI no realiza el alta OAuth.

Protege el archivo y descarga:

```sh
chmod 600 .env
pnpm deploy:sync-pcloud
```

El CLI lee `.env` desde el directorio de trabajo, sin ejecutar shell ni expandir
`$VARIABLE`. Usa comillas para conservar espacios y `#`. Las variables exportadas
tienen prioridad, incluso si están vacías. Puede omitirse `.env` si el entorno
aporta las variables; otros errores de lectura abortan. `.env`, los backups y
los temporales de descarga están ignorados por Git.

No necesitas `MYEXPENSES_REPOSITORY_ROOT`, `MYEXPENSES_DEPLOY_ROOT`, frase de
cifrado, zona horaria ni SMTP. El CLI ignora las variables exclusivas del worker,
incluso si permanecen en un `.env` compartido. El destino es siempre `data/`
dentro del directorio desde el que se ejecuta, no un árbol de despliegue.

## Continuar a tu ritmo

Una vez descargada la copia, la importación y el cifrado son decisiones separadas:

```sh
pnpm data:import-backup
pnpm data:encrypt:dev
pnpm dev
```

Para una bóveda con frase, usa `pnpm data:encrypt` en lugar de
`pnpm data:encrypt:dev`. Ninguno de esos comandos se ejecuta automáticamente
al descargar. La importación puede seleccionar un backup local más reciente
si ya existe en `data/`; consulta cómo elegir uno explícitamente en la
[guía del importador](backup-import.md).

## Integridad y archivos existentes

El cliente lista únicamente la carpeta indicada, sin recursión ni eliminados,
y selecciona el timestamp de nombre más reciente entre backups válidos de
1 a 64 MiB. Mantiene los IDs de 64 bits como strings decimales.

Antes de guardar, contrasta tamaño y SHA-1 con pCloud, y SHA-256 cuando la API
lo proporciona. Descarga por streaming en un directorio temporal privado del
mismo sistema de archivos y sólo instala el ZIP después de verificarlo.
No valida ni extrae el contenido ZIP/SQLite: eso corresponde al importador.

| Situación | Resultado |
| --- | --- |
| No existe el backup local | Descarga y guarda con el nombre original y permisos `0600`. |
| Existe y coincide con los checksums | Termina correctamente sin descargar de nuevo. |
| Existe con contenido distinto | Falla sin sobrescribirlo; exige `--force` para reemplazarlo. |
| Otro proceso crea el destino durante la descarga | Falla sin sobrescribirlo cuando no hay `--force`. |
| Descarga parcial, checksum incorrecto o cancelación antes de instalar | Elimina temporales y conserva el backup anterior. |
| `data/` o el destino es un symlink o tiene un tipo no permitido | Falla sin seguir el enlace. |

Para volver a descargar, reemplazando sólo el backup con ese mismo nombre:

```sh
pnpm deploy:sync-pcloud -- --force
```

`--force` **no** reconstruye una web, no borra otros backups y no modifica
los datasets ni las bóvedas locales. Los backups pueden contener información
privada sin cifrar: protege también el equipo y sus copias de seguridad.

## Separación del worker y migración

El CLI y el worker comparten únicamente el cliente y la validación de origen
pCloud. El worker mantiene importación, cifrado, build, publicación atómica,
bloqueo del despliegue, programación y notificaciones; consulta su
[contrato de entorno](coolify-runtime-env.md).

`--config` no se admite. De una configuración JSON antigua, traslada sólo
`apiHost`, `folderId`/`path` y el contenido de `tokenFile` a las variables
`PCLOUD_*`. No pases la ruta del token como valor del token. Las antiguas
variables de despliegue ya no afectan al comando local.

El antiguo cron de despliegue con este CLI ha quedado obsoleto y el ejemplo
está desactivado. Si ya lo instalaste, retíralo explícitamente de tu servidor:
actualizar el repositorio no modifica los crons instalados. Para despliegues,
usa el worker, no este comando. Las pruebas del CLI usan credenciales sintéticas
y `fetch` simulado; no acceden a una cuenta pCloud real.

# Sincronización y despliegue desde pCloud

## Alcance

Esta guía corresponde al CLI con variables de entorno y cron en un host
Ubuntu. Para Coolify con Docker Compose y secretos de entorno, usa la
[guía específica](coolify-deployment.md); son alternativas, no pasos que deban
combinarse. `pnpm deploy:sync-pcloud` en este host, en cada
ejecución:

1. obtiene el listado directo de una carpeta pCloud concreta;
2. acepta sólo `myexpenses-backup-YYYYMMDD-HHMMSS.zip` de 1 a 64 MiB;
3. selecciona el timestamp de nombre más reciente de forma determinista;
4. consulta checksums, detecta si ya está publicado y, si cambió, descarga por
   streaming;
5. valida el ZIP/SQLite, genera el dataset, lo cifra y elimina el JSON claro;
6. autentica la bóveda con la frase que ya mantiene en memoria y sólo entonces
   ejecuta TypeScript y Vite hacia una release inmutable; el builder recibe
   exclusivamente la ruta y el SHA-256 de los bytes comprobados, nunca la frase;
7. verifica que `data/` contiene exclusivamente la bóveda;
8. cambia atómicamente `deployRoot/current` y sólo después guarda el estado.

Un fallo en descarga, importación, cifrado, autenticación de la bóveda,
type-check, build o estado conserva
la release anterior.

## Autorización pCloud

Se usa OAuth Bearer mediante la cabecera `Authorization`; nunca usuario y
contraseña. pCloud dispone de centros de datos separados y el hostname devuelto
por OAuth debe conservarse: `api.pcloud.com` para EE. UU. o
`eapi.pcloud.com` para Europa. La documentación oficial describe el
[flujo OAuth](https://docs.pcloud.com/methods/oauth_2.0/authorize.html) y señala
que los access tokens actuales
[no caducan automáticamente](https://docs.pcloud.com/methods/oauth_2.0/).

Pasos operativos:

1. solicita una aplicación en «My Apps» de pCloud —la creación requiere
   aprobación—;
2. usa el code flow recomendado para aplicaciones con servidor;
3. guarda el `access_token` y el `hostname` de la respuesta;
4. guarda el token como `PCLOUD_TOKEN` en el `.env` privado del checkout;
5. revoca el token desde pCloud si el servidor deja de ser confiable.

La autorización OAuth inicial requiere la página de consentimiento de pCloud;
el CLI recibe un token ya provisionado y no implementa ese alta. La consola de
aplicaciones distingue acceso completo y privado, pero la documentación pública
no garantiza que el modo privado pueda enlazarse a una carpeta preexistente
arbitraria. Para este caso se solicita acceso de sólo lectura y se fija además
el `folderId` en el cliente. Si el token abarca toda la cuenta, esa selección es
un límite de la aplicación, no del token; conviene usar una cuenta dedicada o
minimizar el resto de datos de la cuenta.

## Listado y descarga

El cliente usa:

- [`listfolder`](https://docs.pcloud.com/methods/folder/listfolder.html), sin
  recursión ni eliminados;
- [`checksumfile`](https://docs.pcloud.com/methods/file/checksumfile.html), con
  SHA-1 disponible en ambas regiones y SHA-256 cuando pCloud lo devuelve;
- [`getfilelink`](https://docs.pcloud.com/methods/streaming/getfilelink.html),
  sin reenviar el Bearer al host de contenido.

Los IDs se conservan como strings decimales porque pCloud define identificadores
de 64 bits. Los hosts de descarga deben ser HTTPS y subdominios válidos de
`pcloud.com`; redirects, traversal, respuestas sobredimensionadas, descargas
parciales y checksum drift se rechazan. SHA-1 se usa únicamente para contrastar
la API común US/EU; la descarga siempre calcula además SHA-256 local.

## Configuración

El CLI usa las mismas variables que el worker. Desde la raíz del checkout,
crea `.env` a partir de [sync-pcloud.env.example](../deploy/sync-pcloud.env.example)
**sólo si no existe**; no sobrescribas una configuración existente. Completa:

- `PCLOUD_API_HOST`: hostname exacto obtenido en OAuth;
- `PCLOUD_FOLDER_ID`: ID decimal, o `PCLOUD_FOLDER_PATH` como alternativa;
- `PCLOUD_TOKEN` y `MYEXPENSES_VAULT_PASSPHRASE`: secretos de ejecución;
- `MYEXPENSES_REPOSITORY_ROOT`: ruta absoluta de este checkout con dependencias
  instaladas. Debe configurarse fuera de Docker: el valor predeterminado es `/app`;
- `MYEXPENSES_DEPLOY_ROOT`: árbol de publicación, separado del checkout;
- `MYEXPENSES_TIME_ZONE`: zona IANA; por defecto `Europe/Madrid`.

Aplica `chmod 600 .env` y ejecuta como propietario del directorio de despliegue.
`.env` está ignorado por Git, pero sigue conteniendo secretos en disco. El CLI lo
lee desde el directorio de trabajo, sin ejecutar shell ni expandir `$VARIABLE`.
Usa comillas para conservar espacios y `#` dentro de los valores. Las variables
ya exportadas tienen prioridad, incluso si están vacías. Un `.env` ausente se
permite si el entorno aporta la configuración; otros errores de lectura abortan.
Consulta el [contrato compartido](coolify-runtime-env.md) para la validación.

`MYEXPENSES_DEPLOY_ROOT` y `releases/` deben ser transitables por el servidor web
(por ejemplo, `0755`). `.work/` es privado (`0700`); el estado es `0600` y queda
fuera de `current`, el document root.

Desde la raíz del checkout:

```sh
pnpm deploy:sync-pcloud
# Reconstruir aunque el backup no haya cambiado:
pnpm deploy:sync-pcloud -- --force
```

Es una ejecución puntual: no inicia el worker, no programa ciclos ni envía
correos. Las variables de notificación, si se proporcionan, pasan la validación
compartida, pero no activan envíos en el CLI.

### Migración desde JSON

`--config` ya no se admite. Traslada `apiHost`, `folderId`/`path`, `deployRoot`,
`repositoryRoot` y `timeZone` a sus variables anteriores. El contenido de los
antiguos `tokenFile` y `vaultPassphraseFile` pasa a `PCLOUD_TOKEN` y
`MYEXPENSES_VAULT_PASSPHRASE`; las rutas de esos archivos no son los secretos.
Actualiza también el cron para quitar `--config` y ejecutar desde el checkout.

## Cron y publicación atómica

El ejemplo [sync-pcloud.cron.example](../deploy/sync-pcloud.cron.example) ejecuta
cada 15 minutos y añade `flock` sobre `.cron.lock`. El CLI y el worker comparten
además un bloqueo de kernel sobre el archivo persistente `.sync.lock`; su
existencia **no** indica una ejecución activa. No lo borres ni lo trunques,
incluso cuando el proceso termine. Un archivo antiguo que contenga un PID no
es un bloqueo recuperable automáticamente: detén los escritores y resuelve la
migración antes de continuar.

El servidor web debe apuntar a:

```text
/srv/myexpenses/current
```

`current` es un symlink relativo hacia `releases/<release-id>`. El swap se hace
con `rename`, de modo que nunca se publica un árbol parcialmente construido. El
estado `.sync-state.json` queda fuera del document root efectivo y con modo
`0600`.

Las releases antiguas no se eliminan automáticamente: permiten rollback y
evitan convertir una política de retención incorrecta en pérdida de datos.
Para volver atrás:

1. Detén el cron, el worker de Coolify si existe, y cualquier sincronización
   manual; espera a que terminen. No ejecutes simultáneamente cron y worker, ni
   borres `.sync.lock`. Mantén los escritores detenidos hasta decidir cuándo
   publicar datos nuevos.
2. Selecciona y revisa un ID existente bajo `releases/`; confirma que esa
   release contiene `index.html` y `data/app-dataset.vault.json`, y que conoces
   la frase con la que se cifró. Ejecútalo como el usuario `myexpenses`,
   sustituyendo el ID:

   ```bash
   sudo -u myexpenses /usr/bin/env node --input-type=module <<'JS'
   import {
     closeSync, constants, fstatSync, lstatSync, openSync, readlinkSync,
     renameSync, symlinkSync, unlinkSync,
   } from 'node:fs';
   import { join } from 'node:path';
   import { spawnSync } from 'node:child_process';

   const root = '/srv/myexpenses';
   const releaseId = 'replace-with-reviewed-release-id';
   const held = [];
   let temporary;
   let temporaryCreated = false;
   process.umask(0o077);

   function directory(path) {
     const entry = lstatSync(path);
     if (!entry.isDirectory() || entry.uid !== process.getuid() ||
         (entry.mode & 0o022) !== 0) throw new Error('Directorio inseguro');
   }

   function acquire(name, strictMode) {
     const path = join(root, name);
     const fd = openSync(path, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
     try {
       const verify = () => {
         const open = fstatSync(fd);
         const visible = lstatSync(path);
         if (!open.isFile() || !visible.isFile() || open.dev !== visible.dev ||
             open.ino !== visible.ino || open.nlink !== 1 || open.size !== 0 ||
             open.uid !== process.getuid() ||
             (strictMode ? (open.mode & 0o777) !== 0o600 : (open.mode & 0o022) !== 0)) {
           throw new Error(`Bloqueo inseguro: ${name}`);
         }
       };
       verify();
       const result = spawnSync('/usr/bin/flock',
         ['--exclusive', '--nonblock', '--conflict-exit-code', '75', '3'],
         { stdio: ['ignore', 'ignore', 'ignore', fd] });
       if (result.error || result.status !== 0) throw new Error(`Bloqueo ocupado o no disponible: ${name}`);
       verify();
       held.push(fd);
     } catch (error) {
       closeSync(fd);
       throw error;
     }
   }

   try {
     if (!/^[a-z0-9][a-z0-9-]{0,159}$/.test(releaseId)) throw new Error('ID de release inválido');
     directory(root);
     directory(join(root, 'releases'));
     acquire('.cron.lock', false);
     acquire('.sync.lock', true);
     const release = join(root, 'releases', releaseId);
     directory(release);
     directory(join(release, 'data'));
     for (const file of ['index.html', 'data/app-dataset.vault.json']) {
       if (!lstatSync(join(release, file)).isFile()) throw new Error('Release incompleta');
     }
     const current = join(root, 'current');
     if (!lstatSync(current).isSymbolicLink()) throw new Error('Enlace current inválido');
     const previous = readlinkSync(current);
     if (!/^releases\/[a-z0-9][a-z0-9-]{0,159}$/.test(previous)) throw new Error('Destino current inválido');
     directory(join(root, previous));
     temporary = join(root, `.current.rollback.${process.pid}`);
     symlinkSync(`releases/${releaseId}`, temporary);
     temporaryCreated = true;
     renameSync(temporary, current);
     temporaryCreated = false;
     if (readlinkSync(current) !== `releases/${releaseId}`) throw new Error('Publicación no verificada');
     console.log(`Anterior: ${previous}; actual: ${readlinkSync(current)}`);
   } catch (error) {
     console.error(error instanceof Error ? error.message : 'Rollback fallido');
     process.exitCode = 1;
   } finally {
     if (temporaryCreated) {
       try { unlinkSync(temporary); } catch { /* No se creó el enlace temporal. */ }
     }
     for (const fd of held.reverse()) closeSync(fd);
   }
   JS
   ```

   El ejemplo usa Node y `/usr/bin/flock` ya necesarios en este host. Abre los
   bloqueos sin seguir symlinks y conserva sus descriptores hasta terminar;
   si alguno está ocupado o tiene metadatos inseguros, no cambia `current`.
   Un `.sync.lock` ausente se crea con `0600`; uno antiguo con PID exige
   intervención manual con todos los escritores detenidos. No renombres ni
   elimines el bloqueo para «desatascar» una ejecución activa.

3. Verifica por HTTPS que la aplicación carga y que la bóveda se desbloquea
   con la frase correspondiente. El cambio de symlink es atómico, pero **no**
   modifica `.sync-state.json`; conserva el estado para diagnóstico. Al
   reanudar el cron, el orquestador verá que `current` no coincide con la
   release del estado y puede volver a publicar el backup más reciente. No
   ejecutes `--force` como parte del rollback inmediato: reconstruye y publica
   el backup más reciente, no la release antigua. Úsalo sólo cuando quieras
   desplegar de nuevo tras corregir la causa.

Al rotar la frase, retira después las releases cifradas con la frase anterior.
La configuración de rotación del log está en [la guía de despliegue](../deploy/README.md#rotación-del-log).

## Límites y operación

- El cron actualiza datos; no ejecuta `git pull` ni actualiza dependencias.
- Los tests usan un `fetch` simulado y nunca una cuenta pCloud real.
- Un token comprometido permite acceder a los datos que autorice la aplicación
  pCloud; la bóveda no protege el backup dentro de pCloud.
- Un servidor comprometido puede leer el token y la frase, o modificar el
  JavaScript publicado. Aplica parches, mínimo privilegio, HTTPS y las cabeceras
  de [protección estática](static-authentication.md).
- Revisa crecimiento de `releases/`; el pruning es deliberadamente manual.

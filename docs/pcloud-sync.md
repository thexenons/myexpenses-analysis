# Sincronización y despliegue desde pCloud

## Alcance

`pnpm deploy:sync-pcloud` está diseñado para un cron de Ubuntu. En cada
ejecución:

1. obtiene el listado directo de una carpeta pCloud concreta;
2. acepta sólo `myexpenses-backup-YYYYMMDD-HHMMSS.zip` de 1 a 64 MiB;
3. selecciona el timestamp de nombre más reciente de forma determinista;
4. consulta checksums, detecta si ya está publicado y, si cambió, descarga por
   streaming;
5. valida el ZIP/SQLite, genera el dataset, lo cifra y elimina el JSON claro;
6. ejecuta TypeScript y Vite hacia una release inmutable;
7. verifica que `data/` contiene exclusivamente la bóveda;
8. cambia atómicamente `deployRoot/current` y sólo después guarda el estado.

Un fallo en descarga, importación, cifrado, type-check, build o estado conserva
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
4. escribe sólo el token en `/etc/myexpenses/pcloud.token` y aplica `0600`;
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

Copia [sync-pcloud.config.example.json](../deploy/sync-pcloud.config.example.json)
a `/etc/myexpenses/sync-pcloud.json` y ajusta:

- `apiHost`: hostname exacto obtenido en OAuth;
- `folderId`: string decimal de la carpeta; como alternativa, `path` absoluto;
- `tokenFile`: fichero `0600` con el Bearer;
- `vaultPassphraseFile`: fichero `0600` con la frase de la web;
- `deployRoot`: padre privado de `releases/`, `.work/`, estado y `current`;
- `repositoryRoot`: checkout con dependencias instaladas;
- `timeZone`: zona IANA que MyExpenses no incluye en el backup.

Los árboles `deployRoot` y `repositoryRoot` deben estar separados. Ningún
secreto se admite dentro del JSON de configuración, argumentos, entorno o logs.

Prueba manual:

```sh
pnpm deploy:sync-pcloud -- \
  --config /etc/myexpenses/sync-pcloud.json
```

`--force` reconstruye el mismo backup, útil después de actualizar el código.

## Cron y publicación atómica

El ejemplo [sync-pcloud.cron.example](../deploy/sync-pcloud.cron.example) ejecuta
cada 15 minutos y añade `flock`. El orquestador mantiene además un lock privado
con PID y recupera uno huérfano cuando el proceso ya no existe.

El servidor web debe apuntar a:

```text
/srv/myexpenses/current
```

`current` es un symlink relativo hacia `releases/<release-id>`. El swap se hace
con `rename`, de modo que nunca se publica un árbol parcialmente construido. El
estado `.sync-state.json` queda fuera del document root efectivo y con modo
`0600`.

Las releases antiguas no se eliminan automáticamente: permiten rollback y
evitan convertir una política de retención incorrecta en pérdida de datos. Para
volver atrás, cambia `current` de forma atómica hacia una release revisada y usa
`--force` en la siguiente actualización. Al rotar la frase, retira después las
releases cifradas con la frase anterior.

## Límites y operación

- El cron actualiza datos; no ejecuta `git pull` ni actualiza dependencias.
- Los tests usan un `fetch` simulado y nunca una cuenta pCloud real.
- Un token comprometido permite acceder a los datos que autorice la aplicación
  pCloud; la bóveda no protege el backup dentro de pCloud.
- Un servidor comprometido puede leer el token y la frase, o modificar el
  JavaScript publicado. Aplica parches, mínimo privilegio, HTTPS y las cabeceras
  de [protección estática](static-authentication.md).
- Revisa crecimiento de `releases/` y logs; el pruning es deliberadamente
  manual.

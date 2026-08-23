# Despliegue periódico desde pCloud

Estos archivos son ejemplos; no contienen secretos ni activan el cron por sí
solos. El servidor web debe usar como document root:

```text
/srv/myexpenses/current
```

`current` es un enlace simbólico que el orquestador cambia atómicamente hacia
`/srv/myexpenses/releases/<release-id>`. Las releases anteriores no se borran.
[`nginx.example.conf`](nginx.example.conf) muestra SPA fallback, HTTPS, CSP y
cabeceras defensivas; ajusta dominio y certificados antes de instalarlo. Para
otro servidor, replica la lista independiente de
[`security-headers.example.txt`](security-headers.example.txt).

La CSP se entrega como cabecera HTTP de forma deliberada. Una meta-CSP en
`index.html` no puede aplicar `frame-ancestors`, HSTS ni las demás cabeceras, y
además mezclaría la política de producción con el WebSocket de desarrollo de
Vite. La cabecera permite mantener ambas rutas separadas. Los gráficos React
usan atributos `style` para variables CSS dinámicas: se permiten mediante
`style-src-attr`; en navegadores CSP3, scripts y elementos `<style>` siguen
restringidos a ficheros del mismo origen.

El HTML, las rutas SPA y la bóveda cifrada se sirven con `Cache-Control:
no-store`. Sólo `/assets/` con el patrón hash de Vite recibe cache anual
`immutable`; un asset ausente devuelve 404 y nunca cae en el fallback SPA.

## Preparación

```sh
sudo install -d -o myexpenses -g myexpenses -m 0755 /srv/myexpenses
sudo install -d -o root -g myexpenses -m 0750 /etc/myexpenses
sudo install -o myexpenses -g myexpenses -m 0600 deploy/sync-pcloud.config.example.json /etc/myexpenses/sync-pcloud.json
sudo install -o myexpenses -g myexpenses -m 0600 /secure/source/pcloud.token /etc/myexpenses/pcloud.token
sudo install -o myexpenses -g myexpenses -m 0600 /secure/source/vault.passphrase /etc/myexpenses/vault.passphrase
sudo install -o myexpenses -g myexpenses -m 0600 /dev/null /var/log/myexpenses-sync.log
sudo install -o root -g root -m 0644 deploy/sync-pcloud.cron.example /etc/cron.d/myexpenses-sync-pcloud
```

Use `folderId` como string decimal para no perder IDs de 64 bits. Si no está
disponible, se admite un `path` absoluto de pCloud en su lugar. `apiHost` sólo
puede ser `api.pcloud.com` o `eapi.pcloud.com`, según la región de la cuenta.
`timeZone` es una zona IANA obligatoria que se entrega a `importBackup`.
El token OAuth debe provisionarse antes del despliegue: pCloud exige una
autorización interactiva inicial, pero ninguna ejecución periódica abre un
navegador ni necesita el `client_secret`.

## Pipeline conectado

El comando del proyecto ya conecta `runSyncPCloudCli` con el pipeline completo:

```sh
pnpm deploy:sync-pcloud -- --config /etc/myexpenses/sync-pcloud.json
```

Dentro de un workspace `0700` ejecuta:

1. `importBackup` sobre `backupPath`;
2. cifrado del dataset con el formato static-vault compartido;
3. eliminación inmediata del JSON claro temporal;
4. type-check y build de producción hacia una release nueva;
5. comprobación de que la release sólo contiene la bóveda bajo `data/`.

El orquestador publica el directorio, cambia `current` y escribe el estado
privado sólo después del éxito completo. Una excepción conserva la release
anterior. `--force` permite reconstruir el mismo backup tras actualizar código.

El cron usa además `flock`; el orquestador mantiene su propio lock con PID y
recupera de forma segura locks cuyo proceso ya no existe. `--force` vuelve a
procesar el mismo backup sin sobrescribir la release anterior.

Las releases anteriores se conservan deliberadamente para rollback y no se
eliminan de forma automática. Revísalas periódicamente, sobre todo al rotar la
frase de la bóveda.

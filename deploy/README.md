# Despliegue periódico desde pCloud

Esta guía corresponde al despliegue en un host Linux con CLI, archivos de
secretos y cron. Para Coolify con Docker Compose y secretos de entorno, sigue
[la guía de Coolify](../docs/coolify-deployment.md) **en lugar de** estos pasos;
no actives cron y worker sobre el mismo volumen.

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

El cron usa además `flock` sobre `.cron.lock`; el CLI y el worker comparten el
bloqueo de kernel sobre `.sync.lock`. Este archivo permanece incluso sin una
ejecución activa: no lo borres ni lo trunques para liberar un bloqueo. Un
antiguo archivo con PID requiere migración con todos los escritores detenidos.
`--force` vuelve a procesar el mismo backup sin sobrescribir la release anterior.

Las releases anteriores se conservan deliberadamente para rollback y no se
eliminan de forma automática. Revísalas periódicamente, sobre todo al rotar la
frase de la bóveda.

## Rotación del log

El cron añade salida a `/var/log/myexpenses-sync.log` cada 15 minutos; sin
rotación, ese fichero crece indefinidamente. Instala esta política como
`/etc/logrotate.d/myexpenses-sync` y comprueba que el servicio periódico de
`logrotate` esté activo:

```text
/var/log/myexpenses-sync.log {
    weekly
    rotate 12
    compress
    delaycompress
    missingok
    notifempty
    create 0600 myexpenses myexpenses
}
```

Conserva 12 rotaciones semanales. La rotación por renombrado y `create` evita
`copytruncate`, cuya ventana de copia/truncado puede perder líneas. Una
ejecución de cron ya iniciada puede seguir escribiendo en el fichero
renombrado hasta terminar; la siguiente abre el nuevo fichero. `delaycompress`
deja la rotación más reciente sin comprimir para ese caso, pero no sustituye
la monitorización si una ejecución dura más de un ciclo de rotación. Prueba la
configuración sin cambiar logs con
`sudo logrotate --debug /etc/logrotate.d/myexpenses-sync`.

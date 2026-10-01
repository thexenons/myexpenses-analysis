# Despliegue de MyExpenses en Coolify con Docker Compose

Esta es la ruta **Coolify + Docker Compose**: el worker descarga, importa,
cifra, construye y publica. El repositorio aporta `compose.yaml`, `Dockerfile`
y nginx; Coolify aporta las variables **de ejecución**. Nadie debe crear un JSON,
un token ni una frase de paso dentro del contenedor.

El CLI `pnpm deploy:sync-pcloud` es un flujo diferente: lee `.env` y descarga
únicamente el último ZIP en `data/` para trabajo local. Comparte sólo las variables
`PCLOUD_*`; no requiere configuración de despliegue y no acepta `--config`.
El antiguo despliegue por CLI y cron está retirado; no instales ese cron.

## 1. Preparar origen y credenciales

1. Publica en la rama privada `main` un commit que contenga este despliegue.
   **Un commit sólo local no llega a Coolify**; el envío al remoto lo realiza
   quien administra el repositorio. Concede a la GitHub App de Coolify acceso
   a este repositorio y comprueba que su destino puede construir imágenes.
2. Prepara un backup de MyExpenses en una carpeta de pCloud. El cliente sólo
   considera nombres `myexpenses-backup-AAAAMMDD-HHMMSS.zip` válidos, hasta
   64 MiB, y selecciona el más reciente según su orden de backup. Anota el ID
   decimal de la carpeta o su ruta absoluta, por ejemplo `/Backups/MyExpenses`.
3. Obtén un token OAuth de pCloud mediante una aplicación aprobada y el
   [flujo de autorización por código](https://docs.pcloud.com/methods/oauth_2.0/authorize.html):
   autoriza de forma interactiva, intercambia el código en un entorno de
   confianza según la [documentación oficial](https://docs.pcloud.com/methods/oauth_2.0/oauth2_token.html)
   y conserva el `access_token` y el `hostname` devuelto. Este proyecto no
   implementa el alta OAuth ni necesita el `client_secret` en Coolify. El host
   es `api.pcloud.com` (EE. UU.) o `eapi.pcloud.com` (Europa); **no lo adivines**
   a partir de tu ubicación. La selección de carpeta limita lo que descarga
   esta aplicación, pero no necesariamente el alcance del token en pCloud.
4. Genera una frase de paso aleatoria y guárdala fuera del servidor para poder
   desbloquear la bóveda en el navegador. Debe contener entre **16 y 1024 bytes
   UTF-8**. La misma frase se usa al cifrar y al desbloquear; perderla impide
   abrir las releases existentes. No pongas token, frase ni `client_secret` en
   Git, capturas, logs, comandos con eco o tickets de soporte.

## 2. Cambiar la aplicación en Coolify

1. En la aplicación privada existente, anota el dominio y los valores de
   variables que debas migrar. Cambia **Configuration → General → Build Pack**
   de Nixpacks/Static a **Docker Compose**. Usa la rama `main`, **Base Directory**
   igual a la raíz del repositorio (`.`) y **Docker Compose Location** igual a
   `compose.yaml`. No elijas **Docker Compose Empty**: perderías la definición
   versionada y los eventos de Git. Si la instancia no permite convertir esa
   aplicación, crea otra desde **+ New → GitHub App → repositorio privado →
   rama main**, selecciona Docker Compose y conserva la anterior hasta validar
   la nueva. Un dominio de prueba separado evita un cambio prematuro, aunque
   implica otro volumen y otra descarga del backup.
2. Guarda y revisa el Compose que Coolify detecta: debe contener exactamente
   `worker` y `web`, ambos con `build.target`, y un volumen nombrado compartido.
   El `build.context` y `dockerfile` ya están en `compose.yaml`; no rellenes
   campos Nixpacks de instalar, compilar, iniciar ni directorio estático `dist`.
   Desactiva **Advanced → Build → Inject Build Args to Dockerfile** y deja
   **Raw Compose Deployment** desactivado para que Coolify gestione el proxy.
   Retira cualquier hook pre/post despliegue, cron o Scheduled Task heredado:
   el worker ejecuta un bucle secuencial propio.
3. Configura el dominio **sólo en `web`** como
   `https://finanzas.example.com:8080`, sustituyendo el hostname. `:8080` es
   el puerto **interno** de nginx; los clientes usan HTTPS/443. `worker` no
   tiene dominio ni puerto público. Apunta DNS A/AAAA al servidor y permite
   80/443 al proxy de Coolify para su gestión de TLS. No añadas `ports:` de
   Docker ni un segundo proxy/certificado en nginx.
4. En **Persistent Storage**, verifica el volumen `myexpenses_data` que define
   Compose. **No añadas otro bind mount en la interfaz**. El primer volumen
   vacío hereda del worker `/srv/myexpenses` con propietario 1000; el web lo
   monta sólo para lectura con `nocopy`. Si el volumen ya existe con otro
   propietario o permisos inseguros, el worker falla cerrado: identifica y
   corrige la causa con un plan de conservación de datos, no con un `chown`
   privilegiado automático al arrancar.

### Variables de entorno de `worker`

#### Evidencias de actualización en la aplicación

La barra lateral distingue la cobertura de movimientos, la fecha y hora
indicadas por el nombre del backup, el instante real de importación (UTC) y la
revisión pública de la aplicación. El nombre del archivo no indica una zona
horaria ni confirma cuándo se capturó el backup. Los datasets antiguos y las
compilaciones sin revisión válida muestran «No disponible».

Para mostrar la revisión, define `MYEXPENSES_APP_REVISION` como un identificador
Git hexadecimal de 7 a 64 caracteres en el entorno **de ejecución** de
`worker`, y vuelve a desplegar o reiniciar el worker para que construya otra
release. `compose.yaml` pasa también `SOURCE_COMMIT` a ese worker como respaldo
opcional si Coolify lo proporciona en tiempo de ejecución; no hace falta
inyectarlo como argumento de Docker build. Un valor vacío de
`MYEXPENSES_APP_REVISION` permite usar ese respaldo; un valor explícito no
vacío pero inválido deja la revisión como no disponible. Sólo el identificador
hexadecimal validado llega al build del navegador, nunca las demás variables.

En **Configuration → Environment Variables**, utiliza la vista normal para
revisar cada variable. Coolify activa **Build Variable** y **Runtime Variable**
por defecto: para **todas** las siguientes, deja **Runtime ON / Build OFF**.
Marca **Literal ON** para token y frase (en especial si contienen `$`), y
**Multiline OFF**. En **Advanced → Build**, conserva desactivada la inyección
de argumentos de compilación. Las variables sólo aparecen en `worker`, no en
`web`; el proceso de build de TypeScript/Vite recibe una lista explícita que
excluye las credenciales. Administradores con acceso privilegiado a
Coolify/Docker sí pueden inspeccionar el entorno de ejecución.

| Variable | Valor |
| --- | --- |
| `PCLOUD_API_HOST` | Obligatoria: host exacto del OAuth, `api.pcloud.com` o `eapi.pcloud.com`. |
| `PCLOUD_TOKEN` | Obligatoria: `access_token`; Runtime ON, Build OFF, Literal ON. |
| `MYEXPENSES_VAULT_PASSPHRASE` | Obligatoria: misma frase que usará el navegador; Runtime ON, Build OFF, Literal ON. |
| `PCLOUD_FOLDER_ID` | ID decimal de hasta 64 bits **o vacío** si se usa ruta. |
| `PCLOUD_FOLDER_PATH` | Ruta absoluta de pCloud **o vacía** si se usa ID. |
| `MYEXPENSES_TIME_ZONE` | Opcional, zona IANA; defecto `Europe/Madrid`. |
| `MYEXPENSES_APP_REVISION` | Opcional: identificador Git hexadecimal público de 7 a 64 caracteres; Runtime ON, Build OFF. Si está vacío, se intenta `SOURCE_COMMIT`. |
| `SOURCE_COMMIT` | Opcional: respaldo hexadecimal si Coolify lo proporciona al worker en tiempo de ejecución; Runtime ON, Build OFF. No requiere argumentos de Docker build. |
| `MYEXPENSES_SYNC_INTERVAL_SECONDS` | Opcional, defecto `3600`; entero de 30 a 86400. |
| `MYEXPENSES_SYNC_TIMEOUT_SECONDS` | Opcional, defecto `1800`; entero de 30 a 86400 por ciclo. |

**Exactamente un selector de carpeta debe tener contenido.** Compose presenta
los dos con valor vacío por defecto; dos valores o ninguno provocan error. Las
rutas internas `/app` y `/srv/myexpenses` coinciden con los montajes y no se
exponen como variables de esta receta. Cambiarlas requiere revisar Dockerfile,
Compose y validaciones conjuntamente.

## 3. Desplegar y comprobar

1. Desactiva cualquier cron/worker anterior que escriba en el **mismo**
   `/srv/myexpenses` y detén el worker antiguo antes de reemplazarlo. No
   aumentes réplicas ni ejecutes la CLI simultáneamente. Un lock PID heredado
   no vacío bloquea la migración: retíralo sólo tras confirmar que todos los
   procesos antiguos terminaron. El worker nuevo utiliza un único `flock` de
   kernel durante toda su vida. El fichero `.sync.lock` permanece incluso sin
   writer activo: su mera existencia **no** demuestra que el lease esté ocupado,
   y no debe borrarse manualmente.
2. Pulsa **Deploy** y revisa **Deployments** y los logs separados de ambos
   servicios. El worker hace un bootstrap **forzado** que descarga, importa,
   cifra, comprueba TypeScript, genera Vite y publica la release completa. Sólo
   entonces crea `/run/myexpenses/ready`. `web` espera a que `worker` esté
   healthy antes de iniciar por primera vez. El healthcheck de worker tiene
   `start_period: 35m`; **no es un timeout del despliegue**. Con el timeout de
   ciclo predeterminado de 30 minutos, una primera sincronización fallida deja
   la aplicación sin nueva release saludable.
3. En la terminal **de worker** puedes inspeccionar metadatos sin imprimir
   credenciales ni el contenido de la bóveda:

   ```sh
   test -f /run/myexpenses/ready
   readlink /srv/myexpenses/current
   stat -c '%u:%g %a %n' /srv/myexpenses /srv/myexpenses/.work /srv/myexpenses/releases
   node -e "const s=require('/srv/myexpenses/.sync-state.json'); console.log({fileId:s.fileId,releaseId:s.releaseId,modifiedEpochSeconds:s.modifiedEpochSeconds})"
   cat /srv/myexpenses/.sync-status.json
   ```

   `.sync-status.json` es un diagnóstico privado del worker (modo `0600`), no
   un endpoint de la web ni una comprobación de disponibilidad. Sus tiempos
   `lastAttemptEpochMs`, `lastSuccessfulCheckEpochMs` y
   `lastPublicationConfirmedEpochMs` son milisegundos Unix: distinguen un
   worker que dejó de consultar pCloud, consultas correctas sin cambios y la
   última publicación confirmada. `consecutiveFailures` cuenta los ciclos
   fallidos desde la última consulta correcta; `null` significa que todavía
   no hay evidencia de ese hito. `lastObservedSourceModifiedEpochSeconds` es
   la fecha de modificación que pCloud comunicó para la última copia cuya
   publicación o consulta sin cambios confirmó el worker, en **segundos Unix**:
   no demuestra cuándo se capturaron los datos ni el estado actual tras un
   fallo de publicación ambiguo. Una fecha antigua puede ser legítima si las
   consultas recientes no encontraron una
   copia nueva. Interpreta la edad según la cadencia real de tus copias; no
   hay una alarma predeterminada. Un error al guardar este diagnóstico no
   retira la release ni cambia el estado de `ready`.

   En la terminal **de web**: `curl -fsSI --max-time 3
   http://127.0.0.1:8080/data/app-dataset.vault.json`. Para Docker Compose,
   los healthchecks se definen en `compose.yaml`, no en la página estándar de
   Healthcheck de la aplicación. Desde el equipo operador, confirma HTTPS y
   los encabezados con `curl -fsSI https://finanzas.example.com/data/app-dataset.vault.json`.
   No uses `curl -v`, `env`, trazas HTTP ni salidas expandidas de configuración
   al diagnosticar secretos.
4. Sólo después de validar la nueva aplicación asigna el dominio definitivo
   y retira la ruta pública anterior para evitar dos servicios con el mismo
   hostname. Si activas **Advanced → Deployment & Git → Auto Deploy** para la
   GitHub App, sus eventos llegan por la integración: no crees manualmente un
   webhook. Primero verifica en un ensayo que la sustitución Compose detiene
   el worker viejo antes de que el nuevo publique; si no puedes garantizarlo,
   conserva el despliegue manual coordinado. Docker Compose **no** usa las
   rolling updates de Coolify ni promete cero interrupciones.

## Operación, recuperación y aceptación

- **Ciclo normal:** sin backup nuevo, el worker no descarga ni recompila. Con
  backup nuevo, publica otra release tras validarla. Un fallo periódico registra
  un mensaje genérico, conserva la release servida y reintenta después del
  intervalo; un icono healthy puede reflejar una release **vieja**. Compara
  `fileId`, `modifiedEpochSeconds`, `releaseId`, logs y fecha esperada en pCloud.
- **Cambio de código o reinicio:** cada arranque del worker fuerza un build,
  incluso con el mismo backup. Tras confirmar el nuevo estado, el worker conserva
  cinco releases generadas por la aplicación, incluyendo la activa y la que era
  activa inmediatamente antes de publicar; la limpieza falla de forma segura y
  no revierte una publicación confirmada. Las releases anteriores sin marcador
  válido, ajenas o enlazadas simbólicamente no se eliminan automáticamente: el
  espacio total del volumen puede seguir creciendo y exige inventario manual
  antes de cualquier limpieza autorizada. Esta retención facilita un rollback
  coordinado, pero no garantiza que sigan disponibles las URL de assets de
  clientes antiguos: Nginx sirve los assets desde `current`.
  Rotar token o frase en Coolify exige guardar y reiniciar/recrear el worker; después
  comprueba el desbloqueo del navegador con la **nueva** frase. Conserva también
  las frases anteriores mientras existan releases cifradas con ellas, incluidas
  las no gestionadas. Vigila la capacidad del volumen.
- **Fallo/rollback:** no borres el volumen, `.sync.lock`, `.sync-state.json`, `releases` ni
  `current` para «arreglar» un fallo. Primero detén el worker y toma una copia
  coherente del **volumen completo**. Cualquier restauración o mutación manual
  de la publicación exige detener el worker y excluir a otros escritores con
  el **mismo lease `flock`** antes de tocar `current`, estado o releases; no
  basta con comprobar que existe o falta el fichero lock. Para revertir código,
  despliega un commit conocido con el worker antiguo detenido y verifica de
  nuevo; el bootstrap
  forzado procesará el backup que sea más reciente en pCloud. Revertir sólo la
  imagen **no** revierte los datos. Para restaurar datos anteriores, coordina
  una copia coherente del volumen y el origen pCloud antes de reanudar: al
  reiniciar, el worker puede volver a publicar el backup actual. No existe
  una orden de rollback de release en esta receta.

### Lista de aceptación en un entorno real

Marcar manualmente **después** del despliegue; las pruebas locales no sustituyen
esta comprobación:

- [ ] Primer arranque: `worker` publica antes de estar healthy; `web` responde
  por HTTPS con la bóveda JSON cifrada, `Cache-Control: no-store` y encabezados
  defensivos; el navegador solicita la frase y desbloquea correctamente.
- [ ] JavaScript/CSS se sirven con MIME correcto y `nosniff`; assets con hash
  reciben caché `immutable`; asset inexistente y cualquier otro `/data/`
  devuelven 404; rutas SPA llegan a `index.html` sin exponer dotfiles.
- [ ] Sin backup nuevo: `fileId`, release y estado permanecen iguales, sin
  nueva descarga/build. Con un backup **sintético de prueba autorizado** en
  una carpeta/entorno aislado: cambia la release y se ven cuentas, saldo de
  deuda, transferencias y filtros correctos tras desbloquear.
- [ ] Cambio de código con el mismo backup y reinicio: se genera una release
  nueva. Un fallo de build o de pCloud conserva la anterior, sin JSON claro,
  token ni frase en assets o logs. Sólo hay un worker con el lease activo.
- [ ] Copia/restauración del volumen y recuperación de secretos están
  documentadas y ensayadas antes de depender de este servicio.

Las pruebas locales automatizadas (`pnpm test:deployment`) cubren con datos
ficticios descarga inyectada, importación SQLite, cifrado, TypeScript, Vite,
publicación atómica, no-op, actualización, fallo y métricas financieras. Se
reutilizan dependencias locales: **no prueban** instalación Docker, montaje de
volumen, UID 101, Compose/Coolify, TLS ni un pCloud real. Una prueba local
separada ejecutó nginx oficial 1.30.5 sin contenedor con rutas sustituidas y
verificó sintaxis, MIME, headers y rutas HTTP sintéticas; tampoco prueba esos
aspectos de contenedor o proxy.

### Diagnóstico breve

| Síntoma | Comprobar sin exponer secretos |
| --- | --- |
| 401 o rechazo de API | `PCLOUD_API_HOST` devuelto por OAuth, token vigente y acceso a la carpeta; revocar/rotar desde pCloud si se sospecha filtración. |
| Configuración inválida | Exactamente un selector no vacío, ID decimal/ruta absoluta, zona IANA, intervalo/timeout de 30–86400 y frase de 16–1024 bytes UTF-8. Literal ON evita expandir `$`. |
| Lease ocupado o lock heredado | Parar writers anteriores; nunca borrar `.sync.lock` para «liberar» `flock`. Un PID lock no vacío exige migración supervisada. |
| Directorio inseguro o disco lleno | Verificar propietario 1000, `.work` 0700, espacio libre y política de copias; no usar root para forzar el arranque. |
| Worker no healthy | Logs genéricos de bootstrap, pCloud, backup válido, timeout y `/run/myexpenses/ready`; 35m de `start_period` no alarga el timeout del ciclo. |
| Web healthy pero datos antiguos | Comparar estado y release con el backup más reciente; una sincronización periódica fallida mantiene la release previa. |

Fuentes operativas: [Compose en Coolify](https://coolify.io/docs/applications/builds/docker-compose),
[variables de entorno](https://coolify.io/docs/applications/configuration/environment-variables),
[ajustes avanzados](https://coolify.io/docs/applications/configuration/advanced),
[healthchecks Compose](https://coolify.io/docs/applications/configuration/health-checks),
[despliegues automáticos](https://coolify.io/docs/applications/deployments/automatic-deployments)
y [límite de rolling updates](https://coolify.io/docs/applications/deployments/rolling-updates),
[dominios](https://coolify.io/docs/core/networking/domains) y
[DNS](https://coolify.io/docs/core/networking/dns).

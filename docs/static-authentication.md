# Protección de la build estática

## Modelo elegido

Un servidor de archivos no puede aplicar autenticación por sí solo. Un formulario
que comparase una contraseña en JavaScript sería decorativo: cualquiera podría
descargar el JSON directamente. Por ello esta aplicación usa una **bóveda
cifrada en cliente**, no una contraseña incrustada:

1. `app-dataset.json` se valida y comprime con gzip.
2. Una frase deriva una clave no extraíble.
3. Los bytes comprimidos se cifran y autentican.
4. La build publica únicamente `data/app-dataset.vault.json`.
5. El navegador no solicita la bóveda hasta que se envía el formulario.
6. La frase se usa sólo durante el desbloqueo y no entra en Zustand,
   `localStorage`, URL ni logs.

Es un acceso de una sola frase compartida. No proporciona usuarios, permisos,
recuperación de contraseña ni auditoría de sesiones; esas funciones necesitan
un backend.

## Parámetros criptográficos

El formato versionado `myexpenses-static-vault` v1 fija:

- PBKDF2-HMAC-SHA-256, 600.000 iteraciones;
- salt aleatorio de 16 bytes por cifrado;
- AES-256-GCM con tag de 128 bits;
- IV aleatorio de 12 bytes por cifrado;
- header canónico completo autenticado como AAD;
- frase de 16 a 1.024 bytes UTF-8;
- límites estrictos para envelope, ciphertext y descompresión.

Las 600.000 iteraciones corresponden a la recomendación publicada para
PBKDF2-HMAC-SHA-256 en la
[Password Storage Cheat Sheet de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
El IV de 96 bits y la unicidad por clave siguen
[NIST SP 800-38D](https://csrc.nist.gov/pubs/sp/800/38/d/final). Cada cifrado
genera salt e IV nuevos; dos bóvedas del mismo dataset no son iguales.

## Uso manual

```sh
pnpm data:import-backup -- \
  --input data/myexpenses-backup-AAAAMMDD-HHMMSS.zip \
  --time-zone Europe/Madrid

# Prompt TTY oculto y confirmación
pnpm data:encrypt

pnpm dev
pnpm build
```

`pnpm build` vuelve a pedir la frase sin mostrarla. Un preflight Node descifra
la bóveda con una frase no vacía y comprueba su autenticidad antes de ejecutar
TypeScript y Vite. Si la frase es incorrecta o la bóveda está dañada, no se
lanza la build. El preflight calcula un SHA-256 de los bytes exactos y pasa
solamente ese valor y la ruta al proceso de Vite; Vite rechaza un hash ausente,
mal formado o diferente y publica el mismo buffer comprobado. El hash NO es
una firma independiente: depende de que el preflight y el lanzamiento del
builder sean confiables. Esto no aísla procesos del mismo usuario ni protege
frente a modificaciones del código del repositorio o del entorno de lanzamiento.

Sólo para desarrollo local puede omitirse la frase:

```sh
pnpm data:encrypt:dev
pnpm dev
```

El formulario admite entonces el campo vacío exclusivamente bajo `vite dev`.
`pnpm build` rechaza esta bóveda de desarrollo porque no puede autenticarla
con una frase válida; antes de construir hay que regenerarla con
`pnpm data:encrypt` o con el fichero privado usado por la automatización.

Para automatización se admite exclusivamente un fichero de frase privado:

```sh
chmod 0600 /etc/myexpenses/vault.passphrase
pnpm data:encrypt -- \
  --passphrase-file /etc/myexpenses/vault.passphrase
pnpm build -- --passphrase-file /etc/myexpenses/vault.passphrase
```

Para una comprobación local con datos **sintéticos**, también se admiten
`--vault /ruta/absoluta/vault.json` y `--out-dir /ruta/absoluta/dist`. Un
directorio de salida personalizado debe estar fuera del repositorio y no
existir o estar vacío; no puede contener la bóveda ni el fichero de frase.
La build no fuerza el vaciado de rutas externas. Nunca uses la build
predeterminada como prueba si `data/` contiene una bóveda real.

No existe opción de contraseña por argumento ni variable de entorno. El fichero
debe ser regular, no symlink, sin permisos para grupo/otros y contener una sola
línea. El output se escribe atómicamente con modo `0600`.

Después de comprobar la bóveda, el JSON claro puede retirarse; el pipeline de
pCloud lo crea dentro de un workspace `0700` y lo elimina antes de construir.

## Elección y rotación de frase

- Usa al menos cinco o seis palabras aleatorias o una frase generada por un
  gestor; 16 caracteres repetidos cumplen el límite técnico, pero no son
  seguros.
- Debe ser única y distinta de las credenciales de pCloud y del servidor.
- No la guardes en la misma carpeta pCloud que los backups.
- Para rotarla, cambia el fichero secreto y fuerza una sincronización. Las
  releases antiguas siguen cifradas con la frase anterior: retíralas después de
  validar la nueva release.
- Perder la frase implica perder el acceso a esa bóveda; el backup original
  permite regenerarla con otra.

## Qué protege y qué no

La bóveda cifrada **se sirve públicamente**: cualquiera puede descargarla y
leer sus bytes. El cifrado protege la **confidencialidad del dataset en claro**
frente a quien sólo obtiene esa bóveda; AES-GCM detecta cambios en el
ciphertext y en el header autenticado (algoritmo, iteraciones, salt, IV y
tamaño declarado) durante el desbloqueo. No impide descargar, sustituir ni
borrar el fichero en el hosting; los permisos de escritura y la seguridad del
servidor son controles separados.

No protege frente a:

- una frase débil: el atacante puede probar candidatos offline;
- un navegador ya desbloqueado o un dispositivo comprometido;
- un servidor/hosting comprometido que entregue JavaScript modificado para
  capturar la frase;
- denegación de servicio o sustitución de la bóveda por quien controle el
  hosting; la autenticación criptográfica rechazará una bóveda alterada, pero
  no restaurará la disponibilidad;
- un administrador que pueda leer el fichero de frase del cron o los secretos
  de entorno de ejecución del worker de Coolify;
- una vulnerabilidad XSS futura;
- copias antiguas de `dist/` que contuviesen el JSON claro.

Además, las revisiones antiguas de este repositorio ya incluyeron exports y
datasets claros. Borrarlos en un commit nuevo no los elimina del historial de
Git. No publiques el repositorio ni su historial; para hacerlo público habría
que crear una historia limpia o reescribirla de forma deliberada y coordinada.

El botón «Bloquear bóveda» aborta una carga activa, desmonta la aplicación y
elimina la referencia a los datos del store. JavaScript no garantiza el
zeroizado inmediato de strings u objetos por el recolector de basura; los
buffers criptográficos sí se limpian de forma best-effort.
Si una bóveda publicada estaba dañada y se sustituye en el servidor, usa
«Volver a descargar la bóveda» después del error de desbloqueo: descarta el
ciphertext en caché y el siguiente intento hace un fetch nuevo. Reintentar
sólo la frase conserva la bóveda ya descargada y no repite la transferencia.

## Requisitos del servidor estático

- HTTPS obligatorio; sólo `localhost` se permite sin TLS para desarrollo.
- SPA fallback hacia `index.html`.
- `Cache-Control: no-store` para `index.html` y la bóveda; assets con hash
  pueden usar `public, immutable`.
- CSP recomendada:

```text
default-src 'none'; base-uri 'none'; connect-src 'self'; font-src 'self';
form-action 'none'; frame-ancestors 'none'; frame-src 'none';
img-src 'self' data:; manifest-src 'self'; media-src 'none';
object-src 'none'; script-src 'self';
style-src 'self' 'unsafe-inline'; style-src-attr 'unsafe-inline';
style-src-elem 'self'; upgrade-insecure-requests; worker-src 'none'
```

`style-src-attr` permite los atributos `style` que los gráficos usan sólo para
variables CSS dinámicas; en navegadores CSP3, `style-src-elem` mantiene los
elementos de estilo en archivos del mismo origen. La configuración ejecutable está en
[`deploy/nginx.example.conf`](../deploy/nginx.example.conf).

- Cabeceras recomendadas: `Strict-Transport-Security`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`,
  `Permissions-Policy` restrictiva, `Cross-Origin-Opener-Policy: same-origin` y
  `Cross-Origin-Resource-Policy: same-origin`.

Estas cabeceras deben configurarse en el servidor/CDN; un `<meta>` no puede
reemplazar todas sus garantías, especialmente `frame-ancestors` y HSTS.

## Rendimiento medido

Con el dataset actual, la entrada de 16.992.243 bytes queda en 973.631 bytes
gzip y 1.298.491 bytes de envelope base64 cifrado. En la máquina de desarrollo,
el camino Node medido quedó alrededor de 1,26 s: unos 120 ms para parsear el
envelope, 387 ms para derivar/descifrar, 288 ms para gunzip/UTF-8 y 75–96 ms
para normalizar; JSON, validación y freeze completan el resto. Son cifras
orientativas: Web Crypto, CPU y navegador cambian el resultado. El código
criptográfico se carga en un chunk diferido de 2,74 KB gzip y no aumenta el
camino inicial hasta que se envía la frase.

# Configuración de despliegue y recuperación local

El despliegue periódico completo se realiza con el **worker de Coolify + Docker
Compose**. Sigue la [guía de despliegue](../docs/coolify-deployment.md), incluido
su procedimiento de verificación y rollback.

`pnpm deploy:sync-pcloud` es ahora exclusivamente una herramienta de recuperación
local: descarga el último ZIP en `data/` y no publica una web. Su configuración
mínima está en [sync-pcloud.env.example](sync-pcloud.env.example) y sus instrucciones
en la [guía de recuperación](../docs/pcloud-sync.md). No requiere `/srv/myexpenses`
ni credenciales de cifrado.

## Migración del antiguo cron

El procedimiento de despliegue mediante CLI y cron está retirado.
[sync-pcloud.cron.example](sync-pcloud.cron.example) queda desactivado para no
presentar una descarga local como si fuera una publicación. No lo instales.
Si tenías una copia activa en `/etc/cron.d/myexpenses-sync-pcloud`, desactívala
explícitamente al migrar; actualizar este repositorio no cambia el servidor.
No elimines releases, estado ni bloqueos de un worker activo.

## Ejemplos de servidor estático

[`nginx.example.conf`](nginx.example.conf) y
[`security-headers.example.txt`](security-headers.example.txt) siguen siendo
referencias para servir una publicación estática preparada por separado.
Ajusta dominio, certificados y document root antes de usarlas; no producen
una publicación ni convierten el CLI en un despliegue.

La CSP se entrega como cabecera HTTP: una meta-CSP no puede aplicar
`frame-ancestors` ni HSTS. Los atributos `style` de los gráficos se permiten
con `style-src-attr`, sin abrir los scripts a código inline.
El HTML, las rutas SPA y la bóveda usan `Cache-Control: no-store`; sólo los
assets con hash reciben caché inmutable. Consulta el
[modelo de protección estática](../docs/static-authentication.md).

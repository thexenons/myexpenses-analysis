# Revisión de dependencias del 5 de octubre de 2026

Se contrastaron las 32 dependencias directas y pnpm con el tag estable `latest`
del registro oficial npm. Se actualizaron nueve dependencias; las otras 23 ya
estaban actualizadas. Se mantienen versiones exactas y se regenera el lockfile
con pnpm 12.9.1, incluida la resolución compatible de dependencias transitivas.

| Dependencia | Anterior | Actual |
| --- | --- | --- |
| @tanstack/react-router | 1.170.39 | 1.170.41 |
| nodemailer | 10.0.10 | 10.0.15 |
| @types/node | 26.6.3 | 26.6.4 |
| @vitejs/plugin-react | 6.1.1 | 6.1.2 |
| @vitest/coverage-v8 | 5.0.2 | 5.0.3 |
| jsdom | 30.1.1 | 30.1.2 |
| oxlint | 1.85.0 | 1.87.0 |
| vite | 8.3.1 | 8.3.2 |
| vitest | 5.0.2 | 5.0.3 |
| pnpm | 12.6.0 | 12.9.1 |

## Reproducibilidad y seguridad

- `packageManager`, el mínimo de pnpm, Docker, las guías activas y sus pruebas
  de contrato usan 12.9.1. El gestor se ejecuta desde una instalación temporal
  de npm, sin actualizar herramientas globales. Node 24.19.0 satisface los
  requisitos existentes; no cambia el rango de Node.
- Vitest y su proveedor V8 siguen sincronizados. React y React DOM permanecen
  en 19.3.0. Se conserva sin cambios el parche de React Compiler 1.0.0 y su
  hash `d857a21f1616ca85fa121de465e4a362197a64d22e2fb2f4ab47f995839cac71`.
- Se retiran cinco excepciones de antigüedad de septiembre, ya innecesarias.
  El primer `pnpm up --latest` respetó la espera de 24 horas y no seleccionó
  tres publicaciones estables nuevas del 5 de octubre: nodemailer 10.0.15
  (10:10 UTC), @vitejs/plugin-react 6.1.2 (10:08 UTC) y oxlint 1.87.0
  (11:05 UTC). Se añaden excepciones solo para esas versiones exactas y los
  19 paquetes nativos de plataforma requeridos por oxlint 1.87.0. pnpm añadió
  estos últimos al validar el grafo; no se usan patrones comodín ni se elimina
  la espera para otros paquetes. `allowBuilds` sigue limitado a esbuild.

## Verificación

Las dos pruebas de contrato fallaron con los pines anteriores tras exigir
pnpm 12.9.1 (RED: siete pasan y dos fallan); las nueve pasan después de
sincronizar manifiesto, Docker y documentación (GREEN). La actualización de
versiones y documentación no tiene un RED funcional adicional significativo.
La instalación con lockfile congelado y peers estrictos pasa.

| Comprobación | Resultado |
| --- | --- |
| Instalación congelada con peers estrictos | Pasa; sin conflictos de peers. |
| TypeScript | Pasan los tres proyectos. |
| Node sin entradas privadas | Pasan 357 pruebas; se excluyen tres cuerpos de pruebas privados. |
| UI con cobertura | Pasan 593 pruebas en 94 archivos tras la corrección de compatibilidad; se conservan los umbrales. |
| Despliegue y build de producción sintéticos | Pasa una prueba del pipeline completo. |
| Browser smoke sintético: escritorio y móvil de 390 px | No disponible: seis escenarios fallan antes de ejecutar sus cuerpos por ausencia de `libnspr4.so`. |
| `pnpm outdated --json` | `{}`, exit 0; sin dependencias directas pendientes. |
| `pnpm audit --json` | Cero vulnerabilidades conocidas, exit 0. |
| Oxlint 1.87.0 | Pasa con las mismas reglas tras corregir los cuatro usos de fecha durante render. |

La cobertura final alcanza 87,07 % de sentencias, 78,38 % de ramas, 91,36 % de
funciones y 91,51 % de líneas. El primer intento UI dentro del sandbox agotó
el tiempo de la prueba de accesibilidad; se interrumpió y la única repetición
fuera del sandbox completó la suite. Las pruebas de despliegue y navegador
también requirieron salir del sandbox por `EPERM` al crear un socket IPC local.
La verificación final invocó directamente Vitest y Node: los tres proyectos
TypeScript, las 357 pruebas Node, las 593 pruebas UI y el pipeline sintético
de producción pasan sobre el código corregido. No se instalaron bibliotecas
del sistema para resolver la carencia del navegador.

Oxlint 1.87.0 detectó cuatro lecturas impuras de la fecha actual durante render
en los selectores de periodo y las páginas de categorías, flujo de caja y
presupuestos. El linter anterior pasaba con los mismos flags antes de corregir
el código. El hook compartido `useToday` conserva una instantánea inmutable,
lee el reloj solo durante la inicialización y en callbacks de efectos, y
actualiza el día en la zona horaria de la aplicación cada minuto y al recuperar
foco o visibilidad. Limpia temporizadores y listeners; no provoca un render
cada minuto si el día no cambia. La tendencia de ahorro incluye ese día en
sus dependencias para recalcular al cruzar medianoche.

Una regresión sintética falló con la tendencia anterior al avanzar sobre la
medianoche de Madrid; las 43 pruebas focalizadas pasan con la corrección.
También se verifican cambio de zona horaria, actualización del día y limpieza
de suscripciones. No se desactivan reglas ni se rebajan umbrales.

No se usan datos privados. Se excluyen exactamente estos tres cuerpos de pruebas:

- `reference backup dataset reproduces the official MyExpenses figures`.
- `matches the enriched-data coverage of the reference backup`.
- `latest local backup agrees with independent SQLite financial queries`.

El runner Node no registra esos cuerpos, por lo que indica cero skips pese
a las tres exclusiones. La build de despliegue utiliza entradas sintéticas
aisladas y no se ejecuta `pnpm build` directamente sobre la bóveda del
repositorio. No se despliega ni se publica. La auditoría refleja avisos
publicados, no garantiza ausencia de defectos. Queda pendiente la comprobación
de navegador con sus bibliotecas disponibles.

## Fuentes

- [Metadatos del registro oficial npm](https://registry.npmjs.org/).
- [Protección de antigüedad de pnpm](https://pnpm.io/settings#minimumreleaseage).
- [Migraciones y parche previos](dependencies-2026-09-26.md).

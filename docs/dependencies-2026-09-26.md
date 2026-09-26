# Revisión de dependencias del 26 de septiembre de 2026

Se contrastaron las 30 dependencias directas con el tag `latest` del registro
oficial npm. Se actualizaron 19; las otras 11 ya estaban en su última versión
estable. pnpm pasó de 10.30.0 a 12.6.0. Las versiones directas permanecen
exactas y el lockfile recoge también la resolución de dependencias transitivas
dentro de los rangos admitidos por sus paquetes, sin overrides de versiones.

| Dependencia | Anterior | Actual |
| --- | --- | --- |
| @tanstack/react-router | 1.170.32 | 1.170.39 |
| react | 19.2.8 | 19.3.0 |
| react-dom | 19.2.8 | 19.3.0 |
| @babel/core | 7.29.7 | 8.0.6 |
| @rolldown/plugin-babel | 0.2.3 | 0.2.4 |
| @testing-library/dom | 10.4.1 | 10.4.2 |
| @testing-library/react | 16.3.2 | 16.3.3 |
| @testing-library/user-event | 14.6.6 | 14.6.7 |
| @types/node | 24.13.3 | 26.6.3 |
| @types/react | 19.2.18 | 19.3.0 |
| @types/react-dom | 19.2.4 | 19.3.0 |
| @vitejs/plugin-react | 6.1.0 | 6.1.1 |
| @vitest/coverage-v8 | 4.1.11 | 5.0.2 |
| jsdom | 30.0.1 | 30.1.1 |
| oxlint | 1.79.0 | 1.85.0 |
| tsx | 4.23.12 | 4.23.15 |
| typescript | 6.0.2 | 7.0.2 |
| vite | 8.2.2 | 8.3.1 |
| vitest | 4.1.11 | 5.0.2 |

## Compatibilidad y cambios necesarios

- **Node:** jsdom 30.1.1 exige `^22.22.2 || ^24.15.0 || >=26.0.0`, que también
  satisface los requisitos de Babel 8 y Vitest 5. `engines` y README reflejan
  ese mínimo. Las comprobaciones usan Node 24.21.0 LTS instalado en un
  directorio temporal; no se cambia el runtime global del usuario. El tipado
  Node 26 no convierte en disponibles sus APIs exclusivas bajo Node 24.
- **TypeScript 7:** su export principal ya no ofrece la API anterior del
  analizador. Las dos pruebas de arquitectura usan la API de Babel ya presente
  en el proyecto, con regresiones que conservan la detección de componentes,
  imports estáticos/dinámicos, reexports, posiciones y exports wildcard.
  El CLI nativo de TypeScript sigue detrás de `typescript/bin/tsc`.
- **Babel 8 y React Compiler:** Babel retiró `AssignmentPattern` del alias
  `LVal`, lo que provocaba que Compiler 1.0.0 omitiera silenciosamente la
  optimización de componentes con props desestructuradas y valores por defecto.
  Se aplica un parche local de dos comprobaciones, basado en la
  [propuesta upstream 37492](https://github.com/react/react/pull/37492), todavía
  abierta al revisar. Siete pruebas verifican que se emite la caché de
  memoización; antes del parche sólo pasaba el caso de control. Revisar y retirar
  el parche cuando una versión estable del compilador incluya la corrección.
- **pnpm 12:** el lockfile incorpora el gestor y registra el hash del parche.
  La selección explícita de las últimas versiones de Vitest y tipos de Node
  añadió cinco excepciones exactas a `minimumReleaseAgeExclude`: esas versiones
  llevaban menos de 24 horas publicadas. La espera permanece para las demás
  versiones; se conserva `allowBuilds` limitado a esbuild.
- **Vitest 5:** no fue necesario cambiar la configuración ni rebajar los
  umbrales de cobertura. React y React DOM, sus tipos y Vitest con su proveedor
  de cobertura se actualizan conjuntamente.

No hay otras versiones fijadas en CI, Docker o archivos de selección de Node.
El ejemplo de cron de despliegue utiliza `/usr/bin/pnpm`: el entorno donde se
ejecute deberá disponer del nuevo gestor y de un Node compatible.

## Fuentes

- Metadatos de los paquetes en [npm](https://registry.npmjs.org/).
- [Migración a Babel 8](https://babeljs.io/docs/v8-migration).
- [TypeScript 7](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/).
- [Migración a Vitest 5](https://main.vitest.dev/guide/migration/).
- [jsdom 30.1.1](https://github.com/jsdom/jsdom/releases/tag/v30.1.1).
- [pnpm 12](https://github.com/pnpm/pnpm/releases/tag/v12.0.0).

## Verificación

La instalación con lockfile congelado y comprobación estricta de peers pasa.
TypeScript y Oxlint pasan. Las 184 pruebas de Node pasan; las dos golden de
agosto se omiten porque la base local es la de septiembre. La comparación
independiente con SQLite mantiene sus 216.824 comprobaciones correctas.

Vitest 5 completa las 216 pruebas de interfaz y dominio en 72 archivos. La
cobertura alcanza 81,94 % de sentencias, 70,54 % de ramas, 85,83 % de funciones
y 87,40 % de líneas, por encima de los umbrales existentes.

La build de producción pasa con una bóveda sintética protegida. Chromium recorre
las ocho rutas a 1440, 390 y 320 px sin errores JavaScript, peticiones externas,
desbordamientos ni infracciones detectadas por axe. También pasan desbloqueo,
recarga con bloqueo, descarga diferida de la bóveda, CSV, ordenación, búsqueda,
filtros, fecha de valor, restauración del foco con Escape y bloqueo manual.

La auditoría npm no encuentra vulnerabilidades conocidas. El resultado es una
comprobación de avisos publicados, no una garantía de ausencia de defectos.

## Límite de reversión

La unidad de actualización comprende los manifiestos y lockfile, el parche de
Compiler y su prueba, las dos pruebas de arquitectura y esta documentación.
Se pueden revertir conjuntamente sin cambiar código financiero, backups,
dataset ni bóveda. No se han regenerado datos ni publicado una aplicación.

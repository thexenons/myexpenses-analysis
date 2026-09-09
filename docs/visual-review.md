# Revisión visual y funcional

Revisión del 9 de septiembre de 2026. Los escenarios reproducibles usan datos
sintéticos; también se comprobó el volumen real de forma aislada y local.
No se han publicado ni enviado las cuentas o movimientos privados.

## Cobertura comprobada

| Área | Comprobación |
| --- | --- |
| Ocho páginas | Navegación, contenido, estados vacíos y ausencia de desbordamiento del documento |
| Gráficos | 15 gráficos a 320, 390, 768 y 1440 px: 60 representaciones sin recorte del SVG ni de sus etiquetas |
| Indicadores | Distribución a 320, 390, 768, 1024 y 1440 px; importes largos y negativos sin truncar |
| Texto ampliado | Reflow de Resumen al 200 % en 320, 390, 768 y 1440 px; selectores de gráficos a 320 y 390 px sin recortes |
| Interacción | 31 comprobaciones de filtros, comparación, paginación, orden, CSV, presupuestos y gesto táctil |
| Accesibilidad automática | Ocho páginas a 1440 y 390 px, más el diálogo de filtros: sin infracciones detectadas por axe para WCAG A/AA 2.0, 2.1 y 2.2 |
| Teclado | Ocho destinos de navegación, tablas desplazables, consulta de puntos, cierre con Escape y restitución del foco |
| Producción | Compilación con bóveda sintética protegida y acceso directo a las ocho rutas; sin errores JavaScript |
| Volumen real | Ocho páginas a 1440 y 390 px con 13.318 apuntes, 39 cuentas y 81 categorías; sin errores JS, desbordamiento ni peticiones externas |

Se han usado Chromium y emulación de tamaños de pantalla y entrada táctil.
Esto no sustituye las pruebas en Safari, Firefox, dispositivos físicos o con
lectores de pantalla, ni acredita por sí solo conformidad completa con WCAG.
La ampliación de texto se simuló duplicando el tamaño de fuente raíz; no es
una prueba de todos los modos de zoom del navegador. El contraste forzado y la
reducción de movimiento también se comprobaron en Chromium.

Con el backup real, desbloquear y representar la primera página tardó unos
2,4 segundos; las navegaciones entre 0,09 y 1,72 segundos. Son observaciones
del servidor local de desarrollo, con caché de módulos caliente en la pasada
móvil, no un benchmark de producción. No se guardaron capturas privadas y los
artefactos temporales con datos reales se eliminaron después de la prueba.

## Fallos corregidos y criterios de diseño

- Los gráficos ya no conservan un ancho mínimo que recortaba el contenido en
  móvil. Las etiquetas de ejes se adaptan al espacio disponible.
- Las series mantienen colores, trazos y marcadores coherentes. Los puntos
  disponen de tooltip y consulta alternativa mediante teclado o control táctil.
- Los rankings permiten ampliar el límite o mostrar todos; las tablas y CSV
  no pierden elementos por un recorte exclusivamente visual.
- Transacciones conserva correctamente su indicador de navegación activo al
  cambiar página u ordenación.
- La comparación de periodos está plegada inicialmente. En móvil, los nombres
  se ajustan en varias líneas para mostrar también el importe actual.
- Con texto ampliado, filtros, selectores, indicadores y leyendas ajustan sus
  filas y columnas al contenido sin ocultar etiquetas ni importes.
- Se reducen adornos, sombras, títulos sobredimensionados y espacios vacíos.
  Los indicadores usan dos columnas móviles y las cifras conservan su signo.
- La revisión de diseño y accesibilidad prioriza jerarquía de datos, contraste,
  etiquetas explícitas, foco visible y acceso a valores exactos sin depender del
  color o de pasar el ratón.

Las tablas anchas permiten desplazamiento horizontal dentro de su región;
no se ocultan columnas financieras para hacerlas caber en un teléfono.

## Pruebas del código y datos

- Suite de interfaz: 187 pruebas correctas en 72 archivos, más comprobaciones
  focales tras los últimos ajustes visuales.
- Suite Node: 155 pruebas correctas; dos comparaciones con un backup histórico
  se omiten porque el archivo local no es esa referencia documentada.
- Lint, comprobación de tipos y compilación de producción correctos.
- El backup nuevo de esquema 190 se importó y contrastó de forma privada con
  sus datos SQL, sin sustituir el dataset o la bóveda de trabajo. El contrato y
  la lógica contable están en [estadísticas](statistics.md) e
  [importación](backup-import.md).

## Pendiente antes de publicar

La bóveda real actual es de desarrollo, con frase vacía: el control de seguridad
la rechaza en producción. Hay que regenerarla con una frase segura mediante el
[procedimiento de cifrado](static-authentication.md). No se ha desplegado la
aplicación ni modificado esa bóveda durante esta revisión.

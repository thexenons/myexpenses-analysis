# Auditoría estadística y de utilidad financiera — 5 de octubre de 2026

**Conclusión:** la aplicación tiene una base estadística descriptiva sólida,
pero facilita solo parcialmente la gestión mensual, la anticipación del dinero
disponible, la identificación de cautelas y las mejoras accionables. Las pruebas
acotadas no establecieron ningún defecto aritmético determinista. Las siete
observaciones siguientes son limitaciones de modelo, interpretación o experiencia
de uso que requieren decisiones de producto; no son cambios ya aceptados.

## Alcance y lectura

- Revisión de código sobre `main` limpio, commit
  `c009eccd611c6d4d8a1f8096ec9ff56b1d428456`, con fecha 2026-10-05.
- Inventario de nueve áreas, revisión de la interfaz en código y comprobaciones
  independientes del dominio con datos sintéticos. No se validó la facilidad de
  uso mediante navegación o interacción en un navegador renderizado.
- Sin datos financieros privados, acceso remoto ni cambios en cálculos.
  Los resultados no certifican todas las cifras posibles ni constituyen
  asesoramiento financiero.
- Primero resolver CI; después decidir S01–S07. **Alta/media indican prioridad
  de producto, no gravedad de un fallo demostrado.**

## Cuatro objetivos evaluados

| Objetivo | Apoyo actual | Límite que impide darlo por resuelto |
| --- | --- | --- |
| Saber cómo va el mes | Ingresos, gastos, saldos, categorías, cuentas, perspectivas y filtros temporales. | La vista inicial es de todo el historial; el escenario anual no responde al gasto actual ni incorpora compromisos futuros confirmados. La cobertura observada no prueba historial completo. S02–S05. |
| Saber qué conviene vigilar | Utilización, salud y ritmo de presupuestos, medias por categoría, contexto de contrapartes y calidad de datos. | Exige reconstruir el diagnóstico entre páginas; no se estableció una priorización transversal única. S06. |
| Identificar mejoras concretas | Patrones descriptivos, comparaciones y recorridos hacia movimientos explicativos. | No existe una capa explícita de revisiones accionables con efectos cuantificados justificables. S07. |
| Saber a qué persona corresponden los gastos | Filtros de contraparte, cuentas, etiquetas y vínculos explícitos de deuda. | La contraparte no equivale a persona pagadora, responsable o beneficiaria; no hay asignaciones explícitas universales para gastos propios o compartidos. S01. |

## Inventario de las nueve áreas

| Área | Información disponible y recorrido | Evidencia |
| --- | --- | --- |
| Resumen | Ingresos/gastos netos y flujo del período; evolución por período o acumulada; apertura, cierre, deuda, conciliación y categorías. El acumulado de movimientos no equivale a patrimonio. | [OverviewPage.view.tsx:25–95](../src/presentation/pages/OverviewPage/OverviewPage.view.tsx#L25-L95), [98–122](../src/presentation/pages/OverviewPage/OverviewPage.view.tsx#L98-L122). |
| Flujo de caja | Flujos por período/acumulados, categorías, transferencias y tendencia mensual de ahorro desplegable, con perspectivas distintas. | [CashFlowPage.view.tsx:69–120](../src/presentation/pages/CashFlowPage/CashFlowPage.view.tsx#L69-L120). |
| Categorías | Jerarquía, métricas, medias de períodos cerrados con períodos sin actividad incluidos, actividad directa o agrupada por raíz y navegación hacia el detalle. | [CategoriesPage.view.tsx:121–172](../src/presentation/pages/CategoriesPage/CategoriesPage.view.tsx#L121-L172), [199–245](../src/presentation/pages/CategoriesPage/CategoriesPage.view.tsx#L199-L245). |
| Cuentas | Saldos al cierre y movimientos por cuenta; el filtro global de cuentas delimita el análisis. | [AccountsPage.view.tsx:50–69](../src/presentation/pages/AccountsPage/AccountsPage.view.tsx#L50-L69), [89–91](../src/presentation/pages/AccountsPage/AccountsPage.view.tsx#L89-L91). |
| Deudas | Saldos y movimientos de deuda, además de la atribución de gasto derivada de vínculos registrados. No equivale a clasificar todos los gastos familiares por persona. | [DebtsPage.view.tsx:35–37](../src/presentation/pages/DebtsPage/DebtsPage.view.tsx#L35-L37). |
| Presupuestos | Utilización, salud, asignación lineal hasta la fecha y escenario anual presupuestario. La asignación lineal no es una previsión. «Planes» es la etiqueta móvil de esta ruta, no un planificador separado. | [BudgetsPage.view.tsx:208–244](../src/presentation/pages/BudgetsPage/BudgetsPage.view.tsx#L208-L244), [Sidebar.view.tsx:35–39](../src/presentation/components/organisms/Sidebar/Sidebar.view.tsx#L35-L39). |
| Comparativa | Perspectivas «Yo», flujo real y deudas, con diferencias por categoría. | [PerspectiveComparisonPage.helpers.ts:21–27](../src/presentation/pages/PerspectiveComparisonPage/PerspectiveComparisonPage.helpers.ts#L21-L27), [99–113](../src/presentation/pages/PerspectiveComparisonPage/PerspectiveComparisonPage.helpers.ts#L99-L113). |
| Patrones y calidad | Contrapartes, métodos, distribución temporal, calidad de datos y fechas de valor; se presentan explícitamente como descripción, no causas ni predicciones. | [InsightsPage.view.tsx:32–35](../src/presentation/pages/InsightsPage/InsightsPage.view.tsx#L32-L35), [72–83](../src/presentation/pages/InsightsPage/InsightsPage.view.tsx#L72-L83). |
| Transacciones | Búsqueda, filtros, ordenación y detalles para contrastar cifras. El concepto visible prioriza contraparte, después comentario y después categoría; no prueba quién asume el gasto. | [TransactionsPage.view.tsx:29–49](../src/presentation/pages/TransactionsPage/TransactionsPage.view.tsx#L29-L49), [TransactionConcept.tsx:5–15](../src/presentation/pages/TransactionsPage/components/TransactionConcept/TransactionConcept.tsx#L5-L15). |

Los indicadores de filtros activos, las explicaciones y los recorridos al detalle
son capacidades existentes que deben conservarse; no se consideran ausentes.

## Hallazgos pendientes de consideración

### S01 — Atribución de gastos a personas

**Prioridad alta · brecha de producto/modelo, no defecto de importación demostrado.**

La contraparte (`payee`) no identifica necesariamente a la persona pagadora,
responsable, beneficiaria o propietaria de un gasto. El adaptador importa la
contraparte y un desglose usa la propia o hereda la del padre:
[adapter.ts:586–595](../scripts/import-backup/v189/adapter.ts#L586-L595),
[app-dataset.ts:810](../scripts/import-backup/app-dataset.ts#L810).
El esquema revisado no contiene miembros del hogar ni cuotas explícitas de
responsabilidad: [cuentas:74–90](../src/domain/analytics/backup-dataset.types.ts#L74-L90)
y [apuntes/contrapartes:130–172](../src/domain/analytics/backup-dataset.types.ts#L130-L172).
Sí existen [filtro de contraparte](../src/presentation/components/organisms/FilterDrawer/FilterDrawer.view.tsx#L488)
y [clasificaciones por contraparte](../src/presentation/pages/InsightsPage/components/InsightsPayees/InsightsPayees.tsx#L81-L120).

**Impacto:** esos filtros no garantizan una respuesta fiable a «qué parte me
corresponde» o «quién se beneficia». Una deuda enlazada puede representar una
parte financiada explícita, pero no atribuye universalmente todos los costes.

**Recomendación pendiente:** definir primero los roles de pagador, responsable
y beneficiario; después valorar identificadores estables de personas y
asignaciones por apunte/desglose, una parte sin asignar y conciliación de la suma
con el total. Convenciones de cuentas o etiquetas ofrecen una solución rápida
con menor coste, pero requieren disciplina y no permiten inferencia universal.

### S02 — Escenario anual frente a previsión sensible al gasto actual

**Prioridad media · limitación del modelo y de su interpretación.**

Los meses cerrados usan flujo real; los incompletos o estimados usan ingresos
menos presupuesto, no ingresos menos gasto actual:
[annual-projection.ts:174–182](../src/domain/analytics/annual-projection.ts#L174-L182).
La prueba sintética confirmó una contribución de **1.000** con ingreso de
**2.000** y presupuesto de **1.000**, tanto habiendo gastado **900** como
**1.800**. Es coherente con un escenario de cumplimiento presupuestario,
no prueba un error aritmético. La interfaz ya explica sus supuestos:
[AnnualProjection.Content.tsx:42–52](../src/presentation/pages/BudgetsPage/components/AnnualProjection/AnnualProjection.Content.tsx#L42-L52).

**Impacto:** no debe interpretarse esa contribución como dinero restante real
o una previsión que reacciona automáticamente a excesos de gasto.

**Recomendación pendiente:** distinguir con claridad el escenario de
cumplimiento presupuestario y el exceso real observado. Una previsión sensible
al gasto necesitaría hipótesis explícitas de ingresos y gastos futuros;
cambiar silenciosamente la fórmula alteraría su significado. Conservar el
escenario actual es más sencillo y reproducible, pero responde a otra pregunta.

### S03 — Compromisos futuros y recurrencias

**Prioridad media · modelo de planificación ausente en el conjunto importado.**

Las colecciones revisadas no incluyen calendarios, plantillas u obligaciones
recurrentes confirmadas: [backup-dataset.types.ts:229–240](../src/domain/analytics/backup-dataset.types.ts#L229-L240),
[v189/schema.ts:52–106](../scripts/import-backup/v189/schema.ts#L52-L106).
La proyección excluye apuntes de fecha futura del histórico real:
[annual-projection.ts:116–117](../src/domain/analytics/annual-projection.ts#L116-L117).
Un movimiento registrado a fecha futura no sustituye a una obligación planificada
con recurrencia, saldo pendiente y conciliación del pago.

**Impacto:** no se puede garantizar cuánto es seguro gastar después de próximos
alquileres, suscripciones u otros compromisos.

**Recomendación pendiente:** valorar compromisos estructurados con vencimiento,
cuenta, persona, importe restante, recurrencia y conciliación para no duplicar
pagos ya registrados. Inferir recurrencias es más barato, pero un patrón pasado
no confirma una obligación futura; deberá distinguirse de compromisos aceptados.

### S04 — Cobertura observada frente a historial completo

**Prioridad media · cautela interpretativa, no pérdida de datos probada.**

La proyección deriva meses aparentemente cerrados de las fechas mínima y máxima
de apuntes no VOID; los extremos no prueban que entre ambos esté todo el
historial: [annual-projection.ts:127–146](../src/domain/analytics/annual-projection.ts#L127-L146).
La tendencia de ahorro ya advierte esa limitación:
[CashFlowPage.savings-trend.tsx:43–55](../src/presentation/pages/CashFlowPage/CashFlowPage.savings-trend.tsx#L43-L55).

**Impacto:** un intervalo sin movimientos puede significar actividad cero o
información ausente. Usarlo como período completo puede producir medias o
escenarios demasiado concluyentes aunque las operaciones sean correctas.

**Recomendación pendiente:** representar de forma consistente un estado de
cobertura verificada/conciliada y distinguir cero de ausencia. La detección
automática por extremos es económica, pero no acredita completitud; una
confirmación explícita cuesta más y permite expresar confianza real.

### S05 — Acceso al contexto mensual

**Prioridad media · oportunidad de experiencia de uso.**

El estado inicial abarca todo el historial y no limita fechas:
[filters.ts:53–57](../src/domain/analytics/filters.ts#L53-L57).
El selector temporal ya existe: [GlobalFilters.view.tsx:52–78](../src/presentation/components/organisms/GlobalFilters/GlobalFilters.view.tsx#L52-L78).
Por tanto, no falta información mensual; requiere selección adicional y, para
algunas preguntas, reconstruir el contexto entre páginas.

**Recomendación pendiente:** valorar una acción rápida «mes actual» o un resumen
del mes hasta la fecha, conservando la vista histórica completa. No cambiar
silenciosamente la selección guardada: un acceso explícito mejora orientación
sin alterar el significado de filtros recordados.

### S06 — Cautelas priorizadas y consolidadas

**Prioridad media · oportunidad de síntesis entre páginas.**

Existen utilización, salud y ritmo de presupuestos, medias por categoría y
contexto por contraparte; el inventario anterior muestra sus ubicaciones.
No se estableció una vista única que ordene esas señales por relevancia y lleve
al movimiento o cálculo explicativo. Esto no significa que falten advertencias
locales o filtros activos.

**Recomendación pendiente:** valorar cautelas consolidadas con evidencia,
fechas, filtros, límites y enlaces al detalle. Priorizar señales soportadas por
los datos, no advertencias genéricas. La asignación lineal hasta la fecha no
debe presentarse como predicción del gasto final. La síntesis reduce recorrido,
pero necesita reglas de prioridad transparentes para no exagerar el riesgo.

### S07 — Mejoras accionables sin atribuir causalidad

**Prioridad media · oportunidad de producto, no fallo del análisis descriptivo.**

Los patrones y comparaciones ayudan a comprender la actividad; la propia
interfaz declara su carácter descriptivo:
[InsightsPage.view.tsx:32–33](../src/presentation/pages/InsightsPage/InsightsPage.view.tsx#L32-L33).
No se estableció una capa explícita de mejoras accionables y cuantificadas.

**Recomendación pendiente:** proponer revisiones concretas enlazadas a evidencia
y permitir medir resultados cuando exista base suficiente. Expresar efectos
cuantificados solo si se justifican, con supuestos y límites; una asociación
temporal o por contraparte no demuestra causa ni autoriza consejo financiero.
Los recorridos descriptivos existentes son útiles y deben preservarse aunque
no se acepte una nueva capa de recomendaciones.

## Fortalezas verificadas que deben preservarse

- **Comparación temporal:** cuando corresponde, compara los mismos días
  transcurridos del mes anterior, limita el extremo a meses más cortos y conserva
  los filtros no temporales. [comparison.ts:77–96](../src/domain/analytics/comparison.ts#L77-L96).
- **Gastos y deuda:** el caso de 10 de salida de caja se concilia con 5 de gasto
  propio y 5 de deuda de la pareja, sin inventar una devolución.
  [debt-flows.test.ts:135–148](../tests/domain/debt-flows.test.ts#L135-L148).
- **Transferencias:** usa relaciones explícitas recíprocas; no adivina vínculos
  a partir de comentarios. [transfer-relations.ts:16–47](../src/domain/analytics/transfer-relations.ts#L16-L47).
- **Ritmo presupuestario:** respeta filtros propios del presupuesto, arrastres,
  divisa, devoluciones y conciliación de desgloses; excluye fechas futuras y
  evita presentar subconjuntos engañosos como ritmo comparable.
  [budget-pace.ts:63–73](../src/domain/analytics/budget-pace.ts#L63-L73),
  [87–124](../src/domain/analytics/budget-pace.ts#L87-L124).
- **Ahorro mensual:** utiliza meses cerrados; no calcula porcentajes con ingresos
  no positivos y conserva tasas negativas o superiores al 100 %, sin recortarlas
  artificialmente. [savings-rate.ts:45–83](../src/domain/analytics/savings-rate.ts#L45-L83).
- **Medias por categoría:** usa períodos completos e incluye períodos sin
  actividad, sin confundir la media con la suma de períodos activos.
  [category-period-average.ts:102–125](../src/domain/analytics/category-period-average.ts#L102-L125),
  [prueba de períodos sin actividad:42–55](../tests/domain/category-period-average.test.ts#L42-L55).
- **Procedencia y contexto:** distingue fecha del nombre de la copia, instante
  real de importación y cobertura de movimientos; la fecha del nombre no
  confirma la captura. [Sidebar.view.tsx:166–183](../src/presentation/components/organisms/Sidebar/Sidebar.view.tsx#L166-L183).
  Mantener indicadores de filtros activos, explicaciones y navegación al detalle
  evita perder el contexto que ya ofrece la aplicación.

## Comprobaciones ejecutadas y límites de la evidencia

Durante la auditoría se observaron los siguientes resultados; la escritura de
este informe es pasiva y no repite las suites:

```sh
node --test --import tsx --test-skip-pattern='^(reference backup dataset reproduces the official MyExpenses figures|matches the enriched-data coverage of the reference backup|latest local backup agrees with independent SQLite financial queries)$' tests/domain/comparison.test.ts tests/domain/debt-flows.test.ts tests/domain/backup-insights.test.ts tests/domain/savings-rate.test.ts tests/domain/category-period-average.test.ts scripts/import-backup/app-dataset.test.ts scripts/import-backup/v189/adapter.test.ts
```

**Exit 0; 90 pruebas pasan.** Los tres cuerpos de pruebas privadas se excluyeron
por nombre antes de la ejecución: `reference backup dataset reproduces the
official MyExpenses figures`, `matches the enriched-data coverage of the
reference backup` y `latest local backup agrees with independent SQLite
financial queries`. No se leyeron sus entradas privadas.

```sh
node node_modules/vitest/vitest.mjs run src/domain/analytics/annual-projection.test.ts src/domain/analytics/budgets.test.ts src/domain/analytics/budget-period-comparison.test.ts src/domain/analytics/normalize-backup-dataset.test.ts --maxWorkers=1
```

**Exit 0; 108 pruebas en cuatro archivos pasan.** La comprobación sintética
independiente de la proyección anual también terminó con **exit 0** y confirmó
el comportamiento de S02. Estas pruebas apoyan los casos revisados; no
establecen exactitud global ni completitud de un historial financiero.

El análisis de interfaz fue estático, no una validación de interacción o
usabilidad en navegador. Una comprobación posterior del smoke de CI produjo
cuatro casos correctos y dos fallos relacionados con la aplicación tardía de un
reloj fijo y el orden de prueba. La corrección de sincronización pasó después
los seis casos del smoke y otras 18 comprobaciones en tres anchuras, además de
lint y los tres proyectos TypeScript. Es prueba local con datos sintéticos,
no confirmación de una ejecución remota de CI. Véase el
[registro de reparación](../odd/tasks/fix-browser-clock-ci-2026-10-05.md).
No es evidencia de un nuevo defecto estadístico ni cambia el alcance de esta auditoría.

## Decisiones pendientes después de CI

Todas las recomendaciones quedan registradas para consideración posterior.
Ninguna casilla autoriza implementación ni modifica el comportamiento actual.

- [ ] **S01:** decidir roles de personas y asignaciones explícitas, o aceptar las
  limitaciones de convenciones de cuentas/etiquetas.
- [ ] **S02:** decidir si basta el escenario presupuestario condicionado o se
  requiere una previsión distinta con supuestos explícitos.
- [ ] **S03:** decidir si incorporar compromisos y recurrencias confirmados,
  incluida la conciliación de pagos.
- [ ] **S04:** decidir cómo acreditar cobertura completa y distinguir cero de
  información ausente.
- [ ] **S05:** decidir acceso rápido al contexto mensual sin alterar selecciones
  históricas o guardadas de forma silenciosa.
- [ ] **S06:** decidir reglas de cautelas consolidadas con contexto y evidencia.
- [ ] **S07:** decidir revisiones accionables y qué efectos pueden cuantificarse
  responsablemente.

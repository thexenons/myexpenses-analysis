import { useMemo, type ReactElement, type Ref } from "react"

import { categoryPathsEqual } from "../../../../../../domain/analytics/filters.ts"
import { formatCategoryPath } from "../../../../../utils/format.ts"
import { AccordionTree, AccordionTreeItem } from "../../../AccordionTree/index.ts"
import styles from "./CategoryFilterTree.module.css"

interface CategoryNode {
  path: readonly string[]
  children: CategoryNode[]
}

interface CategoryFilterTreeProps {
  paths: readonly (readonly string[])[]
  selectedPaths: readonly (readonly string[])[]
  onToggle(path: readonly string[]): void
  focusRef?: Ref<HTMLElement>
}

function buildTree(paths: readonly (readonly string[])[]): readonly CategoryNode[] {
  const roots: CategoryNode[] = [{ path: [], children: [] }]
  const nodes = new Map<string, CategoryNode>()
  for (const path of paths) {
    let siblings = roots
    for (let length = 1; length <= path.length; length += 1) {
      const prefix = path.slice(0, length)
      const key = JSON.stringify(prefix)
      let node = nodes.get(key)
      if (node === undefined) {
        node = { path: prefix, children: [] }
        nodes.set(key, node)
        siblings.push(node)
      }
      siblings = node.children
    }
  }
  return roots
}

/** Pure recursive renderer; disclosure state remains owned by AccordionTreeItem. */
function renderCategoryBranch(
  node: CategoryNode,
  selectedPaths: CategoryFilterTreeProps["selectedPaths"],
  onToggle: CategoryFilterTreeProps["onToggle"],
): ReactElement {
  const label = formatCategoryPath(node.path)
  const selected = selectedPaths.some((path) => categoryPathsEqual(path, node.path))
  return <AccordionTreeItem key={JSON.stringify(node.path)} label={label} rowClassName={styles.row} header={
    <button type="button" className={styles.selection} aria-label={`Seleccionar ${label}`}
      aria-pressed={selected} onClick={() => onToggle(node.path)}>
      <span>{node.path.at(-1) ?? "Sin categoría"}</span>
      <span aria-hidden="true" className={styles.mark}>{selected ? "✓" : "+"}</span>
    </button>
  }>
    {node.children.map((child) => renderCategoryBranch(child, selectedPaths, onToggle))}
  </AccordionTreeItem>
}

export function CategoryFilterTree({ paths, selectedPaths, onToggle, focusRef }: CategoryFilterTreeProps) {
  const roots = useMemo(() => buildTree(paths), [paths])
  return <section ref={focusRef} aria-label="Selector de categorías" tabIndex={-1} className={styles.selector}>
    <AccordionTree aria-label="Categorías disponibles">
      {roots.map((node) => renderCategoryBranch(node, selectedPaths, onToggle))}
    </AccordionTree>
  </section>
}

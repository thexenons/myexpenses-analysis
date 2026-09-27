import { Children, useId, useState, type ComponentProps, type ReactNode } from "react";

import { Icon } from "../../atoms/Icon/index.ts";
import { cx } from "../../../utils/component.helpers.ts";
import styles from "./AccordionTree.module.css";

export function AccordionTree({ children, className, ...props }: ComponentProps<"ul">) {
  return <ul {...props} className={cx(styles.tree, className)}>{children}</ul>;
}

interface AccordionTreeItemProps {
  readonly label: string;
  readonly initialExpanded?: boolean;
  readonly header: ReactNode;
  readonly children?: ReactNode;
  readonly rowClassName?: string;
}

export function AccordionTreeItem({
  label,
  initialExpanded = false,
  header,
  children,
  rowClassName,
}: AccordionTreeItemProps) {
  const childrenId = useId();
  const [expanded, setExpanded] = useState(initialExpanded);
  const hasChildren = Children.toArray(children).length > 0;

  return (
    <li className={styles.item}>
      <div className={cx(styles.row, rowClassName)}>
        {hasChildren ? (
          <button
            aria-controls={childrenId}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Contraer" : "Desplegar"} ${label}`}
            className={styles.disclosure}
            onClick={() => setExpanded((value) => !value)}
            type="button"
          >
            <Icon name="chevron-right" size={16} />
          </button>
        ) : (
          <span aria-hidden="true" className={styles.leafMark} />
        )}
        {header}
      </div>
      {hasChildren ? (
        <AccordionTree className={styles.children} hidden={!expanded} id={childrenId}>
          {expanded ? children : null}
        </AccordionTree>
      ) : null}
    </li>
  );
}

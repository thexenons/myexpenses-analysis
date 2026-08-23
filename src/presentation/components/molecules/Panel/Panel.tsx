import { useId } from "react";

import { cx } from "../../../utils/component.helpers.ts";
import styles from "./Panel.module.css";
import type { PanelProps } from "./Panel.types.ts";

export function Panel({
  actions,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  children,
  className,
  description,
  footer,
  ref,
  title,
  ...props
}: PanelProps) {
  const titleId = useId();
  const hasTitle = title !== undefined && title !== null;
  const hasDescription = description !== undefined && description !== null;
  const hasActions = actions !== undefined && actions !== null;
  const hasFooter = footer !== undefined && footer !== null;
  const hasHeading = hasTitle || hasDescription;
  const hasHeader = hasHeading || hasActions;

  return (
    <section
      {...props}
      aria-label={ariaLabel}
      aria-labelledby={
        ariaLabelledBy ??
        (ariaLabel === undefined && hasTitle ? titleId : undefined)
      }
      className={cx(styles.root, className)}
      ref={ref}
    >
      {hasHeader ? (
        <header className={styles.header}>
          {hasHeading ? (
            <div className={styles.heading}>
              {hasTitle ? (
                <h2 className={styles.title} id={titleId}>
                  {title}
                </h2>
              ) : null}
              {hasDescription ? (
                <p className={styles.description}>{description}</p>
              ) : null}
            </div>
          ) : null}
          {hasActions ? <div className={styles.actions}>{actions}</div> : null}
        </header>
      ) : null}
      <div className={styles.body}>{children}</div>
      {hasFooter ? (
        <footer className={styles.footer}>{footer}</footer>
      ) : null}
    </section>
  );
}

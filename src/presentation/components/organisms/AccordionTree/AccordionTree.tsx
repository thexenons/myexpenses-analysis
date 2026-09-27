import type { ComponentProps } from "react";

import { cx } from "../../../utils/component.helpers.ts";
import styles from "./AccordionTree.module.css";

export function AccordionTree({ children, className, ...props }: ComponentProps<"ul">) {
  return <ul {...props} className={cx(styles.tree, className)}>{children}</ul>;
}

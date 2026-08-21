import type { HTMLAttributes, ReactNode, Ref } from "react";

export interface PanelProps
  extends Omit<HTMLAttributes<HTMLElement>, "children" | "title"> {
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly description?: ReactNode;
  readonly footer?: ReactNode;
  readonly ref?: Ref<HTMLElement>;
  readonly title?: ReactNode;
}

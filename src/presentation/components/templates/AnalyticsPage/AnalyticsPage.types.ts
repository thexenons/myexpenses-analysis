import type { HTMLAttributes, ReactNode } from "react";

export interface AnalyticsPageProps
  extends Omit<HTMLAttributes<HTMLElement>, "children" | "title"> {
  readonly children: ReactNode;
  readonly description: ReactNode;
  readonly eyebrow?: ReactNode;
  readonly introAction?: ReactNode;
  readonly notice?: ReactNode;
  readonly title: string;
}

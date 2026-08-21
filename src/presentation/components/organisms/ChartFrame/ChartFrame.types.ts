import type { ReactNode, Ref } from "react";

export interface ChartFrameProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly dataTable?: ReactNode;
  readonly description?: string;
  readonly empty: boolean;
  readonly emptyMessage: ReactNode;
  readonly legend?: ReactNode;
  readonly ref?: Ref<HTMLElement>;
  readonly title: string;
}

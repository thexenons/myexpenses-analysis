import { useState } from "react";

export function useChartDataTable() {
  const [open, setOpen] = useState(false);

  return {
    onToggle: setOpen,
    open,
  };
}

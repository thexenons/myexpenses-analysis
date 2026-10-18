import { useFinancialContextExport } from "./hooks/FinancialContextExport.hooks.ts";
import { FinancialContextExportView } from "./FinancialContextExport.view.tsx";

export function FinancialContextExport() {
  const props = useFinancialContextExport();
  return <FinancialContextExportView {...props} />;
}

import { Badge } from "../../../../components/atoms/Badge/index.ts";
import type { TransactionStatusProps } from "./TransactionStatus.types.ts";

export function TransactionStatus({ posting }: TransactionStatusProps) {
  if (posting.status === "RECONCILED") {
    return <Badge tone="positive">Conciliado</Badge>;
  }
  if (posting.status === "VOID") {
    return <Badge tone="negative">Anulado</Badge>;
  }
  return <Badge tone="warning">Pendiente</Badge>;
}

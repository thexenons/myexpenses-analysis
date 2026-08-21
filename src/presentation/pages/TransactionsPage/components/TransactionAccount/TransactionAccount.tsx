import { Badge } from "../../../../components/atoms/Badge/index.ts";
import type { TransactionAccountProps } from "./TransactionAccount.types.ts";

export function TransactionAccount({ posting }: TransactionAccountProps) {
  return (
    <span>
      {posting.accountLabel}{" "}
      {posting.accountType === "DEBT" ? <Badge tone="debt">D</Badge> : null}
    </span>
  );
}

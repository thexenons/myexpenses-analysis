import { TransactionsPageView } from "./TransactionsPage.view.tsx";
import { useTransactionsPage } from "./hooks/TransactionsPage.hooks.ts";

export function TransactionsPage() {
  return <TransactionsPageView {...useTransactionsPage()} />;
}

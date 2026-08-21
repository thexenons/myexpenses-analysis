import { AccountsPageView } from "./AccountsPage.view.tsx";
import { useAccountsPage } from "./hooks/AccountsPage.hooks.ts";

export function AccountsPage() {
  return <AccountsPageView {...useAccountsPage()} />;
}

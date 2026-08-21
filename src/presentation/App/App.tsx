import { AppView } from "./App.view.tsx";
import { useApp } from "./hooks/App.hooks.ts";

export function App() {
  return <AppView {...useApp()} />;
}

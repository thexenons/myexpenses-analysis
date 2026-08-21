interface LoadingAppStateProps {
  readonly state: "loading";
}

interface ErrorAppStateProps {
  readonly message: string;
  readonly onRetry: () => void;
  readonly state: "error";
}

export type AppStateProps = ErrorAppStateProps | LoadingAppStateProps;

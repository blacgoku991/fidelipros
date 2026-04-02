import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="text-center max-w-md space-y-4">
            <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Une erreur est survenue</h1>
            <p className="text-muted-foreground text-sm">
              Quelque chose s'est mal passé. Veuillez rafraîchir la page ou revenir à l'accueil.
            </p>
            <div className="flex justify-center gap-3 pt-2">
              <Button variant="outline" onClick={() => window.location.reload()}>
                Rafraîchir
              </Button>
              <Button onClick={this.handleReset}>Retour à l'accueil</Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import { Component, Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from "react";

const EditorPage = lazy(() => import("./App"));
const ViewerPage = lazy(() => import("./ViewerPage"));

type Route = "editor" | "viewer";

function getRoute(pathname: string): Route {
  return pathname.startsWith("/viewer") ? "viewer" : "editor";
}

export default function RootApp() {
  const [route, setRoute] = useState<Route>(() => getRoute(window.location.pathname));

  useEffect(() => {
    const syncRoute = () => {
      const pathname = window.location.pathname;
      if (pathname === "/") {
        window.history.replaceState({}, "", "/editor");
        setRoute("editor");
        return;
      }
      setRoute(getRoute(pathname));
    };

    syncRoute();
    window.addEventListener("popstate", syncRoute);
    return () => window.removeEventListener("popstate", syncRoute);
  }, []);

  useEffect(() => {
    document.title = route === "viewer" ? "Equirectangular Viewer" : "Equirectangular Editor";
  }, [route]);

  const Page = useMemo(() => (route === "viewer" ? ViewerPage : EditorPage), [route]);

  return (
    <RouteErrorBoundary>
      <Suspense fallback={<div className="route-loading">Loading...</div>}>
        <Page />
      </Suspense>
    </RouteErrorBoundary>
  );
}

type BoundaryProps = { children: ReactNode };
type BoundaryState = { error: string | null };

class RouteErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  override render() {
    if (this.state.error) {
      return <div className="route-error">App error: {this.state.error}</div>;
    }
    return this.props.children;
  }
}

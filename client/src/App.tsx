import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useEffect, useLayoutEffect, useRef } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { trackPageview, trackTiming } from "./lib/analytics";
import About from "./pages/About";
import Article from "./pages/Article";
import Category from "./pages/Category";
import Home from "./pages/Home";
import News from "./pages/News";
import EditorialDesk from "./pages/EditorialDesk";
import ArticleEditor from "./pages/ArticleEditor";
import ArticlePreview from "./pages/ArticlePreview";
import Account from "./pages/Account";
import Analytics from "./pages/Analytics";
import Search from "./pages/Search";
import SiteSettings from "./pages/SiteSettings";

// wouter doesn't reset scroll on navigation (unlike a full page load), so
// clicking a link while scrolled down on the previous page leaves the new
// page's viewport wherever the old scroll position happened to land —
// reported on iPhone Safari as articles opening mid-page instead of at the
// top. useLayoutEffect runs before paint, so the reset happens before the
// reader ever sees the wrong position.
function ScrollToTop() {
  const [location] = useLocation();
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [location]);
  return null;
}

// Skips /redacao/* so the admin's own backoffice browsing never pollutes
// visitor stats — only real public-site traffic gets counted. Also times
// how long each page stays open, for "tempo médio no artigo": the effect
// cleanup catches an in-app route change, and pagehide catches a tab close
// or full navigation away (where React never gets to run cleanup).
function PageviewTracker() {
  const [location] = useLocation();
  const entryRef = useRef<{ path: string; time: number } | null>(null);

  useEffect(() => {
    if (location.startsWith("/redacao")) {
      entryRef.current = null;
      return;
    }
    trackPageview(location);
    entryRef.current = { path: location, time: Date.now() };
    return () => {
      const entry = entryRef.current;
      if (entry) trackTiming(entry.path, Date.now() - entry.time);
    };
  }, [location]);

  useEffect(() => {
    function handlePageHide() {
      const entry = entryRef.current;
      if (entry) {
        trackTiming(entry.path, Date.now() - entry.time);
        entryRef.current = null;
      }
    }
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, []);

  return null;
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <>
      <ScrollToTop />
      <PageviewTracker />
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/artigo/:slug"} component={Article} />
        <Route path={"/categoria/:slug"} component={Category} />
        <Route path={"/noticias"} component={News} />
        <Route path={"/sobre"} component={About} />
        <Route path={"/pesquisa"} component={Search} />
        <Route path={"/redacao"} component={EditorialDesk} />
        <Route path={"/redacao/conta"} component={Account} />
        <Route path={"/redacao/site"} component={SiteSettings} />
        <Route path={"/redacao/metricas"} component={Analytics} />
        <Route path={"/redacao/:id/preview"} component={ArticlePreview} />
        <Route path={"/redacao/:id"} component={ArticleEditor} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;

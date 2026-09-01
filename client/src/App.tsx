import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useLayoutEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import About from "./pages/About";
import Article from "./pages/Article";
import Category from "./pages/Category";
import Gallery from "./pages/Gallery";
import Home from "./pages/Home";
import News from "./pages/News";
import Magazine from "./pages/Magazine";
import MagazineReader from "./pages/MagazineReader";
import EditorialDesk from "./pages/EditorialDesk";
import ArticleEditor from "./pages/ArticleEditor";
import GalleryEditor from "./pages/GalleryEditor";
import MagazineEditor from "./pages/MagazineEditor";
import Account from "./pages/Account";
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

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/artigo/:slug"} component={Article} />
        <Route path={"/categoria/:slug"} component={Category} />
        <Route path={"/noticias"} component={News} />
        <Route path={"/multimedia"} component={Gallery} />
        <Route path={"/revista"} component={Magazine} />
        <Route path={"/revista/:id"} component={MagazineReader} />
        <Route path={"/sobre"} component={About} />
        <Route path={"/pesquisa"} component={Search} />
        <Route path={"/redacao"} component={EditorialDesk} />
        <Route path={"/redacao/multimedia"} component={GalleryEditor} />
        <Route path={"/redacao/revista"} component={MagazineEditor} />
        <Route path={"/redacao/conta"} component={Account} />
        <Route path={"/redacao/site"} component={SiteSettings} />
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

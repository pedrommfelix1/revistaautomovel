import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Article from "./pages/Article";
import Category from "./pages/Category";
import Contact from "./pages/Contact";
import Gallery from "./pages/Gallery";
import Home from "./pages/Home";
import News from "./pages/News";
import EditorialDesk from "./pages/EditorialDesk";
import ArticleEditor from "./pages/ArticleEditor";
import GalleryEditor from "./pages/GalleryEditor";
import Search from "./pages/Search";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/artigo/:slug"} component={Article} />
      <Route path={"/categoria/:slug"} component={Category} />
      <Route path={"/noticias"} component={News} />
      <Route path={"/multimedia"} component={Gallery} />
      <Route path={"/contactos"} component={Contact} />
      <Route path={"/pesquisa"} component={Search} />
      <Route path={"/redacao"} component={EditorialDesk} />
      <Route path={"/redacao/multimedia"} component={GalleryEditor} />
      <Route path={"/redacao/:id"} component={ArticleEditor} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
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

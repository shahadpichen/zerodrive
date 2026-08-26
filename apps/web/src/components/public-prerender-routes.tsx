import { Navigate, Route, Routes } from "react-router-dom";
import Docs from "../pages/docs";
import DocsDetail from "../pages/docs-detail";
import LandingPage from "../pages/landing-page";
import NotFound from "../pages/not-found";
import Privacy from "../pages/privacy";
import Terms from "../pages/terms";

/** Public-only route tree used by the build-time renderer. */
export function PublicPrerenderRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/docs/:slug" element={<DocsDetail />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route
        path="/how-it-works"
        element={<Navigate to="/docs/how-it-works" replace />}
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Buffer } from "buffer/";
import PrivateStorage from "./pages/private-storage";
import LandingPage from "./pages/landing-page";
import ProtectedRoute from "./components/protected-route";
import Privacy from "./pages/privacy";
import Terms from "./pages/terms";
import HowItWorks from "./pages/how-it-works";
import GoogleOAuthCallback from "./pages/google-oauth-callback";
import { KeyManagementPage } from "./pages/key-management-page";
import ShareFilesPage from "./pages/share-files";
import SharedWithMePage from "./pages/shared-with-me";
import KeyTestPage from "./pages/KeyTestPage";
import { toast } from "sonner";

// Polyfill global Buffer for libraries that expect it (e.g., bip39)
window.Buffer = Buffer as any;

// Check environment variables on app startup
const checkEnvironmentVariables = () => {
  const requiredVars = {
    "Google Client ID": process.env.REACT_APP_PUBLIC_CLIENT_ID,
    "Google Scope": process.env.REACT_APP_PUBLIC_SCOPE,
    "Supabase URL": process.env.REACT_APP_SUPABASE_URL,
    "Supabase Anon Key": process.env.REACT_APP_SUPABASE_ANON_KEY,
  };

  const missing = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    console.error("Missing required environment variables:", missing);
    toast.error("Missing environment variables", {
      description: `Please check: ${missing.join(", ")}`,
      duration: 10000,
    });
  }
};

function App() {
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";

  useEffect(() => {
    checkEnvironmentVariables();
  }, []);

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/storage" replace />
            ) : (
              <LandingPage />
            )
          }
        />
        <Route
          path="/storage"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} redirectPath="/">
              <PrivateStorage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/key-management"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} redirectPath="/">
              <KeyManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/share"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} redirectPath="/">
              <ShareFilesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/shared-with-me"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} redirectPath="/">
              <SharedWithMePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/key-test"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} redirectPath="/">
              <KeyTestPage />
            </ProtectedRoute>
          }
        />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route
          path="/api/auth/callback/google"
          element={<GoogleOAuthCallback />}
        />
      </Routes>
    </Router>
  );
}

export default App;

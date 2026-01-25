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
import OAuthCallback from "./pages/oauth-callback";
import { KeyManagementPage } from "./pages/key-management-page";
import ShareFilesPage from "./pages/share-files";
import SharedWithMePage from "./pages/shared-with-me";
import KeyTestPage from "./pages/KeyTestPage";
import { isAuthenticated as checkAuth } from "./utils/authService";
import { useRsaKeyRecovery } from "./hooks/useRsaKeyRecovery";
import { AuthenticatedLayout } from "./components/layout/authenticated-layout";

// Polyfill global Buffer for libraries that expect it (e.g., bip39)
window.Buffer = Buffer as any;

// Check environment variables on app startup
const checkEnvironmentVariables = () => {
  const requiredVars = {
    "API URL": process.env.REACT_APP_API_URL,
  };

  const missing = Object.entries(requiredVars)
    .filter(([_, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    console.warn("Missing optional environment variables:", missing);
    console.log("Using default values for missing variables");
  }
};

// Root route component - checks auth when it renders
const RootRoute: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    checkAuth().then(setIsAuthenticated);
  }, []);

  if (isAuthenticated === null) {
    return null;
  }

  return isAuthenticated ? <Navigate to="/storage" replace /> : <LandingPage />;
};

function App() {
  useEffect(() => {
    checkEnvironmentVariables();
  }, []);

  // Automatically recover RSA keys on page load if mnemonic is available
  useRsaKeyRecovery();

  return (
    <Router>
      <Routes>
        <Route path="/" element={<RootRoute />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route
          path="/storage"
          element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <PrivateStorage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/key-management"
          element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <KeyManagementPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/share"
          element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <ShareFilesPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/shared-with-me"
          element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <SharedWithMePage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/key-test"
          element={
            <ProtectedRoute>
              <AuthenticatedLayout>
                <KeyTestPage />
              </AuthenticatedLayout>
            </ProtectedRoute>
          }
        />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
      </Routes>
    </Router>
  );
}

export default App;

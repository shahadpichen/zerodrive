import React from "react";
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

// Polyfill global Buffer for libraries that expect it (e.g., bip39)
window.Buffer = Buffer as any;

function App() {
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true";

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

import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import PrivateStorage from "./pages/private-storage";
import LandingPage from "./pages/landing-page";
import ProtectedRoute from "./components/protected-route";
import Privacy from "./pages/privacy";
import Terms from "./pages/terms";
import HowItWorks from "./pages/how-it-works";
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
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
      </Routes>
    </Router>
  );
}

export default App;

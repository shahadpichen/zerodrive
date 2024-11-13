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
      </Routes>
    </Router>
  );
}

export default App;

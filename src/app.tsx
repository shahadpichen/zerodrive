import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import PrivateStorage from "./pages/private-storage";
import LandingPage from "./pages/landing-page";
import Privacy from "./pages/privacy";
import Terms from "./pages/terms";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/storage" element={<PrivateStorage />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
      </Routes>
    </Router>
  );
}

export default App;

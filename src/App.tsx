import React from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import PrivateStorage from "./pages/private-storage";
import LandingPage from "./pages/landing-page";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/storage" element={<PrivateStorage />} />
      </Routes>
    </Router>
  );
}

export default App;

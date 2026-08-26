import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./app";
import reportWebVitals from "./reportWebVitals";
import { ThemeProvider } from "./components/theme-provider";
import { Toaster } from "./components/ui/sonner";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Unable to start ZeroDrive because the app root is missing.");
}

const application = (
  <React.StrictMode>
    <ThemeProvider defaultTheme="light">
      <App />
      <Toaster />
    </ThemeProvider>
  </React.StrictMode>
);

const prerenderedPath = rootElement.dataset.prerenderedPath;
const currentPath =
  window.location.pathname.length > 1
    ? window.location.pathname.replace(/\/+$/, "")
    : window.location.pathname;

if (prerenderedPath === currentPath) {
  ReactDOM.hydrateRoot(rootElement, application);
} else {
  ReactDOM.createRoot(rootElement).render(application);
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

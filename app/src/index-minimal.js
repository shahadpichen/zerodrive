/**
 * ULTRA-MINIMAL React Entry Point
 * For debugging infinite reload issue
 *
 * If this page ALSO reloads, the problem is NOT in the React app code.
 */

import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

console.log("🔴🔴🔴 ULTRA-MINIMAL MODE ACTIVATED 🔴🔴🔴");
console.log("If you see this message repeated rapidly, React itself is reloading");

let renderCount = 0;

function MinimalApp() {
  const [counter, setCounter] = React.useState(0);

  React.useEffect(() => {
    console.log("✅ MinimalApp mounted");
    const interval = setInterval(() => {
      setCounter(c => c + 1);
    }, 1000);

    return () => {
      console.log("❌ MinimalApp unmounting");
      clearInterval(interval);
    };
  }, []);

  renderCount++;

  return (
    <div style={{ padding: "40px", fontFamily: "system-ui" }}>
      <h1 style={{ color: "#059669" }}>✅ React Minimal Test</h1>
      <div style={{ background: "#f3f4f6", padding: "20px", borderRadius: "8px", margin: "20px 0" }}>
        <p><strong>Render count:</strong> <span style={{ fontSize: "32px", color: "#2563eb" }}>{renderCount}</span></p>
        <p><strong>State counter:</strong> <span style={{ fontSize: "32px", color: "#059669" }}>{counter}</span></p>
        <p><strong>Time:</strong> {new Date().toLocaleTimeString()}</p>
        <p><strong>Cookies:</strong> <code>{document.cookie || "(none)"}</code></p>
      </div>

      <h2>🔍 What to check:</h2>
      <ul>
        <li>Render count should stay constant (or increase slowly if React re-renders)</li>
        <li>State counter should increase every second</li>
        <li>If render count resets to 1 repeatedly → Full page reload</li>
        <li>If render count increases but counter resets → Component remounting</li>
      </ul>

      <h2>📊 Status:</h2>
      {renderCount > 10 ? (
        <p style={{ color: "#dc2626", fontWeight: "bold" }}>
          ⚠️ Render count is very high - check for state update loops
        </p>
      ) : (
        <p style={{ color: "#059669" }}>
          ✅ Render count looks normal
        </p>
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<MinimalApp />);

console.log("🔴 Initial render complete");

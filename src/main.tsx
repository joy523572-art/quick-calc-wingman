import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Offline support for the installed app. Skipped in dev and inside the editor preview frame.
const inIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
const isPreviewHost = location.hostname.includes("id-preview--") || location.hostname.includes("lovableproject.com");
if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD && !inIframe && !isPreviewHost) {
    window.addEventListener("load", () => void navigator.serviceWorker.register("/sw.js"));
  } else {
    void navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister()));
  }
}

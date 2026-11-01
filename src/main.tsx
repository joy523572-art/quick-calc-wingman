import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Offline support for the installed app. Skip registration in dev and preview environments.
const inIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  location.hostname.includes("id-preview--") ||
  location.hostname.includes("lovableproject.com");

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD && !inIframe && !isPreviewHost) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/pwabuilder-sw.js")
        .catch(() => navigator.serviceWorker.register("/sw.js"));
    });
  } else {
    void navigator.serviceWorker.getRegistrations().then((registrations) =>
      registrations.forEach((registration) => void registration.unregister()),
    );
  }
}

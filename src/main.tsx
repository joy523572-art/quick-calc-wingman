import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Service workers have been removed from this app.
// Unregister any previously registered workers so every device
// loads fresh assets directly from the network.
if ("serviceWorker" in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) =>
    registrations.forEach((registration) => void registration.unregister()),
  );
}

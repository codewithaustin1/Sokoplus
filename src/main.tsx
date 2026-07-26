import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./serviceWorkerRegistration";
import { SettingsProvider } from "./lib/SettingsContext.tsx";
import { TypographyProvider } from "./lib/TypographyContext.tsx";

// Register SokoPlus offline assets cache service worker
registerServiceWorker();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <SettingsProvider>
        <TypographyProvider>
          <App />
        </TypographyProvider>
      </SettingsProvider>
    </HelmetProvider>
  </StrictMode>,
);

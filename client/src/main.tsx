import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { AppProviders } from "./AppProviders";

declare global {
  interface Window {
    __IMPETUS_BUILD__?: "dev" | "prod";
  }
}

if (typeof window !== "undefined") {
  window.__IMPETUS_BUILD__ = import.meta.env.DEV ? "dev" : "prod";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>
);

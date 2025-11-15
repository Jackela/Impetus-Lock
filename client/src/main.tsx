import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

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
    <App />
  </StrictMode>
);

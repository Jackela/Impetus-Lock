import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AppRouter } from "./AppRouter";
import "./index.css";

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
    <AppRouter />
  </StrictMode>
);

import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { App } from "./App";
import { TermsOfService } from "./pages/TermsOfService";
import { PrivacyPolicy } from "./pages/PrivacyPolicy";
import "./pages/LegalFooter.css";

/**
 * Main router wrapper for Impetus Lock
 *
 * Provides routing to:
 * - / (main editor)
 * - /terms (Terms of Service)
 * - /privacy (Privacy Policy)
 */
export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
      </Routes>

      {/* Footer with legal links */}
      <footer className="legal-footer">
        <Link to="/terms">Terms of Service</Link>
        <span className="separator">|</span>
        <Link to="/privacy">Privacy Policy</Link>
      </footer>
    </BrowserRouter>
  );
}

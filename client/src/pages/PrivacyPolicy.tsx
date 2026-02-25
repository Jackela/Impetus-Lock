import React from "react";
import "./LegalPages.css";

/**
 * Privacy Policy Page
 *
 * GDPR-compliant privacy policy for Impetus Lock.
 * Clearly explains data collection, usage, and user rights.
 */

export function PrivacyPolicy() {
  return (
    <div className="legal-page">
      <div className="legal-content">
        <h1>Privacy Policy</h1>
        <p className="last-updated">Last updated: February 25, 2026</p>

        <section>
          <h2>1. Introduction</h2>
          <p>
            Impetus Lock ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.
          </p>
          <p>
            <strong>GDPR Compliance:</strong> We comply with the General Data Protection Regulation (GDPR) and respect your data protection rights.
          </p>
        </section>

        <section>
          <h2>2. Data Controller</h2>
          <p>
            Impetus Lock is the data controller for the personal information collected through this Service.
          </p>
          <p>
            <strong>Contact:</strong> privacy@impetuslock.com
          </p>
        </section>

        <section>
          <h2>3. Information We Collect</h2>

          <h3>3.1 Personal Data</h3>
          <ul>
            <li><strong>Account Information:</strong> Name, email address (for authentication)</li>
            <li><strong>Usage Data:</strong> Features used, session duration, preferences</li>
            <li><strong>Payment Information:</strong> Processed by Stripe (we don't store card details)</li>
          </ul>

          <h3>3.2 Content Data</h3>
          <ul>
            <li><strong>Your Documents:</strong> Text content you create and edit</li>
            <li><strong>AI Interactions:</strong> Prompts sent to LLM providers for generating suggestions</li>
          </ul>

          <h3>3.3 Technical Data</h3>
          <ul>
            <li><strong>Device Information:</strong> Browser type, OS, device type</li>
            <li><strong>Log Data:</strong> IP address, timestamps, error logs</li>
            <li><strong>Cookies:</strong> Session management, preferences</li>
          </ul>
        </section>

        <section>
          <h2>4. How We Use Your Information</h2>
          <p>We use your data to:</p>
          <ul>
            <li>Provide and improve the Service</li>
            <li>Process AI-generated writing suggestions</li>
            <li>Authenticate and secure your account</li>
            <li>Process payments (via Stripe)</li>
            <li>Communicate with you about the Service</li>
            <li>Analyze usage patterns to improve features</li>
            <li>Comply with legal obligations</li>
          </ul>
        </section>

        <section>
          <h2>5. Legal Basis for Processing (GDPR)</h2>
          <p>We process your data based on:</p>
          <ul>
            <li><strong>Contract:</strong> To provide the Service you requested</li>
            <li><strong>Consent:</strong> For marketing communications and optional features</li>
            <li><strong>Legitimate Interest:</strong> To improve the Service and ensure security</li>
            <li><strong>Legal Obligation:</strong> To comply with applicable laws</li>
          </ul>
        </section>

        <section>
          <h2>6. Data Sharing and Disclosure</h2>
          <p>We share data with:</p>
          <ul>
            <li><strong>LLM Providers:</strong> OpenAI, Anthropic, Google (to generate AI suggestions)</li>
            <li><strong>Payment Processor:</strong> Stripe (for subscription payments)</li>
            <li><strong>Cloud Infrastructure:</strong> AWS (for hosting and data storage)</li>
            <li><strong>Analytics:</strong> Anonymous usage statistics (if enabled)</li>
          </ul>
          <p>
            We do not sell your personal data to third parties.
          </p>
        </section>

        <section>
          <h2>7. Data Retention</h2>
          <ul>
            <li><strong>Account Data:</strong> Retained while your account is active</li>
            <li><strong>Document Content:</strong> Retained until you delete it or close your account</li>
            <li><strong>Log Data:</strong> Retained for 90 days, then anonymized</li>
            <li><strong>Payment Records:</strong> Retained as required by law (7 years)</li>
          </ul>
        </section>

        <section>
          <h2>8. Your Rights (GDPR)</h2>
          <p>Under GDPR, you have the right to:</p>
          <ul>
            <li><strong>Access:</strong> Request a copy of your personal data</li>
            <li><strong>Rectification:</strong> Correct inaccurate or incomplete data</li>
            <li><strong>Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
            <li><strong>Restriction:</strong> Limit how we process your data</li>
            <li><strong>Portability:</strong> Receive your data in a portable format</li>
            <li><strong>Object:</strong> Object to processing based on legitimate interests</li>
            <li><strong>Withdraw Consent:</strong> Withdraw consent at any time</li>
          </ul>
          <p>
            To exercise these rights, contact us at privacy@impetuslock.com
          </p>
        </section>

        <section>
          <h2>9. Data Security</h2>
          <p>We implement appropriate security measures:</p>
          <ul>
            <li>Encryption in transit (HTTPS/TLS)</li>
            <li>Encryption at rest (database encryption)</li>
            <li>Access controls and authentication</li>
            <li>Regular security audits</li>
            <li>Secure backup procedures</li>
          </ul>
          <p>
            However, no method of transmission over the Internet is 100% secure.
          </p>
        </section>

        <section>
          <h2>10. International Data Transfers</h2>
          <p>
            Your data may be transferred to and processed in countries outside the EEA. We ensure appropriate safeguards are in place, such as:
          </p>
          <ul>
            <li>Standard Contractual Clauses (SCCs)</li>
            <li>Data Processing Agreements with third parties</li>
            <li>Compliance with applicable data protection laws</li>
          </ul>
        </section>

        <section>
          <h2>11. Children's Privacy</h2>
          <p>
            The Service is not intended for children under 16. We do not knowingly collect personal data from children under 16. If you believe we have collected data from a child, please contact us.
          </p>
        </section>

        <section>
          <h2>12. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy periodically. Significant changes will be notified via email or in-app notification. Continued use after changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2>13. Contact Us</h2>
          <p>For privacy-related questions or to exercise your rights:</p>
          <p>
            <strong>Email:</strong> privacy@impetuslock.com
          </p>
          <p>
            <strong>Data Protection Officer:</strong> dpo@impetuslock.com
          </p>
        </section>

        <section>
          <h2>14. Supervisory Authority</h2>
          <p>
            If you believe we have not addressed your privacy concerns, you have the right to lodge a complaint with a supervisory authority in your jurisdiction.
          </p>
        </section>
      </div>
    </div>
  );
}

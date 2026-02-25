import React from "react";
import "./LegalPages.css";

/**
 * Terms of Service Page
 *
 * Legal agreement for Impetus Lock service usage.
 * GDPR-compliant with clear terms and user rights.
 */

export function TermsOfService() {
  return (
    <div className="legal-page">
      <div className="legal-content">
        <h1>Terms of Service</h1>
        <p className="last-updated">Last updated: February 25, 2026</p>

        <section>
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing and using Impetus Lock ("the Service"), you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this Service.
          </p>
        </section>

        <section>
          <h2>2. Description of Service</h2>
          <p>
            Impetus Lock is a creative writing tool that provides AI-powered writing assistance and intervention features. The Service includes:
          </p>
          <ul>
            <li>AI writing suggestions and interventions</li>
            <li>Document editing and management</li>
            <li>Export functionality (PDF, DOCX)</li>
            <li>Multi-project support (Pro tier)</li>
          </ul>
        </section>

        <section>
          <h2>3. User Accounts</h2>
          <p>
            To access certain features, you may need to create an account. You are responsible for:
          </p>
          <ul>
            <li>Maintaining the confidentiality of your account credentials</li>
            <li>All activities that occur under your account</li>
            <li>Notifying us immediately of any unauthorized use</li>
          </ul>
        </section>

        <section>
          <h2>4. Subscription and Payments</h2>
          <p>
            <strong>Free Tier:</strong> Basic features are available at no cost.
          </p>
          <p>
            <strong>Pro Tier ($9.99/month):</strong> Advanced features including multi-project support, priority AI responses, and export options.
          </p>
          <p>
            Payments are processed securely through Stripe. Subscriptions auto-renew monthly unless cancelled. You may cancel at any time.
          </p>
        </section>

        <section>
          <h2>5. User Content</h2>
          <p>
            You retain ownership of all content you create using the Service. By using the Service, you grant us a limited license to process your content solely for providing the Service.
          </p>
          <p>
            We do not claim ownership of your writing. Your documents remain your intellectual property.
          </p>
        </section>

        <section>
          <h2>6. Acceptable Use</h2>
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>Generate illegal, harmful, or offensive content</li>
            <li>Violate intellectual property rights</li>
            <li>Attempt to reverse engineer or exploit the Service</li>
            <li>Interfere with other users' access</li>
          </ul>
        </section>

        <section>
          <h2>7. AI-Generated Content</h2>
          <p>
            The Service uses artificial intelligence to provide writing suggestions. While we strive for quality, AI-generated content may contain errors. You are responsible for reviewing and approving all suggestions before use.
          </p>
        </section>

        <section>
          <h2>8. Limitation of Liability</h2>
          <p>
            Impetus Lock is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the Service, including loss of data or profits.
          </p>
        </section>

        <section>
          <h2>9. Termination</h2>
          <p>
            We reserve the right to terminate or suspend your account at any time for violations of these Terms. Upon termination, your access to the Service will cease immediately.
          </p>
        </section>

        <section>
          <h2>10. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. Significant changes will be notified via email or in-app notification. Continued use after changes constitutes acceptance.
          </p>
        </section>

        <section>
          <h2>11. Contact Information</h2>
          <p>
            For questions about these Terms, please contact us at:
          </p>
          <p>
            <strong>Email:</strong> legal@impetuslock.com
          </p>
        </section>

        <section>
          <h2>12. Governing Law</h2>
          <p>
            These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles.
          </p>
        </section>
      </div>
    </div>
  );
}

# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| 0.1.x   | :white_check_mark: Yes |

**Current stable version:** 0.1.0

## Reporting a Vulnerability

The Impetus Lock team takes security vulnerabilities seriously. We appreciate your efforts to responsibly disclose your findings.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please send an email to: **[SECURITY EMAIL TO BE CONFIGURED]**

Alternatively, you can:
1. Use [GitHub's private vulnerability reporting](https://github.com/Jackela/impetus-lock/security/advisories) (if enabled for this repository)
2. Send a direct message to the project maintainers

### What to Include

Please include the following information in your report:

- **Description**: A clear description of the vulnerability
- **Impact**: How the vulnerability could be exploited (proof of concept if available)
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Affected Versions**: Which versions are affected (if known)
- **Suggested Fix**: Any suggestions for a fix (optional but helpful)

### Response Timeline

We aim to respond to security reports within **7 days** with:

1. **Confirmation**: Acknowledgment that we received your report
2. **Evaluation**: Assessment of severity and impact
3. **Remediation Plan**: Estimated timeline for a fix
4. **Disclosure**: Coordination on public disclosure timing

### Security Best Practices for Users

#### Bring Your Own Key (BYOK)

Impetus Lock uses a Bring Your Own Key (BYOK) model for LLM API access. Your API keys:

- **Never leave your browser** (except via encrypted HTTPS headers to your backend)
- **Are never logged** or sent to telemetry
- **Can be stored** in three modes:
  - `local`: Stored in browser `localStorage` (plaintext)
  - `encrypted`: AES-GCM encrypted with passphrase-derived key
  - `session`: In-memory only, cleared on page hide/idle timeout

See [docs/security/byok-storage.md](docs/security/byok-storage.md) for detailed security architecture.

#### Local Development Security

When running Impetus Locally:

- Use the `session` storage mode for sensitive credentials
- Enable `Lock Session` to immediately clear in-memory keys
- Use `Forget Key` to remove all persisted credentials
- Never commit `.env` files containing API keys

#### Dependency Updates

We recommend:

- Running `npm audit` and `poetry show --tree` regularly
- Keeping dependencies updated with Dependabot PRs
- Reviewing security advisories for:
  - [Node.js / npm](https://github.com/nodejs/security-wg)
  - [Python](https://github.com/python-security)
  - [FastAPI](https://github.com/tiangolo/fastapi)

### Known Security Considerations

#### Un-deletable Content

Impetus Lock's core feature is **un-deletable AI-generated content**. This is:

- **By design**: A creative pressure mechanism, not a bug
- **Client-side enforced**: Can be bypassed by editing Markdown directly
- **Not for compliance**: Do not use for regulatory or legal content requirements

#### Local-First Architecture

- Data is stored in browser `localStorage`
- Clearing browser data removes all tasks and settings
- No cloud sync or backup by default
- Export your work regularly using the editor's export features

### Security-Related Configuration

#### Environment Variables

| Variable | Description | Default | Security Note |
|----------|-------------|---------|---------------|
| `LLM_ALLOW_DEBUG_PROVIDER` | Allow mock LLM for testing | `false` | Only enable in development/testing |
| `VITE_TELEMETRY_DEFAULT` | Default telemetry state | `off` | Telemetry is opt-in; never logs API keys |
| `TESTING` | Enable test mode | `unset` | Enables in-memory repository (no DB) |

#### Content Security Policy

When deploying to production, configure appropriate CSP headers to:

- Restrict script sources to trusted domains
- Prevent inline script execution
- Control frame embedding
- Limit form-action destinations

### License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

### Disclaimer

This software is provided "as is" without warranty of any kind. The authors and copyright holders are not liable for any damages arising from its use.

---

**Last Updated**: 2025-02-04

## 1. Upgrade and verify

- [x] Record the reviewed version floors and verify the old lock is rejected by the dependency contract test.
- [x] Lock cryptography, the OpenTelemetry family and pytest at fixed versions with Poetry.
- [x] Verify existing Fernet tokens and OTLP HTTP export with the new runtime dependencies.
- [x] Run parallel backend tests and coverage gates with Python 3.11 and 3.12.

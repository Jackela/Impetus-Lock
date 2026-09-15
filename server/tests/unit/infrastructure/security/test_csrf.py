"""Unit tests for CSRF token generation and validation.

Pins the generate_token/validate_token roundtrip: tokens issued by
generate_token must be verifiable by validate_token on the same
SECRET_KEY, while tampered, expired, and differently-signed tokens must
be rejected. The double-submit cookie comparison in the auth middleware
is intentionally not covered here; it compares raw strings and is
unaffected by the token format.
"""

import time

import pytest

from server.infrastructure.security.csrf import CSRFProtection

SECRET_KEY_A = "unit-test-secret-key-a"
SECRET_KEY_B = "unit-test-secret-key-b"


@pytest.fixture
def protection(monkeypatch: pytest.MonkeyPatch) -> CSRFProtection:
    """Create a CSRFProtection instance signed with SECRET_KEY_A.

    Returns:
        A CSRFProtection instance bound to SECRET_KEY_A.
    """
    monkeypatch.setenv("SECRET_KEY", SECRET_KEY_A)
    return CSRFProtection()


def test_generate_token_roundtrip_with_validate(protection: CSRFProtection) -> None:
    """A token issued by generate_token must validate as True."""
    token = protection.generate_token()
    assert protection.validate_token(token) is True


def test_validate_token_rejects_tampered_token(protection: CSRFProtection) -> None:
    """Modifying the token must invalidate it.

    Tampering targets the first character: every bit of a leading
    base64 character is significant, so the decoded payload (and thus
    the signature check) always changes. The trailing character is
    unsuitable because unpadded base64 ignores its low bits, so some
    replacements decode to identical bytes and still validate
    (~6% false-accept rate, observed over 2000 tokens).
    """
    token = protection.generate_token()
    tampered = ("A" if token[0] != "A" else "B") + token[1:]
    assert protection.validate_token(tampered) is False


def test_validate_token_rejects_expired_token(
    protection: CSRFProtection,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A token older than max_age must be rejected.

    itsdangerous timestamps have whole-second granularity, so
    loads(max_age=0) still accepts a just-signed token (age 0 is not
    greater than 0). Advancing time.time() beyond max_age is the
    reliable equivalent of waiting for expiry.
    """
    token = protection.generate_token()
    real_time = time.time
    monkeypatch.setattr(time, "time", lambda: real_time() + 7200)
    assert protection.validate_token(token) is False


def test_validate_token_rejects_other_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    """A token signed with SECRET_KEY_A must fail under SECRET_KEY_B."""
    monkeypatch.setenv("SECRET_KEY", SECRET_KEY_A)
    token = CSRFProtection().generate_token()
    monkeypatch.setenv("SECRET_KEY", SECRET_KEY_B)
    assert CSRFProtection().validate_token(token) is False


def test_init_raises_without_secret_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """CSRFProtection must raise ValueError when SECRET_KEY is unset."""
    monkeypatch.delenv("SECRET_KEY", raising=False)
    with pytest.raises(ValueError, match="SECRET_KEY"):
        CSRFProtection()

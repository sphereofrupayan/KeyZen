"""
otp.py
======
One-time passcode generation, delivery, and verification — the second
factor that runs after auth.py confirms the master password.

Codes are:
- 6 digits, generated with `secrets` (cryptographically secure, not
  `random`).
- Stored as a salted hash, never in plaintext.
- Valid for 5 minutes and locked out after 5 failed attempts.

Email delivery:
- If SMTP_HOST / SMTP_USER / SMTP_PASSWORD are set as environment
  variables, the code is emailed for real.
- If they are NOT set, the code is printed to the server console
  instead, so you can develop and test locally without configuring a
  mail server. Look for "[DEV OTP]" in your terminal.
"""

import os
import hashlib
import secrets
import smtplib
from email.mime.text import MIMEText

from flask import Blueprint, request, jsonify, session

from database import db, OTPCode, User

otp_bp = Blueprint("otp", __name__, url_prefix="/api/otp")

MAX_ATTEMPTS = 5
_PEPPER = os.environ.get("SECRET_KEY", "dev-pepper-change-me")


# ---------- helpers ----------

def _hash_code(code: str) -> str:
    return hashlib.sha256(f"{code}{_PEPPER}".encode("utf-8")).hexdigest()


def _generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def _send_email(to_address: str, code: str):
    host = os.environ.get("SMTP_HOST")
    user = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASSWORD")
    port = int(os.environ.get("SMTP_PORT", 587))
    sender = os.environ.get("SMTP_FROM", user or "no-reply@ciphervault.local")

    if not (host and user and password):
        print(f"[DEV OTP] Code for {to_address}: {code} (expires in 5 minutes)")
        return

    try:
        message = MIMEText(
            f"Your CipherVault verification code is {code}.\n"
            f"It expires in 5 minutes. If you didn't request this, ignore this email."
        )

        message["Subject"] = "Your CipherVault verification code"
        message["From"] = sender
        message["To"] = to_address

        with smtplib.SMTP(host, port) as server:
            server.starttls()
            server.login(user, password)
            server.sendmail(sender, [to_address], message.as_string())

        print(f"[OTP] Email successfully sent to {to_address}")

    except Exception as e:
        print(f"[OTP EMAIL ERROR] {type(e).__name__}: {e}")
        raise


def issue_otp_for_user(user: User) -> None:
    """Generates, stores, and sends a fresh OTP for the given user."""
    code = _generate_code()

    otp = OTPCode(
        user_id=user.id,
        code_hash=_hash_code(code),
        expires_at=OTPCode.default_expiry(minutes=5),
    )
    db.session.add(otp)
    db.session.commit()

    _send_email(user.email, code)


# ---------- routes ----------

def verify_code(user_id: int, code: str):
    """
    Shared OTP-checking logic, reused by both the login verify route
    below and the password-reset flow in auth.py. Returns (otp, error).
    On success, `otp` is the matched OTPCode with verified=True already
    committed. On failure, `otp` is None and `error` explains why.
    """
    otp = (
        OTPCode.query.filter_by(user_id=user_id, verified=False)
        .order_by(OTPCode.created_at.desc())
        .first()
    )

    if not otp:
        return None, "No active code. Request a new one."

    if otp.is_expired():
        return None, "That code has expired. Request a new one."

    if otp.attempts >= MAX_ATTEMPTS:
        return None, "Too many attempts. Request a new code."

    if _hash_code(code) != otp.code_hash:
        otp.attempts += 1
        db.session.commit()
        remaining = MAX_ATTEMPTS - otp.attempts
        return None, f"Incorrect code. {remaining} attempt(s) left."

    otp.verified = True
    db.session.commit()
    return otp, None


@otp_bp.route("/verify", methods=["POST"])
def verify():
    pending_user_id = session.get("pending_user_id")
    if not pending_user_id:
        return jsonify({"error": "No login in progress. Sign in again."}), 400

    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip()
    if not code:
        return jsonify({"error": "Enter the 6-digit code"}), 400

    otp, error = verify_code(pending_user_id, code)
    if error:
        status = 429 if "Too many" in error else (400 if ("expired" in error or "No active" in error) else 401)
        return jsonify({"error": error}), status

    user = User.query.get(pending_user_id)
    from datetime import datetime
    user.last_login_at = datetime.utcnow()
    db.session.commit()

    session.pop("pending_user_id", None)
    session["user_id"] = user.id

    return jsonify({"message": "Verified", "user": user.to_dict()}), 200


@otp_bp.route("/resend", methods=["POST"])
def resend():
    pending_user_id = session.get("pending_user_id")
    if not pending_user_id:
        return jsonify({"error": "No login in progress. Sign in again."}), 400

    user = User.query.get(pending_user_id)
    if not user:
        return jsonify({"error": "Session expired. Sign in again."}), 400

    issue_otp_for_user(user)
    return jsonify({"message": "A new code has been sent."}), 200

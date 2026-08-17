"""
auth.py
=======
Registration, login (first factor), logout, and the login_required
decorator used to protect vault routes.

Auth flow:
1. POST /api/auth/register  -> creates the user, bcrypt-hashed password.
2. POST /api/auth/login     -> verifies email + master password.
                                On success: generates an OTP (see otp.py),
                                stores session['pending_user_id'], and
                                returns otp_required: true. The user is
                                NOT fully logged in yet.
3. POST /api/otp/verify     -> (see otp.py) promotes pending_user_id to
                                a full session['user_id'] once the code
                                checks out.
4. GET  /api/auth/me        -> returns the current user if fully logged in.
5. POST /api/auth/logout    -> clears the session.
"""

from functools import wraps
from flask import Blueprint, request, jsonify, session
import bcrypt

from database import db, User
from otp import issue_otp_for_user, verify_code

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


# ---------- helpers ----------

def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))


def login_required(view_func):
    """Protects a route: rejects the request unless session['user_id'] is set."""

    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"error": "Not authenticated"}), 401
        return view_func(*args, **kwargs)

    return wrapped


def current_user():
    """Returns the fully-authenticated User, or None."""
    user_id = session.get("user_id")
    if not user_id:
        return None
    return User.query.get(user_id)


# ---------- routes ----------

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    confirm = data.get("confirm_password") or password

    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are all required"}), 400

    if len(password) < 8:
        return jsonify({"error": "Master password must be at least 8 characters"}), 400

    if password != confirm:
        return jsonify({"error": "Passwords do not match"}), 400

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with that email already exists"}), 409

    user = User(name=name, email=email, password_hash=hash_password(password))
    db.session.add(user)
    db.session.commit()

    return jsonify({"message": "Account created", "user": user.to_dict()}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    print(f"[LOGIN] Email received: {email}")
    print(f"[LOGIN] Password length: {len(password)}")

    user = User.query.filter_by(email=email).first()

    if not user:
        print("[LOGIN] USER NOT FOUND")
        return jsonify({"error": "Invalid email or password"}), 401

    print(f"[LOGIN] User found: {user.email}")
    print(f"[LOGIN] Stored hash exists: {bool(user.password_hash)}")

    try:
        password_ok = verify_password(password, user.password_hash)
    except Exception as e:
        print(f"[LOGIN] PASSWORD CHECK ERROR: {type(e).__name__}: {e}")
        return jsonify({"error": "Password verification failed"}), 500

    print(f"[LOGIN] Password correct: {password_ok}")

    if not password_ok:
        return jsonify({"error": "Invalid email or password"}), 401

    session.clear()
    session["pending_user_id"] = user.id

    try:
        issue_otp_for_user(user)
        print("[LOGIN] OTP issued successfully")
    except Exception as e:
        print(f"[OTP ERROR] {type(e).__name__}: {e}")
        return jsonify({"error": "Could not send OTP"}), 500

    return jsonify({
        "message": "Password verified. Enter the one-time code sent to your email.",
        "otp_required": True
    }), 200


@auth_bp.route("/me", methods=["GET"])
def me():
    user = current_user()
    if not user:
        return jsonify({"authenticated": False}), 200
    return jsonify({"authenticated": True, "user": user.to_dict()}), 200


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"}), 200


@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()

    user = User.query.filter_by(email=email).first()

    # Always respond the same way whether or not the account exists —
    # this stops someone from using this endpoint to find out which
    # emails are registered.
    if user:
        session["reset_user_id"] = user.id
        issue_otp_for_user(user)

    return jsonify({
        "message": "If that email is registered, a reset code has been sent."
    }), 200


@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    reset_user_id = session.get("reset_user_id")
    if not reset_user_id:
        return jsonify({"error": "No password reset in progress. Start again."}), 400

    data = request.get_json(silent=True) or {}
    code = (data.get("code") or "").strip()
    new_password = data.get("new_password") or ""
    confirm_password = data.get("confirm_password") or ""

    if not code:
        return jsonify({"error": "Enter the 6-digit code"}), 400
    if len(new_password) < 8:
        return jsonify({"error": "New password must be at least 8 characters"}), 400
    if new_password != confirm_password:
        return jsonify({"error": "Passwords do not match"}), 400

    otp, error = verify_code(reset_user_id, code)
    if error:
        status = 429 if "Too many" in error else (400 if ("expired" in error or "No active" in error) else 401)
        return jsonify({"error": error}), status

    user = User.query.get(reset_user_id)
    user.password_hash = hash_password(new_password)
    db.session.commit()

    session.pop("reset_user_id", None)

    return jsonify({"message": "Password updated. Sign in with your new password."}), 200

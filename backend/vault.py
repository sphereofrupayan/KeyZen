"""
vault.py
========
CRUD routes for saved credentials. Every route here requires a fully
authenticated session (see auth.login_required) — no vault data is
readable without having passed both the master password and the OTP
check first.

Passwords and notes are encrypted with encryption.py before they touch
the database, and decrypted only on the specific request that asks to
reveal them (never included by default in list responses).
"""

from flask import Blueprint, request, jsonify, session

from database import db, VaultEntry
from auth import login_required
from encryption import encrypt_data, decrypt_data

vault_bp = Blueprint("vault", __name__, url_prefix="/api/vault")


# ---------- helpers ----------

def _score_strength(password: str) -> str:
    """Mirrors the frontend's strength meter so dashboard stats agree with it."""
    if not password:
        return "weak"
    score = 0
    if len(password) >= 8:
        score += 1
    if len(password) >= 14:
        score += 1
    if any(c.isupper() for c in password) and any(c.islower() for c in password):
        score += 1
    if any(c.isdigit() for c in password):
        score += 1
    if any(not c.isalnum() for c in password):
        score += 1

    if score <= 1:
        return "weak"
    if score <= 3:
        return "medium"
    return "strong"


def _owned_entry_or_404(entry_id: int):
    entry = VaultEntry.query.filter_by(id=entry_id, user_id=session["user_id"]).first()
    return entry


# ---------- routes ----------

@vault_bp.route("", methods=["GET"])
@login_required
def list_entries():
    """
    Returns every entry for the logged-in user. Passwords themselves
    are never included here — call the /reveal route below to decrypt
    a specific entry on demand. We DO compute and include a strength
    label per entry (decrypting only in-memory, momentarily, to score
    it) so the dashboard can show accurate badges without ever sending
    plaintext passwords to the browser.
    """
    entries = (
        VaultEntry.query.filter_by(user_id=session["user_id"])
        .order_by(VaultEntry.updated_at.desc())
        .all()
    )

    result = []
    for e in entries:
        d = e.to_dict()
        d["strength"] = _score_strength(decrypt_data(e.encrypted_password))
        result.append(d)

    return jsonify({"entries": result}), 200


@vault_bp.route("/stats", methods=["GET"])
@login_required
def vault_stats():
    entries = VaultEntry.query.filter_by(user_id=session["user_id"]).all()

    strengths = []
    seen_passwords = {}
    reused_count = 0

    for e in entries:
        plain = decrypt_data(e.encrypted_password)
        strengths.append(_score_strength(plain))
        seen_passwords[plain] = seen_passwords.get(plain, 0) + 1

    reused_count = sum(1 for count in seen_passwords.values() if count > 1)

    return jsonify({
        "total": len(entries),
        "strong": strengths.count("strong"),
        "medium": strengths.count("medium"),
        "weak": strengths.count("weak"),
        "reused": reused_count,
    }), 200


@vault_bp.route("/audit", methods=["GET"])
@login_required
def audit_entries():
    """
    Returns entries that need attention (weak or reused passwords),
    each tagged with why it was flagged, for the Security Audit page.
    Never includes plaintext passwords.
    """
    entries = VaultEntry.query.filter_by(user_id=session["user_id"]).all()

    decrypted = [(e, decrypt_data(e.encrypted_password)) for e in entries]

    seen_counts = {}
    for _, plain in decrypted:
        seen_counts[plain] = seen_counts.get(plain, 0) + 1

    flagged = []
    for e, plain in decrypted:
        strength = _score_strength(plain)
        is_reused = seen_counts[plain] > 1
        if strength == "weak" or is_reused:
            d = e.to_dict()
            d["strength"] = strength
            d["reused"] = is_reused
            flagged.append(d)

    return jsonify({"flagged": flagged}), 200


@vault_bp.route("", methods=["POST"])
@login_required
def create_entry():
    data = request.get_json(silent=True) or {}

    site_name = (data.get("site") or "").strip()
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not site_name or not username or not password:
        return jsonify({"error": "Site name, username and password are required"}), 400

    entry = VaultEntry(
        user_id=session["user_id"],
        site_name=site_name,
        site_url=(data.get("url") or "").strip() or None,
        username=username,
        encrypted_password=encrypt_data(password),
        notes=encrypt_data(data.get("notes")) if data.get("notes") else None,
        tag=data.get("tag") or "Personal",
    )
    db.session.add(entry)
    db.session.commit()

    return jsonify({"message": "Entry saved", "entry": entry.to_dict()}), 201


@vault_bp.route("/<int:entry_id>/reveal", methods=["GET"])
@login_required
def reveal_entry(entry_id):
    """Decrypts and returns the password (and notes) for one entry."""
    entry = _owned_entry_or_404(entry_id)
    if not entry:
        return jsonify({"error": "Entry not found"}), 404

    plain_password = decrypt_data(entry.encrypted_password)
    plain_notes = decrypt_data(entry.notes) if entry.notes else None

    return jsonify({"entry": entry.to_dict(plain_password, plain_notes)}), 200


@vault_bp.route("/<int:entry_id>", methods=["PUT"])
@login_required
def update_entry(entry_id):
    entry = _owned_entry_or_404(entry_id)
    if not entry:
        return jsonify({"error": "Entry not found"}), 404

    data = request.get_json(silent=True) or {}

    if "site" in data:
        entry.site_name = data["site"].strip()
    if "url" in data:
        entry.site_url = (data["url"] or "").strip() or None
    if "username" in data:
        entry.username = data["username"].strip()
    if "password" in data and data["password"]:
        entry.encrypted_password = encrypt_data(data["password"])
    if "notes" in data:
        entry.notes = encrypt_data(data["notes"]) if data["notes"] else None
    if "tag" in data:
        entry.tag = data["tag"]

    db.session.commit()
    return jsonify({"message": "Entry updated", "entry": entry.to_dict()}), 200


@vault_bp.route("/<int:entry_id>", methods=["DELETE"])
@login_required
def delete_entry(entry_id):
    entry = _owned_entry_or_404(entry_id)
    if not entry:
        return jsonify({"error": "Entry not found"}), 404

    db.session.delete(entry)
    db.session.commit()
    return jsonify({"message": "Entry deleted"}), 200
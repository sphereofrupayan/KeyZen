"""
database.py
============
SQLAlchemy models and DB initialization for CipherVault.

Defaults to a local SQLite file so the project runs with zero setup.
To point it at MySQL instead (matching a typical XAMPP/MySQL Workbench
setup), just change SQLALCHEMY_DATABASE_URI in app.py, e.g.:

    mysql+pymysql://root:yourpassword@localhost/ciphervault

...and add `pymysql` to requirements.txt (already included).
"""

from datetime import datetime, timedelta
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class User(db.Model):
    """A registered vault owner."""

    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)

    # Never store the plaintext master password. This is a salted bcrypt
    # hash used only to verify login attempts.
    password_hash = db.Column(db.String(255), nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    vault_entries = db.relationship(
        "VaultEntry", backref="owner", lazy=True, cascade="all, delete-orphan"
    )
    otp_codes = db.relationship(
        "OTPCode", backref="user", lazy=True, cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class VaultEntry(db.Model):
    """A single saved credential, encrypted at rest."""

    __tablename__ = "vault_entries"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    site_name = db.Column(db.String(150), nullable=False)
    site_url = db.Column(db.String(500), nullable=True)
    username = db.Column(db.String(255), nullable=False)

    # AES-256-GCM ciphertext (base64), never plaintext.
    encrypted_password = db.Column(db.Text, nullable=False)

    notes = db.Column(db.Text, nullable=True)  # stored as ciphertext too, see vault.py
    tag = db.Column(db.String(50), default="Personal")

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self, decrypted_password=None, decrypted_notes=None):
        return {
            "id": self.id,
            "site_name": self.site_name,
            "site_url": self.site_url,
            "username": self.username,
            "password": decrypted_password,  # only populated when explicitly decrypted
            "notes": decrypted_notes,
            "tag": self.tag,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class OTPCode(db.Model):
    """A short-lived one-time passcode used as a second login factor."""

    __tablename__ = "otp_codes"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    # We store a hash of the code, never the code itself.
    code_hash = db.Column(db.String(255), nullable=False)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    attempts = db.Column(db.Integer, default=0)
    verified = db.Column(db.Boolean, default=False)

    @staticmethod
    def default_expiry(minutes=5):
        return datetime.utcnow() + timedelta(minutes=minutes)

    def is_expired(self):
        return datetime.utcnow() > self.expires_at


def init_db(app):
    """Attach SQLAlchemy to the Flask app and create tables if missing."""
    db.init_app(app)
    with app.app_context():
        db.create_all()
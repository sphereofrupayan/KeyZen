"""
encryption.py
=============
Field-level AES-256-GCM encryption for anything sensitive that touches
the database (vault passwords, notes).

Design notes for your README:
- The server holds one master encryption key (VAULT_ENCRYPTION_KEY),
  loaded from an environment variable, never hard-coded and never
  committed to source control.
- Every encryption call generates a fresh random 12-byte nonce, so the
  same plaintext never produces the same ciphertext twice.
- GCM gives you authenticated encryption: any tampering with the
  ciphertext is detected and decryption fails loudly instead of
  silently returning garbage.

This is a solid, honest "encrypted at rest" design for a portfolio
project. It is NOT the same as true zero-knowledge encryption (where
only the user, via a client-side-derived key, could ever decrypt their
data). If you want to take it that far later, you'd move the
AES-GCM calls into script.js, derive the key from the user's master
password with PBKDF2 in the browser, and have the server store only
ciphertext it never has the key to open.
"""

import os
import base64
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# 32 raw bytes = AES-256. Generate one with:
#   python -c "import os, base64; print(base64.b64encode(os.urandom(32)).decode())"
# then set it as an environment variable, e.g. in a .env file:
#   VAULT_ENCRYPTION_KEY=your_generated_key_here
_RAW_KEY_B64 = os.environ.get("VAULT_ENCRYPTION_KEY")

if not _RAW_KEY_B64:
    raise RuntimeError(
        "VAULT_ENCRYPTION_KEY is not set. Generate one with:\n"
        "  python -c \"import os, base64; print(base64.b64encode(os.urandom(32)).decode())\"\n"
        "and add it to your environment (.env) before starting the app."
    )

_KEY = base64.b64decode(_RAW_KEY_B64)
if len(_KEY) != 32:
    raise RuntimeError("VAULT_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256).")

_aesgcm = AESGCM(_KEY)
_NONCE_SIZE = 12  # bytes, recommended size for GCM


def encrypt_data(plaintext: str) -> str:
    """
    Encrypts a plaintext string and returns a single base64 string
    containing [nonce || ciphertext], ready to store directly in a
    database column.
    """
    if plaintext is None:
        return None

    nonce = os.urandom(_NONCE_SIZE)
    ciphertext = _aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return base64.b64encode(nonce + ciphertext).decode("utf-8")


def decrypt_data(token: str) -> str:
    """
    Reverses encrypt_data(). Raises cryptography.exceptions.InvalidTag
    if the ciphertext has been tampered with or the key is wrong.
    """
    if token is None:
        return None

    raw = base64.b64decode(token)
    nonce, ciphertext = raw[:_NONCE_SIZE], raw[_NONCE_SIZE:]
    plaintext = _aesgcm.decrypt(nonce, ciphertext, None)
    return plaintext.decode("utf-8")
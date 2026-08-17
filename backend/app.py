"""
app.py
======
Flask application entry point. Wires together the database, session
config, CORS, and the three blueprints (auth, otp, vault).

Run locally:
    1. Copy .env.example to .env and fill in real values.
    2. pip install -r requirements.txt
    3. python app.py
    4. Serve the /frontend files (e.g. with `python -m http.server`
       from that folder, or a Live Server extension) and open
       login.html — it already points at http://localhost:5000.
"""

import os
from datetime import timedelta

from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()  # reads .env into environment variables before anything else runs

from database import init_db
from auth import auth_bp
from otp import otp_bp
from vault import vault_bp


def create_app():
    app = Flask(__name__)

    # ---- core config ----
    app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-secret-change-me")
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
        "DATABASE_URL", "sqlite:///ciphervault.db"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    # ---- session / cookie config ----
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    # Set SESSION_COOKIE_SECURE = True once you're serving over HTTPS.
    app.config["SESSION_COOKIE_SECURE"] = os.environ.get("FLASK_ENV") == "production"
    app.permanent_session_lifetime = timedelta(hours=12)

    # ---- CORS ----
    # Frontend is served separately (static files), so the browser
    # treats it as a different origin. supports_credentials=True lets
    # the session cookie travel with fetch() requests that use
    # `credentials: "include"`.
    frontend_origin = os.environ.get("FRONTEND_ORIGIN", "http://localhost:5500")
    CORS(app, supports_credentials=True, origins=[frontend_origin])

    # ---- database ----
    init_db(app)

    # ---- blueprints ----
    app.register_blueprint(auth_bp)
    app.register_blueprint(otp_bp)
    app.register_blueprint(vault_bp)

    # ---- health check ----
    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok", "service": "ciphervault-backend"}), 200

    # ---- error handlers ----
    @app.errorhandler(404)
    def not_found(_e):
        return jsonify({"error": "Route not found"}), 404

    @app.errorhandler(500)
    def server_error(_e):
        return jsonify({"error": "Something went wrong on the server"}), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=True, port=5000)
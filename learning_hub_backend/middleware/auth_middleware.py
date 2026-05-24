from functools import wraps
from flask import request, jsonify, current_app
import jwt
from db import get_db_connection

# ---------------------------------------
# JWT REQUIRED
# ---------------------------------------
def jwt_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")

        if not auth_header:
            return jsonify({"error": "Token missing"}), 401

        try:
            parts = auth_header.split()
            if len(parts) != 2 or parts[0].lower() != "bearer":
                return jsonify({"error": "Invalid authorization header"}), 401
            token = parts[1]

            payload = jwt.decode(
                token,
                current_app.config["SECRET_KEY"],
                algorithms=["HS256"]
            )

            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT role, semester_id, status, name FROM users WHERE id = %s", (payload["user_id"],))
            user = cur.fetchone()
            cur.close()
            conn.close()

            if not user:
                return jsonify({"error": "User not found"}), 401

            current_user = {
                "id": payload["user_id"],
                "role": user[0],
                "semester_id": user[1],
                "status": user[2],
                "name": user[3],
            }

            if current_user["status"] == "blocked":
                return jsonify({"error": "Your account is blocked. Contact admin."}), 403

        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid token"}), 401

        return f(current_user, *args, **kwargs)

    return decorated


# ---------------------------------------
# ROLE REQUIRED (ADMIN ONLY ETC)
# Supports one role or multiple roles.
# ---------------------------------------
def role_required(*roles):
    if len(roles) == 1 and isinstance(roles[0], (list, tuple, set)):
        allowed_roles = set(roles[0])
    else:
        allowed_roles = set(roles)

    def decorator(f):
        @wraps(f)
        def wrapper(current_user, *args, **kwargs):
            if current_user.get("role") not in allowed_roles:
                return jsonify({"error": "Forbidden"}), 403
            return f(current_user, *args, **kwargs)
        return wrapper
    return decorator

from flask import Blueprint, jsonify
from db import get_db_connection
from middleware.auth_middleware import jwt_required
from utils.authz import require_unit_access

units_bp = Blueprint("units", __name__)


@units_bp.route("/<int:course_id>", methods=["GET"])
@jwt_required
def get_units(current_user, course_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        allowed, context = require_unit_access(cur, current_user, course_id=course_id, require_enrollment=True)
        if not context:
            cur.close(); conn.close()
            return jsonify({"error": "Course not found"}), 404
        if not allowed:
            cur.close(); conn.close()
            return jsonify({"error": "Enroll in this course before opening its units"}), 403

        cur.execute("""
            SELECT id, title
            FROM units
            WHERE course_id = %s
            ORDER BY id
        """, (course_id,))
        units = [{"id": u[0], "title": u[1]} for u in cur.fetchall()]
        cur.close(); conn.close()
        return jsonify(units), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

from flask import Blueprint, jsonify, request
from db import get_db_connection
from middleware.auth_middleware import jwt_required, role_required

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/dashboard", methods=["GET"])
@jwt_required
@role_required("admin")
def admin_dashboard(current_user):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT COUNT(*) FROM users WHERE role = 'student';")
        total_students = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM users WHERE role = 'admin';")
        total_admins = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM users WHERE role = 'instructor';")
        total_instructors = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM users WHERE status = 'active';")
        total_active = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM users WHERE status = 'blocked';")
        total_blocked = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM courses;")
        total_courses = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM quiz_results;")
        total_quiz_attempts = cur.fetchone()[0]

        cur.execute("SELECT COUNT(*) FROM admin_requests WHERE status = 'pending';")
        pending_admin_requests = cur.fetchone()[0]

        cur.close()
        conn.close()

        return jsonify({
            "total_students": total_students,
            "total_admins": total_admins,
            "total_instructors": total_instructors,
            "total_active": total_active,
            "total_blocked": total_blocked,
            "total_courses": total_courses,
            "total_quiz_attempts": total_quiz_attempts,
            "pending_admin_requests": pending_admin_requests,
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/users", methods=["GET"])
@jwt_required
@role_required("admin")
def get_users(current_user):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT id, auth_id, name, email, phone, role, status, semester_id, created_at
            FROM users
            ORDER BY created_at DESC, id DESC
        """)

        users = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify([
            {
                "id": row[0],
                "auth_id": str(row[1]) if row[1] else None,
                "name": row[2],
                "email": row[3],
                "phone": row[4],
                "role": row[5],
                "status": row[6],
                "semester_id": row[7],
                "created_at": row[8].isoformat() if row[8] else None,
            }
            for row in users
        ]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/users/<int:user_id>/status", methods=["PUT"])
@jwt_required
@role_required("admin")
def update_user_status(current_user, user_id):
    try:
        data = request.get_json()
        status = data.get("status")

        if status not in ["active", "blocked"]:
            return jsonify({"error": "Status must be active or blocked"}), 400

        if user_id == current_user["id"]:
            return jsonify({"error": "You cannot block your own account"}), 403

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT id, role FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()

        if not user:
            cur.close()
            conn.close()
            return jsonify({"error": "User not found"}), 404

        if user[1] != "student":
            cur.close()
            conn.close()
            return jsonify({"error": "Admin can block/unblock student accounts only"}), 403

        cur.execute("UPDATE users SET status = %s WHERE id = %s", (status, user_id))
        conn.commit()

        cur.close()
        conn.close()

        return jsonify({"message": "User status updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@admin_bp.route("/admin-requests", methods=["GET"])
@jwt_required
@role_required("admin")
def get_admin_requests(current_user):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT ar.id,
                   ar.user_id,
                   u.name,
                   u.email,
                   ar.status,
                   ar.created_at,
                   ar.expires_at,
                   ar.reviewed_at,
                   ar.reviewed_by,
                   ar.reason
            FROM admin_requests ar
            JOIN users u ON u.id = ar.user_id
            ORDER BY ar.created_at DESC
            LIMIT 20
        """)

        rows = cur.fetchall()
        cur.close()
        conn.close()

        return jsonify([
            {
                "id": row[0],
                "user_id": row[1],
                "name": row[2],
                "email": row[3],
                "status": row[4],
                "created_at": row[5].isoformat() if row[5] else None,
                "expires_at": row[6].isoformat() if row[6] else None,
                "reviewed_at": row[7].isoformat() if row[7] else None,
                "reviewed_by": row[8],
                "reason": row[9],
            }
            for row in rows
        ]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

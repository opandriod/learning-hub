from flask import Blueprint, jsonify, request
from middleware.auth_middleware import jwt_required, role_required
from db import get_db_connection
from utils.authz import require_course_access, is_privileged

courses_bp = Blueprint("courses", __name__)


@courses_bp.route("", methods=["GET"])
@courses_bp.route("/", methods=["GET"])
@jwt_required
def get_courses(current_user):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        if is_privileged(current_user):
            cur.execute("""
                SELECT id, title, description, semester_id
                FROM courses
                ORDER BY semester_id, id
            """)
            rows = cur.fetchall()
        else:
            semester_id = current_user.get("semester_id")
            if not semester_id:
                cur.close(); conn.close()
                return jsonify([]), 200
            cur.execute("""
                SELECT id, title, description, semester_id
                FROM courses
                WHERE semester_id = %s
                ORDER BY id
            """, (semester_id,))
            rows = cur.fetchall()

        result = [{"id": r[0], "title": r[1], "description": r[2], "semester_id": r[3]} for r in rows]
        cur.close(); conn.close()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@courses_bp.route("/<int:course_id>", methods=["GET"])
@jwt_required
def get_course(current_user, course_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Course detail can be seen by students in their own semester, but unit/topic access below requires enrollment.
        allowed, course = require_course_access(cur, current_user, course_id, require_enrollment=False)
        cur.close(); conn.close()
        if not course:
            return jsonify({"error": "Course not found"}), 404
        if not allowed:
            return jsonify({"error": "Forbidden"}), 403
        return jsonify({"id": course[0], "title": course[1], "description": course[2], "semester_id": course[3]}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@courses_bp.route("/<int:course_id>/enroll", methods=["POST"])
@jwt_required
def enroll_course(current_user, course_id):
    user_id = current_user["id"]
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Students may enroll only in courses from their own semester. Admin/instructor can bypass if needed.
        allowed, course = require_course_access(cur, current_user, course_id, require_enrollment=False)
        if not course:
            cur.close(); conn.close()
            return jsonify({"error": "Course not found"}), 404
        if not allowed:
            cur.close(); conn.close()
            return jsonify({"error": "You cannot enroll in a course outside your semester"}), 403

        cur.execute("""
            SELECT id FROM enrollments
            WHERE student_id = %s AND course_id = %s
        """, (user_id, course_id))
        if cur.fetchone():
            cur.close(); conn.close()
            return jsonify({"message": "Already enrolled"}), 200

        cur.execute("""
            INSERT INTO enrollments (student_id, course_id)
            VALUES (%s, %s)
        """, (user_id, course_id))
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"message": "Enrolled successfully"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@courses_bp.route("/<int:course_id>/status", methods=["GET"])
@jwt_required
def check_enrollment(current_user, course_id):
    user_id = current_user["id"]
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        allowed, course = require_course_access(cur, current_user, course_id, require_enrollment=False)
        if not course:
            cur.close(); conn.close()
            return jsonify({"error": "Course not found"}), 404
        if not allowed:
            cur.close(); conn.close()
            return jsonify({"enrolled": False}), 200
        cur.execute("""
            SELECT id FROM enrollments
            WHERE student_id = %s AND course_id = %s
        """, (user_id, course_id))
        enrolled = cur.fetchone() is not None
        cur.close(); conn.close()
        return jsonify({"enrolled": enrolled}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@courses_bp.route("", methods=["POST"])
@courses_bp.route("/", methods=["POST"])
@jwt_required
@role_required("admin")
def create_course(current_user):
    try:
        data = request.get_json() or {}
        title = data.get("title")
        description = data.get("description")
        semester_id = data.get("semester_id")
        if not title or not semester_id:
            return jsonify({"error": "Title and semester required"}), 400
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("""
            INSERT INTO courses (title, description, semester_id)
            VALUES (%s, %s, %s)
            RETURNING id
        """, (title, description, semester_id))
        course_id = cur.fetchone()[0]
        conn.commit(); cur.close(); conn.close()
        return jsonify({"message": "Course created", "course_id": course_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@courses_bp.route("/<int:course_id>", methods=["DELETE"])
@jwt_required
@role_required("admin")
def delete_course(current_user, course_id):
    try:
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute("SELECT id FROM courses WHERE id = %s", (course_id,))
        if not cur.fetchone():
            cur.close(); conn.close()
            return jsonify({"error": "Course not found"}), 404
        cur.execute("DELETE FROM courses WHERE id = %s", (course_id,))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"message": "Course deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

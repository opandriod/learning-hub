from flask import Blueprint, jsonify, request
from middleware.auth_middleware import jwt_required, role_required
from db import get_db_connection

progress_bp = Blueprint("progress", __name__)


# 📌 Initialize progress after enrollment
@progress_bp.route("/init/<int:enrollment_id>", methods=["POST"])
@jwt_required
@role_required("student")
def initialize_progress(current_user, enrollment_id):

    conn = get_db_connection()
    cur = conn.cursor()

    # Check if enrollment exists and belongs to the logged-in student.
    cur.execute("SELECT id FROM enrollments WHERE id = %s AND student_id = %s;", (enrollment_id, current_user["id"]))
    enrollment = cur.fetchone()

    if not enrollment:
        cur.close()
        conn.close()
        return jsonify({"error": "Enrollment not found"}), 404

    # Prevent duplicate progress record
    cur.execute("SELECT id FROM progress WHERE enrollment_id = %s;", (enrollment_id,))
    existing = cur.fetchone()

    if existing:
        cur.close()
        conn.close()
        return jsonify({"error": "Progress already initialized"}), 400

    # Create progress record
    cur.execute("""
        INSERT INTO progress (enrollment_id)
        VALUES (%s)
        RETURNING id;
    """, (enrollment_id,))

    progress_id = cur.fetchone()[0]
    conn.commit()

    cur.close()
    conn.close()

    return jsonify({
        "message": "Progress initialized",
        "progress_id": progress_id
    }), 201


# 📌 Update progress
@progress_bp.route("/update/<int:enrollment_id>", methods=["PUT"])
@jwt_required
@role_required("student")
def update_progress(current_user, enrollment_id):

    data = request.get_json()
    percentage = data.get("completion_percentage")

    if percentage is None or not (0 <= percentage <= 100):
        return jsonify({"error": "Completion percentage must be between 0 and 100"}), 400

    completed = percentage == 100

    conn = get_db_connection()
    cur = conn.cursor()

    # Update only progress rows for an enrollment owned by the logged-in student.
    cur.execute("""
        UPDATE progress p
        SET completion_percentage = %s,
            completed = %s,
            last_updated = CURRENT_TIMESTAMP
        FROM enrollments e
        WHERE p.enrollment_id = e.id
          AND p.enrollment_id = %s
          AND e.student_id = %s
        RETURNING p.id;
    """, (percentage, completed, enrollment_id, current_user["id"]))

    updated = cur.fetchone()

    conn.commit()
    cur.close()
    conn.close()

    if not updated:
        return jsonify({"error": "Progress not found"}), 404

    return jsonify({
        "message": "Progress updated",
        "completion_percentage": percentage,
        "completed": completed
    }), 200
def calculate_and_update_progress(user_id, course_id):

    conn = get_db_connection()
    cur = conn.cursor()

    # total lessons
    cur.execute("""
    SELECT COUNT(*)
    FROM lessons
    WHERE course_id = %s
    """, (course_id,))
    total_lessons = cur.fetchone()[0]

    # completed lessons
    cur.execute("""
    SELECT COUNT(*)
    FROM lesson_completions lc
    JOIN lessons l ON lc.lesson_id = l.id
    WHERE lc.user_id = %s
    AND l.course_id = %s
    """, (user_id, course_id))

    completed_lessons = cur.fetchone()[0]

    if total_lessons == 0:
        progress = 0
    else:
        progress = int((completed_lessons / total_lessons) * 100)

    cur.close()
    conn.close()

    return progress
@progress_bp.route("/course/<int:course_id>", methods=["GET"])
@jwt_required
@role_required("student")
def get_course_progress(current_user, course_id):

    user_id = current_user["id"]

    conn = get_db_connection()
    cur = conn.cursor()

    # 1️⃣ Check enrollment
    cur.execute("""
        SELECT id FROM enrollments
        WHERE student_id = %s AND course_id = %s
    """, (user_id, course_id))

    enrollment = cur.fetchone()

    if not enrollment:
        cur.close()
        conn.close()
        return jsonify({"error": "You are not enrolled in this course"}), 403

    # 2️⃣ Count total lessons
    cur.execute("""
        SELECT COUNT(*)
        FROM lessons
        WHERE course_id = %s
    """, (course_id,))

    total_lessons = cur.fetchone()[0]

    # 3️⃣ Count completed lessons
    cur.execute("""
        SELECT COUNT(*)
        FROM lesson_completions lc
        JOIN lessons l ON lc.lesson_id = l.id
        WHERE lc.user_id = %s
        AND l.course_id = %s
    """, (user_id, course_id))

    completed_lessons = cur.fetchone()[0]

    # 4️⃣ Calculate progress
    if total_lessons == 0:
        progress_percentage = 0
    else:
        progress_percentage = int((completed_lessons / total_lessons) * 100)

    cur.close()
    conn.close()

    return jsonify({
        "course_id": course_id,
        "completed_lessons": completed_lessons,
        "total_lessons": total_lessons,
        "progress_percentage": progress_percentage
    })
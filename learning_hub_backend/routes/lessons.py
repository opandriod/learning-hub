from flask import Blueprint, jsonify
from db import get_db_connection
from middleware.auth_middleware import jwt_required
from routes.progress import calculate_and_update_progress

lessons_bp = Blueprint("lessons", __name__)


# -------------------------------------------------
# Complete Lesson
# POST /lessons/<lesson_id>/complete
# -------------------------------------------------
@lessons_bp.route("/<int:lesson_id>/complete", methods=["POST"])
@jwt_required
def complete_lesson(current_user, lesson_id):

    user_id = current_user["id"]

    conn = get_db_connection()
    cur = conn.cursor()

    # 1️⃣ Get lesson info
    cur.execute(
        "SELECT course_id FROM lessons WHERE id = %s",
        (lesson_id,)
    )
    lesson = cur.fetchone()

    if not lesson:
        cur.close()
        conn.close()
        return jsonify({"error": "Lesson not found"}), 404

    course_id = lesson[0]

    # 2️⃣ Check enrollment
    cur.execute("""
        SELECT id FROM enrollments
        WHERE student_id = %s AND course_id = %s
    """, (user_id, course_id))

    enrollment = cur.fetchone()

    if not enrollment:
        cur.close()
        conn.close()
        return jsonify({"error": "You are not enrolled in this course"}), 403

    # 3️⃣ Prevent duplicate completion
    cur.execute("""
        SELECT id FROM lesson_completions
        WHERE user_id = %s AND lesson_id = %s
    """, (user_id, lesson_id))

    already_completed = cur.fetchone()

    if already_completed:
        cur.close()
        conn.close()
        return jsonify({"message": "Lesson already completed"}), 200

    # 4️⃣ Insert completion
    cur.execute("""
        INSERT INTO lesson_completions (user_id, lesson_id)
        VALUES (%s, %s)
    """, (user_id, lesson_id))

    conn.commit()

    # 5️⃣ Update progress
    progress = calculate_and_update_progress(user_id, course_id)

    cur.close()
    conn.close()

    return jsonify({
        "message": "Lesson marked as completed",
        "progress": progress
    })


# -------------------------------------------------
# Get Lessons of a Course
# GET /lessons/<course_id>/lessons
# -------------------------------------------------
@lessons_bp.route("/<int:course_id>/lessons", methods=["GET"])
@jwt_required
def get_course_lessons(current_user, course_id):

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

    # 2️⃣ Get lessons
    cur.execute("""
        SELECT id, title
        FROM lessons
        WHERE course_id = %s
        ORDER BY id
    """, (course_id,))

    lessons = cur.fetchall()

    result = []

    for lesson in lessons:
        lesson_id, title = lesson

        # 3️⃣ Check if completed
        cur.execute("""
            SELECT id FROM lesson_completions
            WHERE user_id = %s AND lesson_id = %s
        """, (user_id, lesson_id))

        completed = cur.fetchone() is not None

        result.append({
            "id": lesson_id,
            "title": title,
            "completed": completed
        })

    cur.close()
    conn.close()

    return jsonify(result)
@lessons_bp.route("/<int:lesson_id>", methods=["GET"])
@jwt_required
def get_lesson(current_user, lesson_id):

    user_id = current_user["id"]

    conn = get_db_connection()
    cur = conn.cursor()

    # Get lesson
    cur.execute("""
        SELECT id, course_id, title, content_text, video_url, audio_url
        FROM lessons
        WHERE id = %s
    """, (lesson_id,))

    lesson = cur.fetchone()

    if not lesson:
        cur.close()
        conn.close()
        return jsonify({"error": "Lesson not found"}), 404

    lesson_id, course_id, title, content_text, video_url, audio_url = lesson

    # Check enrollment
    cur.execute("""
        SELECT id FROM enrollments
        WHERE student_id = %s AND course_id = %s
    """, (user_id, course_id))

    enrollment = cur.fetchone()

    if not enrollment:
        cur.close()
        conn.close()
        return jsonify({"error": "You are not enrolled in this course"}), 403

    cur.close()
    conn.close()

    return jsonify({
        "id": lesson_id,
        "title": title,
        "content_text": content_text,
        "video_url": video_url,
        "audio_url": audio_url
    })
from flask import request
from middleware.auth_middleware import role_required


@lessons_bp.route("/courses/<int:course_id>/lessons", methods=["POST"])
@jwt_required
@role_required("admin")
def create_lesson(current_user, course_id):

    data = request.get_json()

    title = data.get("title")
    content_text = data.get("content_text")
    video_url = data.get("video_url")
    audio_url = data.get("audio_url")

    if not title:
        return jsonify({"error": "Lesson title is required"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    # Check if course exists
    cur.execute("""
        SELECT id FROM courses
        WHERE id = %s
    """, (course_id,))

    course = cur.fetchone()

    if not course:
        cur.close()
        conn.close()
        return jsonify({"error": "Course not found"}), 404

    # Insert lesson
    cur.execute("""
        INSERT INTO lessons (course_id, title, content_text, video_url, audio_url)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
    """, (course_id, title, content_text, video_url, audio_url))

    lesson_id = cur.fetchone()[0]

    conn.commit()

    cur.close()
    conn.close()

    return jsonify({
        "message": "Lesson created successfully",
        "lesson_id": lesson_id
    }), 201
from middleware.auth_middleware import role_required


@lessons_bp.route("/<int:lesson_id>", methods=["DELETE"])
@jwt_required
@role_required("admin")
def delete_lesson(current_user, lesson_id):

    conn = get_db_connection()
    cur = conn.cursor()

    # Check if lesson exists
    cur.execute("""
        SELECT id, title
        FROM lessons
        WHERE id = %s
    """, (lesson_id,))

    lesson = cur.fetchone()

    if not lesson:
        cur.close()
        conn.close()
        return jsonify({"error": "Lesson not found"}), 404

    lesson_id, title = lesson

    # Delete lesson completions first (to avoid foreign key errors)
    cur.execute("""
        DELETE FROM lesson_completions
        WHERE lesson_id = %s
    """, (lesson_id,))

    # Delete lesson
    cur.execute("""
        DELETE FROM lessons
        WHERE id = %s
    """, (lesson_id,))

    conn.commit()

    cur.close()
    conn.close()

    return jsonify({
        "message": "Lesson deleted successfully",
        "lesson_id": lesson_id,
        "title": title
    })
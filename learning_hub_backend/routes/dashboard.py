from flask import Blueprint, jsonify
from db import get_db_connection
from middleware.auth_middleware import jwt_required, role_required

# Student dashboard data.
# This version uses the new Mini Topic Quiz progress system:
# - total_topics comes from public.topics
# - progress comes from public.topic_progress
# - progress can be > 0 even if the topic is not fully completed yet

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.route("/student", methods=["GET"])
@jwt_required
@role_required("student", "sub_admin", "admin", "instructor")
def student_dashboard(current_user):
    user_id = current_user["id"]
    semester_id = current_user.get("semester_id")

    conn = get_db_connection()
    cur = conn.cursor()

    # Keep the enrolment based course list, but calculate progress from topics.
    # A topic contributes its saved progress_percent. Unattempted topics count as 0.
    # Example: 1 topic at 40% out of 13 topics => about 3% course progress.
    cur.execute(
        """
        SELECT
            c.id AS course_id,
            c.title AS course_title,
            c.semester_id AS semester_id,
            COUNT(DISTINCT t.id) AS total_topics,
            COUNT(DISTINCT CASE WHEN tp.status = 'completed' THEN tp.topic_id END) AS completed_topics,
            COUNT(DISTINCT tp.topic_id) AS attempted_topics,
            COALESCE(ROUND(SUM(COALESCE(tp.progress_percent, 0)) / NULLIF(COUNT(DISTINCT t.id), 0)), 0) AS progress
        FROM enrollments e
        JOIN courses c ON c.id = e.course_id
        LEFT JOIN units u ON u.course_id = c.id
        LEFT JOIN topics t ON t.unit_id = u.id
        LEFT JOIN topic_progress tp
            ON tp.topic_id = t.id
           AND tp.user_id = %s
        WHERE e.student_id = %s
          AND (%s IS NULL OR c.semester_id = %s)
        GROUP BY c.id, c.title, c.semester_id
        ORDER BY c.title;
        """,
        (user_id, user_id, semester_id, semester_id),
    )

    rows = cur.fetchall()
    cur.close()
    conn.close()

    result = []
    for row in rows:
        (
            course_id,
            course_title,
            semester_id,
            total_topics,
            completed_topics,
            attempted_topics,
            progress,
        ) = row

        total_topics = int(total_topics or 0)
        completed_topics = int(completed_topics or 0)
        attempted_topics = int(attempted_topics or 0)
        progress = int(progress or 0)

        result.append(
            {
                "course_id": course_id,
                "course_title": course_title,
                "semester_id": semester_id,
                "total_topics": total_topics,
                "completed_topics": completed_topics,
                "attempted_topics": attempted_topics,
                "progress": progress,
                # Backward-compatible keys used by older Dashboard.jsx code.
                "total_lessons": total_topics,
                "completed_lessons": completed_topics,
            }
        )

    return jsonify(result)

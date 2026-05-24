from flask import Blueprint, jsonify, request
from db import get_db_connection
from middleware.auth_middleware import jwt_required

leaderboard_bp = Blueprint("leaderboard", __name__)

IST_TIMEZONE = "Asia/Kolkata"
RETENTION_INTERVAL = "3 months"
VALID_TIMEFRAMES = {"today", "week", "month"}


def _ensure_profile_photo_column(cur):
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT")


def _cleanup_old_attempts(cur):
    """Keep the quiz result table small by deleting old saved attempts."""
    cur.execute(
        f"""
        DELETE FROM quiz_mode_attempts
        WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '{RETENTION_INTERVAL}'
        """
    )


def _normalize_semester_filter(value):
    if value in (None, "", "all", "All", "ALL"):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _timeframe_condition(timeframe):
    if timeframe == "today":
        return f"qma.attempt_date_ist = (CURRENT_TIMESTAMP AT TIME ZONE '{IST_TIMEZONE}')::date"
    if timeframe == "week":
        return f"qma.week_start_ist = date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE '{IST_TIMEZONE}')::date"
    return f"qma.month_start_ist = date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE '{IST_TIMEZONE}')::date"


@leaderboard_bp.route("/semesters", methods=["GET"])
@jwt_required
def get_leaderboard_semesters(current_user):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT id, name FROM semesters ORDER BY id")
        semesters = [{"id": row[0], "name": row[1]} for row in cur.fetchall()]

        cur.close()
        conn.close()

        return jsonify(semesters), 200
    except Exception as e:
        print("GET LEADERBOARD SEMESTERS ERROR:", e)
        return jsonify({"error": str(e)}), 500


@leaderboard_bp.route("", methods=["GET"])
@leaderboard_bp.route("/", methods=["GET"])
@jwt_required
def get_leaderboard(current_user):
    try:
        timeframe = (request.args.get("timeframe") or "today").lower()
        semester_id = _normalize_semester_filter(request.args.get("semester_id"))

        if timeframe not in VALID_TIMEFRAMES:
            return jsonify({"error": "Invalid timeframe. Use today, week, or month."}), 400

        conn = get_db_connection()
        cur = conn.cursor()

        _ensure_profile_photo_column(cur)
        _cleanup_old_attempts(cur)

        where_parts = ["qma.mode = 'daily'", _timeframe_condition(timeframe)]
        params = []

        if semester_id is not None:
            where_parts.append("u.semester_id = %s")
            params.append(semester_id)

        where_clause = " AND ".join(where_parts)

        cur.execute(
            f"""
            WITH user_scores AS (
                SELECT
                    u.id AS user_id,
                    u.name AS user_name,
                    u.profile_photo,
                    u.semester_id,
                    COALESCE(s.name, CONCAT('Semester ', u.semester_id)) AS semester_name,
                    SUM(qma.score_points) AS total_points,
                    SUM(qma.correct_count) AS total_correct,
                    SUM(qma.incorrect_count) AS total_incorrect,
                    SUM(qma.not_attempted_count) AS total_not_attempted,
                    COUNT(qma.id) AS attempts,
                    MAX(qma.created_at) AS last_attempt_at
                FROM quiz_mode_attempts qma
                JOIN users u ON u.id = qma.user_id
                LEFT JOIN semesters s ON s.id = u.semester_id
                WHERE {where_clause}
                GROUP BY u.id, u.name, u.profile_photo, u.semester_id, s.name
            )
            SELECT
                RANK() OVER (ORDER BY total_points DESC, total_correct DESC, last_attempt_at ASC) AS rank,
                user_id,
                user_name,
                profile_photo,
                semester_id,
                semester_name,
                total_points,
                total_correct,
                total_incorrect,
                total_not_attempted,
                attempts,
                last_attempt_at
            FROM user_scores
            ORDER BY rank, user_name
            LIMIT 100
            """,
            tuple(params),
        )

        rows = cur.fetchall()
        conn.commit()
        cur.close()
        conn.close()

        rankings = []
        for row in rows:
            rankings.append(
                {
                    "rank": row[0],
                    "user_id": row[1],
                    "name": row[2],
                    "profile_photo": row[3] or "",
                    "semester_id": row[4],
                    "semester_name": row[5],
                    "points": row[6],
                    "correct": row[7],
                    "incorrect": row[8],
                    "not_attempted": row[9],
                    "attempts": row[10],
                    "last_attempt_at": row[11].isoformat() if row[11] else None,
                }
            )

        return jsonify({"timeframe": timeframe, "semester_id": semester_id or "all", "rankings": rankings}), 200

    except Exception as e:
        print("GET LEADERBOARD ERROR:", e)
        return jsonify({"error": str(e)}), 500


@leaderboard_bp.route("/past-month-top3", methods=["GET"])
@jwt_required
def get_past_month_top3(current_user):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        _ensure_profile_photo_column(cur)
        _cleanup_old_attempts(cur)

        cur.execute(
            """
            WITH previous_month AS (
                SELECT
                    date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE %s)::date AS current_month_start,
                    (date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE %s)::date - INTERVAL '1 month')::date AS previous_month_start
            ), user_scores AS (
                SELECT
                    u.id AS user_id,
                    u.name AS user_name,
                    u.profile_photo,
                    SUM(qma.score_points) AS total_points,
                    SUM(qma.correct_count) AS total_correct,
                    MAX(qma.created_at) AS last_attempt_at
                FROM quiz_mode_attempts qma
                JOIN users u ON u.id = qma.user_id
                CROSS JOIN previous_month pm
                WHERE qma.mode = 'daily'
                  AND qma.attempt_date_ist >= pm.previous_month_start
                  AND qma.attempt_date_ist < pm.current_month_start
                GROUP BY u.id, u.name, u.profile_photo
            )
            SELECT user_name, profile_photo
            FROM user_scores
            ORDER BY total_points DESC, total_correct DESC, last_attempt_at ASC, user_name ASC
            LIMIT 3
            """,
            (IST_TIMEZONE, IST_TIMEZONE),
        )

        names = [{"name": row[0], "profile_photo": row[1] or ""} for row in cur.fetchall()]
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"top3": names}), 200

    except Exception as e:
        print("GET PAST MONTH TOP 3 ERROR:", e)
        return jsonify({"error": str(e)}), 500

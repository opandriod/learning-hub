from flask import Blueprint, request, jsonify
from db import get_db_connection
from middleware.auth_middleware import jwt_required
from utils.authz import require_topic_access

questions_bp = Blueprint("questions", __name__)

DAILY_QUESTION_COUNT = 30
DAILY_TIME_SECONDS = 600
RAPID_FETCH_LIMIT = 200
IST_TIMEZONE = "Asia/Kolkata"
RETENTION_INTERVAL = "3 months"


def _cleanup_old_attempts(cur):
    cur.execute(
        f"""
        DELETE FROM quiz_mode_attempts
        WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '{RETENTION_INTERVAL}'
        """
    )


def _fetch_daily_cooldown(cur, user_id):
    cur.execute(
        """
        SELECT created_at,
               EXTRACT(EPOCH FROM ((created_at + INTERVAL '24 hours') - CURRENT_TIMESTAMP))::integer AS seconds_remaining
        FROM quiz_mode_attempts
        WHERE user_id = %s
          AND mode = 'daily'
          AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (user_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return {"last_attempt_at": row[0], "seconds_remaining": max(row[1] or 0, 0)}


def _fetch_user_semester(cur, user_id):
    cur.execute("SELECT semester_id FROM users WHERE id = %s", (user_id,))
    row = cur.fetchone()
    return row[0] if row else None


def _normalize_filter(value):
    if value in (None, "", "all", "All", "ALL"):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _build_question_payload(rows, include_correct=False):
    payload = []
    for row in rows:
        item = {
            "id": row[0],
            "question": row[1],
            "options": [row[2], row[3], row[4], row[5]],
        }
        # Correct answers must not be sent to the browser during quiz start.
        # Only use include_correct=True for admin/debug-only code, never student quiz APIs.
        if include_correct:
            correct_value = row[6]
            if isinstance(correct_value, str):
                correct_index = {"A": 0, "B": 1, "C": 2, "D": 3}.get(correct_value.strip().upper(), None)
            elif isinstance(correct_value, int):
                correct_index = correct_value - 1
            else:
                correct_index = None
            item["correct_answer"] = correct_index
        payload.append(item)
    return payload

def _fetch_standard_questions(cur, semester_id, course_id=None, unit_id=None, limit=None):
    query = """
        SELECT qq.id, qq.question_text, qq.option_a, qq.option_b, qq.option_c, qq.option_d, qq.correct_option
        FROM quiz_questions_new qq
        JOIN courses c ON qq.course_id = c.id
        LEFT JOIN units u ON qq.unit_id = u.id
        WHERE c.semester_id = %s
          AND lower(c.title) NOT LIKE %s
          AND lower(c.title) NOT LIKE %s
    """
    params = [semester_id, "%minor project%", "%major project%"]

    if course_id is not None:
        query += " AND qq.course_id = %s"
        params.append(course_id)

    if unit_id is not None:
        query += " AND qq.unit_id = %s"
        params.append(unit_id)

    query += " ORDER BY RANDOM()"

    if limit is not None:
        query += " LIMIT %s"
        params.append(limit)

    cur.execute(query, tuple(params))
    return _build_question_payload(cur.fetchall())


def _fetch_daily_questions(cur, semester_id, course_id=None, unit_id=None, limit=None):
    query = """
        SELECT dq.id, dq.question_text, dq.option_a, dq.option_b, dq.option_c, dq.option_d, dq.correct_option
        FROM daily_quiz_questions dq
        JOIN courses c ON dq.course_id = c.id
        LEFT JOIN units u ON dq.unit_id = u.id
        WHERE c.semester_id = %s
          AND lower(c.title) NOT LIKE %s
          AND lower(c.title) NOT LIKE %s
    """
    params = [semester_id, "%minor project%", "%major project%"]

    if course_id is not None:
        query += " AND dq.course_id = %s"
        params.append(course_id)

    if unit_id is not None:
        query += " AND dq.unit_id = %s"
        params.append(unit_id)

    query += " ORDER BY RANDOM()"

    if limit is not None:
        query += " LIMIT %s"
        params.append(limit)

    cur.execute(query, tuple(params))
    return _build_question_payload(cur.fetchall())


def _get_correct_answer_map(cur, question_ids, mode):
    if not question_ids:
        return {}

    placeholders = ",".join(["%s"] * len(question_ids))

    if mode == "daily":
        cur.execute(
            f"""
            SELECT id, option_a, option_b, option_c, option_d, correct_option
            FROM daily_quiz_questions
            WHERE id IN ({placeholders})
            """,
            tuple(question_ids),
        )
    else:
        cur.execute(
            f"""
            SELECT id, option_a, option_b, option_c, option_d, correct_option
            FROM quiz_questions_new
            WHERE id IN ({placeholders})
            """,
            tuple(question_ids),
        )

    rows = cur.fetchall()
    answer_map = {}
    option_index_map = {"A": 0, "B": 1, "C": 2, "D": 3}
    for row in rows:
        options = [row[1], row[2], row[3], row[4]]
        correct_value = row[5]
        if isinstance(correct_value, str):
            correct_index = option_index_map.get(correct_value.strip().upper(), None)
        elif isinstance(correct_value, int):
            correct_index = correct_value - 1
        else:
            correct_index = None

        if correct_index is not None and 0 <= correct_index < len(options):
            answer_map[row[0]] = options[correct_index]
    return answer_map


@questions_bp.route("/topic/<int:topic_id>", methods=["GET"])
@jwt_required
def get_questions(current_user, topic_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        allowed, context = require_topic_access(cur, current_user, topic_id, require_enrollment=True)
        if not context:
            cur.close()
            conn.close()
            return jsonify({"error": "Topic not found"}), 404
        if not allowed:
            cur.close()
            conn.close()
            return jsonify({"error": "Forbidden"}), 403

        cur.execute(
            """
            SELECT id, question, option_a, option_b, option_c, option_d, correct_answer
            FROM questions
            WHERE topic_id = %s
            ORDER BY id
            """,
            (topic_id,),
        )

        questions = _build_question_payload(cur.fetchall())

        cur.close()
        conn.close()

        return jsonify(questions)

    except Exception as e:
        print("GET QUESTIONS ERROR:", e)
        return jsonify({"error": str(e)}), 500



@questions_bp.route("/quiz/daily-status", methods=["GET"])
@jwt_required
def get_daily_quiz_status(current_user):
    try:
        user_id = current_user.get("id") or current_user.get("user_id")
        if not user_id:
            return jsonify({"error": "User not found"}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        _cleanup_old_attempts(cur)
        cooldown = _fetch_daily_cooldown(cur, user_id)
        conn.commit()
        cur.close()
        conn.close()

        if cooldown:
            return jsonify({
                "available": False,
                "seconds_remaining": cooldown["seconds_remaining"],
                "last_attempt_at": cooldown["last_attempt_at"].isoformat() if cooldown["last_attempt_at"] else None,
            }), 200

        return jsonify({"available": True, "seconds_remaining": 0, "last_attempt_at": None}), 200

    except Exception as e:
        print("DAILY QUIZ STATUS ERROR:", e)
        return jsonify({"error": str(e)}), 500
@questions_bp.route("/quiz/start", methods=["POST"])
@jwt_required
def start_quiz(current_user):
    try:
        data = request.get_json() or {}
        mode = (data.get("mode") or "normal").lower()
        course_id = _normalize_filter(data.get("course_id"))
        unit_id = _normalize_filter(data.get("unit_id"))
        requested_count = data.get("question_count")
        rapid_time_seconds = data.get("time_seconds")

        user_id = current_user.get("id") or current_user.get("user_id")
        if not user_id:
            return jsonify({"error": "User not found"}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        _cleanup_old_attempts(cur)

        semester_id = _fetch_user_semester(cur, user_id)
        if not semester_id:
            cur.close()
            conn.close()
            return jsonify({"error": "Please set your semester in profile first"}), 400

        if mode not in ["normal", "rapid", "daily"]:
            cur.close()
            conn.close()
            return jsonify({"error": "Invalid quiz mode"}), 400

        if mode == "daily":
            # Daily Quiz must always use all subjects and all units from the user's semester.
            # Ignore any subject/unit values sent from the frontend or a manual API call.
            course_id = None
            unit_id = None

        if course_id is None:
            unit_id = None

        if course_id is not None:
            cur.execute(
                """
                SELECT id, title
                FROM courses
                WHERE id = %s AND semester_id = %s
                """,
                (course_id, semester_id),
            )
            course_row = cur.fetchone()
            if not course_row:
                cur.close()
                conn.close()
                return jsonify({"error": "Invalid subject for your semester"}), 400

            course_title = str(course_row[1] or "").lower()
            if "minor project" in course_title or "major project" in course_title:
                cur.close()
                conn.close()
                return jsonify({"error": "Minor Project and Major Project are project papers, not quiz subjects."}), 400

        if unit_id is not None:
            cur.execute(
                """
                SELECT u.id
                FROM units u
                JOIN courses c ON u.course_id = c.id
                WHERE u.id = %s AND c.semester_id = %s AND (%s IS NULL OR c.id = %s)
                """,
                (unit_id, semester_id, course_id, course_id),
            )
            if not cur.fetchone():
                cur.close()
                conn.close()
                return jsonify({"error": "Invalid unit for the selected subject"}), 400

        if mode == "daily":
            # Daily Quiz results should represent the user's whole semester, not a selected subject/unit.
            course_id = None
            unit_id = None
            time_limit_seconds = DAILY_TIME_SECONDS
            cooldown = _fetch_daily_cooldown(cur, user_id)
            if cooldown:
                cur.close()
                conn.close()
                return jsonify({
                    "error": "You can attempt the daily quiz only once every 24 hours",
                    "seconds_remaining": cooldown["seconds_remaining"],
                    "last_attempt_at": cooldown["last_attempt_at"].isoformat() if cooldown["last_attempt_at"] else None,
                }), 429

            questions = _fetch_daily_questions(
                cur,
                semester_id=semester_id,
                course_id=None,
                unit_id=None,
                limit=DAILY_QUESTION_COUNT,
            )
            total_questions = DAILY_QUESTION_COUNT
            time_limit_seconds = DAILY_TIME_SECONDS
        elif mode == "rapid":
            time_limit_seconds = int(rapid_time_seconds or 30)
            questions = _fetch_standard_questions(
                cur,
                semester_id=semester_id,
                course_id=course_id,
                unit_id=unit_id,
                limit=RAPID_FETCH_LIMIT,
            )
            total_questions = None
        else:
            total_questions = int(requested_count or 10)
            time_limit_seconds = None
            questions = _fetch_standard_questions(
                cur,
                semester_id=semester_id,
                course_id=course_id,
                unit_id=unit_id,
                limit=total_questions,
            )

        conn.commit()
        cur.close()
        conn.close()

        if not questions:
            return jsonify({"error": f"No {mode} quiz questions found for this selection"}), 404

        return jsonify(
            {
                "mode": mode,
                "course_id": course_id,
                "unit_id": unit_id,
                "questions": questions,
                "time_limit_seconds": time_limit_seconds,
                "question_count": total_questions,
                "daily_points": {"correct": 4, "incorrect": -1} if mode == "daily" else None,
            }
        )

    except Exception as e:
        print("START QUIZ ERROR:", e)
        return jsonify({"error": str(e)}), 500


@questions_bp.route("/quiz/submit", methods=["POST"])
@jwt_required
def submit_mode_quiz(current_user):
    try:
        data = request.get_json() or {}
        mode = (data.get("mode") or "normal").lower()
        course_id = _normalize_filter(data.get("course_id"))
        unit_id = _normalize_filter(data.get("unit_id"))
        answers = data.get("answers") or {}
        presented_question_ids = data.get("presented_question_ids") or []
        time_limit_seconds = data.get("time_limit_seconds")

        user_id = current_user.get("id") or current_user.get("user_id")
        if not user_id:
            return jsonify({"error": "User not found"}), 400

        question_ids = []
        seen = set()
        for item in presented_question_ids:
            try:
                qid = int(item)
            except (TypeError, ValueError):
                continue
            if qid not in seen:
                seen.add(qid)
                question_ids.append(qid)

        if not question_ids:
            return jsonify({"error": "No quiz questions submitted"}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        _cleanup_old_attempts(cur)

        if mode == "daily":
            # Daily Quiz results should represent the users whole semester, not a selected subject/unit.
            course_id = None
            unit_id = None
            time_limit_seconds = DAILY_TIME_SECONDS
            cooldown = _fetch_daily_cooldown(cur, user_id)
            if cooldown:
                cur.close()
                conn.close()
                return jsonify({
                    "error": "You can submit the daily quiz only once every 24 hours",
                    "seconds_remaining": cooldown["seconds_remaining"],
                    "last_attempt_at": cooldown["last_attempt_at"].isoformat() if cooldown["last_attempt_at"] else None,
                }), 429


        semester_id = _fetch_user_semester(cur, user_id)
        if not semester_id:
            cur.close()
            conn.close()
            return jsonify({"error": "Please set your semester in profile first"}), 400

        if mode not in ["normal", "rapid", "daily"]:
            cur.close()
            conn.close()
            return jsonify({"error": "Invalid quiz mode"}), 400

        if mode != "daily":
            if course_id is not None:
                cur.execute("SELECT id FROM courses WHERE id = %s AND semester_id = %s", (course_id, semester_id))
                if not cur.fetchone():
                    cur.close()
                    conn.close()
                    return jsonify({"error": "Invalid subject for your semester"}), 403
            if unit_id is not None:
                cur.execute("""
                    SELECT u.id
                    FROM units u
                    JOIN courses c ON c.id = u.course_id
                    WHERE u.id = %s AND c.semester_id = %s AND (%s IS NULL OR c.id = %s)
                """, (unit_id, semester_id, course_id, course_id))
                if not cur.fetchone():
                    cur.close()
                    conn.close()
                    return jsonify({"error": "Invalid unit for your semester/subject"}), 403

        # Ensure submitted question IDs belong to the logged-in user's allowed semester/selection.
        placeholders = ",".join(["%s"] * len(question_ids))
        if mode == "daily":
            cur.execute(f"""
                SELECT dq.id
                FROM daily_quiz_questions dq
                JOIN courses c ON c.id = dq.course_id
                WHERE dq.id IN ({placeholders}) AND c.semester_id = %s
            """, tuple(question_ids + [semester_id]))
        else:
            query = f"""
                SELECT qq.id
                FROM quiz_questions_new qq
                JOIN courses c ON c.id = qq.course_id
                WHERE qq.id IN ({placeholders}) AND c.semester_id = %s
            """
            params = question_ids + [semester_id]
            if course_id is not None:
                query += " AND qq.course_id = %s"
                params.append(course_id)
            if unit_id is not None:
                query += " AND qq.unit_id = %s"
                params.append(unit_id)
            cur.execute(query, tuple(params))
        valid_ids = {row[0] for row in cur.fetchall()}
        if valid_ids != set(question_ids):
            cur.close()
            conn.close()
            return jsonify({"error": "Submitted questions are not valid for your semester/selection"}), 403

        correct_map = _get_correct_answer_map(cur, question_ids, mode)

        attempted = 0
        correct = 0
        incorrect = 0

        for qid in question_ids:
            user_answer = answers.get(str(qid))
            if user_answer is None or str(user_answer).strip() == "":
                continue
            attempted += 1
            if correct_map.get(qid) == user_answer:
                correct += 1
            else:
                incorrect += 1

        not_attempted = len(question_ids) - attempted
        score_points = (correct * 4 - incorrect) if mode == "daily" else correct

        cur.execute(
            f"""
            INSERT INTO quiz_mode_attempts (
                user_id,
                mode,
                course_id,
                unit_id,
                question_count,
                attempted_count,
                correct_count,
                incorrect_count,
                not_attempted_count,
                score_points,
                time_limit_seconds,
                created_at,
                attempt_date_ist,
                week_start_ist,
                month_start_ist
            )
            VALUES (
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                CURRENT_TIMESTAMP,
                (CURRENT_TIMESTAMP AT TIME ZONE '{IST_TIMEZONE}')::date,
                date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE '{IST_TIMEZONE}')::date,
                date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE '{IST_TIMEZONE}')::date
            )
            RETURNING id
            """,
            (
                user_id,
                mode,
                course_id,
                unit_id,
                len(question_ids),
                attempted,
                correct,
                incorrect,
                not_attempted,
                score_points,
                time_limit_seconds,
            ),
        )

        attempt_id = cur.fetchone()[0]
        conn.commit()

        cur.close()
        conn.close()

        return jsonify(
            {
                "attempt_id": attempt_id,
                "mode": mode,
                "questions_attempted": attempted,
                "correct": correct,
                "incorrect": incorrect,
                "not_attempted": not_attempted,
                "total_seen_questions": len(question_ids),
                "score_points": score_points,
            }
        )

    except Exception as e:
        print("SUBMIT MODE QUIZ ERROR:", e)
        return jsonify({"error": str(e)}), 500

# =====================================================
# MINI TOPIC QUIZ (5 questions + topic progress)
# =====================================================
MINI_TOPIC_QUESTION_COUNT = 5


def _progress_status(score_percent):
    if score_percent >= 80:
        return "completed"
    if score_percent >= 40:
        return "in_progress"
    return "needs_practice"


def _fetch_topic_context(cur, topic_id):
    cur.execute(
        """
        SELECT t.id, t.title, t.unit_id, u.title, u.course_id, c.title, c.semester_id
        FROM topics t
        JOIN units u ON u.id = t.unit_id
        JOIN courses c ON c.id = u.course_id
        WHERE t.id = %s
        """,
        (topic_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return {
        "topic_id": row[0],
        "topic_title": row[1],
        "unit_id": row[2],
        "unit_title": row[3],
        "course_id": row[4],
        "course_title": row[5],
        "semester_id": row[6],
    }


def _legacy_questions_table_exists(cur):
    cur.execute("SELECT to_regclass('public.questions')")
    return cur.fetchone()[0] is not None


def _fetch_legacy_topic_questions(cur, topic_id, limit=MINI_TOPIC_QUESTION_COUNT):
    if not _legacy_questions_table_exists(cur):
        return []
    cur.execute(
        """
        SELECT id, question, option_a, option_b, option_c, option_d, correct_answer
        FROM questions
        WHERE topic_id = %s
        ORDER BY RANDOM()
        LIMIT %s
        """,
        (topic_id, limit),
    )
    return _build_question_payload(cur.fetchall())


def _fetch_mini_standard_questions(cur, semester_id, course_id, unit_id, limit=MINI_TOPIC_QUESTION_COUNT):
    # Prefer unit-level questions. If a unit has no questions, fallback to course-level.
    questions = _fetch_standard_questions(
        cur,
        semester_id=semester_id,
        course_id=course_id,
        unit_id=unit_id,
        limit=limit,
    )
    if questions:
        return questions, "unit"

    questions = _fetch_standard_questions(
        cur,
        semester_id=semester_id,
        course_id=course_id,
        unit_id=None,
        limit=limit,
    )
    if questions:
        return questions, "course"

    questions = _fetch_standard_questions(
        cur,
        semester_id=semester_id,
        course_id=None,
        unit_id=None,
        limit=limit,
    )
    return questions, "semester"


def _legacy_correct_answer_map(cur, question_ids):
    if not question_ids or not _legacy_questions_table_exists(cur):
        return {}
    placeholders = ",".join(["%s"] * len(question_ids))
    cur.execute(
        f"""
        SELECT id, option_a, option_b, option_c, option_d, correct_answer
        FROM questions
        WHERE id IN ({placeholders})
        """,
        tuple(question_ids),
    )
    rows = cur.fetchall()
    answer_map = {}
    option_index_map = {"A": 0, "B": 1, "C": 2, "D": 3}
    for row in rows:
        options = [row[1], row[2], row[3], row[4]]
        correct_value = row[5]
        if isinstance(correct_value, str):
            stripped = correct_value.strip()
            correct_index = option_index_map.get(stripped.upper())
            if correct_index is None and stripped in options:
                answer_map[row[0]] = stripped
                continue
        elif isinstance(correct_value, int):
            # Support both 0-based and 1-based old tables.
            correct_index = correct_value if 0 <= correct_value <= 3 else correct_value - 1
        else:
            correct_index = None
        if correct_index is not None and 0 <= correct_index < len(options):
            answer_map[row[0]] = options[correct_index]
    return answer_map


@questions_bp.route("/mini-topic/<int:topic_id>", methods=["GET"])
@jwt_required
def start_mini_topic_quiz(current_user, topic_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        allowed, context = require_topic_access(cur, current_user, topic_id, require_enrollment=True)
        if not context:
            cur.close()
            conn.close()
            return jsonify({"error": "Topic not found"}), 404
        if not allowed:
            cur.close()
            conn.close()
            return jsonify({"error": "Forbidden"}), 403

        # Never run mini quizzes for Minor/Major project papers.
        course_title = str(context.get("course_title") or "").lower()
        if "minor project" in course_title or "major project" in course_title:
            cur.close()
            conn.close()
            return jsonify({"error": "Project papers do not have mini topic quizzes."}), 400

        legacy_questions = _fetch_legacy_topic_questions(cur, topic_id, MINI_TOPIC_QUESTION_COUNT)
        if legacy_questions:
            questions = legacy_questions[:MINI_TOPIC_QUESTION_COUNT]
            question_source = "topic_questions"
            fallback_level = "topic"
        else:
            questions, fallback_level = _fetch_mini_standard_questions(
                cur,
                semester_id=context["semester_id"],
                course_id=context["course_id"],
                unit_id=context["unit_id"],
                limit=MINI_TOPIC_QUESTION_COUNT,
            )
            question_source = "quiz_questions_new"

        cur.close()
        conn.close()

        if not questions:
            return jsonify({"error": "No mini quiz questions available for this topic yet."}), 404

        return jsonify({
            "topic": context,
            "mode": "mini_topic",
            "question_source": question_source,
            "fallback_level": fallback_level,
            "question_count": len(questions),
            "questions": questions,
            "progress_rules": {
                "completed": "80-100%",
                "in_progress": "40-79%",
                "needs_practice": "0-39%",
            },
        }), 200

    except Exception as e:
        print("START MINI TOPIC QUIZ ERROR:", e)
        return jsonify({"error": str(e)}), 500


@questions_bp.route("/mini-topic/progress/<int:topic_id>", methods=["GET"])
@jwt_required
def get_mini_topic_progress(current_user, topic_id):
    try:
        user_id = current_user.get("id") or current_user.get("user_id")
        if not user_id:
            return jsonify({"error": "User not found"}), 400

        conn = get_db_connection()
        cur = conn.cursor()

        allowed, context = require_topic_access(cur, current_user, topic_id, require_enrollment=True)
        if not context:
            cur.close()
            conn.close()
            return jsonify({"error": "Topic not found"}), 404
        if not allowed:
            cur.close()
            conn.close()
            return jsonify({"error": "Forbidden"}), 403

        cur.execute(
            """
            SELECT mini_quiz_attempts, best_score, last_score, total_questions,
                   progress_percent, status, completed_at, updated_at
            FROM topic_progress
            WHERE user_id = %s AND topic_id = %s
            """,
            (user_id, topic_id),
        )
        row = cur.fetchone()

        cur.close()
        conn.close()

        if not row:
            return jsonify({"progress": None}), 200

        return jsonify({
            "progress": {
                "mini_quiz_attempts": row[0],
                "best_score": row[1],
                "last_score": row[2],
                "total_questions": row[3],
                "progress_percent": float(row[4] or 0),
                "status": row[5],
                "completed_at": row[6].isoformat() if row[6] else None,
                "updated_at": row[7].isoformat() if row[7] else None,
            }
        }), 200
    except Exception as e:
        print("GET MINI TOPIC PROGRESS ERROR:", e)
        return jsonify({"error": str(e)}), 500


@questions_bp.route("/mini-topic/submit", methods=["POST"])
@jwt_required
def submit_mini_topic_quiz(current_user):
    try:
        data = request.get_json() or {}
        topic_id = _normalize_filter(data.get("topic_id"))
        question_source = (data.get("question_source") or "quiz_questions_new").strip()
        answers = data.get("answers") or {}
        presented_question_ids = data.get("presented_question_ids") or []

        user_id = current_user.get("id") or current_user.get("user_id")
        if not user_id:
            return jsonify({"error": "User not found"}), 400
        if not topic_id:
            return jsonify({"error": "Topic is required"}), 400

        question_ids = []
        seen = set()
        for item in presented_question_ids:
            try:
                qid = int(item)
            except (TypeError, ValueError):
                continue
            if qid not in seen:
                seen.add(qid)
                question_ids.append(qid)

        if not question_ids:
            return jsonify({"error": "No mini quiz questions submitted"}), 400

        conn = get_db_connection()
        cur = conn.cursor()

        allowed, context = require_topic_access(cur, current_user, topic_id, require_enrollment=True)
        if not context:
            cur.close()
            conn.close()
            return jsonify({"error": "Topic not found"}), 404
        if not allowed:
            cur.close()
            conn.close()
            return jsonify({"error": "Forbidden"}), 403

        if question_source == "topic_questions":
            correct_map = _legacy_correct_answer_map(cur, question_ids)
        else:
            correct_map = _get_correct_answer_map(cur, question_ids, "normal")

        attempted = 0
        correct = 0
        incorrect = 0
        review = []

        for qid in question_ids:
            user_answer = answers.get(str(qid))
            correct_answer = correct_map.get(qid)
            is_attempted = user_answer is not None and str(user_answer).strip() != ""
            is_correct = is_attempted and correct_answer == user_answer
            if is_attempted:
                attempted += 1
                if is_correct:
                    correct += 1
                else:
                    incorrect += 1
            review.append({
                "question_id": qid,
                "your_answer": user_answer,
                "correct_answer": correct_answer,
                "is_correct": bool(is_correct),
            })

        total = len(question_ids)
        score_percent = round((correct / total) * 100, 2) if total else 0
        status = _progress_status(score_percent)

        cur.execute(
            """
            INSERT INTO mini_topic_quiz_attempts (
                user_id, topic_id, unit_id, course_id, question_source,
                question_count, attempted_count, correct_count, incorrect_count,
                score_percent, status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                user_id,
                topic_id,
                context["unit_id"],
                context["course_id"],
                question_source,
                total,
                attempted,
                correct,
                incorrect,
                score_percent,
                status,
            ),
        )
        attempt_id = cur.fetchone()[0]

        # Progress never goes backwards: best_score/progress_percent keep the best value.
        completed_at_expr = "CURRENT_TIMESTAMP" if status == "completed" else "NULL"
        cur.execute(
            f"""
            INSERT INTO topic_progress (
                user_id, topic_id, unit_id, course_id,
                mini_quiz_attempts, best_score, last_score, total_questions,
                progress_percent, status, completed_at, updated_at
            )
            VALUES (%s, %s, %s, %s, 1, %s, %s, %s, %s, %s, {completed_at_expr}, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, topic_id)
            DO UPDATE SET
                mini_quiz_attempts = topic_progress.mini_quiz_attempts + 1,
                best_score = GREATEST(topic_progress.best_score, EXCLUDED.best_score),
                last_score = EXCLUDED.last_score,
                total_questions = EXCLUDED.total_questions,
                progress_percent = GREATEST(topic_progress.progress_percent, EXCLUDED.progress_percent),
                status = CASE
                    WHEN GREATEST(topic_progress.progress_percent, EXCLUDED.progress_percent) >= 80 THEN 'completed'
                    WHEN GREATEST(topic_progress.progress_percent, EXCLUDED.progress_percent) >= 40 THEN 'in_progress'
                    ELSE 'needs_practice'
                END,
                completed_at = CASE
                    WHEN GREATEST(topic_progress.progress_percent, EXCLUDED.progress_percent) >= 80
                    THEN COALESCE(topic_progress.completed_at, CURRENT_TIMESTAMP)
                    ELSE topic_progress.completed_at
                END,
                updated_at = CURRENT_TIMESTAMP
            RETURNING mini_quiz_attempts, best_score, last_score, progress_percent, status, completed_at
            """,
            (
                user_id,
                topic_id,
                context["unit_id"],
                context["course_id"],
                correct,
                correct,
                total,
                score_percent,
                status,
            ),
        )
        progress_row = cur.fetchone()

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({
            "attempt_id": attempt_id,
            "mode": "mini_topic",
            "topic_id": topic_id,
            "score": correct,
            "total": total,
            "attempted": attempted,
            "correct": correct,
            "incorrect": incorrect,
            "not_attempted": total - attempted,
            "percentage": score_percent,
            "status": status,
            "review": review,
            "progress": {
                "mini_quiz_attempts": progress_row[0],
                "best_score": progress_row[1],
                "last_score": progress_row[2],
                "progress_percent": float(progress_row[3]),
                "status": progress_row[4],
                "completed_at": progress_row[5].isoformat() if progress_row[5] else None,
            }
        }), 200

    except Exception as e:
        print("SUBMIT MINI TOPIC QUIZ ERROR:", e)
        return jsonify({"error": str(e)}), 500

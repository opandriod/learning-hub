from flask import Blueprint, jsonify, request
from db import get_db_connection
from middleware.auth_middleware import jwt_required
from utils.authz import require_course_access

mock_bp = Blueprint('mock', __name__)


def _normalize_course_id(value):
    if value in (None, "", "all", "All", "ALL"):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


@mock_bp.route('/mock-test/<course_id>', methods=['GET'])
@jwt_required
def get_mock_test(current_user, course_id):
    try:
        conn = get_db_connection(); cur = conn.cursor()
        semester_id = current_user.get("semester_id")
        if not semester_id:
            cur.close(); conn.close()
            return jsonify({"error": "Please set your semester in profile first"}), 400

        normalized_course_id = _normalize_course_id(course_id)
        if normalized_course_id is not None:
            allowed, course = require_course_access(cur, current_user, normalized_course_id, require_enrollment=False)
            if not course:
                cur.close(); conn.close()
                return jsonify({"error": "Course not found"}), 404
            if not allowed:
                cur.close(); conn.close()
                return jsonify({"error": "Forbidden"}), 403

        if normalized_course_id is None:
            cur.execute(
                """
                SELECT mq.id, mq.question_text
                FROM mock_questions mq
                JOIN courses c ON c.id = mq.course_id
                WHERE mq.semester_id = %s
                  AND c.semester_id = %s
                  AND lower(c.title) NOT LIKE %s
                  AND lower(c.title) NOT LIKE %s
                ORDER BY RANDOM()
                LIMIT 10
                """,
                (semester_id, semester_id, "%minor project%", "%major project%"),
            )
        else:
            cur.execute(
                """
                SELECT mq.id, mq.question_text
                FROM mock_questions mq
                JOIN courses c ON c.id = mq.course_id
                WHERE mq.semester_id = %s
                  AND c.semester_id = %s
                  AND mq.course_id = %s
                  AND lower(c.title) NOT LIKE %s
                  AND lower(c.title) NOT LIKE %s
                ORDER BY RANDOM()
                LIMIT 10
                """,
                (semester_id, semester_id, normalized_course_id, "%minor project%", "%major project%"),
            )

        questions = cur.fetchall()
        result = []
        for q_id, q_text in questions:
            # Do NOT expose is_correct before submit.
            cur.execute(
                """
                SELECT id, option_text
                FROM mock_options
                WHERE question_id = %s
                ORDER BY id
                """,
                (q_id,),
            )
            options = cur.fetchall()
            if not options:
                continue
            result.append({
                "id": q_id,
                "question_text": q_text,
                "options": [{"id": opt[0], "option_text": opt[1]} for opt in options],
            })

        cur.close(); conn.close()
        return jsonify(result), 200
    except Exception as e:
        print("🔥 MOCK TEST ERROR:", e)
        return jsonify({"error": str(e)}), 500


@mock_bp.route('/mock-test/submit', methods=['POST'])
@jwt_required
def submit_mock_test(current_user):
    try:
        data = request.json or {}
        user_id = current_user.get("id")
        course_id = _normalize_course_id(data.get("course_id"))
        answers = data.get("answers") or {}
        presented_question_ids = data.get("presented_question_ids") or []

        question_ids = []
        seen = set()
        for item in presented_question_ids:
            try:
                qid = int(item)
            except (TypeError, ValueError):
                continue
            if qid not in seen:
                seen.add(qid); question_ids.append(qid)
        if not question_ids:
            return jsonify({"error": "No mock questions submitted"}), 400

        conn = get_db_connection(); cur = conn.cursor()
        semester_id = current_user.get("semester_id")
        if not semester_id:
            cur.close(); conn.close()
            return jsonify({"error": "Please set your semester in profile first"}), 400

        if course_id is not None:
            allowed, course = require_course_access(cur, current_user, course_id, require_enrollment=False)
            if not course:
                cur.close(); conn.close()
                return jsonify({"error": "Course not found"}), 404
            if not allowed:
                cur.close(); conn.close()
                return jsonify({"error": "Forbidden"}), 403

        placeholders = ",".join(["%s"] * len(question_ids))
        params = [semester_id, semester_id]
        query = f"""
            SELECT mq.id, mo.id AS correct_option_id, mo.option_text AS correct_option_text
            FROM mock_questions mq
            JOIN courses c ON c.id = mq.course_id
            JOIN mock_options mo ON mo.question_id = mq.id AND mo.is_correct = TRUE
            WHERE mq.id IN ({placeholders})
              AND mq.semester_id = %s
              AND c.semester_id = %s
        """
        query_params = list(question_ids) + params
        if course_id is not None:
            query += " AND mq.course_id = %s"
            query_params.append(course_id)
        cur.execute(query, tuple(query_params))
        correct_map = {row[0]: {"id": row[1], "text": row[2]} for row in cur.fetchall()}

        if len(correct_map) != len(question_ids):
            cur.close(); conn.close()
            return jsonify({"error": "Submitted questions are not valid for your semester/course"}), 403

        attempted = 0; correct = 0; review = []
        for qid in question_ids:
            selected = answers.get(str(qid))
            selected_id = None
            if selected is not None and str(selected).strip() != "":
                attempted += 1
                try:
                    selected_id = int(selected)
                except (TypeError, ValueError):
                    selected_id = None
            correct_info = correct_map.get(qid) or {}
            is_correct = selected_id is not None and selected_id == correct_info.get("id")
            if is_correct:
                correct += 1
            review.append({
                "question_id": qid,
                "selected_option_id": selected_id,
                "correct_option_id": correct_info.get("id"),
                "correct_answer": correct_info.get("text"),
                "is_correct": bool(is_correct),
            })
        total = len(question_ids)
        incorrect = attempted - correct

        cur.execute(
            """
            INSERT INTO mock_test_results (user_id, course_id, score, total)
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            (user_id, course_id, correct, total),
        )
        inserted_id = cur.fetchone()[0]
        cur.execute(
            """
            DELETE FROM mock_test_results
            WHERE user_id = %s
              AND id NOT IN (
                  SELECT id FROM mock_test_results
                  WHERE user_id = %s
                  ORDER BY created_at DESC, id DESC
                  LIMIT 5
              )
            """,
            (user_id, user_id),
        )
        conn.commit(); cur.close(); conn.close()
        return jsonify({
            "message": "Mock test saved",
            "id": inserted_id,
            "score": correct,
            "total": total,
            "attempted": attempted,
            "incorrect": incorrect,
            "unanswered": total - attempted,
            "review": review,
        }), 200
    except Exception as e:
        print("🔥 SAVE MOCK ERROR:", e)
        return jsonify({"error": str(e)}), 500


@mock_bp.route('/mock-test/results', methods=['GET'])
@jwt_required
def get_mock_results(current_user):
    try:
        user_id = current_user.get("id")
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute(
            """
            SELECT score, total, created_at
            FROM mock_test_results
            WHERE user_id = %s
            ORDER BY created_at DESC, id DESC
            LIMIT 5
            """,
            (user_id,),
        )
        data = [{"score": r[0], "total": r[1], "date": r[2]} for r in cur.fetchall()]
        cur.close(); conn.close()
        return jsonify(data), 200
    except Exception as e:
        print("🔥 GET MOCK RESULTS ERROR:", e)
        return jsonify({"error": str(e)}), 500

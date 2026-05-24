from flask import Blueprint, jsonify
from db import get_db_connection
from middleware.auth_middleware import jwt_required
from utils.authz import require_unit_access, require_topic_access

topics_bp = Blueprint("topics", __name__)


@topics_bp.route("/<int:unit_id>", methods=["GET"])
@jwt_required
def get_topics(current_user, unit_id):
    try:
        conn = get_db_connection(); cur = conn.cursor()
        allowed, context = require_unit_access(cur, current_user, unit_id=unit_id, require_enrollment=True)
        if not context:
            cur.close(); conn.close()
            return jsonify({"error": "Unit not found"}), 404
        if not allowed:
            cur.close(); conn.close()
            return jsonify({"error": "Forbidden"}), 403

        cur.execute("""
            SELECT id, title, content, video_url
            FROM topics
            WHERE unit_id = %s
            ORDER BY position
        """, (unit_id,))
        topics = [{"id": t[0], "title": t[1], "content": t[2], "video_url": t[3]} for t in cur.fetchall()]
        cur.close(); conn.close()
        return jsonify(topics), 200
    except Exception as e:
        print("GET TOPICS ERROR:", e)
        return jsonify({"error": str(e)}), 500


@topics_bp.route("/detail/<int:topic_id>", methods=["GET"])
@jwt_required
def get_topic_detail(current_user, topic_id):
    try:
        conn = get_db_connection(); cur = conn.cursor()
        allowed, context = require_topic_access(cur, current_user, topic_id, require_enrollment=True)
        if not context:
            cur.close(); conn.close()
            return jsonify({"error": "Topic not found"}), 404
        if not allowed:
            cur.close(); conn.close()
            return jsonify({"error": "Forbidden"}), 403

        cur.execute("""
            SELECT t.id, t.title, t.content, t.video_url, t.unit_id, u.course_id, c.semester_id,
                   u.title AS unit_title, c.title AS course_title
            FROM topics t
            JOIN units u ON u.id = t.unit_id
            JOIN courses c ON c.id = u.course_id
            WHERE t.id = %s
        """, (topic_id,))
        topic = cur.fetchone()
        cur.close(); conn.close()
        return jsonify({
            "id": topic[0], "title": topic[1], "content": topic[2], "video_url": topic[3],
            "unit_id": topic[4], "course_id": topic[5], "semester_id": topic[6],
            "unit_title": topic[7], "course_title": topic[8]
        }), 200
    except Exception as e:
        print("GET DETAIL ERROR:", e)
        return jsonify({"error": str(e)}), 500


@topics_bp.route("/pdf/<int:topic_id>", methods=["GET"])
@jwt_required
def get_topic_pdf(current_user, topic_id):
    try:
        conn = get_db_connection(); cur = conn.cursor()
        allowed, context = require_topic_access(cur, current_user, topic_id, require_enrollment=True)
        if not context:
            cur.close(); conn.close()
            return jsonify({"error": "Topic not found"}), 404
        if not allowed:
            cur.close(); conn.close()
            return jsonify({"error": "Forbidden"}), 403

        cur.execute("""
            SELECT id, title, pdf_content
            FROM topics
            WHERE id = %s
        """, (topic_id,))
        topic = cur.fetchone()
        cur.close(); conn.close()
        return jsonify({"id": topic[0], "title": topic[1], "pdf_content": topic[2]}), 200
    except Exception as e:
        print("GET PDF CONTENT ERROR:", e)
        return jsonify({"error": str(e)}), 500

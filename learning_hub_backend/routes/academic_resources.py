import os
import re
import uuid

from flask import Blueprint, jsonify, request
from psycopg2.extras import RealDictCursor

from db import get_db_connection
from middleware.auth_middleware import jwt_required, role_required
from routes.supabase_client import supabase

academic_bp = Blueprint("academic_resources", __name__)

ACADEMIC_BUCKET = os.getenv("ACADEMIC_RESOURCES_BUCKET", "academic-resources")
MAX_PDF_MB = int(os.getenv("ACADEMIC_PDF_MAX_MB", "25"))


def role_in(current_user, roles):
    return current_user.get("role") in roles


def sanitize_filename(name):
    original = name or "resource.pdf"
    return re.sub(r"[^a-zA-Z0-9._-]", "_", original)


def validate_pdf(file_storage):
    if not file_storage:
        return False, "Choose a PDF file."

    filename = file_storage.filename or ""
    content_type = (file_storage.content_type or "").lower()

    data = file_storage.read()
    file_storage.seek(0)

    if len(data) == 0:
        return False, "PDF file is empty."

    if len(data) > MAX_PDF_MB * 1024 * 1024:
        return False, f"PDF is too large. Maximum allowed size is {MAX_PDF_MB} MB."

    if not data[:5] == b"%PDF-":
        return False, "Invalid PDF file. Please upload a real PDF."

    if not filename.lower().endswith(".pdf") and content_type != "application/pdf":
        return False, "Only PDF files are allowed."

    return True, "OK"


def extract_google_drive_file_id(url):
    """Return a Google Drive file id from common share links, or None."""
    if not url:
        return None
    url = url.strip()
    patterns = [
        r"drive\.google\.com/file/d/([a-zA-Z0-9_-]+)",
        r"drive\.google\.com/open\?id=([a-zA-Z0-9_-]+)",
        r"drive\.google\.com/uc\?[^#]*id=([a-zA-Z0-9_-]+)",
        r"[?&]id=([a-zA-Z0-9_-]+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return None


def normalize_google_drive_pdf_link(url):
    """Validate and normalize a Google Drive PDF share link for storage/viewing."""
    url = (url or "").strip()
    if not url:
        return None, None
    if "drive.google.com" not in url:
        return None, "Only Google Drive links are allowed. Use a shared Google Drive PDF link."
    file_id = extract_google_drive_file_id(url)
    if not file_id:
        return None, "Invalid Google Drive link. Use a link like https://drive.google.com/file/d/FILE_ID/view"
    return f"https://drive.google.com/file/d/{file_id}/view", None


def upload_pdf_to_storage(file_storage, prefix):
    safe_name = sanitize_filename(file_storage.filename)
    storage_path = f"{prefix}/{uuid.uuid4()}_{safe_name}"
    file_storage.seek(0)
    supabase.storage.from_(ACADEMIC_BUCKET).upload(
        storage_path,
        file_storage.read(),
        {"content-type": "application/pdf"},
    )
    public_url = supabase.storage.from_(ACADEMIC_BUCKET).get_public_url(storage_path)
    return storage_path, public_url


def dict_rows(cur):
    return [dict(row) for row in cur.fetchall()]


def can_manage_academic_resource(cur, table_name, resource_id, current_user):
    """Admin/instructor can manage all academic resources. Sub-admin can manage only own uploads."""
    if table_name not in {"study_materials", "old_question_papers"}:
        return None, "Invalid resource table."

    cur.execute(f"SELECT id, uploaded_by FROM {table_name} WHERE id = %s", (resource_id,))
    row = cur.fetchone()
    if not row:
        return None, "Resource not found."

    if current_user.get("role") in ("admin", "instructor"):
        return row, None

    if current_user.get("role") == "sub_admin" and str(row.get("uploaded_by")) == str(current_user.get("id")):
        return row, None

    return row, "You can only edit or delete resources you uploaded."


@academic_bp.route("/academic/semesters", methods=["GET"])
@jwt_required
def list_semesters(current_user):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        if current_user["role"] == "student":
            cur.execute("SELECT id, name FROM semesters WHERE id = %s ORDER BY id", (current_user.get("semester_id"),))
        else:
            cur.execute("SELECT id, name FROM semesters ORDER BY id")
        return jsonify(dict_rows(cur)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@academic_bp.route("/academic/courses", methods=["GET"])
@jwt_required
def list_courses_for_resources(current_user):
    semester_id = request.args.get("semester_id")
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        if current_user["role"] == "student":
            semester_id = current_user.get("semester_id")

        if semester_id:
            cur.execute("""
                SELECT c.id, c.title, c.description, c.semester_id, s.name AS semester_name
                FROM courses c
                LEFT JOIN semesters s ON s.id = c.semester_id
                WHERE c.semester_id = %s
                ORDER BY c.semester_id, c.title
            """, (semester_id,))
        else:
            cur.execute("""
                SELECT c.id, c.title, c.description, c.semester_id, s.name AS semester_name
                FROM courses c
                LEFT JOIN semesters s ON s.id = c.semester_id
                ORDER BY c.semester_id, c.title
            """)
        return jsonify(dict_rows(cur)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@academic_bp.route("/academic/units/<int:course_id>", methods=["GET"])
@jwt_required
def list_units_for_resources(current_user, course_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        if current_user["role"] == "student":
            cur.execute("SELECT id FROM courses WHERE id = %s AND semester_id = %s", (course_id, current_user.get("semester_id")))
            if not cur.fetchone():
                return jsonify({"error": "You can only view units from your semester."}), 403

        cur.execute("""
            SELECT id, course_id, title
            FROM units
            WHERE course_id = %s
            ORDER BY id
        """, (course_id,))
        return jsonify(dict_rows(cur)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@academic_bp.route("/academic/study-materials", methods=["POST"])
@jwt_required
@role_required("admin", "instructor", "sub_admin")
def upload_study_material(current_user):
    file = request.files.get("file")
    drive_url_raw = (request.form.get("drive_url") or "").strip()
    semester_id = request.form.get("semester_id")
    course_id = request.form.get("course_id")
    unit_id = request.form.get("unit_id")
    title = (request.form.get("title") or "").strip()
    description = (request.form.get("description") or "").strip()

    has_file = bool(file and (file.filename or "").strip())
    has_drive_url = bool(drive_url_raw)

    if not semester_id or not course_id or not unit_id or not title:
        return jsonify({"error": "Semester, subject, unit, and title are required."}), 400

    if has_file and has_drive_url:
        return jsonify({"error": "Use either PDF file upload or Google Drive link, not both."}), 400

    if not has_file and not has_drive_url:
        return jsonify({"error": "Choose a PDF file or paste a Google Drive PDF link."}), 400

    drive_url = None
    if has_file:
        ok, msg = validate_pdf(file)
        if not ok:
            return jsonify({"error": msg}), 400
    else:
        drive_url, err = normalize_google_drive_pdf_link(drive_url_raw)
        if err:
            return jsonify({"error": err}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT u.id
            FROM units u
            JOIN courses c ON c.id = u.course_id
            WHERE u.id = %s AND c.id = %s AND c.semester_id = %s
        """, (unit_id, course_id, semester_id))
        if not cur.fetchone():
            return jsonify({"error": "Selected unit does not match the selected subject and semester."}), 400

        if has_file:
            storage_path, file_url = upload_pdf_to_storage(file, "study-materials")
            file_name = file.filename
        else:
            storage_path = None
            file_url = drive_url
            file_name = "Google Drive PDF link"

        cur.execute("""
            INSERT INTO study_materials
                (semester_id, course_id, unit_id, title, description, file_name, file_url, storage_path, uploaded_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (semester_id, course_id, unit_id, title, description, file_name, file_url, storage_path, current_user["id"]))
        row = cur.fetchone()
        conn.commit()
        return jsonify({"message": "Study material uploaded successfully.", "material": row}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@academic_bp.route("/academic/study-materials", methods=["GET"])
@jwt_required
def list_study_materials(current_user):
    semester_id = request.args.get("semester_id")
    course_id = request.args.get("course_id")
    unit_id = request.args.get("unit_id")

    conditions = []
    params = []

    if current_user["role"] == "student":
        conditions.append("sm.semester_id = %s")
        params.append(current_user.get("semester_id"))
    elif semester_id:
        conditions.append("sm.semester_id = %s")
        params.append(semester_id)

    if course_id:
        conditions.append("sm.course_id = %s")
        params.append(course_id)
    if unit_id:
        conditions.append("sm.unit_id = %s")
        params.append(unit_id)

    where_sql = "WHERE " + " AND ".join(conditions) if conditions else ""

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(f"""
            SELECT sm.*, s.name AS semester_name, c.title AS course_title, u.title AS unit_title
            FROM study_materials sm
            LEFT JOIN semesters s ON s.id = sm.semester_id
            LEFT JOIN courses c ON c.id = sm.course_id
            LEFT JOIN units u ON u.id = sm.unit_id
            {where_sql}
            ORDER BY sm.created_at DESC
        """, tuple(params))
        return jsonify(dict_rows(cur)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@academic_bp.route("/academic/study-materials/<int:material_id>", methods=["PATCH"])
@jwt_required
@role_required("admin", "instructor", "sub_admin")
def update_study_material(current_user, material_id):
    file = request.files.get("file")
    drive_url_raw = (request.form.get("drive_url") or "").strip()
    title = (request.form.get("title") or "").strip()
    description = (request.form.get("description") or "").strip()

    has_file = bool(file and (file.filename or "").strip())
    has_drive_url = bool(drive_url_raw)

    if not title:
        return jsonify({"error": "Title is required."}), 400

    if has_file and has_drive_url:
        return jsonify({"error": "Use either PDF file upload or Google Drive link, not both."}), 400

    drive_url = None
    if has_file:
        ok, msg = validate_pdf(file)
        if not ok:
            return jsonify({"error": msg}), 400
    elif has_drive_url:
        drive_url, err = normalize_google_drive_pdf_link(drive_url_raw)
        if err:
            return jsonify({"error": err}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        existing, manage_error = can_manage_academic_resource(cur, "study_materials", material_id, current_user)
        if manage_error == "Resource not found.":
            return jsonify({"error": "Study material not found."}), 404
        if manage_error:
            return jsonify({"error": manage_error}), 403

        file_name = None
        file_url = None
        storage_path = None
        if has_file:
            storage_path, file_url = upload_pdf_to_storage(file, "study-materials")
            file_name = file.filename
        elif has_drive_url:
            storage_path = None
            file_url = drive_url
            file_name = "Google Drive PDF link"

        if has_file or has_drive_url:
            cur.execute("""
                UPDATE study_materials
                SET title = %s, description = %s, file_name = %s, file_url = %s, storage_path = %s
                WHERE id = %s
                RETURNING *
            """, (title, description, file_name, file_url, storage_path, material_id))
        else:
            cur.execute("""
                UPDATE study_materials
                SET title = %s, description = %s
                WHERE id = %s
                RETURNING *
            """, (title, description, material_id))

        row = cur.fetchone()
        conn.commit()
        return jsonify({"message": "Study material updated successfully.", "material": row}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@academic_bp.route("/academic/study-materials/<int:material_id>", methods=["DELETE"])
@jwt_required
@role_required("admin", "instructor", "sub_admin")
def delete_study_material(current_user, material_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        existing, manage_error = can_manage_academic_resource(cur, "study_materials", material_id, current_user)
        if manage_error == "Resource not found.":
            return jsonify({"error": "Study material not found."}), 404
        if manage_error:
            return jsonify({"error": manage_error}), 403

        cur.execute("DELETE FROM study_materials WHERE id = %s RETURNING id", (material_id,))
        deleted = cur.fetchone()
        conn.commit()
        return jsonify({"message": "Study material deleted."}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@academic_bp.route("/academic/old-questions", methods=["POST"])
@jwt_required
@role_required("admin", "instructor", "sub_admin")
def upload_old_question(current_user):
    file = request.files.get("file")
    drive_url_raw = (request.form.get("drive_url") or "").strip()
    semester_id = request.form.get("semester_id")
    course_id = request.form.get("course_id")
    title = (request.form.get("title") or "").strip()
    year = request.form.get("year")

    has_file = bool(file and (file.filename or "").strip())
    has_drive_url = bool(drive_url_raw)

    if not semester_id or not course_id or not title or not year:
        return jsonify({"error": "Semester, subject, year, and title are required."}), 400

    try:
        year_int = int(year)
        if year_int < 2000 or year_int > 2100:
            return jsonify({"error": "Enter a valid year."}), 400
    except Exception:
        return jsonify({"error": "Year must be a number."}), 400

    if has_file and has_drive_url:
        return jsonify({"error": "Use either PDF file upload or Google Drive link, not both."}), 400

    if not has_file and not has_drive_url:
        return jsonify({"error": "Choose a PDF file or paste a Google Drive PDF link."}), 400

    drive_url = None
    if has_file:
        ok, msg = validate_pdf(file)
        if not ok:
            return jsonify({"error": msg}), 400
    else:
        drive_url, err = normalize_google_drive_pdf_link(drive_url_raw)
        if err:
            return jsonify({"error": err}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT id FROM courses WHERE id = %s AND semester_id = %s", (course_id, semester_id))
        if not cur.fetchone():
            return jsonify({"error": "Selected subject does not match the selected semester."}), 400

        if has_file:
            storage_path, file_url = upload_pdf_to_storage(file, "old-questions")
            file_name = file.filename
        else:
            storage_path = None
            file_url = drive_url
            file_name = "Google Drive PDF link"

        cur.execute("""
            INSERT INTO old_question_papers
                (semester_id, course_id, title, year, file_name, file_url, storage_path, uploaded_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING *
        """, (semester_id, course_id, title, year_int, file_name, file_url, storage_path, current_user["id"]))
        row = cur.fetchone()
        conn.commit()
        return jsonify({"message": "Previous year question paper uploaded successfully.", "paper": row}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@academic_bp.route("/academic/old-questions", methods=["GET"])
@jwt_required
def list_old_questions(current_user):
    semester_id = request.args.get("semester_id")
    course_id = request.args.get("course_id")
    year = request.args.get("year")

    conditions = []
    params = []

    if current_user["role"] == "student":
        conditions.append("oq.semester_id = %s")
        params.append(current_user.get("semester_id"))
    elif semester_id:
        conditions.append("oq.semester_id = %s")
        params.append(semester_id)

    if course_id:
        conditions.append("oq.course_id = %s")
        params.append(course_id)
    if year:
        conditions.append("oq.year = %s")
        params.append(year)

    where_sql = "WHERE " + " AND ".join(conditions) if conditions else ""

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(f"""
            SELECT oq.*, s.name AS semester_name, c.title AS course_title
            FROM old_question_papers oq
            LEFT JOIN semesters s ON s.id = oq.semester_id
            LEFT JOIN courses c ON c.id = oq.course_id
            {where_sql}
            ORDER BY oq.year DESC, oq.created_at DESC
        """, tuple(params))
        return jsonify(dict_rows(cur)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@academic_bp.route("/academic/old-questions/<int:paper_id>", methods=["PATCH"])
@jwt_required
@role_required("admin", "instructor", "sub_admin")
def update_old_question(current_user, paper_id):
    file = request.files.get("file")
    drive_url_raw = (request.form.get("drive_url") or "").strip()
    title = (request.form.get("title") or "").strip()
    year = request.form.get("year")

    has_file = bool(file and (file.filename or "").strip())
    has_drive_url = bool(drive_url_raw)

    if not title or not year:
        return jsonify({"error": "Title and year are required."}), 400

    try:
        year_int = int(year)
        if year_int < 2000 or year_int > 2100:
            return jsonify({"error": "Enter a valid year."}), 400
    except Exception:
        return jsonify({"error": "Year must be a number."}), 400

    if has_file and has_drive_url:
        return jsonify({"error": "Use either PDF file upload or Google Drive link, not both."}), 400

    drive_url = None
    if has_file:
        ok, msg = validate_pdf(file)
        if not ok:
            return jsonify({"error": msg}), 400
    elif has_drive_url:
        drive_url, err = normalize_google_drive_pdf_link(drive_url_raw)
        if err:
            return jsonify({"error": err}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        existing, manage_error = can_manage_academic_resource(cur, "old_question_papers", paper_id, current_user)
        if manage_error == "Resource not found.":
            return jsonify({"error": "Question paper not found."}), 404
        if manage_error:
            return jsonify({"error": manage_error}), 403

        file_name = None
        file_url = None
        storage_path = None
        if has_file:
            storage_path, file_url = upload_pdf_to_storage(file, "old-questions")
            file_name = file.filename
        elif has_drive_url:
            storage_path = None
            file_url = drive_url
            file_name = "Google Drive PDF link"

        if has_file or has_drive_url:
            cur.execute("""
                UPDATE old_question_papers
                SET title = %s, year = %s, file_name = %s, file_url = %s, storage_path = %s
                WHERE id = %s
                RETURNING *
            """, (title, year_int, file_name, file_url, storage_path, paper_id))
        else:
            cur.execute("""
                UPDATE old_question_papers
                SET title = %s, year = %s
                WHERE id = %s
                RETURNING *
            """, (title, year_int, paper_id))

        row = cur.fetchone()
        conn.commit()
        return jsonify({"message": "Previous year question paper updated successfully.", "paper": row}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@academic_bp.route("/academic/old-questions/<int:paper_id>", methods=["DELETE"])
@jwt_required
@role_required("admin", "instructor", "sub_admin")
def delete_old_question(current_user, paper_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        existing, manage_error = can_manage_academic_resource(cur, "old_question_papers", paper_id, current_user)
        if manage_error == "Resource not found.":
            return jsonify({"error": "Question paper not found."}), 404
        if manage_error:
            return jsonify({"error": manage_error}), 403

        cur.execute("DELETE FROM old_question_papers WHERE id = %s RETURNING id", (paper_id,))
        deleted = cur.fetchone()
        conn.commit()
        return jsonify({"message": "Previous year question paper deleted."}), 200
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()

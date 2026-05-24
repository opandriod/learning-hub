import base64
import io
import os
import re
import uuid
import zipfile
import hmac
import hashlib
from decimal import Decimal
from urllib.parse import quote_plus

import requests

from flask import Blueprint, jsonify, request, send_file
from psycopg2.extras import RealDictCursor

from db import get_db_connection
from middleware.auth_middleware import jwt_required
from routes.supabase_client import supabase

marketplace_bp = Blueprint("marketplace", __name__)

DANGEROUS_EXTENSIONS = {".exe", ".bat", ".cmd", ".vbs", ".scr", ".msi", ".ps1", ".sh"}
MAX_SUB_ADMIN_ZIP_MB = int(os.getenv("SUB_ADMIN_MAX_ZIP_MB", "50"))
MAX_ADMIN_ZIP_MB = int(os.getenv("ADMIN_MAX_ZIP_MB", "200"))
MAX_PENDING_SUB_ADMIN_UPLOADS = int(os.getenv("SUB_ADMIN_MAX_PENDING_UPLOADS", "3"))
MAX_MONTHLY_SUB_ADMIN_UPLOADS = int(os.getenv("SUB_ADMIN_MAX_MONTHLY_UPLOADS", "10"))
UPI_ID = os.getenv("LEARNING_HUB_UPI_ID", "learninghub@upi")
UPI_PAYEE = os.getenv("LEARNING_HUB_UPI_PAYEE", "Learning Hub")
UPLOADER_SHARE_PERCENT = Decimal(os.getenv("PROJECT_UPLOADER_SHARE_PERCENT", "70"))
INSTRUCTOR_SHARE_PERCENT = Decimal(os.getenv("PROJECT_INSTRUCTOR_SHARE_PERCENT", "10"))
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "").strip()
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "").strip()
RAZORPAY_ORDERS_URL = "https://api.razorpay.com/v1/orders"
ENABLE_TEST_PAYMENT_SIMULATOR = os.getenv("ENABLE_TEST_PAYMENT_SIMULATOR", "false").strip().lower() == "true"
MIN_PAID_PROJECT_PRICE = Decimal(os.getenv("MIN_PAID_PROJECT_PRICE", "50"))
MIN_PROJECT_SCREENSHOTS = int(os.getenv("MIN_PROJECT_SCREENSHOTS", "3"))
MAX_PROJECT_SCREENSHOTS = int(os.getenv("MAX_PROJECT_SCREENSHOTS", "8"))



# Upload rules based on Mizoram University BCA syllabus structure.
# Practical/lab resources are separate from Minor/Major projects.
BCA_UPLOAD_CATALOG = {
    1: {"practical": ["PC Applications & Internet Technology Lab", "Office Automation Lab"]},
    2: {"practical": ["Programming in C Lab", "Tally ERP 9.0 Lab"]},
    3: {"practical": ["Oracle Lab", "Data Structure using C Lab"]},
    4: {"practical": ["Web Programming using PHP Lab", "C++/Java Programming Lab"]},
    5: {"practical": ["Programming with VB.NET Lab"], "minor": ["Minor Project"]},
    6: {"major": ["Major Project"]},
}

RESOURCE_TYPE_LABELS = {
    "practical": "Practical/Lab Resource",
    "minor": "Minor Project",
    "major": "Major Project",
}


def allowed_subjects_for_upload(semester_id, project_type):
    try:
        sem = int(semester_id)
    except Exception:
        return []
    return BCA_UPLOAD_CATALOG.get(sem, {}).get(project_type, [])


def validate_bca_upload_rule(semester_id, project_type, subject_name):
    try:
        sem = int(semester_id)
    except Exception:
        raise ValueError("Select a valid semester for this upload.")

    if project_type not in ["practical", "minor", "major"]:
        raise ValueError("Upload type must be Practical, Minor Project, or Major Project.")

    allowed_subjects = allowed_subjects_for_upload(sem, project_type)
    if not allowed_subjects:
        if project_type == "minor":
            raise ValueError("Minor Project upload is allowed only for Semester 5.")
        if project_type == "major":
            raise ValueError("Major Project upload is allowed only for Semester 6.")
        raise ValueError("This semester does not have an allowed practical upload category.")

    subject = (subject_name or "").strip() or allowed_subjects[0]
    if subject not in allowed_subjects:
        raise ValueError("Selected subject does not match the selected semester and upload type.")

    return sem, project_type, subject


def dict_rows(cur):
    rows = cur.fetchall()
    return [dict(row) for row in rows]


def can_charge_for_upload(project_type):
    return project_type in ["minor", "major"]


def normalize_price(value):
    try:
        price = Decimal(str(value or "0")).quantize(Decimal("0.01"))
    except Exception:
        raise ValueError("Invalid price")
    if price < 0:
        raise ValueError("Price cannot be negative")
    if price > Decimal("9999.00"):
        raise ValueError("Price is too high for manual UPI payment")
    return price


def validate_zip_file(file_storage, max_mb, project_type=None):
    filename = file_storage.filename or "project.zip"
    if not filename.lower().endswith(".zip"):
        return False, "Only ZIP files are allowed."

    data = file_storage.read()
    file_storage.seek(0)
    size = len(data)
    # Lab/practical uploads can be small, but Minor/Major projects should be larger.
    # This keeps fake empty uploads blocked without rejecting small practical program ZIPs.
    min_size = 2 * 1024 if project_type == "practical" else 10 * 1024
    if size < min_size:
        if project_type == "practical":
            return False, "ZIP file is too small. Practical ZIP must be at least 2 KB and include README plus source files."
        return False, "ZIP file is too small. Minor/Major project ZIP must be at least 10 KB and include source files and README."
    if size > max_mb * 1024 * 1024:
        return False, f"ZIP file is too large. Maximum allowed size is {max_mb} MB."

    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            names = [n for n in zf.namelist() if not n.endswith("/")]
            if len(names) < 3:
                return False, "ZIP must contain at least 3 files. Include source code and README."

            lower_names = [n.lower() for n in names]
            if not any(n.endswith("readme.txt") or n.endswith("readme.md") for n in lower_names):
                return False, "ZIP must include README.txt or README.md with setup instructions."

            for name in lower_names:
                _, ext = os.path.splitext(name)
                if ext in DANGEROUS_EXTENSIONS:
                    return False, f"Dangerous file type detected: {ext}. Remove executable/script files."
    except zipfile.BadZipFile:
        return False, "Invalid or corrupted ZIP file."

    return True, "OK"


def upload_to_supabase_bucket(bucket, file_storage, prefix):
    original = file_storage.filename or "upload.bin"
    safe_name = re.sub(r"[^a-zA-Z0-9._-]", "_", original)
    storage_path = f"{prefix}/{uuid.uuid4()}_{safe_name}"
    file_storage.seek(0)
    supabase.storage.from_(bucket).upload(storage_path, file_storage.read(), {"content-type": file_storage.content_type})
    public_url = supabase.storage.from_(bucket).get_public_url(storage_path)
    return storage_path, public_url




def validate_image_file(file_storage, max_mb=5):
    if not file_storage or not file_storage.filename:
        return False, "Choose an image file."
    filename = file_storage.filename.lower()
    allowed_ext = (".jpg", ".jpeg", ".png", ".webp")
    if not filename.endswith(allowed_ext):
        return False, "Only JPG, JPEG, PNG, and WEBP images are allowed."
    data = file_storage.read()
    file_storage.seek(0)
    if len(data) > max_mb * 1024 * 1024:
        return False, f"Image is too large. Maximum allowed size is {max_mb} MB."
    if len(data) < 512:
        return False, "Image file is too small or invalid."
    return True, "OK"

def load_project_images(cur, project_id):
    cur.execute("""
        SELECT id, project_id, image_url, image_path, image_type, position, created_at
        FROM project_images
        WHERE project_id = %s
        ORDER BY CASE WHEN image_type = 'thumbnail' THEN 0 ELSE 1 END, position ASC, created_at ASC
    """, (project_id,))
    return dict_rows(cur)

def attach_project_images(cur, project):
    if not project:
        return project
    images = load_project_images(cur, project["id"])
    project["images"] = images
    project["screenshots"] = [img for img in images if img.get("image_type") == "screenshot"]
    if not project.get("thumbnail_url"):
        thumb = next((img for img in images if img.get("image_type") == "thumbnail"), None)
        if thumb:
            project["thumbnail_url"] = thumb.get("image_url")
        elif project["screenshots"]:
            project["thumbnail_url"] = project["screenshots"][0].get("image_url")
    return project

def count_project_screenshots(cur, project_id):
    cur.execute("SELECT COUNT(*) AS c FROM project_images WHERE project_id = %s AND image_type = 'screenshot'", (project_id,))
    return int((cur.fetchone() or {}).get("c") or 0)

def has_project_thumbnail(cur, project_id):
    cur.execute("""
        SELECT 1
        FROM project_uploads p
        WHERE p.id = %s
          AND (NULLIF(p.thumbnail_url, '') IS NOT NULL
               OR EXISTS(SELECT 1 FROM project_images pi WHERE pi.project_id = p.id AND pi.image_type = 'thumbnail'))
        LIMIT 1
    """, (project_id,))
    return cur.fetchone() is not None

def enforce_project_preview_ready(cur, project_id):
    if not has_project_thumbnail(cur, project_id):
        raise ValueError("Thumbnail image is required before this project can be approved or shown in the store.")
    screenshots = count_project_screenshots(cur, project_id)
    if screenshots < MIN_PROJECT_SCREENSHOTS:
        raise ValueError(f"At least {MIN_PROJECT_SCREENSHOTS} project screenshots are required before this project can be approved or shown in the store.")

def user_can_delete_project(current_user, project):
    if current_user.get("role") == "instructor":
        return True
    if current_user.get("role") in ["admin", "sub_admin"] and project and project.get("uploaded_by") == current_user.get("id"):
        return True
    return False

def create_signed_storage_url(bucket, storage_path, expires_in=300):
    if not storage_path:
        raise ValueError("Missing storage path for this file.")
    result = supabase.storage.from_(bucket).create_signed_url(storage_path, expires_in)

    if isinstance(result, dict):
        for key in ("signedURL", "signed_url", "signedUrl", "url"):
            if result.get(key):
                return result[key]
        data = result.get("data")
        if isinstance(data, dict):
            for key in ("signedURL", "signed_url", "signedUrl", "url"):
                if data.get(key):
                    return data[key]

    data = getattr(result, "data", None)
    if isinstance(data, dict):
        for key in ("signedURL", "signed_url", "signedUrl", "url"):
            if data.get(key):
                return data[key]

    raise ValueError("Could not create a signed download URL.")


def role_in(user, roles):
    return user.get("role") in roles


@marketplace_bp.route("/upload-options", methods=["GET"])
@jwt_required
def upload_options(current_user):
    options = []
    for semester_id, by_type in BCA_UPLOAD_CATALOG.items():
        for project_type, subjects in by_type.items():
            for subject in subjects:
                options.append({
                    "semester_id": semester_id,
                    "project_type": project_type,
                    "project_type_label": RESOURCE_TYPE_LABELS.get(project_type, project_type),
                    "subject_name": subject,
                    "label": f"Semester {semester_id} - {RESOURCE_TYPE_LABELS.get(project_type, project_type)} - {subject}"
                })
    return jsonify(options), 200


@marketplace_bp.route("/sub-admin/apply", methods=["POST"])
@jwt_required
def apply_sub_admin(current_user):
    if current_user["role"] not in ["student"]:
        return jsonify({"error": "Only students can apply for sub-admin."}), 403

    data = request.get_json() or {}
    reason = (data.get("reason") or "").strip()
    skills = (data.get("skills") or "").strip()
    agreed = bool(data.get("agreed"))

    if not agreed:
        return jsonify({"error": "You must agree to the sub-admin rules before applying."}), 400
    if len(reason) < 20:
        return jsonify({"error": "Please write at least 20 characters explaining why you want to become sub-admin."}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT semester_id FROM users WHERE id = %s", (current_user["id"],))
        user = cur.fetchone()
        semester_id = user.get("semester_id") if user else None
        if semester_id not in [5, 6]:
            return jsonify({"error": "Only Semester 5 and Semester 6 students can apply for sub-admin."}), 403

        cur.execute("""
            SELECT id, status FROM sub_admin_requests
            WHERE user_id = %s AND status = 'pending'
            LIMIT 1
        """, (current_user["id"],))
        if cur.fetchone():
            return jsonify({"error": "You already have a pending sub-admin request."}), 409

        cur.execute("""
            INSERT INTO sub_admin_requests (user_id, reason, skills, status, expires_at)
            VALUES (%s, %s, %s, 'pending', NOW() + INTERVAL '48 hours')
            RETURNING id, status, expires_at
        """, (current_user["id"], reason, skills))
        row = cur.fetchone()
        conn.commit()
        return jsonify({"message": "Sub-admin application submitted for instructor review.", "request": row}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/sub-admin/my-request", methods=["GET"])
@jwt_required
def my_sub_admin_request(current_user):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT id, reason, skills, status, review_note, created_at, expires_at, reviewed_at
            FROM sub_admin_requests
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 1
        """, (current_user["id"],))
        return jsonify(cur.fetchone()), 200
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/instructor/sub-admin-requests", methods=["GET"])
@jwt_required
def list_sub_admin_requests(current_user):
    if current_user["role"] != "instructor":
        return jsonify({"error": "Only instructor can view sub-admin requests."}), 403
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT sar.*, u.name, u.email, u.semester_id, u.status AS user_status
            FROM sub_admin_requests sar
            JOIN users u ON u.id = sar.user_id
            WHERE sar.status = 'pending' AND sar.expires_at > NOW()
            ORDER BY sar.created_at DESC
        """)
        rows = dict_rows(cur)
        for row in rows:
            if row.get("screenshot_path"):
                try:
                    row["screenshot_view_url"] = create_signed_storage_url("payment-proofs", row.get("screenshot_path"), 300)
                except Exception:
                    row["screenshot_view_url"] = row.get("screenshot_url")
        return jsonify(rows), 200
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/instructor/sub-admin-requests/<int:request_id>/approve", methods=["POST"])
@jwt_required
def approve_sub_admin(current_user, request_id):
    if current_user["role"] != "instructor":
        return jsonify({"error": "Only instructor can approve sub-admin requests."}), 403
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT * FROM sub_admin_requests WHERE id = %s AND status = 'pending'", (request_id,))
        req = cur.fetchone()
        if not req:
            return jsonify({"error": "Pending request not found."}), 404
        cur.execute("UPDATE users SET role = 'sub_admin', status = 'active' WHERE id = %s", (req["user_id"],))
        cur.execute("""
            UPDATE sub_admin_requests
            SET status = 'approved', reviewed_by = %s, reviewed_at = NOW(), review_note = %s
            WHERE id = %s
        """, (current_user["id"], "Approved by instructor", request_id))
        conn.commit()
        return jsonify({"message": "Student promoted to sub-admin."}), 200
    except Exception as e:
        conn.rollback(); return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/instructor/sub-admin-requests/<int:request_id>/reject", methods=["POST"])
@jwt_required
def reject_sub_admin(current_user, request_id):
    if current_user["role"] != "instructor":
        return jsonify({"error": "Only instructor can reject sub-admin requests."}), 403
    data = request.get_json() or {}
    note = (data.get("review_note") or "Rejected by instructor").strip()
    conn = get_db_connection(); cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE sub_admin_requests
            SET status = 'rejected', reviewed_by = %s, reviewed_at = NOW(), review_note = %s
            WHERE id = %s AND status = 'pending'
        """, (current_user["id"], note, request_id))
        conn.commit()
        if cur.rowcount == 0:
            return jsonify({"error": "Pending request not found."}), 404
        return jsonify({"message": "Sub-admin request rejected."}), 200
    except Exception as e:
        conn.rollback(); return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/instructor/users/<int:user_id>/status", methods=["PUT"])
@jwt_required
def instructor_update_user_status(current_user, user_id):
    if current_user["role"] != "instructor":
        return jsonify({"error": "Only instructor can block/unblock admins, sub-admins, and students."}), 403
    data = request.get_json() or {}
    status = data.get("status")
    if status not in ["active", "blocked"]:
        return jsonify({"error": "Status must be active or blocked."}), 400
    if user_id == current_user["id"]:
        return jsonify({"error": "You cannot block your own instructor account."}), 403
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT role FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        if not user:
            return jsonify({"error": "User not found."}), 404
        if user["role"] == "instructor":
            return jsonify({"error": "Instructor accounts are protected."}), 403
        cur.execute("UPDATE users SET status = %s WHERE id = %s", (status, user_id))
        conn.commit()
        return jsonify({"message": f"User status changed to {status}."}), 200
    except Exception as e:
        conn.rollback(); return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/projects/upload", methods=["POST"])
@jwt_required
def upload_project(current_user):
    if current_user["role"] not in ["sub_admin", "admin", "instructor"]:
        return jsonify({"error": "Only sub-admin, admin, or instructor can upload projects."}), 403

    file = request.files.get("file")
    thumbnail = request.files.get("thumbnail")
    screenshots = request.files.getlist("screenshots")
    title = (request.form.get("title") or "").strip()
    description = (request.form.get("description") or "").strip()
    project_type = (request.form.get("project_type") or "").strip().lower()
    semester_id = request.form.get("semester_id") or None
    subject_name = (request.form.get("subject_name") or "").strip()
    requested_is_paid = str(request.form.get("is_paid") or "false").lower() in ["true", "1", "yes"]

    if not file or not title or not description:
        return jsonify({"error": "Title, description, and ZIP file are required."}), 400
    if not thumbnail:
        return jsonify({"error": "Thumbnail image is required. Upload one clean product thumbnail before submitting."}), 400
    if len(screenshots) < MIN_PROJECT_SCREENSHOTS:
        return jsonify({"error": f"Upload at least {MIN_PROJECT_SCREENSHOTS} project screenshots for the store preview."}), 400
    if len(screenshots) > MAX_PROJECT_SCREENSHOTS:
        return jsonify({"error": f"Upload no more than {MAX_PROJECT_SCREENSHOTS} screenshots."}), 400
    ok, msg = validate_image_file(thumbnail)
    if not ok:
        return jsonify({"error": msg}), 400
    for shot in screenshots:
        ok, msg = validate_image_file(shot)
        if not ok:
            return jsonify({"error": msg}), 400
    try:
        semester_id, project_type, subject_name = validate_bca_upload_rule(semester_id, project_type, subject_name)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    # Pricing is allowed only for Semester 5 Minor Project and Semester 6 Major Project.
    # Practical/Lab resources must always remain free.
    if not can_charge_for_upload(project_type):
        if requested_is_paid:
            return jsonify({"error": "Pricing is allowed only for Minor Project and Major Project uploads. Practical/Lab resources must be free."}), 400
        is_paid = False
        price = Decimal("0.00")
    else:
        is_paid = requested_is_paid
        try:
            price = normalize_price(request.form.get("price") if is_paid else 0)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        if is_paid and price < MIN_PAID_PROJECT_PRICE:
            return jsonify({"error": f"Paid Minor/Major projects must have a minimum price of ₹{MIN_PAID_PROJECT_PRICE}."}), 400

    max_mb = MAX_SUB_ADMIN_ZIP_MB if current_user["role"] == "sub_admin" else MAX_ADMIN_ZIP_MB
    ok, msg = validate_zip_file(file, max_mb, project_type)
    if not ok:
        return jsonify({"error": msg}), 400

    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        if current_user["role"] == "sub_admin":
            cur.execute("SELECT COUNT(*) AS c FROM project_uploads WHERE uploaded_by = %s AND status = 'pending'", (current_user["id"],))
            if cur.fetchone()["c"] >= MAX_PENDING_SUB_ADMIN_UPLOADS:
                return jsonify({"error": f"You can only have {MAX_PENDING_SUB_ADMIN_UPLOADS} pending uploads at once."}), 403
            cur.execute("""
                SELECT COUNT(*) AS c FROM project_uploads
                WHERE uploaded_by = %s AND created_at >= NOW() - INTERVAL '30 days'
            """, (current_user["id"],))
            if cur.fetchone()["c"] >= MAX_MONTHLY_SUB_ADMIN_UPLOADS:
                return jsonify({"error": f"Monthly upload limit reached ({MAX_MONTHLY_SUB_ADMIN_UPLOADS})."}), 403

        storage_path, file_url = upload_to_supabase_bucket("project-zips", file, "marketplace")
        status = "approved" if current_user["role"] in ["admin", "instructor"] else "pending"
        approved_at_sql = "NOW()" if status == "approved" else "NULL"
        cur.execute(f"""
            INSERT INTO project_uploads
              (title, description, display_title, display_description, semester_id, project_type, subject_name, uploaded_by, file_url, storage_path,
               file_name, file_size, status, is_paid, price, approved_at, approved_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, {approved_at_sql}, %s)
            RETURNING *
        """, (title, description, title, description, semester_id, project_type, subject_name, current_user["id"], file_url,
              storage_path, file.filename, getattr(file, "content_length", None), status, is_paid, price, current_user["id"] if status == "approved" else None))
        project = cur.fetchone()

        thumb_path, thumb_url = upload_to_supabase_bucket("project-images", thumbnail, f"marketplace/{project['id']}/thumbnail")
        cur.execute("UPDATE project_uploads SET thumbnail_url = %s, thumbnail_path = %s, updated_at = NOW() WHERE id = %s", (thumb_url, thumb_path, project["id"]))
        cur.execute("""
            INSERT INTO project_images (project_id, image_url, image_path, image_type, position, uploaded_by)
            VALUES (%s, %s, %s, 'thumbnail', 0, %s)
        """, (project["id"], thumb_url, thumb_path, current_user["id"]))

        pos = 0
        for shot in screenshots[:MAX_PROJECT_SCREENSHOTS]:
            pos += 1
            shot_path, shot_url = upload_to_supabase_bucket("project-images", shot, f"marketplace/{project['id']}/screenshots")
            cur.execute("""
                INSERT INTO project_images (project_id, image_url, image_path, image_type, position, uploaded_by)
                VALUES (%s, %s, %s, 'screenshot', %s, %s)
            """, (project["id"], shot_url, shot_path, pos, current_user["id"]))

        cur.execute("SELECT * FROM project_uploads WHERE id = %s", (project["id"],))
        project = cur.fetchone()
        attach_project_images(cur, project)
        conn.commit()
        return jsonify({"message": "Project uploaded successfully." if status == "approved" else "Project uploaded for review.", "project": project}), 201
    except Exception as e:
        conn.rollback(); return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/projects/my", methods=["GET"])
@jwt_required
def my_projects(current_user):
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT p.*, COALESCE(SUM(e.uploader_share), 0) AS pending_earnings
            FROM project_uploads p
            LEFT JOIN project_earnings e ON e.project_id = p.id AND e.uploader_id = p.uploaded_by
            WHERE p.uploaded_by = %s
            GROUP BY p.id
            ORDER BY p.created_at DESC
        """, (current_user["id"],))
        projects = dict_rows(cur)
        for project in projects:
            attach_project_images(cur, project)
        return jsonify(projects), 200
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/projects/review", methods=["GET"])
@jwt_required
def review_projects(current_user):
    if current_user["role"] not in ["admin", "instructor"]:
        return jsonify({"error": "Only admin/instructor can review projects."}), 403
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT p.*, u.name AS uploader_name, u.email AS uploader_email, u.role AS uploader_role
            FROM project_uploads p
            JOIN users u ON u.id = p.uploaded_by
            WHERE p.status IN ('pending', 'approved', 'rejected', 'archived')
            ORDER BY CASE WHEN p.status = 'pending' THEN 0 ELSE 1 END, p.created_at DESC
            LIMIT 200
        """)
        projects = dict_rows(cur)
        for project in projects:
            attach_project_images(cur, project)
        return jsonify(projects), 200
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/projects/<int:project_id>/approve", methods=["POST"])
@jwt_required
def approve_project(current_user, project_id):
    if current_user["role"] not in ["admin", "instructor"]:
        return jsonify({"error": "Only admin/instructor can approve projects."}), 403
    data = request.get_json() or {}
    final_price = data.get("price")
    review_note = (data.get("review_note") or "Approved").strip()
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT project_type FROM project_uploads WHERE id = %s", (project_id,))
        project_meta = cur.fetchone()
        if not project_meta:
            return jsonify({"error": "Project not found."}), 404
        enforce_project_preview_ready(cur, project_id)

        # Reviewers may price only Minor/Major projects. Practical/Lab resources are forced free.
        if not can_charge_for_upload(project_meta["project_type"]):
            price = Decimal("0.00")
            is_paid = False
        elif final_price is not None:
            price = normalize_price(final_price)
            if price > 0 and price < MIN_PAID_PROJECT_PRICE:
                return jsonify({"error": f"Paid Minor/Major projects must have a minimum price of ₹{MIN_PAID_PROJECT_PRICE}."}), 400
            is_paid = price > 0
        else:
            price = None
            is_paid = None

        if price is not None:
            cur.execute("""
                UPDATE project_uploads
                SET status = 'approved', price = %s, is_paid = %s, approved_by = %s, approved_at = NOW(), reviewed_by = %s, reviewed_at = NOW(), review_note = %s
                WHERE id = %s
                RETURNING *
            """, (price, is_paid, current_user["id"], current_user["id"], review_note, project_id))
        else:
            cur.execute("""
                UPDATE project_uploads
                SET status = 'approved', approved_by = %s, approved_at = NOW(), reviewed_by = %s, reviewed_at = NOW(), review_note = %s
                WHERE id = %s
                RETURNING *
            """, (current_user["id"], current_user["id"], review_note, project_id))
        row = cur.fetchone(); conn.commit()
        if not row:
            return jsonify({"error": "Project not found."}), 404
        return jsonify({"message": "Project approved.", "project": row}), 200
    except ValueError as e:
        conn.rollback(); return jsonify({"error": str(e)}), 400
    except Exception as e:
        conn.rollback(); return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/projects/<int:project_id>/reject", methods=["POST"])
@jwt_required
def reject_project(current_user, project_id):
    if current_user["role"] not in ["admin", "instructor"]:
        return jsonify({"error": "Only admin/instructor can reject projects."}), 403
    note = ((request.get_json() or {}).get("review_note") or "Rejected. Please improve and upload again.").strip()
    conn = get_db_connection(); cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE project_uploads
            SET status = 'rejected', reviewed_by = %s, reviewed_at = NOW(), review_note = %s
            WHERE id = %s
        """, (current_user["id"], note, project_id))
        conn.commit()
        return jsonify({"message": "Project rejected."}), 200
    except Exception as e:
        conn.rollback(); return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/projects/<int:project_id>/archive", methods=["POST"])
@jwt_required
def archive_project(current_user, project_id):
    if current_user["role"] not in ["admin", "instructor"]:
        return jsonify({"error": "Only admin/instructor can archive projects."}), 403
    conn = get_db_connection(); cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE project_uploads
            SET status = 'archived', archived_at = NOW(), delete_after = NOW() + INTERVAL '30 days'
            WHERE id = %s
        """, (project_id,))
        conn.commit()
        return jsonify({"message": "Project archived for 30 days before deletion."}), 200
    except Exception as e:
        conn.rollback(); return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/projects", methods=["GET"])
@jwt_required
def list_projects(current_user):
    semester_id = request.args.get("semester_id")
    project_type = request.args.get("project_type")
    q = (request.args.get("q") or "").strip()
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        conditions = ["p.status = 'approved'"]
        params = []
        if semester_id:
            conditions.append("p.semester_id = %s"); params.append(int(semester_id))
        if project_type:
            conditions.append("p.project_type = %s"); params.append(project_type)
        if q:
            conditions.append("(p.title ILIKE %s OR p.description ILIKE %s OR p.display_title ILIKE %s OR p.display_description ILIKE %s)"); params.extend([f"%{q}%", f"%{q}%", f"%{q}%", f"%{q}%"])
        sql = f"""
            SELECT p.id, COALESCE(NULLIF(p.display_title, ''), p.title) AS title,
                   COALESCE(NULLIF(p.display_description, ''), p.description) AS description,
                   p.thumbnail_url, p.semester_id, p.project_type, p.subject_name, p.uploaded_by,
                   p.status, p.is_paid, p.price, p.download_count, p.average_rating, p.rating_count,
                   p.created_at, p.approved_at, u.name AS uploader_name,
                   EXISTS(SELECT 1 FROM project_purchases pp WHERE pp.project_id = p.id AND pp.buyer_id = %s AND pp.status = 'approved') AS has_access,
                   CASE
                     WHEN EXISTS(SELECT 1 FROM project_purchases pp WHERE pp.project_id = p.id AND pp.buyer_id = %s AND pp.status = 'approved') THEN 'approved'
                     WHEN EXISTS(SELECT 1 FROM project_purchases pp WHERE pp.project_id = p.id AND pp.buyer_id = %s AND pp.status IN ('pending', 'created')) THEN 'pending'
                     WHEN EXISTS(SELECT 1 FROM project_purchases pp WHERE pp.project_id = p.id AND pp.buyer_id = %s AND pp.status = 'rejected') THEN 'rejected'
                     ELSE NULL
                   END AS purchase_status
            FROM project_uploads p
            JOIN users u ON u.id = p.uploaded_by
            WHERE {' AND '.join(conditions)}
            ORDER BY p.average_rating DESC, p.download_count DESC, p.approved_at DESC
            LIMIT 100
        """
        cur.execute(sql, [current_user["id"], current_user["id"], current_user["id"], current_user["id"]] + params)
        return jsonify(dict_rows(cur)), 200
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/projects/<int:project_id>", methods=["GET"])
@jwt_required
def project_detail(current_user, project_id):
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT p.*, u.name AS uploader_name,
                   EXISTS(SELECT 1 FROM project_purchases pp WHERE pp.project_id = p.id AND pp.buyer_id = %s AND pp.status = 'approved') AS has_access,
                   CASE
                     WHEN EXISTS(SELECT 1 FROM project_purchases pp WHERE pp.project_id = p.id AND pp.buyer_id = %s AND pp.status = 'approved') THEN 'approved'
                     WHEN EXISTS(SELECT 1 FROM project_purchases pp WHERE pp.project_id = p.id AND pp.buyer_id = %s AND pp.status IN ('pending', 'created')) THEN 'pending'
                     WHEN EXISTS(SELECT 1 FROM project_purchases pp WHERE pp.project_id = p.id AND pp.buyer_id = %s AND pp.status = 'rejected') THEN 'rejected'
                     ELSE NULL
                   END AS purchase_status
            FROM project_uploads p
            JOIN users u ON u.id = p.uploaded_by
            WHERE p.id = %s
        """, (current_user["id"], current_user["id"], current_user["id"], current_user["id"], project_id))
        p = cur.fetchone()
        if not p or (p["status"] != "approved" and p["uploaded_by"] != current_user["id"] and current_user["role"] not in ["admin", "instructor"]):
            return jsonify({"error": "Project not found."}), 404
        cur.execute("""
            SELECT pr.rating, pr.comment, pr.created_at, u.name
            FROM project_ratings pr JOIN users u ON u.id = pr.user_id
            WHERE pr.project_id = %s ORDER BY pr.created_at DESC LIMIT 20
        """, (project_id,))
        p["raw_title"] = p.get("title")
        p["raw_description"] = p.get("description")
        p["title"] = p.get("display_title") or p.get("title")
        p["description"] = p.get("display_description") or p.get("description")
        attach_project_images(cur, p)
        p["reviews"] = dict_rows(cur)
        return jsonify(p), 200
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/projects/<int:project_id>/listing", methods=["PUT"])
@jwt_required
def update_project_listing(current_user, project_id):
    if current_user["role"] not in ["admin", "instructor"]:
        return jsonify({"error": "Only admin/instructor can manage store listing details."}), 403
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    subject_name = (data.get("subject_name") or "").strip()
    is_featured = bool(data.get("is_featured"))
    if len(title) < 3 or len(description) < 10:
        return jsonify({"error": "Product title and detailed description are required."}), 400
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT project_type FROM project_uploads WHERE id = %s", (project_id,))
        p = cur.fetchone()
        if not p:
            return jsonify({"error": "Project not found."}), 404
        if can_charge_for_upload(p["project_type"]):
            price = normalize_price(data.get("price") or 0)
            is_paid = bool(data.get("is_paid")) and price > 0
            if is_paid and price < MIN_PAID_PROJECT_PRICE:
                return jsonify({"error": f"Paid Minor/Major projects must have a minimum price of ₹{MIN_PAID_PROJECT_PRICE}."}), 400
        else:
            price = Decimal("0.00")
            is_paid = False
        cur.execute("""
            UPDATE project_uploads
            SET display_title = %s, display_description = %s, subject_name = %s,
                price = %s, is_paid = %s, is_featured = %s, reviewed_by = %s, reviewed_at = NOW(), updated_at = NOW()
            WHERE id = %s
            RETURNING *
        """, (title, description, subject_name, price, is_paid, is_featured, current_user["id"], project_id))
        row = cur.fetchone(); conn.commit()
        attach_project_images(cur, row)
        return jsonify({"message": "Store listing updated.", "project": row}), 200
    except Exception as e:
        conn.rollback(); return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/projects/<int:project_id>/images", methods=["POST"])
@jwt_required
def upload_project_images(current_user, project_id):
    if current_user["role"] not in ["admin", "instructor", "sub_admin"]:
        return jsonify({"error": "Only admin, instructor, or sub-admin can upload product images."}), 403
    thumbnail = request.files.get("thumbnail")
    screenshots = request.files.getlist("screenshots")
    if not thumbnail and not screenshots:
        return jsonify({"error": "Choose a thumbnail or at least one screenshot."}), 400
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT id, uploaded_by FROM project_uploads WHERE id = %s", (project_id,))
        project = cur.fetchone()
        if not project:
            return jsonify({"error": "Project not found."}), 404
        if current_user["role"] == "sub_admin" and project.get("uploaded_by") != current_user["id"]:
            return jsonify({"error": "Sub-admin can upload images only for their own projects."}), 403
        if thumbnail:
            ok, msg = validate_image_file(thumbnail)
            if not ok: return jsonify({"error": msg}), 400
            path, url = upload_to_supabase_bucket("project-images", thumbnail, f"marketplace/{project_id}/thumbnail")
            cur.execute("UPDATE project_uploads SET thumbnail_url = %s, thumbnail_path = %s, updated_at = NOW() WHERE id = %s", (url, path, project_id))
            cur.execute("""
                INSERT INTO project_images (project_id, image_url, image_path, image_type, position, uploaded_by)
                VALUES (%s, %s, %s, 'thumbnail', 0, %s)
            """, (project_id, url, path, current_user["id"]))
        cur.execute("SELECT COALESCE(MAX(position), 0) AS max_pos, COUNT(*) AS current_count FROM project_images WHERE project_id = %s AND image_type = 'screenshot'", (project_id,))
        shot_meta = cur.fetchone() or {}
        pos = shot_meta.get("max_pos") or 0
        current_count = int(shot_meta.get("current_count") or 0)
        if current_count + len(screenshots) > MAX_PROJECT_SCREENSHOTS:
            return jsonify({"error": f"A project can have a maximum of {MAX_PROJECT_SCREENSHOTS} screenshots. Remove old screenshots first."}), 400
        for shot in screenshots:
            ok, msg = validate_image_file(shot)
            if not ok: return jsonify({"error": msg}), 400
            pos += 1
            path, url = upload_to_supabase_bucket("project-images", shot, f"marketplace/{project_id}/screenshots")
            cur.execute("""
                INSERT INTO project_images (project_id, image_url, image_path, image_type, position, uploaded_by)
                VALUES (%s, %s, %s, 'screenshot', %s, %s)
            """, (project_id, url, path, pos, current_user["id"]))
        conn.commit()
        images = load_project_images(cur, project_id)
        return jsonify({"message": "Product images updated.", "images": images}), 200
    except Exception as e:
        conn.rollback(); return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/projects/<int:project_id>/images/<int:image_id>", methods=["DELETE"])
@jwt_required
def delete_project_image(current_user, project_id, image_id):
    if current_user["role"] not in ["admin", "instructor", "sub_admin"]:
        return jsonify({"error": "Only admin, instructor, or sub-admin can remove product images."}), 403
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        if current_user["role"] == "sub_admin":
            cur.execute("SELECT uploaded_by FROM project_uploads WHERE id = %s", (project_id,))
            project = cur.fetchone()
            if not project:
                return jsonify({"error": "Project not found."}), 404
            if project.get("uploaded_by") != current_user["id"]:
                return jsonify({"error": "Sub-admin can remove images only from their own projects."}), 403
        cur.execute("DELETE FROM project_images WHERE id = %s AND project_id = %s RETURNING image_type, image_url", (image_id, project_id))
        deleted = cur.fetchone()
        if not deleted:
            return jsonify({"error": "Image not found."}), 404
        if deleted.get("image_type") == "thumbnail":
            cur.execute("UPDATE project_uploads SET thumbnail_url = NULL, thumbnail_path = NULL WHERE id = %s", (project_id,))
        conn.commit()
        return jsonify({"message": "Image removed."}), 200
    except Exception as e:
        conn.rollback(); return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/projects/<int:project_id>", methods=["DELETE"])
@jwt_required
def delete_project(current_user, project_id):
    if current_user["role"] not in ["admin", "instructor", "sub_admin"]:
        return jsonify({"error": "Only admin, instructor, or sub-admin can delete projects."}), 403
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT id, uploaded_by, title FROM project_uploads WHERE id = %s", (project_id,))
        project = cur.fetchone()
        if not project:
            return jsonify({"error": "Project not found."}), 404
        if not user_can_delete_project(current_user, project):
            return jsonify({"error": "Only instructors can delete any project. Admins and sub-admins can delete only their own uploaded projects."}), 403
        cur.execute("DELETE FROM project_uploads WHERE id = %s RETURNING id", (project_id,))
        conn.commit()
        return jsonify({"message": "Project deleted successfully."}), 200
    except Exception as e:
        conn.rollback(); return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/projects/<int:project_id>/rate", methods=["POST"])
@jwt_required
def rate_project(current_user, project_id):
    data = request.get_json() or {}
    try:
        rating = int(data.get("rating"))
    except Exception:
        return jsonify({"error": "Rating must be 1 to 5."}), 400
    comment = (data.get("comment") or "").strip()
    if rating < 1 or rating > 5:
        return jsonify({"error": "Rating must be 1 to 5."}), 400

    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT uploaded_by, status FROM project_uploads WHERE id = %s", (project_id,))
        p = cur.fetchone()
        if not p or p["status"] != "approved":
            return jsonify({"error": "Only approved projects can be rated."}), 404
        if p["uploaded_by"] == current_user["id"]:
            return jsonify({"error": "You cannot rate your own project."}), 403
        cur.execute("""
            INSERT INTO project_ratings (project_id, user_id, rating, comment)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (project_id, user_id)
            DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = NOW()
        """, (project_id, current_user["id"], rating, comment))
        cur.execute("""
            UPDATE project_uploads p
            SET average_rating = stats.avg_rating, rating_count = stats.rating_count
            FROM (
                SELECT project_id, ROUND(AVG(rating)::numeric, 2) AS avg_rating, COUNT(*) AS rating_count
                FROM project_ratings WHERE project_id = %s GROUP BY project_id
            ) stats
            WHERE p.id = stats.project_id
        """, (project_id,))
        conn.commit()
        return jsonify({"message": "Rating saved."}), 200
    except Exception as e:
        conn.rollback(); return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


def user_can_download(cur, user_id, project):
    if project["uploaded_by"] == user_id:
        return True, "owner"
    if not project["is_paid"]:
        cur.execute("SELECT COUNT(*) AS c FROM project_downloads WHERE project_id = %s AND user_id = %s", (project["id"], user_id))
        return cur.fetchone()["c"] < 3, "free_limit"
    cur.execute("SELECT COUNT(*) AS c FROM project_purchases WHERE project_id = %s AND buyer_id = %s AND status = 'approved'", (project["id"], user_id))
    has_purchase = cur.fetchone()["c"] > 0
    if not has_purchase:
        return False, "payment_required"
    cur.execute("SELECT COUNT(*) AS c FROM project_downloads WHERE project_id = %s AND user_id = %s", (project["id"], user_id))
    return cur.fetchone()["c"] < 5, "paid_limit"


@marketplace_bp.route("/projects/<int:project_id>/download", methods=["GET"])
@jwt_required
def download_project(current_user, project_id):
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT * FROM project_uploads WHERE id = %s AND status = 'approved'", (project_id,))
        p = cur.fetchone()
        if not p:
            return jsonify({"error": "Project not found or not approved."}), 404
        allowed, reason = user_can_download(cur, current_user["id"], p)
        if not allowed:
            if reason == "payment_required":
                return jsonify({"error": "Payment approval required before download."}), 402
            return jsonify({"error": "Download limit reached for this project."}), 403
        signed_url = create_signed_storage_url("project-zips", p.get("storage_path"), 300)
        cur.execute("INSERT INTO project_downloads (project_id, user_id) VALUES (%s, %s)", (project_id, current_user["id"]))
        cur.execute("UPDATE project_uploads SET download_count = download_count + 1 WHERE id = %s", (project_id,))
        conn.commit()
        return jsonify({"message": "Download unlocked.", "download_url": signed_url}), 200
    except Exception as e:
        conn.rollback(); return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/projects/<int:project_id>/review-file", methods=["GET"])
@jwt_required
def review_project_file(current_user, project_id):
    if current_user["role"] not in ["admin", "instructor"]:
        return jsonify({"error": "Only admin/instructor can review project files."}), 403
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT id, storage_path FROM project_uploads WHERE id = %s", (project_id,))
        p = cur.fetchone()
        if not p:
            return jsonify({"error": "Project not found."}), 404
        signed_url = create_signed_storage_url("project-zips", p.get("storage_path"), 300)
        return jsonify({"download_url": signed_url}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()



def money_to_paise(amount):
    value = Decimal(str(amount or "0")).quantize(Decimal("0.01"))
    return int(value * 100)


def calculate_project_shares(total_amount):
    total = Decimal(str(total_amount or "0")).quantize(Decimal("0.01"))
    uploader_share = (total * UPLOADER_SHARE_PERCENT / Decimal("100")).quantize(Decimal("0.01"))
    instructor_share = (total * INSTRUCTOR_SHARE_PERCENT / Decimal("100")).quantize(Decimal("0.01"))
    platform_share = total - uploader_share - instructor_share
    if platform_share < 0:
        platform_share = Decimal("0.00")
    return uploader_share, instructor_share, platform_share


def create_razorpay_order(amount_paise, receipt):
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise ValueError("Razorpay test keys are not configured on the backend.")
    payload = {
        "amount": amount_paise,
        "currency": "INR",
        "receipt": receipt,
        "payment_capture": 1,
        "notes": {"app": "Learning Hub", "receipt": receipt},
    }
    response = requests.post(
        RAZORPAY_ORDERS_URL,
        json=payload,
        auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
        timeout=20,
    )
    if response.status_code >= 400:
        try:
            detail = response.json()
        except Exception:
            detail = response.text
        raise ValueError(f"Razorpay order failed: {detail}")
    return response.json()


def verify_razorpay_signature(order_id, payment_id, signature):
    if not RAZORPAY_KEY_SECRET:
        return False
    message = f"{order_id}|{payment_id}".encode("utf-8")
    expected = hmac.new(RAZORPAY_KEY_SECRET.encode("utf-8"), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, str(signature or ""))


@marketplace_bp.route("/projects/<int:project_id>/razorpay/order", methods=["POST"])
@jwt_required
def create_project_razorpay_order(current_user, project_id):
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT p.*, u.name AS uploader_name
            FROM project_uploads p
            JOIN users u ON u.id = p.uploaded_by
            WHERE p.id = %s AND p.status = 'approved' AND p.is_paid = true
        """, (project_id,))
        p = cur.fetchone()
        if not p:
            return jsonify({"error": "Paid approved project not found."}), 404
        if p["uploaded_by"] == current_user["id"]:
            return jsonify({"error": "You cannot buy your own project."}), 400

        cur.execute("""
            SELECT id, status
            FROM project_purchases
            WHERE project_id = %s AND buyer_id = %s AND status = 'approved'
            LIMIT 1
        """, (project_id, current_user["id"]))
        if cur.fetchone():
            return jsonify({"message": "Already purchased.", "purchase_status": "approved"}), 200

        amount = Decimal(str(p["price"])).quantize(Decimal("0.01"))
        if amount < Decimal("50.00"):
            return jsonify({"error": "Paid project price must be at least ₹50 for Razorpay checkout."}), 400

        amount_paise = money_to_paise(amount)
        receipt = f"lh_proj_{project_id}_{current_user['id']}_{uuid.uuid4().hex[:10]}"
        rz_order = create_razorpay_order(amount_paise, receipt)
        razorpay_order_id = rz_order.get("id")
        if not razorpay_order_id:
            return jsonify({"error": "Razorpay did not return an order ID."}), 502

        # Keep screenshot_url and transaction_id filled for compatibility with older schemas.
        cur.execute("""
            INSERT INTO project_purchases
              (project_id, buyer_id, amount, payment_method, transaction_id, screenshot_url,
               screenshot_path, status, provider, currency, razorpay_order_id)
            VALUES (%s, %s, %s, 'razorpay', %s, '', NULL, 'pending', 'razorpay', 'INR', %s)
            RETURNING id, project_id, buyer_id, amount, status, razorpay_order_id, created_at
        """, (project_id, current_user["id"], amount, razorpay_order_id, razorpay_order_id))
        purchase = cur.fetchone()
        conn.commit()
        return jsonify({
            "key_id": RAZORPAY_KEY_ID,
            "order_id": razorpay_order_id,
            "amount": amount_paise,
            "currency": "INR",
            "purchase_id": purchase["id"],
            "project": {"id": p["id"], "title": p["title"], "price": str(amount), "uploader_name": p.get("uploader_name")},
        }), 201
    except ValueError as e:
        conn.rollback(); return jsonify({"error": str(e)}), 400
    except Exception as e:
        conn.rollback(); return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


def finalize_approved_project_purchase(cur, project_id, purchase_id, uploaded_by, approved_by=None, reviewed_by=None, total_amount=None):
    """Create the earning split for an approved project purchase if not already created."""
    total = Decimal(str(total_amount or "0")).quantize(Decimal("0.01"))
    uploader_share, instructor_share, platform_share = calculate_project_shares(total)
    instructor_id = reviewed_by or approved_by

    cur.execute("SELECT id FROM project_earnings WHERE purchase_id = %s LIMIT 1", (purchase_id,))
    if not cur.fetchone():
        cur.execute("""
            INSERT INTO project_earnings
              (project_id, purchase_id, uploader_id, total_amount, uploader_share, platform_share,
               instructor_share, instructor_id, payout_status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'unpaid')
        """, (project_id, purchase_id, uploaded_by, total, uploader_share, platform_share,
              instructor_share, instructor_id))

    return uploader_share, instructor_share, platform_share


@marketplace_bp.route("/projects/<int:project_id>/razorpay/verify", methods=["POST"])
@jwt_required
def verify_project_razorpay_payment(current_user, project_id):
    data = request.get_json() or {}
    purchase_id = data.get("purchase_id")
    razorpay_order_id = (data.get("razorpay_order_id") or "").strip()
    razorpay_payment_id = (data.get("razorpay_payment_id") or "").strip()
    razorpay_signature = (data.get("razorpay_signature") or "").strip()

    if not purchase_id or not razorpay_order_id or not razorpay_payment_id or not razorpay_signature:
        return jsonify({"error": "Missing Razorpay verification details."}), 400
    if not verify_razorpay_signature(razorpay_order_id, razorpay_payment_id, razorpay_signature):
        return jsonify({"error": "Payment signature verification failed."}), 400

    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT pp.*, p.uploaded_by, p.approved_by, p.reviewed_by
            FROM project_purchases pp
            JOIN project_uploads p ON p.id = pp.project_id
            WHERE pp.id = %s AND pp.project_id = %s AND pp.buyer_id = %s AND pp.razorpay_order_id = %s
            FOR UPDATE
        """, (purchase_id, project_id, current_user["id"], razorpay_order_id))
        pp = cur.fetchone()
        if not pp:
            return jsonify({"error": "Purchase record not found."}), 404
        if pp["status"] == "approved":
            return jsonify({"message": "Payment already verified. Download unlocked.", "purchase_status": "approved"}), 200
        if pp["status"] not in ["created", "pending", "failed", "rejected"]:
            return jsonify({"error": f"Cannot verify payment in status {pp['status']}."}), 400

        total = Decimal(str(pp["amount"])).quantize(Decimal("0.01"))
        uploader_share, instructor_share, platform_share = calculate_project_shares(total)
        instructor_id = pp.get("reviewed_by") or pp.get("approved_by")

        cur.execute("""
            UPDATE project_purchases
            SET status = 'approved', provider = 'razorpay', payment_method = 'razorpay',
                transaction_id = %s, razorpay_payment_id = %s, razorpay_signature = %s,
                paid_at = NOW(), reviewed_at = NOW(), review_note = 'Verified automatically by Razorpay signature'
            WHERE id = %s
            RETURNING id, status, paid_at
        """, (razorpay_payment_id, razorpay_payment_id, razorpay_signature, purchase_id))
        purchase = cur.fetchone()

        cur.execute("SELECT id FROM project_earnings WHERE purchase_id = %s LIMIT 1", (purchase_id,))
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO project_earnings
                  (project_id, purchase_id, uploader_id, total_amount, uploader_share, platform_share,
                   instructor_share, instructor_id, payout_status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'unpaid')
            """, (project_id, purchase_id, pp["uploaded_by"], total, uploader_share, platform_share,
                  instructor_share, instructor_id))
        conn.commit()
        return jsonify({
            "message": "Payment successful. Download unlocked.",
            "purchase": purchase,
            "purchase_status": "approved",
            "shares": {
                "uploader_share": str(uploader_share),
                "instructor_share": str(instructor_share),
                "platform_share": str(platform_share),
            }
        }), 200
    except Exception as e:
        conn.rollback(); return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/projects/<int:project_id>/upi", methods=["GET"])
@jwt_required
def project_upi(current_user, project_id):
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT id, title, price, is_paid, status FROM project_uploads WHERE id = %s", (project_id,))
        p = cur.fetchone()
        if not p or p["status"] != "approved" or not p["is_paid"]:
            return jsonify({"error": "Paid approved project not found."}), 404
        amount = Decimal(str(p["price"])).quantize(Decimal("0.01"))
        note = f"Learning Hub Project {project_id}"
        upi_link = f"upi://pay?pa={quote_plus(UPI_ID)}&pn={quote_plus(UPI_PAYEE)}&am={amount}&cu=INR&tn={quote_plus(note)}"
        qr_data_url = None
        try:
            import qrcode
            img = qrcode.make(upi_link)
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            qr_data_url = "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
        except Exception:
            qr_data_url = None
        return jsonify({"upi_id": UPI_ID, "payee": UPI_PAYEE, "amount": str(amount), "upi_link": upi_link, "qr_data_url": qr_data_url}), 200
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/projects/<int:project_id>/razorpay/test-success", methods=["POST"])
@jwt_required
def simulate_project_razorpay_success(current_user, project_id):
    """
    Test-only fallback for demos when Razorpay Test Mode declines or times out.
    This endpoint is blocked unless ENABLE_TEST_PAYMENT_SIMULATOR=true and the backend
    Razorpay key is a test key. Never enable it with live payment keys.
    """
    if not ENABLE_TEST_PAYMENT_SIMULATOR:
        return jsonify({"error": "Test payment simulator is disabled on the backend."}), 403
    if not RAZORPAY_KEY_ID.startswith("rzp_test_"):
        return jsonify({"error": "Test payment simulator works only with Razorpay test keys."}), 403

    data = request.get_json() or {}
    purchase_id = data.get("purchase_id")
    razorpay_order_id = (data.get("razorpay_order_id") or "").strip()
    if not purchase_id or not razorpay_order_id:
        return jsonify({"error": "purchase_id and razorpay_order_id are required."}), 400

    fake_payment_id = f"pay_test_sim_{uuid.uuid4().hex[:12]}"
    fake_signature = f"simulated_{uuid.uuid4().hex[:16]}"

    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT pp.*, p.uploaded_by, p.approved_by, p.reviewed_by
            FROM project_purchases pp
            JOIN project_uploads p ON p.id = pp.project_id
            WHERE pp.id = %s
              AND pp.project_id = %s
              AND pp.buyer_id = %s
              AND pp.razorpay_order_id = %s
              AND pp.provider = 'razorpay'
            FOR UPDATE
        """, (purchase_id, project_id, current_user["id"], razorpay_order_id))
        pp = cur.fetchone()
        if not pp:
            return jsonify({"error": "Pending Razorpay purchase record not found."}), 404
        if pp["status"] == "approved":
            return jsonify({"message": "Payment already approved. Download is unlocked.", "purchase_status": "approved"}), 200
        if pp["status"] not in ["created", "pending", "failed", "rejected"]:
            return jsonify({"error": f"Cannot simulate payment in status {pp['status']}."}), 400

        total = Decimal(str(pp["amount"])).quantize(Decimal("0.01"))
        uploader_share, instructor_share, platform_share = finalize_approved_project_purchase(
            cur,
            project_id=project_id,
            purchase_id=purchase_id,
            uploaded_by=pp["uploaded_by"],
            approved_by=pp.get("approved_by"),
            reviewed_by=pp.get("reviewed_by"),
            total_amount=total,
        )

        cur.execute("""
            UPDATE project_purchases
            SET status = 'approved', provider = 'razorpay', payment_method = 'razorpay_test_simulator',
                transaction_id = %s, razorpay_payment_id = %s, razorpay_signature = %s,
                paid_at = NOW(), reviewed_at = NOW(),
                review_note = 'TEST MODE: simulated Razorpay success for project demo'
            WHERE id = %s
            RETURNING id, status, paid_at, razorpay_payment_id
        """, (fake_payment_id, fake_payment_id, fake_signature, purchase_id))
        purchase = cur.fetchone()
        conn.commit()
        return jsonify({
            "message": "Test payment simulated successfully. Download unlocked.",
            "purchase": purchase,
            "purchase_status": "approved",
            "test_mode": True,
            "shares": {
                "uploader_share": str(uploader_share),
                "instructor_share": str(instructor_share),
                "platform_share": str(platform_share),
            }
        }), 200
    except Exception as e:
        conn.rollback(); return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/projects/<int:project_id>/purchase-proof", methods=["POST"])
@jwt_required
def submit_purchase_proof(current_user, project_id):
    screenshot = request.files.get("screenshot")
    transaction_id = (request.form.get("transaction_id") or "").strip()
    if not screenshot or not transaction_id:
        return jsonify({"error": "Payment screenshot and transaction ID are required."}), 400
    if len(transaction_id) < 6:
        return jsonify({"error": "Enter a valid UPI transaction/reference ID."}), 400
    if not (screenshot.filename or "").lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".pdf")):
        return jsonify({"error": "Screenshot must be JPG, PNG, WEBP, or PDF."}), 400

    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("SELECT * FROM project_uploads WHERE id = %s AND status = 'approved' AND is_paid = true", (project_id,))
        p = cur.fetchone()
        if not p:
            return jsonify({"error": "Paid approved project not found."}), 404
        cur.execute("""
            SELECT id, status, transaction_id
            FROM project_purchases
            WHERE project_id = %s AND buyer_id = %s AND status IN ('pending', 'created', 'approved')
            ORDER BY created_at DESC
            LIMIT 1
        """, (project_id, current_user["id"]))
        existing = cur.fetchone()
        if existing:
            if existing["status"] == "approved":
                return jsonify({"message": "Your payment is already approved. Download is unlocked.", "purchase_status": "approved"}), 200
            return jsonify({"error": "You already submitted payment proof for this project. Please wait for admin/instructor approval.", "purchase_status": "pending"}), 409

        transaction_id = transaction_id.upper()
        storage_path, screenshot_url = upload_to_supabase_bucket("payment-proofs", screenshot, "project-payments")
        cur.execute("""
            INSERT INTO project_purchases (project_id, buyer_id, amount, payment_method, transaction_id, screenshot_url, screenshot_path, status)
            VALUES (%s, %s, %s, 'UPI', %s, %s, %s, 'pending')
            RETURNING *
        """, (project_id, current_user["id"], p["price"], transaction_id, screenshot_url, storage_path))
        purchase = cur.fetchone(); conn.commit()
        return jsonify({"message": "Payment proof submitted. Waiting for admin/instructor approval.", "purchase": purchase, "purchase_status": "pending"}), 201
    except Exception as e:
        conn.rollback()
        if "project_purchases_transaction_id_key" in str(e) or "duplicate key value" in str(e):
            return jsonify({"error": "This transaction ID was already submitted. Use a unique UPI transaction/reference ID."}), 409
        return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/payments/review", methods=["GET"])
@jwt_required
def payment_review_list(current_user):
    if current_user["role"] not in ["admin", "instructor"]:
        return jsonify({"error": "Only admin/instructor can review payments."}), 403
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT pp.*, p.title AS project_title, p.uploaded_by, u.name AS buyer_name, u.email AS buyer_email,
                   uploader.name AS uploader_name
            FROM project_purchases pp
            JOIN project_uploads p ON p.id = pp.project_id
            JOIN users u ON u.id = pp.buyer_id
            JOIN users uploader ON uploader.id = p.uploaded_by
            ORDER BY CASE WHEN pp.status = 'pending' THEN 0 ELSE 1 END, pp.created_at DESC
            LIMIT 200
        """)
        rows = dict_rows(cur)
        for row in rows:
            if row.get("screenshot_path"):
                try:
                    row["screenshot_view_url"] = create_signed_storage_url("payment-proofs", row.get("screenshot_path"), 300)
                except Exception:
                    row["screenshot_view_url"] = row.get("screenshot_url")
        return jsonify(rows), 200
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/payments/<int:purchase_id>/approve", methods=["POST"])
@jwt_required
def approve_payment(current_user, purchase_id):
    if current_user["role"] not in ["admin", "instructor"]:
        return jsonify({"error": "Only admin/instructor can approve payments."}), 403
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            SELECT pp.*, p.uploaded_by
            FROM project_purchases pp JOIN project_uploads p ON p.id = pp.project_id
            WHERE pp.id = %s AND pp.status = 'pending'
        """, (purchase_id,))
        pp = cur.fetchone()
        if not pp:
            return jsonify({"error": "Pending payment not found."}), 404
        total = Decimal(str(pp["amount"]))
        uploader_share = (total * UPLOADER_SHARE_PERCENT / Decimal("100")).quantize(Decimal("0.01"))
        platform_share = total - uploader_share
        cur.execute("""
            UPDATE project_purchases
            SET status = 'approved', reviewed_by = %s, reviewed_at = NOW(), review_note = 'Payment verified manually'
            WHERE id = %s
        """, (current_user["id"], purchase_id))
        cur.execute("""
            INSERT INTO project_earnings (project_id, purchase_id, uploader_id, total_amount, uploader_share, platform_share, payout_status)
            VALUES (%s, %s, %s, %s, %s, %s, 'unpaid')
        """, (pp["project_id"], purchase_id, pp["uploaded_by"], total, uploader_share, platform_share))
        conn.commit()
        return jsonify({"message": "Payment approved. Download unlocked.", "uploader_share": str(uploader_share), "platform_share": str(platform_share)}), 200
    except Exception as e:
        conn.rollback(); return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/payments/<int:purchase_id>/reject", methods=["POST"])
@jwt_required
def reject_payment(current_user, purchase_id):
    if current_user["role"] not in ["admin", "instructor"]:
        return jsonify({"error": "Only admin/instructor can reject payments."}), 403
    note = ((request.get_json() or {}).get("review_note") or "Payment proof rejected. Please upload clear proof with correct amount.").strip()
    conn = get_db_connection(); cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE project_purchases
            SET status = 'rejected', reviewed_by = %s, reviewed_at = NOW(), review_note = %s
            WHERE id = %s AND status = 'pending'
        """, (current_user["id"], note, purchase_id))
        conn.commit()
        return jsonify({"message": "Payment rejected."}), 200
    except Exception as e:
        conn.rollback(); return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()


@marketplace_bp.route("/projects/archive-low-performing", methods=["POST"])
@jwt_required
def archive_low_performing(current_user):
    if current_user["role"] not in ["admin", "instructor"]:
        return jsonify({"error": "Only admin/instructor can archive projects."}), 403
    conn = get_db_connection(); cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute("""
            UPDATE project_uploads
            SET status = 'archived', archived_at = NOW(), delete_after = NOW() + INTERVAL '30 days'
            WHERE status = 'approved'
              AND approved_at < NOW() - INTERVAL '6 months'
              AND download_count < 50
              AND COALESCE(average_rating, 0) < 3.5
            RETURNING id, title
        """)
        rows = dict_rows(cur); conn.commit()
        return jsonify({"message": f"Archived {len(rows)} low-performing projects.", "projects": rows}), 200
    except Exception as e:
        conn.rollback(); return jsonify({"error": str(e)}), 500
    finally:
        cur.close(); conn.close()

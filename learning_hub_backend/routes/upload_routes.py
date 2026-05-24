import uuid
from flask import Blueprint, request, jsonify
from middleware.auth_middleware import jwt_required
from routes.supabase_client import supabase

upload_bp = Blueprint("upload", __name__)


@upload_bp.route("/upload", methods=["POST"])
@jwt_required
def upload_file(current_user):
    if current_user["role"] != "admin":
        return jsonify({"error": "Only admin can upload"}), 403

    file = request.files.get("file")
    file_type = request.form.get("type")
    course_id = request.form.get("course_id")
    unit_id = request.form.get("unit_id")
    title = request.form.get("title")

    if not file or not course_id or not title:
        return jsonify({"error": "File, title and course_id are required"}), 400

    if file_type not in ["pdf", "zip"]:
        return jsonify({"error": "Invalid upload type"}), 400

    ext = file.filename.rsplit(".", 1)[-1].lower()

    if file_type == "pdf" and ext != "pdf":
        return jsonify({"error": "Only PDF allowed"}), 400

    if file_type == "zip" and ext != "zip":
        return jsonify({"error": "Only ZIP allowed"}), 400

    bucket = "notes-pdfs" if file_type == "pdf" else "project-zips"
    filename = f"{uuid.uuid4()}_{file.filename}"

    supabase.storage.from_(bucket).upload(
        filename,
        file.read(),
        {"content-type": file.content_type}
    )

    file_url = supabase.storage.from_(bucket).get_public_url(filename)

    supabase.table("notes").insert({
        "course_id": int(course_id),
        "unit_id": int(unit_id) if unit_id else None,
        "title": title,
        "file_url": file_url,
        "file_type": file_type,
        "uploaded_by": current_user["id"]
    }).execute()

    return jsonify({
        "message": "Uploaded & saved successfully",
        "url": file_url,
        "bucket": bucket,
        "file_name": filename
    }), 201


@upload_bp.route("/notes/<int:course_id>", methods=["GET"])
def get_notes(course_id):
    unit_id = request.args.get("unit_id")

    query = supabase.table("notes").select("*").eq("course_id", course_id)

    if unit_id:
        query = query.eq("unit_id", int(unit_id))

    result = query.order("created_at", desc=True).execute()

    return jsonify(result.data), 200
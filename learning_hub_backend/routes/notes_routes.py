"""Deprecated Supabase-storage notes routes.

Not registered by app.py. Kept protected in case they are enabled later.
"""
import os
import uuid
from flask import Blueprint, request, jsonify
from .supabase_client import supabase
from middleware.auth_middleware import jwt_required, role_required

notes_bp = Blueprint("notes_bp", __name__)


def _allowed_pdf(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() == "pdf"


@notes_bp.route("/upload-note-pdf", methods=["POST"])
@jwt_required
@role_required("admin")
def upload_note_pdf(current_user):
    course_id = request.form.get("course_id")
    unit_id = request.form.get("unit_id")
    title = request.form.get("title")
    description = request.form.get("description", "")
    file = request.files.get("file")

    if not course_id or not title or not file:
        return jsonify({"error": "Missing required fields"}), 400
    if not _allowed_pdf(file.filename):
        return jsonify({"error": "Only PDF files are allowed"}), 400

    unique_name = f"{uuid.uuid4()}_{os.path.basename(file.filename)}"
    temp_path = os.path.join("/tmp", unique_name)
    file.save(temp_path)
    try:
        with open(temp_path, "rb") as fh:
            supabase.storage.from_("notes-pdfs").upload(unique_name, fh)
        file_url = supabase.storage.from_("notes-pdfs").get_public_url(unique_name)
        insert_data = {
            "course_id": int(course_id),
            "uploaded_by": int(current_user["id"]),
            "title": title,
            "description": description,
            "file_name": file.filename,
            "file_url": file_url,
        }
        if unit_id:
            insert_data["unit_id"] = int(unit_id)
        result = supabase.table("notes").insert(insert_data).execute()
        return jsonify({"message": "PDF note uploaded successfully", "data": result.data, "file_url": file_url}), 201
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@notes_bp.route("/course-notes/<int:course_id>", methods=["GET"])
@jwt_required
def get_course_notes(current_user, course_id: int):
    # Main registered notes route performs stricter lesson access checks.
    unit_id = request.args.get("unit_id")
    query = supabase.table("notes").select("*").eq("course_id", course_id)
    if unit_id:
        query = query.eq("unit_id", int(unit_id))
    result = query.order("created_at", desc=True).execute()
    return jsonify(result.data), 200


@notes_bp.route("/delete-note/<int:note_id>", methods=["DELETE"])
@jwt_required
@role_required("admin")
def delete_note(current_user, note_id: int):
    note = supabase.table("notes").select("*").eq("id", note_id).single().execute()
    if not note.data:
        return jsonify({"error": "Note not found"}), 404
    supabase.table("notes").delete().eq("id", note_id).execute()
    return jsonify({"message": "Note deleted successfully"}), 200

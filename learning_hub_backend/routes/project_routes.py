"""Deprecated Supabase-storage project ZIP routes.

Not registered by app.py. Kept protected in case they are enabled later.
"""
import os
import uuid
from flask import Blueprint, request, jsonify
from .supabase_client import supabase
from middleware.auth_middleware import jwt_required, role_required

project_bp = Blueprint("project_bp", __name__)


def _allowed_zip(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() == "zip"


@project_bp.route("/upload-project-zip", methods=["POST"])
@jwt_required
@role_required("admin")
def upload_project_zip(current_user):
    course_id = request.form.get("course_id")
    title = request.form.get("title")
    file = request.files.get("file")

    if not course_id or not title or not file:
        return jsonify({"error": "Missing required fields"}), 400
    if not _allowed_zip(file.filename):
        return jsonify({"error": "Only ZIP files are allowed"}), 400

    course = supabase.table("courses").select("id, is_project_course").eq("id", course_id).single().execute()
    if not course.data or not course.data.get("is_project_course"):
        return jsonify({"error": "ZIP uploads are only allowed for project courses"}), 400

    unique_name = f"{uuid.uuid4()}_{os.path.basename(file.filename)}"
    temp_path = os.path.join("/tmp", unique_name)
    file.save(temp_path)
    try:
        with open(temp_path, "rb") as fh:
            supabase.storage.from_("project-zips").upload(unique_name, fh)
        file_url = supabase.storage.from_("project-zips").get_public_url(unique_name)
        result = supabase.table("project_files").insert({
            "course_id": int(course_id),
            "uploaded_by": int(current_user["id"]),
            "title": title,
            "file_name": file.filename,
            "file_url": file_url,
        }).execute()
        return jsonify({"message": "Project ZIP uploaded successfully", "data": result.data, "file_url": file_url}), 201
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

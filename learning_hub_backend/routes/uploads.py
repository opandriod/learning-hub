import os
import uuid
import boto3
from flask import Blueprint, request, jsonify
from middleware.auth_middleware import jwt_required
from db import get_db_connection

uploads_bp = Blueprint("uploads", __name__)

s3 = boto3.client(
    "s3",
    endpoint_url=os.getenv("B2_ENDPOINT_URL"),
    aws_access_key_id=os.getenv("B2_KEY_ID"),
    aws_secret_access_key=os.getenv("B2_APPLICATION_KEY"),
    region_name=os.getenv("B2_REGION"),
)

def allowed_file(filename, file_type):
    ext = filename.rsplit(".", 1)[-1].lower()
    if file_type == "pdf":
        return ext == "pdf"
    if file_type == "zip":
        return ext == "zip"
    return False

@uploads_bp.route("/admin/upload-file", methods=["POST"])
@jwt_required
def upload_file(current_user):
    if current_user["role"] != "admin":
        return jsonify({"error": "Only admin can upload"}), 403

    file = request.files.get("file")
    title = request.form.get("title")
    file_type = request.form.get("file_type")

    if not file or not title:
        return jsonify({"error": "Missing fields"}), 400

    if not allowed_file(file.filename, file_type):
        return jsonify({"error": "Invalid file"}), 400

    key = f"{file_type}/{uuid.uuid4()}_{file.filename}"

    s3.upload_fileobj(
        file,
        os.getenv("B2_BUCKET_NAME"),
        key,
        ExtraArgs={"ContentType": file.content_type}
    )

    file_url = f"{os.getenv('B2_ENDPOINT_URL')}/{os.getenv('B2_BUCKET_NAME')}/{key}"

    conn = get_db_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO admin_uploads (title, file_type, file_name, file_url)
        VALUES (%s,%s,%s,%s)
        RETURNING id;
    """, (title, file_type, file.filename, file_url))

    conn.commit()
    cur.close()
    conn.close()

    return jsonify({"message": "Uploaded", "url": file_url})
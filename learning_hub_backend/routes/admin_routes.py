"""Deprecated admin-application routes.

These routes were previously unsafe because they trusted user_id/instructor_id from the request body.
They are not registered by app.py, but they are now protected in case they are registered later.
"""
from datetime import datetime, timedelta, timezone
from flask import Blueprint, request, jsonify
from .supabase_client import supabase
from middleware.auth_middleware import jwt_required, role_required

admin_bp = Blueprint("admin_bp", __name__)


def _get_user(user_id: int):
    return supabase.table("users").select("id, role, email, name").eq("id", user_id).single().execute()


@admin_bp.route("/apply-admin", methods=["POST"])
@jwt_required
def apply_admin(current_user):
    user_id = current_user["id"]
    user_res = _get_user(user_id)
    if not user_res.data:
        return jsonify({"error": "User not found"}), 404
    if user_res.data.get("role") == "admin":
        return jsonify({"error": "User is already an admin"}), 400

    expires_at = (datetime.now(timezone.utc) + timedelta(hours=48)).isoformat()
    try:
        result = supabase.table("admin_applications").insert({
            "user_id": int(user_id),
            "status": "pending",
            "expires_at": expires_at,
        }).execute()
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400
    return jsonify({"message": "Admin application submitted", "data": result.data}), 201


@admin_bp.route("/pending-admin-applications", methods=["GET"])
@jwt_required
@role_required("instructor")
def pending_admin_applications(current_user):
    now = datetime.now(timezone.utc).isoformat()
    supabase.table("admin_applications").update({
        "status": "rejected",
        "reviewed_at": now,
        "reason": "Expired"
    }).eq("status", "pending").lt("expires_at", now).execute()
    result = supabase.table("admin_applications").select("*, users(name, email)").eq("status", "pending").order("created_at").execute()
    return jsonify(result.data), 200


@admin_bp.route("/approve-admin/<int:application_id>", methods=["POST"])
@jwt_required
@role_required("instructor")
def approve_admin(current_user, application_id: int):
    instructor_id = current_user["id"]
    app_res = supabase.table("admin_applications").select("*").eq("id", application_id).single().execute()
    if not app_res.data:
        return jsonify({"error": "Application not found"}), 404
    application = app_res.data
    if application["status"] != "pending":
        return jsonify({"error": "Application already reviewed"}), 400
    expires_at = datetime.fromisoformat(application["expires_at"].replace("Z", "+00:00"))
    now = datetime.now(timezone.utc)
    if now > expires_at:
        supabase.table("admin_applications").update({
            "status": "rejected",
            "reviewed_at": now.isoformat(),
            "reviewed_by": int(instructor_id),
            "reason": "Expired"
        }).eq("id", application_id).execute()
        return jsonify({"error": "Application expired"}), 400
    supabase.table("users").update({"role": "admin"}).eq("id", application["user_id"]).execute()
    supabase.table("admin_applications").update({
        "status": "approved",
        "reviewed_at": now.isoformat(),
        "reviewed_by": int(instructor_id)
    }).eq("id", application_id).execute()
    return jsonify({"message": "Application approved. User role updated to admin."}), 200


@admin_bp.route("/reject-admin/<int:application_id>", methods=["POST"])
@jwt_required
@role_required("instructor")
def reject_admin(current_user, application_id: int):
    data = request.get_json(silent=True) or {}
    reason = data.get("reason", "Rejected by instructor")
    app_res = supabase.table("admin_applications").select("*").eq("id", application_id).single().execute()
    if not app_res.data:
        return jsonify({"error": "Application not found"}), 404
    if app_res.data["status"] != "pending":
        return jsonify({"error": "Application already reviewed"}), 400
    supabase.table("admin_applications").update({
        "status": "rejected",
        "reviewed_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_by": int(current_user["id"]),
        "reason": reason
    }).eq("id", application_id).execute()
    return jsonify({"message": "Application rejected"}), 200

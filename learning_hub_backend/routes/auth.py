from flask import Blueprint, request, jsonify, current_app
from utils.security import hash_password, check_password
from middleware.auth_middleware import jwt_required
from db import get_db_connection
import jwt
import datetime
import os
import json
import urllib.request
import urllib.error
import urllib.parse
import secrets
import re

auth_bp = Blueprint("auth", __name__)

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$")


def is_valid_email(email):
    """Reject incomplete email formats like 123@123 or user@gmail."""
    return bool(EMAIL_REGEX.match(email or ""))

PHONE_REGEX = re.compile(r"^\+?[1-9]\d{9,14}$")
GENERATED_PHONE_EMAIL_REGEX = re.compile(r"^phone_(\d+)@learninghub\.local$", re.IGNORECASE)

# Development-friendly phone protection. This does not replace OTP verification,
# but it stops users from saving obvious fake/wrong phone numbers in Profile.
# The project currently targets Indian mobile numbers, so accepted saved format is +91XXXXXXXXXX.
BLOCKED_INDIAN_MOBILE_NUMBERS = {
    "0000000000",
    "1111111111",
    "2222222222",
    "3333333333",
    "4444444444",
    "5555555555",
    "6666666666",
    "7777777777",
    "8888888888",
    "9999999999",
    "1234567890",
    "0123456789",
    "9876543210",
}


def phone_digits(phone):
    """Return only digits from a phone number or generated phone email."""
    if not phone:
        return ""
    generated = GENERATED_PHONE_EMAIL_REGEX.match(str(phone).strip())
    if generated:
        return generated.group(1)
    return re.sub(r"\D", "", str(phone))


def canonical_phone_digits(phone):
    """Return one comparable digit key for the same phone number.

    The project mainly uses Indian numbers. These must all be treated as
    the same account:
      8798765177
      918798765177
      +918798765177
      0 8798765177
      phone_918798765177@learninghub.local
    """
    digits = phone_digits(phone)
    if not digits:
        return ""

    # Remove common local trunk prefix: 08798765177 -> 8798765177
    if len(digits) == 11 and digits.startswith("0"):
        digits = digits[1:]

    # 10-digit Indian mobile number -> add country code 91
    if len(digits) == 10:
        return "91" + digits

    # Already has country code, for example 918798765177
    if len(digits) == 12 and digits.startswith("91"):
        return digits

    return digits


def normalize_phone(phone):
    """Store phone numbers in canonical E.164-like format.

    For Indian numbers, every valid version is saved as +91XXXXXXXXXX.
    This prevents duplicate LMS accounts for the same mobile number.
    """
    canonical = canonical_phone_digits(phone)
    if not canonical:
        return None
    return "+" + canonical


def indian_mobile_local_digits(phone):
    """Return the 10-digit Indian mobile number or empty string if not Indian format."""
    canonical = canonical_phone_digits(phone)
    if len(canonical) == 12 and canonical.startswith("91"):
        return canonical[2:]
    return ""


def phone_validation_error(phone):
    """Return None if phone is acceptable, otherwise a user-friendly error message."""
    if phone is None or str(phone).strip() == "":
        return None

    local10 = indian_mobile_local_digits(phone)

    if len(local10) != 10:
        return "Phone number must be a valid 10-digit Indian mobile number."

    if local10[0] not in ("6", "7", "8", "9"):
        return "Phone number must start with 6, 7, 8, or 9."

    if len(set(local10)) == 1 or local10 in BLOCKED_INDIAN_MOBILE_NUMBERS:
        return "Please enter a real phone number, not a repeated or test number."

    return None


def is_valid_phone(phone):
    """Accept only realistic Indian mobile numbers and store them as +91XXXXXXXXXX."""
    return phone_validation_error(phone) is None


def validate_and_normalize_phone(phone):
    """Validate phone from Register/Profile and return +91XXXXXXXXXX or None."""
    if phone is None or str(phone).strip() == "":
        return None

    error = phone_validation_error(phone)
    if error:
        raise ValueError(error)

    return "+91" + indian_mobile_local_digits(phone)


def generated_email_phone(email):
    match = GENERATED_PHONE_EMAIL_REGEX.match(email or "")
    return normalize_phone(match.group(1)) if match else None


def phone_variants(phone):
    """Return all old/new stored forms for the same phone number.

    This intentionally includes +91..., 91..., and the 10-digit local part
    so OTP login can find old rows and always open the same LMS account.
    """
    canonical = canonical_phone_digits(phone)
    if not canonical:
        return []

    variants = ["+" + canonical, canonical]

    # Indian local forms. Example: canonical 918798765177 -> 8798765177
    if canonical.startswith("91") and len(canonical) == 12:
        local10 = canonical[2:]
        variants.extend([local10, "0" + local10])

    return list(dict.fromkeys(v for v in variants if v))


def phone_digit_keys(phone):
    """Digit-only keys used for database comparisons."""
    canonical = canonical_phone_digits(phone)
    if not canonical:
        return []
    keys = [canonical]
    if canonical.startswith("91") and len(canonical) == 12:
        keys.append(canonical[2:])
        keys.append("0" + canonical[2:])
    return list(dict.fromkeys(keys))


def generated_phone_emails(phone):
    """Possible fake local emails produced for phone-only users."""
    emails = []
    for variant in phone_variants(phone):
        digits = "".join(ch for ch in variant if ch.isdigit())
        if digits:
            emails.append(f"phone_{digits}@learninghub.local")
    return list(dict.fromkeys(emails))


def is_generated_phone_account(name, email):
    return bool(GENERATED_PHONE_EMAIL_REGEX.match(email or "") or re.match(r"^phone\s+\d+$", name or "", re.IGNORECASE))


def ensure_users_phone_column(cur):
    """Add a phone column if this older project database does not have one yet."""
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(25)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)")


def ensure_users_profile_photo_column(cur):
    """Add a profile_photo column so uploaded reward photos sync across devices."""
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT")


def create_supabase_email_user(email, password, name, role):
    """Create a matching Supabase Auth user so email confirmation is enforced.

    Supabase sends the confirmation email when Confirm Email is enabled in
    Authentication -> Providers -> Email. The local users table still stores
    the LMS profile, but login is blocked until auth.users.email_confirmed_at
    is filled by Supabase.
    """
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")

    if not supabase_url or not supabase_anon_key:
        # Do not break local development if Supabase Auth is not configured.
        return

    redirect_to = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/") + "/login"

    payload = json.dumps(
        {
            "email": email,
            "password": password,
            "data": {"name": name, "full_name": name, "requested_role": role},
            "gotrue_meta_security": {},
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        f"{supabase_url}/auth/v1/signup?redirect_to={urllib.parse.quote(redirect_to, safe='')}",
        data=payload,
        headers={
            "apikey": supabase_anon_key,
            "Authorization": f"Bearer {supabase_anon_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        lower_detail = detail.lower()
        # If the Supabase user already exists, let local duplicate checks handle it.
        if "already" in lower_detail or "registered" in lower_detail or "exists" in lower_detail:
            return
        raise ValueError(f"Supabase signup failed: {detail}")




def extract_auth_id_from_signup_response(signup_data):
    """Handle both Supabase REST response shapes and return the Auth UID."""
    if not signup_data:
        return None
    wrapped_user = signup_data.get("user")
    if isinstance(wrapped_user, dict) and wrapped_user.get("id"):
        return wrapped_user.get("id")
    return signup_data.get("id")


def find_auth_user_id_by_email(cur, email):
    """Fallback lookup when the signup response does not include an id."""
    if not email:
        return None
    try:
        cur.execute(
            """
            SELECT id
            FROM auth.users
            WHERE lower(email) = lower(%s)
            ORDER BY created_at DESC
            LIMIT 1;
            """,
            (email,),
        )
        row = cur.fetchone()
        return row[0] if row else None
    except Exception:
        current_app.logger.exception("Could not find Supabase Auth id by email")
        return None


def verify_supabase_email_password(email, password):
    """Verify email/password with Supabase Auth and return Supabase Auth data.

    Supabase Auth is now the only password checker. The local
    users.password_hash column is kept for old data compatibility only.
    """
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")

    if not supabase_url or not supabase_anon_key:
        raise ValueError("Supabase Auth is not configured in backend .env")

    payload = json.dumps({"email": email, "password": password}).encode("utf-8")
    req = urllib.request.Request(
        f"{supabase_url}/auth/v1/token?grant_type=password",
        data=payload,
        headers={
            "apikey": supabase_anon_key,
            "Authorization": f"Bearer {supabase_anon_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            auth_data = json.loads(response.read().decode("utf-8"))
            auth_user = auth_data.get("user") or {}
            if not (auth_user.get("email_confirmed_at") or auth_user.get("confirmed_at")):
                raise PermissionError("Please confirm your email before logging in. Check your inbox or spam folder.")
            return auth_data
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        try:
            parsed = json.loads(detail)
            message = parsed.get("msg") or parsed.get("message") or parsed.get("error_description") or detail
        except Exception:
            message = detail
        lower_message = (message or "").lower()
        if "email not confirmed" in lower_message or "not confirmed" in lower_message or "confirm" in lower_message:
            raise PermissionError("Please confirm your email before logging in. Check your inbox or spam folder.")
        raise PermissionError("Invalid email or password")


def ensure_auth_profile_columns(cur):
    """Make older project databases compatible with the Supabase Auth-first flow."""
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_id UUID")
    cur.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(25)")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_users_auth_id ON users(auth_id)")
    cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS users_auth_id_unique_not_null ON users(auth_id) WHERE auth_id IS NOT NULL")
    cur.execute("CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)")


def find_or_create_local_user_for_auth(cur, auth_user, fallback_name=None, fallback_role="student"):
    """Find/create the app profile for a Supabase Auth session.

    Fixes the old phone OTP duplicate-account problem:
    if a user first registered with email, then added a phone in Profile,
    later OTP login with that same phone will open the SAME public.users row.

    We also avoid overwriting an existing email/Google auth_id with a separate
    phone Auth id. The LMS account is returned by phone match, but auth_id stays
    as the primary stable link when it already exists.
    """
    ensure_auth_profile_columns(cur)

    auth_id = auth_user.get("id")
    email = (auth_user.get("email") or "").strip().lower()
    phone = normalize_phone(auth_user.get("phone"))
    metadata = auth_user.get("user_metadata") or {}
    name = (
        fallback_name
        or metadata.get("full_name")
        or metadata.get("name")
        or metadata.get("display_name")
        or (email.split("@")[0].replace("_", " ").title() if email else "Student")
    )

    select_cols = "id, name, role, semester_id, status, email, phone, auth_id"

    # 1) Exact auth_id match.
    if auth_id:
        cur.execute(
            f"SELECT {select_cols} FROM users WHERE auth_id = %s LIMIT 1",
            (auth_id,),
        )
        row = cur.fetchone()
        if row:
            return row[:7]

    # 2) Email match. This links old rows and keeps Google/email accounts together.
    if email:
        cur.execute(
            f"SELECT {select_cols} FROM users WHERE lower(email) = lower(%s) LIMIT 1",
            (email,),
        )
        row = cur.fetchone()
        if row:
            updates = []
            values = []
            existing_auth_id = row[7]
            if auth_id and not existing_auth_id:
                updates.append("auth_id = %s")
                values.append(auth_id)
            if phone and row[6] != phone:
                updates.append("phone = %s")
                values.append(phone)
            if updates:
                values.append(row[0])
                cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = %s", tuple(values))
                cur.execute(f"SELECT {select_cols} FROM users WHERE id = %s", (row[0],))
                row = cur.fetchone()
            return row[:7]

    # 3) Phone match. This is the critical behavior for OTP login.
    if phone:
        variants = phone_variants(phone)
        digit_keys = phone_digit_keys(phone)
        phone_emails = generated_phone_emails(phone)
        cur.execute(
            f"""
            SELECT {select_cols}
            FROM users
            WHERE phone = ANY(%s)
               OR regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = ANY(%s)
               OR lower(email) = ANY(%s)
            ORDER BY
              CASE WHEN phone IS NOT NULL AND trim(phone) <> '' THEN 0 ELSE 1 END,
              id ASC
            LIMIT 1;
            """,
            (variants, digit_keys, [e.lower() for e in phone_emails]),
        )
        row = cur.fetchone()
        if row:
            updates = []
            values = []
            existing_auth_id = row[7]
            # Fill auth_id only for old rows that do not already have one.
            # Do not replace an email account's auth_id with the phone Auth id.
            if auth_id and not existing_auth_id:
                updates.append("auth_id = %s")
                values.append(auth_id)
            if phone and row[6] != phone:
                updates.append("phone = %s")
                values.append(phone)
            if updates:
                values.append(row[0])
                cur.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = %s", tuple(values))
                cur.execute(f"SELECT {select_cols} FROM users WHERE id = %s", (row[0],))
                row = cur.fetchone()
            return row[:7]

    # 4) New phone-only login with no existing profile.
    if not email and phone:
        email = generated_phone_emails(phone)[0]
        if not name or name == "Student":
            name = "Phone " + canonical_phone_digits(phone)

    random_password_hash = hash_password(secrets.token_urlsafe(32))
    cur.execute(
        """
        INSERT INTO users (auth_id, name, email, phone, password_hash, role, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id, name, role, semester_id, status, email, phone;
        """,
        (auth_id, name, email, phone, random_password_hash, fallback_role, "active"),
    )
    return cur.fetchone()
def is_supabase_email_confirmed(cur, email):
    """Return True/False when a Supabase Auth row exists, or None for legacy users.

    Existing local accounts that were created before Supabase Auth was added
    are allowed to keep logging in if no auth.users row exists.
    """
    try:
        cur.execute(
            """
            SELECT email_confirmed_at, confirmed_at
            FROM auth.users
            WHERE lower(email) = lower(%s)
            ORDER BY created_at DESC
            LIMIT 1;
            """,
            (email,),
        )
        row = cur.fetchone()
        if not row:
            return None
        return bool(row[0] or row[1])
    except Exception:
        # If auth schema is not accessible in a local DB, do not crash login.
        current_app.logger.exception("Could not check Supabase email confirmation")
        return None


def create_app_token(user_id, role, name):
    return jwt.encode(
        {
            "user_id": user_id,
            "role": role,
            "name": name,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(days=1),
        },
        current_app.config["SECRET_KEY"],
        algorithm="HS256",
    )


def get_supabase_user(access_token):
    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_anon_key:
        raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in backend .env")

    req = urllib.request.Request(
        f"{supabase_url}/auth/v1/user",
        headers={
            "apikey": supabase_anon_key,
            "Authorization": f"Bearer {access_token}",
        },
        method="GET",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise ValueError(f"Invalid Supabase session: {detail}")


def user_payload_from_row(user):
    user_id, name, role, semester_id, status = user

    if status == "blocked":
        raise PermissionError("Your account is blocked. Contact admin.")

    token = create_app_token(user_id, role, name)
    return {
        "message": "Login successful",
        "token": token,
        "role": role,
        "name": name,
        "semester_id": semester_id,
    }



# ---------------------------------------
# REGISTER
# ---------------------------------------
@auth_bp.route("/register", methods=["POST"])
def register():
    try:
        data = request.get_json() or {}

        name = (data.get("name") or "").strip()
        email = (data.get("email") or "").strip().lower()
        try:
            phone = validate_and_normalize_phone(data.get("phone"))
        except ValueError as phone_error:
            return jsonify({"error": str(phone_error)}), 400
        password = data.get("password")
        requested_role = (data.get("role") or "student").lower()
        semester_id = data.get("semester_id") or None

        # Public registration never creates admin directly.
        # Admin registration creates a student first, then sends an approval request.
        role = "student"

        if not name or not email or not password:
            return jsonify({"error": "Full name, email, and password are required"}), 400

        if not is_valid_email(email):
            return jsonify({"error": "Please enter a valid email address, for example name@gmail.com"}), 400

        if phone and not is_valid_phone(phone):
            return jsonify({"error": "Please enter a valid Indian mobile number, for example +919876543210"}), 400

        if len(password) < 6:
            return jsonify({"error": "Password must be at least 6 characters"}), 400

        if requested_role not in ("student", "admin"):
            return jsonify({"error": "Invalid role selected"}), 400

        if semester_id not in (None, ""):
            try:
                semester_id = int(semester_id)
            except (TypeError, ValueError):
                return jsonify({"error": "Semester must be a number"}), 400
            if semester_id < 1 or semester_id > 6:
                return jsonify({"error": "Semester must be between 1 and 6"}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        ensure_auth_profile_columns(cur)
        ensure_users_phone_column(cur)

        # Check email before Supabase signup so the user gets a clean message.
        cur.execute("SELECT id FROM users WHERE lower(email) = lower(%s) LIMIT 1;", (email,))
        existing_user = cur.fetchone()
        if existing_user:
            cur.close()
            conn.close()
            return jsonify({"error": "Email already registered"}), 409

        # Check phone before Supabase signup so one phone cannot create multiple accounts.
        if phone:
            variants = phone_variants(phone)
            digit_keys = phone_digit_keys(phone)
            generated_emails = generated_phone_emails(phone)
            cur.execute(
                """
                SELECT id, name, email, phone
                FROM users
                WHERE phone = ANY(%s)
                   OR regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = ANY(%s)
                   OR lower(email) = ANY(%s)
                LIMIT 1;
                """,
                (variants, digit_keys, [e.lower() for e in generated_emails]),
            )
            phone_conflict = cur.fetchone()
            if phone_conflict:
                cur.close()
                conn.close()
                return jsonify({"error": "This phone number is already linked to another account"}), 409

        # Supabase Auth is the real login/password system.
        signup_data = create_supabase_email_user(email, password, name, requested_role) or {}
        auth_id = extract_auth_id_from_signup_response(signup_data) or find_auth_user_id_by_email(cur, email)

        if not auth_id:
            cur.close()
            conn.close()
            return jsonify({
                "error": "Supabase account was created, but Auth ID was not returned. Please try again or check Authentication > Users."
            }), 500

        cur.execute(
            """
            INSERT INTO users (auth_id, name, email, phone, password_hash, role, status, semester_id)
            VALUES (%s, %s, %s, %s, NULL, %s, %s, %s)
            RETURNING id;
            """,
            (auth_id, name, email, phone, role, "active", semester_id),
        )
        user_id = cur.fetchone()[0]

        response_data = {
            "message": "User registered successfully",
            "user_id": user_id,
            "role": "student",
            "auth_id": auth_id,
        }

        if requested_role == "admin":
            expires_at = datetime.datetime.utcnow() + datetime.timedelta(hours=48)
            cur.execute(
                """
                INSERT INTO admin_requests (user_id, status, created_at, expires_at)
                VALUES (%s, %s, NOW(), %s)
                RETURNING id;
                """,
                (user_id, "pending", expires_at),
            )
            request_id = cur.fetchone()[0]
            response_data = {
                "message": "Registered as student. Waiting for instructor approval.",
                "user_id": user_id,
                "role": "student",
                "auth_id": auth_id,
                "request_id": request_id,
                "request_status": "pending",
                "expires_at": expires_at.isoformat() + "Z",
            }

        conn.commit()
        cur.close()
        conn.close()

        return jsonify(response_data), 201

    except ValueError as e:
        msg = str(e)
        # Clean Supabase JSON errors before sending to frontend.
        if "{" in msg:
            try:
                parsed = json.loads(msg[msg.index("{"):])
                msg = parsed.get("msg") or parsed.get("message") or parsed.get("error_description") or parsed.get("error") or msg
            except Exception:
                pass
        return jsonify({"error": msg}), 400

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------
# LOGIN
# ---------------------------------------
@auth_bp.route("/login", methods=["POST"])
def login():
    try:
        data = request.get_json() or {}

        email = (data.get("email") or "").strip().lower()
        password = data.get("password")

        if not email or not password:
            return jsonify({"error": "Email and password required"}), 400

        if not is_valid_email(email):
            return jsonify({"error": "Please enter a valid email address"}), 400

        # Supabase Auth is the source of truth for password, email confirmation,
        # forgot-password, and future email changes.
        try:
            auth_data = verify_supabase_email_password(email, password)
        except PermissionError as auth_error:
            return jsonify({"error": str(auth_error)}), 401

        auth_user = auth_data.get("user") or {}

        conn = get_db_connection()
        cur = conn.cursor()
        ensure_auth_profile_columns(cur)

        user_row = find_or_create_local_user_for_auth(cur, auth_user)
        conn.commit()

        user_id, name, role, semester_id, status = user_row[:5]

        if status == "blocked":
            cur.close()
            conn.close()
            return jsonify({"error": "Your account is blocked. Contact admin."}), 403

        admin_request_status = None
        if role == "student":
            cur.execute(
                """
                SELECT id, status, expires_at
                FROM admin_requests
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT 1;
                """,
                (user_id,),
            )
            latest_request = cur.fetchone()

            if latest_request:
                req_id, req_status, expires_at = latest_request
                if req_status == "pending" and expires_at is not None:
                    if datetime.datetime.utcnow() > expires_at:
                        cur.execute(
                            """
                            UPDATE admin_requests
                            SET status = 'rejected', reviewed_at = NOW()
                            WHERE id = %s;
                            """,
                            (req_id,),
                        )
                        conn.commit()
                        req_status = "rejected"
                admin_request_status = req_status

        token = create_app_token(user_id, role, name)

        cur.close()
        conn.close()

        return jsonify(
            {
                "message": "Login successful",
                "token": token,
                "role": role,
                "name": name,
                "semester_id": semester_id,
                "admin_request_status": admin_request_status,
                "supabase_session": {
                    "access_token": auth_data.get("access_token"),
                    "refresh_token": auth_data.get("refresh_token"),
                },
            }
        ), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------
# CHECK ADMIN REQUEST STATUS
# ---------------------------------------
@auth_bp.route("/admin-request-status/<int:request_id>", methods=["GET"])
def admin_request_status(request_id):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT id, status, expires_at
            FROM admin_requests
            WHERE id = %s;
            """,
            (request_id,),
        )
        req = cur.fetchone()

        if not req:
            cur.close()
            conn.close()
            return jsonify({"error": "Request not found"}), 404

        req_id, status, expires_at = req

        if status == "pending" and expires_at is not None:
            if datetime.datetime.utcnow() > expires_at:
                cur.execute(
                    """
                    UPDATE admin_requests
                    SET status = 'rejected', reviewed_at = NOW()
                    WHERE id = %s;
                    """,
                    (req_id,),
                )
                conn.commit()
                status = "rejected"

        cur.close()
        conn.close()

        return jsonify({"status": status}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------
# INSTRUCTOR: VIEW PENDING ADMIN REQUESTS
# ---------------------------------------
@auth_bp.route("/admin-requests/pending", methods=["GET"])
@jwt_required
def get_pending_admin_requests(current_user):
    try:
        if current_user["role"] != "instructor":
            return jsonify({"error": "Only instructor can view admin requests"}), 403

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
            UPDATE admin_requests
            SET status = 'rejected', reviewed_at = NOW()
            WHERE status = 'pending'
              AND expires_at IS NOT NULL
              AND expires_at < NOW();
            """
        )

        cur.execute(
            """
            SELECT ar.id, ar.user_id, ar.status, ar.created_at, ar.expires_at, u.name, u.email
            FROM admin_requests ar
            JOIN users u ON ar.user_id = u.id
            WHERE ar.status = 'pending'
            ORDER BY ar.created_at ASC;
            """
        )
        requests_data = cur.fetchall()

        conn.commit()
        cur.close()
        conn.close()

        results = []
        for row in requests_data:
            results.append(
                {
                    "request_id": row[0],
                    "user_id": row[1],
                    "status": row[2],
                    "created_at": row[3].isoformat() if row[3] else None,
                    "expires_at": row[4].isoformat() if row[4] else None,
                    "name": row[5],
                    "email": row[6],
                }
            )

        return jsonify(results), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------
# INSTRUCTOR: APPROVE ADMIN REQUEST
# ---------------------------------------
@auth_bp.route("/admin-requests/<int:request_id>/approve", methods=["POST"])
@jwt_required
def approve_admin_request(current_user, request_id):
    try:
        if current_user["role"] != "instructor":
            return jsonify({"error": "Only instructor can approve requests"}), 403

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
            SELECT user_id, status, expires_at
            FROM admin_requests
            WHERE id = %s;
            """,
            (request_id,),
        )
        req = cur.fetchone()

        if not req:
            cur.close()
            conn.close()
            return jsonify({"error": "Request not found"}), 404

        user_id, status, expires_at = req

        if status != "pending":
            cur.close()
            conn.close()
            return jsonify({"error": f"Request already {status}"}), 400

        if expires_at is not None and datetime.datetime.utcnow() > expires_at:
            cur.execute(
                """
                UPDATE admin_requests
                SET status = 'rejected', reviewed_at = NOW(), reviewed_by = %s
                WHERE id = %s;
                """,
                (current_user["id"], request_id),
            )
            conn.commit()
            cur.close()
            conn.close()
            return jsonify({"error": "Request expired and has been rejected"}), 400

        cur.execute("UPDATE users SET role = 'admin' WHERE id = %s;", (user_id,))
        cur.execute(
            """
            UPDATE admin_requests
            SET status = 'approved', reviewed_at = NOW(), reviewed_by = %s
            WHERE id = %s;
            """,
            (current_user["id"], request_id),
        )

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": "Admin request approved successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------
# INSTRUCTOR: REJECT ADMIN REQUEST
# ---------------------------------------
@auth_bp.route("/admin-requests/<int:request_id>/reject", methods=["POST"])
@jwt_required
def reject_admin_request(current_user, request_id):
    try:
        if current_user["role"] != "instructor":
            return jsonify({"error": "Only instructor can reject requests"}), 403

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute("SELECT status FROM admin_requests WHERE id = %s;", (request_id,))
        req = cur.fetchone()

        if not req:
            cur.close()
            conn.close()
            return jsonify({"error": "Request not found"}), 404

        status = req[0]
        if status != "pending":
            cur.close()
            conn.close()
            return jsonify({"error": f"Request already {status}"}), 400

        cur.execute(
            """
            UPDATE admin_requests
            SET status = 'rejected', reviewed_at = NOW(), reviewed_by = %s
            WHERE id = %s;
            """,
            (current_user["id"], request_id),
        )

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": "Admin request rejected successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------
# SET SEMESTER
# ---------------------------------------
@auth_bp.route("/set-semester", methods=["POST"])
@jwt_required
def set_semester(current_user):
    try:
        data = request.get_json()
        semester_id = data.get("semester_id")

        if not semester_id:
            return jsonify({"error": "Semester is required"}), 400

        conn = get_db_connection()
        cur = conn.cursor()

        cur.execute(
            """
            UPDATE users
            SET semester_id = %s
            WHERE id = %s
            """,
            (semester_id, current_user["id"]),
        )

        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": "Semester updated successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------
# GET ME
# ---------------------------------------
@auth_bp.route("/me", methods=["GET"])
@jwt_required
def get_me(current_user):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        ensure_users_phone_column(cur)
        ensure_users_profile_photo_column(cur)
        conn.commit()

        cur.execute(
            """
            SELECT id, name, email, role, status, semester_id, phone, profile_photo
            FROM users
            WHERE id = %s
            """,
            (current_user["id"],),
        )
        user = cur.fetchone()

        if not user:
            cur.close()
            conn.close()
            return jsonify({"error": "User not found"}), 404

        cur.execute("SELECT COUNT(*) FROM courses WHERE semester_id = %s", (user[5],))
        courses_count = cur.fetchone()[0] if user[5] else 0

        cur.execute("SELECT COUNT(*) FROM lesson_completions WHERE user_id = %s", (current_user["id"],))
        completed_lessons = cur.fetchone()[0]

        cur.execute(
            "SELECT COALESCE(SUM(score), 0) FROM mock_test_results WHERE user_id = %s",
            (current_user["id"],),
        )
        mock_test_total_score = cur.fetchone()[0]

        cur.execute(
            """
            SELECT c.title, l.title, ROUND((r.score::decimal / NULLIF(r.total, 0)) * 100, 2) AS percentage
            FROM quiz_results r
            JOIN lessons l ON r.lesson_id = l.id
            JOIN courses c ON l.course_id = c.id
            WHERE r.user_id = %s
            ORDER BY r.created_at DESC
            LIMIT 5
            """,
            (current_user["id"],),
        )
        recent_quiz_results = cur.fetchall()

        cur.close()
        conn.close()

        return jsonify(
            {
                "id": user[0],
                "name": user[1],
                "email": user[2],
                "role": user[3],
                "status": user[4],
                "semester_id": user[5],
                "phone": normalize_phone(user[6]) or generated_email_phone(user[2]),
                "profile_photo": user[7] or "",
                "courses_count": courses_count,
                "completed_lessons": completed_lessons,
                "mock_test_total_score": mock_test_total_score,
                "recent_quiz_results": [
                    {
                        "course_title": row[0],
                        "lesson_title": row[1],
                        "percentage": float(row[2]) if row[2] is not None else 0,
                    }
                    for row in recent_quiz_results
                ],
            }
        ), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------
# UPDATE ME
# ---------------------------------------
@auth_bp.route("/me", methods=["PUT"])
@jwt_required
def update_me(current_user):
    try:
        data = request.get_json() or {}
        name = (data.get("name") or "").strip()
        email = (data.get("email") or "").strip().lower()
        try:
            phone = validate_and_normalize_phone(data.get("phone"))
        except ValueError as phone_error:
            return jsonify({"error": str(phone_error)}), 400
        semester_id = data.get("semester_id") or None
        profile_photo = data.get("profile_photo")
        if isinstance(profile_photo, str):
            profile_photo = profile_photo.strip()
        else:
            profile_photo = None

        if profile_photo and not profile_photo.startswith("data:image/"):
            return jsonify({"error": "Profile photo must be a valid image upload."}), 400

        if profile_photo and len(profile_photo) > 2_500_000:
            return jsonify({"error": "Profile photo is too large. Please upload a smaller image."}), 400

        if name and len(name) < 2:
            return jsonify({"error": "Name must be at least 2 characters"}), 400

        if email and not is_valid_email(email):
            return jsonify({"error": "Please enter a valid email address, for example name@gmail.com"}), 400

        if phone and not is_valid_phone(phone):
            return jsonify({"error": "Please enter a valid Indian mobile number, for example +919876543210"}), 400

        if semester_id not in (None, ""):
            try:
                semester_id = int(semester_id)
            except (TypeError, ValueError):
                return jsonify({"error": "Semester must be a number"}), 400
            if semester_id < 1 or semester_id > 6:
                return jsonify({"error": "Semester must be between 1 and 6"}), 400

        conn = get_db_connection()
        cur = conn.cursor()
        ensure_users_phone_column(cur)
        ensure_users_profile_photo_column(cur)

        if email:
            cur.execute("SELECT email FROM users WHERE id = %s", (current_user["id"],))
            current_email_row = cur.fetchone()
            current_email = (current_email_row[0] or "").lower() if current_email_row else ""
            if email != current_email:
                cur.close()
                conn.close()
                return jsonify({"error": "Login email cannot be changed from profile. Use the Supabase email-change/confirmation flow so your login account stays synced."}), 400

        if phone:
            variants = phone_variants(phone)
            digit_keys = phone_digit_keys(phone)
            generated_emails = generated_phone_emails(phone)
            cur.execute(
                """
                SELECT id, name, email, phone
                FROM users
                WHERE id <> %s
                  AND (
                    phone = ANY(%s)
                    OR regexp_replace(COALESCE(phone, ''), '\\D', '', 'g') = ANY(%s)
                    OR lower(email) = ANY(%s)
                  )
                LIMIT 1;
                """,
                (current_user["id"], variants, digit_keys, [e.lower() for e in generated_emails]),
            )
            phone_conflict = cur.fetchone()
            if phone_conflict:
                conflict_id, conflict_name, conflict_email, conflict_phone = phone_conflict
                # If the conflict is only the auto-created placeholder account from an old
                # phone OTP login, detach that placeholder and link the phone to this real
                # account. This fixes: email account and phone account becoming separate users.
                if is_generated_phone_account(conflict_name, conflict_email):
                    cur.execute(
                        """
                        UPDATE users
                        SET phone = NULL, status = COALESCE(status, 'active')
                        WHERE id = %s;
                        """,
                        (conflict_id,),
                    )
                else:
                    cur.close()
                    conn.close()
                    return jsonify({"error": "This phone number is already linked to another account"}), 409

        fields = []
        values = []
        if name:
            fields.append("name = %s")
            values.append(name)
        if phone:
            fields.append("phone = %s")
            values.append(phone)
        if semester_id not in (None, ""):
            fields.append("semester_id = %s")
            values.append(semester_id)
        if profile_photo:
            fields.append("profile_photo = %s")
            values.append(profile_photo)

        if not fields:
            cur.close()
            conn.close()
            return jsonify({"error": "Nothing to update"}), 400

        values.append(current_user["id"])
        cur.execute(f"UPDATE users SET {', '.join(fields)} WHERE id = %s", tuple(values))
        conn.commit()
        cur.close()
        conn.close()

        return jsonify({"message": "Profile updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ---------------------------------------
# FORGOT PASSWORD REQUEST
# ---------------------------------------
@auth_bp.route("/forgot-password", methods=["POST"])
def forgot_password():
    """Send a Supabase Auth password reset email."""
    try:
        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()

        if not email:
            return jsonify({"error": "Email is required"}), 400
        if not is_valid_email(email):
            return jsonify({"error": "Please enter a valid email address"}), 400

        supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
        supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
        if not supabase_url or not supabase_anon_key:
            return jsonify({"error": "Supabase Auth is not configured in backend .env"}), 500

        redirect_to = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/") + "/reset-password"
        payload = json.dumps({"email": email, "gotrue_meta_security": {}}).encode("utf-8")
        req = urllib.request.Request(
            f"{supabase_url}/auth/v1/recover?redirect_to={urllib.parse.quote(redirect_to, safe='')}",
            data=payload,
            headers={
                "apikey": supabase_anon_key,
                "Authorization": f"Bearer {supabase_anon_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        # Supabase intentionally returns a generic response so accounts are not leaked.
        try:
            with urllib.request.urlopen(req, timeout=20):
                pass
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode("utf-8", errors="ignore")
            current_app.logger.warning("Supabase password recovery request failed: %s", detail)

        return jsonify({
            "message": "If this email exists, Supabase has sent a password reset link."
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ---------------------------------------
# SUPABASE GOOGLE / PHONE OTP LOGIN
# ---------------------------------------
@auth_bp.route("/supabase-login", methods=["POST"])
def supabase_login():
    """Accept a Supabase Auth session and return this project's normal JWT.

    Google login, phone OTP, and email sessions are completed by Supabase on the
    frontend. This endpoint verifies the Supabase access token, finds/creates the
    local app profile using auth_id, and returns the LMS JWT.
    """
    try:
        data = request.get_json() or {}
        access_token = data.get("access_token")

        if not access_token:
            return jsonify({"error": "Supabase access token is required"}), 400

        supabase_user = get_supabase_user(access_token)

        conn = get_db_connection()
        cur = conn.cursor()
        ensure_auth_profile_columns(cur)

        user_row = find_or_create_local_user_for_auth(cur, supabase_user)
        conn.commit()

        user = user_row[:5]
        payload = user_payload_from_row(user)

        cur.close()
        conn.close()

        return jsonify(payload), 200

    except PermissionError as e:
        return jsonify({"error": str(e)}), 403
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@auth_bp.route("/google-login", methods=["POST"])
def google_login():
    return jsonify({
        "error": "Use the frontend Supabase Google OAuth flow. Configure Google provider in Supabase Auth."
    }), 400


@auth_bp.route("/send-phone-otp", methods=["POST"])
def send_phone_otp():
    return jsonify({
        "error": "Phone OTP is now handled by Supabase Auth on the frontend. Configure a Supabase SMS provider."
    }), 400


@auth_bp.route("/verify-phone-otp", methods=["POST"])
def verify_phone_otp():
    return jsonify({
        "error": "Phone OTP verification is now handled by Supabase Auth on the frontend."
    }), 400

"""Server-side authorization helpers for Learning Hub.

These checks prevent IDOR/direct URL access such as a student guessing another
course/unit/topic/lesson/enrollment id. Frontend route guards are not enough;
every sensitive API route must verify ownership or semester/enrollment access.
"""

PRIVILEGED_ROLES = {"admin", "instructor"}


def is_privileged(current_user):
    return (current_user or {}).get("role") in PRIVILEGED_ROLES


def get_user_semester(current_user):
    return (current_user or {}).get("semester_id")


def require_course_access(cur, current_user, course_id, require_enrollment=False):
    """Return (allowed, row). Row is (course_id, title, description, semester_id)."""
    cur.execute(
        """
        SELECT id, title, description, semester_id
        FROM courses
        WHERE id = %s
        """,
        (course_id,),
    )
    course = cur.fetchone()
    if not course:
        return False, None

    if is_privileged(current_user):
        return True, course

    if course[3] != get_user_semester(current_user):
        return False, course

    if require_enrollment:
        cur.execute(
            """
            SELECT id
            FROM enrollments
            WHERE student_id = %s AND course_id = %s
            LIMIT 1
            """,
            (current_user.get("id"), course_id),
        )
        if not cur.fetchone():
            return False, course

    return True, course


def require_unit_access(cur, current_user, unit_id=None, course_id=None, require_enrollment=True):
    """Return (allowed, row). Row is (unit_id, unit_title, course_id, course_title, semester_id)."""
    if unit_id is not None:
        cur.execute(
            """
            SELECT u.id, u.title, c.id, c.title, c.semester_id
            FROM units u
            JOIN courses c ON c.id = u.course_id
            WHERE u.id = %s
            """,
            (unit_id,),
        )
    else:
        cur.execute(
            """
            SELECT NULL::integer, NULL::text, c.id, c.title, c.semester_id
            FROM courses c
            WHERE c.id = %s
            """,
            (course_id,),
        )
    row = cur.fetchone()
    if not row:
        return False, None

    if is_privileged(current_user):
        return True, row

    if row[4] != get_user_semester(current_user):
        return False, row

    if require_enrollment:
        cur.execute(
            """
            SELECT id
            FROM enrollments
            WHERE student_id = %s AND course_id = %s
            LIMIT 1
            """,
            (current_user.get("id"), row[2]),
        )
        if not cur.fetchone():
            return False, row

    return True, row


def require_topic_access(cur, current_user, topic_id, require_enrollment=True):
    """Return (allowed, context dict)."""
    cur.execute(
        """
        SELECT t.id, t.title, t.unit_id, u.title, c.id, c.title, c.semester_id
        FROM topics t
        JOIN units u ON u.id = t.unit_id
        JOIN courses c ON c.id = u.course_id
        WHERE t.id = %s
        """,
        (topic_id,),
    )
    row = cur.fetchone()
    if not row:
        return False, None

    context = {
        "topic_id": row[0],
        "topic_title": row[1],
        "unit_id": row[2],
        "unit_title": row[3],
        "course_id": row[4],
        "course_title": row[5],
        "semester_id": row[6],
    }

    if is_privileged(current_user):
        return True, context

    if row[6] != get_user_semester(current_user):
        return False, context

    if require_enrollment:
        cur.execute(
            """
            SELECT id
            FROM enrollments
            WHERE student_id = %s AND course_id = %s
            LIMIT 1
            """,
            (current_user.get("id"), row[4]),
        )
        if not cur.fetchone():
            return False, context

    return True, context


def require_lesson_access(cur, current_user, lesson_id, require_enrollment=True):
    """Return (allowed, row). Row is (lesson_id, course_id, semester_id)."""
    cur.execute(
        """
        SELECT l.id, l.course_id, c.semester_id
        FROM lessons l
        JOIN courses c ON c.id = l.course_id
        WHERE l.id = %s
        """,
        (lesson_id,),
    )
    row = cur.fetchone()
    if not row:
        return False, None

    if is_privileged(current_user):
        return True, row

    if row[2] != get_user_semester(current_user):
        return False, row

    if require_enrollment:
        cur.execute(
            """
            SELECT id
            FROM enrollments
            WHERE student_id = %s AND course_id = %s
            LIMIT 1
            """,
            (current_user.get("id"), row[1]),
        )
        if not cur.fetchone():
            return False, row

    return True, row

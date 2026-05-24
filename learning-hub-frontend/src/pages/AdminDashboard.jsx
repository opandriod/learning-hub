import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/api";
import ThemeToggle from "../components/ThemeToggle";

const roleLabels = {
  student: "Student",
  sub_admin: "Sub-admin",
  admin: "Admin",
  instructor: "Instructor",
};

const statusLabels = {
  active: "Active",
  blocked: "Blocked",
  inactive: "Inactive",
};

function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [adminRequests, setAdminRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [semesterFilter, setSemesterFilter] = useState("all");

  const currentUserId = Number(localStorage.getItem("user_id") || 0);

  const fetchAdminData = async () => {
    setError("");
    try {
      const [dashboardRes, usersRes, requestsRes] = await Promise.allSettled([
        API.get("/admin/dashboard"),
        API.get("/admin/users"),
        API.get("/admin/admin-requests"),
      ]);

      if (dashboardRes.status === "fulfilled") {
        setDashboard(dashboardRes.value.data);
      }

      if (usersRes.status === "fulfilled") {
        setUsers(Array.isArray(usersRes.value.data) ? usersRes.value.data : []);
      } else {
        throw usersRes.reason;
      }

      if (requestsRes.status === "fulfilled") {
        setAdminRequests(Array.isArray(requestsRes.value.data) ? requestsRes.value.data : []);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load admin dashboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const stats = useMemo(() => {
    const totalUsers = users.length;
    const students = users.filter((user) => user.role === "student").length;
    const admins = users.filter((user) => user.role === "admin").length;
    const instructors = users.filter((user) => user.role === "instructor").length;
    const active = users.filter((user) => user.status === "active").length;
    const blocked = users.filter((user) => user.status === "blocked").length;
    const pendingRequests = adminRequests.filter((request) => request.status === "pending").length;

    return {
      totalUsers,
      students: dashboard?.total_students ?? students,
      admins: dashboard?.total_admins ?? admins,
      instructors,
      active,
      blocked,
      totalCourses: dashboard?.total_courses ?? 0,
      quizAttempts: dashboard?.total_quiz_attempts ?? 0,
      pendingRequests,
    };
  }, [dashboard, users, adminRequests]);

  const semesters = useMemo(() => {
    return [...new Set(users.map((user) => user.semester_id).filter(Boolean))].sort((a, b) => a - b);
  }, [users]);

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !normalizedSearch ||
        [user.name, user.email, user.phone, user.role, user.status]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedSearch));

      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      const matchesSemester = semesterFilter === "all" || String(user.semester_id || "none") === semesterFilter;

      return matchesSearch && matchesRole && matchesStatus && matchesSemester;
    });
  }, [users, search, roleFilter, statusFilter, semesterFilter]);

  const recentUsers = useMemo(() => users.slice(0, 5), [users]);
  const recentRequests = useMemo(() => adminRequests.slice(0, 5), [adminRequests]);

  const toggleUserStatus = async (user) => {
    if (user.role !== "student") {
      setError("Admin can block or unblock student accounts only. Instructor controls admin and sub-admin accounts.");
      return;
    }

    if (user.id === currentUserId) {
      setError("You cannot block your own account.");
      return;
    }

    const nextStatus = user.status === "blocked" ? "active" : "blocked";
    const confirmMessage = nextStatus === "blocked"
      ? `Block ${user.name || user.email}? This user will not be able to login.`
      : `Unblock ${user.name || user.email}?`;

    if (!window.confirm(confirmMessage)) return;

    setActionLoadingId(user.id);
    setMessage("");
    setError("");

    try {
      await API.put(`/admin/users/${user.id}/status`, { status: nextStatus });
      setMessage(`User ${nextStatus === "blocked" ? "blocked" : "unblocked"} successfully.`);
      await fetchAdminData();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update user status.");
    } finally {
      setActionLoadingId(null);
    }
  };

  const exportUsersCsv = () => {
    const header = ["ID", "Name", "Email", "Phone", "Role", "Status", "Semester", "Created At"];
    const rows = filteredUsers.map((user) => [
      user.id,
      user.name || "",
      user.email || "",
      user.phone || "",
      user.role || "",
      user.status || "",
      user.semester_id || "",
      user.created_at || "",
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "learning-hub-users.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearch("");
    setRoleFilter("all");
    setStatusFilter("all");
    setSemesterFilter("all");
  };

  if (loading) {
    return (
      <div className="pageWrap">
        <div className="adminHeroSkeleton card">
          <p className="pill">Admin Panel</p>
          <h1>Loading admin dashboard...</h1>
          <p className="muted">Preparing users, requests, and platform statistics.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pageWrap adminPanelPage">
      <div className="pageHeader adminDashboardHeader adminHeroHeader">
        <div>
          <p className="pill">Control Center</p>
          <h1>Admin Panel</h1>
          <p className="muted">Manage users, review platform activity, and keep Learning Hub clean.</p>
        </div>
        <div className="adminHeaderActions">
          <Link to="/admin/upload" className="secondaryButton">Upload Notes / Projects</Link>
          <ThemeToggle />
        </div>
      </div>

      {error ? <div className="alertError adminAlert">{error}</div> : null}
      {message ? <div className="alertSuccess adminAlert">{message}</div> : null}

      <div className="statsGrid adminStatsGrid">
        <div className="statCard adminStatCard">
          <span className="statIcon">👥</span>
          <h3>{stats.totalUsers}</h3>
          <p>Total Users</p>
        </div>
        <div className="statCard adminStatCard">
          <span className="statIcon">🎓</span>
          <h3>{stats.students}</h3>
          <p>Students</p>
        </div>
        <div className="statCard adminStatCard">
          <span className="statIcon">🛡️</span>
          <h3>{stats.admins}</h3>
          <p>Admins</p>
        </div>
        <div className="statCard adminStatCard">
          <span className="statIcon">👨‍🏫</span>
          <h3>{stats.instructors}</h3>
          <p>Instructors</p>
        </div>
        <div className="statCard adminStatCard">
          <span className="statIcon">✅</span>
          <h3>{stats.active}</h3>
          <p>Active</p>
        </div>
        <div className="statCard adminStatCard">
          <span className="statIcon">🚫</span>
          <h3>{stats.blocked}</h3>
          <p>Blocked</p>
        </div>
        <div className="statCard adminStatCard">
          <span className="statIcon">📚</span>
          <h3>{stats.totalCourses}</h3>
          <p>Courses</p>
        </div>
        <div className="statCard adminStatCard">
          <span className="statIcon">🧠</span>
          <h3>{stats.quizAttempts}</h3>
          <p>Quiz Attempts</p>
        </div>
      </div>

      <div className="gridTwo adminTopGrid">
        <div className="card adminQuickCard">
          <div className="cardHeader">
            <div>
              <h2>Quick Actions</h2>
              <p className="muted">Common admin work in one place.</p>
            </div>
          </div>
          <div className="adminActionGrid">
            <Link to="/admin/upload" className="adminActionTile">
              <strong>Upload Content</strong>
              <span>Add notes and project zip files.</span>
            </Link>
            <button type="button" className="adminActionTile" onClick={fetchAdminData}>
              <strong>Refresh Data</strong>
              <span>Reload users and requests.</span>
            </button>
            <button type="button" className="adminActionTile" onClick={exportUsersCsv}>
              <strong>Export Users</strong>
              <span>Download the filtered table as CSV.</span>
            </button>
          </div>
        </div>

        <div className="card adminQuickCard">
          <div className="cardHeader">
            <div>
              <h2>Admin Requests</h2>
              <p className="muted">Instructor approval requests stay active for 48 hours.</p>
            </div>
            <span className="badge">{stats.pendingRequests} pending</span>
          </div>
          <div className="adminRequestPreview">
            {recentRequests.length === 0 ? (
              <p className="muted">No admin requests found yet.</p>
            ) : (
              recentRequests.map((request) => (
                <div className="requestMiniRow" key={request.id}>
                  <div>
                    <strong>{request.name || "Unknown user"}</strong>
                    <span>{request.email || "No email"}</span>
                  </div>
                  <span className={`statusBadge ${request.status || "pending"}`}>{request.status}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="card adminUsersCard">
        <div className="cardHeader adminUsersHeader">
          <div>
            <h2>User Management</h2>
            <p className="muted">Search, filter, export, block, and unblock user accounts.</p>
          </div>
          <div className="adminUserCount">
            Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong>
          </div>
        </div>

        <div className="adminFilters">
          <label>
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, email, phone, role..."
            />
          </label>
          <label>
            Role
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="all">All roles</option>
              <option value="student">Students</option>
              <option value="sub_admin">Sub-admins</option>
              <option value="admin">Admins</option>
              <option value="instructor">Instructors</option>
            </select>
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label>
            Semester
            <select value={semesterFilter} onChange={(event) => setSemesterFilter(event.target.value)}>
              <option value="all">All semesters</option>
              <option value="none">No semester</option>
              {semesters.map((semester) => (
                <option key={semester} value={semester}>Semester {semester}</option>
              ))}
            </select>
          </label>
          <div className="adminFilterActions">
            <button type="button" className="secondaryButton" onClick={clearFilters}>Clear</button>
            <button type="button" onClick={exportUsersCsv}>Export CSV</button>
          </div>
        </div>

        <div className="tableWrap adminTableWrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Semester</th>
                <th>Auth</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="8" className="emptyTableCell">No users match your filters.</td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="userCell">
                        <span className="avatarCircle">{(user.name || user.email || "U").charAt(0).toUpperCase()}</span>
                        <div>
                          <strong>{user.name || "Unnamed"}</strong>
                          <span>ID #{user.id}</span>
                        </div>
                      </div>
                    </td>
                    <td>{user.email || "-"}</td>
                    <td>{user.phone || <span className="muted">Not linked</span>}</td>
                    <td><span className={`roleBadge ${user.role}`}>{roleLabels[user.role] || user.role}</span></td>
                    <td><span className={`statusBadge ${user.status}`}>{statusLabels[user.status] || user.status}</span></td>
                    <td>{user.semester_id ? `Semester ${user.semester_id}` : <span className="muted">-</span>}</td>
                    <td>{user.auth_id ? <span className="statusBadge active">Linked</span> : <span className="statusBadge blocked">Missing</span>}</td>
                    <td>
                      {user.role === "admin" || user.role === "instructor" || user.id === currentUserId ? (
                        <span className="muted">Protected</span>
                      ) : (
                        <button
                          type="button"
                          className={user.status === "blocked" ? "secondaryButton" : "dangerButton"}
                          onClick={() => toggleUserStatus(user)}
                          disabled={actionLoadingId === user.id}
                        >
                          {actionLoadingId === user.id
                            ? "Saving..."
                            : user.status === "blocked" ? "Unblock" : "Block"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card recentUsersCard">
        <h2>Recent Users</h2>
        <div className="recentUserGrid">
          {recentUsers.map((user) => (
            <div className="recentUserTile" key={`recent-${user.id}`}>
              <span className="avatarCircle">{(user.name || user.email || "U").charAt(0).toUpperCase()}</span>
              <div>
                <strong>{user.name || "Unnamed"}</strong>
                <p>{user.email || "No email"}</p>
              </div>
              <span className={`statusBadge ${user.status}`}>{user.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AdminDashboard;

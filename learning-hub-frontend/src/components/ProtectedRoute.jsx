import { Navigate, Outlet, useLocation } from "react-router-dom";

function ProtectedRoute({ allowedRoles }) {
  const location = useLocation();
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const semesterId = localStorage.getItem("semester_id");

  if (!token) {
    const next = encodeURIComponent(`${location.pathname}${location.search || ""}`);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    if (role === "admin") return <Navigate to="/admin" replace />;
    if (role === "instructor") return <Navigate to="/instructor/requests" replace />;
    if (role === "sub_admin") return <Navigate to="/sub-admin/projects" replace />;
    if (!semesterId) return <Navigate to="/setup" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;

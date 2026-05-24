import { useEffect, useState } from "react";
import API from "../api/api";

function InstructorRequests() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const fetchApplications = async () => {
    try {
      const res = await API.get("/auth/admin-requests/pending");
      setApplications(res.data || []);
    } catch (err) {
      setMessage(err.response?.data?.error || "Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
    const timer = setInterval(fetchApplications, 5000);

    return () => clearInterval(timer);
  }, []);

  const approve = async (id) => {
    try {
      const res = await API.post(`/auth/admin-requests/${id}/approve`);
      setMessage(res.data.message || "Approved");
      fetchApplications();
    } catch (err) {
      setMessage(err.response?.data?.error || "Approve failed");
    }
  };

  const reject = async (id) => {
    try {
      const res = await API.post(`/auth/admin-requests/${id}/reject`);
      setMessage(res.data.message || "Rejected");
      fetchApplications();
    } catch (err) {
      setMessage(err.response?.data?.error || "Reject failed");
    }
  };

  if (loading) {
    return (
      <div className="pageWrap">
        <h1>Loading requests...</h1>
      </div>
    );
  }

  return (
    <div className="pageWrap">
      <div className="pageHeader">
        <div>
          <h1>Instructor Approval Panel</h1>
          <p className="muted">Approve or reject admin requests within 48 hours.</p>
        </div>
      </div>

      {message && (
        <div className="card">
          <p>{message}</p>
        </div>
      )}

      <div className="card">
        <h2>Pending Requests</h2>

        {applications.length === 0 ? (
          <p className="muted">No pending requests.</p>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Created</th>
                  <th>Expires</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {applications.map((app) => (
                  <tr key={app.request_id}>
                    <td>{app.name}</td>
                    <td>{app.email}</td>
                    <td>{app.created_at ? new Date(app.created_at).toLocaleString() : "-"}</td>
                    <td>{app.expires_at ? new Date(app.expires_at).toLocaleString() : "-"}</td>
                    <td>
                      <button className="secondaryButton" onClick={() => approve(app.request_id)}>
                        Approve
                      </button>

                      <button
                        className="secondaryButton"
                        style={{ marginLeft: 8 }}
                        onClick={() => reject(app.request_id)}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default InstructorRequests;
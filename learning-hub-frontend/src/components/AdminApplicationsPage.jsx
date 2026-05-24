import { useEffect, useState } from "react";

export default function AdminApplicationsPage({ instructorId }) {
  const [applications, setApplications] = useState([]);
  const [message, setMessage] = useState("");

  const fetchApplications = async () => {
    const res = await fetch("http://localhost:5000/pending-admin-applications");
    const data = await res.json();
    setApplications(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    fetchApplications();
    const timer = setInterval(fetchApplications, 5000);
    return () => clearInterval(timer);
  }, []);

  const approve = async (id) => {
    const res = await fetch(`http://localhost:5000/approve-admin/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructor_id: instructorId }),
    });
    const data = await res.json();
    setMessage(data.message || data.error || "Done");
    fetchApplications();
  };

  const reject = async (id) => {
    const res = await fetch(`http://localhost:5000/reject-admin/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructor_id: instructorId, reason: "Rejected by instructor" }),
    });
    const data = await res.json();
    setMessage(data.message || data.error || "Done");
    fetchApplications();
  };

  return (
    <div>
      <h2>Pending Admin Applications</h2>
      {message && <p>{message}</p>}
      {applications.length === 0 ? (
        <p>No pending requests</p>
      ) : (
        applications.map((app) => (
          <div key={app.id} style={{ border: "1px solid #ccc", padding: 12, marginBottom: 12 }}>
            <p><strong>User ID:</strong> {app.user_id}</p>
            <p><strong>Status:</strong> {app.status}</p>
            <p><strong>Expires:</strong> {app.expires_at}</p>
            <button onClick={() => approve(app.id)}>Approve</button>
            <button onClick={() => reject(app.id)} style={{ marginLeft: 8 }}>Reject</button>
          </div>
        ))
      )}
    </div>
  );
}

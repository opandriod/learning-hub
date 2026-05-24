import { useEffect, useState } from "react";
import API from "../api/api";

function InstructorSubAdminRequests() {
  const [requests, setRequests] = useState([]);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    setErr("");
    try {
      const res = await API.get("/marketplace/instructor/sub-admin-requests");
      setRequests(res.data || []);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to load requests.");
    }
  };
  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    try { await API.post(`/marketplace/instructor/sub-admin-requests/${id}/approve`); setMsg("Sub-admin approved."); load(); }
    catch (e) { setErr(e.response?.data?.error || "Approve failed."); }
  };
  const reject = async (id) => {
    const note = prompt("Reject reason:") || "Rejected by instructor";
    try { await API.post(`/marketplace/instructor/sub-admin-requests/${id}/reject`, { review_note: note }); setMsg("Request rejected."); load(); }
    catch (e) { setErr(e.response?.data?.error || "Reject failed."); }
  };

  return (
    <div className="pageWrap">
      <div className="pageHeader"><div><h1>Sub-admin Requests</h1><p className="muted">Approve students who can upload project ZIP files.</p></div></div>
      {err && <div className="alertError">{err}</div>}{msg && <div className="alertSuccess">{msg}</div>}
      <div className="card">
        {requests.length === 0 ? <p className="muted">No pending sub-admin requests.</p> : (
          <div className="tableWrap"><table><thead><tr><th>Name</th><th>Email</th><th>Semester</th><th>Reason</th><th>Skills</th><th>Action</th></tr></thead><tbody>
            {requests.map((r) => <tr key={r.id}>
              <td>{r.name}</td><td>{r.email}</td><td>{r.semester_id}</td><td>{r.reason}</td><td>{r.skills}</td>
              <td><button className="primaryButton" onClick={() => approve(r.id)}>Approve</button><button className="secondaryButton" onClick={() => reject(r.id)} style={{ marginLeft: 8 }}>Reject</button></td>
            </tr>)}
          </tbody></table></div>
        )}
      </div>
    </div>
  );
}
export default InstructorSubAdminRequests;

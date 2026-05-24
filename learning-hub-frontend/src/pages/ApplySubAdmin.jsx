import { useEffect, useState } from "react";
import API from "../api/api";

function ApplySubAdmin() {
  const [reason, setReason] = useState("");
  const [skills, setSkills] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [request, setRequest] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const loadRequest = async () => {
    try {
      const res = await API.get("/marketplace/sub-admin/my-request");
      setRequest(res.data);
    } catch {
      // no request yet
    }
  };

  useEffect(() => { loadRequest(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setMsg(""); setErr("");
    try {
      const res = await API.post("/marketplace/sub-admin/apply", { reason, skills, agreed });
      setMsg(res.data.message || "Application submitted.");
      setReason(""); setSkills(""); setAgreed(false);
      await loadRequest();
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to submit application.");
    }
  };

  return (
    <div className="pageWrap">
      <div className="pageHeader">
        <div>
          <h1>Apply for Sub-admin</h1>
          <p className="muted">Sub-admins can upload useful project ZIP files for students. Only Semester 5 and 6 students can apply.</p>
        </div>
      </div>

      {err && <div className="alertError">{err}</div>}
      {msg && <div className="alertSuccess">{msg}</div>}

      {request && (
        <div className="card" style={{ marginBottom: 18 }}>
          <h3>Latest Application Status</h3>
          <p><strong>Status:</strong> {request.status}</p>
          {request.review_note && <p><strong>Review:</strong> {request.review_note}</p>}
          {request.created_at && <p className="muted">Applied: {new Date(request.created_at).toLocaleString()}</p>}
        </div>
      )}

      <div className="card">
        <h2>Sub-admin Responsibility</h2>
        <p className="muted">Read this carefully before applying.</p>
        <ol className="muted" style={{ lineHeight: 1.8 }}>
          <li>Upload only working projects with source code.</li>
          <li>Every ZIP must include README.txt or README.md.</li>
          <li>Do not upload empty, copied, harmful, or password-protected ZIP files.</li>
          <li>Projects are reviewed before they appear publicly.</li>
          <li>Repeated rejected uploads can remove your sub-admin access.</li>
        </ol>

        <form onSubmit={submit} className="formGrid">
          <label>
            <span>Why should we promote you to Sub-admin?</span>
            <textarea rows="5" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tell us about your project skills, experience, and why you want to help students." />
          </label>
          <label>
            <span>Skills / project experience</span>
            <textarea rows="4" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Example: Flask, React, VB.NET, Java, SQL, project documentation..." />
          </label>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>I understand and agree to follow the upload rules.</span>
          </label>
          <button className="primaryButton" type="submit">Submit Application</button>
        </form>
      </div>
    </div>
  );
}

export default ApplySubAdmin;

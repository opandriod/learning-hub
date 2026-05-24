import { useEffect, useState } from "react";
import API from "../api/api";

function AdminOldQuestions() {
  const [semesters, setSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [papers, setPapers] = useState([]);
  const [file, setFile] = useState(null);
  const [driveUrl, setDriveUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editFile, setEditFile] = useState(null);
  const [editDriveUrl, setEditDriveUrl] = useState("");
  const [editForm, setEditForm] = useState({ title: "", year: "" });
  const [form, setForm] = useState({
    semester_id: "",
    course_id: "",
    year: "",
    title: "",
  });

  const loadSemesters = async () => {
    const res = await API.get("/academic/semesters");
    setSemesters(res.data || []);
  };

  const loadPapers = async () => {
    const params = {};
    if (form.semester_id) params.semester_id = form.semester_id;
    if (form.course_id) params.course_id = form.course_id;
    if (form.year) params.year = form.year;
    const res = await API.get("/academic/old-questions", { params });
    setPapers(res.data || []);
  };

  useEffect(() => {
    loadSemesters().catch(() => setErr("Failed to load semesters."));
  }, []);

  useEffect(() => {
    if (!form.semester_id) {
      setCourses([]);
      return;
    }
    API.get("/academic/courses", { params: { semester_id: form.semester_id } })
      .then((res) => setCourses(res.data || []))
      .catch(() => setErr("Failed to load subjects."));
    setForm((prev) => ({ ...prev, course_id: "" }));
  }, [form.semester_id]);

  useEffect(() => {
    loadPapers().catch(() => setErr("Failed to load previous year questions."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.semester_id, form.course_id, form.year]);

  const isPdfFile = (selectedFile) => {
    if (!selectedFile) return true;
    return selectedFile.name.toLowerCase().endsWith(".pdf") || selectedFile.type === "application/pdf";
  };

  const isDriveLink = (value) => !value || value.includes("drive.google.com");

  const upload = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");

    const cleanDriveUrl = driveUrl.trim();

    if (!form.semester_id || !form.course_id || !form.year || !form.title) {
      setErr("Select semester, subject, year, and title.");
      return;
    }

    if (file && cleanDriveUrl) {
      setErr("Use either PDF file upload or Google Drive link, not both.");
      return;
    }

    if (!file && !cleanDriveUrl) {
      setErr("Choose a PDF file or paste a Google Drive PDF link.");
      return;
    }

    if (file && !isPdfFile(file)) {
      setErr("Only PDF files are allowed.");
      return;
    }

    if (cleanDriveUrl && !isDriveLink(cleanDriveUrl)) {
      setErr("Paste a valid Google Drive PDF link.");
      return;
    }

    const fd = new FormData();
    Object.entries(form).forEach(([key, value]) => fd.append(key, value));
    if (file) fd.append("file", file);
    if (cleanDriveUrl) fd.append("drive_url", cleanDriveUrl);

    try {
      const res = await API.post("/academic/old-questions", fd);
      setMsg(res.data.message || "Previous year paper uploaded.");
      setFile(null);
      setDriveUrl("");
      setForm({ semester_id: "", course_id: "", year: "", title: "" });
      await loadPapers();
    } catch (e) {
      setErr(e.response?.data?.error || "Upload failed.");
    }
  };

  const startEdit = (paper) => {
    setMsg("");
    setErr("");
    setEditingId(paper.id);
    setEditForm({ title: paper.title || "", year: paper.year || "" });
    setEditFile(null);
    setEditDriveUrl("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ title: "", year: "" });
    setEditFile(null);
    setEditDriveUrl("");
  };

  const saveEdit = async (paperId) => {
    setMsg("");
    setErr("");

    const cleanDriveUrl = editDriveUrl.trim();

    if (!editForm.title.trim() || !editForm.year) {
      setErr("Title and year are required.");
      return;
    }

    if (editFile && cleanDriveUrl) {
      setErr("Use either a replacement PDF file or a replacement Google Drive link, not both.");
      return;
    }

    if (editFile && !isPdfFile(editFile)) {
      setErr("Only PDF files are allowed.");
      return;
    }

    if (cleanDriveUrl && !isDriveLink(cleanDriveUrl)) {
      setErr("Paste a valid Google Drive PDF link.");
      return;
    }

    const fd = new FormData();
    fd.append("title", editForm.title.trim());
    fd.append("year", editForm.year);
    if (editFile) fd.append("file", editFile);
    if (cleanDriveUrl) fd.append("drive_url", cleanDriveUrl);

    try {
      const res = await API.patch(`/academic/old-questions/${paperId}`, fd);
      setMsg(res.data.message || "Previous year paper updated.");
      cancelEdit();
      await loadPapers();
    } catch (e) {
      setErr(e.response?.data?.error || "Update failed.");
    }
  };

  const deletePaper = async (id) => {
    if (!window.confirm("Delete this previous year question paper?")) return;
    setMsg("");
    setErr("");
    try {
      const res = await API.delete(`/academic/old-questions/${id}`);
      setMsg(res.data.message || "Deleted.");
      await loadPapers();
    } catch (e) {
      setErr(e.response?.data?.error || "Delete failed.");
    }
  };

  return (
    <div className="pageWrap adminAcademicPage">
      <div className="pageHeader">
        <div>
          <h1>Upload Previous Year Questions</h1>
          <p className="muted">Upload final old question papers as PDF files only. You can edit title, year, or replace the PDF later.</p>
        </div>
      </div>

      {err && <div className="alertError">{err}</div>}
      {msg && <div className="alertSuccess">{msg}</div>}

      <div className="gridTwo">
        <div className="card">
          <h2>Old Question PDF</h2>
          <form onSubmit={upload} className="formGrid">
            <label>
              <span>Semester</span>
              <select value={form.semester_id} onChange={(e) => setForm({ ...form, semester_id: e.target.value })}>
                <option value="">Select semester</option>
                {semesters.map((s) => <option key={s.id} value={s.id}>{s.name || `Semester ${s.id}`}</option>)}
              </select>
            </label>

            <label>
              <span>Subject</span>
              <select value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })} disabled={!form.semester_id}>
                <option value="">Select subject</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </label>

            <label>
              <span>Year</span>
              <input type="number" min="2000" max="2100" placeholder="Example: 2024" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            </label>

            <label>
              <span>Title</span>
              <input placeholder="Example: Mobile Computing Previous Year Question 2024" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>

            <label>
              <span>PDF file from device</span>
              <input type="file" accept=".pdf,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>

            <div className="muted" style={{ fontWeight: 700, textAlign: "center" }}>OR</div>

            <label>
              <span>Google Drive PDF link</span>
              <input
                type="url"
                placeholder="https://drive.google.com/file/d/.../view"
                value={driveUrl}
                onChange={(e) => setDriveUrl(e.target.value)}
              />
              <small className="muted">Set the Drive file to “Anyone with the link can view”.</small>
            </label>

            <button className="primaryButton">Upload Question Paper</button>
          </form>
        </div>

        <div className="card">
          <h2>Uploaded Papers</h2>
          {papers.length === 0 ? <p className="muted">No previous year papers found.</p> : papers.map((p) => (
            <div key={p.id} className="miniCard" style={{ marginBottom: 12 }}>
              {editingId === p.id ? (
                <div className="formGrid">
                  <label>
                    <span>Title</span>
                    <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                  </label>
                  <label>
                    <span>Year</span>
                    <input type="number" min="2000" max="2100" value={editForm.year} onChange={(e) => setEditForm({ ...editForm, year: e.target.value })} />
                  </label>
                  <label>
                    <span>Replace PDF from device optional</span>
                    <input type="file" accept=".pdf,application/pdf" onChange={(e) => setEditFile(e.target.files?.[0] || null)} />
                  </label>
                  <div className="muted" style={{ fontWeight: 700, textAlign: "center" }}>OR</div>
                  <label>
                    <span>Replace with Google Drive PDF link optional</span>
                    <input
                      type="url"
                      placeholder="Leave empty to keep current PDF"
                      value={editDriveUrl}
                      onChange={(e) => setEditDriveUrl(e.target.value)}
                    />
                  </label>
                  <div className="cardFooter">
                    <button className="primaryButton" type="button" onClick={() => saveEdit(p.id)}>Save Changes</button>
                    <button className="secondaryButton" type="button" onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <strong>{p.title}</strong>
                  <p className="muted" style={{ margin: 0 }}>{p.course_title} • {p.semester_name || `Semester ${p.semester_id}`} • {p.year}</p>
                  <div className="cardFooter">
                    <a className="secondaryButton" href={p.file_url} target="_blank" rel="noreferrer">View PDF</a>
                    <a className="secondaryButton" href={p.file_url} download>Download</a>
                    <button className="secondaryButton" type="button" onClick={() => startEdit(p)}>Edit</button>
                    <button className="secondaryButton" type="button" onClick={() => deletePaper(p.id)}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default AdminOldQuestions;

import { useEffect, useState } from "react";
import API from "../api/api";

function AdminStudyMaterials() {
  const [semesters, setSemesters] = useState([]);
  const [courses, setCourses] = useState([]);
  const [units, setUnits] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [file, setFile] = useState(null);
  const [driveUrl, setDriveUrl] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editFile, setEditFile] = useState(null);
  const [editDriveUrl, setEditDriveUrl] = useState("");
  const [editForm, setEditForm] = useState({ title: "", description: "" });
  const [form, setForm] = useState({
    semester_id: "",
    course_id: "",
    unit_id: "",
    title: "",
    description: "",
  });

  const loadSemesters = async () => {
    const res = await API.get("/academic/semesters");
    setSemesters(res.data || []);
  };

  const loadMaterials = async () => {
    const params = {};
    if (form.semester_id) params.semester_id = form.semester_id;
    if (form.course_id) params.course_id = form.course_id;
    if (form.unit_id) params.unit_id = form.unit_id;
    const res = await API.get("/academic/study-materials", { params });
    setMaterials(res.data || []);
  };

  useEffect(() => {
    loadSemesters().catch(() => setErr("Failed to load semesters."));
  }, []);

  useEffect(() => {
    if (!form.semester_id) {
      setCourses([]);
      setUnits([]);
      return;
    }
    API.get("/academic/courses", { params: { semester_id: form.semester_id } })
      .then((res) => setCourses(res.data || []))
      .catch(() => setErr("Failed to load subjects."));
    setForm((prev) => ({ ...prev, course_id: "", unit_id: "" }));
  }, [form.semester_id]);

  useEffect(() => {
    if (!form.course_id) {
      setUnits([]);
      return;
    }
    API.get(`/academic/units/${form.course_id}`)
      .then((res) => setUnits(res.data || []))
      .catch(() => setErr("Failed to load units."));
    setForm((prev) => ({ ...prev, unit_id: "" }));
  }, [form.course_id]);

  useEffect(() => {
    loadMaterials().catch(() => setErr("Failed to load study materials."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.semester_id, form.course_id, form.unit_id]);

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

    if (!form.semester_id || !form.course_id || !form.unit_id || !form.title) {
      setErr("Select semester, subject, unit, and title.");
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
      const res = await API.post("/academic/study-materials", fd);
      setMsg(res.data.message || "Study material uploaded.");
      setFile(null);
      setDriveUrl("");
      setForm({ semester_id: "", course_id: "", unit_id: "", title: "", description: "" });
      await loadMaterials();
    } catch (e) {
      setErr(e.response?.data?.error || "Upload failed.");
    }
  };

  const startEdit = (material) => {
    setMsg("");
    setErr("");
    setEditingId(material.id);
    setEditForm({ title: material.title || "", description: material.description || "" });
    setEditFile(null);
    setEditDriveUrl("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ title: "", description: "" });
    setEditFile(null);
    setEditDriveUrl("");
  };

  const saveEdit = async (materialId) => {
    setMsg("");
    setErr("");

    const cleanDriveUrl = editDriveUrl.trim();

    if (!editForm.title.trim()) {
      setErr("Title is required.");
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
    fd.append("description", editForm.description || "");
    if (editFile) fd.append("file", editFile);
    if (cleanDriveUrl) fd.append("drive_url", cleanDriveUrl);

    try {
      const res = await API.patch(`/academic/study-materials/${materialId}`, fd);
      setMsg(res.data.message || "Study material updated.");
      cancelEdit();
      await loadMaterials();
    } catch (e) {
      setErr(e.response?.data?.error || "Update failed.");
    }
  };

  const deleteMaterial = async (id) => {
    if (!window.confirm("Delete this study material?")) return;
    setMsg("");
    setErr("");
    try {
      const res = await API.delete(`/academic/study-materials/${id}`);
      setMsg(res.data.message || "Deleted.");
      await loadMaterials();
    } catch (e) {
      setErr(e.response?.data?.error || "Delete failed.");
    }
  };

  return (
    <div className="pageWrap adminAcademicPage">
      <div className="pageHeader">
        <div>
          <h1>Upload Study Materials</h1>
          <p className="muted">Upload full unit PDF notes. You can edit title, description, or replace the PDF later.</p>
        </div>
      </div>

      {err && <div className="alertError">{err}</div>}
      {msg && <div className="alertSuccess">{msg}</div>}

      <div className="gridTwo">
        <div className="card">
          <h2>Unit Notes PDF</h2>
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
              <span>Unit</span>
              <select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} disabled={!form.course_id}>
                <option value="">Select unit</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
              </select>
            </label>

            <label>
              <span>Title</span>
              <input placeholder="Example: Mobile Computing Unit 1 Notes" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>

            <label>
              <span>Description optional</span>
              <textarea rows="4" placeholder="Example: Full Unit 1 notes covering all topics." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
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

            <button className="primaryButton">Upload Study Material</button>
          </form>
        </div>

        <div className="card">
          <h2>Uploaded Materials</h2>
          {materials.length === 0 ? <p className="muted">No study materials found.</p> : materials.map((m) => (
            <div key={m.id} className="miniCard" style={{ marginBottom: 12 }}>
              {editingId === m.id ? (
                <div className="formGrid">
                  <label>
                    <span>Title</span>
                    <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                  </label>
                  <label>
                    <span>Description optional</span>
                    <textarea rows="3" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
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
                    <button className="primaryButton" type="button" onClick={() => saveEdit(m.id)}>Save Changes</button>
                    <button className="secondaryButton" type="button" onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <strong>{m.title}</strong>
                  <p className="muted" style={{ margin: 0 }}>{m.course_title} • {m.unit_title} • {m.semester_name || `Semester ${m.semester_id}`}</p>
                  {m.description && <p style={{ margin: 0 }}>{m.description}</p>}
                  <div className="cardFooter">
                    <a className="secondaryButton" href={m.file_url} target="_blank" rel="noreferrer">View PDF</a>
                    <a className="secondaryButton" href={m.file_url} download>Download</a>
                    <button className="secondaryButton" type="button" onClick={() => startEdit(m)}>Edit</button>
                    <button className="secondaryButton" type="button" onClick={() => deleteMaterial(m.id)}>Delete</button>
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

export default AdminStudyMaterials;

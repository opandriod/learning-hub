import { useState } from "react";
import API from "../api/api";

function AdminUpload() {
  const [file, setFile] = useState(null);
  const [type, setType] = useState("pdf");
  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [msg, setMsg] = useState("");

  const upload = async () => {
    if (!file || !title || !courseId) {
      setMsg("Please enter title, course ID and choose a file.");
      return;
    }

    const form = new FormData();
    form.append("file", file);
    form.append("type", type);
    form.append("title", title);
    form.append("course_id", courseId);

    if (unitId) {
      form.append("unit_id", unitId);
    }

    try {
      const res = await API.post("/upload", form);
      setMsg(res.data.message + " ✅");
    } catch (e) {
      setMsg(e.response?.data?.error || "Upload failed");
    }
  };

  return (
    <div className="pageWrap">
      <div className="pageHeader">
        <div>
          <h1>Upload Files</h1>
          <p className="muted">Upload PDF notes or ZIP project files.</p>
        </div>
      </div>

      <div className="card">
        <label>
          <span>File Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="pdf">PDF Notes</option>
            <option value="zip">Project ZIP</option>
          </select>
        </label>

        <label>
          <span>Title</span>
          <input
            placeholder="Example: Unit 1 Notes"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <label>
          <span>Course ID</span>
          <input
            placeholder="Example: 36"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
          />
        </label>

        <label>
          <span>Unit ID optional</span>
          <input
            placeholder="Example: 147"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
          />
        </label>

        <label>
          <span>Choose File</span>
          <input
            type="file"
            accept={type === "pdf" ? "application/pdf" : ".zip"}
            onChange={(e) => setFile(e.target.files[0])}
          />
        </label>

        <button className="primaryButton" onClick={upload}>
          Upload
        </button>

        {msg && <p className="muted">{msg}</p>}
      </div>
    </div>
  );
}

export default AdminUpload;
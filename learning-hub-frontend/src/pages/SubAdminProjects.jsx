import { useEffect, useMemo, useState } from "react";
import API from "../api/api";

const typeLabel = {
  practical: "Practical/Lab Resource",
  minor: "Minor Project",
  major: "Major Project",
};

function SubAdminProjects() {
  const role = localStorage.getItem("role");
  const [projects, setProjects] = useState([]);
  const [options, setOptions] = useState([]);
  const [file, setFile] = useState(null);
  const [imageProjectId, setImageProjectId] = useState(null);
  const [thumbnail, setThumbnail] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    semester_id: "",
    project_type: "",
    subject_name: "",
    is_paid: false,
    price: "0",
  });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      const [uploadsRes, optionsRes] = await Promise.all([
        API.get("/marketplace/projects/my"),
        API.get("/marketplace/upload-options"),
      ]);
      setProjects(uploadsRes.data || []);
      setOptions(optionsRes.data || []);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to load project upload page.");
    }
  };

  useEffect(() => { load(); }, []);

  const groupedOptions = useMemo(() => {
    const map = {};
    options.forEach((opt) => {
      const sem = String(opt.semester_id);
      if (!map[sem]) map[sem] = [];
      map[sem].push(opt);
    });
    return map;
  }, [options]);

  const availableForSemester = form.semester_id ? groupedOptions[String(form.semester_id)] || [] : [];
  const canPriceSelected = ["minor", "major"].includes(form.project_type);

  const handleSemesterChange = (semester_id) => {
    const semOptions = groupedOptions[String(semester_id)] || [];
    const first = semOptions[0];
    setForm({
      ...form,
      semester_id,
      project_type: first?.project_type || "",
      subject_name: first?.subject_name || "",
      is_paid: ["minor", "major"].includes(first?.project_type || "") ? form.is_paid : false,
      price: ["minor", "major"].includes(first?.project_type || "") ? form.price : "0",
    });
  };

  const handleResourceChange = (value) => {
    const selected = options.find((opt) => `${opt.project_type}|||${opt.subject_name}` === value);
    if (!selected) return;
    setForm({ ...form, project_type: selected.project_type, subject_name: selected.subject_name, is_paid: ["minor", "major"].includes(selected.project_type) ? form.is_paid : false, price: ["minor", "major"].includes(selected.project_type) ? form.price : "0" });
  };

  const upload = async (e) => {
    e.preventDefault();
    setMsg("");
    setErr("");
    if (!form.semester_id || !form.project_type || !form.subject_name) {
      setErr("Select a valid semester and upload category from the BCA syllabus.");
      return;
    }
    if (!canPriceSelected && form.is_paid) {
      setErr("Pricing is allowed only for Minor Project and Major Project uploads. Practical/Lab resources must be free.");
      return;
    }
    if (canPriceSelected && form.is_paid && Number(form.price) < 50) {
      setErr("Paid Minor/Major projects must be at least ₹50.");
      return;
    }
    if (!file) {
      setErr("Choose a ZIP file.");
      return;
    }
    if (!thumbnail) {
      setErr("Upload a thumbnail image. It is required for the store card.");
      return;
    }
    if (!screenshots || screenshots.length < 3) {
      setErr("Upload at least 3 project screenshots for the details preview.");
      return;
    }
    const fd = new FormData();
    const safeForm = canPriceSelected ? form : { ...form, is_paid: false, price: "0" };
    Object.entries(safeForm).forEach(([k, v]) => fd.append(k, v));
    fd.append("file", file);
    fd.append("thumbnail", thumbnail);
    Array.from(screenshots || []).forEach((img) => fd.append("screenshots", img));
    try {
      const res = await API.post("/marketplace/projects/upload", fd);
      setMsg(res.data.message || "Uploaded.");
      setFile(null);
      setThumbnail(null);
      setScreenshots([]);
      setForm({ title: "", description: "", semester_id: "", project_type: "", subject_name: "", is_paid: false, price: "0" });
      load();
    } catch (e) {
      setErr(e.response?.data?.error || "Upload failed.");
    }
  };

  const uploadProjectImages = async (projectId) => {
    setMsg("");
    setErr("");
    if (!thumbnail && (!screenshots || screenshots.length === 0)) {
      setErr("Choose a thumbnail or at least one screenshot.");
      return;
    }
    const fd = new FormData();
    if (thumbnail) fd.append("thumbnail", thumbnail);
    Array.from(screenshots || []).forEach((img) => fd.append("screenshots", img));
    try {
      setBusy(true);
      const res = await API.post(`/marketplace/projects/${projectId}/images`, fd);
      setMsg(res.data?.message || "Project images uploaded.");
      setThumbnail(null);
      setScreenshots([]);
      setImageProjectId(null);
      await load();
    } catch (e) {
      setErr(e.response?.data?.error || "Image upload failed. Make sure the project-images bucket exists in Supabase Storage.");
    } finally {
      setBusy(false);
    }
  };

  const deleteProject = async (projectId) => {
    if (!confirm("Delete this project? This cannot be undone.")) return;
    setMsg("");
    setErr("");
    try {
      await API.delete(`/marketplace/projects/${projectId}`);
      setMsg("Project deleted.");
      await load();
    } catch (e) {
      setErr(e.response?.data?.error || "Could not delete project.");
    }
  };

  const deleteProjectImage = async (projectId, imageId) => {
    if (!confirm("Remove this image?")) return;
    setMsg("");
    setErr("");
    try {
      await API.delete(`/marketplace/projects/${projectId}/images/${imageId}`);
      setMsg("Image removed.");
      await load();
    } catch (e) {
      setErr(e.response?.data?.error || "Could not remove image.");
    }
  };

  return (
    <div className="pageWrap">
      <div className="pageHeader">
        <div>
          <h1>{role === "sub_admin" ? "My Resource Uploads" : "Upload Resource"}</h1>
          <p className="muted">Upload BCA practical resources, Semester 5 Minor Projects, or Semester 6 Major Projects. Sub-admin uploads require review.</p>
        </div>
      </div>

      {err && <div className="alertError">{err}</div>}
      {msg && <div className="alertSuccess">{msg}</div>}

      <div className="gridTwo">
        <div className="card">
          <h2>Upload Rules</h2>
          <ul className="muted" style={{ lineHeight: 1.8 }}>
            <li>Practical resources are allowed only for real BCA lab papers.</li>
            <li>Semester 5 uploads can include Minor Project and VB.NET Lab resources.</li>
            <li>Semester 6 uploads are only for Major Project.</li>
            <li>ZIP must include README.txt or README.md with setup instructions.</li>
            <li>No empty ZIP, .exe, .bat, .cmd, .vbs, or harmful files.</li>
            <li>Practical/Lab resources are always free.</li>
            <li>Only Minor Project and Major Project uploads can be marked paid.</li>
            <li>Paid Minor/Major projects must be at least ₹50.</li>
            <li>Thumbnail image is compulsory for every upload.</li>
            <li>Upload at least 3 project screenshots, like a Google Play Store preview.</li>
          </ul>

          <form onSubmit={upload} className="formGrid">
            <label>
              <span>Title</span>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>

            <label>
              <span>Description</span>
              <textarea rows="4" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>

            <label>
              <span>Semester</span>
              <select value={form.semester_id} onChange={(e) => handleSemesterChange(e.target.value)}>
                <option value="">Select semester</option>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>Semester {n}</option>
                ))}
              </select>
            </label>

            <label>
              <span>Upload Category / Subject</span>
              <select
                value={form.project_type && form.subject_name ? `${form.project_type}|||${form.subject_name}` : ""}
                onChange={(e) => handleResourceChange(e.target.value)}
                disabled={!form.semester_id}
              >
                <option value="">Select category</option>
                {availableForSemester.map((opt) => (
                  <option key={`${opt.project_type}-${opt.subject_name}`} value={`${opt.project_type}|||${opt.subject_name}`}>
                    {typeLabel[opt.project_type] || opt.project_type} - {opt.subject_name}
                  </option>
                ))}
              </select>
            </label>

            {form.project_type && (
              <div className="miniCard">
                <strong>{typeLabel[form.project_type]}</strong>
                <p className="muted" style={{ margin: "6px 0 0" }}>Semester {form.semester_id} • {form.subject_name}</p>
              </div>
            )}

            {canPriceSelected ? (
              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={form.is_paid}
                  onChange={(e) => setForm({ ...form, is_paid: e.target.checked, price: e.target.checked ? form.price : "0" })}
                />
                Paid project (Minor/Major only)
              </label>
            ) : form.project_type ? (
              <div className="miniCard">Practical/Lab uploads are always free. Pricing is available only for Minor and Major Projects.</div>
            ) : null}

            {canPriceSelected && form.is_paid && (
              <label>
                <span>Price ₹</span>
                <input type="number" min="50" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </label>
            )}

            <label>
              <span>ZIP file</span>
              <input type="file" accept=".zip" onChange={(e) => setFile(e.target.files[0])} />
            </label>

            <label>
              <span>Thumbnail image required</span>
              <input type="file" accept="image/*" onChange={(e) => setThumbnail(e.target.files?.[0] || null)} />
            </label>

            <label>
              <span>Project screenshots required, minimum 3</span>
              <input type="file" accept="image/*" multiple onChange={(e) => setScreenshots(e.target.files || [])} />
            </label>

            <button className="primaryButton">Upload Resource</button>
          </form>
        </div>

        <div className="card">
          <h2>My Uploads</h2>
          <p className="muted">You can delete only your own uploads. Instructor can delete any project from review/store management.</p>
          {projects.length === 0 ? (
            <p className="muted">No resources uploaded yet.</p>
          ) : projects.map((p) => (
            <div key={p.id} className="miniCard" style={{ borderBottom: "1px solid #eee", padding: "12px 0" }}>
              <strong>{p.title}</strong>
              <p className="muted">
                Semester {p.semester_id || "-"} • {typeLabel[p.project_type] || p.project_type} • {p.subject_name || ""} • {p.status} • {p.is_paid ? `₹${p.price}` : "Free"} • ⭐ {p.average_rating} ({p.rating_count}) • Downloads {p.download_count}
              </p>
              {p.review_note && <p>{p.review_note}</p>}

              {p.thumbnail_url && <img src={p.thumbnail_url} alt="Project thumbnail" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 14, marginTop: 10 }} />}

              {p.screenshots?.length > 0 && (
                <div className="adminImageGrid" style={{ marginTop: 10 }}>
                  {p.screenshots.map((img) => (
                    <div key={img.id}>
                      <img src={img.image_url} alt="Project screenshot" />
                      <button className="secondaryButton" onClick={() => deleteProjectImage(p.id, img.id)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}

              {imageProjectId === p.id ? (
                <div className="formGrid" style={{ marginTop: 12 }}>
                  <label><span>Thumbnail image</span><input type="file" accept="image/*" onChange={(e) => setThumbnail(e.target.files?.[0] || null)} /></label>
                  <label><span>Project screenshots</span><input type="file" accept="image/*" multiple onChange={(e) => setScreenshots(e.target.files || [])} /></label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button className="primaryButton" disabled={busy} onClick={() => uploadProjectImages(p.id)}>{busy ? "Uploading..." : "Upload Images"}</button>
                    <button className="secondaryButton" onClick={() => { setImageProjectId(null); setThumbnail(null); setScreenshots([]); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button className="secondaryButton" style={{ marginTop: 10 }} onClick={() => { setImageProjectId(p.id); setThumbnail(null); setScreenshots([]); }}>
                  Add / Change Thumbnail & Screenshots
                </button>
              )}
              <button className="secondaryButton" style={{ marginTop: 10, marginLeft: 8 }} onClick={() => deleteProject(p.id)}>Delete My Project</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SubAdminProjects;

import { useEffect, useMemo, useState } from "react";
import API from "../api/api";

function StudyMaterials() {
  const [courses, setCourses] = useState([]);
  const [units, setUnits] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [filters, setFilters] = useState({ course_id: "", unit_id: "" });
  const [err, setErr] = useState("");

  const selectedCourse = useMemo(() => {
    return courses.find((course) => String(course.id) === String(filters.course_id));
  }, [courses, filters.course_id]);

  const loadMaterials = async () => {
    const params = {};
    if (filters.course_id) params.course_id = filters.course_id;
    if (filters.unit_id) params.unit_id = filters.unit_id;
    const res = await API.get("/academic/study-materials", { params });
    setMaterials(res.data || []);
  };

  useEffect(() => {
    API.get("/academic/courses")
      .then((res) => setCourses(res.data || []))
      .catch(() => setErr("Failed to load subjects."));
  }, []);

  useEffect(() => {
    if (!filters.course_id) {
      setUnits([]);
      setFilters((prev) => ({ ...prev, unit_id: "" }));
      return;
    }

    API.get(`/academic/units/${filters.course_id}`)
      .then((res) => setUnits(res.data || []))
      .catch(() => setErr("Failed to load units."));
    setFilters((prev) => ({ ...prev, unit_id: "" }));
  }, [filters.course_id]);

  useEffect(() => {
    loadMaterials().catch(() => setErr("Failed to load study materials."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.course_id, filters.unit_id]);

  return (
    <div className="pageWrap studyMaterialsPage">
      <div className="pageHeader studyMaterialsHero">
        <div>
          <span className="sectionKicker">Study library</span>
          <h1>Study Materials</h1>
          <p className="muted">View or download notes for your selected semester.</p>
        </div>
        <span className="studyMaterialCount">{materials.length} PDFs</span>
      </div>

      {err && <div className="alertError">{err}</div>}

      <div className="card studyFilterCard">
        <div className="studyFilterGrid">
          <label>
            <span>Subject</span>
            <select value={filters.course_id} onChange={(e) => setFilters({ ...filters, course_id: e.target.value, unit_id: "" })}>
              <option value="">All subjects</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>

          <label>
            <span>Unit</span>
            <select value={filters.unit_id} onChange={(e) => setFilters({ ...filters, unit_id: e.target.value })} disabled={!filters.course_id}>
              <option value="">All units</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.title}</option>)}
            </select>
          </label>
        </div>
        <p className="muted smallText studyFilterHint">
          {selectedCourse ? `Showing notes for ${selectedCourse.title}.` : "Choose a subject or keep All subjects to see every available PDF."}
        </p>
      </div>

      {materials.length === 0 ? (
        <div className="card studyEmptyCard">
          <h3>No study materials yet</h3>
          <p className="muted">PDF notes uploaded by admin will appear here.</p>
        </div>
      ) : (
        <div className="studyMaterialsGrid">
          {materials.map((m) => (
            <article key={m.id} className="studyMaterialCard">
              <span className="studyMaterialBadge">PDF</span>
              <h3>{m.title}</h3>
              <p className="studyMaterialMeta">{m.course_title || "Subject"}</p>
              <p className="muted smallText">{m.unit_title || "All units"}</p>
              {m.description ? <p className="studyMaterialDesc">{m.description}</p> : null}
              <div className="studyMaterialActions">
                <a className="primaryButton" href={m.file_url} target="_blank" rel="noreferrer">View</a>
                <a className="secondaryButton" href={m.file_url} download>Download</a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default StudyMaterials;

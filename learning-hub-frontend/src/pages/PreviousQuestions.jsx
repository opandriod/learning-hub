import { useEffect, useMemo, useState } from "react";
import API from "../api/api";

function PreviousQuestions() {
  const [courses, setCourses] = useState([]);
  const [papers, setPapers] = useState([]);
  const [filters, setFilters] = useState({ course_id: "", year: "" });
  const [err, setErr] = useState("");

  const selectedCourse = useMemo(() => {
    return courses.find((course) => String(course.id) === String(filters.course_id));
  }, [courses, filters.course_id]);

  const years = useMemo(() => {
    const set = new Set(papers.map((p) => p.year).filter(Boolean));
    return Array.from(set).sort((a, b) => Number(b) - Number(a));
  }, [papers]);

  const loadPapers = async () => {
    const params = {};
    if (filters.course_id) params.course_id = filters.course_id;
    if (filters.year) params.year = filters.year;
    const res = await API.get("/academic/old-questions", { params });
    setPapers(res.data || []);
  };

  useEffect(() => {
    API.get("/academic/courses")
      .then((res) => setCourses(res.data || []))
      .catch(() => setErr("Failed to load subjects."));
  }, []);

  useEffect(() => {
    loadPapers().catch(() => setErr("Failed to load previous year questions."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.course_id, filters.year]);

  return (
    <div className="pageWrap studyMaterialsPage previousQuestionsPage">
      <div className="pageHeader studyMaterialsHero">
        <div>
          <span className="sectionKicker">Old papers</span>
          <h1>Previous Year Questions</h1>
          <p className="muted">View or download question papers for your selected semester.</p>
        </div>
        <span className="studyMaterialCount">{papers.length} PDFs</span>
      </div>

      {err && <div className="alertError">{err}</div>}

      <div className="card studyFilterCard">
        <div className="studyFilterGrid previousQuestionsFilterGrid">
          <label>
            <span>Subject</span>
            <select value={filters.course_id} onChange={(e) => setFilters({ ...filters, course_id: e.target.value })}>
              <option value="">All subjects</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </label>

          <label>
            <span>Year</span>
            <select value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })}>
              <option value="">All years</option>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
        </div>
        <p className="muted smallText studyFilterHint">
          {selectedCourse ? `Showing papers for ${selectedCourse.title}.` : "Choose a subject or keep All subjects to see every available question paper."}
        </p>
      </div>

      {papers.length === 0 ? (
        <div className="card studyEmptyCard">
          <h3>No previous year papers yet</h3>
          <p className="muted">Old question papers uploaded by admin will appear here.</p>
        </div>
      ) : (
        <div className="studyMaterialsGrid previousQuestionsGrid">
          {papers.map((p) => (
            <article key={p.id} className="studyMaterialCard previousQuestionCard">
              <span className="studyMaterialBadge">{p.year || "PDF"}</span>
              <h3>{p.title}</h3>
              <p className="studyMaterialMeta">{p.course_title || "Subject"}</p>
              <p className="muted smallText">{p.semester_name || `Semester ${p.semester_id || ""}`}</p>
              <div className="studyMaterialActions">
                <a className="primaryButton" href={p.file_url} target="_blank" rel="noreferrer">View</a>
                <a className="secondaryButton" href={p.file_url} download>Download</a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default PreviousQuestions;

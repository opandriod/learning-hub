import { useNavigate } from "react-router-dom";

function Syllabus() {
  const navigate = useNavigate();

  const semesters = [
    { name: "Semester 1", file: "/syllabus/sem1.pdf" },
    { name: "Semester 2", file: "/syllabus/sem2.pdf" },
    { name: "Semester 3", file: "/syllabus/sem3.pdf" },
    { name: "Semester 4", file: "/syllabus/sem4.pdf" },
    { name: "Semester 5", file: "/syllabus/sem5.pdf" },
    { name: "Semester 6", file: "/syllabus/sem6.pdf" },
  ];

  return (
    <div className="dashboard syllabusPageCompact">
      <section className="syllabusHeroCard">
        <div>
          <span className="sectionEyebrow">BCA Curriculum</span>
          <h1>BCA Syllabus</h1>
          <p>Open or download semester-wise syllabus PDFs in a compact card view.</p>
        </div>
        <div className="syllabusCountPill">
          <strong>{semesters.length}</strong>
          <span>semesters</span>
        </div>
      </section>

      <section className="syllabusCardGrid" aria-label="BCA semester syllabus list">
        {semesters.map((sem) => (
          <article key={sem.name} className="syllabusMiniCard">
            <div className="syllabusMiniInfo">
              <span>Syllabus PDF</span>
              <h3>{sem.name}</h3>
            </div>
            <div className="syllabusMiniActions">
              <button
                type="button"
                className="primaryButton"
                onClick={() => navigate("/pdf", { state: { pdf: sem.file } })}
              >
                View
              </button>
              <a className="secondaryButton" href={sem.file} download>
                Download
              </a>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

export default Syllabus;

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/api";

function CourseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [units, setUnits] = useState([]);
  const [enrolled, setEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);

  // -----------------------------
  // Load Data
  // -----------------------------
  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const courseRes = await API.get(`/courses/${id}`);
      setCourse(courseRes.data);

      const enrollRes = await API.get(`/courses/${id}/status`);

      if (enrollRes.data.enrolled) {
        setEnrolled(true);

        const unitsRes = await API.get(`/units/${id}`);
        setUnits(unitsRes.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // Auto Redirect for Practical
  // -----------------------------
  useEffect(() => {
    if (enrolled && course?.title === "PC Applications Lab") {
      navigate("/unit/35");
    }
  }, [enrolled, course, navigate]);

  // -----------------------------
  // Enroll
  // -----------------------------
  const enrollCourse = async () => {
    try {
      await API.post(`/courses/${id}/enroll`);
      setEnrolled(true);

      const unitsRes = await API.get(`/units/${id}`);
      setUnits(unitsRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  // -----------------------------
  // Loading / Error
  // -----------------------------
  if (loading) return <div className="dashboard"><div className="card skeletonCard"><div className="skeleton skeletonLine" style={{width:"55%",height:28}}></div><div className="skeleton skeletonLine" style={{width:"92%"}}></div><div className="skeleton skeletonLine" style={{width:"70%"}}></div></div></div>;
  if (!course) return <p>Course not found</p>;

  return (
    <div className="dashboard courseDetailCompactPage">

      {/* 🔙 Back */}
      <button className="backPillButton" onClick={() => navigate("/courses")}>← Back to Courses</button>

      {/* 📘 Course Info */}
      <div className="courseDetailHeroCard">
        <span className="sectionEyebrow">Course</span>
        <h1>{course.title}</h1>
        <p>{course.description}</p>
      </div>

      {/* 🔒 Not enrolled */}
      {!enrolled ? (
        <div style={{ marginTop: "20px" }}>
          <button
            onClick={enrollCourse}
            style={{
              padding: "10px 20px",
              background: "#22c55e",
              border: "none",
              color: "white",
              cursor: "pointer",
              borderRadius: "6px"
            }}
          >
            Enroll Now
          </button>
        </div>
      ) : (
        <>
          {/* 📚 Units (ONLY for normal subjects) */}
          <div className="unitSectionHeader">
            <div>
              <span className="sectionEyebrow">Units</span>
              <h2>Choose a unit</h2>
            </div>
            <span>{units.length} {units.length === 1 ? "unit" : "units"}</span>
          </div>

          {units.length === 0 ? (
            <div className="emptyStateCard">
              <h3>No units available</h3>
              <p>Units for this course will appear here once they are added.</p>
            </div>
          ) : (
            <div className="unitCompactGrid">
              {units.map((unit) => (
                <button
                  type="button"
                  key={unit.id}
                  className="unitCompactCard"
                  onClick={() => navigate(`/unit/${unit.id}`)}
                  title={unit.title}
                >
                  <span>{unit.title}</span>
                  <small>Open topics</small>
                </button>
              ))}
            </div>
          )}
        </>
      )}

    </div>
  );
}

export default CourseDetail;
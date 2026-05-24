import { useEffect, useMemo, useState } from "react";
import API from "../api/api";
import { useNavigate } from "react-router-dom";
import { CoursePageSkeleton } from "../components/Skeleton";

function Courses() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await API.get("/courses");
      setCourses(res.data || []);
    } catch (err) {
      console.error("Error fetching courses:", err);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const semesterLabel = useMemo(() => {
    const first = courses?.[0];
    return first?.semester_name || first?.semester || first?.semester_title || "Your semester";
  }, [courses]);

  return (
    <div className="dashboard coursesPageCompact">
      <div className="coursesCompactHeader">
        <div>
          <span className="sectionEyebrow">Courses</span>
          <h1>My Subjects</h1>
          <p>Choose a subject to open units, topics, notes, and progress.</p>
        </div>
        <div className="coursesCountPill">
          <strong>{courses.length}</strong>
          <span>{courses.length === 1 ? "subject" : "subjects"}</span>
        </div>
      </div>

      {loading ? (
        <CoursePageSkeleton />
      ) : courses.length === 0 ? (
        <div className="emptyStateCard">
          <h3>No courses found</h3>
          <p>Your enrolled semester courses will appear here after your profile is set up.</p>
        </div>
      ) : (
        <>
          <div className="coursesSemesterCard">
            <span>{semesterLabel}</span>
            <strong>Tap any card to continue</strong>
          </div>

          <div className="courseSubjectGrid">
            {courses.map((course) => (
              <button
                type="button"
                key={course.id}
                className="courseSubjectCard"
                onClick={() => navigate(`/course/${course.id}`)}
                title={course.title}
              >
                <span className="courseTitle">{course.title}</span>
                <span className="courseMeta">
                  {course.semester_name || course.semester || course.category || "Open"}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default Courses;

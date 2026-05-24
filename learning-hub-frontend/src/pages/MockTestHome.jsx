import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";

const isProjectCourse = (course) => {
  const title = String(course?.title || "").toLowerCase();
  return title.includes("minor project") || title.includes("major project");
};

export default function MockTestHome() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [units, setUnits] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("all");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unitsLoading, setUnitsLoading] = useState(false);

  const testableCourses = useMemo(
    () => courses.filter((course) => !isProjectCourse(course)),
    [courses]
  );

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await API.get("/courses");
      setCourses(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load subjects");
    } finally {
      setLoading(false);
    }
  };

  const fetchUnits = async (courseId) => {
    try {
      setUnitsLoading(true);
      setError("");
      const res = await API.get(`/units/${courseId}`);
      setUnits(res.data || []);
    } catch (err) {
      console.error(err);
      setUnits([]);
      setError("No units are available for this subject yet. You can choose All Units or another subject.");
    } finally {
      setUnitsLoading(false);
    }
  };

  const handleCourseChange = (e) => {
    const courseId = e.target.value;
    setError("");
    setSelectedCourse(courseId);
    setSelectedUnit("");

    if (courseId === "all") {
      setUnits([]);
    } else {
      fetchUnits(courseId);
    }
  };

  const startMockTest = () => {
    setError("");

    const chosenCourse = courses.find((course) => String(course.id) === String(selectedCourse));
    if (chosenCourse && isProjectCourse(chosenCourse)) {
      setError("Minor Project and Major Project are not available for mock tests.");
      return;
    }

    let url = `/mock-test/${selectedCourse}`;
    if (selectedUnit) {
      url += `?unit=${selectedUnit}`;
    }
    navigate(url);
  };

  if (loading) {
    return <div className="content mockSetupPage"><div className="card">Loading mock test setup...</div></div>;
  }

  return (
    <div className="content mockSetupPage">
      <h1 className="pageTitle">Mock Test Setup</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        Minor Project and Major Project are project papers, so they are hidden from mock tests.
      </p>

      {error ? <div className="simpleAlert info" style={{ marginBottom: 16 }}>{error}</div> : null}

      <div className="mockSetupForm">
      <select
        value={selectedCourse}
        onChange={handleCourseChange}
        className="w-full p-3 rounded bg-gray-800"
      >
        <option value="all">All Testable Subjects</option>
        {testableCourses.map((course) => (
          <option key={course.id} value={course.id}>
            {course.title}
          </option>
        ))}
      </select>

      <select
        value={selectedUnit}
        onChange={(e) => setSelectedUnit(e.target.value)}
        disabled={selectedCourse === "all"}
        className="w-full p-3 rounded bg-gray-800"
      >
        <option value="">{unitsLoading ? "Loading units..." : "All Units"}</option>
        {units.map((unit) => (
          <option key={unit.id} value={unit.id}>
            {unit.title}
          </option>
        ))}
      </select>

      <button
        onClick={startMockTest}
        className="bg-green-500 px-6 py-3 rounded w-full"
      >
        Start Mock Test
      </button>
      </div>
    </div>
  );
}

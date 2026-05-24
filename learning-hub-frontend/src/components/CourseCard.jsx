import { useNavigate } from "react-router-dom";

function CourseCard({ course }) {
  const navigate = useNavigate();

  return (
    <div className="courseCard p-4 border rounded shadow">

      <h3 className="text-lg font-semibold">{course.course_title}</h3>

      <p className="text-sm text-gray-600">
        {course.completed_lessons} / {course.total_lessons} lessons completed
      </p>

      {/* 🎓 COURSE BUTTON */}
      <button
        onClick={() => navigate(`/course/${course.course_id}`)}
        className="mt-2 bg-green-500 text-white px-3 py-2 rounded w-full"
      >
        {course.progress > 0 ? "Resume Course" : "Start Course"}
      </button>

      {/* 🧠 MOCK TEST BUTTON (NEW) */}
      <button
        onClick={() => navigate(`/mock-test/${course.course_id}`)}
        className="mt-2 bg-blue-500 text-white px-3 py-2 rounded w-full"
      >
        Start Mock Test
      </button>

    </div>
  );
}

export default CourseCard;
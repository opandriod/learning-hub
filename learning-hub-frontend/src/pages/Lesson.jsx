import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/api";

function Lesson() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState(null);
  const [completed, setCompleted] = useState(false);

  // -----------------------------
  // Fetch Lesson
  // -----------------------------
  useEffect(() => {
    fetchLesson();
  }, [id]);

  const fetchLesson = async () => {
    try {
      const res = await API.get(`/lessons/${id}`);
      setLesson(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // -----------------------------
  // Mark Complete
  // -----------------------------
  const markComplete = async () => {
    try {
      await API.post(`/lessons/${id}/complete`);
      setCompleted(true);
      alert("Lesson completed 🎉");
    } catch (err) {
      console.error(err);
    }
  };

  if (!lesson) return <p>Loading...</p>;

  return (
    <div className="dashboard">

      <button onClick={() => navigate(-1)}>← Back</button>

      <h1>{lesson.title}</h1>

      {/* 📄 Content */}
      <p style={{ marginTop: "10px", color: "#cbd5f5" }}>
        {lesson.content_text || "No content available"}
      </p>

      {/* 🎥 Video */}
      {lesson.video_url && (
        <iframe
          width="100%"
          height="400"
          src={lesson.video_url}
          title="Lesson Video"
          style={{ marginTop: "20px", borderRadius: "10px" }}
          allowFullScreen
        />
      )}

      {/* 🔊 Audio */}
      {lesson.audio_url && (
        <audio controls style={{ marginTop: "20px" }}>
          <source src={lesson.audio_url} />
        </audio>
      )}

      {/* ✅ Complete Button */}
      <button
        onClick={markComplete}
        disabled={completed}
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          background: completed ? "#64748b" : "#22c55e",
          border: "none",
          color: "white",
          cursor: completed ? "not-allowed" : "pointer",
          borderRadius: "6px"
        }}
      >
        {completed ? "Completed ✔" : "Mark as Completed"}
      </button>

    </div>
  );
}

export default Lesson;
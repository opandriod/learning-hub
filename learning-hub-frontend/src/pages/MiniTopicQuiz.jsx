import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../api/api";

function MiniTopicQuiz() {
  const { topicId } = useParams();
  const navigate = useNavigate();

  const [payload, setPayload] = useState(null);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMiniQuiz();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId]);

  const questions = payload?.questions || [];
  const current = questions[index];
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  const fetchMiniQuiz = async () => {
    try {
      setLoading(true);
      setError("");
      setResult(null);
      setAnswers({});
      setIndex(0);
      const res = await API.get(`/questions/mini-topic/${topicId}`);
      setPayload(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Could not load mini quiz questions.");
    } finally {
      setLoading(false);
    }
  };

  const selectAnswer = (questionId, option) => {
    if (result) return;
    setAnswers((prev) => ({ ...prev, [questionId]: option }));
  };

  const submitQuiz = async () => {
    try {
      setSubmitting(true);
      setError("");
      const res = await API.post("/questions/mini-topic/submit", {
        topic_id: Number(topicId),
        question_source: payload?.question_source || "quiz_questions_new",
        presented_question_ids: questions.map((q) => q.id),
        answers,
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Could not submit mini quiz.");
    } finally {
      setSubmitting(false);
    }
  };

  const progressLabel = (status) => {
    if (status === "completed") return "Completed";
    if (status === "in_progress") return "In progress";
    return "Needs practice";
  };

  const resultColor = (status) => {
    if (status === "completed") return "#22c55e";
    if (status === "in_progress") return "#f59e0b";
    return "#ef4444";
  };

  if (loading) {
    return (
      <div className="dashboard">
        <h1>Mini Topic Quiz</h1>
        <p>Loading 5-question mini quiz...</p>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="dashboard">
        <h1>Mini Topic Quiz</h1>
        <div className="card" style={{ padding: 24 }}>
          <p style={{ color: "#fecaca" }}>{error}</p>
          <button onClick={() => navigate(-1)}>Back to Unit</button>
        </div>
      </div>
    );
  }

  if (!current && !result) {
    return (
      <div className="dashboard">
        <h1>Mini Topic Quiz</h1>
        <p>No mini quiz questions available for this topic yet.</p>
        <button onClick={() => navigate(-1)}>Back to Unit</button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <button onClick={() => navigate(`/unit/${payload?.topic?.unit_id}`)} style={{ marginBottom: 16 }}>← Back to Unit</button>

      <h1>Mini Topic Quiz</h1>
      <p style={{ color: "#cbd5e1", marginTop: 8 }}>
        {payload?.topic?.course_title} • {payload?.topic?.unit_title}
      </p>
      <h2 style={{ marginTop: 12 }}>{payload?.topic?.topic_title}</h2>

      {!result && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1" }}>
            <span>Question {index + 1} of {questions.length}</span>
            <span>{answeredCount}/{questions.length} answered</span>
          </div>

          <div style={{ height: 8, background: "#1e293b", borderRadius: 999, marginTop: 10 }}>
            <div
              style={{
                width: `${((index + 1) / questions.length) * 100}%`,
                height: "100%",
                borderRadius: 999,
                background: "linear-gradient(90deg,#c43cff,#31c8f6)",
              }}
            />
          </div>

          <div className="card" style={{ marginTop: 24, padding: 24 }}>
            <h2>{current.question}</h2>

            <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
              {current.options.map((opt, optIndex) => {
                const selected = answers[current.id] === opt;
                return (
                  <button
                    key={optIndex}
                    onClick={() => selectAnswer(current.id, opt)}
                    style={{
                      textAlign: "left",
                      padding: "14px 16px",
                      borderRadius: 14,
                      border: selected ? "2px solid #38bdf8" : "1px solid rgba(255,255,255,.18)",
                      background: selected ? "rgba(56,189,248,.25)" : "rgba(15,23,42,.7)",
                      color: "white",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {String.fromCharCode(65 + optIndex)}. {opt}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
            <button disabled={index === 0} onClick={() => setIndex((v) => Math.max(v - 1, 0))}>
              Back
            </button>
            <button disabled={index === questions.length - 1} onClick={() => setIndex((v) => Math.min(v + 1, questions.length - 1))}>
              Next
            </button>
            <button
              onClick={submitQuiz}
              disabled={submitting}
              style={{ background: "linear-gradient(90deg,#c43cff,#31c8f6)", color: "white" }}
            >
              {submitting ? "Submitting..." : "Submit Mini Quiz"}
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="card" style={{ marginTop: 24, padding: 24 }}>
          <h2>Result</h2>
          <h1 style={{ marginTop: 10 }}>{result.score} / {result.total}</h1>
          <p style={{ color: resultColor(result.progress?.status), fontWeight: 800 }}>
            Topic Progress: {progressLabel(result.progress?.status)} ({Math.round(result.progress?.progress_percent || result.percentage)}%)
          </p>
          <p style={{ color: "#cbd5e1" }}>
            Correct: {result.correct} • Incorrect: {result.incorrect} • Not attempted: {result.not_attempted}
          </p>

          <div style={{ marginTop: 20, display: "grid", gap: 10 }}>
            {questions.map((q) => {
              const item = result.review?.find((r) => r.question_id === q.id);
              return (
                <div key={q.id} style={{ padding: 14, borderRadius: 12, background: "rgba(15,23,42,.7)", border: "1px solid rgba(255,255,255,.12)" }}>
                  <strong>{q.question}</strong>
                  <p style={{ marginTop: 8, color: item?.is_correct ? "#86efac" : "#fecaca" }}>
                    Your answer: {item?.your_answer || "Not attempted"}
                  </p>
                  {!item?.is_correct && <p style={{ color: "#bae6fd" }}>Correct answer: {item?.correct_answer || "Not available"}</p>}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button onClick={fetchMiniQuiz}>Retry Mini Quiz</button>
            <button onClick={() => navigate(`/unit/${payload?.topic?.unit_id}`)}>Back to Unit</button>
          </div>
        </div>
      )}

      {error && <p style={{ color: "#fecaca", marginTop: 16 }}>{error}</p>}
    </div>
  );
}

export default MiniTopicQuiz;

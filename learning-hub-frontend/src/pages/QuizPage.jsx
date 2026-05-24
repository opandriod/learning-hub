import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../api/api";

function QuizPage() {
  const { id } = useParams(); // topic_id

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);

  // -----------------------------
  // Fetch Questions
  // -----------------------------
  useEffect(() => {
    fetchQuestions();
  }, [id]);

  const fetchQuestions = async () => {
    try {
     const res = await API.get(`/mock-test/${id}`);
      setQuestions(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // Select Answer
  // -----------------------------
  const handleSelect = (qId, option) => {
    if (result) return;

    setAnswers((prev) => ({
      ...prev,
      [qId]: option
    }));
  };

  // -----------------------------
  // Submit Quiz
  // -----------------------------
  const submitQuiz = async () => {
    try {
      const res = await API.post("/questions/submit", {
        topic_id: id,
        answers: answers
      });

      setResult(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  // -----------------------------
  // LOADING
  // -----------------------------
  if (loading) return <p>Loading quiz...</p>;

  // -----------------------------
  // NO QUESTIONS
  // -----------------------------
  if (questions.length === 0) {
    return (
      <div className="dashboard">
        <h2>No questions available for this topic</h2>
      </div>
    );
  }

  return (
    <div className="dashboard">

      <h1>Quiz</h1>

      {questions.map((q) => (
        <div key={q.id} className="card"> {/* ✅ UPDATED */}

          <h3>{q.question}</h3>

          {q.options.map((opt, i) => {
            const isSelected = answers[q.id] === opt;
            const isCorrect = result && i === q.correct_answer;

            return (
              <div
                key={i}
                onClick={() => handleSelect(q.id, opt)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px",
                  marginTop: "6px",
                  borderRadius: "6px",
                  cursor: result ? "default" : "pointer",
                  border: "1px solid #555",

                  background: result
                    ? isCorrect
                      ? "#22c55e"
                      : isSelected
                      ? "#ef4444"
                      : "transparent"
                    : isSelected
                    ? "#2563eb"
                    : "transparent",

                  color: result
                    ? isCorrect || isSelected
                      ? "white"
                      : "#ccc"
                    : "white"
                }}
              >
                <div
                  style={{
                    width: "14px",
                    height: "14px",
                    borderRadius: "50%",
                    border: "2px solid white",
                    background: isSelected ? "white" : "transparent"
                  }}
                ></div>

                <span>{opt}</span>
              </div>
            );
          })}
        </div>
      ))}

      {!result ? (
        <button
          onClick={submitQuiz}
          disabled={Object.keys(answers).length !== questions.length}
          style={{
            padding: "12px 20px",
            background:
              Object.keys(answers).length === questions.length
                ? "#22c55e"
                : "#555",
            color: "white",
            border: "none",
            borderRadius: "6px"
          }}
        >
          Submit Quiz
        </button>
      ) : (
        <div style={{ marginTop: "20px" }}>
          <h2>
            Score: {result.score} / {result.total}
          </h2>

          <p>
            {result.score === result.total
              ? "Perfect 🎯"
              : result.score >= result.total / 2
              ? "Good 👍"
              : "Keep practicing 💪"}
          </p>

          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "10px",
              padding: "10px",
              background: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "6px"
            }}
          >
            Retry Quiz
          </button>
        </div>
      )}

    </div>
  );
}

export default QuizPage;
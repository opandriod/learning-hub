import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import API from "../api/api";

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function QuizCustom() {
  const query = new URLSearchParams(useLocation().search);
  const navigate = useNavigate();

  const mode = query.get("mode") || "normal";
  const courseId = query.get("subject") || "all";
  const unitId = query.get("unit") || "all";
  const questionCount = query.get("questionCount") || "";
  const timeSeconds = query.get("timeSeconds") || "";

  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState(null);

  const hasSubmittedRef = useRef(false);

  useEffect(() => {
    const startQuiz = async () => {
      try {
        setLoading(true);
        const res = await API.post("/questions/quiz/start", {
          mode,
          course_id: courseId,
          unit_id: unitId,
          question_count: questionCount || null,
          time_seconds: timeSeconds || null,
        });

        setQuestions(res.data.questions || []);
        if (typeof res.data.time_limit_seconds === "number") {
          setTimeLeft(res.data.time_limit_seconds);
        }
      } catch (err) {
        setError(err.response?.data?.error || "Failed to start quiz");
      } finally {
        setLoading(false);
      }
    };

    startQuiz();
  }, [courseId, mode, questionCount, timeSeconds, unitId]);

  useEffect(() => {
    if (timeLeft === null || loading) return undefined;
    if (timeLeft <= 0) {
      handleSubmit(true);
      return undefined;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev !== null ? prev - 1 : prev));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, loading]);

  const currentQuestion = questions[currentIndex];

  const presentedQuestionIds = useMemo(() => {
    if (!questions.length) return [];
    const lastVisibleIndex = Math.min(currentIndex, questions.length - 1);
    return questions.slice(0, lastVisibleIndex + 1).map((question) => question.id);
  }, [currentIndex, questions]);

  const handleSelectAnswer = (option) => {
    if (!currentQuestion) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: option,
    }));
  };

  const handleNext = () => {
    if (currentIndex >= questions.length - 1) {
      handleSubmit(false);
      return;
    }

    setCurrentIndex((prev) => prev + 1);
  };

  const handleSubmit = async (timeUp = false) => {
    if (hasSubmittedRef.current) return;

    try {
      hasSubmittedRef.current = true;
      setSubmitting(true);

      const visibleIds = mode === "daily"
        ? questions.map((question) => question.id)
        : timeUp
        ? questions.slice(0, Math.min(currentIndex + 1, questions.length)).map((question) => question.id)
        : presentedQuestionIds;

      const res = await API.post("/questions/quiz/submit", {
        mode,
        course_id: courseId,
        unit_id: unitId,
        answers,
        presented_question_ids: visibleIds,
        time_limit_seconds: timeSeconds || timeLeft || null,
      });

      navigate("/quiz-result", {
        state: {
          ...res.data,
          timedOut: timeUp,
        },
      });
    } catch (err) {
      hasSubmittedRef.current = false;
      setError(err.response?.data?.error || "Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="pageWrap"><div className="card skeletonCard"><div className="skeleton skeletonLine" style={{width:"55%",height:32}}></div><div className="skeleton skeletonLine" style={{width:"90%"}}></div><div className="skeleton skeletonLine" style={{width:"80%"}}></div></div></div>;
  }

  if (error && !questions.length) {
    return (
      <div className="pageWrap">
        <div className="card">
          <h2>Quiz unavailable</h2>
          <p className="muted">{error}</p>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="pageWrap">
        <div className="card">
          <h2>No questions available</h2>
          <p className="muted">No quiz questions were found for this selection.</p>
        </div>
      </div>
    );
  }

  const selectedAnswer = answers[currentQuestion.id] || "";

  return (
    <div className="pageWrap">
      <div className="pageHeader">
        <div>
          <h1>{mode.charAt(0).toUpperCase() + mode.slice(1)} Quiz</h1>
          <p className="muted">One question at a time. Skip by pressing NEXT without selecting an answer.</p>
        </div>
        <div className="quizHeaderStats">
          <span className="pill">Question {Math.min(currentIndex + 1, questions.length)} / {questions.length}</span>
          {timeLeft !== null ? <span className="pill">Time Left: {formatTime(Math.max(timeLeft, 0))}</span> : null}
        </div>
      </div>

      {error ? <div className="alertError" style={{ marginBottom: 16 }}>{error}</div> : null}

      <div className="card quizAttemptCard">
        <h2>{currentQuestion.question}</h2>

        <div className="quizOptionsList">
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedAnswer === option;
            return (
              <button
                key={`${currentQuestion.id}-${index}`}
                type="button"
                className={`quizOptionButton ${isSelected ? "selected" : ""}`}
                onClick={() => handleSelectAnswer(option)}
              >
                <span className="quizOptionMarker">{String.fromCharCode(65 + index)}</span>
                <span>{option}</span>
              </button>
            );
          })}
        </div>

        <div className="cardFooter quizFooterActions">
          <p className="muted smallText">
            {selectedAnswer
              ? "Answer selected. Press NEXT to continue."
              : "No answer selected. Press NEXT to count this question as not attempted."}
          </p>
          <button className="primaryButton" onClick={handleNext} disabled={submitting}>
            {submitting ? "Submitting..." : currentIndex === questions.length - 1 ? "Finish Quiz" : "NEXT"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default QuizCustom;

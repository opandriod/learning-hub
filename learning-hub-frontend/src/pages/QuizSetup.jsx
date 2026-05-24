import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../api/api";
import { QuizSetupSkeleton } from "../components/Skeleton";

const RAPID_TIME_OPTIONS = [10, 30, 45, 60, 90, 120];
const DAILY_QUESTION_COUNT = 30;
const DAILY_TIME_SECONDS = 600;

const isProjectCourse = (course) => {
  const title = String(course?.title || "").toLowerCase();
  return title.includes("minor project") || title.includes("major project");
};

function formatCooldown(totalSeconds) {
  const safeSeconds = Math.max(Number(totalSeconds || 0), 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function QuizSetup() {
  const navigate = useNavigate();
  const [subjects, setSubjects] = useState([]);
  const [units, setUnits] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [selectedUnit, setSelectedUnit] = useState("all");
  const [quizMode, setQuizMode] = useState("");
  const [questionCount, setQuestionCount] = useState("");
  const [rapidTime, setRapidTime] = useState("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dailyStatus, setDailyStatus] = useState(null);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const res = await API.get("/courses");
        setSubjects((res.data || []).filter((subject) => !isProjectCourse(subject)));
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load subjects");
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, []);

  useEffect(() => {
    const fetchDailyStatus = async () => {
      try {
        const res = await API.get("/questions/quiz/daily-status");
        setDailyStatus(res.data);
      } catch (err) {
        setDailyStatus(null);
      }
    };

    fetchDailyStatus();
  }, []);

  useEffect(() => {
    const fetchUnits = async () => {
      if (!selectedSubject || selectedSubject === "all") {
        setUnits([]);
        setSelectedUnit("all");
        return;
      }

      try {
        const res = await API.get(`/units/${selectedSubject}`);
        setUnits(res.data || []);
      } catch (err) {
        setUnits([]);
        setError(err.response?.data?.error || "Failed to load units");
      }
    };

    fetchUnits();
  }, [selectedSubject]);

  useEffect(() => {
    setQuestionCount("");
  }, [selectedSubject, selectedUnit, quizMode]);

  const normalQuestionOptions = useMemo(() => {
    if (quizMode !== "normal") return [];
    if (selectedSubject === "all") return [10, 20, 30, 40, 50];
    if (selectedUnit === "all") return [10, 20, 30];
    return [5, 10, 15];
  }, [quizMode, selectedSubject, selectedUnit]);

  const handleSubjectChange = (e) => {
    const value = e.target.value;
    setSelectedSubject(value);
    setSelectedUnit("all");
  };

  const handleStartDailyQuiz = () => {
    setError("");

    if (dailyStatus && !dailyStatus.available) {
      setError(`Daily quiz is locked. Try again in ${formatCooldown(dailyStatus.seconds_remaining)}.`);
      return;
    }

    const params = new URLSearchParams({
      subject: "all",
      unit: "all",
      mode: "daily",
      questionCount: String(DAILY_QUESTION_COUNT),
      timeSeconds: String(DAILY_TIME_SECONDS),
    });

    navigate(`/quiz-custom?${params.toString()}`);
  };

  const handleStartQuiz = () => {
    setError("");

    if (!quizMode) {
      setError("Please select quiz mode");
      return;
    }

    if (quizMode === "normal" && !questionCount) {
      setError("Please select number of questions");
      return;
    }

    const params = new URLSearchParams({
      subject: selectedSubject || "all",
      unit: selectedSubject === "all" ? "all" : selectedUnit || "all",
      mode: quizMode,
    });

    if (quizMode === "normal") {
      params.set("questionCount", questionCount);
    }

    if (quizMode === "rapid") {
      params.set("timeSeconds", rapidTime);
    }

    navigate(`/quiz-custom?${params.toString()}`);
  };

  return (
    <div className="pageWrap">
      <div className="pageHeader">
        <div>
          <h1>Quiz Setup</h1>
          <p className="muted">
            Choose Normal or Rapid quiz below. Daily Quiz is separate because it records leaderboard points. Minor/Major Project papers are hidden from quiz setup.
          </p>
        </div>
      </div>

      {error ? <div className="alertError" style={{ marginBottom: 16 }}>{error}</div> : null}

      <div className="dailyQuizCard">
        <div className="dailyQuizTop">
          <div>
            <span className="pill">Leaderboard Mode</span>
            <h2>Daily Quiz</h2>
            <p className="muted">
              Daily Quiz automatically uses <strong>all subjects from your semester</strong>. It does not need subject or unit selection.
            </p>
          </div>

          <button
            className="primaryButton"
            onClick={handleStartDailyQuiz}
            disabled={dailyStatus && !dailyStatus.available}
          >
            Start Daily Quiz
          </button>
        </div>

        <div className="dailyQuizPoints">
          <div>
            <strong>{DAILY_QUESTION_COUNT}</strong>
            <span>Questions</span>
          </div>
          <div>
            <strong>{Math.floor(DAILY_TIME_SECONDS / 60)} min</strong>
            <span>Fixed Time</span>
          </div>
          <div>
            <strong>+4</strong>
            <span>Correct</span>
          </div>
          <div>
            <strong>-1</strong>
            <span>Wrong</span>
          </div>
          <div>
            <strong>0</strong>
            <span>Unattempted</span>
          </div>
        </div>

        {dailyStatus ? (
          dailyStatus.available ? (
            <div className="alertSuccess">Daily Quiz is available now. Your score will be recorded on the Leaderboard.</div>
          ) : (
            <div className="waitBox">
              <strong>Daily Quiz locked</strong>
              <span>Try again in {formatCooldown(dailyStatus.seconds_remaining)}. Daily Quiz can be attempted once every 24 hours.</span>
            </div>
          )
        ) : null}
      </div>

      {loading ? (
        <QuizSetupSkeleton />
      ) : (
      <div className="card quizSetupCard">
        <div className="quizSetupGrid">
          <label>
            Subject
            <select value={selectedSubject} onChange={handleSubjectChange}>
              <option value="all">All Subjects</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={String(subject.id)}>
                  {subject.title}
                </option>
              ))}
            </select>
          </label>

          {selectedSubject !== "all" ? (
            <label>
              Unit
              <select value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)}>
                <option value="all">All Units</option>
                {units.map((unit) => (
                  <option key={unit.id} value={String(unit.id)}>
                    {unit.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label>
            Quiz Mode
            <select value={quizMode} onChange={(e) => setQuizMode(e.target.value)}>
              <option value="">Select Quiz Mode</option>
              <option value="rapid">Rapid</option>
              <option value="normal">Normal</option>
            </select>
          </label>

          {quizMode === "normal" ? (
            <label>
              Select Number of Questions
              <select value={questionCount} onChange={(e) => setQuestionCount(e.target.value)}>
                <option value="">Select amount</option>
                {normalQuestionOptions.map((count) => (
                  <option key={count} value={String(count)}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {quizMode === "rapid" ? (
            <label>
              Select Time
              <select value={rapidTime} onChange={(e) => setRapidTime(e.target.value)}>
                {RAPID_TIME_OPTIONS.map((seconds) => (
                  <option key={seconds} value={String(seconds)}>
                    {seconds} seconds
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="quizModeNotes">
          <div className="miniCard">
            <strong>Rapid</strong>
            <p className="muted smallText">Random questions one by one until the timer runs out.</p>
          </div>
          <div className="miniCard">
            <strong>Normal</strong>
            <p className="muted smallText">Choose a question count based on your subject and unit selection.</p>
          </div>
        </div>

        <button className="primaryButton fullWidth" onClick={handleStartQuiz}>
          START QUIZ
        </button>
      </div>
      )}
    </div>
  );
}

export default QuizSetup;

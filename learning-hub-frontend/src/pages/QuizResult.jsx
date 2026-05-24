import { useLocation, useNavigate } from "react-router-dom";

function QuizResult() {
  const { state } = useLocation();
  const navigate = useNavigate();

  if (!state) {
    return (
      <div className="pageWrap">
        <div className="card">
          <h2>No quiz result found</h2>
          <button className="primaryButton" onClick={() => navigate("/quiz-setup")}>Go to Quiz Setup</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pageWrap quizResultPage">
      <div className="pageHeader quizResultHero">
        <div>
          <h1>Quiz Result</h1>
          <p className="muted">
            {state.timedOut ? "Time ran out and your quiz was submitted automatically." : "Your quiz attempt has been completed."}
          </p>
        </div>
      </div>

      <div className="statsGrid quizResultStatsGrid">
        <div className="statCard quizResultStat"><h3>{state.questions_attempted}</h3><p>Attempted</p></div>
        <div className="statCard quizResultStat"><h3>{state.correct}</h3><p>Correct</p></div>
        <div className="statCard quizResultStat"><h3>{state.incorrect}</h3><p>Incorrect</p></div>
        <div className="statCard quizResultStat"><h3>{state.not_attempted}</h3><p>Not attempted</p></div>
      </div>

      <div className="card quizResultSummaryCard" style={{ marginTop: 24 }}>
        <h2>Summary</h2>
        <div className="infoList">
          <p><strong>Mode:</strong> {state.mode}</p>
          <p><strong>Total Seen Questions:</strong> {state.total_seen_questions}</p>
          <p><strong>Score:</strong> {state.score_points}</p>
        </div>
        <div className="cardFooter" style={{ marginTop: 18 }}>
          <button className="secondaryButton" onClick={() => navigate("/quiz-setup")}>Back to Setup</button>
          <button className="primaryButton" onClick={() => navigate("/quiz-setup")}>Start Another Quiz</button>
        </div>
      </div>
    </div>
  );
}

export default QuizResult;

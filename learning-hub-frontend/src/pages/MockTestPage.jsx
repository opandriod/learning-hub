import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import API from "../api/api";

function shuffleArray(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

export default function MockTestPage() {
  const { id } = useParams();

  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recentResults, setRecentResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const fetchMockTest = async () => {
      try {
        const [questionRes, resultsRes] = await Promise.all([
          API.get(`/mock-test/${id}`),
          API.get('/mock-test/results').catch(() => ({ data: [] })),
        ]);

        const formattedQuestions = (questionRes.data || []).map((question) => ({
          ...question,
          options: shuffleArray(question.options || []),
        }));

        setQuestions(formattedQuestions);
        setRecentResults(Array.isArray(resultsRes.data) ? resultsRes.data : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMockTest();
  }, [id]);

  const currentQuestion = questions[currentIndex];

  const handleSelect = (qId, optId) => {
    if (result) return;

    setAnswers((prev) => ({
      ...prev,
      [qId]: optId,
    }));
  };

  const summary = useMemo(() => {
    const attempted = Object.keys(answers).length;
    return {
      attempted,
      correct: result?.correct ?? result?.score ?? 0,
      incorrect: result?.incorrect ?? 0,
      unanswered: questions.length - attempted,
      total: questions.length,
    };
  }, [answers, questions.length, result]);

  const reviewByQuestionId = useMemo(() => {
    const map = {};
    (result?.review || []).forEach((item) => {
      map[item.question_id] = item;
    });
    return map;
  }, [result]);

  const submitTest = async () => {
    if (!questions.length || submitting || result) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      const res = await API.post('/mock-test/submit', {
        course_id: id === 'all' ? null : Number(id),
        answers,
        presented_question_ids: questions.map((question) => question.id),
      });

      setResult(res.data);
      const resultsRes = await API.get('/mock-test/results');
      setRecentResults(Array.isArray(resultsRes.data) ? resultsRes.data : []);
    } catch (err) {
      console.error('Save failed', err);
      setSubmitError(err.response?.data?.error || 'Submitting failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="content mockTestPage"><div className="card mockQuestionCard" style={{ padding: 24 }}>Preparing your mock test...</div></div>;

  if (!questions.length) {
    return <h2 className="content">No mock questions found</h2>;
  }

  const selectedOptionId = answers[currentQuestion.id];
  const currentReview = reviewByQuestionId[currentQuestion.id];
  const correctOption = result && currentReview
    ? currentQuestion.options.find((opt) => opt.id === currentReview.correct_option_id)
    : null;

  const questionPickerBlock = (
    <div className="resultCard mockQuestionPickerCard" style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>Question picker</h3>
        <span className="muted">Tap to skip</span>
      </div>
      <div className="mockQuestionPickerGrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
        {questions.map((question, index) => {
          const answered = answers[question.id] !== undefined;
          const active = index === currentIndex;
          return (
            <button
              key={question.id}
              type="button"
              onClick={() => setCurrentIndex(index)}
              className={active ? '' : 'secondaryButton'}
              style={active ? { padding: '10px 0' } : { padding: '10px 0', background: answered ? 'rgba(37, 99, 235, 0.24)' : '#1e293b' }}
              aria-label={`Go to question ${index + 1}`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="content mockTestPage" style={{ display: 'grid', gap: 24 }}>
      <div className="pageHeader">
        <div>
          <div className="pill">Mock Test</div>
          <h1 style={{ margin: '10px 0 6px' }}>One question at a time</h1>
          <p className="muted" style={{ margin: 0 }}>
            Use Next and Back to move between questions. You can submit anytime.
          </p>
        </div>
      </div>

      <div className="mockTestLayout">
        <div className="mobileQuestionPicker">
          {questionPickerBlock}
        </div>

        <div className="card mockQuestionCard" style={{ padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div>
              <div className="muted">Question {currentIndex + 1} of {questions.length}</div>
              <h2 style={{ margin: '8px 0 0', lineHeight: 1.5 }}>{currentQuestion.question_text}</h2>
            </div>
            <div style={{ minWidth: 64, textAlign: 'right' }}>
              <div className="pill">{Object.keys(answers).length}/{questions.length}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {currentQuestion.options.map((opt, index) => {
              const isSelected = selectedOptionId === opt.id;
              const isCorrect = !!result && currentReview?.correct_option_id === opt.id;
              const showReview = !!result;

              let border = '1px solid rgba(148, 163, 184, 0.2)';
              let background = '#0f172a';

              if (!showReview && isSelected) {
                border = '1px solid rgba(96, 165, 250, 0.8)';
                background = 'rgba(37, 99, 235, 0.2)';
              }

              if (showReview && isCorrect) {
                border = '1px solid rgba(74, 222, 128, 0.8)';
                background = 'rgba(34, 197, 94, 0.18)';
              } else if (showReview && isSelected && !isCorrect) {
                border = '1px solid rgba(248, 113, 113, 0.8)';
                background = 'rgba(239, 68, 68, 0.18)';
              }

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(currentQuestion.id, opt.id)}
                  disabled={showReview}
                  style={{
                    textAlign: 'left',
                    padding: '14px 16px',
                    borderRadius: 14,
                    border,
                    background,
                    color: '#fff',
                    cursor: showReview ? 'default' : 'pointer',
                    opacity: showReview ? 1 : undefined,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <span>{String.fromCharCode(65 + index)}. {opt.option_text}</span>
                    {result && isCorrect && <strong style={{ color: '#86efac' }}>Correct</strong>}
                    {result && isSelected && !isCorrect && <strong style={{ color: '#fca5a5' }}>Your answer</strong>}
                  </div>
                </button>
              );
            })}
          </div>

          {result && (
            <div style={{ marginTop: 18, padding: 16, borderRadius: 14, background: 'rgba(15, 23, 42, 0.72)', border: '1px solid rgba(148, 163, 184, 0.14)' }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Answer review</div>
              {selectedOptionId === undefined ? (
                <div className="muted">You did not answer this question.</div>
              ) : selectedOptionId === correctOption?.id ? (
                <div style={{ color: '#86efac' }}>You selected the correct answer.</div>
              ) : (
                <div style={{ color: '#fca5a5' }}>
                  Incorrect. Correct answer: <strong>{correctOption?.option_text}</strong>
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 24, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="secondaryButton"
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
            >
              Back
            </button>

            <button
              type="button"
              className="secondaryButton"
              onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIndex === questions.length - 1}
            >
              Next
            </button>
          </div>

          {!result && (
            <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(148, 163, 184, 0.14)' }}>
              <button
                type="button"
                onClick={submitTest}
                disabled={submitting}
                style={{ width: '100%', padding: '14px 18px', fontWeight: 700 }}
              >
                {submitting ? 'Submitting...' : 'Submit Test'}
              </button>
              <p className="muted" style={{ marginTop: 12 }}>
                You can submit without answering every question.
              </p>
            </div>
          )}

          {submitError && <div className="alertError" style={{ marginTop: 12 }}>{submitError}</div>}
        </div>

        {result && (
          <div className="card mockReviewCard" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: 0 }}>All correct answers</h2>
                <p className="muted" style={{ margin: '8px 0 0' }}>
                  Full review after submission. Each question shows your answer and the correct answer.
                </p>
              </div>
              <div className="pill">{result.score}/{result.total}</div>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              {questions.map((question, index) => {
                const selectedId = answers[question.id];
                const selectedOption = question.options.find((opt) => opt.id === selectedId);
                const review = reviewByQuestionId[question.id];
                const correctOption = review
                  ? question.options.find((opt) => opt.id === review.correct_option_id)
                  : null;
                const isCorrect = !!review?.is_correct;

                return (
                  <div
                    key={question.id}
                    style={{
                      padding: 16,
                      borderRadius: 16,
                      border: '1px solid rgba(148, 163, 184, 0.16)',
                      background: 'rgba(15, 23, 42, 0.72)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10, flexWrap: 'wrap' }}>
                      <strong>Q{index + 1}. {question.question_text}</strong>
                      <span
                        style={{
                          fontWeight: 700,
                          color: selectedId === undefined ? '#cbd5e1' : isCorrect ? '#86efac' : '#fca5a5',
                        }}
                      >
                        {selectedId === undefined ? 'Not answered' : isCorrect ? 'Correct' : 'Incorrect'}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gap: 8 }}>
                      <div>
                        <span className="muted">Your answer: </span>
                        <span>{selectedOption ? selectedOption.option_text : 'Not answered'}</span>
                      </div>
                      <div>
                        <span className="muted">Correct answer: </span>
                        <strong style={{ color: '#86efac' }}>{correctOption?.option_text || 'N/A'}</strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <aside className="mockTestSidePanel">
          <div className="resultCard" style={{ padding: 20 }}>
            <h3 style={{ marginTop: 0 }}>Progress</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Answered</span><strong>{summary.attempted}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Unanswered</span><strong>{summary.unanswered}</strong></div>
              {result && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Correct</span><strong>{result.correct}</strong></div>}
              {result && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Incorrect</span><strong>{result.incorrect}</strong></div>}
              {result && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18 }}><span>Score</span><strong>{result.score}/{result.total}</strong></div>}
            </div>
          </div>

          <div className="desktopQuestionPicker">
            {questionPickerBlock}
          </div>

          <div className="resultCard" style={{ padding: 20 }}>
            <h3 style={{ marginTop: 0 }}>Latest 5 results</h3>
            {recentResults.length === 0 ? (
              <div className="muted">No attempts saved yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {recentResults.map((item, index) => (
                  <div key={`${item.date}-${index}`} style={{ paddingBottom: 12, borderBottom: index === recentResults.length - 1 ? 'none' : '1px solid rgba(148, 163, 184, 0.12)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <strong>{item.score}/{item.total}</strong>
                      <span className="muted">{formatDate(item.date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

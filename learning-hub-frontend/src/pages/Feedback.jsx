import { useState } from "react";
import API from "../api/api";
import { ButtonLoader } from "../components/Skeleton";

function Feedback() {
  const [rating, setRating] = useState(4);
  const [category, setCategory] = useState("General feedback");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("");
    setError("");
    if (!message.trim()) {
      setError("Please write your feedback first.");
      return;
    }
    try {
      setLoading(true);
      await API.post("/feedback", { rating, category, message });
      setStatus("Thank you. Your feedback was recorded.");
      setMessage("");
    } catch (err) {
      setError(err.response?.data?.error || "Could not submit feedback. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pageWrap studentUtilityPage">
      <div className="studentHeroCard utilityHero">
        <div>
          <span className="studentKicker">Feedback</span>
          <h1>Help improve Learning Hub</h1>
          <p>Tell us what feels confusing, slow, helpful, or missing. Good feedback makes the LMS better for every student.</p>
        </div>
        <div className="supportInfoCard">
          <strong>Quick feedback</strong>
          <p>Rate your experience and describe one thing we should improve next.</p>
        </div>
      </div>

      <form className="card proFormCard feedbackForm" onSubmit={handleSubmit}>
        <h2>Send feedback</h2>
        {status ? <p className="alertSuccess">{status}</p> : null}
        {error ? <p className="alertError">{error}</p> : null}

        <div className="ratingRow" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button key={value} type="button" className={rating >= value ? "active" : ""} onClick={() => setRating(value)} aria-label={`${value} star rating`}>★</button>
          ))}
        </div>

        <label><span>Category</span><select value={category} onChange={(e) => setCategory(e.target.value)}><option>General feedback</option><option>UI/design</option><option>Login/account</option><option>Courses/topics</option><option>Quiz/mock test</option><option>Project store</option><option>Bug report</option></select></label>
        <label><span>Your feedback</span><textarea rows="7" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Example: The dashboard is clear, but the quiz page needs better spacing on mobile." /></label>
        <button type="submit" disabled={loading}>{loading ? <ButtonLoader label="Submitting" /> : "Submit Feedback"}</button>
      </form>
    </div>
  );
}

export default Feedback;

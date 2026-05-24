import { useState } from "react";
import API from "../api/api";
import { ButtonLoader } from "../components/Skeleton";

function Contact() {
  const [form, setForm] = useState({ name: localStorage.getItem("name") || "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("");
    setError("");
    if (!form.name.trim() || !form.subject.trim() || !form.message.trim()) {
      setError("Please fill your name, subject, and message.");
      return;
    }
    try {
      setLoading(true);
      await API.post("/contact", form);
      setStatus("Message sent. We will review it as soon as possible.");
      setForm((prev) => ({ ...prev, subject: "", message: "" }));
    } catch (err) {
      setError(err.response?.data?.error || "Could not send your message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pageWrap studentUtilityPage">
      <div className="studentHeroCard utilityHero">
        <div>
          <span className="studentKicker">Contact</span>
          <h1>Need help with Learning Hub?</h1>
          <p>Send a clear message about login, courses, quizzes, project downloads, or account issues.</p>
        </div>
        <div className="supportInfoCard">
          <strong>Good support message</strong>
          <p>Include your account email, page name, and what happened before the problem.</p>
        </div>
      </div>

      <div className="gridTwo contactFeedbackGrid">
        <form className="card proFormCard" onSubmit={handleSubmit}>
          <h2>Contact support</h2>
          {status ? <p className="alertSuccess">{status}</p> : null}
          {error ? <p className="alertError">{error}</p> : null}
          <label><span>Name</span><input value={form.name} onChange={(e) => handleChange("name", e.target.value)} placeholder="Your full name" /></label>
          <label><span>Email optional</span><input type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} placeholder="name@gmail.com" /></label>
          <label><span>Subject</span><input value={form.subject} onChange={(e) => handleChange("subject", e.target.value)} placeholder="Example: I cannot open my course" /></label>
          <label><span>Message</span><textarea rows="6" value={form.message} onChange={(e) => handleChange("message", e.target.value)} placeholder="Explain the problem clearly..." /></label>
          <button type="submit" disabled={loading}>{loading ? <ButtonLoader label="Sending" /> : "Send Message"}</button>
        </form>

        <aside className="card supportChecklist">
          <h2>Common help topics</h2>
          <div className="supportList">
            <div><strong>Login issue</strong><p>Try password reset or check email confirmation.</p></div>
            <div><strong>Course not showing</strong><p>Check your selected semester in Profile.</p></div>
            <div><strong>Quiz problem</strong><p>Send the quiz mode, subject, and time of attempt.</p></div>
            <div><strong>Project download</strong><p>Include project name and payment/reference details.</p></div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default Contact;

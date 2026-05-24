import { useState } from "react";
import { Link } from "react-router-dom";
import API from "../api/api";
import ThemeToggle from "../components/ThemeToggle";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!email.trim()) {
      setError("Please enter your registered email address.");
      return;
    }

    try {
      setLoading(true);
      await API.post("/auth/forgot-password", { email: email.trim().toLowerCase() });
      setMessage("If this email exists, Supabase has sent a password reset link. Check your inbox/spam.");
    } catch (err) {
      const backendMessage = err.response?.data?.message || err.response?.data?.error;
      setMessage(
        backendMessage ||
          "Request saved on this page. If your backend does not have email reset enabled yet, contact the admin to reset your password."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgotPageShell">
      <div className="forgotTopBar">
        <Link to="/login" className="secondaryButton">← Back to Login</Link>
        <ThemeToggle />
      </div>

      <form className="loginCard forgotCard" onSubmit={handleSubmit}>
        <div className="loginCardHeader">
          <span className="loginIcon">🔑</span>
          <div>
            <h2>Forgot Password</h2>
            <p className="muted">
              Enter your registered email. The system will request a password reset for your account.
            </p>
          </div>
        </div>

        {error && <div className="alertError">{error}</div>}
        {message && <div className="alertSuccess">{message}</div>}

        <label className="fancyField">
          <span>Registered Email</span>
          <div className="inputWithIcon">
            <span>✉️</span>
            <input
              type="email"
              placeholder="example@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
        </label>

        <button type="submit" disabled={loading} className="primaryButton fullWidth loginSubmitButton">
          {loading ? "Sending request..." : "Request Password Reset"}
        </button>

        <div className="loginHelpBox">
          <strong>Important</strong>
          <span>
            The reset link is handled by Supabase Auth. After opening the email link, you can set a new password securely.
          </span>
        </div>
      </form>
    </div>
  );
}

export default ForgotPassword;

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase, isSupabaseAuthReady } from "../api/supabaseClient";
import ThemeToggle from "../components/ThemeToggle";

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      if (!isSupabaseAuthReady || !supabase) {
        setError("Supabase Auth is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        setMessage("Open this page from the password reset email link, then enter your new password.");
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!isSupabaseAuthReady || !supabase) {
      setError("Supabase Auth is not configured.");
      return;
    }

    try {
      setLoading(true);
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      await supabase.auth.signOut({ scope: "global" });
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("semester_id");
      localStorage.removeItem("name");

      setMessage("Password updated successfully. Please login again with your new password.");
      setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (err) {
      setError(err.message || "Could not update password. Open the latest reset link and try again.");
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
          <span className="loginIcon">🔐</span>
          <div>
            <h2>Reset Password</h2>
            <p className="muted">Enter a new password for your Supabase Auth account.</p>
          </div>
        </div>

        {error && <div className="alertError">{error}</div>}
        {message && <div className="alertSuccess">{message}</div>}

        <label className="fancyField">
          <span>New Password</span>
          <div className="inputWithIcon">
            <span>🔒</span>
            <input
              type="password"
              placeholder="New password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
        </label>

        <label className="fancyField">
          <span>Confirm Password</span>
          <div className="inputWithIcon">
            <span>🔒</span>
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
        </label>

        <button type="submit" disabled={loading} className="primaryButton fullWidth loginSubmitButton">
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>
    </div>
  );
}

export default ResetPassword;

import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../api/api";

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || "").trim());

const normalizeErrorMessage = (value) => {
  if (!value) return "Something went wrong. Please try again.";

  if (typeof value === "string") {
    const jsonStart = value.indexOf("{");
    if (jsonStart !== -1) {
      try {
        const parsed = JSON.parse(value.slice(jsonStart));
        return parsed.msg || parsed.message || parsed.error_description || parsed.error || value;
      } catch (_) {
        return value;
      }
    }
    return value;
  }

  return value.msg || value.message || value.error_description || value.error || JSON.stringify(value);
};

export default function Register() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    semester_id: "",
    password: "",
    confirmPassword: "",
    role: "student",
  });

  const [loading, setLoading] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [requestId, setRequestId] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const formatTime = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const cleanName = formData.name.trim();
    const cleanEmail = formData.email.trim().toLowerCase();
    const cleanPhone = formData.phone.trim();
    const cleanSemesterId = formData.semester_id || null;

    if (!cleanName || !cleanEmail || !formData.password || !formData.confirmPassword) {
      setError("Full name, email, password, and confirm password are required.");
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address, for example name@gmail.com.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    try {
      setLoading(true);

      const res = await API.post("/auth/register", {
        name: cleanName,
        email: cleanEmail,
        phone: cleanPhone || null,
        semester_id: cleanSemesterId,
        password: formData.password,
        role: formData.role,
      });

      const data = res.data || {};

      if (data.request_id) {
        setWaitingApproval(true);
        setRequestId(data.request_id);
        setSecondsLeft(120);
        setMessage(
          "Account created as student. Confirm your email first. Your admin request is waiting for instructor approval."
        );
      } else {
        setMessage("Account created. Please check your email and click the confirmation link before logging in.");
        setTimeout(() => {
          navigate("/login");
        }, 3500);
      }
    } catch (err) {
      setError(
        normalizeErrorMessage(err?.response?.data?.error || err?.response?.data || err?.message) ||
          "Something went wrong while registering."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!waitingApproval) return;

    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [waitingApproval]);

  useEffect(() => {
    if (!waitingApproval || !requestId) return;

    const interval = setInterval(async () => {
      try {
        const res = await API.get(`/auth/admin-request-status/${requestId}`);
        const data = res.data || {};

        if (data.status === "approved") {
          clearInterval(interval);
          setWaitingApproval(false);
          setMessage("Instructor approved your request. You can now login as admin.");
          setTimeout(() => {
            navigate("/login");
          }, 1500);
        }

        if (data.status === "rejected") {
          clearInterval(interval);
          setWaitingApproval(false);
          setError("Your admin request was rejected or expired.");
        }
      } catch (err) {
        // Keep polling quietly. Network errors should not clear the request screen.
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [waitingApproval, requestId, navigate]);

  return (
    <div className="authShell singlePageShell">
      <form className="authForm registerForm" onSubmit={handleRegister}>
        <div className="authTopActions">
          <span className="pill">Learning Hub</span>
        </div>

        <div>
          <h2>Create Account</h2>
          <p className="muted">
            If you choose Admin, your account will be created as student first and a request
            will be sent to the instructor for approval.
          </p>
        </div>

        {message && <div className="alertSuccess" role="status">{message}</div>}
        {error && <div className="alertError" role="alert">{error}</div>}

        <label>
          <span>Full Name</span>
          <input
            type="text"
            name="name"
            placeholder="Enter your full name"
            value={formData.name}
            onChange={handleChange}
            autoComplete="name"
          />
        </label>

        <label>
          <span>Email Address</span>
          <input
            type="email"
            name="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={handleChange}
            pattern="^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"
            title="Enter a valid email like name@gmail.com"
            autoComplete="email"
          />
        </label>

        <label>
          <span>Phone Number <small className="optionalText">optional</small></span>
          <input
            type="tel"
            name="phone"
            placeholder="Example: +919876543210"
            value={formData.phone}
            onChange={handleChange}
            autoComplete="tel"
          />
        </label>

        <label>
          <span>Role</span>
          <select name="role" value={formData.role} onChange={handleChange}>
            <option value="student">Student</option>
            <option value="admin">Apply for Admin</option>
          </select>
        </label>

        {formData.role === "student" && (
          <label>
            <span>Semester <small className="optionalText">optional</small></span>
            <select name="semester_id" value={formData.semester_id} onChange={handleChange}>
              <option value="">Select semester later</option>
              <option value="1">Semester 1</option>
              <option value="2">Semester 2</option>
              <option value="3">Semester 3</option>
              <option value="4">Semester 4</option>
              <option value="5">Semester 5</option>
              <option value="6">Semester 6</option>
            </select>
          </label>
        )}

        <label>
          <span>Password</span>
          <input
            type="password"
            name="password"
            placeholder="Create a password"
            value={formData.password}
            onChange={handleChange}
            autoComplete="new-password"
          />
        </label>

        <label>
          <span>Confirm Password</span>
          <input
            type="password"
            name="confirmPassword"
            placeholder="Confirm password"
            value={formData.confirmPassword}
            onChange={handleChange}
            autoComplete="new-password"
          />
        </label>

        <button type="submit" className="primaryButton fullWidth" disabled={loading || waitingApproval}>
          {loading ? "Creating..." : "Register"}
        </button>

        <Link to="/" className="secondaryButton fullWidth authHomeButton">
          Back to Home
        </Link>

        <p className="switchText">
          Already have an account? <Link to="/login">Go back to Login</Link>
        </p>

        {waitingApproval && (
          <div className="waitBox">
            <strong>Waiting for instructor approval...</strong>
            <span>Time remaining: {formatTime(secondsLeft)}</span>
          </div>
        )}
      </form>
    </div>
  );
}

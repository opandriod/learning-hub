import { useEffect, useMemo, useState } from "react";
import API from "../api/api";
import { supabase, isSupabaseAuthReady } from "../api/supabaseClient";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ButtonLoader } from "../components/Skeleton";

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || "").trim());

function Login() {
  const [email, setEmail] = useState(() => localStorage.getItem("remembered_email") || "");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(() => Boolean(localStorage.getItem("remembered_email")));
  const [showPassword, setShowPassword] = useState(false);
  const [showOtpBox, setShowOtpBox] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [slowLoading, setSlowLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const isAndroidApp = useMemo(() => {
    const userAgent = window.navigator.userAgent || "";
    return /LearningHubAndroidApp/i.test(userAgent) || (/Android/i.test(userAgent) && /; wv\)/i.test(userAgent));
  }, []);

  const getSafeNextPath = (role, semesterId) => {
    const params = new URLSearchParams(location.search);
    const next = params.get("next");
    if (!next || !next.startsWith("/") || next.startsWith("//")) return "";

    const sharedPaths = ["/projects", "/leaderboard", "/profile"];
    const studentPaths = [
      "/dashboard",
      "/courses",
      "/course/",
      "/unit/",
      "/topic/",
      "/mini-quiz/",
      "/syllabus",
      "/practice-quiz",
      "/quiz-setup",
      "/quiz-custom",
      "/quiz-result",
      "/mock-test",
      "/apply-sub-admin",
      "/pdf",
    ];

    if (sharedPaths.some((path) => next === path || next.startsWith(`${path}/`))) return next;
    if (role === "student" && semesterId && studentPaths.some((path) => next === path || next.startsWith(path))) return next;
    return "";
  };

  const redirectByRole = (role, semesterId) => {
    const safeNextPath = getSafeNextPath(role, semesterId);
    if (safeNextPath) {
      navigate(safeNextPath, { replace: true });
    } else if (role === "admin") {
      navigate("/admin", { replace: true });
    } else if (role === "instructor") {
      navigate("/instructor/requests", { replace: true });
    } else if (role === "sub_admin") {
      navigate("/sub-admin/projects", { replace: true });
    } else if (!semesterId) {
      navigate("/setup", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  };

  const saveLoginData = (data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("role", data.role);
    localStorage.setItem("semester_id", data.semester_id || "");
    localStorage.setItem("name", data.name || "");
    redirectByRole(data.role, data.semester_id);
  };

  useEffect(() => {
    if (!loading) {
      setSlowLoading(false);
      return undefined;
    }

    const timer = window.setTimeout(() => setSlowLoading(true), 4500);
    return () => window.clearTimeout(timer);
  }, [loading]);


  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("verified") === "1" || params.get("type") === "signup") {
      setMessage("Email confirmed. You can now log in.");
    } else if (params.get("next")) {
      setMessage("Please log in first to open that page.");
    }
  }, [location.search]);

  const finishSupabaseLogin = async (accessToken) => {
    const res = await API.post("/auth/supabase-login", { access_token: accessToken });
    saveLoginData(res.data);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const role = localStorage.getItem("role");
    const semesterId = localStorage.getItem("semester_id");

    if (token && role) {
      redirectByRole(role, semesterId);
      return;
    }

    const completeOAuthRedirect = async () => {
      if (!isSupabaseAuthReady || !supabase) return;

      // After Logout, do not restore the cached Google/phone Supabase session.
      if (sessionStorage.getItem("manual_logout") === "1") {
        sessionStorage.removeItem("manual_logout");
        try {
          await supabase.auth.signOut({ scope: "global" });
        } catch (err) {
          console.warn("Supabase session was already cleared.", err);
        }
        return;
      }

      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const accessToken = data?.session?.access_token;
        if (accessToken) {
          setLoading(true);
          await finishSupabaseLogin(accessToken);
        }
      } catch (err) {
        setError(err.message || "Google login could not be completed.");
      } finally {
        setLoading(false);
      }
    };

    completeOAuthRedirect();
  }, []);

  const passwordHint = useMemo(() => {
    if (!password) return "";
    if (password.length < 6) return "Use at least 6 characters.";
    return "";
  }, [password]);

  const normalizePhone = (value) => {
    const cleaned = value.trim().replace(/\s+/g, "");
    if (!cleaned) return "";
    if (cleaned.startsWith("+")) return cleaned;
    if (/^[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned}`;
    return cleaned;
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();

    if (!isValidEmail(cleanEmail)) {
      setError("Please enter a valid email address, for example name@gmail.com.");
      return;
    }

    try {
      setLoading(true);
      const res = await API.post("/auth/login", { email: cleanEmail, password });

      if (isSupabaseAuthReady && supabase && res.data?.supabase_session?.access_token && res.data?.supabase_session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: res.data.supabase_session.access_token,
          refresh_token: res.data.supabase_session.refresh_token,
        });
      }

      if (rememberMe) {
        localStorage.setItem("remembered_email", cleanEmail);
      } else {
        localStorage.removeItem("remembered_email");
      }

      saveLoginData(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Login failed. Please check your details.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setMessage("");

    if (!isSupabaseAuthReady || !supabase) {
      setError("Supabase Auth is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend .env.");
      return;
    }

    try {
      setLoading(true);
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/login`,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (googleError) throw googleError;
    } catch (err) {
      setError(err.message || "Google sign in failed.");
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    setError("");
    setMessage("");

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
      setError("Please enter your mobile number.");
      return;
    }

    if (!isSupabaseAuthReady || !supabase) {
      setError("Supabase Auth is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend .env.");
      return;
    }

    try {
      setLoading(true);
      const { error: otpError } = await supabase.auth.signInWithOtp({ phone: cleanPhone });
      if (otpError) throw otpError;

      setPhone(cleanPhone);
      setOtpSent(true);
      setMessage("OTP sent. Please check your phone.");
    } catch (err) {
      setOtpSent(false);
      setError(err.message || "Could not send OTP. Check Supabase phone provider settings.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone) {
      setError("Please enter your mobile number.");
      return;
    }

    if (!otpSent) {
      await handleSendOtp();
      return;
    }

    if (!otp.trim()) {
      setError("Please enter the OTP code.");
      return;
    }

    if (!isSupabaseAuthReady || !supabase) {
      setError("Supabase Auth is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend .env.");
      return;
    }

    try {
      setLoading(true);
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        phone: cleanPhone,
        token: otp.trim(),
        type: "sms",
      });

      if (verifyError) throw verifyError;

      const accessToken = data?.session?.access_token;
      if (!accessToken) throw new Error("OTP verified, but no session was returned.");

      await finishSupabaseLogin(accessToken);
    } catch (err) {
      setError(err.message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="simpleLoginPage">
      <section className="simpleLoginCard">
        <div className="simpleLoginHeader">
          <div className="simpleLogo"><img src="/logo-app.png" alt="Learning Hub logo" /></div>
          <h1>Welcome Back</h1>
          <p>Login to continue to Learning Hub.</p>
        </div>

        {isAndroidApp ? (
          <div className="simpleAlert info">
            Google sign-in is not available inside the Android app because Google blocks embedded WebView logins.
            Use email and password here. If you created your account using Google on the website, tap "Forgot password?" once to create a password for the same Gmail account.
          </div>
        ) : (
          <>
            <button type="button" className="googleLoginButton" onClick={handleGoogleLogin} disabled={loading}>
              <span className="googleIcon">G</span>
              {loading ? <><ButtonLoader label="Signing in with Google" /> Connecting...</> : "Sign in with Google"}
            </button>

            <div className="simpleDivider"><span>OR</span></div>
          </>
        )}

        {error && <div className="simpleAlert error">{error}</div>}
        {message && <div className="simpleAlert success">{message}</div>}
        {slowLoading && (
          <div className="simpleAlert info">
            Starting the server. This can take a few seconds on the free hosting plan.
          </div>
        )}

        {!showOtpBox ? (
          <form className="simpleLoginForm" onSubmit={handleEmailLogin}>
            <label>
              Email Address
              <div className="simpleInputWrap">
                <span>✉</span>
                <input type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} pattern="^[^\s@]+@[^\s@]+\.[^\s@]{2,}$" title="Enter a valid email like name@gmail.com" autoComplete="email" required />
              </div>
            </label>

            <label>
              Password
              <div className="simpleInputWrap">
                <span>🔒</span>
                <input type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                <button type="button" className="plainShowButton" onClick={() => setShowPassword((value) => !value)}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {passwordHint && <small>{passwordHint}</small>}
            </label>

            <button type="submit" className="emailLoginButton" disabled={loading}>
              {loading ? <><ButtonLoader label="Signing in" /> Signing in...</> : "Sign in with Email"}
            </button>

            <Link to="/" className="loginHomeButton">
              Back to Home
            </Link>

            <div className="simpleOptionsRow">
              <label className="simpleRemember">
                <input type="checkbox" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />
                Remember me
              </label>
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
          </form>
        ) : (
          <form className="simpleLoginForm" onSubmit={handlePhoneLogin}>
            <label>
              Mobile Number
              <div className="simpleInputWrap">
                <span>☎</span>
                <input type="tel" placeholder="Enter mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required />
              </div>
              <small>Use country code, for example +919876543210. Indian 10-digit numbers are converted to +91 automatically.</small>
            </label>

            <button type="button" className="phoneLoginButton" onClick={handleSendOtp} disabled={loading}>
              {loading ? <><ButtonLoader label="Sending OTP" /> Sending...</> : otpSent ? "Resend OTP" : "Send OTP"}
            </button>

            {otpSent && (
              <label>
                OTP Code
                <div className="simpleInputWrap">
                  <span>🔑</span>
                  <input type="text" placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" required />
                </div>
              </label>
            )}

            <button type="submit" className="phoneLoginButton" disabled={loading || !otpSent}>
              {loading ? <><ButtonLoader label="Checking OTP" /> Checking...</> : "Login with Mobile Number (OTP)"}
            </button>
          </form>
        )}

        <div className="simpleDivider"><span>OR</span></div>

        <button type="button" className="phoneSwitchButton" onClick={() => { setShowOtpBox((value) => !value); setError(""); setMessage(""); }}>
          {showOtpBox ? "Login with Email" : "Login with Mobile Number (OTP)"}
        </button>

        <p className="simpleSignupText">
          Don&apos;t have an account? <Link to="/register">Create New Account</Link>
        </p>
      </section>
    </main>
  );
}

export default Login;

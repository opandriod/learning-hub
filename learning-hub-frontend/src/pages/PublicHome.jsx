import { Link, useNavigate } from "react-router-dom";
import proofHome from "../assets/proof-home.png";
import proofLogin from "../assets/proof-login.png";

const features = [
  "Semester-wise courses",
  "Practice quizzes",
  "Mock tests",
  "Study materials",
  "Old questions",
  "Project store",
];

const steps = [
  "Create an account and choose your semester.",
  "Open subjects, units, topics, and PDFs in order.",
  "Practice with quizzes and mock tests.",
  "Track progress and continue where you stopped.",
];

function PublicHome() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  const semesterId = localStorage.getItem("semester_id");

  const goToPortal = () => {
    if (!token) {
      navigate("/register");
      return;
    }
    if (role === "admin") navigate("/admin");
    else if (role === "instructor") navigate("/instructor/requests");
    else if (role === "sub_admin") navigate("/sub-admin/projects");
    else if (!semesterId) navigate("/setup");
    else navigate("/dashboard");
  };

  return (
    <div className="publicShell publicLandingClean publicLandingShort">
      <header className="publicNav publicNavClean">
        <Link className="publicBrand" to="/">
          Only-Learning<span> Hub</span>
        </Link>
        <nav>
          <a href="#features">Features</a>
          <a href="#preview">Preview</a>
          <a href="#how">How it works</a>
          <Link to="/login">Login</Link>
          <Link className="publicNavCta" to="/register">Create Account</Link>
        </nav>
      </header>

      <main>
        <section className="publicSection publicHeroClean publicHeroShort" id="features">
          <div className="publicHeroTextClean">
            <p className="publicEyebrowClean">BCA learning platform</p>
            <h1>Everything for your BCA semester in one place.</h1>
            <p className="publicLeadClean">
              Only-Learning Hub helps BCA students study semester-wise subjects, take quizzes,
              prepare with mock tests, access old questions, and download project resources.
            </p>
            <div className="publicActions publicActionsClean">
              <button className="btn primary" type="button" onClick={goToPortal}>
                {token ? "Go to dashboard" : "Create account"}
              </button>
              <Link className="btn ghost" to="/login">
                Login
              </Link>
            </div>
          </div>

          <aside className="publicFactsCard publicFeatureBox">
            <h2>What you get</h2>
            <div className="publicFeaturePills">
              {features.map((feature) => (
                <span key={feature}>{feature}</span>
              ))}
            </div>
          </aside>
        </section>

        <section className="publicSection publicProofSection publicProofShort" id="preview">
          <div className="publicSectionIntro">
            <p className="publicSectionLabel">Real screens</p>
            <h2>Actual product preview</h2>
            <p>
              These preview images now use the current light UI from the live build, not the old dark mockup screenshots.
            </p>
          </div>

          <div className="publicScreenshotGrid">
            <figure className="publicScreenshotCard large">
              <img src={proofHome} alt="Current Only-Learning Hub public home page screenshot" />
              <figcaption>
                <strong>Current home page</strong>
                <span>The public page explains the platform before students sign in.</span>
              </figcaption>
            </figure>
            <figure className="publicScreenshotCard small">
              <img src={proofLogin} alt="Current Only-Learning Hub student dashboard screenshot" />
              <figcaption>
                <strong>Student dashboard</strong>
                <span>After login, students get courses, progress, quick actions, rewards, and study tools.</span>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="publicSection publicHowClean publicHowShort" id="how">
          <div className="publicSectionIntro">
            <p className="publicSectionLabel">How it works</p>
            <h2>Simple study flow</h2>
          </div>
          <ol className="publicStepsClean publicStepsCompact">
            {steps.map((step, index) => (
              <li className="publicStepClean" key={step}>
                <span>{index + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <footer className="publicCopyrightFooter">
          <p>© 2026 Only-Learning Hub. Built by <strong>Vanlalawmpuia Fanai</strong>, <strong>Vanlalremruatpuia</strong>, and <strong>Laldanmawia</strong>.</p>
        </footer>
      </main>
    </div>
  );
}

export default PublicHome;

import { useEffect, useMemo, useState } from "react";
import API from "../api/api";
import { useNavigate } from "react-router-dom";
import { getUserResults } from "../api/results";
import { DashboardSkeleton } from "../components/Skeleton";
import { getStudyStreak, markStudyActivity } from "../utils/achievements";

function Dashboard() {
  const [results, setResults] = useState([]);
  const [courses, setCourses] = useState([]);
  const [streakDays, setStreakDays] = useState(0);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const navigate = useNavigate();

  const studentName = localStorage.getItem("name") || "Student";
  const studentEmail = localStorage.getItem("email") || "";
  const semesterId = localStorage.getItem("semester_id");
  const userRole = localStorage.getItem("role") || "student";

  const studentProfile = useMemo(
    () => ({ name: studentName, email: studentEmail, role: userRole }),
    [studentName, studentEmail, userRole]
  );

  const getLabel = (percentage) => {
    if (percentage >= 80) return "Excellent";
    if (percentage >= 50) return "Good progress";
    if (percentage > 0) return "In progress";
    return "Start practice";
  };

  useEffect(() => {
    setStreakDays(markStudyActivity(studentProfile));
  }, [studentProfile]);

  useEffect(() => {
    let mounted = true;

    const fetchDashboardData = async () => {
      try {
        setLoadingDashboard(true);
        const [resultsData, dashboardRes] = await Promise.allSettled([
          getUserResults(),
          API.get("/dashboard/student"),
        ]);

        if (!mounted) return;

        if (resultsData.status === "fulfilled") {
          setResults(resultsData.value || []);
        } else {
          console.error(resultsData.reason);
          setResults([]);
        }

        if (dashboardRes.status === "fulfilled") {
          const incomingCourses = dashboardRes.value?.data || [];
          const filteredCourses = semesterId
            ? incomingCourses.filter((course) => {
                const courseSemester = course.semester_id ?? course.semesterId ?? course.course_semester_id;
                return courseSemester === undefined || courseSemester === null || String(courseSemester) === String(semesterId);
              })
            : incomingCourses;
          setCourses(filteredCourses);
        } else {
          console.error(dashboardRes.reason);
          setCourses([]);
        }
      } finally {
        if (mounted) setLoadingDashboard(false);
      }
    };

    fetchDashboardData();

    return () => {
      mounted = false;
    };
  }, [semesterId]);

  const totalCourses = courses.length;
  const totalTopics = courses.reduce(
    (sum, c) => sum + Number(c.total_topics ?? c.total_lessons ?? 0),
    0
  );
  const completedTopics = courses.reduce(
    (sum, c) => sum + Number(c.completed_topics ?? c.completed_lessons ?? 0),
    0
  );
  const attemptedTopics = courses.reduce(
    (sum, c) => sum + Number(c.attempted_topics ?? 0),
    0
  );

  const overallProgress =
    totalTopics > 0
      ? Math.round(
          (courses.reduce(
            (sum, c) =>
              sum +
              (Number(c.progress || 0) *
                Number(c.total_topics ?? c.total_lessons ?? 0)) /
                100,
            0
          ) /
            totalTopics) *
            100
        )
      : 0;

  const recentResults = results.slice(0, 3);
  const safeStreak = streakDays || getStudyStreak(studentProfile) || 0;

  const quickActions = [
    {
      title: "Practice Quiz",
      subtitle: "Normal or rapid questions",
      label: "PQ",
      to: "/quiz-setup",
    },
    {
      title: "Mock Test",
      subtitle: "Exam-style preparation",
      label: "MT",
      to: "/mock-test",
    },
    {
      title: "Old Questions",
      subtitle: "Previous exam papers",
      label: "OQ",
      to: "/previous-questions",
    },
    {
      title: "Project Store",
      subtitle: "Browse academic projects",
      label: "PS",
      to: "/projects",
    },
  ];

  if (loadingDashboard) {
    return (
      <div className="dashboard studentDashboardPro cleanStudentDashboard">
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <div className="dashboard studentDashboardPro cleanStudentDashboard">
      <section className="cleanWelcomeCard">
        <div className="cleanWelcomeText">
          <span className="studentKicker">Student dashboard</span>
          <h1>Welcome back, {studentName}</h1>
          <p>Start fast with one action. Practice, take a mock test, check old questions, or explore the project store.</p>
          <div className="cleanWelcomeButtons">
            <button type="button" onClick={() => navigate("/quiz-setup")}>Start Practice</button>
            <button type="button" className="secondaryButton" onClick={() => navigate("/achievements")}>View Rewards</button>
          </div>
        </div>

        <aside className="cleanStreakCard" aria-label="Daily streak">
          <span>Daily Streak</span>
          <strong>{safeStreak}</strong>
          <small>{safeStreak === 1 ? "active day" : "active days"}</small>
          <p>Open Learning Hub daily to keep your study habit alive.</p>
        </aside>
      </section>

      <section className="cleanQuickActionsPanel">
        <div className="studentSectionHeader compact">
          <div>
            <span className="studentKicker">Quick actions</span>
            <h2>Study shortcuts</h2>
          </div>
        </div>

        <div className="cleanQuickActionsGrid">
          {quickActions.map((action) => (
            <button key={action.title} type="button" className="cleanQuickActionCard" onClick={() => navigate(action.to)}>
              <span className="quickActionIcon">{action.label}</span>
              <span className="quickActionText">
                <strong>{action.title}</strong>
                <small>{action.subtitle}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="studentStatsGrid cleanStatsGrid" aria-label="Study progress summary">
        <article className="studentStatCard">
          <span>Courses</span>
          <strong>{totalCourses}</strong>
          <small>{semesterId ? `Semester ${semesterId}` : "Current semester"}</small>
        </article>
        <article className="studentStatCard">
          <span>Completed</span>
          <strong>{completedTopics}</strong>
          <small>topics finished</small>
        </article>
        <article className="studentStatCard">
          <span>Attempted</span>
          <strong>{attemptedTopics}</strong>
          <small>topics started</small>
        </article>
        <article className="studentStatCard emphasis">
          <span>Progress</span>
          <strong>{overallProgress}%</strong>
          <small>{totalTopics} total topics</small>
        </article>
      </section>

      <section className="studentPanel studentResultsPanel cleanResultsPanel">
        <div className="studentSectionHeader">
          <div>
            <span className="studentKicker">Recent performance</span>
            <h2>Your quiz results</h2>
          </div>
          <button type="button" className="secondaryButton" onClick={() => navigate("/quiz-setup")}>Take quiz</button>
        </div>

        {recentResults.length === 0 ? (
          <div className="studentEmptyState compact">
            <h3>No quiz results yet</h3>
            <p>Take a practice quiz to see your result here.</p>
          </div>
        ) : (
          <div className="studentResultsList">
            {recentResults.map((r, index) => (
              <button
                key={index}
                type="button"
                className="studentResultRow"
                onClick={() => {
                  if (r.lesson_id) navigate(`/lesson/${r.lesson_id}`);
                  else if (r.topic_id) navigate(`/mini-quiz/${r.topic_id}`);
                }}
              >
                <div>
                  <strong>{r.course_title || "Quiz Attempt"}</strong>
                  <span>{r.lesson_title || r.topic_title || "Topic Quiz"}</span>
                </div>
                <div className="studentResultScore">
                  <strong>{r.score}/{r.total}</strong>
                  <span>{getLabel(r.percentage || 0)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Dashboard;

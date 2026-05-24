import { useEffect, useState } from "react";
import API from "../api/api";
import AchievementPanel from "../components/AchievementPanel";
import { PageLoader } from "../components/Skeleton";

function getFallbackProfile() {
  return {
    id: localStorage.getItem("user_id") || localStorage.getItem("auth_id") || localStorage.getItem("email"),
    email: localStorage.getItem("email"),
    name: localStorage.getItem("name") || "Student",
    semester_id: localStorage.getItem("semester_id"),
    role: localStorage.getItem("role") || "student",
    profile_photo: "",
  };
}

function Achievements() {
  const [courses, setCourses] = useState([]);
  const [profile, setProfile] = useState(getFallbackProfile());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadRewardsData = async () => {
      try {
        const [profileResult, coursesResult] = await Promise.allSettled([
          API.get("/auth/me"),
          API.get("/dashboard/student"),
        ]);

        if (!mounted) return;

        let nextProfile = getFallbackProfile();
        if (profileResult.status === "fulfilled" && profileResult.value?.data) {
          nextProfile = { ...nextProfile, ...profileResult.value.data };
          localStorage.setItem("name", nextProfile.name || nextProfile.email || "Student");
          localStorage.setItem("email", nextProfile.email || "");
          localStorage.setItem("role", nextProfile.role || "student");
          if (nextProfile.id) localStorage.setItem("user_id", String(nextProfile.id));
          if (nextProfile.semester_id) localStorage.setItem("semester_id", String(nextProfile.semester_id));
        }
        setProfile(nextProfile);

        const semesterId = nextProfile.semester_id;
        const incoming = coursesResult.status === "fulfilled" ? coursesResult.value.data || [] : [];
        const filtered = semesterId
          ? incoming.filter((course) => {
              const courseSemester = course.semester_id ?? course.semesterId ?? course.course_semester_id;
              return courseSemester === undefined || courseSemester === null || String(courseSemester) === String(semesterId);
            })
          : incoming;
        setCourses(filtered);
      } catch (err) {
        if (mounted) {
          setCourses([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadRewardsData();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return <div className="dashboard appScreenPage"><PageLoader title="Loading rewards..." subtitle="Checking your unlocked rewards and profile photo." /></div>;
  }

  return (
    <div className="dashboard appScreenPage achievementsScreen">
      <div className="appPageHeaderCompact">
        <span className="studentKicker">Achievements</span>
        <h1>Study rewards</h1>
        <p>Unlock colors, streak rewards, and profile upgrades by studying consistently.</p>
      </div>
      <AchievementPanel profile={profile} dashboardCourses={courses} />
    </div>
  );
}

export default Achievements;

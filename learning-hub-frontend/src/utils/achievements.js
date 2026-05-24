const COLOR_REWARDS = [
  { id: "blue", label: "Blue Focus", value: "blue", description: "Default focus color for every student.", requirement: "Available to everyone", isUnlocked: () => true },
  { id: "green", label: "Green Progress", value: "green", description: "A calm progress color for students who begin building momentum.", requirement: "Complete at least 1 topic or lesson", isUnlocked: ({ completedTopics = 0, completedLessons = 0 }) => completedTopics >= 1 || completedLessons >= 1 },
  { id: "pink", label: "Pink Soft", value: "pink", description: "A soft branded color for consistent learners.", requirement: "Complete 10 topics or lessons", isUnlocked: ({ completedTopics = 0, completedLessons = 0 }) => Math.max(completedTopics, completedLessons) >= 10 },
  { id: "purple", label: "Purple Top 3", value: "purple", description: "Unlocked for leaderboard performers.", requirement: "Reach Top 3 in the weekly leaderboard", isUnlocked: ({ weeklyRank = 99 }) => Number(weeklyRank) > 0 && Number(weeklyRank) <= 3 },
  { id: "gold", label: "Gold Champion", value: "gold", description: "A premium achievement accent for monthly leaders.", requirement: "Reach Top 3 in the monthly leaderboard", isUnlocked: ({ monthlyRank = 99 }) => Number(monthlyRank) > 0 && Number(monthlyRank) <= 3 },
];

const ACHIEVEMENTS = [
  { id: "starter", title: "Started Learning", description: "Logged in and started your Learning Hub journey.", reward: "Blue accent available", isUnlocked: () => true },
  { id: "first-topic", title: "First Topic Started", description: "Attempt at least one topic or lesson.", reward: "Green accent unlock", isUnlocked: ({ attemptedTopics = 0, attemptedLessons = 0, completedTopics = 0, completedLessons = 0 }) => attemptedTopics >= 1 || attemptedLessons >= 1 || completedTopics >= 1 || completedLessons >= 1 },
  { id: "ten-topics", title: "10 Topic Momentum", description: "Complete 10 topics or lessons.", reward: "Pink accent unlock", isUnlocked: ({ completedTopics = 0, completedLessons = 0 }) => Math.max(completedTopics, completedLessons) >= 10 },
  { id: "weekly-top-three", title: "Weekly Top 3", description: "Reach the top 3 in the weekly leaderboard.", reward: "Purple accent unlock", isUnlocked: ({ weeklyRank = 99 }) => Number(weeklyRank) > 0 && Number(weeklyRank) <= 3 },
  { id: "monthly-top-three", title: "Monthly Top 3", description: "Reach the top 3 in the monthly leaderboard.", reward: "Gold accent unlock", isUnlocked: ({ monthlyRank = 99 }) => Number(monthlyRank) > 0 && Number(monthlyRank) <= 3 },
  { id: "streak-thirty", title: "30-Day Study Streak", description: "Study for 30 active days.", reward: "Profile photo upload unlock", isUnlocked: ({ streakDays = 0 }) => Number(streakDays) >= 30 },
];

function getScopedKey(name, userKey = "guest") { return `learningHub:${name}:${userKey || "guest"}`; }
function getTodayKey() { return new Date().toISOString().slice(0, 10); }
function getUserKey(profile = {}) { return profile.id || profile.user_id || profile.email || localStorage.getItem("email") || localStorage.getItem("name") || "guest"; }
function getUserRole(profile = {}) { return String(profile.role || localStorage.getItem("role") || "student").toLowerCase(); }
function isStaffRole(profile = {}) { return ["admin", "instructor", "sub_admin", "sub-admin"].includes(getUserRole(profile)); }
function readJson(key, fallback) { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } }
function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function calculateConsecutiveDays(days) {
  const sorted = Array.from(new Set(days)).sort().reverse();
  if (!sorted.length) return 0;
  let count = 0;
  let cursor = new Date();
  const today = getTodayKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);
  if (sorted[0] !== today && sorted[0] !== yesterdayKey) return 0;
  for (const day of sorted) {
    const expected = cursor.toISOString().slice(0, 10);
    if (day === expected) { count += 1; cursor.setDate(cursor.getDate() - 1); continue; }
    if (count === 0 && day === yesterdayKey) { count += 1; cursor = new Date(yesterday); cursor.setDate(cursor.getDate() - 1); continue; }
    break;
  }
  return count;
}

export function markStudyActivity(profile = {}) {
  if (isStaffRole(profile)) return 0;
  const userKey = getUserKey(profile);
  const key = getScopedKey("studyDays", userKey);
  const days = readJson(key, []);
  const today = getTodayKey();
  if (!days.includes(today)) { days.push(today); writeJson(key, days.slice(-120)); }
  return calculateConsecutiveDays(days);
}

export function getStudyStreak(profile = {}) { return isStaffRole(profile) ? 0 : calculateConsecutiveDays(readJson(getScopedKey("studyDays", getUserKey(profile)), [])); }
function isLegacyLogoPhoto(value = "") {
  const photo = String(value || "").trim();
  if (!photo) return false;
  return photo.includes("logo-website") || photo.includes("logo-app") || photo.includes("favicon") || photo.includes("app-icon") || photo === "/logo-website.png" || photo === "/logo-app.png" || photo === "/favicon.png";
}

export function getProfilePhoto(profile = {}) {
  const key = getScopedKey("profilePhoto", getUserKey(profile));
  const saved = localStorage.getItem(key) || "";
  if (isLegacyLogoPhoto(saved)) {
    localStorage.removeItem(key);
    return "";
  }
  return saved;
}
export function saveProfilePhoto(profile = {}, dataUrl = "") { localStorage.setItem(getScopedKey("profilePhoto", getUserKey(profile)), dataUrl); }
export function getSavedAccent(profile = {}) { return localStorage.getItem(getScopedKey("accent", getUserKey(profile))) || localStorage.getItem("accentColor") || "blue"; }
export function saveAccent(profile = {}, color = "blue") { localStorage.setItem(getScopedKey("accent", getUserKey(profile)), color); localStorage.setItem("accentColor", color); }

export function buildAchievementContext({ profile = {}, dashboardCourses = [], leaderboard = {} } = {}) {
  const completedFromCourses = dashboardCourses.reduce((sum, course) => sum + Number(course.completed_topics ?? course.completed_lessons ?? 0), 0);
  const attemptedFromCourses = dashboardCourses.reduce((sum, course) => sum + Number(course.attempted_topics ?? course.attempted_lessons ?? 0), 0);
  const completedLessons = Number(profile.completed_lessons || 0);
  return {
    role: getUserRole(profile),
    isStaff: isStaffRole(profile),
    coursesCount: Number(profile.courses_count || dashboardCourses.length || 0),
    completedTopics: Math.max(completedFromCourses, completedLessons),
    completedLessons,
    attemptedTopics: attemptedFromCourses,
    mockScore: Number(profile.mock_test_total_score || 0),
    streakDays: Number(profile.study_streak || getStudyStreak(profile) || 0),
    weeklyRank: Number(profile.weekly_rank || leaderboard.weeklyRank || 99),
    monthlyRank: Number(profile.monthly_rank || leaderboard.monthlyRank || 99),
  };
}

export function getAchievementState(context = {}) {
  const staffUnlocked = Boolean(context.isStaff || ["admin", "instructor", "sub_admin", "sub-admin"].includes(String(context.role || "").toLowerCase()));
  return {
    achievements: ACHIEVEMENTS.map((item) => ({ ...item, unlocked: staffUnlocked || Boolean(item.isUnlocked(context)) })),
    colors: COLOR_REWARDS.map((item) => ({ ...item, unlocked: staffUnlocked || Boolean(item.isUnlocked(context)) })),
  };
}

export { ACHIEVEMENTS, COLOR_REWARDS, getUserRole, isStaffRole };

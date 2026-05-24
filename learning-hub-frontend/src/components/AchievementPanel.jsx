import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { buildAchievementContext, getAchievementState, getProfilePhoto, getSavedAccent, isStaffRole, markStudyActivity, saveAccent } from "../utils/achievements";

function applyAccent(color) {
  const safeColor = color || "blue";
  document.body.dataset.accent = safeColor;
  localStorage.setItem("accentColor", safeColor);
}

function AchievementPanel({ profile = {}, dashboardCourses = [], compact = false }) {
  const [streakDays, setStreakDays] = useState(0);
  const [photo, setPhoto] = useState(profile.profile_photo || "");
  const [accent, setAccent] = useState(() => getSavedAccent(profile));
  const isStaff = useMemo(() => isStaffRole(profile), [profile]);

  useEffect(() => {
    const nextStreak = isStaff ? 0 : markStudyActivity(profile);
    setStreakDays(nextStreak);

    const syncedPhoto = profile.profile_photo || getProfilePhoto(profile);
    setPhoto(syncedPhoto);

    const saved = getSavedAccent(profile);
    setAccent(saved);
    applyAccent(saved);
  }, [profile?.id, profile?.email, profile?.role, profile?.profile_photo, isStaff]);

  const context = useMemo(
    () => buildAchievementContext({ profile: { ...profile, study_streak: isStaff ? 0 : streakDays }, dashboardCourses }),
    [profile, dashboardCourses, streakDays, isStaff]
  );
  const { achievements, colors } = useMemo(() => getAchievementState(context), [context]);
  const unlockedCount = achievements.filter((item) => item.unlocked).length;
  const photoUnlocked = isStaff || achievements.find((item) => item.id === "streak-thirty")?.unlocked;

  const handleAccentSelect = (color) => {
    const reward = colors.find((item) => item.value === color);
    if (!reward?.unlocked) return;
    setAccent(color);
    saveAccent(profile, color);
    applyAccent(color);
  };



  return (
    <section className={`achievementPanel ${compact ? "achievementPanelCompact" : ""}`}>
      <div className="achievementHeader">
        <div>
          <span className="studentKicker">Achievements</span>
          <h2>Study rewards</h2>
          <p className="muted">{isStaff ? "Admin, instructor, and sub-admin accounts have all rewards unlocked by default." : "Unlock theme colors and profile rewards by studying consistently."}</p>
        </div>
        {!isStaff ? <div className="streakBadge" title="Updates once per active study day."><strong>{streakDays}</strong><span>day streak</span></div> : null}
      </div>
      <div className="achievementSummaryGrid">
        <div className="achievementPhotoCard">
          <div className="achievementAvatar">{photo ? <img src={photo} alt="Profile" /> : <img src="/logo-website.png" alt="Learning Hub default profile" />}</div>
          <div>
            <strong>Profile photo reward</strong>
            <p className="muted smallText">{photoUnlocked ? (isStaff ? "Staff accounts can manage profile photos from the Profile page." : "30-day streak unlocked. Manage your profile photo from the Profile page.") : "Locked until you reach a 30-day study streak. The Learning Hub logo is shown until then."}</p>
            <Link className="uploadMiniButton" to="/profile">Open Profile</Link>
          </div>
        </div>
        <div className="achievementProgressCard">
          <strong>{unlockedCount}/{achievements.length} rewards unlocked</strong>
          <div className="miniProgress"><span style={{ width: `${Math.round((unlockedCount / achievements.length) * 100)}%` }} /></div>
          <p className="muted smallText">{isStaff ? "Staff accounts receive all reward options by default. Daily streak is only counted for students." : "Keep completing topics and daily quizzes to unlock more."}</p>
        </div>
      </div>
      <div className="accentUnlockGrid">
        {colors.map((color) => (
          <button key={color.id} type="button" className={`accentReward ${accent === color.value ? "active" : ""} ${color.unlocked ? "" : "locked"}`} onClick={() => handleAccentSelect(color.value)} title={color.requirement}>
            <span className={`accentDot accent-${color.value}`} /><strong>{color.label}</strong><small>{color.unlocked ? "Unlocked" : color.requirement}</small>
          </button>
        ))}
      </div>
      <div className="achievementList proAchievementList">
        {achievements.map((item) => (
          <div key={item.id} className={`achievementItemPro ${item.unlocked ? "unlocked" : "locked"}`}>
            <span>{item.unlocked ? "✓" : "🔒"}</span>
            <div><strong>{item.title}</strong><p>{item.description}</p><small>{item.reward}</small></div>
          </div>
        ))}
      </div>
    </section>
  );
}

export { applyAccent };
export default AchievementPanel;

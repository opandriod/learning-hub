import { useEffect, useMemo, useState } from "react";
import { applyAccent } from "./AchievementPanel";
import { buildAchievementContext, getAchievementState, getSavedAccent, saveAccent } from "../utils/achievements";

const themes = [
  { value: "light", label: "Default" },
  { value: "dark", label: "Dark" },
  { value: "normal", label: "Soft" },
];

function applyTheme(theme) {
  const selectedTheme = ["normal", "light", "dark"].includes(theme) ? theme : "light";
  document.body.classList.remove("theme-normal", "theme-light", "theme-dark");
  document.body.classList.add(`theme-${selectedTheme}`);
  localStorage.setItem("theme", selectedTheme);
}

function ThemeToggle({ profile = null, showAccent = true }) {
  const [theme, setTheme] = useState(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "normal") return "light";
    return ["light", "dark"].includes(storedTheme) ? storedTheme : "light";
  });
  const [accent, setAccent] = useState(() => getSavedAccent(profile || {}));

  const accentRewards = useMemo(() => {
    const context = buildAchievementContext({ profile: profile || {} });
    return getAchievementState(context).colors;
  }, [profile]);

  useEffect(() => { applyTheme(theme); }, [theme]);
  useEffect(() => { applyAccent(accent); }, [accent]);

  const handleAccentChange = (value) => {
    const reward = accentRewards.find((item) => item.value === value);
    if (reward && !reward.unlocked) return;
    setAccent(value);
    saveAccent(profile || {}, value);
  };

  return (
    <div className="themeSwitcher" aria-label="Theme switcher">
      <label>
        <span>Theme</span>
        <select value={theme} onChange={(e) => setTheme(e.target.value)}>
          {themes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      {showAccent ? (
        <label>
          <span>Accent</span>
          <select value={accent} onChange={(e) => handleAccentChange(e.target.value)}>
            {accentRewards.map((item) => (
              <option key={item.value} value={item.value} disabled={!item.unlocked}>
                {item.label}{item.unlocked ? "" : " 🔒"}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </div>
  );
}

export { applyTheme };
export default ThemeToggle;

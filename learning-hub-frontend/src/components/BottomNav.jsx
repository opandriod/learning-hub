import { NavLink } from "react-router-dom";

function BottomIcon({ type }) {
  if (type === "home") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z" /></svg>;
  if (type === "courses") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h10a4 4 0 0 1 4 4v12H8a3 3 0 0 0-3-3z" /><path d="M5 4v13" /></svg>;
  if (type === "quiz") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v16H7z" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>;
  if (type === "rewards") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4 9.5 9 4 9.8l4 3.9-.9 5.5L12 16.6l4.9 2.6-.9-5.5 4-3.9-5.5-.8z" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
}

const items = [
  { to: "/dashboard", label: "Home", icon: "home" },
  { to: "/courses", label: "Courses", icon: "courses" },
  { to: "/quiz-setup", label: "Quiz", icon: "quiz" },
  { to: "/achievements", label: "Rewards", icon: "rewards" },
  { to: "/profile", label: "Profile", icon: "profile" },
];

function BottomNav() {
  return (
    <nav className="bottomAppNav" aria-label="Mobile app navigation">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} className={({ isActive }) => `bottomAppNavItem ${isActive ? "active" : ""}`}>
          <BottomIcon type={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default BottomNav;

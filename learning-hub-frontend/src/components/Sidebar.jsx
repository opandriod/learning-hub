import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { supabase, isSupabaseAuthReady } from "../api/supabaseClient";

const SEARCH_PAGES = [
  {
    label: "Dashboard",
    path: "/dashboard",
    roles: ["student"],
    keywords: "home overview stats student progress courses quiz mock test completed topics continue learning recent activity daily quiz practice quiz mini quiz subjects units performance profile semester total courses total topics rank leaderboard notes materials previous questions projects",
  },
  {
    label: "Courses",
    path: "/courses",
    roles: ["student"],
    keywords: "subjects semester units lessons topics bca course list programming computer mathematics english mobile computing dbms web technology open course view unit chapter topic learning material syllabus",
  },
  {
    label: "Syllabus",
    path: "/syllabus",
    roles: ["student"],
    keywords: "curriculum subject units topics syllabus semester course outline unit 1 unit 2 unit 3 unit 4 unit 5 bca paper module chapter",
  },
  {
    label: "Practice Quiz",
    path: "/quiz-setup",
    roles: ["student"],
    keywords: "quiz rapid normal practice questions mcq test subject unit all subjects all units daily quiz score correct incorrect attempted not attempted timer time limit start quiz mode setup points",
  },
  {
    label: "Mock Test",
    path: "/mock-test",
    roles: ["student"],
    keywords: "mock exam subject test final practice questions result score semester course start mock test previous result correct answers submit",
  },
  {
    label: "Apply Sub-admin",
    path: "/apply-sub-admin",
    roles: ["student"],
    keywords: "application apply sub admin uploader request become sub admin project upload permission minor major zip requirements status approve reject",
  },
  {
    label: "My Project Uploads",
    path: "/sub-admin/projects",
    roles: ["sub_admin", "admin"],
    keywords: "upload zip project minor major my uploads marketplace sub admin title description price file readme source code pending approved rejected study project store",
  },
  {
    label: "Admin Dashboard",
    path: "/admin",
    roles: ["admin"],
    keywords: "admin panel dashboard manage users courses analytics students instructors sub admins block unblock active inactive review platform activity stats semester course users requests materials old questions projects payments",
  },
  {
    label: "Upload Study Materials",
    path: "/admin/study-materials",
    roles: ["admin"],
    keywords: "notes pdf materials upload study resources subject semester course unit title file download academic resources add material delete material",
  },
  {
    label: "Upload Old Questions",
    path: "/admin/old-questions",
    roles: ["admin"],
    keywords: "previous question old question paper upload pdf semester subject year exam paper download academic resources",
  },
  {
    label: "Upload Project ZIP",
    path: "/admin/project-upload",
    roles: ["admin"],
    keywords: "project zip upload minor major marketplace admin source code readme price title description file validation approved pending store",
  },
  {
    label: "Project Review",
    path: "/admin/project-review",
    roles: ["admin"],
    keywords: "approve reject review projects submissions zip pending approved rejected uploader sub admin marketplace quality check source files readme payment downloads",
  },
  {
    label: "Payment Verification",
    path: "/admin/payments",
    roles: ["admin"],
    keywords: "payment transaction proof upi verify purchase screenshot reference id approve reject buyer project store marketplace receipt",
  },
  {
    label: "Admin Requests",
    path: "/instructor/requests",
    roles: ["instructor"],
    keywords: "admin requests approve reject applications instructor users role request status pending review",
  },
  {
    label: "Sub-admin Requests",
    path: "/instructor/sub-admin-requests",
    roles: ["instructor"],
    keywords: "sub admin requests applications approve reject instructor student uploader application performance quiz mock leaderboard status pending",
  },
  {
    label: "Project Review",
    path: "/instructor/project-review",
    roles: ["instructor"],
    keywords: "approve reject review projects submissions zip pending approved rejected uploader sub admin marketplace quality check source files readme payment downloads",
  },
  {
    label: "Payment Verification",
    path: "/instructor/payments",
    roles: ["instructor"],
    keywords: "payment transaction proof upi verify purchase screenshot reference id approve reject buyer project store marketplace receipt",
  },
  {
    label: "Project Store",
    path: "/projects",
    roles: ["student", "sub_admin", "admin", "instructor"],
    keywords: "marketplace store buy download projects minor major price payment upi qr transaction proof approved project title description uploader source code zip readme search filter",
  },
  {
    label: "Study Materials",
    path: "/study-materials",
    roles: ["student", "sub_admin", "admin", "instructor"],
    keywords: "notes pdf materials resources download study subject semester course unit title academic materials files search filter",
  },
  {
    label: "Previous Questions",
    path: "/previous-questions",
    roles: ["student", "sub_admin", "admin", "instructor"],
    keywords: "old questions previous question papers pdf download exam year semester subject course paper search filter",
  },
  {
    label: "Profile",
    path: "/profile",
    roles: ["student", "sub_admin", "admin", "instructor"],
    keywords: "account settings theme edit details phone email password profile name semester role logout dark light default appearance update save personal information",
  },
  {
    label: "Leaderboard",
    path: "/leaderboard",
    roles: ["student", "sub_admin", "admin", "instructor"],
    keywords: "rank score daily quiz points top students leaderboard today this week this month past month correct wrong attempted performance table position winner",
  },
];

function IconBase({ children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const IconDashboard = () => <IconBase><path d="M3 12.5 12 4l9 8.5" /><path d="M5.5 10.5V20h13V10.5" /></IconBase>;
const IconCourses = () => <IconBase><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4H20v14H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 6.5v14" /><path d="M8 8h8" /></IconBase>;
const IconSyllabus = () => <IconBase><path d="M7 4h8l4 4v12H7z" /><path d="M15 4v4h4" /><path d="M10 12h6" /><path d="M10 16h6" /></IconBase>;
const IconQuiz = () => <IconBase><circle cx="12" cy="12" r="8" /><path d="M12 8v5" /><path d="M12 16h.01" /></IconBase>;
const IconMock = () => <IconBase><rect x="4" y="5" width="16" height="14" rx="3" /><path d="M8 10h8" /><path d="M8 14h4" /></IconBase>;
const IconMaterials = () => <IconBase><path d="M5 7h14" /><path d="M7 4h10v16H7z" /><path d="M10 11h4" /><path d="M10 15h4" /></IconBase>;
const IconQuestions = () => <IconBase><path d="M12 19a7 7 0 1 0-7-7" /><path d="M9.5 9.5a2.5 2.5 0 1 1 4.1 1.95c-.96.8-1.6 1.37-1.6 2.55" /><path d="M12 17h.01" /></IconBase>;
const IconApply = () => <IconBase><path d="M12 5v14" /><path d="M5 12h14" /></IconBase>;
const IconStore = () => <IconBase><path d="M4 8.5h16" /><path d="M6 8.5 7.5 5h9L18 8.5" /><path d="M5 8.5V19h14V8.5" /></IconBase>;
const IconProfile = () => <IconBase><circle cx="12" cy="8" r="3.2" /><path d="M5.5 19a6.5 6.5 0 0 1 13 0" /></IconBase>;
const IconLeaderboard = () => <IconBase><path d="M6 19V9" /><path d="M12 19V5" /><path d="M18 19v-7" /></IconBase>;
const IconRewards = () => <IconBase><path d="M12 3.5 14.4 8.2l5.2.8-3.8 3.7.9 5.2L12 15.4 7.3 17.9l.9-5.2L4.4 9l5.2-.8L12 3.5Z" /></IconBase>;
const IconUploads = () => <IconBase><path d="M12 16V6" /><path d="m8.5 9.5 3.5-3.5 3.5 3.5" /><path d="M5 18.5h14" /></IconBase>;
const IconAdmin = () => <IconBase><path d="M12 3.5 19 7v5c0 4.3-2.7 7.7-7 8.9C7.7 19.7 5 16.3 5 12V7z" /><path d="M9.5 12h5" /><path d="M12 9.5v5" /></IconBase>;
const IconProject = () => <IconBase><path d="M4 7h16v10H4z" /><path d="M9 7V4h6v3" /><path d="M10 12h4" /></IconBase>;
const IconPayment = () => <IconBase><rect x="3" y="6" width="18" height="12" rx="3" /><path d="M3 10h18" /><path d="M7 14h3" /></IconBase>;
const IconRequests = () => <IconBase><path d="M8 6h10" /><path d="M8 12h10" /><path d="M8 18h10" /><circle cx="5" cy="6" r="1" /><circle cx="5" cy="12" r="1" /><circle cx="5" cy="18" r="1" /></IconBase>;
const IconSearch = () => <IconBase><circle cx="11" cy="11" r="6" /><path d="m20 20-3.5-3.5" /></IconBase>;
const IconLogout = () => <IconBase><path d="M14 8V5.5A1.5 1.5 0 0 0 12.5 4h-6A1.5 1.5 0 0 0 5 5.5v13A1.5 1.5 0 0 0 6.5 20h6a1.5 1.5 0 0 0 1.5-1.5V16" /><path d="M10 12h10" /><path d="m17 8 3.5 4-3.5 4" /></IconBase>;
const IconContact = () => <IconBase><path d="M4 6h16v12H4z" /><path d="m4 7 8 6 8-6" /></IconBase>;
const IconFeedback = () => <IconBase><path d="M5 5h14v10H8l-3 3z" /><path d="M9 9h6" /><path d="M9 12h4" /></IconBase>;
const IconBrand = () => <IconBase><path d="M12 4 5 7.5 12 11l7-3.5L12 4Z" /><path d="M7 10.5V15c0 1.8 2.2 3.2 5 3.2s5-1.4 5-3.2v-4.5" /></IconBase>;

const ICON_MAP = {
  dashboard: IconDashboard,
  courses: IconCourses,
  syllabus: IconSyllabus,
  quiz: IconQuiz,
  mock: IconMock,
  materials: IconMaterials,
  questions: IconQuestions,
  apply: IconApply,
  store: IconStore,
  profile: IconProfile,
  leaderboard: IconLeaderboard,
  rewards: IconRewards,
  uploads: IconUploads,
  admin: IconAdmin,
  project: IconProject,
  payment: IconPayment,
  requests: IconRequests,
  search: IconSearch,
  logout: IconLogout,
  contact: IconContact,
  feedback: IconFeedback,
  brand: IconBrand,
};

function SidebarIcon({ name }) {
  const IconComponent = ICON_MAP[name] || IconDashboard;
  return (
    <span className="sidebarNavIcon" aria-hidden="true">
      <IconComponent />
    </span>
  );
}

function getMainPageRoot() {
  if (typeof document === "undefined") return null;
  return document.querySelector(".mainContent");
}

function getMainPageText() {
  const root = getMainPageRoot();
  return (root?.innerText || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function getVisibleSearchElements() {
  const root = getMainPageRoot();
  if (!root) return [];

  const selector = [
    "h1", "h2", "h3", "h4", "p", "span", "small", "strong", "label",
    "button", "a", "td", "th", "li", "option", "input", "textarea", "select",
    ".courseCard", ".resultCard", ".card", ".statCard"
  ].join(",");

  return Array.from(root.querySelectorAll(selector)).filter((element) => {
    if (!element || element.closest(".sidebar")) return false;
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

function getElementSearchText(element) {
  const value = element.value || element.getAttribute("aria-label") || element.getAttribute("placeholder") || "";
  return `${element.innerText || ""} ${value}`.replace(/\s+/g, " ").trim().toLowerCase();
}

function clearPageSearchFocus() {
  if (typeof document === "undefined") return;
  document.querySelectorAll(".pageSearchHit").forEach((element) => {
    element.classList.remove("pageSearchHit");
  });
}

function findMatchesOnCurrentPage(query) {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery || typeof window === "undefined") return [];

  const words = cleanQuery.split(/\s+/).filter(Boolean);
  const matches = [];

  getVisibleSearchElements().forEach((element) => {
    const text = getElementSearchText(element);
    if (!text) return;

    const exactMatch = text.includes(cleanQuery);
    const wordMatch = words.length > 1 && words.every((word) => text.includes(word));

    if (exactMatch || wordMatch) {
      const shortText = (element.innerText || element.value || element.getAttribute("placeholder") || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 90);

      matches.push({ element, text: shortText || "Matching page content" });
    }
  });

  return matches;
}

function focusCurrentPageMatch(match) {
  if (!match?.element) return;
  clearPageSearchFocus();
  match.element.classList.add("pageSearchHit");
  match.element.scrollIntoView({ behavior: "smooth", block: "center" });
}

function SidebarSearch({ role }) {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [currentPageText, setCurrentPageText] = useState("");
  const [pageMatches, setPageMatches] = useState([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);
  const [message, setMessage] = useState("");
  const [showResults, setShowResults] = useState(false);

  const allowedPages = useMemo(
    () => SEARCH_PAGES.filter((page) => page.roles.includes(role)),
    [role]
  );

  const refreshPageSearch = (value = query, shouldFocusFirst = false) => {
    const cleanQuery = value.trim();
    setCurrentPageText(getMainPageText());

    if (!cleanQuery) {
      setPageMatches([]);
      setActiveMatchIndex(0);
      setMessage("");
      clearPageSearchFocus();
      return [];
    }

    const matches = findMatchesOnCurrentPage(cleanQuery);
    setPageMatches(matches);
    setActiveMatchIndex(0);

    if (matches.length > 0) {
      setMessage(`${matches.length} match${matches.length === 1 ? "" : "es"} found inside this page`);
      if (shouldFocusFirst) focusCurrentPageMatch(matches[0]);
    } else {
      setMessage("No visible match on this page. Try a related page below.");
      clearPageSearchFocus();
    }

    return matches;
  };

  useEffect(() => {
    const refreshText = () => {
      setCurrentPageText(getMainPageText());
      if (query.trim()) refreshPageSearch(query, false);
    };

    refreshText();
    const timer = setTimeout(refreshText, 650);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    const savedQuery = sessionStorage.getItem("sidebar_search_query");
    if (savedQuery) {
      setQuery(savedQuery);
      setShowResults(true);
      const timer = setTimeout(() => refreshPageSearch(savedQuery, true), 750);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const pageResults = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return [];
    const words = cleanQuery.split(/\s+/).filter(Boolean);

    return allowedPages
      .map((page) => {
        const label = page.label.toLowerCase();
        const path = page.path.toLowerCase();
        const keywords = page.keywords.toLowerCase();
        const isCurrentPage = page.path === location.pathname;
        const pageText = isCurrentPage ? currentPageText : "";
        const haystack = `${label} ${path} ${keywords} ${pageText}`;
        let score = 0;

        if (label === cleanQuery) score += 160;
        if (label.startsWith(cleanQuery)) score += 95;
        if (label.includes(cleanQuery)) score += 55;
        if (path.includes(cleanQuery)) score += 35;
        if (keywords.includes(cleanQuery)) score += 32;
        if (pageText.includes(cleanQuery)) score += 140;

        words.forEach((word) => {
          if (label.includes(word)) score += 22;
          if (path.includes(word)) score += 12;
          if (keywords.includes(word)) score += 12;
          if (pageText.includes(word)) score += 42;
          if (haystack.includes(word)) score += 3;
        });

        return {
          ...page,
          score,
          matchType: pageText.includes(cleanQuery)
            ? "Visible in this page"
            : keywords.includes(cleanQuery) || words.some((word) => keywords.includes(word))
              ? "Related page"
              : "Page name",
        };
      })
      .filter((page) => page.score > 0)
      .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
      .slice(0, 6);
  }, [allowedPages, currentPageText, location.pathname, query]);

  const clearSearch = () => {
    setQuery("");
    setPageMatches([]);
    setActiveMatchIndex(0);
    setMessage("");
    setShowResults(false);
    clearPageSearchFocus();
    sessionStorage.removeItem("sidebar_search_query");
    setTimeout(() => inputRef.current?.focus(), 20);
  };

  const runSearch = () => {
    const cleanQuery = query.trim();
    setShowResults(Boolean(cleanQuery));

    if (!cleanQuery) {
      clearSearch();
      return;
    }

    sessionStorage.setItem("sidebar_search_query", cleanQuery);
    const matches = refreshPageSearch(cleanQuery, true);

    if (matches.length === 0 && pageResults.length > 0) {
      setMessage("No visible match on this screen. Open a related page below.");
    }
  };

  const goToNextMatch = () => {
    if (pageMatches.length === 0) return;
    const nextIndex = (activeMatchIndex + 1) % pageMatches.length;
    setActiveMatchIndex(nextIndex);
    focusCurrentPageMatch(pageMatches[nextIndex]);
  };

  const goToPage = (path) => {
    const cleanQuery = query.trim();
    if (cleanQuery) sessionStorage.setItem("sidebar_search_query", cleanQuery);
    clearPageSearchFocus();
    navigate(path);
    setShowResults(true);
    setTimeout(() => refreshPageSearch(cleanQuery, true), 800);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      runSearch();
    }

    if (event.key === "Escape") {
      clearSearch();
    }
  };

  const handleChange = (event) => {
    const value = event.target.value;
    setQuery(value);
    setShowResults(Boolean(value.trim()));
    refreshPageSearch(value, false);
    if (value.trim()) sessionStorage.setItem("sidebar_search_query", value.trim());
    else sessionStorage.removeItem("sidebar_search_query");
  };

  const hasResults = pageMatches.length > 0 || pageResults.length > 0;

  return (
    <div className="sidebarSearch inlineSidebarSearch">
      <div className="sidebarSearchBar" title="Search everything on this page">
        <button
          type="button"
          className={`sidebarSearchClear ${query.trim() ? "visible" : ""}`}
          onClick={query.trim() ? clearSearch : () => inputRef.current?.focus()}
          aria-label={query.trim() ? "Clear search" : "Focus search"}
          title={query.trim() ? "Clear search" : "Search"}
        >
          {query.trim() ? "×" : <SidebarIcon name="search" />}
        </button>

        <input
          ref={inputRef}
          className="sidebarSearchInput"
          value={query}
          onChange={handleChange}
          onFocus={() => query.trim() && setShowResults(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search page..."
          aria-label="Search everything inside this page"
        />

        <button type="button" className="sidebarSearchSubmit" onClick={runSearch}>
          Search
        </button>
      </div>

      {showResults && query.trim() && (
        <div className="sidebarSearchResults" aria-live="polite">
          {message && <div className="sidebarSearchMessage">{message}</div>}

          {pageMatches.length > 1 && (
            <button type="button" className="sidebarSearchNext" onClick={goToNextMatch}>
              Next {activeMatchIndex + 1}/{pageMatches.length}
            </button>
          )}

          {pageMatches.length > 0 && <div className="sidebarSearchLabel">Inside this page</div>}
          {pageMatches.slice(0, 4).map((match, index) => (
            <button
              type="button"
              key={`${match.text}-${index}`}
              className="sidebarSearchResult"
              onClick={() => {
                setActiveMatchIndex(index);
                focusCurrentPageMatch(match);
              }}
            >
              <span>Current page match</span>
              <small>{match.text}</small>
            </button>
          ))}

          {pageResults.length > 0 && <div className="sidebarSearchLabel">Related pages</div>}
          {pageResults.map((page) => (
            <button
              type="button"
              key={`${page.path}-${page.label}`}
              className="sidebarSearchResult"
              onClick={() => goToPage(page.path)}
            >
              <span>{page.label}</span>
              <small>{page.matchType} · {page.path}</small>
            </button>
          ))}

          {!hasResults && <div className="sidebarSearchEmpty">No matching text found</div>}
        </div>
      )}
    </div>
  );
}

function SidebarNavLink({ item, onNavigate }) {
  return (
    <NavLink
      to={item.path}
      end={item.exact !== false}
      className={({ isActive }) => `sidebarNavItem${isActive ? " active" : ""}`}
      title={item.label}
      aria-label={item.label}
      onClick={onNavigate}
    >
      <SidebarIcon name={item.icon} />
      <span className="sidebarNavText">{item.label}</span>
    </NavLink>
  );
}

function Sidebar() {
  const role = localStorage.getItem("role") || "student";
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const isAdmin = role === "admin";
  const isInstructor = role === "instructor";
  const isSubAdmin = role === "sub_admin";

  const clearLocalAuth = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("semester_id");
    localStorage.removeItem("name");
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("sb-") || key.includes("supabase.auth.token")) {
        localStorage.removeItem(key);
      }
    });
    sessionStorage.setItem("manual_logout", "1");
  };

  const handleLogout = async () => {
    clearLocalAuth();
    if (isSupabaseAuthReady && supabase) {
      try { await supabase.auth.signOut({ scope: "global" }); } catch (err) { console.warn("Supabase logout failed", err); }
    }
    window.location.replace("/");
  };

  const navItems = isAdmin
    ? [
        { label: "Admin Dashboard", path: "/admin", icon: "admin" },
        { label: "Upload Study Materials", path: "/admin/study-materials", icon: "materials" },
        { label: "Upload Old Questions", path: "/admin/old-questions", icon: "questions" },
        { label: "Upload Project ZIP", path: "/admin/project-upload", icon: "uploads" },
        { label: "Project Review", path: "/admin/project-review", icon: "project" },
        { label: "Payment Verification", path: "/admin/payments", icon: "payment" },
        { label: "Project Store", path: "/projects", icon: "store" },
        { label: "Study Materials", path: "/study-materials", icon: "materials" },
        { label: "Previous Questions", path: "/previous-questions", icon: "questions" },
        { label: "Contact", path: "/contact", icon: "contact" },
        { label: "Feedback", path: "/feedback", icon: "feedback" },
        { label: "Rewards", path: "/achievements", icon: "rewards" },
        { label: "Profile", path: "/profile", icon: "profile" },
        { label: "Leaderboard", path: "/leaderboard", icon: "leaderboard" },
      ]
    : isInstructor
      ? [
          { label: "Admin Requests", path: "/instructor/requests", icon: "requests" },
          { label: "Sub-admin Requests", path: "/instructor/sub-admin-requests", icon: "apply" },
          { label: "Project Review", path: "/instructor/project-review", icon: "project" },
          { label: "Payment Verification", path: "/instructor/payments", icon: "payment" },
          { label: "Project Store", path: "/projects", icon: "store" },
          { label: "Study Materials", path: "/study-materials", icon: "materials" },
          { label: "Previous Questions", path: "/previous-questions", icon: "questions" },
        { label: "Contact", path: "/contact", icon: "contact" },
        { label: "Feedback", path: "/feedback", icon: "feedback" },
          { label: "Rewards", path: "/achievements", icon: "rewards" },
        { label: "Profile", path: "/profile", icon: "profile" },
          { label: "Leaderboard", path: "/leaderboard", icon: "leaderboard" },
        ]
      : isSubAdmin
        ? [
            { label: "My Project Uploads", path: "/sub-admin/projects", icon: "uploads" },
            { label: "Project Store", path: "/projects", icon: "store" },
            { label: "Study Materials", path: "/study-materials", icon: "materials" },
            { label: "Previous Questions", path: "/previous-questions", icon: "questions" },
        { label: "Contact", path: "/contact", icon: "contact" },
        { label: "Feedback", path: "/feedback", icon: "feedback" },
            { label: "Rewards", path: "/achievements", icon: "rewards" },
        { label: "Profile", path: "/profile", icon: "profile" },
            { label: "Leaderboard", path: "/leaderboard", icon: "leaderboard" },
          ]
        : [
            { label: "Dashboard", path: "/dashboard", icon: "dashboard" },
            { label: "Courses", path: "/courses", icon: "courses" },
            { label: "Syllabus", path: "/syllabus", icon: "syllabus" },
            { label: "Practice Quiz", path: "/quiz-setup", icon: "quiz" },
            { label: "Mock Test", path: "/mock-test", icon: "mock" },
            { label: "Study Materials", path: "/study-materials", icon: "materials" },
            { label: "Previous Questions", path: "/previous-questions", icon: "questions" },
        { label: "Contact", path: "/contact", icon: "contact" },
        { label: "Feedback", path: "/feedback", icon: "feedback" },
            { label: "Apply Sub-admin", path: "/apply-sub-admin", icon: "apply" },
            { label: "Project Store", path: "/projects", icon: "store" },
            { label: "Rewards", path: "/achievements", icon: "rewards" },
        { label: "Profile", path: "/profile", icon: "profile" },
            { label: "Leaderboard", path: "/leaderboard", icon: "leaderboard" },
          ];

  const roleLabel = isAdmin ? "Admin" : isInstructor ? "Instructor" : isSubAdmin ? "Sub-admin" : "Student";

  return (
    <aside className={`sidebar p-4 ${mobileOpen ? "mobileOpen" : ""}`}>
      <div className="sidebarInner">
        <div className="sidebarTop">
          <div className="sidebarBrand" title="Learning Hub">
            <span className="sidebarBrandMark" aria-hidden="true">
              <img src="/logo-app.png" alt="" />
            </span>
            <div className="sidebarBrandTextWrap">
              <span className="sidebarBrandTitle">Learning Hub</span>
              <span className="sidebarBrandSubtitle">{roleLabel} panel</span>
            </div>
            <button
              type="button"
              className="sidebarMobileToggle"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              <span></span>
              <span></span>
              <span></span>
            </button>
          </div>

          <SidebarSearch role={role} />
        </div>

        <nav className="sidebarNav">
          {navItems.map((item) => (
            <SidebarNavLink key={`${item.path}-${item.label}`} item={item} onNavigate={() => setMobileOpen(false)} />
          ))}
        </nav>

        <div className="sidebarFooter">
          <button onClick={handleLogout} className="sidebarNavItem sidebarLogoutButton" title="Logout" aria-label="Logout">
            <SidebarIcon name="logout" />
            <span className="sidebarNavText">Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;

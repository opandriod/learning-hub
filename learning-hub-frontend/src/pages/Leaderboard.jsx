import { useEffect, useMemo, useState } from "react";
import API from "../api/api";

const TIMEFRAMES = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

function ordinal(rank) {
  if (!rank) return "-";
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

function getTopName(item) {
  return typeof item === "string" ? item : item?.name || "Student";
}

function getTopPhoto(item) {
  return typeof item === "string" ? "" : item?.profile_photo || "";
}

function LeaderboardAvatar({ name, photo, small = false }) {
  return (
    <span className={`leaderboardAvatar ${small ? "small" : ""}`}>
      {photo ? <img src={photo} alt={name || "Profile"} /> : <img src="/logo-website.png" alt="Default Learning Hub profile" />}
    </span>
  );
}

function Leaderboard() {
  const [timeframe, setTimeframe] = useState("today");
  const [semesterId, setSemesterId] = useState("all");
  const [semesters, setSemesters] = useState([]);
  const [rankings, setRankings] = useState([]);
  const [pastTop3, setPastTop3] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const selectedTimeframeLabel = useMemo(() => {
    return TIMEFRAMES.find((item) => item.value === timeframe)?.label || "Today";
  }, [timeframe]);

  useEffect(() => {
    const fetchFilters = async () => {
      try {
        const [semesterRes, pastTopRes] = await Promise.all([
          API.get("/leaderboard/semesters"),
          API.get("/leaderboard/past-month-top3"),
        ]);
        setSemesters(semesterRes.data || []);
        setPastTop3(pastTopRes.data?.top3 || []);
      } catch (err) {
        setError(err.response?.data?.error || "Failed to load leaderboard filters");
      }
    };

    fetchFilters();
  }, []);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await API.get("/leaderboard", {
          params: {
            timeframe,
            semester_id: semesterId,
          },
        });
        setRankings(res.data?.rankings || []);
      } catch (err) {
        setRankings([]);
        setError(err.response?.data?.error || "Failed to load leaderboard");
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [timeframe, semesterId]);

  return (
    <div className="pageWrap leaderboardPage">
      <div className="pageHeader leaderboardHeader">
        <div>
          <span className="pill">Daily Quiz Rankings</span>
          <h1>Leaderboard</h1>
          <p className="muted">
            Rankings are based on Daily Quiz points: +4 for correct, -1 for wrong, and 0 for skipped questions.
          </p>
        </div>

        <div className="card pastTopCard">
          <span className="pill">Past Month Top 3</span>
          {pastTop3.length ? (
            <ol className="pastTopList">
              {pastTop3.map((item, index) => {
                const name = getTopName(item);
                const photo = getTopPhoto(item);
                return (
                  <li key={`${name}-${index}`}>
                    <span className="rankMedal">{index + 1}</span>
                    <LeaderboardAvatar name={name} photo={photo} small />
                    <strong>{name}</strong>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="muted smallText">No past month winners yet.</p>
          )}
        </div>
      </div>

      <div className="card leaderboardControls">
        <div className="leaderboardTabs" role="tablist" aria-label="Leaderboard timeframe">
          {TIMEFRAMES.map((item) => (
            <button
              key={item.value}
              type="button"
              className={timeframe === item.value ? "active" : "secondaryButton"}
              onClick={() => setTimeframe(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <label className="leaderboardSelectLabel">
          Semester
          <select value={semesterId} onChange={(e) => setSemesterId(e.target.value)}>
            <option value="all">All Semesters</option>
            {semesters.map((semester) => (
              <option key={semester.id} value={String(semester.id)}>
                {semester.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <div className="alertError" style={{ marginBottom: 18 }}>{error}</div> : null}

      <div className="card leaderboardMainCard">
        <div className="cardHeader leaderboardTableHeader">
          <div>
            <h2>{selectedTimeframeLabel} Rankings</h2>
            <p className="muted smallText">All users can view these rankings. Use the semester filter only to narrow the list.</p>
          </div>
          <span className="pill">{rankings.length} ranked</span>
        </div>

        {loading ? (
          <p className="muted">Loading leaderboard...</p>
        ) : rankings.length === 0 ? (
          <div className="emptyLeaderboard">
            <h3>No rankings yet</h3>
            <p className="muted">No Daily Quiz attempts were found for this selection.</p>
          </div>
        ) : (
          <div className="tableWrap leaderboardTableWrap">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Name</th>
                  <th>Semester</th>
                  <th>Points</th>
                  <th>Correct</th>
                  <th>Wrong</th>
                  <th>Skipped</th>
                  <th>Attempts</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((row) => (
                  <tr key={`${row.user_id}-${row.rank}`} className={row.rank <= 3 ? "topRankRow" : ""}>
                    <td><span className="leaderboardRank">{ordinal(row.rank)}</span></td>
                    <td><div className="leaderboardUserCell"><LeaderboardAvatar name={row.name} photo={row.profile_photo} small /><strong>{row.name}</strong></div></td>
                    <td>{row.semester_name || "Not set"}</td>
                    <td><strong>{row.points}</strong></td>
                    <td>{row.correct}</td>
                    <td>{row.incorrect}</td>
                    <td>{row.not_attempted}</td>
                    <td>{row.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Leaderboard;

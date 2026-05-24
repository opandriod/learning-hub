function Skeleton({ className = "", style = {} }) {
  return <div className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function SkeletonLine({ width = "100%", height = 14, className = "" }) {
  return <Skeleton className={`skeletonLine ${className}`} style={{ width, height }} />;
}

export function SkeletonCard({ lines = 3, compact = false }) {
  return (
    <div className={`card skeletonCard ${compact ? "compact" : ""}`}>
      <SkeletonLine width="56%" height={compact ? 18 : 22} />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i % 2 ? "72%" : "92%"} />
      ))}
      <SkeletonLine width={compact ? "46%" : "35%"} height={compact ? 30 : 36} />
    </div>
  );
}

export function SkeletonGrid({ count = 6 }) {
  return (
    <div className="courseGrid coursesOnlyGrid loadingGrid" aria-label="Loading cards">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

export function PageLoader({ title = "Preparing your page...", subtitle = "Loading the latest data for you." }) {
  return (
    <div className="pageLoader" role="status" aria-live="polite">
      <div className="pageLoaderPulse" />
      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
    </div>
  );
}

export function ButtonLoader({ label = "Working" }) {
  return (
    <span className="buttonLoader" aria-label={label}>
      <i />
      <i />
      <i />
    </span>
  );
}

export function ThinkingDots({ label = "Thinking" }) {
  return (
    <span className="thinkingDots" aria-label={label}>
      <i />
      <i />
      <i />
    </span>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="dashboardSkeleton proDashboardSkeleton" role="status" aria-live="polite">
      <section className="studentHeroCard skeletonHeroCard">
        <div>
          <SkeletonLine width="140px" height={14} />
          <SkeletonLine width="min(520px, 80%)" height={46} />
          <SkeletonLine width="min(620px, 92%)" height={16} />
          <SkeletonLine width="min(500px, 76%)" height={16} />
          <div className="skeletonButtonRow">
            <SkeletonLine width="148px" height={44} />
            <SkeletonLine width="132px" height={44} />
          </div>
        </div>
        <div className="todayFocusCard skeletonFocusCard">
          <SkeletonLine width="120px" height={14} />
          <SkeletonLine width="80%" height={30} />
          <SkeletonLine width="92%" height={14} />
          <SkeletonLine width="46%" height={42} />
        </div>
      </section>

      <section className="studentStatsGrid">
        {Array.from({ length: 4 }).map((_, i) => (
          <article className="studentStatCard skeletonStat" key={i}>
            <SkeletonLine width="70px" height={14} />
            <SkeletonLine width="56px" height={42} />
            <SkeletonLine width="110px" height={13} />
          </article>
        ))}
      </section>

      <section className="studentDashboardGrid">
        <div className="studentPanel">
          <SkeletonLine width="160px" height={14} />
          <SkeletonLine width="250px" height={28} />
          <div className="studentCourseList">
            {Array.from({ length: 2 }).map((_, i) => (
              <div className="studentCourseCard" key={i}>
                <SkeletonLine width="44%" height={20} />
                <SkeletonLine width="100%" height={9} />
                <SkeletonLine width="70%" height={14} />
                <SkeletonLine width="100%" height={42} />
              </div>
            ))}
          </div>
        </div>
        <aside className="studentPanel">
          <SkeletonLine width="120px" height={14} />
          <SkeletonLine width="180px" height={26} />
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonLine key={i} width="100%" height={58} />
          ))}
        </aside>
      </section>
    </div>
  );
}

export function CoursePageSkeleton() {
  return (
    <div className="dashboardSkeleton" role="status" aria-live="polite">
      <PageLoader title="Loading your courses..." subtitle="Preparing subjects and progress." />
      <SkeletonGrid count={6} />
    </div>
  );
}

export function QuizSetupSkeleton() {
  return (
    <div className="quizSetupLoading" role="status" aria-live="polite">
      <PageLoader title="Preparing quiz setup..." subtitle="Loading subjects, units, and daily quiz status." />
      <div className="card quizSetupCard">
        <SkeletonLine width="180px" height={18} />
        <div className="quizSetupGrid">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonLine key={i} width="100%" height={52} />
          ))}
        </div>
        <SkeletonLine width="100%" height={48} />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 4 }) {
  return (
    <div className="card skeletonTable">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skeletonTableRow" key={i}>
          <SkeletonLine width="22%" />
          <SkeletonLine width="30%" />
          <SkeletonLine width="16%" />
          <SkeletonLine width="18%" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;

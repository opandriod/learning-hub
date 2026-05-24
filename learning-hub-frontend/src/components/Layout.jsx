import { lazy, Suspense } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";

const AiChatBox = lazy(() => import("./AiChatBox"));

function Layout() {
  return (
    <div className="appLayout">
      <Sidebar />

      <main className="mainContent">
        <Outlet />
      </main>

      <Suspense
        fallback={
          <button className="aiChatFab" type="button" disabled aria-label="Loading AI assistant">
            <span className="aiChatFabIcon">AI</span>
            <span className="aiChatFabText">Loading...</span>
          </button>
        }
      >
        <AiChatBox />
      </Suspense>
      <BottomNav />
    </div>
  );
}

export default Layout;

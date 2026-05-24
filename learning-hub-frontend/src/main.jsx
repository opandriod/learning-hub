import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css";

const storedTheme = localStorage.getItem("theme");
const savedTheme = ["light", "dark", "normal"].includes(storedTheme)
  ? (storedTheme === "normal" ? "light" : storedTheme)
  : "light";

if (storedTheme !== savedTheme) {
  localStorage.setItem("theme", savedTheme);
}

document.body.classList.add(`theme-${savedTheme}`);
document.body.dataset.accent = localStorage.getItem("accentColor") || "blue";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

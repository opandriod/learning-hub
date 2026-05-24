import axios from "axios";

const trimTrailingSlash = (value = "") => value.replace(/\/+$/, "");

const configuredBaseUrl = trimTrailingSlash(import.meta.env.VITE_API_BASE_URL || "");

const inferProductionBaseUrl = () => {
  if (typeof window === "undefined") return "http://localhost:5000/api";

  const host = window.location.hostname;

  // Local development
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:5000/api";
  }

  // Production fallback for the Render backend used by this project.
  // Vercel should still set VITE_API_BASE_URL, but this prevents mobile users
  // from accidentally calling localhost when the env variable is missing.
  return "https://learning-hub-backend.onrender.com/api";
};

export const API_BASE_URL = configuredBaseUrl || inferProductionBaseUrl();
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, "");

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const isNetworkError = !error.response;

    if (error.code === "ECONNABORTED") {
      error.response = error.response || {
        data: { error: "Request timed out. Please wait a moment and try again. Render may be waking up." },
      };
    } else if (isNetworkError) {
      error.response = {
        data: {
          error:
            "Cannot reach the backend server. Check VITE_API_BASE_URL in Vercel and FRONTEND_URL/CORS in Render.",
        },
      };
    }

    return Promise.reject(error);
  }
);

export default API;

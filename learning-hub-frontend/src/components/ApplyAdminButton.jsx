import { useState } from "react";

export default function ApplyAdminButton({ userId }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const apply = async () => {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("http://localhost:5000/apply-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const data = await res.json();
      setMessage(data.message || data.error || "Done");
    } catch (err) {
      setMessage("Request failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={apply} disabled={loading}>
        {loading ? "Submitting..." : "Apply for Admin"}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/api";

function TopicPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [topic, setTopic] = useState(null);

  useEffect(() => {
    fetchTopic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchTopic = async () => {
    try {
      const res = await API.get(`/topics/detail/${id}`);
      setTopic(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  if (!topic) return <p>Loading...</p>;

  return (
    <div className="dashboard">
      <button onClick={() => navigate(`/unit/${topic.unit_id}`)}>← Back to Unit</button>

      <h1 style={{ marginTop: 18 }}>{topic.title}</h1>
      <p style={{ color: "#cbd5e1", marginTop: 8 }}>
        {topic.course_title} • {topic.unit_title}
      </p>

      <p style={{ marginTop: "15px", color: "#cbd5f5", lineHeight: "1.6" }}>
        {topic.content || "No content available"}
      </p>

      {topic.video_url && (
        <iframe
          width="100%"
          height="400"
          src={topic.video_url}
          title="Topic Video"
          style={{ marginTop: "20px", borderRadius: "10px" }}
          allowFullScreen
        />
      )}

      <div
        style={{
          marginTop: 22,
          padding: 16,
          borderRadius: 16,
          background: "rgba(15,23,42,.65)",
          border: "1px solid rgba(255,255,255,.12)",
          color: "#cbd5e1",
        }}
      >
        Mini Quiz starts after you finish the unit from the unit study page.
      </div>
    </div>
  );
}

export default TopicPage;

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/api";

function UnitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [topics, setTopics] = useState([]);

  useEffect(() => {
    fetchTopics();
  }, [id]);

  const fetchTopics = async () => {
    try {
      const res = await API.get(`/topics/${id}`);
      setTopics(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard">

      <button onClick={() => navigate(-1)}>← Back</button>

      <h1>Topics</h1>

      {topics.length === 0 ? (
        <p>No topics available</p>
      ) : (
        <div className="courseGrid">
          {topics.map((topic) => (
            <div
              key={topic.id}
              className="courseCard"
              onClick={() => navigate(`/topic/${topic.id}`)}
              style={{ cursor: "pointer" }}
            >
              <h3>{topic.title}</h3>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

export default UnitDetail;
import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import API from "../api/api";

function UnitPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const activeTopicRef = useRef(null);

  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    fetchTopics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    activeTopicRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [currentIndex]);

  const fetchTopics = async () => {
    try {
      const res = await API.get(`/topics/${id}`);
      const list = Array.isArray(res.data) ? res.data : [];
      setTopics(list);

      if (list.length > 0) {
        const savedIndex = localStorage.getItem(`unit_${id}`);
        const parsedIndex = savedIndex ? parseInt(savedIndex, 10) : 0;
        const safeIndex = Number.isNaN(parsedIndex)
          ? 0
          : Math.min(Math.max(parsedIndex, 0), list.length - 1);

        setCurrentIndex(safeIndex);
        fetchTopicDetail(list[safeIndex].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTopicDetail = async (topicId) => {
    try {
      const res = await API.get(`/topics/detail/${topicId}`);
      setSelectedTopic(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const selectTopicByIndex = (nextIndex) => {
    if (!topics[nextIndex]) return;
    setCurrentIndex(nextIndex);
    localStorage.setItem(`unit_${id}`, nextIndex);
    fetchTopicDetail(topics[nextIndex].id);
  };

  const goNext = () => {
    if (currentIndex < topics.length - 1) {
      selectTopicByIndex(currentIndex + 1);
      return;
    }

    if (selectedTopic?.id) {
      navigate(`/mini-quiz/${selectedTopic.id}`);
    }
  };

  const goBackToUnits = () => {
    if (selectedTopic?.course_id) {
      navigate(`/course/${selectedTopic.course_id}`);
    } else {
      navigate(-1);
    }
  };

  const readingPercent = topics.length > 0 ? ((currentIndex + 1) / topics.length) * 100 : 0;
  const isLastTopic = topics.length > 0 && currentIndex === topics.length - 1;

  return (
    <div className="dashboard unitReaderPage">
      <button onClick={goBackToUnits} className="backPillButton unitReaderBackTop">
        ← Back to Units
      </button>

      <section className="unitReaderHeroCard">
        <div>
          <span className="sectionEyebrow">Topics</span>
          <h1>{selectedTopic?.unit_title || "Unit Topics"}</h1>
          <p>Reading topic {currentIndex + 1} of {topics.length || 0}</p>
        </div>
        <span className="unitReaderCount">{Math.round(readingPercent)}%</span>
      </section>

      <div className="unitReaderProgressBar" aria-label="Reading progress">
        <span style={{ width: `${readingPercent}%` }} />
      </div>

      <section className="unitTopicPickerCard">
        <div className="unitTopicPickerHead">
          <h2>Choose topic</h2>
          <small>Tap any topic or use Next</small>
        </div>
        <div className="unitTopicPickerRail">
          {topics.map((topic, index) => {
            const isActive = selectedTopic?.id === topic.id;
            const isRead = index < currentIndex;
            return (
              <button
                key={topic.id}
                ref={isActive ? activeTopicRef : null}
                onClick={() => selectTopicByIndex(index)}
                className={`unitTopicChip ${isActive ? "isActive" : ""} ${isRead ? "isRead" : ""}`}
              >
                {topic.title}
              </button>
            );
          })}
        </div>
      </section>

      {selectedTopic && (
        <section className="unitTopicContentCard">
          <h2>{selectedTopic.title}</h2>

          {selectedTopic.content && (
            <pre className="unitTopicContentText">{selectedTopic.content}</pre>
          )}

          <div className="unitTopicActions">
            <button onClick={goBackToUnits} className="secondaryButton">
              ← Back
            </button>
            <button onClick={goNext} className="primaryButton">
              {isLastTopic ? "Start Mini Quiz" : "Next →"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

export default UnitPage;

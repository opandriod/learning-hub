import { useEffect, useMemo, useRef, useState } from "react";
import API from "../api/api";
import { ThinkingDots } from "./Skeleton";

const STARTER_MESSAGE = {
  role: "assistant",
  content:
    "Hi! I am your Learning Hub AI Assistant. Ask me about quizzes, rewards, leaderboard, project store, sub-admin, earnings, payments, or BCA topics.",
};

const starterQuestions = [
  "How does Daily Quiz work?",
  "How do Rewards and streaks work?",
  "How can I earn from Project Store?",
];

function AiChatBox() {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([STARTER_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);
  const bottomRef = useRef(null);
  const previousMessageCountRef = useRef(messages.length);

  const canSend = useMemo(() => message.trim().length > 0 && !loading, [message, loading]);
  const hasChatHistory = messages.length > 1;

  const scrollToBottom = (behavior = "smooth") => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior, block: "end" });
    }, 40);
  };

  useEffect(() => {
    if (!isOpen || !listRef.current) return;

    // When the chat opens, show the welcome/pre-chat message first.
    // After a new message is added, scroll to the latest message.
    if (messages.length === 1) {
      listRef.current.scrollTop = 0;
    } else if (messages.length !== previousMessageCountRef.current || loading) {
      scrollToBottom("smooth");
    }

    previousMessageCountRef.current = messages.length;
  }, [isOpen, messages.length, loading]);

  const clearChat = () => {
    if (loading) return;
    setMessages([STARTER_MESSAGE]);
    setMessage("");
    setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = 0;
    }, 40);
  };

  const sendMessage = async (customMessage) => {
    const text = (customMessage || message).trim();
    if (!text || loading) return;

    const historyForApi = messages.slice(-8);
    const userMessage = { role: "user", content: text };

    setMessages((prev) => [...prev, userMessage]);
    setMessage("");
    setLoading(true);
    scrollToBottom();

    try {
      const res = await API.post("/ai/chat", {
        message: text,
        history: historyForApi,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.data?.reply || "Sorry, I could not generate an answer.",
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            err.response?.data?.error ||
            "AI assistant is not available right now. Please check backend, Gemini API key, or internet connection.",
        },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <button
        className="aiChatFab"
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open Learning Hub AI Assistant"
      >
        <span className="aiChatFabIcon">AI</span>
        <span className="aiChatFabText">Ask AI</span>
      </button>

      {isOpen && (
        <section className="aiChatPanel" aria-label="Learning Hub AI Assistant">
          <div className="aiChatHeader">
            <div>
              <h3>Learning Hub AI</h3>
              <p>Study help and LMS guidance</p>
            </div>
            <div className="aiChatHeaderActions">
              <button
                className="aiChatClearBtn"
                type="button"
                onClick={clearChat}
                disabled={!hasChatHistory || loading}
                title="Clear chat"
                aria-label="Clear chat"
              >
                Clear
              </button>
              <button
                className="aiChatCloseBtn"
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
              >
                ×
              </button>
            </div>
          </div>

          <div className="aiChatBody" ref={listRef}>
            {messages.map((item, index) => (
              <div key={`${item.role}-${index}`} className={`aiMessage ${item.role}`}>
                <span>{item.role === "user" ? "You" : "AI"}</span>
                <p>{item.content}</p>
              </div>
            ))}

            {loading && (
              <div className="aiMessage assistant aiThinkingMessage">
                <span>AI</span>
                <p>Learning Hub AI is thinking <ThinkingDots label="AI is thinking" /></p>
              </div>
            )}

            <div ref={bottomRef} aria-hidden="true" />
          </div>

          <div className="aiChatStarters" aria-label="Suggested AI questions">
            {starterQuestions.map((q) => (
              <button key={q} type="button" onClick={() => sendMessage(q)} disabled={loading}>
                {q}
              </button>
            ))}
          </div>

          <div className="aiChatInputRow">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about quizzes, rewards, earnings, project store, or BCA topics..."
              rows={2}
              maxLength={2000}
            />
            <button type="button" onClick={() => sendMessage()} disabled={!canSend}>
              Send
            </button>
          </div>

          <p className="aiChatNote">
            AI can make mistakes. For official payment, payout, role approval, profile, grade, or account issues, contact admin/instructor.
          </p>
        </section>
      )}
    </>
  );
}

export default AiChatBox;

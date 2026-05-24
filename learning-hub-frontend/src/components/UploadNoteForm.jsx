import { useState } from "react";

export default function UploadNoteForm({ userId }) {
  const [form, setForm] = useState({
    course_id: "",
    unit_id: "",
    title: "",
    description: "",
    file: null,
  });
  const [message, setMessage] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    data.append("user_id", userId);
    data.append("course_id", form.course_id);
    if (form.unit_id) data.append("unit_id", form.unit_id);
    data.append("title", form.title);
    data.append("description", form.description);
    data.append("file", form.file);

    const res = await fetch("http://localhost:5000/upload-note-pdf", {
      method: "POST",
      body: data,
    });
    const result = await res.json();
    setMessage(result.message || result.error || "Done");
  };

  return (
    <form onSubmit={onSubmit}>
      <h3>Upload PDF Notes</h3>
      <input placeholder="Course ID" onChange={(e) => setForm({ ...form, course_id: e.target.value })} />
      <input placeholder="Unit ID (optional)" onChange={(e) => setForm({ ...form, unit_id: e.target.value })} />
      <input placeholder="Title" onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <textarea placeholder="Description" onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <input type="file" accept="application/pdf" onChange={(e) => setForm({ ...form, file: e.target.files[0] })} />
      <button type="submit">Upload Note</button>
      {message && <p>{message}</p>}
    </form>
  );
}

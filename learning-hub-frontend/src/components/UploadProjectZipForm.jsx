import { useState } from "react";

export default function UploadProjectZipForm({ userId }) {
  const [form, setForm] = useState({
    course_id: "",
    title: "",
    file: null,
  });
  const [message, setMessage] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    const data = new FormData();
    data.append("user_id", userId);
    data.append("course_id", form.course_id);
    data.append("title", form.title);
    data.append("file", form.file);

    const res = await fetch("http://localhost:5000/upload-project-zip", {
      method: "POST",
      body: data,
    });
    const result = await res.json();
    setMessage(result.message || result.error || "Done");
  };

  return (
    <form onSubmit={onSubmit}>
      <h3>Upload Project ZIP</h3>
      <input placeholder="Project Course ID" onChange={(e) => setForm({ ...form, course_id: e.target.value })} />
      <input placeholder="Title" onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <input type="file" accept=".zip,application/zip" onChange={(e) => setForm({ ...form, file: e.target.files[0] })} />
      <button type="submit">Upload ZIP</button>
      {message && <p>{message}</p>}
    </form>
  );
}

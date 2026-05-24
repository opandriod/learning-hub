import { useState } from "react";
import API from "../api/api";
import { useNavigate } from "react-router-dom";

function Setup() {
  const navigate = useNavigate();
  const [semester, setSemester] = useState("");

  const handleSubmit = async () => {
    if (!semester) {
      alert("Please select a semester");
      return;
    }

    try {
      await API.post("/auth/set-semester", { semester_id: semester });
      localStorage.setItem("semester_id", semester);
      navigate("/dashboard");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save semester");
    }
  };

  return (
    <div className="authShell singlePageShell">
      <div className="authPanel authFormPanel">
        <div className="authForm">
          <div>
            <h2>Select Your Semester</h2>
            <p className="muted">This helps the app show the right semester courses for your account.</p>
          </div>

          <select value={semester} onChange={(e) => setSemester(e.target.value)}>
            <option value="">-- Select Semester --</option>
            <option value="1">Semester 1</option>
            <option value="2">Semester 2</option>
            <option value="3">Semester 3</option>
            <option value="4">Semester 4</option>
            <option value="5">Semester 5</option>
            <option value="6">Semester 6</option>
          </select>

          <button onClick={handleSubmit} className="primaryButton fullWidth">
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

export default Setup;

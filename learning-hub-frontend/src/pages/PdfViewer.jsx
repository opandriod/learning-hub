import { useLocation, useNavigate } from "react-router-dom";

function PdfViewer() {
  const location = useLocation();
  const navigate = useNavigate();

  const pdfUrl = location.state?.pdf;

  // 🔥 Prevent crash if no PDF
  if (!pdfUrl) {
    return (
      <div className="dashboard">
        <h2>No PDF selected</h2>
        <button onClick={() => navigate("/syllabus")}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      
      {/* 🔙 Back Button */}
      <button
        onClick={() => navigate(-1)}
        style={{ marginBottom: "15px" }}
      >
        ← Back
      </button>

      <h1>PDF Viewer</h1>

      <iframe
        src={pdfUrl}
        width="100%"
        height="600px"
        style={{ borderRadius: "10px" }}
      ></iframe>

    </div>
  );
}

export default PdfViewer;
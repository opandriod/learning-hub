import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import PublicHome from "./pages/PublicHome";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Courses from "./pages/Courses";
import CourseDetail from "./pages/CourseDetail";
import Lesson from "./pages/Lesson";
import Syllabus from "./pages/Syllabus";
import Layout from "./components/Layout";
import PdfViewer from "./pages/PdfViewer";
import QuizPage from "./pages/QuizPage";
import MiniTopicQuiz from "./pages/MiniTopicQuiz";
import TopicPage from "./pages/TopicPage";
import QuizSetup from "./pages/QuizSetup";
import QuizCustom from "./pages/QuizCustom";
import QuizResult from "./pages/QuizResult";
import Leaderboard from "./pages/Leaderboard";
import Setup from "./pages/Setup";
import UnitPage from "./pages/UnitPage";
import MockTestHome from "./pages/MockTestHome";
import MockTestPage from "./pages/MockTestPage";
import Profile from "./pages/Profile";
import AdminDashboard from "./pages/AdminDashboard";
import InstructorRequests from "./pages/InstructorRequests";
import AdminUpload from "./pages/AdminUpload";
import PreviousQuestions from "./pages/PreviousQuestions";
import StudyMaterials from "./pages/StudyMaterials";
import AdminOldQuestions from "./pages/AdminOldQuestions";
import AdminStudyMaterials from "./pages/AdminStudyMaterials";
import ApplySubAdmin from "./pages/ApplySubAdmin";
import InstructorSubAdminRequests from "./pages/InstructorSubAdminRequests";
import SubAdminProjects from "./pages/SubAdminProjects";
import AdminProjectReview from "./pages/AdminProjectReview";
import PaymentReview from "./pages/PaymentReview";
import ProjectsMarketplace from "./pages/ProjectsMarketplace";
import Contact from "./pages/Contact";
import Feedback from "./pages/Feedback";
import Achievements from "./pages/Achievements";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicHome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route element={<ProtectedRoute allowedRoles={["student", "sub_admin", "admin", "instructor"]} />}>
          <Route element={<Layout />}>
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/projects" element={<ProjectsMarketplace />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/study-materials" element={<StudyMaterials />} />
            <Route path="/previous-questions" element={<PreviousQuestions />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/achievements" element={<Achievements />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["student"]} />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/course/:id" element={<CourseDetail />} />
            <Route path="/lesson/:id" element={<Lesson />} />
            <Route path="/unit/:id" element={<UnitPage />} />
            <Route path="/syllabus" element={<Syllabus />} />
            <Route path="/pdf" element={<PdfViewer />} />
            <Route path="/quiz/:id" element={<QuizPage />} />
            <Route path="/mini-quiz/:topicId" element={<MiniTopicQuiz />} />
            <Route path="/topic/:id" element={<TopicPage />} />
            <Route path="/quiz-setup" element={<QuizSetup />} />
            <Route path="/quiz-custom" element={<QuizCustom />} />
            <Route path="/quiz-result" element={<QuizResult />} />
            <Route path="/mock-test" element={<MockTestHome />} />
            <Route path="/mock-test/:id" element={<MockTestPage />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/apply-sub-admin" element={<ApplySubAdmin />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["sub_admin"]} />}>
          <Route element={<Layout />}>
            <Route path="/sub-admin/projects" element={<SubAdminProjects />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
          <Route element={<Layout />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/upload" element={<AdminUpload />} />
            <Route path="/admin/study-materials" element={<AdminStudyMaterials />} />
            <Route path="/admin/old-questions" element={<AdminOldQuestions />} />
            <Route path="/admin/project-upload" element={<SubAdminProjects />} />
            <Route path="/admin/project-review" element={<AdminProjectReview />} />
            <Route path="/admin/payments" element={<PaymentReview />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={["instructor"]} />}>
          <Route element={<Layout />}>
            <Route path="/instructor/requests" element={<InstructorRequests />} />
            <Route path="/instructor/sub-admin-requests" element={<InstructorSubAdminRequests />} />
            <Route path="/instructor/project-review" element={<AdminProjectReview />} />
            <Route path="/instructor/payments" element={<PaymentReview />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

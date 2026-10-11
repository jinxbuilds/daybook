import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./lib/auth.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import TasksPage from "./pages/TasksPage.jsx";

export default function App() {
  const { user, ready } = useAuth();
  if (!ready) return <div className="boot" aria-busy="true" />;

  if (!user) {
    return (
      <Routes>
        <Route path="/signup" element={<AuthPage mode="signup" />} />
        <Route path="*" element={<AuthPage mode="signin" />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/today" replace />} />
      <Route path="/signin" element={<Navigate to="/today" replace />} />
      <Route path="/signup" element={<Navigate to="/today" replace />} />
      <Route path="/:view" element={<TasksPage />} />
      <Route path="/project/:project" element={<TasksPage />} />
      <Route path="*" element={<Navigate to="/today" replace />} />
    </Routes>
  );
}

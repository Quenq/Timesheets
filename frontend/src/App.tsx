import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { TimesheetPage } from './pages/TimesheetPage';
import { ExportPage } from './pages/ExportPage';
import { SettingsPage } from './pages/SettingsPage';
import { EmployeeHoursPage } from './pages/EmployeeHoursPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" />;
  }
  return <>{children}</>;
}

function App() {
  const { user, loading, logout, fetchUser } = useAuth();

  useEffect(() => {
    if (localStorage.getItem('token')) {
      fetchUser();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{ duration: 3500 }}
        containerStyle={{ zIndex: 99999 }}
      />
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout user={user} onLogout={logout}>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard user={user} />} />
                  <Route path="/timesheets" element={<TimesheetPage user={user} />} />
                  <Route path="/employee-hours" element={<EmployeeHoursPage user={user} />} />
                  <Route path="/export" element={<ExportPage />} />
                  <Route path="/settings" element={<SettingsPage user={user} />} />
                  <Route path="/projects/:id" element={<ProjectDetailPage user={user} />} />
                  <Route path="/" element={<Navigate to="/dashboard" />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
    </>
  );
}

export default App;

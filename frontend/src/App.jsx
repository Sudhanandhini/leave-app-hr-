import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminEmployees from './pages/admin/AdminEmployees';
import AdminAttendancePage from './pages/admin/AdminAttendancePage';
import AdminReports from './pages/admin/AdminReports';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import EmployeeAttendancePage from './pages/employee/EmployeeAttendancePage';

function PrivateRoute({ children, adminOnly = false }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <Layout>{children}</Layout>;
}

function RootRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/attendance">
        <Toaster position="top-right" toastOptions={{
          style: { borderRadius: '12px', fontFamily: 'DM Sans, sans-serif', fontSize: '14px' }
        }} />
        <Routes >
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<RootRedirect />} />

          {/* Admin routes */}
          <Route path="/admin" element={<PrivateRoute adminOnly><AdminDashboard /></PrivateRoute>} />
          <Route path="/admin/employees" element={<PrivateRoute adminOnly><AdminEmployees /></PrivateRoute>} />
          <Route path="/admin/attendance" element={<PrivateRoute adminOnly><AdminAttendancePage /></PrivateRoute>} />
          <Route path="/admin/reports" element={<PrivateRoute adminOnly><AdminReports /></PrivateRoute>} />

          {/* Employee routes */}
          <Route path="/dashboard" element={<PrivateRoute><EmployeeDashboard /></PrivateRoute>} />
          <Route path="/attendance" element={<PrivateRoute><EmployeeAttendancePage /></PrivateRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

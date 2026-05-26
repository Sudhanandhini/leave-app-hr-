import { useAuth } from '../../context/AuthContext';
import AttendanceSheet from '../../components/AttendanceSheet';

export default function EmployeeAttendancePage() {
  const { user } = useAuth();
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">My Attendance</h1>
        <p className="text-slate-500 text-sm">Track and update your daily attendance</p>
      </div>
      <AttendanceSheet employeeId={user.id} />
    </div>
  );
}

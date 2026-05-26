import { useState, useEffect } from 'react';
import api from '../../utils/api';
import AttendanceSheet from '../../components/AttendanceSheet';
import { Users, ChevronDown } from 'lucide-react';

export default function AdminAttendancePage() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/employees').then(res => {
      const emps = res.data.filter(e => e.role === 'employee');
      setEmployees(emps);
      if (emps.length > 0) setSelectedEmp(emps[0]);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Attendance Management</h1>
          <p className="text-slate-500 text-sm">View and update attendance for any employee</p>
        </div>

        {/* Employee selector */}
        <div className="relative">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-sm">
            <Users className="w-4 h-4 text-gray-400" />
            <select
              value={selectedEmp?.id || ''}
              onChange={e => setSelectedEmp(employees.find(emp => emp.id == e.target.value))}
              className="text-sm font-medium text-slate-700 focus:outline-none bg-transparent pr-6 cursor-pointer"
            >
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} — {emp.department || 'No dept'}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-3" />
          </div>
        </div>
      </div>

      {selectedEmp && (
        <div>
          {/* Employee info bar */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                {selectedEmp.name?.charAt(0)}
              </div>
              <div>
                <div className="font-semibold text-blue-900">{selectedEmp.name}</div>
                <div className="text-xs text-blue-600">{selectedEmp.email} · {selectedEmp.department}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-blue-500 font-medium">Carry Forward</div>
              <div className="text-xl font-display font-bold text-blue-800">{selectedEmp.carry_forward || 0} days</div>
            </div>
          </div>

          <AttendanceSheet employeeId={selectedEmp.id} isAdmin={true} />
        </div>
      )}

      {loading && <div className="text-center py-12 text-slate-400">Loading employees...</div>}
    </div>
  );
}

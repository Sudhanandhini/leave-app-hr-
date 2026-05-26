import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Users, CalendarCheck, TrendingUp, AlertCircle, ChevronRight } from 'lucide-react';
import { getMonthName } from '../../utils/leaveCalc';
import { Link } from 'react-router-dom';

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="card flex items-start gap-4">
      <div className={`w-12 h-12 ${color} rounded-2xl flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <div className="text-2xl font-display font-bold text-slate-900">{value}</div>
        <div className="text-sm font-medium text-slate-700">{label}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summaries, setSummaries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [year, month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empRes, sumRes] = await Promise.all([
        api.get('/employees'),
        api.get(`/attendance/admin/monthly/${year}/${month}`)
      ]);
      setEmployees(empRes.data);
      setSummaries(sumRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const totalPresent = summaries.reduce((s, x) => s + (x.summary?.present_days || 0), 0);
  const totalLeaves = summaries.reduce((s, x) => s + (x.summary?.leave_days || 0), 0);
  const totalEL = summaries.reduce((s, x) => s + (x.summary?.el_earned || 0), 0);
  const totalCF = employees.reduce((s, e) => s + parseFloat(e.carry_forward || 0), 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Admin Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Overview for all employees</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={month} onChange={e => setMonth(+e.target.value)} className="input-field w-32">
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i+1} value={i+1}>{getMonthName(i+1)}</option>
            ))}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)} className="input-field w-24">
            {[2024, 2025, 2026].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Employees" value={employees.filter(e => e.role === 'employee').length} color="bg-blue-600" sub="Active" />
        <StatCard icon={CalendarCheck} label="Total Present Days" value={totalPresent} color="bg-green-600" sub={`${getMonthName(month)} ${year}`} />
        <StatCard icon={AlertCircle} label="Leave Days Taken" value={totalLeaves} color="bg-red-500" sub="This month" />
        <StatCard icon={TrendingUp} label="EL Earned (Total)" value={totalEL} color="bg-purple-600" sub="This month" />
      </div>

      {/* Employee Summary Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Employee Attendance — {getMonthName(month)} {year}</h2>
          <Link to="/admin/attendance" className="text-blue-600 text-sm font-medium flex items-center gap-1 hover:underline">
            Manage <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Employee</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Dept</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Present</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Leave</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">WoH</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">EL Earned</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Carry Fwd</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">CF Used</th>
                </tr>
              </thead>
              <tbody>
                {summaries.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">No data for this period</td></tr>
                ) : summaries.map(({ employee, summary }) => (
                  <tr key={employee.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
                          {employee.name?.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-slate-800">{employee.name}</div>
                          <div className="text-xs text-slate-400">{employee.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{employee.department || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-green-100 text-green-700 rounded-full font-semibold text-xs">
                        {summary?.present_days || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-semibold text-xs ${
                        (summary?.leave_days || 0) > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'}`}>
                        {summary?.leave_days || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-teal-100 text-teal-700 rounded-full font-semibold text-xs">
                        {summary?.work_on_holiday || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 bg-purple-100 text-purple-700 rounded-full font-semibold text-xs">
                        {summary?.el_earned || 0}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-slate-700 font-semibold">
                      {employee.carry_forward || 0}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-semibold ${(summary?.carry_forward_used || 0) > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                        {summary?.carry_forward_used || 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CF Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="text-blue-600 text-xs font-semibold uppercase tracking-wide mb-1">Total Carry Forward (All Emp)</div>
          <div className="text-3xl font-display font-bold text-blue-800">{totalCF}</div>
          <div className="text-blue-600 text-xs mt-1">days available across team</div>
        </div>
        <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="text-green-600 text-xs font-semibold uppercase tracking-wide mb-1">EL Earned This Month</div>
          <div className="text-3xl font-display font-bold text-green-800">{totalEL}</div>
          <div className="text-green-600 text-xs mt-1">earned leaves (auto-calculated)</div>
        </div>
        <div className="card bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <div className="text-amber-600 text-xs font-semibold uppercase tracking-wide mb-1">Leave Impact on Salary</div>
          <div className="text-3xl font-display font-bold text-amber-800">
            {summaries.filter(s => (s.summary?.leave_days || 0) > (s.summary?.carry_forward_used || 0)).length}
          </div>
          <div className="text-amber-600 text-xs mt-1">employees with salary deductions</div>
        </div>
      </div>
    </div>
  );
}

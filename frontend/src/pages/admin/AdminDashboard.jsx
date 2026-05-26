import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Users, CalendarCheck, TrendingUp, AlertCircle, ChevronRight, IndianRupee } from 'lucide-react';
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
  // keyed by employee id
  const [cfPoolsMap, setCfPoolsMap] = useState({});   // { empId: pools[] }
  const [cfCoveredMap, setCfCoveredMap] = useState({}); // { empId: number }
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [year, month]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [empRes, sumRes] = await Promise.all([
        api.get('/employees'),
        api.get(`/attendance/admin/monthly/${year}/${month}`),
      ]);
      const emps = empRes.data.filter(e => e.role === 'employee');
      setEmployees(empRes.data);
      setSummaries(sumRes.data);

      // Fetch cf-pools and month attendance for each employee in parallel
      const [poolResults, recResults] = await Promise.all([
        Promise.all(emps.map(e =>
          api.get(`/attendance/cf-pools/${e.id}`).catch(() => ({ data: { pools: [] } }))
        )),
        Promise.all(emps.map(e =>
          api.get(`/attendance/month/${e.id}/${year}/${month}`).catch(() => ({ data: { records: [] } }))
        )),
      ]);

      const poolsMap = {};
      const coveredMap = {};
      emps.forEach((e, i) => {
        poolsMap[e.id] = poolResults[i].data.pools || [];
        const recs = recResults[i].data.records || [];
        coveredMap[e.id] = recs.filter(
          r => r.status === 'leave' && r.leave_source && r.leave_source !== 'unpaid'
        ).length;
      });
      setCfPoolsMap(poolsMap);
      setCfCoveredMap(coveredMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getCfTotal = empId =>
    (cfPoolsMap[empId] || []).reduce((s, p) => s + Math.max(0, p.available), 0);

  const totalPresent = summaries.reduce((s, x) => s + (x.summary?.present_days || 0), 0);
  const totalLeaves  = summaries.reduce((s, x) => s + (x.summary?.leave_days || 0), 0);
  const totalEL      = summaries.reduce((s, x) => s + (x.summary?.el_earned || 0), 0);
  const totalCF      = employees.filter(e => e.role === 'employee')
    .reduce((s, e) => s + getCfTotal(e.id), 0);

  // Employees with salary deduction this month
  const deductRows = summaries.map(({ employee, summary }) => {
    const leaveDays  = summary?.leave_days || 0;
    const cfCovered  = cfCoveredMap[employee.id] || 0;
    const deduct     = Math.max(0, leaveDays - cfCovered);
    return { employee, leaveDays, cfCovered, deduct };
  }).filter(r => r.deduct > 0);

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
        <StatCard icon={Users}         label="Total Employees"   value={employees.filter(e => e.role === 'employee').length} color="bg-blue-600"   sub="Active" />
        <StatCard icon={CalendarCheck} label="Total Present Days" value={totalPresent} color="bg-green-600"  sub={`${getMonthName(month)} ${year}`} />
        <StatCard icon={AlertCircle}   label="Leave Days Taken"  value={totalLeaves}  color="bg-red-500"    sub="This month" />
        <StatCard icon={TrendingUp}    label="EL Earned (Total)" value={totalEL}      color="bg-purple-600" sub="This month" />
      </div>

      {/* Employee Summary Table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">
            Employee Attendance — {getMonthName(month)} {year}
          </h2>
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
                  <th className="px-4 py-3 text-left   font-semibold text-slate-600">Employee</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Dept</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Present</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Leave</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">WoH</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">EL Earned</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">CF Available</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">CF Used</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Salary Deduct</th>
                </tr>
              </thead>
              <tbody>
                {summaries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                      No data for this period
                    </td>
                  </tr>
                ) : summaries.map(({ employee, summary }) => {
                  const leaveDays = summary?.leave_days || 0;
                  const cfCovered = cfCoveredMap[employee.id] || 0;
                  const cfAvail   = getCfTotal(employee.id);
                  const deduct    = Math.max(0, leaveDays - cfCovered);
                  return (
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
                          leaveDays > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400'}`}>
                          {leaveDays}
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
                      {/* CF Available — real-time from pools */}
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center justify-center px-2 py-1 rounded-lg text-xs font-bold ${
                          cfAvail > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
                        }`}>
                          {cfAvail}d
                        </span>
                      </td>
                      {/* CF Used — actual leave_source assignments */}
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-semibold ${cfCovered > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
                          {cfCovered}
                        </span>
                      </td>
                      {/* Salary Deduct */}
                      <td className="px-4 py-3 text-center">
                        {deduct > 0 ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold">
                            -{deduct}d
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-semibold">
                            ✓ Full
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom summary row */}
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
        <div className="card bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <div className="text-red-600 text-xs font-semibold uppercase tracking-wide mb-1">Salary Deductions</div>
          <div className="text-3xl font-display font-bold text-red-800">{deductRows.length}</div>
          <div className="text-red-600 text-xs mt-1">
            {deductRows.length === 0 ? 'No deductions this month' : `employee${deductRows.length > 1 ? 's' : ''} with unpaid leave`}
          </div>
        </div>
      </div>

      {/* Salary deduction detail panel */}
      {deductRows.length > 0 && (
        <div className="card border-red-200 bg-red-50">
          <div className="flex items-center gap-2 mb-3">
            <IndianRupee className="w-4 h-4 text-red-600" />
            <h3 className="font-semibold text-red-800">Salary Deduction Detail — {getMonthName(month)} {year}</h3>
          </div>
          <div className="space-y-2">
            {deductRows.map(({ employee, leaveDays, cfCovered, deduct }) => (
              <div key={employee.id}
                className="flex items-center justify-between bg-white rounded-xl px-4 py-3 border border-red-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-red-100 text-red-700 rounded-full flex items-center justify-center text-xs font-bold">
                    {employee.name?.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium text-slate-800 text-sm">{employee.name}</div>
                    <div className="text-xs text-slate-400">{employee.department}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-slate-700">{leaveDays}</div>
                    <div className="text-xs text-slate-400">Leave taken</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-blue-600">-{cfCovered}</div>
                    <div className="text-xs text-slate-400">CF covered</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-red-700 text-base">{deduct} day{deduct > 1 ? 's' : ''}</div>
                    <div className="text-xs text-red-500">to deduct</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All clear message */}
      {!loading && deductRows.length === 0 && summaries.length > 0 && (
        <div className="card bg-green-50 border-green-200 flex items-center gap-3">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center text-white text-sm font-bold">✓</div>
          <div>
            <div className="font-semibold text-green-800 text-sm">No salary deductions this month</div>
            <div className="text-green-600 text-xs">All leave days are covered by carry forward or no leaves taken</div>
          </div>
        </div>
      )}
    </div>
  );
}

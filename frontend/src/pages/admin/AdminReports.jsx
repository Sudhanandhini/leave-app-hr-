import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { getMonthName } from '../../utils/leaveCalc';
import { FileText, Download } from 'lucide-react';
import toast from 'react-hot-toast';

export default function AdminReports() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/attendance/admin/monthly/${year}/${month}`);
      setSummaries(res.data);
    } catch {
      toast.error('Failed to load report');
    }
    setLoading(false);
  };

  useEffect(() => { loadReport(); }, [year, month]);

  const exportCSV = () => {
    const rows = [
      ['Employee', 'Dept', 'Total Days', 'Sundays', 'Sat (Leave)', 'Sat (Work)', 'Present', 'Leave', 'Work on Holiday', 'EL Earned', 'CF Used', 'Salary Deduction Days'],
      ...summaries.map(({ employee, summary }) => {
        const s = summary || {};
        const cfUsed = s.carry_forward_used || 0;
        const deduct = Math.max(0, (s.leave_days || 0) - cfUsed);
        return [
          employee.name, employee.department || '',
          s.total_days || 0, s.sundays || 0, s.saturdays_leave || 0, s.saturdays_working || 0,
          s.present_days || 0, s.leave_days || 0, s.work_on_holiday || 0,
          s.el_earned || 0, cfUsed, deduct
        ];
      })
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${getMonthName(month)}_${year}.csv`;
    a.click();
    toast.success('Report downloaded!');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Monthly Reports</h1>
          <p className="text-slate-500 text-sm">Attendance and leave summary</p>
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
          <button onClick={exportCSV} className="btn-primary flex items-center gap-1.5">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h2 className="font-semibold text-slate-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            {getMonthName(month)} {year} — Attendance Report
          </h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading report...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100">
                <tr className="bg-slate-50">
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Employee</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Days</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 text-yellow-700">Sun</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 text-yellow-700">Sat-L</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600">Present</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 text-red-600">Leave</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 text-teal-700">WoH</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 text-purple-700">EL</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 text-blue-700">CF</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 text-orange-700">CF Used</th>
                  <th className="px-4 py-3 text-center font-semibold text-slate-600 text-red-700">Deduct</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map(({ employee, summary: s }) => {
                  const cfUsed = s?.carry_forward_used || 0;
                  const deduct = Math.max(0, (s?.leave_days || 0) - cfUsed);
                  return (
                    <tr key={employee.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{employee.name}</div>
                        <div className="text-xs text-slate-400">{employee.department}</div>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">{s?.total_days || 0}</td>
                      <td className="px-4 py-3 text-center text-yellow-700">{s?.sundays || 0}</td>
                      <td className="px-4 py-3 text-center text-yellow-700">{s?.saturdays_leave || 0}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-semibold text-green-700">{s?.present_days || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={s?.leave_days ? 'text-red-600 font-semibold' : 'text-gray-400'}>{s?.leave_days || 0}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-teal-700">{s?.work_on_holiday || 0}</td>
                      <td className="px-4 py-3 text-center text-purple-700 font-semibold">{s?.el_earned || 0}</td>
                      <td className="px-4 py-3 text-center text-blue-700 font-mono">{employee.carry_forward || 0}</td>
                      <td className="px-4 py-3 text-center text-orange-700">{cfUsed}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${deduct > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {deduct > 0 ? `-${deduct}` : '✓'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

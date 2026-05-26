import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { getMonthName, calculateMonthlyStats } from '../../utils/leaveCalc';
import { CalendarDays, TrendingUp, Clock, AlertTriangle, IndianRupee } from 'lucide-react';

function formatINR(amount) {
  const n = parseFloat(amount) || 0;
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const now = new Date();
  const [summary, setSummary] = useState(null);
  const [cfPools, setCfPools] = useState([]);
  const [monthRecords, setMonthRecords] = useState([]);
  const [empData, setEmpData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const yr = now.getFullYear();
    const mo = now.getMonth() + 1;
    Promise.all([
      api.get(`/attendance/summary/${user.id}/${yr}/${mo}`).catch(() => ({ data: null })),
      api.get(`/attendance/cf-pools/${user.id}`).catch(() => ({ data: { pools: [] } })),
      api.get(`/attendance/month/${user.id}/${yr}/${mo}`).catch(() => ({ data: { records: [], employee: null } })),
    ]).then(([sumRes, poolRes, recRes]) => {
      setSummary(sumRes.data);
      setCfPools(poolRes.data.pools || []);
      setMonthRecords(recRes.data.records || []);
      setEmpData(recRes.data.employee);
    }).finally(() => setLoading(false));
  }, [user.id]);

  const cfTotal = cfPools.reduce((s, p) => s + Math.max(0, p.available), 0);
  const leaveDays = summary?.leave_days || 0;

  // Leaves actually covered by a carry-forward pool (not unpaid)
  const cfCovered = monthRecords.filter(
    r => r.status === 'leave' && r.leave_source && r.leave_source !== 'unpaid'
  ).length;
  const salaryDeductDays = Math.max(0, leaveDays - cfCovered);

  // Salary calculation
  const monthlySalary = parseFloat(empData?.salary || user?.salary || 0);
  const stats = calculateMonthlyStats(monthRecords, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
  // Working days = total days minus weekly offs and sat_leave
  const workingDays = stats.totalWorkingDays || 1;
  const perDayRate = monthlySalary / workingDays;
  const deductionAmount = perDayRate * salaryDeductDays;
  const netSalary = monthlySalary - deductionAmount;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white">
        <div className="text-blue-200 text-sm font-medium mb-1">Welcome back</div>
        <h1 className="font-display text-2xl font-bold">{user?.name}</h1>
        <div className="flex items-center gap-4 mt-3 text-sm text-blue-200">
          <span>{user?.department}</span>
          <span>•</span>
          <span>Carry Forward: <strong className="text-white">{cfTotal} days</strong></span>
          {monthlySalary > 0 && (
            <>
              <span>•</span>
              <span>Salary: <strong className="text-white">{formatINR(monthlySalary)}/mo</strong></span>
            </>
          )}
        </div>
      </div>

      {/* Month overview */}
      <div>
        <h2 className="font-semibold text-slate-800 mb-3">
          {getMonthName(now.getMonth() + 1)} {now.getFullYear()} — Summary
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="card text-center">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-2">
              <CalendarDays className="w-5 h-5 text-green-600" />
            </div>
            <div className="text-2xl font-display font-bold text-slate-900">{summary?.present_days || 0}</div>
            <div className="text-xs text-slate-500 font-medium">Days Present</div>
          </div>
          <div className="card text-center">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div className="text-2xl font-display font-bold text-slate-900">{leaveDays}</div>
            <div className="text-xs text-slate-500 font-medium">Leave Days</div>
          </div>
          <div className="card text-center">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div className="text-2xl font-display font-bold text-slate-900">{summary?.el_earned || 0}</div>
            <div className="text-xs text-slate-500 font-medium">EL Earned</div>
          </div>
          <div className="card text-center">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div className="text-2xl font-display font-bold text-slate-900">{cfTotal}</div>
            <div className="text-xs text-slate-500 font-medium">Carry Forward</div>
          </div>
        </div>
      </div>

      {/* CF pool breakdown */}
      {cfPools.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Carry Forward Breakdown</span>
            <span className="text-xl font-display font-bold text-blue-800">{cfTotal} days</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {cfPools.map(pool => (
              <span key={pool.key} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                pool.available <= 0
                  ? 'bg-gray-100 text-gray-400 border-gray-200 line-through'
                  : 'bg-blue-100 text-blue-800 border-blue-300'
              }`}>
                {pool.label}
                <span className={`font-bold ${pool.available <= 0 ? 'text-gray-400' : 'text-blue-600'}`}>
                  {Math.max(0, pool.available)}d
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Salary details card */}
      {monthlySalary > 0 && (
        <div className={`rounded-2xl p-5 border ${salaryDeductDays > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-center gap-2 mb-4">
            <IndianRupee className={`w-4 h-4 ${salaryDeductDays > 0 ? 'text-red-600' : 'text-green-600'}`} />
            <h3 className={`font-semibold ${salaryDeductDays > 0 ? 'text-red-800' : 'text-green-800'}`}>
              Salary Details — {getMonthName(now.getMonth() + 1)} {now.getFullYear()}
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Left: breakdown table */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-700">
                <span>Monthly Gross Salary</span>
                <span className="font-semibold font-mono">{formatINR(monthlySalary)}</span>
              </div>
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Working days this month</span>
                <span>{workingDays} days</span>
              </div>
              <div className="flex justify-between text-slate-500 text-xs">
                <span>Per day rate</span>
                <span className="font-mono">{formatINR(perDayRate)}/day</span>
              </div>
              {leaveDays > 0 && (
                <>
                  <div className="border-t border-current/20 pt-2 mt-2 flex justify-between text-slate-600">
                    <span>Leave taken</span>
                    <span className="font-semibold">{leaveDays} day{leaveDays > 1 ? 's' : ''}</span>
                  </div>
                  {cfCovered > 0 && (
                    <div className="flex justify-between text-blue-600">
                      <span>Covered by carry forward</span>
                      <span className="font-semibold">-{cfCovered} day{cfCovered > 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {salaryDeductDays > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Unpaid leave days</span>
                      <span className="font-semibold">{salaryDeductDays} day{salaryDeductDays > 1 ? 's' : ''}</span>
                    </div>
                  )}
                  {salaryDeductDays > 0 && (
                    <div className="flex justify-between text-red-700 font-semibold">
                      <span>Deduction ({salaryDeductDays} × {formatINR(perDayRate)})</span>
                      <span className="font-mono">- {formatINR(deductionAmount)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Right: net salary highlight */}
            <div className={`flex flex-col items-center justify-center rounded-xl p-4 ${
              salaryDeductDays > 0 ? 'bg-red-100 border border-red-200' : 'bg-green-100 border border-green-200'
            }`}>
              <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${salaryDeductDays > 0 ? 'text-red-600' : 'text-green-600'}`}>
                Net Salary
              </div>
              <div className={`text-3xl font-display font-bold font-mono ${salaryDeductDays > 0 ? 'text-red-800' : 'text-green-800'}`}>
                {formatINR(netSalary)}
              </div>
              {salaryDeductDays > 0 && (
                <div className="text-xs text-red-500 mt-1">
                  -{formatINR(deductionAmount)} deducted
                </div>
              )}
              {salaryDeductDays === 0 && (
                <div className="text-xs text-green-600 mt-1">No deduction</div>
              )}
            </div>
          </div>

          {salaryDeductDays === 0 && leaveDays > 0 && (
            <p className="text-green-700 text-xs">✓ All leaves covered by carry forward — full salary this month!</p>
          )}
          {salaryDeductDays === 0 && leaveDays === 0 && (
            <p className="text-green-700 text-xs">✓ No leave taken — full salary this month!</p>
          )}
        </div>
      )}

      {/* Leave impact (shown only when no salary configured) */}
      {monthlySalary === 0 && leaveDays > 0 && (
        <div className={`rounded-2xl p-5 border ${salaryDeductDays > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <h3 className={`font-semibold mb-3 ${salaryDeductDays > 0 ? 'text-red-800' : 'text-green-800'}`}>
            Leave Impact on Salary
          </h3>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Leave days taken</span>
              <span className="font-semibold">{leaveDays}</span>
            </div>
            {cfCovered > 0 && (
              <div className="flex justify-between text-blue-700">
                <span>Covered by carry forward</span>
                <span className="font-semibold">-{cfCovered}</span>
              </div>
            )}
            <div className={`flex justify-between font-bold pt-1.5 border-t ${salaryDeductDays > 0 ? 'text-red-700 border-red-200' : 'text-green-700 border-green-200'}`}>
              <span>Days to deduct from salary</span>
              <span>{salaryDeductDays}</span>
            </div>
          </div>
          {salaryDeductDays === 0 && (
            <p className="text-green-700 text-xs mt-2">✓ All leaves covered by carry forward — no salary deduction!</p>
          )}
        </div>
      )}

      {/* EL explanation */}
      <div className="card bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-100">
        <h3 className="font-semibold text-purple-900 mb-2">How Earned Leave Works</h3>
        <ul className="text-sm text-purple-700 space-y-1">
          <li>• Every <strong>20 working days</strong> = 1 Earned Leave (EL)</li>
          <li>• EL is automatically added to your <strong>Carry Forward</strong></li>
          <li>• When you take leave, carry forward is <strong>deducted first</strong></li>
          <li>• Remaining leave days (after CF) are <strong>deducted from salary</strong></li>
          <li>• 1st & 3rd Saturdays are off — 2nd, 4th, 5th Saturdays are working days</li>
        </ul>
      </div>
    </div>
  );
}

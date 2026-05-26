import { useState, useEffect, useCallback } from 'react';
import api from '../utils/api';
import { getDayType, getAvailableStatuses, STATUS_CONFIG, calculateMonthlyStats, getMonthName } from '../utils/leaveCalc';
import { Save, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MIN_YEAR = 2026;
const MIN_MONTH = 3; // March 2026 — attendance tracking start

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.present;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function AttendanceSheet({ employeeId, isAdmin = false }) {
  const now = new Date();
  const pad0 = n => String(n).padStart(2, '0');
  const todayStr = `${now.getFullYear()}-${pad0(now.getMonth()+1)}-${pad0(now.getDate())}`;
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [records, setRecords] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changedDates, setChangedDates] = useState(new Set());
  const [cfPools, setCfPools] = useState([]);
  const [cfMonthlyPresent, setCfMonthlyPresent] = useState([]); // [{year,month,presentDays}]

  const isAtMin = year === MIN_YEAR && month === MIN_MONTH;
  const isAtMax = year === now.getFullYear() && month === now.getMonth() + 1;

  const daysInMonth = new Date(year, month, 0).getDate();

  const loadCfPools = useCallback(async () => {
    try {
      const res = await api.get(`/attendance/cf-pools/${employeeId}`);
      setCfPools(res.data.pools || []);
      setCfMonthlyPresent(res.data.monthlyPresent || []);
    } catch {}
  }, [employeeId]);

  const loadAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/attendance/month/${employeeId}/${year}/${month}`);
      setEmployee(res.data.employee);

      const fetched = res.data.records;
      const map = {};
      fetched.forEach(r => { map[r.date] = r; });

      const full = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const defaultType = getDayType(dateStr);
        const [y, mo, dy] = dateStr.split('-').map(Number);
        const date = new Date(y, mo - 1, dy);
        const dbRec = map[dateStr];
        const availableStatuses = getAvailableStatuses(dateStr);
        // If DB status is incompatible with the day type, fall back to computed default
        const isCompatible = dbRec?.status && availableStatuses.includes(dbRec.status);
        const status = isCompatible
          ? dbRec.status
          : (defaultType === 'weekday' ? 'present' : defaultType);
        // Only carry leave_source when status is actually 'leave'
        const leaveSource = (isCompatible && status === 'leave') ? (dbRec?.leave_source || null) : null;
        full.push({
          ...(dbRec || {}),
          date: dateStr,
          status,
          leave_source: leaveSource,
          notes: dbRec?.notes || '',
          dayName: DAY_NAMES[date.getDay()],
          dayNum: d,
          isWeekend: date.getDay() === 0 || date.getDay() === 6,
          defaultType,
        });
      }
      setRecords(full);
      setChangedDates(new Set());
    } catch (err) {
      toast.error('Failed to load attendance');
    } finally {
      setLoading(false);
    }
  }, [employeeId, year, month, daysInMonth]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);
  useEffect(() => { loadCfPools(); }, [loadCfPools]);

  const updateStatus = (date, status) => {
    setRecords(prev => prev.map(r =>
      r.date === date
        ? { ...r, status, leave_source: status === 'leave' ? r.leave_source : null }
        : r
    ));
    setChangedDates(prev => new Set([...prev, date]));
  };

  const updateLeaveSource = (date, source) => {
    setRecords(prev => prev.map(r => r.date === date ? { ...r, leave_source: source } : r));
    setChangedDates(prev => new Set([...prev, date]));
  };

  const saveAll = async () => {
    if (changedDates.size === 0) return;
    setSaving(true);
    try {
      const toSave = records
        .filter(r => changedDates.has(r.date))
        .map(r => ({
          date: r.date,
          status: r.status,
          notes: r.notes || '',
          leave_source: r.status === 'leave' ? (r.leave_source || null) : null,
        }));
      await api.post('/attendance/bulk-save', {
        employee_id: employeeId,
        year, month,
        records: toSave,
      });
      toast.success('Attendance saved!');
      setChangedDates(new Set());
      await Promise.all([loadAttendance(), loadCfPools()]);
    } catch (err) {
      toast.error('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const prevMonth = () => {
    if (isAtMin) return;
    if (month === 1) { setMonth(12); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (isAtMax) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  };

  const dirty = changedDates.size > 0;

  // Sum of present days in all months BEFORE the currently viewed month (for cross-month counter)
  const priorPresentDays = cfMonthlyPresent
    .filter(m => m.year < year || (m.year === year && m.month < month))
    .reduce((sum, m) => sum + m.presentDays, 0);

  // Compute real-time pool availability = saved pools minus any unsaved leave_source usages
  const unsavedUsages = records
    .filter(r => changedDates.has(r.date) && r.status === 'leave' && r.leave_source && r.leave_source !== 'unpaid')
    .reduce((acc, r) => { acc[r.leave_source] = (acc[r.leave_source] || 0) + 1; return acc; }, {});

  const currentPools = cfPools.map(pool => ({
    ...pool,
    available: pool.available - (unsavedUsages[pool.key] || 0),
  }));
  const cfPoolsTotal = currentPools.reduce((s, p) => s + Math.max(0, p.available), 0);

  const stats = calculateMonthlyStats(records, daysInMonth);
  const leavesWithSource = records.filter(r => r.status === 'leave' && r.leave_source && r.leave_source !== 'unpaid').length;
  const salaryDeductDays = Math.max(0, stats.leaveDays - leavesWithSource);

  return (
    <div className="space-y-5">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            disabled={isAtMin}
            className={`p-2 rounded-lg transition-colors ${isAtMin ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100'}`}
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <h2 className="font-display text-xl font-bold text-slate-900 min-w-44 text-center">
            {getMonthName(month)} {year}
          </h2>
          <button
            onClick={nextMonth}
            disabled={isAtMax}
            className={`p-2 rounded-lg transition-colors ${isAtMax ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100'}`}
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAttendance} className="btn-secondary flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          {dirty && (
            <button onClick={saveAll} disabled={saving} className="btn-primary flex items-center gap-1.5">
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Days', val: stats.totalDays, cls: 'bg-slate-100 text-slate-800' },
          { label: 'Sundays', val: stats.sundays, cls: 'bg-yellow-100 text-yellow-800' },
          { label: 'Sat (Leave)', val: stats.satLeave, cls: 'bg-yellow-100 text-yellow-800' },
          { label: 'Present', val: stats.presentDays, cls: 'bg-green-100 text-green-800' },
          { label: 'Leave', val: stats.leaveDays, cls: 'bg-red-100 text-red-800' },
          { label: 'EL Earned', val: stats.elEarned, cls: 'bg-purple-100 text-purple-800' },
        ].map(({ label, val, cls }) => (
          <div key={label} className={`${cls} rounded-xl p-3 text-center`}>
            <div className="text-2xl font-display font-bold">{val}</div>
            <div className="text-xs font-medium mt-0.5 opacity-75">{label}</div>
          </div>
        ))}
      </div>

      {/* CF Pool breakdown card */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Carry Forward Available</span>
          <span className="text-2xl font-display font-bold text-blue-800">{cfPoolsTotal} days</span>
        </div>
        {currentPools.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {currentPools.map(pool => (
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
        ) : (
          <p className="text-xs text-blue-500">No carry forward pools yet. Earn EL by working 20+ days in a month.</p>
        )}
      </div>

      {/* Formula display */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-mono">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-slate-700">
          <div><span className="text-slate-400">Total day:</span> {daysInMonth} - ({stats.sundays} + {stats.satLeave}) = <strong>{daysInMonth - stats.sundays - stats.satLeave}</strong></div>
          <div><span className="text-slate-400">Present day:</span> <strong>{stats.presentDays}</strong></div>
          <div><span className="text-slate-400">EL (1 per 20):</span> <strong className="text-purple-700">+{stats.elEarned}</strong></div>
          <div className={salaryDeductDays > 0 ? 'text-red-600' : 'text-green-600'}>
            <span className="text-slate-400">Salary deduct:</span> <strong>{salaryDeductDays} day{salaryDeductDays !== 1 ? 's' : ''}</strong>
          </div>
        </div>
        {stats.leaveDays > 0 && (
          <div className="mt-2 pt-2 border-t border-slate-200 text-slate-600">
            Leave: {stats.leaveDays} day{stats.leaveDays > 1 ? 's' : ''} taken
            {leavesWithSource > 0 && <span className="text-blue-600"> → {leavesWithSource} covered by carry forward</span>}
            {salaryDeductDays > 0 && <span className="text-red-600"> → {salaryDeductDays} to deduct from salary</span>}
          </div>
        )}
      </div>

      {/* Attendance grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading...
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-3 py-3 text-left font-semibold text-slate-600 w-24">Date</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600 w-16">Day</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600">Status</th>
                <th className="px-3 py-3 text-left font-semibold text-slate-600 w-12 text-center">#</th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec, idx) => {
                const isFuture = rec.date > todayStr;
                const availableStatuses = getAvailableStatuses(rec.date);
                const isReadOnly = isFuture || rec.status === 'sunday' || availableStatuses.length === 1;
                const monthPresentCount = records.slice(0, idx + 1).filter(r =>
                  ['present', 'saturday_working', 'work_on_holiday'].includes(r.status)
                ).length;
                // Rolling count from March 2026 start — continues across month boundaries
                const totalPresentCount = priorPresentDays + monthPresentCount;
                const cycleCount = totalPresentCount % 20 === 0 ? 20 : totalPresentCount % 20;
                const isElMilestone = !isFuture && totalPresentCount > 0 && totalPresentCount % 20 === 0 &&
                  ['present', 'saturday_working', 'work_on_holiday'].includes(rec.status);

                // Pools available for this row's leave source picker (exclude already-used ones except self)
                const selfUsage = rec.status === 'leave' && rec.leave_source && rec.leave_source !== 'unpaid' ? 1 : 0;
                const poolsForRow = currentPools.map(p => ({
                  ...p,
                  available: p.available + (rec.leave_source === p.key ? selfUsage : 0),
                }));

                return (
                  <tr key={rec.date}
                    className={`border-b border-gray-50 transition-colors ${
                      isFuture ? 'opacity-40 bg-gray-50/60' :
                      rec.status === 'sunday' || rec.status === 'saturday_leave' ? 'bg-yellow-50/40' :
                      rec.status === 'leave' ? 'bg-red-50/40' :
                      rec.status === 'holiday' ? 'bg-purple-50/40' :
                      isElMilestone ? 'bg-green-50/40' : 'hover:bg-gray-50'
                    }`}>
                    <td className="px-3 py-2 font-mono text-slate-600 text-xs">
                      {rec.date}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-semibold ${
                        rec.dayName === 'Sun' ? 'text-red-500' :
                        rec.dayName === 'Sat' ? 'text-amber-600' : 'text-slate-500'
                      }`}>{rec.dayName}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        {/* Status selector */}
                        {isReadOnly ? (
                          <StatusBadge status={rec.status} />
                        ) : (
                          <select
                            value={rec.status}
                            onChange={e => updateStatus(rec.date, e.target.value)}
                            className={`text-xs border rounded-lg px-2 py-1 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer ${
                              STATUS_CONFIG[rec.status]?.color || ''
                            }`}
                          >
                            {availableStatuses.map(s => (
                              <option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
                            ))}
                          </select>
                        )}

                        {/* Leave source picker — shown only when status = leave and editable */}
                        {!isReadOnly && rec.status === 'leave' && (
                          <select
                            value={rec.leave_source || ''}
                            onChange={e => updateLeaveSource(rec.date, e.target.value || null)}
                            className={`text-xs border rounded-lg px-2 py-1 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer ${
                              rec.leave_source
                                ? 'bg-blue-50 text-blue-800 border-blue-300'
                                : 'bg-orange-50 text-orange-700 border-orange-300'
                            }`}
                          >
                            <option value="">— Select leave type —</option>
                            {poolsForRow.map(pool => (
                              <option
                                key={pool.key}
                                value={pool.key}
                                disabled={pool.available <= 0 && rec.leave_source !== pool.key}
                              >
                                {pool.label} ({Math.max(0, pool.available)} avail)
                              </option>
                            ))}
                            <option value="unpaid">Unpaid Leave</option>
                          </select>
                        )}

                        {/* Show saved leave source as badge (read-only) */}
                        {isReadOnly && rec.status === 'leave' && rec.leave_source && (
                          <span className="text-xs text-blue-600 font-medium bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 w-fit">
                            {rec.leave_source === 'unpaid'
                              ? 'Unpaid'
                              : currentPools.find(p => p.key === rec.leave_source)?.label || rec.leave_source}
                          </span>
                        )}

                        {isElMilestone && (
                          <span className="text-xs text-green-600 font-semibold bg-green-100 px-2 py-0.5 rounded-full w-fit">
                            +1 EL earned
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {!isFuture && ['present', 'saturday_working', 'work_on_holiday'].includes(rec.status) && (
                        <span className={`text-xs font-mono ${isElMilestone ? 'text-green-600 font-bold' : 'text-slate-500'}`}>
                          {cycleCount}
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

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <span key={key} className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${cfg.color}`}>
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        ))}
      </div>
    </div>
  );
}

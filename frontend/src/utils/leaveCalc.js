// Parse date string as local midnight to avoid UTC timezone shift
function parseLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Get day type for a given date
export function getDayType(dateStr) {
  const date = parseLocalDate(dateStr);
  const day = date.getDay(); // 0=Sun, 6=Sat
  if (day === 0) return 'sunday';
  if (day === 6) {
    const satNum = getSaturdayNumber(dateStr);
    if (satNum === 1 || satNum === 3) return 'saturday_leave';
    return 'saturday_working';
  }
  return 'weekday';
}

// Get nth Saturday number in month
export function getSaturdayNumber(dateStr) {
  const date = parseLocalDate(dateStr);
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  return Math.ceil((date.getDate() + firstDay.getDay()) / 7);
}

export const STATUS_CONFIG = {
  present:          { label: 'Present',           color: 'bg-green-100 text-green-800 border-green-200',  dot: 'bg-green-500',  short: 'P' },
  sunday:           { label: 'Sunday',            color: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-400', short: 'S' },
  saturday_leave:   { label: 'Saturday (Leave)',  color: 'bg-yellow-100 text-yellow-800 border-yellow-200', dot: 'bg-yellow-400', short: 'SL' },
  saturday_working: { label: 'Saturday (Work)',   color: 'bg-blue-100 text-blue-800 border-blue-200',     dot: 'bg-blue-400',   short: 'SW' },
  leave:            { label: 'Leave',             color: 'bg-red-100 text-red-800 border-red-200',        dot: 'bg-red-500',    short: 'L' },
  holiday:          { label: 'Holiday',           color: 'bg-purple-100 text-purple-800 border-purple-200', dot: 'bg-purple-400', short: 'H' },
  work_on_holiday:  { label: 'Work on Holiday',   color: 'bg-pink-100 text-pink-800 border-pink-200',     dot: 'bg-pink-500',   short: 'WH' },
  absent:           { label: 'Absent',            color: 'bg-gray-100 text-gray-800 border-gray-200',     dot: 'bg-gray-400',   short: 'A' },
};

// What options can a user select for a given day
export function getAvailableStatuses(dateStr) {
  const type = getDayType(dateStr);
  if (type === 'sunday') {
    return ['sunday'];
  }
  if (type === 'saturday_leave') {
    return ['saturday_leave', 'saturday_working', 'work_on_holiday'];
  }
  if (type === 'saturday_working') {
    return ['saturday_working', 'saturday_leave', 'work_on_holiday', 'leave'];
  }
  // weekday
  return ['present', 'leave', 'holiday', 'work_on_holiday', 'absent'];
}

// Calculate monthly stats from records array
export function calculateMonthlyStats(records, daysInMonth) {
  let sundays = 0, satLeave = 0, satWorking = 0, presentDays = 0;
  let leaveDays = 0, workOnHoliday = 0, holidays = 0;

  for (const rec of records) {
    const s = rec.status;
    if (s === 'sunday') sundays++;
    else if (s === 'saturday_leave') satLeave++;
    else if (s === 'saturday_working') { satWorking++; presentDays++; }
    else if (s === 'present') presentDays++;
    else if (s === 'leave') leaveDays++;
    else if (s === 'work_on_holiday') { workOnHoliday++; presentDays++; }
    else if (s === 'holiday') holidays++;
  }

  const elEarned = Math.floor(presentDays / 20);
  const offDays = sundays + satLeave + holidays;
  const totalWorkingDays = daysInMonth - offDays;

  return {
    totalDays: daysInMonth,
    sundays,
    satLeave,
    satWorking,
    presentDays,
    leaveDays,
    workOnHoliday,
    holidays,
    elEarned,
    totalWorkingDays,
  };
}

export function getMonthName(month) {
  return new Date(2024, month - 1).toLocaleString('default', { month: 'long' });
}

export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

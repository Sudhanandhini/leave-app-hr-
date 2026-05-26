const express = require('express');
const db = require('../config/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const router = express.Router();

// Helper: Get day type for a date
function getDayType(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay(); // 0=Sun, 6=Sat
  if (day === 0) return 'sunday';
  if (day === 6) {
    // Get week number within the month
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const saturdayCount = Math.ceil((date.getDate() + firstDay.getDay()) / 7);
    // 1st and 3rd Saturday = leave, 2nd, 4th, 5th = working
    if (saturdayCount === 1 || saturdayCount === 3) return 'saturday_leave';
    return 'saturday_working';
  }
  return 'weekday';
}

// Helper: Get nth Saturday of month
function getSaturdayNumber(dateStr) {
  const date = new Date(dateStr);
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  return Math.ceil((date.getDate() + firstDay.getDay()) / 7);
}

// Get attendance for employee for a month
router.get('/month/:employeeId/:year/:month', authMiddleware, async (req, res) => {
  const { employeeId, year, month } = req.params;
  
  // Only allow own data unless admin
  if (req.user.role !== 'admin' && req.user.id != employeeId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const [employee] = await db.query('SELECT * FROM employees WHERE id = ?', [employeeId]);
    if (!employee.length) return res.status(404).json({ error: 'Employee not found' });

    const daysInMonth = new Date(year, month, 0).getDate();
    const records = [];

    // Get existing attendance records
    const [existing] = await db.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND YEAR(date) = ? AND MONTH(date) = ? ORDER BY date',
      [employeeId, year, month]
    );
    const existingMap = {};
    existing.forEach(r => { existingMap[r.date.toISOString().split('T')[0]] = r; });

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const defaultType = getDayType(dateStr);
      const satNum = getDayType(dateStr) === 'saturday_leave' || getDayType(dateStr) === 'saturday_working'
        ? getSaturdayNumber(dateStr) : null;

      let record = existingMap[dateStr];
      if (!record) {
        record = {
          date: dateStr,
          status: defaultType === 'weekday' ? 'present' : defaultType,
          el_earned: 0,
          notes: '',
          isDefault: true,
          saturdayNumber: satNum
        };
      } else {
        record.date = dateStr;
        record.isDefault = false;
        record.saturdayNumber = satNum;
      }
      records.push(record);
    }

    res.json({ records, employee: employee[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save/update single attendance record
router.post('/save', authMiddleware, async (req, res) => {
  const { employee_id, date, status, notes } = req.body;

  if (req.user.role !== 'admin' && req.user.id != employee_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    // Check if record exists
    const [existing] = await db.query(
      'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
      [employee_id, date]
    );

    if (existing.length) {
      await db.query(
        'UPDATE attendance SET status = ?, notes = ?, updated_at = NOW() WHERE employee_id = ? AND date = ?',
        [status, notes || '', employee_id, date]
      );
    } else {
      await db.query(
        'INSERT INTO attendance (employee_id, date, status, notes) VALUES (?, ?, ?, ?)',
        [employee_id, date, status, notes || '']
      );
    }

    // Recalculate monthly summary
    await recalculateMonthlySummary(employee_id, new Date(date).getFullYear(), new Date(date).getMonth() + 1);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bulk save attendance for a month
router.post('/bulk-save', authMiddleware, async (req, res) => {
  const { employee_id, year, month, records } = req.body;

  if (req.user.role !== 'admin' && req.user.id != employee_id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    for (const record of records) {
      const [existing] = await conn.query(
        'SELECT id FROM attendance WHERE employee_id = ? AND date = ?',
        [employee_id, record.date]
      );
      if (existing.length) {
        await conn.query(
          'UPDATE attendance SET status = ?, notes = ? WHERE employee_id = ? AND date = ?',
          [record.status, record.notes || '', employee_id, record.date]
        );
      } else {
        await conn.query(
          'INSERT INTO attendance (employee_id, date, status, notes) VALUES (?, ?, ?, ?)',
          [employee_id, record.date, record.status, record.notes || '']
        );
      }
    }

    await conn.commit();
    conn.release();

    // Recalculate monthly summary
    const summary = await recalculateMonthlySummary(employee_id, year, month);
    res.json({ success: true, summary });
  } catch (err) {
    await conn.rollback();
    conn.release();
    res.status(500).json({ error: err.message });
  }
});

// Get monthly summary
router.get('/summary/:employeeId/:year/:month', authMiddleware, async (req, res) => {
  const { employeeId, year, month } = req.params;

  if (req.user.role !== 'admin' && req.user.id != employeeId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const summary = await recalculateMonthlySummary(employeeId, year, month);
    const [emp] = await db.query('SELECT carry_forward FROM employees WHERE id = ?', [employeeId]);
    res.json({ ...summary, carry_forward: emp[0]?.carry_forward || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: get all employees attendance summary for a month
router.get('/admin/monthly/:year/:month', authMiddleware, adminMiddleware, async (req, res) => {
  const { year, month } = req.params;
  try {
    const [employees] = await db.query('SELECT * FROM employees WHERE role = "employee"');
    const summaries = [];
    for (const emp of employees) {
      const summary = await recalculateMonthlySummary(emp.id, year, month);
      summaries.push({ employee: emp, summary });
    }
    res.json(summaries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Helper: Calculate monthly summary with EL logic
async function recalculateMonthlySummary(employeeId, year, month) {
  const daysInMonth = new Date(year, month, 0).getDate();
  
  const [records] = await db.query(
    'SELECT * FROM attendance WHERE employee_id = ? AND YEAR(date) = ? AND MONTH(date) = ?',
    [employeeId, year, month]
  );
  
  const recordMap = {};
  records.forEach(r => { recordMap[r.date.toISOString().split('T')[0]] = r.status; });

  let totalDays = daysInMonth;
  let sundays = 0, satLeave = 0, satWorking = 0, presentDays = 0;
  let leaveDays = 0, workOnHoliday = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const defaultType = getDayType(dateStr);
    const status = recordMap[dateStr] || (defaultType === 'weekday' ? 'present' : defaultType);

    if (status === 'sunday') sundays++;
    else if (status === 'saturday_leave') satLeave++;
    else if (status === 'saturday_working') { satWorking++; presentDays++; }
    else if (status === 'present') presentDays++;
    else if (status === 'leave') leaveDays++;
    else if (status === 'work_on_holiday') { workOnHoliday++; presentDays++; }
    else if (status === 'holiday') {} // public holiday, not counted
    else if (status === 'absent') {} // absent without leave
  }

  // EL calculation: 1 EL per 20 working days
  const elEarned = Math.floor(presentDays / 20);

  // Get employee carry forward
  const [emp] = await db.query('SELECT carry_forward FROM employees WHERE id = ?', [employeeId]);
  let carryForward = emp[0]?.carry_forward || 0;

  // Deduct leave days from carry forward
  let cfUsed = 0;
  if (leaveDays > 0 && carryForward > 0) {
    cfUsed = Math.min(leaveDays, carryForward);
  }

  // Save/update monthly summary
  const [existing] = await db.query(
    'SELECT id FROM monthly_summary WHERE employee_id = ? AND year = ? AND month = ?',
    [employeeId, year, month]
  );

  const summaryData = {
    total_days: totalDays,
    sundays,
    saturdays_leave: satLeave,
    saturdays_working: satWorking,
    present_days: presentDays,
    leave_days: leaveDays,
    work_on_holiday: workOnHoliday,
    el_earned: elEarned,
    carry_forward_used: cfUsed,
    carry_forward_remaining: carryForward - cfUsed + elEarned
  };

  if (existing.length) {
    await db.query('UPDATE monthly_summary SET ? WHERE employee_id = ? AND year = ? AND month = ?',
      [summaryData, employeeId, year, month]);
  } else {
    await db.query('INSERT INTO monthly_summary SET ?',
      { ...summaryData, employee_id: employeeId, year, month });
  }

  return summaryData;
}

module.exports = router;

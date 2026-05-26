const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');
const router = express.Router();

// Get all employees (admin)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, email, role, department, joining_date, carry_forward, salary, created_at FROM employees ORDER BY name');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single employee
router.get('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.id != req.params.id) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const [rows] = await db.query('SELECT id, name, email, role, department, joining_date, carry_forward, salary FROM employees WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create employee (admin)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, email, password, department, joining_date, carry_forward, salary } = req.body;
  try {
    const hashed = await bcrypt.hash(password || 'password123', 10);
    const [result] = await db.query(
      'INSERT INTO employees (name, email, password, role, department, joining_date, carry_forward, salary) VALUES (?, ?, ?, "employee", ?, ?, ?, ?)',
      [name, email, hashed, department || '', joining_date || new Date(), carry_forward || 0, salary || 0]
    );
    res.json({ id: result.insertId, name, email, department, carry_forward: carry_forward || 0, salary: salary || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update employee
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  const { name, email, department, joining_date, carry_forward, salary } = req.body;
  try {
    await db.query(
      'UPDATE employees SET name=?, email=?, department=?, joining_date=?, carry_forward=?, salary=? WHERE id=?',
      [name, email, department, joining_date, carry_forward, salary || 0, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update carry forward (admin)
router.patch('/:id/carry-forward', authMiddleware, adminMiddleware, async (req, res) => {
  const { carry_forward } = req.body;
  try {
    await db.query('UPDATE employees SET carry_forward = ? WHERE id = ?', [carry_forward, req.params.id]);
    res.json({ success: true, carry_forward });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete employee (admin)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await db.query('DELETE FROM employees WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

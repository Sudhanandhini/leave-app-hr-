-- Leave Management System Database Schema

CREATE DATABASE IF NOT EXISTS leave_management;
USE leave_management;

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'employee') DEFAULT 'employee',
  department VARCHAR(100),
  joining_date DATE,
  carry_forward DECIMAL(5,1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Attendance records table
CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  date DATE NOT NULL,
  status ENUM('present', 'sunday', 'saturday_leave', 'saturday_working', 'holiday', 'work_on_holiday', 'leave', 'absent') NOT NULL,
  el_earned DECIMAL(3,1) DEFAULT 0,
  notes VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY unique_attendance (employee_id, date)
);

-- Monthly summary table
CREATE TABLE IF NOT EXISTS monthly_summary (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  total_days INT DEFAULT 0,
  sundays INT DEFAULT 0,
  saturdays_leave INT DEFAULT 0,
  saturdays_working INT DEFAULT 0,
  present_days INT DEFAULT 0,
  leave_days INT DEFAULT 0,
  work_on_holiday INT DEFAULT 0,
  el_earned DECIMAL(5,1) DEFAULT 0,
  carry_forward_used DECIMAL(5,1) DEFAULT 0,
  carry_forward_remaining DECIMAL(5,1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  UNIQUE KEY unique_monthly (employee_id, year, month)
);

-- Leave requests table
CREATE TABLE IF NOT EXISTS leave_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  date DATE NOT NULL,
  leave_type ENUM('el', 'casual', 'sick', 'unpaid') DEFAULT 'el',
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  reason VARCHAR(500),
  approved_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Insert default admin
INSERT IGNORE INTO employees (name, email, password, role, department, joining_date) 
VALUES ('Admin', 'admin@company.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'Management', '2024-01-01');
-- Default password: password

-- Insert sample employees
INSERT IGNORE INTO employees (name, email, password, role, department, joining_date, carry_forward) VALUES
('Rajesh Kumar', 'rajesh@company.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'employee', 'IT', '2024-01-15', 3),
('Priya Sharma', 'priya@company.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'employee', 'HR', '2024-02-01', 1),
('Amit Singh', 'amit@company.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'employee', 'Finance', '2024-03-10', 2);

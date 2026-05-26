import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export default function AdminEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '', joining_date: '', carry_forward: 0 });

  useEffect(() => { loadEmployees(); }, []);

  const loadEmployees = async () => {
    try {
      const res = await api.get('/employees');
      setEmployees(res.data.filter(e => e.role === 'employee'));
    } catch {}
    setLoading(false);
  };

  const handleAdd = async () => {
    try {
      await api.post('/employees', form);
      toast.success('Employee added!');
      setShowAdd(false);
      setForm({ name: '', email: '', password: '', department: '', joining_date: '', carry_forward: 0 });
      loadEmployees();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleEdit = async () => {
    try {
      await api.put(`/employees/${editEmp.id}`, form);
      toast.success('Updated!');
      setEditEmp(null);
      loadEmployees();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this employee?')) return;
    try {
      await api.delete(`/employees/${id}`);
      toast.success('Deleted');
      loadEmployees();
    } catch {
      toast.error('Failed');
    }
  };

  const openEdit = (emp) => {
    setEditEmp(emp);
    setForm({
      name: emp.name, email: emp.email, password: '',
      department: emp.department || '', joining_date: emp.joining_date?.split('T')[0] || '',
      carry_forward: emp.carry_forward || 0
    });
  };

  const updateCF = async (id, val) => {
    try {
      await api.patch(`/employees/${id}/carry-forward`, { carry_forward: val });
      toast.success('Carry forward updated!');
      loadEmployees();
    } catch {
      toast.error('Failed');
    }
  };

  const FormFields = () => (
    <div className="space-y-4">
      {[
        { label: 'Full Name', key: 'name', type: 'text', required: true },
        { label: 'Email', key: 'email', type: 'email', required: true },
        { label: 'Password', key: 'password', type: 'password', placeholder: editEmp ? 'Leave blank to keep' : '' },
        { label: 'Department', key: 'department', type: 'text' },
        { label: 'Joining Date', key: 'joining_date', type: 'date' },
        { label: 'Carry Forward Days', key: 'carry_forward', type: 'number' },
      ].map(({ label, key, type, required, placeholder }) => (
        <div key={key}>
          <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
          <input
            type={type}
            value={form[key]}
            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
            required={required}
            placeholder={placeholder}
            className="input-field"
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">Employees</h1>
          <p className="text-slate-500 text-sm">{employees.length} employees</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Employee</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Department</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600">Joining Date</th>
                <th className="px-4 py-3 text-center font-semibold text-slate-600">Carry Forward</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
                        {emp.name?.charAt(0)}
                      </div>
                      <div>
                        <div className="font-medium text-slate-800">{emp.name}</div>
                        <div className="text-xs text-slate-400">{emp.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{emp.department || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{emp.joining_date?.split('T')[0] || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <CFEditor value={emp.carry_forward || 0} onSave={val => updateCF(emp.id, val)} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(emp)}
                        className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(emp.id)}
                        className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <Modal title="Add Employee" onClose={() => setShowAdd(false)}>
          <FormFields />
          <div className="flex gap-2 mt-6">
            <button onClick={handleAdd} className="btn-primary flex-1">Add Employee</button>
            <button onClick={() => setShowAdd(false)} className="btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}

      {editEmp && (
        <Modal title={`Edit — ${editEmp.name}`} onClose={() => setEditEmp(null)}>
          <FormFields />
          <div className="flex gap-2 mt-6">
            <button onClick={handleEdit} className="btn-primary flex-1">Save Changes</button>
            <button onClick={() => setEditEmp(null)} className="btn-secondary">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CFEditor({ value, onSave }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);

  if (!editing) return (
    <span
      onClick={() => { setVal(value); setEditing(true); }}
      className="inline-flex items-center justify-center w-10 h-8 bg-blue-100 text-blue-700 rounded-lg font-mono font-semibold cursor-pointer hover:bg-blue-200 transition-colors"
    >{value}</span>
  );

  return (
    <span className="inline-flex items-center gap-1">
      <input type="number" value={val} onChange={e => setVal(e.target.value)}
        className="w-14 border border-blue-300 rounded-lg px-1.5 py-1 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-blue-400" />
      <button onClick={() => { onSave(val); setEditing(false); }} className="text-green-600 hover:text-green-800">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600">
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

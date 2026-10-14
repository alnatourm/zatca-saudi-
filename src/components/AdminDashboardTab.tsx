import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Users, Package, CheckCircle, XCircle, Clock, Building, AlertTriangle, Key, Eye, EyeOff, Edit3, Save, X, Plus } from 'lucide-react';

interface AdminDashboardTabProps {
  lang: 'ar' | 'en';
  onUserStatusUpdated: () => void;
}

export const AdminDashboardTab: React.FC<AdminDashboardTabProps> = ({ lang }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Password update modal state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  // Package edit state
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [pkgForm, setPkgForm] = useState({
    id: '',
    name: '',
    nameAr: '',
    priceSAR: 0,
    maxUsers: 1,
    maxCompanies: 1,
    description: '',
  });

  const fetchAdminData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/admin/users');
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to fetch users');
      setUsers(data.users);
      setPackages(data.packages);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const handleUpdateStatus = async (userId: string, status: 'approved' | 'blocked' | 'pending') => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to update user status');
      setSuccessMsg(lang === 'ar' ? 'تم تحديث حالة المستخدم بنجاح' : 'User status updated successfully');
      fetchAdminData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleAssignPackage = async (userId: string, packageId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to assign package');
      setSuccessMsg(lang === 'ar' ? 'تم تعيين الباقة بنجاح' : 'Package assigned successfully');
      fetchAdminData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleUpdatePassword = async (userId: string) => {
    if (!newPassword || newPassword.length < 3) {
      setErrorMsg(lang === 'ar' ? 'كلمة المرور يجب أن تكون 3 أحرف على الأقل' : 'Password must be at least 3 characters');
      return;
    }
    try {
      const res = await fetch(`/api/admin/users/${userId}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to update password');
      setSuccessMsg(lang === 'ar' ? 'تم تحديث كلمة المرور بنجاح' : 'Password updated successfully');
      setEditingUserId(null);
      setNewPassword('');
      fetchAdminData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleSavePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pkgForm),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save package');
      setSuccessMsg(lang === 'ar' ? 'تم حفظ تفاصيل الباقة بنجاح' : 'Package saved successfully');
      setEditingPackageId(null);
      fetchAdminData();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const startEditPackage = (pkg: any) => {
    setEditingPackageId(pkg.id);
    setPkgForm({
      id: pkg.id,
      name: pkg.name || '',
      nameAr: pkg.nameAr || '',
      priceSAR: Number(pkg.priceSAR) || 0,
      maxUsers: Number(pkg.maxUsers) || 1,
      maxCompanies: Number(pkg.maxCompanies) || 1,
      description: pkg.description || '',
    });
  };

  const startNewPackage = () => {
    const newId = `pkg-${Date.now()}`;
    setEditingPackageId(newId);
    setPkgForm({
      id: newId,
      name: 'New Package',
      nameAr: 'باقة جديدة',
      priceSAR: 299,
      maxUsers: 2,
      maxCompanies: 2,
      description: 'وصف الباقة الجديدة',
    });
  };

  const toggleShowPassword = (userId: string) => {
    setShowPassword((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 mb-1">
            <Shield className="w-5 h-5" />
            <span className="text-xs font-mono uppercase tracking-wider">
              {lang === 'ar' ? 'لوحة تحكم المسؤول (Admin Control Panel)' : 'System Administrator Control Panel'}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100">
            {lang === 'ar' ? 'إدارة المستخدمين والباقات والصلاحيات الكاملة' : 'Complete User Management, Packages & Permissions'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {lang === 'ar'
              ? 'التحكم الكامل بالحسابات، تفعيل/حظر المستخدمين، تعديل كلمات المرور، وتعديل باقات الاشتراك والأسعار.'
              : 'Full control over accounts, enable/block users, update passwords, and edit subscription plans & pricing.'}
          </p>
        </div>
        <button
          onClick={fetchAdminData}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition border border-slate-700"
        >
          {lang === 'ar' ? 'تحديث البيانات' : 'Refresh Data'}
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-950/80 border border-red-800 rounded-xl text-red-200 text-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-800 rounded-xl text-emerald-200 text-sm flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100">{users.length}</div>
            <div className="text-xs text-slate-400">{lang === 'ar' ? 'إجمالي المستخدمين' : 'Total Users'}</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100">
              {users.filter((u) => u.status === 'pending').length}
            </div>
            <div className="text-xs text-slate-400">{lang === 'ar' ? 'في انتظار الموافقة والتفعيل' : 'Pending Approval'}</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center text-purple-400">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold text-slate-100">{packages.length}</div>
            <div className="text-xs text-slate-400">{lang === 'ar' ? 'باقات الاشتراك المتاحة' : 'Active Subscription Packages'}</div>
          </div>
        </div>
      </div>

      {/* Users Management Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-emerald-400" />
          <span>{lang === 'ar' ? 'إدارة حسابات المستخدمين الكاملة (User Accounts Management)' : 'Detailed User Accounts Management'}</span>
        </h2>

        {loading ? (
          <div className="text-center py-8 text-slate-400 text-sm">{lang === 'ar' ? 'جاري التحميل...' : 'Loading...'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs text-slate-400 font-mono uppercase">
                  <th className="py-3 px-4">{lang === 'ar' ? 'المستخدم والشركة' : 'User & Company'}</th>
                  <th className="py-3 px-4">{lang === 'ar' ? 'البريد الإلكتروني' : 'Email'}</th>
                  <th className="py-3 px-4">{lang === 'ar' ? 'كلمة المرور' : 'Password'}</th>
                  <th className="py-3 px-4">{lang === 'ar' ? 'الحالة والصلاحية' : 'Status'}</th>
                  <th className="py-3 px-4">{lang === 'ar' ? 'الباقة والشركات' : 'Package & Quota'}</th>
                  <th className="py-3 px-4 text-right">{lang === 'ar' ? 'إدارة الحساب' : 'Actions & Controls'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm">
                {users.map((u) => {
                  const isEditingPass = editingUserId === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-100 flex items-center gap-2">
                          <span>{u.fullName || u.name || 'N/A'}</span>
                          {u.role === 'admin' && (
                            <span className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 rounded text-[10px] font-mono">
                              Admin
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <Building className="w-3 h-3" />
                          <span>{u.companyName || 'Independent'}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1 font-mono">
                          ID: {u.id} | {lang === 'ar' ? 'انضم في:' : 'Joined:'} {new Date(u.createdAt || Date.now()).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-xs font-mono text-slate-300">{u.email}</td>

                      <td className="py-3 px-4">
                        {isEditingPass ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder={lang === 'ar' ? 'كلمة المرور الجديدة' : 'New password'}
                              className="w-32 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                            />
                            <button
                              onClick={() => handleUpdatePassword(u.id)}
                              className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs"
                              title={lang === 'ar' ? 'حفظ' : 'Save'}
                            >
                              <Save className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setEditingUserId(null); setNewPassword(''); }}
                              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                              title={lang === 'ar' ? 'إلغاء' : 'Cancel'}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-slate-300">
                              {showPassword[u.id] ? u.passwordHash : '••••••••'}
                            </span>
                            <button
                              onClick={() => toggleShowPassword(u.id)}
                              className="text-slate-500 hover:text-slate-300"
                              title={showPassword[u.id] ? 'Hide' : 'Show'}
                            >
                              {showPassword[u.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => { setEditingUserId(u.id); setNewPassword(u.passwordHash || ''); }}
                              className="text-emerald-400 hover:text-emerald-300 text-xs flex items-center gap-1 ml-1"
                              title={lang === 'ar' ? 'تعديل كلمة المرور' : 'Edit password'}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {(u.status === 'approved' || u.status === 'active') && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
                            <CheckCircle className="w-3 h-3" />
                            <span>{lang === 'ar' ? 'نشط ومعتمد' : 'Active / Approved'}</span>
                          </span>
                        )}
                        {u.status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-xs font-medium">
                            <Clock className="w-3 h-3" />
                            <span>{lang === 'ar' ? 'قيد المراجعة' : 'Pending'}</span>
                          </span>
                        )}
                        {u.status === 'blocked' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full text-xs font-medium">
                            <XCircle className="w-3 h-3" />
                            <span>{lang === 'ar' ? 'محظور' : 'Blocked'}</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <select
                          value={u.packageId || 'pkg-basic'}
                          onChange={(e) => handleAssignPackage(u.id, e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                        >
                          {packages.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nameAr || p.name} ({p.maxCompanies} {lang === 'ar' ? 'شركات' : 'companies'})
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {u.status !== 'approved' && u.status !== 'active' && (
                            <button
                              onClick={() => handleUpdateStatus(u.id, 'approved')}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition shadow"
                            >
                              {lang === 'ar' ? 'موافقة / تفعيل' : 'Approve'}
                            </button>
                          )}
                          {u.status !== 'blocked' && u.role !== 'admin' && (
                            <button
                              onClick={() => handleUpdateStatus(u.id, 'blocked')}
                              className="px-3 py-1 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800 rounded text-xs font-medium transition"
                            >
                              {lang === 'ar' ? 'حظر' : 'Block'}
                            </button>
                          )}
                          {u.status === 'blocked' && (
                            <button
                              onClick={() => handleUpdateStatus(u.id, 'approved')}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition"
                            >
                              {lang === 'ar' ? 'إلغاء الحظر' : 'Unblock'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Subscription Plans & Pricing (Editable by Admin) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-400" />
              <span>{lang === 'ar' ? 'باقات النظام والأسعار (إدارة الباقات)' : 'Subscription Plans & Pricing (Admin Editable)'}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {lang === 'ar' ? 'يمكنك تعديل أسعار الباقات وحدود المستخدمين والشركات أو إضافة باقات جديدة.' : 'You can edit package prices, user limits, and company quotas or add new packages.'}
            </p>
          </div>
          <button
            onClick={startNewPackage}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>{lang === 'ar' ? 'إضافة باقة جديدة' : 'Add New Package'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {packages.map((pkg) => {
            const isEditing = editingPackageId === pkg.id;
            return (
              <div key={pkg.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 relative flex flex-col justify-between">
                {isEditing ? (
                  <form onSubmit={handleSavePackage} className="space-y-3">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">{lang === 'ar' ? 'اسم الباقة (عربي)' : 'Package Name (Ar)'}</label>
                      <input
                        type="text"
                        value={pkgForm.nameAr}
                        onChange={(e) => setPkgForm({ ...pkgForm, nameAr: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">{lang === 'ar' ? 'اسم الباقة (إنجليزي)' : 'Package Name (En)'}</label>
                      <input
                        type="text"
                        value={pkgForm.name}
                        onChange={(e) => setPkgForm({ ...pkgForm, name: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">{lang === 'ar' ? 'السعر (ر.س)' : 'Price (SAR)'}</label>
                        <input
                          type="number"
                          value={pkgForm.priceSAR}
                          onChange={(e) => setPkgForm({ ...pkgForm, priceSAR: Number(e.target.value) })}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">{lang === 'ar' ? 'المستخدمين' : 'Users'}</label>
                        <input
                          type="number"
                          value={pkgForm.maxUsers}
                          onChange={(e) => setPkgForm({ ...pkgForm, maxUsers: Number(e.target.value) })}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 block mb-1">{lang === 'ar' ? 'الشركات' : 'Companies'}</label>
                        <input
                          type="number"
                          value={pkgForm.maxCompanies}
                          onChange={(e) => setPkgForm({ ...pkgForm, maxCompanies: Number(e.target.value) })}
                          className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-1">{lang === 'ar' ? 'الوصف' : 'Description'}</label>
                      <textarea
                        value={pkgForm.description}
                        onChange={(e) => setPkgForm({ ...pkgForm, description: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 h-16 resize-none"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingPackageId(null)}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs"
                      >
                        {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                      </button>
                      <button
                        type="submit"
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs flex items-center gap-1"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'حفظ' : 'Save'}</span>
                      </button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="text-base font-bold text-slate-100">{pkg.nameAr || pkg.name}</h3>
                          <div className="text-[10px] text-slate-500 font-mono">{pkg.name}</div>
                        </div>
                        <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono rounded-full font-bold">
                          {pkg.priceSAR} {lang === 'ar' ? 'ر.س' : 'SAR'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-4">{pkg.description}</p>
                      <div className="space-y-2 text-xs text-slate-300 mb-4">
                        <div className="flex justify-between">
                          <span className="text-slate-400">{lang === 'ar' ? 'حد المستخدمين:' : 'Users Limit:'}</span>
                          <span className="font-mono font-bold">{pkg.maxUsers}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">{lang === 'ar' ? 'حد الشركات:' : 'Companies Limit:'}</span>
                          <span className="font-mono font-bold">{pkg.maxCompanies}</span>
                        </div>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-slate-900 flex justify-end">
                      <button
                        onClick={() => startEditPackage(pkg)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-slate-800 rounded text-xs font-medium transition flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'تعديل الباقة' : 'Edit Package'}</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { db, auth } from '../config/firebase';
import ManageTasks from './ManageTasks';
import ExportReports from './ExportReports';

import {
  collection, addDoc, serverTimestamp, onSnapshot, query,
  updateDoc, doc, setDoc, deleteDoc, where
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import toast from "react-hot-toast";

export default function AdminDashboard() {
  const [task, setTask] = useState({ empName: '', title: '', email: '', desc: '', priority: 'Normal' });
  const [empCred, setEmpCred] = useState({ code: '', department: '', name: '', email: '', password: '' });
  const [tasksList, setTasksList] = useState([]);
  const [employeesList, setEmployeesList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  const [currentAdminUid, setCurrentAdminUid] = useState(null);
  const [adminProfile, setAdminProfile] = useState({ email: '', name: '' });

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setCurrentAdminUid(user.uid);
        setAdminProfile({
          email: user.email,
          name: user.displayName || user.email.split('@')[0]
        });
      } else {
        setCurrentAdminUid(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Tasks (🔥 FIX: Removed orderBy from query to prevent Firebase Index Error)
  useEffect(() => {
    if (!currentAdminUid) return; 

    const qArchive = query(
      collection(db, "archive_tasks"),
      where("createdBy", "==", currentAdminUid)
    );

    const unsub = onSnapshot(qArchive, (snapshot) => {
      let archivedTasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 🔥 FIX: Sorting is done in JavaScript now. New tasks will ALWAYS be on top!
      archivedTasks.sort((a, b) => {
        const timeA = a.assignedAt?.seconds || 0;
        const timeB = b.assignedAt?.seconds || 0;
        return timeB - timeA;
      });

      const qPending = query(
        collection(db, "tasks"),
        where("createdBy", "==", currentAdminUid)
      );

      onSnapshot(qPending, (pendingSnapshot) => {
        const pendingTasks = pendingSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        const finalTasks = archivedTasks.map(archiveTask => {
          const matchingPending = pendingTasks.find(p => p.email === archiveTask.email && p.title === archiveTask.title);
          return matchingPending ? { ...archiveTask, status: matchingPending.status, remarks: matchingPending.remarks } : archiveTask;
        });

        setTasksList(finalTasks);
      });
    });

    return () => unsub();
  }, [currentAdminUid]);

  // 3. Fetch Employees
  useEffect(() => {
    if (!currentAdminUid) return;
    const qEmployees = query(collection(db, "employees"), where("createdBy", "==", currentAdminUid));
    const unsub = onSnapshot(qEmployees, (snapshot) => {
      setEmployeesList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [currentAdminUid]);

  // 4. Assign Task
  const assignTask = async (e) => {
    e.preventDefault();
    if (!currentAdminUid) return toast.error("Admin verification pending! Please try again.");
    setLoading(true);
    
    try {
      const taskData = { ...task, status: 'Pending', assignedAt: serverTimestamp(), createdBy: currentAdminUid };
      const docRef = await addDoc(collection(db, "tasks"), taskData);
      
      await addDoc(collection(db, "archive_tasks"), {
        ...taskData, originalTaskId: docRef.id, archivedAt: serverTimestamp()
      });

      setTimeout(async () => {
        try { await deleteDoc(doc(db, "tasks", docRef.id)); } catch (err) {}
      }, 120000);

      setTask({ empName: '', title: '', email: '', desc: '', priority: 'Normal' });
      setLoading(false);
      setActiveTab('dashboard');
      toast.success("Task assigned successfully!");
    } catch (error) {
      toast.error("Failed to assign task.");
      setLoading(false);
    }
  };

  // 5. Create Employee
  const createEmployee = async (e) => {
    e.preventDefault();
    if (!currentAdminUid) return toast.error("Wait for Admin verification.");
    setLoading(true);
    const secondaryApp = initializeApp(auth.app.options, `Secondary-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, empCred.email, empCred.password);
      await setDoc(doc(db, "employees", userCredential.user.uid), {
        empCode: empCred.code, department: empCred.department, name: empCred.name, email: empCred.email, password: empCred.password, status: 'Active', createdAt: serverTimestamp(), createdBy: currentAdminUid, 
      });
      toast.success(`Account Created for ${empCred.name}!`);
      setEmpCred({ code: '', department: '', name: '', email: '', password: '' });
    } catch (error) {
      toast.error("Failed to create account. " + error.message);
    } finally {
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);
      setLoading(false);
    }
  };

  // 6. Create Admin
  const createAdmin = async (e, roleType) => {
    e.preventDefault();
    if (!currentAdminUid) return toast.error("Wait for Admin verification.");
    setLoading(true);
    const secondaryApp = initializeApp(auth.app.options, `Secondary-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, empCred.email, empCred.password);
      await setDoc(doc(db, "employees", userCredential.user.uid), {
        empCode: empCred.code, department: empCred.department, name: empCred.name, email: empCred.email, password: empCred.password, role: roleType, status: 'Active', createdAt: serverTimestamp(), createdBy: currentAdminUid, 
      });
      toast.success(`${roleType.toUpperCase()} Account Created!`);
      setEmpCred({ code: '', department: '', name: '', email: '', password: '' });
    } catch (error) {
      toast.error("Failed to create admin:" + error.message);
    } finally {
      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);
      setLoading(false);
    }
  };

  const toggleEmployeeStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Active' ? 'Disabled' : 'Active';
    if (window.confirm(`Are you sure you want to ${newStatus.toLowerCase()} this account?`)) {
      await updateDoc(doc(db, "employees", id), { status: newStatus });
    }
  };

  const resetPassword = async (id, empName) => {
    const newPassword = window.prompt(`Enter new password for ${empName}:`);
    if (newPassword && newPassword.trim() !== '') {
      await updateDoc(doc(db, "employees", id), { password: newPassword });
      toast.success(`Password reset successful!`);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    window.location.href = "/admin";
  };

  // Stats & Helpers
  const totalTasks = tasksList.length;
  const completedTasks = tasksList.filter(t => t.status === 'Completed').length;
  const pendingTasks = tasksList.filter(t => t.status === 'Pending').length;
  
  const filteredEmployees = employeesList.filter((emp) => {
    const queryStr = searchQuery.toLowerCase();
    return (emp.name?.toLowerCase().includes(queryStr) || emp.email?.toLowerCase().includes(queryStr) || emp.empCode?.toLowerCase().includes(queryStr));
  });

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-100 text-red-700 border-red-200';
      case 'High': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Low': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200';
    }
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans ">
      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-10">
        <a href="/" className="block cursor-pointer">
          <div className="p-6 text-2xl font-bold border-b border-slate-800 tracking-wider flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white text-lg">T</div>
            TaskMaster
          </div>
        </a>

        <nav className="flex-1 p-4 space-y-2">
          <div className="flex items-center gap-3 mb-2">
            <img src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${adminProfile.email || adminProfile.name || "guest"}`} alt="Admin" className="w-10 h-10 rounded-full"/>
            <div><p className="font-semibold">{adminProfile.email ? adminProfile.email.split('@')[0] : "Admin"}</p></div>
          </div>

          <button onClick={() => setActiveTab('dashboard')} className={`w-full text-left p-3 rounded-lg font-medium transition-all duration-300 ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'text-slate-300 hover:bg-blue-500/20 hover:text-blue-300'}`}>Dashboard Overview</button>
          <button onClick={() => setActiveTab('assignTask')} className={`w-full text-left p-3 rounded-lg font-medium transition-all duration-300 ${activeTab === 'assignTask' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'text-slate-300 hover:bg-blue-500/40 hover:text-blue-300'}`}>Assign New Task</button>
          <button onClick={() => setActiveTab('allTasks')} className={`w-full text-left p-3 rounded-lg font-medium transition-all duration-300 ${activeTab === 'allTasks' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'text-slate-300 hover:bg-blue-500/40 hover:text-blue-300'}`}>All Tasks</button>
          <button onClick={() => setActiveTab('delete-tasks')} className={`w-full text-left p-3 rounded-lg font-medium transition-all duration-300 ${activeTab === 'delete-tasks' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'text-slate-300 hover:bg-blue-500/40 hover:text-blue-300'}`}>Manage Tasks</button> 
          <button onClick={() => setActiveTab('settings')} className={`w-full text-left p-3 rounded-lg font-medium transition-all duration-300 ${activeTab === 'settings' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'text-slate-300 hover:bg-blue-500/40 hover:text-blue-300'}`}>Employee Accounts</button>

          <button onClick={() => setActiveTab('exportReports')} className={`w-full text-left p-3 rounded-lg font-medium transition-all duration-300 ${activeTab === 'exportReports' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : 'text-slate-300 hover:bg-blue-500/40 hover:text-blue-300'}`}>Export Reports</button>
  
          <button onClick={handleLogout} className="mt-auto w-full text-left p-3 text-red-400 text-sm font-semibold hover:bg-red-500 hover:text-white hover:shadow-lg hover:shadow-red-500/30 rounded-lg transition-all duration-300">Logout</button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-3 overflow-y-auto">
        <header className="mb-2 relative p-3 bg-white rounded-xl border border-gray-100 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(1,0,0,0.1)]">
          <h1 className="text-xl text-center font-bold text-gray-800">
            {activeTab === 'dashboard' && 'Admin Overview'}
            {activeTab === 'assignTask' && 'Assign a New Task'}
            {activeTab === 'allTasks' && 'All Assigned Tasks'}
            {activeTab === 'settings' && 'Manage Employee Accounts'}
            {activeTab === 'exportReports' && 'Export and Track Task'}
            {activeTab === 'delete-tasks' && 'Manage Task'}
          </h1>
          <p className="text-gray-500 text-center mt-0 font-bold bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 bg-clip-text text-transparent">Manage and track your organization's tasks efficiently.</p>
        </header>

        {activeTab === 'delete-tasks' && <ManageTasks />}
        
        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-3">
              <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500"><h3 className="text-gray-500 text-sm font-semibold uppercase">Total Tasks</h3><p className="text-3xl font-bold text-gray-800 mt-2">{totalTasks}</p></div>
              <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-yellow-500"><h3 className="text-gray-500 text-sm font-semibold uppercase">Pending</h3><p className="text-3xl font-bold text-gray-800 mt-2">{pendingTasks}</p></div>
              <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500"><h3 className="text-gray-500 text-sm font-semibold uppercase">Completed</h3><p className="text-3xl font-bold text-gray-800 mt-2">{completedTasks}</p></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-green-100 h-fit">
                <h2 className="text-xl font-bold mb-4 border-b pb-2">Quick Assign</h2>
                <form onSubmit={assignTask} className="space-y-4">
                  <input className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-400" placeholder="Employee Name" value={task.empName} onChange={(e) => setTask({ ...task, empName: e.target.value })} required />
                  <input type="email" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-400" placeholder="Email Address" value={task.email} onChange={(e) => setTask({ ...task, email: e.target.value })} required />
                  <input className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-400" placeholder="Task Title" value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} required />
                  <textarea className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none h-32 resize-none transition-all" placeholder="Provide context, links, or specific steps..." value={task.desc} onChange={(e) => setTask({ ...task, desc: e.target.value })} />
                  <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-400 cursor-pointer" value={task.priority} onChange={(e) => setTask({ ...task, priority: e.target.value })}>
                    <option value="Low">🟢 Low Priority</option>
                    <option value="Normal">🔵 Normal Priority</option>
                    <option value="High">🟠 High Priority</option>
                    <option value="Urgent">🔴 Urgent Priority</option>
                  </select>
                  <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white font-semibold py-2.5 rounded-lg hover:bg-slate-800 transition">{loading ? "Assigning..." : "Assign Task"}</button>
                </form>
              </div>

              <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <h2 className="text-xl font-bold">Recent Tasks</h2>
                  <select className="bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 outline-none cursor-pointer" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="All">All Tasks</option>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div className="overflow-y-auto max-h-[450px]">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-white">
                      <tr className="bg-gray-50 text-gray-600 text-sm">
                        <th className="p-3 border-b text-center w-12">S.No.</th>
                        <th className="p-3 border-b">Employee Name</th>
                        <th className="p-3 border-b">Task </th>
                        <th className="p-3 border-b">Priority </th>
                        <th className="p-3 border-b">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasksList.filter(t => filterStatus === 'All' ? true : t.status === filterStatus).map((t, index) => (
                          <tr key={t.id} className="hover:bg-gray-50 transition border-b border-gray-100 last:border-0">
                            <td className="p-3 text-center text-sm font-medium text-gray-500">{index + 1}</td>
                            <td className="p-3"><div className="font-semibold text-gray-900">{t.empName}</div><div className="text-xs text-gray-500">{t.email}</div></td>
                            <td className="p-3"><div className="font-medium text-gray-800">{t.title}</div></td>
                            <td className="p-3"><span className={`inline-block mt-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getPriorityColor(t.priority)}`}>{t.priority || 'Normal'}</span></td>
                            <td className="p-3"><span className={`px-3 py-1 rounded-full text-xs font-bold ${t.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{t.status}</span></td>
                          </tr>
                        ))}
                      {tasksList.filter(t => filterStatus === 'All' ? true : t.status === filterStatus).length === 0 && (
                        <tr><td colSpan="5" className="p-6 text-center text-gray-500">No tasks found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ASSIGN NEW TASK TAB */}
        {activeTab === 'assignTask' && (
          <div className="max-w-6xl mx-auto my-1">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.06)] overflow-hidden">
              <div className="bg-slate-700 px-5 py-4 text-white relative">
                <h2 className="text-3xl font-bold">Delegate a New Task</h2>
              </div>
              <div className="p-6">
                <form onSubmit={assignTask} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 text-blue-600 font-bold uppercase text-xs tracking-widest"><span className="bg-blue-100 p-1.5 rounded-md">👤</span> Employee Info</div>
                      <div className="space-y-4">
                        <input className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl outline-none" placeholder="e.g. Rahul Kumar" value={task.empName} onChange={(e) => setTask({ ...task, empName: e.target.value })} required />
                        <input type="email" className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl outline-none" placeholder="name@company.com" value={task.email} onChange={(e) => setTask({ ...task, email: e.target.value })} required />
                      </div>
                    </div>
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 text-orange-600 font-bold uppercase text-xs tracking-widest"><span className="bg-orange-100 p-1.5 rounded-md">📋</span> Task Details</div>
                      <div className="space-y-4">
                        <input className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl outline-none" placeholder="What needs to be done?" value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} required />
                        <select className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl outline-none" value={task.priority} onChange={(e) => setTask({ ...task, priority: e.target.value })}>
                          <option value="Low">🟢 Low Priority</option>
                          <option value="Normal">🔵 Normal Priority</option>
                          <option value="High">🟠 High Priority</option>
                          <option value="Urgent">🔴 Urgent Priority</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <textarea className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl outline-none h-32 resize-none" placeholder="Provide context..." value={task.desc} onChange={(e) => setTask({ ...task, desc: e.target.value })} />
                  <div className="flex justify-end pt-4">
                    <button type="submit" disabled={loading} className="px-10 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 active:scale-95 transition-all">{loading ? "Assigning..." : "Assign Task & Notify"}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* ALL TASKS TAB */}
        {activeTab === 'allTasks' && (
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
            <div className="flex flex-wrap justify-between items-center gap-2 mb-4 w-full">
              <input type="text" placeholder="🔍 Search employee name..." className="w-full sm:w-80 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
                <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Filter by Date:</span>
                <input type="date" className="bg-transparent text-sm text-slate-700 outline-none cursor-pointer" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
                {selectedDate && (<button onClick={() => setSelectedDate('')} className="text-[9px] font-bold text-red-500 hover:text-red-700 uppercase ml-2">Clear</button>)}
              </div>
            </div>

            <div className="overflow-y-auto max-h-[600px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="bg-gray-50 text-gray-600 text-sm">
                    <th className="p-3 border-b text-center w-12">S.No.</th>
                    <th className="p-3 border-b">Employee Info</th>
                    <th className="p-3 border-b">Task Name</th>
                    <th className="p-3 border-b">Priority</th>
                    <th className="p-3 border-b">Dates</th>
                    <th className="p-3 border-b">Remarks</th>
                    <th className="p-3 border-b">Status</th>
                  </tr>
                </thead>
               <tbody>
                  {tasksList.filter((t) => {
                      const matchesSearch = t.empName?.toLowerCase().includes(searchTerm.toLowerCase());
                      let matchesDate = true;
                      if (selectedDate) {
                        const dateObj = t.assignedAt?.toDate ? t.assignedAt.toDate() : new Date(t.assignedAt);
                        matchesDate = dateObj.toLocaleDateString('en-CA') === selectedDate;
                      }
                      return matchesSearch && matchesDate;
                    }).map((t, index) => {
                      const assignDate = t.assignedAt ? (typeof t.assignedAt.toDate === 'function' ? t.assignedAt.toDate() : (t.assignedAt.seconds ? new Date(t.assignedAt.seconds * 1000) : null)) : null;
                      const completeDate = t.completedAt ? (typeof t.completedAt.toDate === 'function' ? t.completedAt.toDate() : (t.completedAt.seconds ? new Date(t.completedAt.seconds * 1000) : null)) : null;
                      
                      const updateTaskStatus = async (taskId, newStatus) => {
                        try {
                          await updateDoc(doc(db, "tasks", taskId), { status: newStatus, completedAt: newStatus === 'Completed' ? serverTimestamp() : null });
                          toast.success(`Status updated to ${newStatus}`);
                        } catch (error) {}
                      };

                      return (
                        <tr key={t.id} className="hover:bg-gray-50 transition border-b border-gray-100 last:border-0">
                          <td className="p-3 text-center text-sm font-medium text-gray-500">{index + 1}</td>
                          <td className="p-3"><div className="font-semibold text-gray-900">{t.empName}</div><div className="text-xs text-gray-500 font-medium">{t.email}</div></td>
                          <td className="p-2 font-medium text-black-800">{t.title}</td>
                          <td className="p-2"><span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getPriorityColor(t.priority)}`}>{t.priority || 'Normal'}</span></td>
                          <td className="p-3 text-xs text-gray-500">
                            <div className="mb-1">Assign: {assignDate ? assignDate.toLocaleString('en-GB') : 'N/A'}</div>
                            <div className="text-green-600 font-medium">Done: {completeDate ? completeDate.toLocaleString('en-GB') : '-'}</div>
                          </td>
                          <td className="p-3 text-sm text-gray-600 italic">{t.remarks || '-'}</td>
                          <td className="p-3">
                             <select value={t.status} onChange={(e) => updateTaskStatus(t.id, e.target.value)} className={`pl-4 pr-8 py-1.5 rounded-full text-xs font-bold cursor-pointer outline-none transition-all duration-300 border-b-4 active:border-b-0 active:translate-y-1 ${t.status === 'Completed' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-yellow-100 text-yellow-700 border-yellow-300'}`}>
                                <option value="Pending">Pending</option>
                                <option value="Completed">Completed</option>
                             </select>
                          </td>
                        </tr>
                      );
                    })}
                  {tasksList.length === 0 && (
                      <tr><td colSpan="7" className="text-center py-20 text-gray-400 font-bold">No tasks found!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Settings */}
      {activeTab === 'settings' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 h-fit">
              <h2 className="text-xl font-bold mb-4 border-b pb-2">Create Account</h2>
              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm" placeholder="Emp Code" value={empCred.code} onChange={(e) => setEmpCred({ ...empCred, code: e.target.value })} required />
                  <input className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm" placeholder="Dept" value={empCred.department} onChange={(e) => setEmpCred({ ...empCred, department: e.target.value })} required />
                </div>
                <input className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm" placeholder="Employee Name" value={empCred.name} onChange={(e) => setEmpCred({ ...empCred, name: e.target.value })} required />
                <input type="email" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm" placeholder="Email Address" value={empCred.email} onChange={(e) => setEmpCred({ ...empCred, email: e.target.value })} required />
                <input type="text" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm" placeholder="Set Password" value={empCred.password} onChange={(e) => setEmpCred({ ...empCred, password: e.target.value })} required />

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={createEmployee} disabled={loading} className="flex-1 bg-slate-900 text-white font-semibold py-2.5 rounded-lg hover:bg-slate-800 transition">Create User</button>
                  <button type="button" onClick={(e) => createAdmin(e, 'admin')} disabled={loading} className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition">Create Admin</button>
                </div>
              </form>
            </div>

            <div className="xl:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 border-b pb-4 gap-4">
                <h2 className="text-xl font-bold">Registered Employees</h2>
                <input type="text" placeholder="Search..." className="w-full sm:w-64 p-2 border border-gray-300 rounded-lg text-sm" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className='text-center'>
                    <tr className="bg-gray-50 text-gray-600 text-sm">
                      <th className="p-1 border-b">S.No.</th>
                      <th className="p-2 border-b">Employee Name</th>
                      <th className="p-0 border-b">Employee Gmail</th>
                      <th className="p-0 border-b">Dept.</th>
                      <th className="p-2 border-b">Account Status</th>
                      <th className="p-0 border-b ">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.map((emp, index) => (
                      <tr key={emp.id} className="border-b border-gray-100 text-center">
                        <td className="p-2 text-center text-xs">{index + 1}</td>
                        <td className="p-2"><div className="font-semibold text-xs">{emp.name}</div></td>
                        <td className="p-1"><span className=" text-xs font-semibold">{emp.email}</span></td>
                        <td className="p-1 text-center"><span className="text-xs font-bold text-blue-600 uppercase">{emp.department}</span></td>
                        <td className="p-2"><span className={`px-1 py-1 text-xs rounded-full ${emp.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{emp.status || 'Active'}</span></td>
                        <td className="p-1 space-x-1">
                          <button onClick={() => toggleEmployeeStatus(emp.id, emp.status || 'Active')} className={`px-2 py-1 mb-1 text-xs rounded ${emp.status === 'Disabled' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}>
                            {emp.status === 'Disabled' ? 'Enable' : 'Disable'}
                          </button>
                          <button onClick={() => resetPassword(emp.id, emp.name)} className="px-3 py-1 bg-blue-500 text-white text-xs rounded">Reset Pass</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'exportReports' && <ExportReports tasksList={tasksList} />}
      </main>
    </div>
  );
}
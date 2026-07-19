import React, { useState, useEffect } from 'react';
import { db, auth } from '../config/firebase';
import { collection, addDoc, serverTimestamp, onSnapshot, query, orderBy, updateDoc, doc, setDoc ,deleteDoc} from 'firebase/firestore';

import { createUserWithEmailAndPassword } from 'firebase/auth'; // Auth function add kiya

export default function AdminDashboard() {
  // === STATES ===
  // task state se empCode aur department hata diya gaya hai
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
  const [isLoggedIn, setIsLoggedIn] = useState(true); // Default true kyunki admin dashboard hai

  // === FETCH REAL-TIME DATA ===
// === FETCH REAL-TIME DATA ===

// useEffect(() => {

//   const qArchive = query(collection(db, "archive_tasks"), orderBy("assignedAt", "desc"));
  
//   const unsub = onSnapshot(qArchive, (snapshot) => {
//     const archivedTasks = snapshot.docs.map(doc => ({
//       id: doc.id,
//       ...doc.data()
//     }));
//     setTasksList(archivedTasks); 
//   });

//   return () => unsub();
// }, []);





useEffect(() => {
  // 1. Archive tasks se "History" aur "Completed Status" fetch karein
  const qArchive = query(collection(db, "archive_tasks"), orderBy("assignedAt", "desc"));
  
  const unsub = onSnapshot(qArchive, (snapshot) => {
    const archivedTasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // 2. IMPORTANT: Pending tasks ke liye 'tasks' collection se real-time status fetch karein
    const qPending = query(collection(db, "tasks"));
    onSnapshot(qPending, (pendingSnapshot) => {
      const pendingTasks = pendingSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 3. Merge Logic: Agar task 'tasks' collection mein hai, toh uska latest status use karo
      const finalTasks = archivedTasks.map(archiveTask => {
        const matchingPending = pendingTasks.find(p => p.email === archiveTask.email && p.title === archiveTask.title);
        return matchingPending ? { ...archiveTask, status: matchingPending.status, remarks: matchingPending.remarks } : archiveTask;
      });

      setTasksList(finalTasks); // Ye list Admin ko perfect update dikhayegi
    });
  });

  return () => unsub();
}, []);








  // === TASK ASSIGNMENT LOGIC ===
const assignTask = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const taskData = {
        ...task,
        status: 'Pending',
        assignedAt: serverTimestamp(),
      };
      
      // 1. Task collection mein save karein (Jo 2 min baad delete hoga)
      const docRef = await addDoc(collection(db, "tasks"), taskData);

      // 2. Archive collection mein save karein (JO KABHI DELETE NAHI HOGA)
      // Firestore apne aap 'archive_tasks' collection bana lega
      await addDoc(collection(db, "archive_tasks"), {
        ...taskData,
        originalTaskId: docRef.id,
        archivedAt: serverTimestamp()
      });

      // 3. 2 min ka auto-delete logic
      setTimeout(async () => {
        try {
          await deleteDoc(doc(db, "tasks", docRef.id));
        } catch (err) {
          console.error("Auto-delete error: ", err);
        }
      }, 120000); // 120000ms = 2 minutes

      setTask({ empName: '', title: '', email: '', desc: '', priority: 'Normal' });
      setLoading(false);
      setActiveTab('dashboard');
      alert("Task assigned successfully!");

    } catch (error) {
      console.error("Error adding task: ", error);
      setLoading(false);
    }
};

  // === EMPLOYEE MANAGEMENT LOGIC ===
// === EMPLOYEE MANAGEMENT LOGIC ===
  const createEmployee = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Pehle Firebase Auth mein account banayein
      const userCredential = await createUserWithEmailAndPassword(auth, empCred.email, empCred.password);
      
      // 2. Fir uska data Firestore table mein save karein (Auth UID ka use karke)
      await setDoc(doc(db, "employees", userCredential.user.uid), {
        empCode: empCred.code,
        department: empCred.department,
        name: empCred.name,
        email: empCred.email,
        password: empCred.password,
        status: 'Active',
        createdAt: serverTimestamp(),
      });
      alert(`Account Created for ${empCred.name}!`);
      setEmpCred({ code: '', department: '', name: '', email: '', password: '' });
    } catch (error) {
      alert("Failed to create account: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const createAdmin = async (e, roleType) => {
    e.preventDefault();
    setLoading(true);
    try {
      // 1. Pehle Firebase Auth mein admin account banayein
      const userCredential = await createUserWithEmailAndPassword(auth, empCred.email, empCred.password);
      
      // 2. Fir uska data Firestore table mein save karein (Auth UID ka use karke)
      await setDoc(doc(db, "employees", userCredential.user.uid), {
        empCode: empCred.code,
        department: empCred.department,
        name: empCred.name,
        email: empCred.email,
        password: empCred.password,
        role: roleType, 
        status: 'Active',
        createdAt: serverTimestamp(),
      });
      alert(`${roleType.toUpperCase()} Account Created for ${empCred.name}!`);
      setEmpCred({ code: '', department: '', name: '', email: '', password: '' });
    } catch (error) {
      alert("Failed to create admin: " + error.message);
    } finally {
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
      alert(`Password reset successful!`);
    }
  };

  // === STATS & SEARCH ===
  const totalTasks = tasksList.length;
  const completedTasks = tasksList.filter(t => t.status === 'Completed').length;
  const pendingTasks = tasksList.filter(t => t.status === 'Pending').length;

  const filteredEmployees = employeesList.filter((emp) => {
    const queryStr = searchQuery.toLowerCase();
    return (emp.name?.toLowerCase().includes(queryStr) || emp.email?.toLowerCase().includes(queryStr) || emp.empCode?.toLowerCase().includes(queryStr));
  });

  // Priority Badge Color Helper
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-100 text-red-700 border-red-200';
      case 'High': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Low': return 'bg-gray-100 text-gray-700 border-gray-200';
      default: return 'bg-blue-100 text-blue-700 border-blue-200'; // Normal
    }
  };



  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    window.location.href = "/admin";
  };

  return (
    <div className="flex h-screen bg-gray-50 font-sans ">

      {/* SIDEBAR */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-10">
        <div className="p-6 text-2xl font-bold border-b border-slate-800 tracking-wider flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white text-lg">T</div>
          TaskMaster
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full text-left p-3 rounded-lg font-medium transition-all duration-300
  ${activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-slate-300 hover:bg-blue-500/20 hover:text-blue-300'
              }`}
          >
            Dashboard Overview
          </button>

          <button
            onClick={() => setActiveTab('assignTask')}
            className={`w-full text-left p-3 rounded-lg font-medium transition-all duration-300
  ${activeTab === 'assignTask'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-slate-300 hover:bg-blue-500/40 hover:text-blue-300'
              }`}
          >
            Assign New Task
          </button>

          <button
            onClick={() => setActiveTab('allTasks')}
            className={`w-full text-left p-3 rounded-lg font-medium transition-all duration-300
  ${activeTab === 'allTasks'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-slate-300 hover:bg-blue-500/40 hover:text-blue-300'
              }`}
          >
            All Tasks
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full text-left p-3 rounded-lg font-medium transition-all duration-300
  ${activeTab === 'settings'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
                : 'text-slate-300 hover:bg-blue-500/40 hover:text-blue-300'
              }`}
          >
            Employee Accounts
          </button>
        <button
  onClick={handleLogout}
  className="mt-auto w-full text-left p-3 text-red-400 text-sm font-semibold
  hover:bg-red-500 hover:text-white hover:shadow-lg hover:shadow-red-500/30
  rounded-lg transition-all duration-300"
>
  Logout
</button>

        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-3 overflow-y-auto">
        <header className="mb-2 relative p-3 bg-white rounded-xl border border-gray-100 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(1,0,0,0.1)]">
          <h1 className="text-xl  text-center font-bold text-gray-800">
            {activeTab === 'dashboard' && 'Admin Overview'}
            {activeTab === 'assignTask' && 'Assign a New Task'}
            {activeTab === 'allTasks' && 'All Assigned Tasks'}
            {activeTab === 'settings' && 'Manage Employee Accounts'}
          </h1>
          
          <p className="text-gray-500 text-center  mt-0  font-bold bg-gradient-to-r from-red-500 via-orange-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 bg-clip-text text-transparent">Manage and track your organization's tasks efficiently.</p>
        </header>

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-3">
              <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-blue-500"><h3 className="text-gray-500 text-sm font-semibold uppercase">Total Tasks</h3><p className="text-3xl font-bold text-gray-800 mt-2">{totalTasks}</p></div>
              <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-yellow-500"><h3 className="text-gray-500 text-sm font-semibold uppercase">Pending</h3><p className="text-3xl font-bold text-gray-800 mt-2">{pendingTasks}</p></div>
              <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-green-500"><h3 className="text-gray-500 text-sm font-semibold uppercase">Completed</h3><p className="text-3xl font-bold text-gray-800 mt-2">{completedTasks}</p></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
              {/* Quick Assign */}
              <div className="bg-white p-5 rounded-xl shadow-sm border border-green-100 h-fit">
                <h2 className="text-xl font-bold mb-4 border-b pb-2">Quick Assign</h2>
                <form onSubmit={assignTask} className="space-y-4">
                  <input className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-400" placeholder="Employee Name" value={task.empName} onChange={(e) => setTask({ ...task, empName: e.target.value })} required />
                  <input type="email" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-400" placeholder="Email Address" value={task.email} onChange={(e) => setTask({ ...task, email: e.target.value })} required />
                  <input className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-400" placeholder="Task Title" value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} required />


                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Detailed Description</label>
                    <textarea className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none h-32 resize-none transition-all" placeholder="Provide context, links, or specific steps..." value={task.desc} onChange={(e) => setTask({ ...task, desc: e.target.value })} />
                  </div>
                  {/* Quick Priority */}
                  <select className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm focus:ring-2 focus:ring-blue-400 cursor-pointer" value={task.priority} onChange={(e) => setTask({ ...task, priority: e.target.value })}>
                    <option value="Low">🟢 Low Priority</option>
                    <option value="Normal">🔵 Normal Priority</option>
                    <option value="High">🟠 High Priority</option>
                    <option value="Urgent">🔴 Urgent Priority</option>
                  </select>

                  <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white font-semibold py-2.5 rounded-lg hover:bg-slate-800 transition">
                    {loading ? "Assigning..." : "Assign Task"}
                  </button>
                </form>
              </div>

              {/* Recent Tasks */}
              {/* Recent Tasks Section */}
              <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <h2 className="text-xl font-bold">Recent Tasks</h2>

                  {/* Dropdown Filter */}
                  <select
                    className="bg-gray-50 border border-gray-200 text-sm rounded-lg p-2 outline-none cursor-pointer"
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                  >
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
                      {/* Yahan FILTER logic applied hai */}
                      {tasksList
                        .filter(t => filterStatus === 'All' ? true : t.status === filterStatus)
                        .map((t, index) => (
                          <tr key={t.id} className="hover:bg-gray-50 transition border-b border-gray-100 last:border-0">
                            <td className="p-3 text-center text-sm font-medium text-gray-500">{index + 1}</td>
                            <td className="p-3">
                              <div className="font-semibold text-gray-900">{t.empName}</div>
                              <div className="text-xs text-gray-500">{t.email}</div>
                            </td>
                            <td className="p-3">
                              <div className="font-medium text-gray-800">{t.title}</div>
                             
                            </td>



  <td className="p-3">
                            
                              <span className={`inline-block mt-1 px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getPriorityColor(t.priority)}`}>
                                {t.priority || 'Normal'}
                              </span>
                            </td>


                            <td className="p-3">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${t.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {t.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      {/* Agar koi task na mile */}
                      {tasksList.filter(t => filterStatus === 'All' ? true : t.status === filterStatus).length === 0 && (
                        <tr>
                          <td colSpan="4" className="p-6 text-center text-gray-500">No tasks found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ASSIGN NEW TASK TAB (ULTRA PREMIUM SIDE-BY-SIDE UI) */}
        {activeTab === 'assignTask' && (
          <div className="max-w-6xl mx-auto my-1">
            {/* Main Container */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_20px_50px_rgba(0,0,0,0.06)] overflow-hidden">

              {/* Header */}
              <div className="bg-slate-700 px-5 py-4 text-white relative">
                <h2 className="text-3xl font-bold">Delegate a New Task</h2>
                <p className="text-slate-400 mt-2">Assign and notify your team member with a trackable link.</p>
                <div className="absolute right-10 top-10 opacity-20">
                  <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
              </div>

              <div className="p-6">
                <form onSubmit={assignTask} className="space-y-8">

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Column 1: Employee */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 text-blue-600 font-bold uppercase text-xs tracking-widest">
                        <span className="bg-blue-100 p-1.5 rounded-md">👤</span> Employee Info
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Full Name</label>
                          <input className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all" placeholder="e.g. Rahul Kumar" value={task.empName} onChange={(e) => setTask({ ...task, empName: e.target.value })} required />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Email Address</label>
                          <input type="email" className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all" placeholder="name@company.com" value={task.email} onChange={(e) => setTask({ ...task, email: e.target.value })} required />
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Task */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-2 text-orange-600 font-bold uppercase text-xs tracking-widest">
                        <span className="bg-orange-100 p-1.5 rounded-md">📋</span> Task Details
                      </div>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Task Title</label>
                          <input className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all" placeholder="What needs to be done?" value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} required />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Priority</label>
                          <select className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer" value={task.priority} onChange={(e) => setTask({ ...task, priority: e.target.value })}>
                            <option value="Low">🟢 Low Priority</option>
                            <option value="Normal">🔵 Normal Priority</option>
                            <option value="High">🟠 High Priority</option>
                            <option value="Urgent">🔴 Urgent Priority</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Full width Desc */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2">Detailed Description</label>
                    <textarea className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none h-32 resize-none transition-all" placeholder="Provide context, links, or specific steps..." value={task.desc} onChange={(e) => setTask({ ...task, desc: e.target.value })} />
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end pt-4">
                    <button type="submit" disabled={loading} className="px-10 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 hover:shadow-2xl hover:shadow-blue-500/20 active:scale-95 transition-all">
                      {loading ? "Assigning..." : "Assign Task & Notify"}
                    </button>
                  </div>

                </form>
              </div>
            </div>
          </div>
        )}

        {/* ALL TASKS TAB */}

        {activeTab === 'allTasks' && (
          <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">

           {/* Search & Filter Bar */}
<div className="flex flex-wrap justify-between items-center gap-2 mb-4 w-full">
  <div className="w-full sm:w-80">
    <input
      type="text"
      placeholder="🔍 Search employee name..."
      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
    />
  </div>

  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 shadow-sm">
    <span className="text-slate-400 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap">Filter by Date:</span>
    <input
      type="date"
      className="bg-transparent text-sm text-slate-700 outline-none cursor-pointer"
      value={selectedDate}
      onChange={(e) => setSelectedDate(e.target.value)}
    />
    {selectedDate && (
      <button
        onClick={() => setSelectedDate('')}
        className="text-[9px] font-bold text-red-500 hover:text-red-700 uppercase ml-2"
      >
        Clear
      </button>
    )}
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
  {tasksList
    .filter((t) => {
      const matchesSearch = t.empName?.toLowerCase().includes(searchTerm.toLowerCase());
      let matchesDate = true;
      if (selectedDate) {
        const dateObj = t.assignedAt?.toDate ? t.assignedAt.toDate() : new Date(t.assignedAt);
        matchesDate = dateObj.toLocaleDateString('en-CA') === selectedDate;
      }
      return matchesSearch && matchesDate;
    })
    .map((t, index) => {
      // Date logic...
      const assignDate = t.assignedAt ? (typeof t.assignedAt.toDate === 'function' ? t.assignedAt.toDate() : (t.assignedAt.seconds ? new Date(t.assignedAt.seconds * 1000) : null)) : null;
      const completeDate = t.completedAt ? (typeof t.completedAt.toDate === 'function' ? t.completedAt.toDate() : (t.completedAt.seconds ? new Date(t.completedAt.seconds * 1000) : null)) : null;

      // Update function...
      const updateTaskStatus = async (taskId, newStatus) => {
        try {
          await updateDoc(doc(db, "tasks", taskId), { 
            status: newStatus,
            completedAt: newStatus === 'Completed' ? serverTimestamp() : null 
          });
          alert(`Status updated to ${newStatus}`);
        } catch (error) {
          // Local Storage fallback...
          let adminTasks = JSON.parse(localStorage.getItem('permanentTasks')) || [];
          const index = adminTasks.findIndex(t => t.id === taskId);
          if (index >= 0) {
            adminTasks[index].status = newStatus;
            adminTasks[index].completedAt = newStatus === 'Completed' ? new Date().toISOString() : null;
            localStorage.setItem('permanentTasks', JSON.stringify(adminTasks));
            setTasksList([...adminTasks]);
            alert(`Status updated to ${newStatus}`);
          }
        }
      };

      return (
        <tr key={t.id} className="hover:bg-gray-50 transition border-b border-gray-100 last:border-0">
          {/* Aapke existing cells... */}
          <td className="p-3 text-center text-sm font-medium text-gray-500">{index + 1}</td>
          <td className="p-3">
             <div className="font-semibold text-gray-900">{t.empName}</div>
             <div className="text-xs text-gray-500 font-medium">{t.email}</div>
          </td>
          <td className="p-2 font-medium text-black-800">{t.title}</td>
          <td className="p-2">
            <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getPriorityColor(t.priority)}`}>
              {t.priority || 'Normal'}
            </span>
          </td>
          <td className="p-3 text-xs text-gray-500">
  <div className="mb-1">
    Assign: {assignDate ? assignDate.toLocaleString() : 'N/A'}
  </div>
  
  {/* Yahan update karein */}
  <div className="text-green-600 font-medium">
    Done: {completeDate 
      ? completeDate.toLocaleString('en-GB') 
      : '-'}
  </div>
</td>
          <td className="p-3 text-sm text-gray-600 italic">{t.remarks || '-'}</td>
          <td className="p-3">
             <select value={t.status} onChange={(e) => updateTaskStatus(t.id, e.target.value)} className={`pl-4 pr-8 py-1.5 rounded-full text-xs font-bold cursor-pointer outline-none transition-all duration-300 appearance-none border-b-4 active:border-b-0 active:translate-y-1 ${t.status === 'Completed' ? 'bg-green-100 text-green-700 border-green-300' : 'bg-yellow-100 text-yellow-700 border-yellow-300'} shadow-[0_4px_0_rgba(0,0,0,0.1)]`}>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
             </select>
          </td>
        </tr>
      );
    })}

  {/* NAYA FEATURE: Empty State Message */}
  {tasksList.filter(t => {
      const matchesSearch = t.empName?.toLowerCase().includes(searchTerm.toLowerCase());
      let matchesDate = true;
      if (selectedDate) {
        const taskDate = t.assignedAt?.toDate ? t.assignedAt.toDate() : new Date(t.assignedAt);
        matchesDate = taskDate.toLocaleDateString('en-CA') === selectedDate;
      }
      return matchesSearch && matchesDate;
    }).length === 0 && (
      <tr>
        <td colSpan="7" className="text-center py-20">
          <div className="flex flex-col items-center justify-center text-gray-400">
            <p className="text-xl font-bold text-gray-600">No tasks found!</p>
            <p className="text-sm">No assignments are available for this date <span className='font-bold text-green-500'>{selectedDate || 'selected'} </span></p>
          </div>
        </td>
      </tr>
  )}
</tbody>
              </table>
            </div>
          </div>
        )}






        {/* Registered Employees */}
        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 h-fit">
              <h2 className="text-xl font-bold mb-4 border-b pb-2">Create Account</h2>

              {/* Form */}
              <form className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <input className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm" placeholder="Emp Code" value={empCred.code} onChange={(e) => setEmpCred({ ...empCred, code: e.target.value })} required />
                  <input className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm" placeholder="Dept" value={empCred.department} onChange={(e) => setEmpCred({ ...empCred, department: e.target.value })} required />
                </div>
                <input className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm" placeholder="Employee Name" value={empCred.name} onChange={(e) => setEmpCred({ ...empCred, name: e.target.value })} required />
                <input type="email" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm" placeholder="Email Address" value={empCred.email} onChange={(e) => setEmpCred({ ...empCred, email: e.target.value })} required />
                <input type="text" className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm" placeholder="Set Password" value={empCred.password} onChange={(e) => setEmpCred({ ...empCred, password: e.target.value })} required />

                {/* Buttons Div */}
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={createEmployee}
                    disabled={loading}
                    className="flex-1 bg-slate-900 text-white font-semibold py-2.5 rounded-lg hover:bg-slate-800 transition"
                  >
                    Create User
                  </button>

                  <button
                    type="button"
                    onClick={(e) => createAdmin(e, 'admin')}
                    disabled={loading}
                    className="flex-1 bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 transition"
                  >
                    Create Admin
                  </button>
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
                        <td className="p-2"><div className="font-semibold text-xs">{emp.name}</div>
                        </td>
                        <td className="p-1"><span className=" text-xs font-semibold">{emp.email}</span></td>

                        <td className="p-1 text-center">
                          <span className="text-xs font-bold text-blue-600 uppercase">
                            {emp.department}
                          </span>
                        </td>
                        <td className="p-2"><span className={`px-1 py-1 text-xs rounded-full ${emp.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{emp.status || 'Active'}</span></td>
                        <td className="p-1 space-x-1">
                          <button
                            onClick={() => toggleEmployeeStatus(emp.id, emp.status || 'Active')}
                            className={`px-2 py-1 mb-1 text-xs rounded ${emp.status === 'Disabled' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                          >
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

      </main>
    </div>
  );
}
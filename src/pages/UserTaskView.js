import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, updateDoc,deleteDoc, doc,getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

export default function UserTaskView() {
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState('overview');
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('isLoggedIn') === 'true');
  const [loginCred, setLoginCred] = useState(JSON.parse(localStorage.getItem('userCred')) || { email: '', password: '' });
  const [remarks, setRemarks] = useState({});
  const [expandedTasks, setExpandedTasks] = useState({});

  useEffect(() => {
    if (isLoggedIn && loginCred.email) {
      // 1. Page load hote hi Local Storage se purane tasks uthayein
      // User ke email ke hisaab se alag key banayi hai, taaki doosre user ke task mix na hon
      const storageKey = `userPermanentTasks_${loginCred.email}`;
      const savedTasks = JSON.parse(localStorage.getItem(storageKey)) || [];
      setTasks(savedTasks);

      const q = query(collection(db, "tasks"), where("email", "==", loginCred.email));

      const unsub = onSnapshot(q, (snapshot) => {
        // snapshot.docChanges() se har ek single badlaav ko track karenge
        let currentTasks = JSON.parse(localStorage.getItem(storageKey)) || [];

        snapshot.docChanges().forEach((change) => {
          const taskData = { id: change.doc.id, ...change.doc.data() };

          if (change.type === "added" || change.type === "modified") {
            // Naya task aane par ya status update hone par list ko update karein
            const existingIndex = currentTasks.findIndex(t => t.id === taskData.id);
            if (existingIndex >= 0) {
              currentTasks[existingIndex] = taskData;
            } else {
              currentTasks.push(taskData);
            }
          }

          
        });

        // UI aur Local Storage dono ko update kar dein
        setTasks(currentTasks);
        localStorage.setItem(storageKey, JSON.stringify(currentTasks));
      });

      return () => unsub();
    }
  }, [isLoggedIn, loginCred.email]);

  // 1. Remark Update karne ka naya function
  const handleUpdateRemark = async (taskId, text) => {
    // Sabse pehle locally dono jagah (User + Admin) update kar do turant
    const storageKey = `userPermanentTasks_${loginCred.email}`;
    let currentTasks = JSON.parse(localStorage.getItem(storageKey)) || [];
    const index = currentTasks.findIndex(t => t.id === taskId);
    if (index >= 0) {
      currentTasks[index].remarks = text;
      localStorage.setItem(storageKey, JSON.stringify(currentTasks));
      setTasks([...currentTasks]);
    }

    // Admin ka local storage bhi force-update kar do
    let adminTasks = JSON.parse(localStorage.getItem('permanentTasks')) || [];
    const adminIndex = adminTasks.findIndex(t => t.id === taskId);
    if (adminIndex >= 0) {
      adminTasks[adminIndex].remarks = text;
      localStorage.setItem('permanentTasks', JSON.stringify(adminTasks));
    }

    // Uske baad Firebase mein try karo (agar task abhi bacha hai toh)
    try {
      await updateDoc(doc(db, "tasks", taskId), { remarks: text });
      alert("Remark updated!");
    } catch (error) {
      alert("Remark updated !");
    }
  };

  // 2. Task Complete karne ka naya SUPER function
  const handleCompleteTask = async (taskId) => {
  try {
    const timestamp = serverTimestamp();

    // 1. Live Task update (Ye aapka pehle se sahi chal raha hai)
    await updateDoc(doc(db, "tasks", taskId), {
      status: "Completed",
      remarks: remarks[taskId] || "",
      completedAt: timestamp 
    });

    // 2. Archive Task update (Isse update hona chahiye)
    const archiveQuery = query(collection(db, "archive_tasks"), where("originalTaskId", "==", taskId));
    const archiveSnapshot = await getDocs(archiveQuery);

    for (const docSnap of archiveSnapshot.docs) {
      await updateDoc(doc(db, "archive_tasks", docSnap.id), {
        status: "Completed",
        remarks: remarks[taskId] || "",
        completedAt: timestamp // Yeh timestamp archive mein jana chahiye
      });
    }

    alert("Task Completed!");
  } catch (error) {
    console.error("Error:", error);
  }
};

  // FINAL LOGOUT LOGIC: Page ko root pe force redirect karega
  const handleLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    window.location.href = "/";
  };

  



  
// 2. Button ko table ke neeche place karein (Yahan button dikhega)


  return (
    <div className="min-h-screen bg-gray-50 flex font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-slate-900 text-white p-6">
        <div className="p-1 mb-12 text-2xl font-bold border-b border-slate-800 tracking-wider flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white text-lg">T</div>
          TaskMaster
        </div>
        <div className="space-y-4">
          <button onClick={() => setView('overview')} className={`w-full text-left p-3 rounded-lg text-sm font-semibold transition ${view === 'overview' ? 'bg-blue-600' : 'text-gray-400 hover:text-white'}`}>Dashboard Overview</button>
          <button onClick={() => setView('myTasks')} className={`w-full text-left p-3 rounded-lg text-sm font-semibold transition ${view === 'myTasks' ? 'bg-blue-600' : 'text-gray-400 hover:text-white'}`}>My Tasks</button>
          <button onClick={handleLogout} className="w-full text-left p-3 text-red-400 text-sm font-semibold hover:bg-red-900/20 rounded-lg transition">Logout</button>
       
    
        </div>
        
      </div>

      

      {/* Main Content */}
      <div className="flex-1 p-3">
        <div className="flex justify-between items-center p-4 mb-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <h1 className="text-xl font-bold">Welcome, <span className='text-xl font-bold bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent'>{loginCred.email ? loginCred.email.split('@')[0] : 'User'}</span></h1>
          <button onClick={() => window.location.reload()} className="p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-all text-sm">🔄 Refresh</button>
        </div>

        {/* Dynamic View Logic */}
        {view === 'myTasks' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">

            {/* PENDING TASKS */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold mb-6 text-orange-600">Pending Tasks</h2>
              <div className="overflow-y-auto max-h-[600px]">
                <table className="w-full text-left">
                  <thead className="sticky top-0 text-center bg-white z-10">
                    <tr className="text-gray-400 text-xs uppercase border-b">
                      <th className="pb-3">S No.</th>
                      <th className="pb-3">Task Name</th>
                      <th className="pb-3">Task Details</th>
                      <th className="pb-3">Priority</th>
                      <th className="pb-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className='' >
                    {tasks.filter(t => t.status !== 'Completed').map((task, index) => (
                      <tr key={task.id} className="border-b  ">
                        <td className="py-5 text-sm font-bold">{index + 1}</td>
                        <td className="py-4 px-3 font-semibold capitalize max-w-[10rem] text-center whitespace-normal break-words">
                          {task.title}
                        </td>

                        <td className="py-3 text-center">
                          <div className="mt-1 px-0">
                            <p className={`text-xs text-gray-500 capitalize break-all  max-w-[15rem] transition-all ${expandedTasks[task.id] ? 'max-h-none' : 'max-h-8 overflow-hidden'}`}>
                              {task.desc || 'N/A'}
                            </p>
                            {(task.desc?.length > 50) && (
                              <button
                                onClick={() => setExpandedTasks({ ...expandedTasks, [task.id]: !expandedTasks[task.id] })}
                                className="text-[10px] text-blue-600 font-bold underline mt-1"
                              >
                                {expandedTasks[task.id] ? 'Show Less' : '...Read More'}
                              </button>
                            )}
                          </div>


                        </td>

                        <td className="py-5 px-2 text-center align-middle">
                          <div className="text-[10px] font-bold bg-blue-200 text-blue-700 px-2 py-2 rounded mr-2">
                            {task.priority || 'Normal'}
                          </div>
                        </td>



                        <td className="py-5 space-y-2">
                          <input className="w-full p-2 border  capitalize rounded text-xs outline-none" placeholder="Remark..." onChange={(e) => setRemarks({ ...remarks, [task.id]: e.target.value })} />


                          <div className="flex gap-2">
                            <button onClick={() => handleUpdateRemark(task.id, remarks[task.id])} className="bg-gray-800 text-white text-xs px-3 py-1.5 rounded">Save</button>
                            <button onClick={() => handleCompleteTask(task.id)} className="bg-green-600 text-white text-xs px-3 py-1.5 rounded">Done</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* COMPLETED TASKS */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-2xl font-bold mb-6 text-green-600">Completed Tasks</h2>
              <div className="overflow-y-auto max-h-[600px]">
                <table className="w-full text-left">
                  <thead className="sticky text-center top-0 bg-white z-10">
                    <tr className="text-gray-400 text-xs uppercase border-b">
                      <th className="pb-3  ">S No.</th>
                      <th className="pb-3 ">Task Name</th>
                      <th className="pb-3">Task Description</th>
                      <th className="pb-3">Task Priority</th>
                      <th className="pb-3">Remark</th>
                    </tr>
                  </thead>
                  <tbody className='text-center'>
                    {tasks.filter(t => t.status === 'Completed').map((task, index) => (
                      <tr key={task.id} className="border-b ">
                        <td className="py-5 text-sm font-bold">{index + 1}</td>
                        <td className="py-4 px-3 font-semibold capitalize  max-w-[10rem] whitespace-normal break-words">
                          {task.title}
                        </td>

                        <td className="py-5">
                          <div className="mt-1">
                            <p className={`text-xs text-gray-500 capitalize break-all transition-all ${expandedTasks[task.id] ? 'max-h-none' : 'max-h-8 overflow-hidden'}`}>
                              {task.desc || 'N/A'}
                            </p>
                            {(task.desc?.length > 50) && (
                              <button
                                onClick={() => setExpandedTasks({ ...expandedTasks, [task.id]: !expandedTasks[task.id] })}
                                className="text-[10px] text-blue-600 font-bold underline mt-1"
                              >
                                {expandedTasks[task.id] ? 'Show Less' : '...Read More'}
                              </button>
                            )}
                          </div>

                        </td>
                        <td>
                          <span className="text-[10px] font-bold bg-blue-100 capitalize text-blue-700 px-2 py-0.5 rounded mr-2">{task.priority || 'Normal'}</span>

                        </td>
                        <td className="py-5 px-2 text-center align-middle">
                          <div className="max-w-[150px] max-h-20  capitalize overflow-y-auto mx-auto scrollbar-hide italic text-Black-600 text-sm">
                            {task.remarks || 'No remarks'}
                          </div>
                        </td>                
                              </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* Dashboard Overview Table */
          <div className="bg-white p-2 rounded-2xl shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-gray-400 text-xs uppercase border-b">
                  <th className="pb-4 px-2">S.No.</th>
                  <th className="pb-4 px-2">Task Title</th>
                  <th className="pb-4 px-2">Description</th>
                  <th className="pb-4 px-2">Assign Time&Date</th>
                  <th className="pb-4 px-2">Priority</th>
                  <th className="pb-4 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task, index) => {
                  // Safe Date Logic
                  const assignDate = task.assignedAt
                    ? (typeof task.assignedAt.toDate === 'function' ? task.assignedAt.toDate() : (task.assignedAt.seconds ? new Date(task.assignedAt.seconds * 1000) : new Date(task.assignedAt)))
                    : null;

                  const completeDate = task.completedAt
                    ? (typeof task.completedAt.toDate === 'function' ? task.completedAt.toDate() : (task.completedAt.seconds ? new Date(task.completedAt.seconds * 1000) : new Date(task.completedAt)))
                    : null;

                  return (
                    <tr key={task.id} className="border-b hover:bg-gray-50">
                      <td className="py-4 px-2 text-sm">{index + 1}</td>
                      <td className="py-4 px-3 font-semibold max-w-[10rem] whitespace-normal break-words">
                        {task.title}
                      </td>

                      <div className="mt-1 ">
                        <p className={`text-xs text-gray-500  max-w-[15rem] break-all transition-all ${expandedTasks[task.id] ? 'max-h-none' : 'max-h-8 overflow-hidden'}`}>
                          {task.desc || 'N/A'}
                        </p>
                        {(task.desc?.length > 50) && (
                          <button
                            onClick={() => setExpandedTasks({ ...expandedTasks, [task.id]: !expandedTasks[task.id] })}
                            className="text-[10px] text-blue-600 font-bold underline mt-1"
                          >
                            {expandedTasks[task.id] ? 'Show Less' : '...Read More'}
                          </button>
                        )}
                      </div>

                      {/* UPDATED DATE COLUMN */}
                      <td className="py-4 px-2 text-xs text-red-400">
                        <div className="font-medium">
                          Assign: {assignDate ? assignDate.toLocaleString('en-GB') : 'N/A'}
                        </div>
                        {task.status === 'Completed' && completeDate && (
                          <div className="text-green-600 font-bold mt-1">
                            Done: {completeDate.toLocaleString('en-GB')}
                          </div>
                        )}
                      </td>

                      <td className="py-4 px-2">
                        <span className="text-[10px] font-bold uppercase bg-blue-100 text-blue-700 px-2 py-1 rounded">
                          {task.priority || 'Normal'}
                        </span>
                      </td>
                      <td className="py-4 px-2">
                        <span className={`px-2 py-1 rounded text-xs ${task.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                          {task.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
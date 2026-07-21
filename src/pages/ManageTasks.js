



import React, { useState, useEffect } from 'react';
import { db } from '../config/firebase';
import { collection, onSnapshot, query, deleteDoc, updateDoc, doc } from 'firebase/firestore';

const ManageTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState("");
  
  const [delSno, setDelSno] = useState("");
  const [delEmail, setDelEmail] = useState("");
  const [reSno, setReSno] = useState("");
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    const q = query(collection(db, "tasks"));
    const unsub = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  // Filtered tasks (Search ke liye)
  const filteredTasks = tasks.filter(task => 
    task.email.toLowerCase().includes(search.toLowerCase()) || 
    task.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async () => {
    const index = parseInt(delSno) - 1;
    // Yeh check karein ki kya task wahan exist karta hai
    if (tasks[index]) {
      if (tasks[index].email === delEmail) {
        await deleteDoc(doc(db, "tasks", tasks[index].id));
        alert("Task Deleted Successfully!");
        setDelSno(""); setDelEmail("");
      } else {
        alert("Email mismatch!");
      }
    } else {
      alert("Invalid S.No! Task not found.");
    }
  };

  const handleReassign = async () => {
    const index = parseInt(reSno) - 1;
    if (tasks[index]) {
      try {
        await updateDoc(doc(db, "tasks", tasks[index].id), { 
          email: newEmail,
          lastAction: "Reassigned" 
        });
        alert("Task Reassigned Successfully!");
        setReSno(""); setNewEmail("");
      } catch (error) {
        alert("Error updating task: " + error.message);
      }
    } else {
      alert("Invalid S.No!");
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* 1. Forms Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-4 border-b pb-2">Delete Task</h2>
          <input className="w-full p-2.5 mb-3 border rounded-lg text-sm" placeholder="S.No. from All Tasks" value={delSno} onChange={(e) => setDelSno(e.target.value)} />
          <input className="w-full p-2.5 mb-3 border rounded-lg text-sm" placeholder="Assigned Employee Email" value={delEmail} onChange={(e) => setDelEmail(e.target.value)} />
          <button onClick={handleDelete} className="w-full bg-red-600 text-white py-2.5 rounded-lg font-bold hover:bg-red-700">Delete Task</button>
        </div>

        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-bold mb-4 border-b pb-2">Reassign Task</h2>
          <input className="w-full p-2.5 mb-3 border rounded-lg text-sm" placeholder="S.No. from All Tasks" value={reSno} onChange={(e) => setReSno(e.target.value)} />
          <input className="w-full p-2.5 mb-3 border rounded-lg text-sm" placeholder="New Employee Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <button onClick={handleReassign} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700">Reassign Task</button>
        </div>
      </div>

      {/* 2. All Manage Summary with Scroll and Search */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">All Manage Summary</h2>
          <input className="p-2 border rounded-lg text-sm" placeholder="Search task/email..." onChange={(e) => setSearch(e.target.value)} />
        </div>
        
        <div className="overflow-y-auto" style={{ maxHeight: '400px' }}>
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-gray-50">
              <tr className="text-sm text-gray-600">
                <th className="p-3 border-b">S.No.</th>
                <th className="p-3 border-b">Task Title</th>
                <th className="p-3 border-b">Assigned To</th>
                <th className="p-3 border-b">Action</th>
                <th className="p-3 border-b">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task, index) => (
                <tr key={task.id} className="border-b text-sm">
                  <td className="p-3 font-semibold">{index + 1}</td>
                  <td className="p-3">{task.title}</td>
                  <td className="p-3 text-blue-600 font-medium">{task.email}</td>
                  <td className="p-3">
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">
                      {task.lastAction || 'Created'}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${task.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {task.status || 'Pending'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManageTasks;
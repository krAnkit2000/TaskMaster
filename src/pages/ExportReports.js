import React, { useState } from 'react';
import toast from 'react-hot-toast';

export default function ExportReports({ tasksList }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(''); 
  const [endDate, setEndDate] = useState('');     
  const [statusFilter, setStatusFilter] = useState('All');

  const safeParseDate = (dateField) => {
    if (!dateField) return null;
    if (typeof dateField.toDate === 'function') return dateField.toDate();
    if (dateField.seconds) return new Date(dateField.seconds * 1000);
    const parsed = new Date(dateField);
    return isNaN(parsed.getTime()) ? null : parsed;
  };

  const filteredTasks = (tasksList || []).filter((t) => {
    const empName = t.empName ? String(t.empName).toLowerCase() : "";
    const email = t.email ? String(t.email).toLowerCase() : "";
    const search = searchTerm ? String(searchTerm).toLowerCase().trim() : "";
    let matchesSearch = true;
    if (search !== "") matchesSearch = empName.includes(search) || email.includes(search);

    const currentStatus = t.status ? String(t.status).toLowerCase() : 'pending';
    const expectedStatus = String(statusFilter).toLowerCase();
    const matchesStatus = statusFilter === 'All' ? true : currentStatus === expectedStatus;

    let matchesDate = true;
    if (startDate || endDate) {
      const parsedDate = safeParseDate(t.assignedAt || t.createdAt || t.date);
      if (!parsedDate) {
        matchesDate = false; 
      } else {
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (parsedDate < start) matchesDate = false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (parsedDate > end) matchesDate = false;
        }
      }
    }
    return matchesSearch && matchesStatus && matchesDate;
  });

  const handleExportCSV = () => {
    if (filteredTasks.length === 0) return toast.error("No data available to export!");

    // ✅ EXACT HEADERS MATCHING YOUR SCREENSHOT
    const headers = ["S.No", "Employee Name", "Email", "Task Title", "Priority", "Status", "Remarks", "Assigned Date", "Completed Date"];
    
    const csvRows = filteredTasks.map((t, index) => {
      const aDate = safeParseDate(t.assignedAt || t.createdAt || t.date);
      const cDate = safeParseDate(t.completedAt);
      const assignStr = aDate ? aDate.toLocaleString('en-GB') : 'N/A';
      const completeStr = cDate ? cDate.toLocaleString('en-GB') : 'N/A';
      
      return [
        index + 1,
        `"${(t.empName || 'Not Assigned').replace(/"/g, '""')}"`,
        `"${(t.email || '-').replace(/"/g, '""')}"`,
        `"${(t.title || '-').replace(/"/g, '""')}"`,
        `"${t.priority || 'Normal'}"`,
        `"${t.status || 'Pending'}"`,
        `"${(t.remarks || '-').replace(/"/g, '""')}"`,
        `"${assignStr}"`,
        `"${completeStr}"`
      ].join(',');
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    const fileName = statusFilter === 'All' ? 'Complete_Task_Report' : `${statusFilter}_Task_Report`;
    
    link.setAttribute("href", url);
    link.setAttribute("download", `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Report Downloaded Successfully!");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* FILTER CONTROLS */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-3">Filter & Export Reports</h2>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-end">
          <div className="flex flex-col">
            <label className="text-xs font-bold text-gray-500 uppercase mb-1">Search Employee</label>
            <input type="text" placeholder="Name or Email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm" />
          </div>
          <div className="flex flex-col lg:col-span-2">
            <label className="text-xs font-bold text-gray-500 uppercase mb-1">Select Date Range</label>
            <div className="flex gap-2 items-center">
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm cursor-pointer" />
              <span className="text-gray-400 font-bold text-[10px] uppercase">TO</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm cursor-pointer" />
              {(startDate || endDate) && (<button onClick={() => { setStartDate(''); setEndDate(''); }} className="bg-red-100 text-red-600 px-3 py-2.5 rounded-lg text-xs font-bold">Clear</button>)}
            </div>
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-bold text-gray-500 uppercase mb-1">Task Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none text-sm cursor-pointer">
              <option value="All">All Tasks</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
          <div className="flex flex-col">
            <button onClick={handleExportCSV} className="w-full bg-green-600 text-white font-bold py-2.5 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2">
              <span>⬇️</span> Export to CSV
            </button>
          </div>
        </div>
      </div>

      {/* PREVIEW TABLE */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-4 border-b pb-3">
          <h2 className="text-lg font-bold text-gray-800">Preview Data</h2>
          <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">Showing {filteredTasks.length} Result(s)</span>
        </div>
        <div className="overflow-y-auto max-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10 shadow-sm">
              <tr className="bg-gray-50 text-gray-600 text-sm">
                <th className="p-3 border-b text-center w-12">S.No.</th>
                <th className="p-3 border-b">Employee Name</th>
                <th className="p-3 border-b">Email</th>
                <th className="p-3 border-b">Task Title</th>
                <th className="p-3 border-b text-center">Status</th>
                <th className="p-3 border-b center">Assigned Date / Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length > 0 ? (
                filteredTasks.map((t, index) => {
                  const aDate = safeParseDate(t.assignedAt || t.createdAt || t.date);
                  const assignStr = aDate ? aDate.toLocaleString('en-GB') : 'N/A';

                  return (
                    <tr key={t.id} className="hover:bg-gray-50 transition border-b border-gray-100 last:border-0">
                      <td className="p-3 text-center text-sm font-medium text-gray-500">{index + 1}</td>
                      <td className="p-3 font-semibold text-gray-900">{t.empName || 'Not Assigned'}</td>
                      <td className="p-3 text-sm text-gray-500">{t.email || '-'}</td>
                      <td className="p-3 font-medium text-gray-800">{t.title}</td>
                      <td className="p-3 text-center"><span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${(t.status || 'Pending').toLowerCase() === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{t.status || 'Pending'}</span></td>
                      <td className="p-3 text-xs text-gray-500 font-medium">{assignStr}</td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan="6" className="p-8 text-center text-gray-500 font-medium">No tasks found matching your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
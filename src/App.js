import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import UserTaskView from './pages/UserTaskView';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import { Toaster } from "react-hot-toast";

export default function App() {
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
  const userCred = JSON.parse(localStorage.getItem('userCred') || '{}');
  
  const isAdmin = userCred.role === 'admin' || userCred.role === 'superadmin';

  return (
    
    <BrowserRouter>
    <Toaster position="top-right"  autoClose={7000}/>
      <Routes>
        {/* 1. Default Route (/) - Login check aur redirect */}
        <Route path="/" element={
          !isLoggedIn ? <Login /> : 
          isAdmin ? <Navigate to="/admin" /> : 
          <Navigate to="/user" />
        } />

        {/* 2. Admin Login Page */}
        <Route path="/admin-login" element={
          !isLoggedIn ? <AdminLogin /> : <Navigate to="/admin" />
        } />

        {/* 3. Protected Admin Route (/admin) */}
        <Route path="/admin" element={
          isLoggedIn && isAdmin ? <AdminDashboard /> : <Navigate to="/admin-login" />
        } />

        {/* 4. Protected User Route (/user) */}
        <Route path="/user" element={
          isLoggedIn && !isAdmin ? <UserTaskView /> : <Navigate to="/" />
        } />

        {/* Catch-all route to redirect back to home */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}


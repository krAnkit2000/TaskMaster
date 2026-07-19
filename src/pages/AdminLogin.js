import React, { useState } from 'react';
import { db, auth, googleProvider } from '../config/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export default function AdminLogin() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState(''); // 1. Naya state Name ke liye
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('admin');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        // Auth mein account banayein
        const res = await createUserWithEmailAndPassword(auth, email, password);
        
        // Firestore mein user ka data (aur Name) save karein
        await setDoc(doc(db, "employees", res.user.uid), {
          name: name, // 2. Yahan Name ko database mein save kiya
          email: email,
          role: role, 
          status: 'Active',
          department: role,
          createdAt: new Date()
        });
        
        alert("Account Created! Now click Login to enter.");
        setIsSignUp(false); 
        setName(''); // Form clear karne ke liye
        setEmail('');
        setPassword('');
      } else {
        // Login Logic
        const res = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, "employees", res.user.uid));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.role === 'admin' || userData.role === 'superadmin') {
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userCred', JSON.stringify({ role: userData.role }));
            window.location.href = "/admin";
          } else {
            alert("Access Denied: You are not an Admin.");
          }
        }
      }
    } catch (err) {
      console.error(err);
      alert("Error: " + err.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const uid = res.user.uid;
      
      const userDoc = await getDoc(doc(db, "employees", uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === 'admin' || userData.role === 'superadmin') {
          localStorage.setItem('isLoggedIn', 'true');
          localStorage.setItem('userCred', JSON.stringify({ role: userData.role }));
          window.location.href = "/admin";
        } else {
          alert("Access Denied: You do not have admin privileges.");
        }
      } else {
        // Google se naya user aane par uska naam bhi save kar rahe hain
        await setDoc(doc(db, "employees", uid), {
          name: res.user.displayName || 'Google User', // Google account ka naam lega
          email: res.user.email,
          role: 'admin',
          status: 'Active',
          createdAt: new Date()
        });
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userCred', JSON.stringify({ role: 'admin' }));
        window.location.href = "/admin";
      }
    } catch (err) {
      console.error("Google Login Error:", err);
      alert("Google Login Failed: " + err.message);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 px-4">
      
      <div className="relative bg-white/10 backdrop-blur-lg border-t border-l border-white/30 rounded-3xl p-8 md:p-10 w-full max-w-md shadow-[20px_20px_50px_rgba(0,0,0,0.5),-10px_-10px_30px_rgba(255,255,255,0.05)]">
        
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-white tracking-wider drop-shadow-md">
            {isSignUp ? "CREATE ADMIN" : "ADMIN LOGIN"}
          </h1>
          <p className="text-indigo-200 mt-2 font-medium">
            {isSignUp ? "Join the control panel" : "Enter the command center"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Role Selector aur Name Input - Sirf SignUp par dikhega */}
          {isSignUp && (
            <>
              <div className="relative">
                <select 
                  className="w-full bg-slate-900/50 text-white px-5 py-4 rounded-2xl outline-none border border-black/20 focus:border-indigo-500 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.6),inset_-4px_-4px_10px_rgba(255,255,255,0.05)] transition-all cursor-pointer"
                  onChange={(e) => setRole(e.target.value)}
                  value={role}
                >
                  <option value="admin" className="bg-slate-800 text-white">Admin</option>
                  <option value="superadmin" className="bg-slate-800 text-white">SuperAdmin</option>
                </select>
              </div>

              {/* 3. Naya 3D Name Input Field */}
              <div className="relative">
                <input 
                  type="text" 
                  className="w-full bg-slate-900/50 text-white placeholder-gray-400 px-5 py-4 rounded-2xl outline-none border border-black/20 focus:border-indigo-500 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.6),inset_-4px_-4px_10px_rgba(255,255,255,0.05)] transition-all"
                  placeholder="Employee Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)} 
                  required 
                />
              </div>
            </>
          )}
          
          <div className="relative">
            <input 
              type="email" 
              className="w-full bg-slate-900/50 text-white placeholder-gray-400 px-5 py-4 rounded-2xl outline-none border border-black/20 focus:border-indigo-500 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.6),inset_-4px_-4px_10px_rgba(255,255,255,0.05)] transition-all"
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>

          <div className="relative">
            <input 
              type="password" 
              className="w-full bg-slate-900/50 text-white placeholder-gray-400 px-5 py-4 rounded-2xl outline-none border border-black/20 focus:border-indigo-500 shadow-[inset_4px_4px_10px_rgba(0,0,0,0.6),inset_-4px_-4px_10px_rgba(255,255,255,0.05)] transition-all"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>

          <button 
            type="submit" 
            className="w-full bg-gradient-to-b from-indigo-400 to-indigo-600 text-white font-bold py-4 rounded-2xl shadow-[0_6px_0_theme(colors.indigo.800),0_15px_20px_rgba(0,0,0,0.4)] active:shadow-[0_0px_0_theme(colors.indigo.800),0_0px_0_rgba(0,0,0,0.4)] active:translate-y-[6px] transition-all duration-150 tracking-wide uppercase"
          >
            {isSignUp ? "Sign Up" : "Sign In"}
          </button>
        </form>

        <div className="flex items-center my-6">
          <div className="flex-grow h-px bg-white/20 shadow-[0_1px_0_rgba(0,0,0,0.5)]"></div>
          <span className="px-4 text-white/50 text-xs font-bold tracking-widest uppercase text-shadow-sm">OR</span>
          <div className="flex-grow h-px bg-white/20 shadow-[0_1px_0_rgba(0,0,0,0.5)]"></div>
        </div>

        <button 
          type="button" 
          onClick={handleGoogleLogin}
          className="w-full bg-white text-gray-800 font-bold py-4 rounded-2xl shadow-[0_6px_0_theme(colors.gray.300),0_15px_20px_rgba(0,0,0,0.3)] active:shadow-[0_0px_0_theme(colors.gray.300),0_0px_0_rgba(0,0,0,0.3)] active:translate-y-[6px] transition-all duration-150 flex justify-center items-center gap-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.1H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.9l3.66-2.81z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.1l3.66 2.81c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          SIGN IN WITH GOOGLE
        </button>        
        
        <p className="text-center text-sm text-indigo-200 mt-8 font-medium">
          {isSignUp ? "Already a commander?" : "Need admin access?"}{" "}
          <button 
            type="button"
            onClick={() => setIsSignUp(!isSignUp)} 
            className="text-white font-bold hover:text-indigo-300 transition-colors drop-shadow-md"
          >
            {isSignUp ? "Login Here" : "Sign Up"}
          </button>
        </p>

      </div>
    </div>
  );
}
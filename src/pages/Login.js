import React, { useState } from 'react';
import { db } from '../config/firebase';
// Firebase firestore methods import karein
import { collection, query, where, getDocs } from 'firebase/firestore'; 

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(''); // Error show karne ke liye state

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(''); // Naya login attempt hone par purana error hata dein

    try {
      // 1. Database mein 'users' collection ko target karein
      const usersRef = collection(db, 'employees');
      
      // 2. Query banayein jo email aur password dono ko match kare
     const q = query(
  usersRef, 
  where('email', '==', email.trim()), 
  where('password', '==', password.trim())
);
      
      // 3. Database se data fetch karein
      const querySnapshot = await getDocs(q);

      // 4. Agar result empty hai, matlab admin ne ye user nahi banaya ya password galat hai
      if (querySnapshot.empty) {
        setError('Invalid email or password. Only admin-approved users can log in.');
        return; // Yahan se function rok dein, aage code run nahi hoga
      }

      // 5. Agar user mil gaya toh login success
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('userCred', JSON.stringify({ email: email }));
      
      window.location.reload(); 
      
    } catch (err) {
      console.error("Login Error: ", err);
      setError('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-purple-50 p-6">
      <div className="bg-white w-full max-w-5xl rounded-[3rem] shadow-[20px_20px_60px_rgba(147,51,234,0.15),-20px_-20px_60px_rgba(255,255,255,1)] overflow-hidden flex flex-col md:flex-row min-h-[600px]">
        
        <div className="hidden md:flex flex-col w-1/2 relative overflow-hidden rounded-l-[3rem] group shadow-[inset_-10px_0_20px_rgba(0,0,0,0.1)]">
          <img 
            src="https://img.magnific.com/premium-photo/modern-office-interior-with-computers-isometric-composition-3d-illustration_452042-16.jpg?semt=ais_hybrid&w=720&q=40" 
            alt="Welcome" 
            className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110" 
          />
          <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/10 to-black/60 shadow-[inset_0_0_40px_rgba(0,0,0,0.6)] pointer-events-none transition-all duration-700 group-hover:bg-black/30"></div>
          <div className="absolute top-12 left-12 text-white z-10 transform transition-all duration-500 group-hover:-translate-y-2 group-hover:translate-x-2">
            <h5 className="text-3xl font-extrabold mb-4 drop-shadow-[0_5px_5px_rgba(0,0,0,0.8)] leading-tight">
              Welcome back! ✨Task Marter.
            </h5>
            <p className="text-lg font-bold text-green-300 drop-shadow-[0_3px_3px_rgba(0,0,0,0.9)] opacity-100 max-w-sm">
             Log in to manage your tasks and stay productive.
            </p>
          </div>
        </div>
        
        <div className="w-full md:w-1/2 p-12 flex flex-col justify-center bg-gray-50/50">
          <h2 className="text-3xl font-bold text-slate-900 mb-2">Log in to your TaskMaster</h2>
          <p className="text-slate-500 mb-8 text-center font-medium">We're happy to see you again! 💜</p>

          <form onSubmit={handleLogin} className="space-y-6">
            
            {/* Error Message UI */}
            {error && (
              <div className="bg-red-100 border border-red-300 text-red-600 px-4 py-3 rounded-2xl text-sm font-semibold animate-pulse">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Email address</label>
              <input 
                type="email" 
                placeholder="Enter your email" 
                className="w-full p-4 bg-purple-50 rounded-2xl outline-none border border-transparent focus:border-purple-300 shadow-[inset_5px_5px_10px_rgba(0,0,0,0.1),inset_-5px_-5px_10px_rgba(255,255,255,1)] transition-all" 
                onChange={(e) => setEmail(e.target.value)} 
                required 
              />
            </div>

            <div>
              <label className="block text-sm mb-3 font-bold text-slate-700 mb-2">Password</label>
              <input 
                type="password" 
                placeholder="Enter your password" 
                className="w-full p-4 bg-purple-50 rounded-2xl outline-none border border-transparent focus:border-purple-300 shadow-[inset_5px_5px_10px_rgba(0,0,0,0.1),inset_-5px_-5px_10px_rgba(255,255,255,1)] transition-all" 
                onChange={(e) => setPassword(e.target.value)} 
                required 
              />
            </div>

            <button 
              type="submit"
              className="w-full bg-purple-600 text-white py-4 rounded-2xl font-bold shadow-[2px_6px_0_#581c87,0_15px_20px_rgba(147,51,234,0.3)] active:shadow-[0_0px_0_#581c87,0_0px_0_rgba(147,51,234,0.3)] active:translate-y-[6px] transition-all duration-150 uppercase tracking-wider"
            >
              Log in
            </button>
          </form>
          
        </div>
      </div>
    </div>
  );
}
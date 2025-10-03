"use client";

import { useState } from "react";
import { useRouter } from "next/navigation"; // for redirect
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../../lib/firebase";

export default function Login() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  const handleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user); // save logged in user
      router.push("/dashboard") // redirect after login
    } catch (e) {
      console.error(e);
      alert("Login failed. Check console.");
    }
  };

  return (
    <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
      {user ? (
        <h2>Welcome, {user.displayName}</h2>
      ) : (
        <>
          <h1>Admin Login</h1>
          <button
            onClick={handleLogin}
            className="px-4 py-2 rounded-lg border border-grey-400 hover:border-blue-500 hover:bg-blue-500 hover:text-white transition"
            >
            Sign in with Google
          </button>
        </>
      )}
    </div>
  );
}

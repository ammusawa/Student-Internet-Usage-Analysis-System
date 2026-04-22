"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import axios from "axios";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const apiBase = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://127.0.0.1:8000";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      await axios.post(`${apiBase}/register`, { name, username, password });
      setMessage("Registration submitted. Wait for admin approval before login.");
      const nextUrl = searchParams.get("next") || "/portal";
      setTimeout(() => router.push(`/login?next=${encodeURIComponent(nextUrl)}`), 1200);
    } catch (err) {
      setError(err.response?.data?.detail || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="glass-card" style={{ padding: "2rem", width: "100%", maxWidth: "420px" }}>
        <h1 style={{ marginBottom: "0.5rem" }}>Student Registration</h1>
        <p style={{ color: "#94a3b8", marginBottom: "1rem" }}>Create an account for captive portal access.</p>
        {error && <div style={{ color: "var(--danger)", marginBottom: "0.8rem" }}>{error}</div>}
        {message && <div style={{ color: "var(--success)", marginBottom: "0.8rem" }}>{message}</div>}
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.8rem" }}>
          <input className="input-field" placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="input-field" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          <input type="password" className="input-field" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="btn-primary" disabled={loading}>{loading ? "Submitting..." : "Register"}</button>
        </form>
      </div>
    </div>
  );
}

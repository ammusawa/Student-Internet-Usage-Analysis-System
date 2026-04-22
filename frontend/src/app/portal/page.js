"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";

export default function PortalPage() {
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("Checking portal session...");
  const [portalInfo, setPortalInfo] = useState(null);
  const router = useRouter();
  const apiBase = typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "http://127.0.0.1:8000";

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setStatus("unauthenticated");
      setMessage("Login or register to access the internet.");
      return;
    }

    axios
      .get(`${apiBase}/portal/status`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setPortalInfo(res.data);
        setStatus("connected");
        setMessage("Connected successfully. Internet access granted - you can continue browsing.");
        return null;
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          localStorage.removeItem("token");
          setStatus("unauthenticated");
          setMessage("Session expired. Login again.");
          return;
        }
        setStatus("unauthenticated");
        setMessage("Login to activate your internet session.");
      });
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
      <div className="glass-card" style={{ width: "100%", maxWidth: "560px", padding: "2rem" }}>
        <h1 style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>Student Captive Portal</h1>
        <p style={{ color: "#94a3b8", marginBottom: "1rem" }}>{message}</p>

        {status === "connected" && (
          <div style={{ marginBottom: "1rem", border: "1px solid var(--border)", borderRadius: "8px", padding: "0.75rem" }}>
            <div style={{ color: "#94a3b8", fontSize: "0.85rem" }}>Portal Session</div>
            <div style={{ marginTop: "0.25rem" }}>IP: <span style={{ fontFamily: "monospace" }}>{portalInfo?.ip_address}</span></div>
            <div style={{ marginTop: "0.25rem", color: "var(--success)" }}>Status: Connected</div>
          </div>
        )}

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {status === "connected" ? (
            <>
              <button className="btn-primary" onClick={() => window.open("https://google.com", "_blank")}>
                Continue Browsing
              </button>
              <button
                className="btn-primary"
                style={{ background: "var(--danger)" }}
                onClick={() => router.push("/dashboard")}
              >
                Open Dashboard
              </button>
            </>
          ) : (
            <>
              <Link className="btn-primary" href="/login?next=/portal">
                Login
              </Link>
              <Link className="btn-primary" href="/register?next=/portal" style={{ background: "#8b5cf6" }}>
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

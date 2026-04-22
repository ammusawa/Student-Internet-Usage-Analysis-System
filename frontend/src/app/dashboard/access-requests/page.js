"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { getApiBase } from "@/lib/apiBase";

const API_BASE = getApiBase();

export default function AccessRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

  const fetchRequests = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API_BASE}/users/requests`, {
        headers: headers(),
        params: { status_filter: statusFilter },
      });
      setRequests(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load access requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((u) => u.username.toLowerCase().includes(q) || u.name.toLowerCase().includes(q));
  }, [requests, query]);

  const handleAction = async (userId, action) => {
    setError("");
    setSuccess("");
    try {
      await axios.post(`${API_BASE}/users/${userId}/${action}`, {}, { headers: headers() });
      setSuccess(`Request ${action}d successfully.`);
      await fetchRequests();
    } catch (err) {
      setError(err.response?.data?.detail || `Failed to ${action} request.`);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: "1.875rem", fontWeight: "bold", marginBottom: "0.5rem" }}>Access Requests</h1>
      <p style={{ color: "#94a3b8", marginBottom: "1rem" }}>
        Review student registrations and approve or reject internet access.
      </p>

      {error && <div style={{ color: "var(--danger)", marginBottom: "1rem" }}>{error}</div>}
      {success && <div style={{ color: "var(--success)", marginBottom: "1rem" }}>{success}</div>}

      <div className="glass-card" style={{ padding: "1rem", marginBottom: "1rem", display: "flex", gap: "0.75rem" }}>
        <select className="input-field" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
        <input
          className="input-field"
          placeholder="Search by name or username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="glass-card" style={{ padding: "1rem", overflow: "auto" }}>
        {loading ? (
          <p style={{ color: "#94a3b8" }}>Loading requests...</p>
        ) : filtered.length === 0 ? (
          <p style={{ color: "#94a3b8" }}>No matching requests.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "0.75rem" }}>Name</th>
                <th style={{ padding: "0.75rem" }}>Username</th>
                <th style={{ padding: "0.75rem" }}>Role</th>
                <th style={{ padding: "0.75rem" }}>Status</th>
                <th style={{ padding: "0.75rem" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "0.75rem" }}>{u.name}</td>
                  <td style={{ padding: "0.75rem", fontFamily: "monospace" }}>{u.username}</td>
                  <td style={{ padding: "0.75rem" }}>{u.role}</td>
                  <td style={{ padding: "0.75rem" }}>
                    <span style={{ color: u.approval_status === "approved" ? "var(--success)" : u.approval_status === "rejected" ? "var(--danger)" : "var(--warning)" }}>
                      {u.approval_status}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem", display: "flex", gap: "0.5rem" }}>
                    <button className="btn-primary" onClick={() => handleAction(u.id, "approve")} disabled={u.approval_status === "approved"}>
                      Approve
                    </button>
                    <button className="btn-primary" style={{ background: "var(--danger)" }} onClick={() => handleAction(u.id, "reject")} disabled={u.approval_status === "rejected"}>
                      Reject
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

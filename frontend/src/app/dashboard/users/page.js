"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { getApiBase } from "@/lib/apiBase";

const API_BASE = getApiBase();
const ROLE_OPTIONS = [
  { value: "network_analyst", label: "Network Analyst" },
  { value: "admin", label: "Admin" },
  { value: "student", label: "Student" },
  { value: "guest", label: "Guest" },
  { value: "co", label: "CO" },
];

export default function UsersPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [droppingUserId, setDroppingUserId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedUserTraffic, setSelectedUserTraffic] = useState(null);
  const [selectedUserTopSite, setSelectedUserTopSite] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    username: "",
    password: "",
    role: "student",
  });

  const getHeaders = () => {
    const token = localStorage.getItem("token");
    return { Authorization: `Bearer ${token}` };
  };

  const fetchUsersData = async () => {
    setLoading(true);
    setError("");
    try {
      const headers = getHeaders();
      const [meRes, usersRes] = await Promise.all([
        axios.get(`${API_BASE}/me`, { headers }),
        axios.get(`${API_BASE}/users`, { headers }),
      ]);
      setCurrentUser(meRes.data);
      setUsers(usersRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersData();
  }, []);

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const headers = getHeaders();
      await axios.post(`${API_BASE}/users`, form, { headers });
      setSuccess("User created successfully.");
      setForm({ name: "", username: "", password: "", role: "student" });
      await fetchUsersData();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create user.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUserClick = async (user) => {
    setSelectedUser(user);
    setSelectedUserTraffic(null);
    setSelectedUserTopSite(null);
    setDetailsLoading(true);
    setError("");
    try {
      const headers = getHeaders();
      const [trafficRes, topSiteRes] = await Promise.all([
        axios.get(`${API_BASE}/users/${user.id}/traffic`, { headers }),
        axios.get(`${API_BASE}/analysis/users/${user.id}/top-site`, { headers }),
      ]);
      setSelectedUserTraffic(trafficRes.data);
      setSelectedUserTopSite(topSiteRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load user traffic details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleDropUserAccess = async (userId) => {
    setDroppingUserId(userId);
    setError("");
    setSuccess("");
    try {
      const headers = getHeaders();
      await axios.post(`${API_BASE}/users/${userId}/drop-access`, {}, { headers });
      setSuccess("User dropped from WiFi and blocked until admin approval.");
      await fetchUsersData();
      if (selectedUser?.id === userId) {
        setSelectedUser(null);
        setSelectedUserTraffic(null);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to drop user access.");
    } finally {
      setDroppingUserId(null);
    }
  };


  if (loading) {
    return (
      <div style={{ color: "#94a3b8", textAlign: "center", padding: "2rem" }}>
        Loading users...
      </div>
    );
  }

  const isAdmin = currentUser?.role === "admin";

  return (
    <div style={{ animation: "fade-in 0.4s ease" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.875rem", fontWeight: "bold" }}>Users</h1>
        <p style={{ color: "#94a3b8" }}>
          Manage accounts and role access for your internet usage platform.
        </p>
      </div>

      {error && (
        <div
          style={{
            color: "var(--danger)",
            marginBottom: "1rem",
            padding: "0.75rem",
            border: "1px solid var(--danger)",
            borderRadius: "8px",
            background: "rgba(239, 68, 68, 0.1)",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            color: "var(--success)",
            marginBottom: "1rem",
            padding: "0.75rem",
            border: "1px solid var(--success)",
            borderRadius: "8px",
            background: "rgba(16, 185, 129, 0.1)",
          }}
        >
          {success}
        </div>
      )}

      {isAdmin ? (
        <>
        <div className="glass-card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
          <h3 style={{ marginBottom: "1rem", fontSize: "1.125rem" }}>Add New User</h3>
          <form onSubmit={handleCreateUser} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <input
              className="input-field glass"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => handleFormChange("name", e.target.value)}
              required
            />
            <input
              className="input-field glass"
              placeholder="Username"
              value={form.username}
              onChange={(e) => handleFormChange("username", e.target.value)}
              required
            />
            <input
              type="password"
              className="input-field glass"
              placeholder="Password"
              value={form.password}
              onChange={(e) => handleFormChange("password", e.target.value)}
              required
            />
            <select
              className="input-field glass"
              value={form.role}
              onChange={(e) => handleFormChange("role", e.target.value)}
              required
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button type="submit" className="btn-primary" disabled={submitting} style={{ gridColumn: "1 / -1" }}>
              {submitting ? "Creating User..." : "Create User"}
            </button>
          </form>
        </div>
        </>
      ) : (
        <div className="glass-card" style={{ padding: "1rem", marginBottom: "1.5rem", color: "#94a3b8" }}>
          You are logged in as `{currentUser?.role}`. Only admins can add users.
        </div>
      )}

      <div className="glass-card" style={{ padding: "1.25rem", overflow: "auto" }}>
        <h3 style={{ marginBottom: "1rem", fontSize: "1.125rem" }}>All Users</h3>
        <p style={{ color: "#94a3b8", marginBottom: "0.75rem", fontSize: "0.875rem" }}>
          Click a user row to view traffic and accessed websites.
        </p>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "0.75rem", color: "#94a3b8", fontWeight: "500" }}>Name</th>
              <th style={{ padding: "0.75rem", color: "#94a3b8", fontWeight: "500" }}>Username</th>
              <th style={{ padding: "0.75rem", color: "#94a3b8", fontWeight: "500" }}>Role</th>
              <th style={{ padding: "0.75rem", color: "#94a3b8", fontWeight: "500" }}>Approval</th>
              {isAdmin && <th style={{ padding: "0.75rem", color: "#94a3b8", fontWeight: "500", textAlign: "right" }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                onClick={() => handleUserClick(user)}
                style={{
                  borderBottom: "1px solid var(--border-light)",
                  cursor: "pointer",
                  background: selectedUser?.id === user.id ? "rgba(59, 130, 246, 0.08)" : "transparent",
                }}
              >
                <td style={{ padding: "0.75rem", fontWeight: "500" }}>{user.name}</td>
                <td style={{ padding: "0.75rem", fontFamily: "monospace" }}>{user.username}</td>
                <td style={{ padding: "0.75rem" }}>
                  <span
                    style={{
                      padding: "0.25rem 0.5rem",
                      borderRadius: "6px",
                      background: "var(--primary-transparent)",
                      color: "var(--primary)",
                      fontSize: "0.8rem",
                      textTransform: "capitalize",
                    }}
                  >
                    {user.role.replace("_", " ")}
                  </span>
                </td>
                <td style={{ padding: "0.75rem" }}>
                  <span style={{ color: user.approval_status === "approved" ? "var(--success)" : "var(--danger)" }}>
                    {user.approval_status}
                  </span>
                </td>
                {isAdmin && (
                  <td style={{ padding: "0.75rem", textAlign: "right" }}>
                    <button
                      className="btn-primary"
                      style={{ background: "var(--danger)", padding: "0.4rem 0.65rem" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDropUserAccess(user.id);
                      }}
                      disabled={droppingUserId === user.id || user.role === "admin"}
                    >
                      {droppingUserId === user.id ? "Dropping..." : "Drop WiFi"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="glass-card" style={{ padding: "1.25rem", marginTop: "1.5rem" }}>
        <h3 style={{ marginBottom: "1rem", fontSize: "1.125rem" }}>Selected User Activity</h3>
        {!selectedUser && (
          <p style={{ color: "#94a3b8" }}>Select a user from the table to view traffic details.</p>
        )}
        {selectedUser && detailsLoading && (
          <p style={{ color: "#94a3b8" }}>Loading activity for {selectedUser.username}...</p>
        )}
        {selectedUser && !detailsLoading && selectedUserTraffic && (
          <div>
            {selectedUserTopSite && (
              <div style={{ marginBottom: "0.8rem", color: "#94a3b8" }}>
                Most visited site: <strong style={{ color: "#fff" }}>{selectedUserTopSite.website}</strong> ({selectedUserTopSite.visits} visits)
              </div>
            )}
            <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
              <div style={{ padding: "0.75rem 1rem", border: "1px solid var(--border)", borderRadius: "8px" }}>
                <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Username</div>
                <div style={{ fontFamily: "monospace" }}>{selectedUserTraffic.username}</div>
              </div>
              <div style={{ padding: "0.75rem 1rem", border: "1px solid var(--border)", borderRadius: "8px" }}>
                <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Total Traffic</div>
                <div>{selectedUserTraffic.total_data_mb} MB</div>
              </div>
              <div style={{ padding: "0.75rem 1rem", border: "1px solid var(--border)", borderRadius: "8px" }}>
                <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Websites Accessed</div>
                <div>{selectedUserTraffic.accessed_sites.length}</div>
              </div>
            </div>

            {selectedUserTraffic.accessed_sites.length === 0 ? (
              <p style={{ color: "#94a3b8" }}>No access records available for this user yet.</p>
            ) : (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                {selectedUserTraffic.accessed_sites.map((site) => (
                  <span
                    key={site}
                    style={{
                      padding: "0.3rem 0.6rem",
                      borderRadius: "999px",
                      border: "1px solid var(--border)",
                      background: "rgba(139, 92, 246, 0.12)",
                      fontSize: "0.8rem",
                    }}
                  >
                    {site}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes fade-in {
              from { opacity: 0; transform: translateY(10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `,
        }}
      />
    </div>
  );
}

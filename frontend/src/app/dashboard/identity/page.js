"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { getApiBase } from "@/lib/apiBase";

const API_BASE = getApiBase();

export default function IdentityPage() {
  const [users, setUsers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [includeClosed, setIncludeClosed] = useState(false);
  const [connectForm, setConnectForm] = useState({
    user_id: "",
    ip_address: "",
    device_identifier: "",
    auth_source: "wifi_portal",
  });
  const [ipChangeForm, setIpChangeForm] = useState({
    session_id: "",
    ip_address: "",
  });
  const [disconnectSessionId, setDisconnectSessionId] = useState("");

  const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

  const fetchData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError("");
    try {
      const [meRes, usersRes, sessionsRes] = await Promise.all([
        axios.get(`${API_BASE}/me`, { headers: headers() }),
        axios.get(`${API_BASE}/users`, { headers: headers() }),
        axios.get(`${API_BASE}/identity/sessions`, {
          headers: headers(),
          params: { include_closed: includeClosed },
        }),
      ]);
      setCurrentUser(meRes.data);
      setUsers(usersRes.data);
      setSessions(sessionsRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load identity data.");
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [includeClosed]);

  const doAction = async (request, successMessage) => {
    setActionLoading(true);
    setError("");
    setSuccess("");
    try {
      await request();
      setSuccess(successMessage);
      await fetchData(false);
    } catch (err) {
      setError(err.response?.data?.detail || "Action failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConnect = async (e) => {
    e.preventDefault();
    await doAction(
      () =>
        axios.post(
          `${API_BASE}/identity/wifi-connect`,
          {
            user_id: Number(connectForm.user_id),
            ip_address: connectForm.ip_address,
            device_identifier: connectForm.device_identifier || null,
            auth_source: connectForm.auth_source || "wifi_portal",
          },
          { headers: headers() }
        ),
      "WiFi session created."
    );
    setConnectForm({ user_id: "", ip_address: "", device_identifier: "", auth_source: "wifi_portal" });
  };

  const handleIpChange = async (e) => {
    e.preventDefault();
    await doAction(
      () =>
        axios.post(
          `${API_BASE}/identity/sessions/${Number(ipChangeForm.session_id)}/ip-change`,
          { ip_address: ipChangeForm.ip_address },
          { headers: headers() }
        ),
      "IP updated for session."
    );
    setIpChangeForm({ session_id: "", ip_address: "" });
  };

  const handleDisconnect = async (e) => {
    e.preventDefault();
    await doAction(
      () =>
        axios.post(
          `${API_BASE}/identity/sessions/${Number(disconnectSessionId)}/disconnect`,
          {},
          { headers: headers() }
        ),
      "Session disconnected."
    );
    setDisconnectSessionId("");
  };

  if (loading) return <div style={{ color: "#94a3b8" }}>Loading identity controls...</div>;

  if (currentUser?.role !== "admin") {
    return (
      <div className="glass-card" style={{ padding: "1rem" }}>
        <h2 style={{ marginBottom: "0.5rem" }}>WiFi Identity Control</h2>
        <p style={{ color: "#94a3b8" }}>Only admins can manage identity sessions.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: "1.8rem", marginBottom: "0.3rem" }}>WiFi Identity Control</h1>
      <p style={{ color: "#94a3b8", marginBottom: "1.2rem" }}>
        Map users to sessions, track IP changes, and disconnect sessions.
      </p>

      {error && <div style={{ color: "var(--danger)", marginBottom: "0.8rem" }}>{error}</div>}
      {success && <div style={{ color: "var(--success)", marginBottom: "0.8rem" }}>{success}</div>}

      <div className="glass-card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <h3 style={{ marginBottom: "0.8rem" }}>Connect User To WiFi</h3>
        <form onSubmit={handleConnect} style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "repeat(4, 1fr)" }}>
          <select
            className="input-field"
            value={connectForm.user_id}
            onChange={(e) => setConnectForm((p) => ({ ...p, user_id: e.target.value }))}
            required
          >
            <option value="">Select user</option>
            {users.map((u) => (
              <option value={u.id} key={u.id}>
                {u.username}
              </option>
            ))}
          </select>
          <input
            className="input-field"
            placeholder="IP Address"
            value={connectForm.ip_address}
            onChange={(e) => setConnectForm((p) => ({ ...p, ip_address: e.target.value }))}
            required
          />
          <input
            className="input-field"
            placeholder="Device Identifier (optional)"
            value={connectForm.device_identifier}
            onChange={(e) => setConnectForm((p) => ({ ...p, device_identifier: e.target.value }))}
          />
          <input
            className="input-field"
            placeholder="Auth Source"
            value={connectForm.auth_source}
            onChange={(e) => setConnectForm((p) => ({ ...p, auth_source: e.target.value }))}
            required
          />
          <button disabled={actionLoading} className="btn-primary" style={{ gridColumn: "1 / -1" }}>
            Create Session
          </button>
        </form>
      </div>

      <div className="glass-card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <h3 style={{ marginBottom: "0.8rem" }}>Change Session IP</h3>
        <form onSubmit={handleIpChange} style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "1fr 1fr auto" }}>
          <input
            className="input-field"
            placeholder="Session ID"
            value={ipChangeForm.session_id}
            onChange={(e) => setIpChangeForm((p) => ({ ...p, session_id: e.target.value }))}
            required
          />
          <input
            className="input-field"
            placeholder="New IP Address"
            value={ipChangeForm.ip_address}
            onChange={(e) => setIpChangeForm((p) => ({ ...p, ip_address: e.target.value }))}
            required
          />
          <button disabled={actionLoading} className="btn-primary">
            Update IP
          </button>
        </form>
      </div>

      <div className="glass-card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <h3 style={{ marginBottom: "0.8rem" }}>Disconnect Session</h3>
        <form onSubmit={handleDisconnect} style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "1fr auto" }}>
          <input
            className="input-field"
            placeholder="Session ID"
            value={disconnectSessionId}
            onChange={(e) => setDisconnectSessionId(e.target.value)}
            required
          />
          <button disabled={actionLoading} className="btn-primary" style={{ background: "var(--danger)" }}>
            Disconnect
          </button>
        </form>
      </div>

      <div className="glass-card" style={{ padding: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.8rem" }}>
          <h3>Sessions</h3>
          <label style={{ color: "#94a3b8", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input type="checkbox" checked={includeClosed} onChange={(e) => setIncludeClosed(e.target.checked)} />
            Include closed
          </label>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>Session</th>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>User</th>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>IP</th>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>Device</th>
              <th style={{ textAlign: "left", padding: "0.5rem" }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.session_id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                <td style={{ padding: "0.5rem" }}>{s.session_id}</td>
                <td style={{ padding: "0.5rem" }}>{s.username}</td>
                <td style={{ padding: "0.5rem", fontFamily: "monospace" }}>{s.ip_address}</td>
                <td style={{ padding: "0.5rem" }}>{s.device_identifier || "N/A"}</td>
                <td style={{ padding: "0.5rem", color: s.logout_time ? "#94a3b8" : "var(--success)" }}>
                  {s.logout_time ? "Closed" : "Active"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

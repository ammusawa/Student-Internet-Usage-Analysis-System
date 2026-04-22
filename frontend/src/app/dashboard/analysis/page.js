"use client";

import { useEffect, useMemo, useState } from "react";
import { getApiBase } from "@/lib/apiBase";

export default function AnalysisPage() {
  const apiBase = getApiBase();
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [topWebsites, setTopWebsites] = useState([]);
  const [trafficRows, setTrafficRows] = useState([]);
  const [globalTopSite, setGlobalTopSite] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedUserTopSite, setSelectedUserTopSite] = useState(null);
  const [flaggedSites, setFlaggedSites] = useState([]);
  const [newFlaggedSite, setNewFlaggedSite] = useState("");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const leastVisitedSites = useMemo(() => {
    return [...trafficRows]
      .sort((a, b) => (a.total_data_mb || 0) - (b.total_data_mb || 0))
      .slice(0, 10);
  }, [trafficRows]);

  const fetchAll = async () => {
    setLoading(true);
    setMessage("");
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };
      const [meRes, usersRes, topUsersRes, topWebsitesRes, trafficRes, globalTopRes, flaggedRes] = await Promise.all([
        fetch(`${apiBase}/me`, { headers }),
        fetch(`${apiBase}/users`, { headers }),
        fetch(`${apiBase}/metrics/top-users`, { headers }),
        fetch(`${apiBase}/metrics/top-websites`, { headers }),
        fetch(`${apiBase}/metrics/traffic`, { headers }),
        fetch(`${apiBase}/analysis/top-site`, { headers }),
        fetch(`${apiBase}/flagged-sites`, { headers }),
      ]);

      if (!meRes.ok) throw new Error("Failed to load current user");
      const me = await meRes.json();
      setCurrentUser(me);
      if (me.role !== "admin") throw new Error("Admin access required");

      setUsers(usersRes.ok ? await usersRes.json() : []);
      setTopUsers(topUsersRes.ok ? await topUsersRes.json() : []);
      setTopWebsites(topWebsitesRes.ok ? await topWebsitesRes.json() : []);
      setTrafficRows(trafficRes.ok ? await trafficRes.json() : []);
      setGlobalTopSite(globalTopRes.ok ? await globalTopRes.json() : null);
      setFlaggedSites(flaggedRes.ok ? await flaggedRes.json() : []);
    } catch (err) {
      setMessage(err.message || "Failed to load analysis data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleAnalyzeUser = async () => {
    if (!selectedUserId) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiBase}/analysis/users/${selectedUserId}/top-site`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load user analysis");
      setSelectedUserTopSite(await res.json());
    } catch (err) {
      setMessage(err.message || "Could not analyze selected user.");
    }
  };

  const handleAddFlagged = async () => {
    if (!newFlaggedSite.trim()) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${apiBase}/flagged-sites`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ website: newFlaggedSite.trim().toLowerCase() }),
      });
      if (!res.ok) throw new Error("Failed to add flagged site");
      setNewFlaggedSite("");
      await fetchAll();
      setMessage("Flagged site saved.");
    } catch (err) {
      setMessage(err.message || "Could not add flagged site.");
    }
  };

  const toggleFlag = async (siteId, activate) => {
    try {
      const token = localStorage.getItem("token");
      const endpoint = activate ? "activate" : "deactivate";
      const res = await fetch(`${apiBase}/flagged-sites/${siteId}/${endpoint}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to update flagged site");
      await fetchAll();
    } catch (err) {
      setMessage(err.message || "Could not update flagged site.");
    }
  };

  if (loading) return <div style={{ color: "#94a3b8" }}>Loading analysis...</div>;
  if (currentUser?.role !== "admin") return <div style={{ color: "#f87171" }}>Admin access required.</div>;

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", animation: "fade-in 0.35s ease" }}>
      <h1 style={{ fontSize: "1.8rem", fontWeight: 700, marginBottom: "0.4rem" }}>Admin Analysis</h1>
      <p style={{ color: "#94a3b8", marginBottom: "1rem" }}>
        Analyze visited sites, user behavior, and security trends.
      </p>
      {message && <div style={{ marginBottom: "1rem", color: "#f59e0b" }}>{message}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
        <div className="glass-card" style={{ padding: "0.9rem" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Most Visited Site</div>
          <div style={{ fontWeight: 700, marginTop: "0.2rem", wordBreak: "break-all" }}>{globalTopSite?.website || "N/A"}</div>
          <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>{globalTopSite?.visits || 0} visits</div>
        </div>
        <div className="glass-card" style={{ padding: "0.9rem" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Highest Traffic User</div>
          <div style={{ fontWeight: 700, marginTop: "0.2rem" }}>{topUsers[0]?.username || "N/A"}</div>
          <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>{topUsers[0]?.data_mb || 0} MB</div>
        </div>
        <div className="glass-card" style={{ padding: "0.9rem" }}>
          <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>Flagged Sites</div>
          <div style={{ fontWeight: 700, marginTop: "0.2rem" }}>{flaggedSites.filter((s) => s.is_active === 1).length}</div>
          <div style={{ color: "#94a3b8", fontSize: "0.8rem" }}>active rules</div>
        </div>
      </div>

      <div className="glass-card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0, marginBottom: "0.7rem" }}>User-Specific Analysis</h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <select className="input-field glass" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
            <option value="">Select user</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.username}</option>
            ))}
          </select>
          <button className="btn-primary" onClick={handleAnalyzeUser}>Analyze User</button>
        </div>
        {selectedUserTopSite && (
          <p style={{ marginTop: "0.75rem", color: "#94a3b8" }}>
            Most visited by <strong>{selectedUserTopSite.username}</strong>: <strong style={{ color: "#fff" }}>{selectedUserTopSite.website}</strong> ({selectedUserTopSite.visits} visits)
          </p>
        )}
      </div>

      <div className="glass-card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Flagged Sites (Auto-Block)</h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <input className="input-field glass" placeholder="example.com" value={newFlaggedSite} onChange={(e) => setNewFlaggedSite(e.target.value)} />
          <button className="btn-primary" onClick={handleAddFlagged}>Add Flagged Site</button>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {flaggedSites.map((site) => (
            <span key={site.id} style={{ border: "1px solid var(--border)", borderRadius: "999px", padding: "0.25rem 0.6rem" }}>
              {site.website} {site.is_active ? "(active)" : "(inactive)"}
              <button onClick={() => toggleFlag(site.id, site.is_active !== 1)} style={{ marginLeft: "0.5rem", background: "transparent", border: "none", color: "var(--primary)", cursor: "pointer" }}>
                {site.is_active ? "Disable" : "Enable"}
              </button>
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem" }}>
        <div className="glass-card" style={{ padding: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Highest Traffic Users</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {topUsers.slice(0, 10).map((u, idx) => (
                <tr key={`${u.username}-${idx}`} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "0.55rem 0.2rem" }}>{u.username}</td>
                  <td style={{ padding: "0.55rem 0.2rem", textAlign: "right", fontFamily: "monospace" }}>{u.data_mb} MB</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="glass-card" style={{ padding: "1rem" }}>
          <h3 style={{ marginTop: 0 }}>Most Visited Websites</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {topWebsites.slice(0, 10).map((w, idx) => (
                <tr key={`${w.website}-${idx}`} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "0.55rem 0.2rem", wordBreak: "break-all" }}>{w.website}</td>
                  <td style={{ padding: "0.55rem 0.2rem", textAlign: "right", fontFamily: "monospace" }}>{w.data_mb} MB</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="glass-card" style={{ padding: "1rem", marginTop: "0.9rem" }}>
        <h3 style={{ marginTop: 0 }}>Least Visited Websites</h3>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {leastVisitedSites.map((w, idx) => (
              <tr key={`${w.website}-${idx}`} style={{ borderBottom: "1px solid var(--border-light)" }}>
                <td style={{ padding: "0.55rem 0.2rem", wordBreak: "break-all" }}>{w.website}</td>
                <td style={{ padding: "0.55rem 0.2rem", textAlign: "right", fontFamily: "monospace" }}>{w.total_data_mb} MB</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

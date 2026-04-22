"use client";

import { useEffect, useState } from "react";
import { getApiBase } from "@/lib/apiBase";

export default function DataPage() {
  const apiBase = getApiBase();
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [logRows, setLogRows] = useState([]);
  const [selectedUserFilter, setSelectedUserFilter] = useState("");
  const [websiteFilter, setWebsiteFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const token = localStorage.getItem("token");
        const meRes = await fetch(`${apiBase}/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!meRes.ok) throw new Error("Failed to load current user");
        const me = await meRes.json();
        setCurrentUser(me);

        if (me.role === "admin") {
          const usersRes = await fetch(`${apiBase}/users`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (usersRes.ok) setUsers(await usersRes.json());
        }
      } catch (error) {
        setMessage(error.message || "Failed to load data page");
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, [apiBase]);

  const buildParams = (includeUser = true) => {
    const params = new URLSearchParams();
    if (websiteFilter.trim()) params.set("website", websiteFilter.trim());
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    if (includeUser && selectedUserFilter) params.set("user_id", selectedUserFilter);
    return params.toString();
  };

  const fetchLogs = async (includeUser = true) => {
    const token = localStorage.getItem("token");
    const query = buildParams(includeUser);
    const res = await fetch(`${apiBase}/metrics/logs${query ? `?${query}` : ""}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Failed to fetch logs");
    }
    return res.json();
  };

  const applyFilters = async () => {
    setMessage("");
    try {
      const rows = await fetchLogs(true);
      setLogRows(rows);
      setMessage(`Loaded ${rows.length} logs.`);
    } catch (error) {
      setMessage(error.message || "Failed to apply filters.");
    }
  };

  const downloadCsv = async (scope = "filtered") => {
    setExporting(true);
    setMessage("");
    try {
      const token = localStorage.getItem("token");
      const includeUser = scope !== "all";
      const query = buildParams(includeUser);
      const res = await fetch(`${apiBase}/metrics/logs/export${query ? `?${query}` : ""}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to export CSV");
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = scope === "individual" ? "individual_logs.csv" : scope === "all" ? "all_logs.csv" : "filtered_logs.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (error) {
      setMessage(error.message || "CSV export failed.");
    } finally {
      setExporting(false);
    }
  };

  const printLogs = async (scope = "filtered") => {
    setMessage("");
    try {
      const rows = await fetchLogs(scope !== "all");
      const title = scope === "individual" ? "Individual Logs" : scope === "all" ? "All Logs" : "Filtered Logs";
      const opened = window.open("", "_blank", "width=1200,height=800");
      if (!opened) {
        setMessage("Popup blocked. Allow popups to print.");
        return;
      }
      const htmlRows = rows
        .map(
          (r) => `
        <tr>
          <td>${new Date(r.timestamp).toLocaleString()}</td>
          <td>${r.username}</td>
          <td>${r.website}</td>
          <td>${r.data_used_mb}</td>
          <td>${r.ip_address}</td>
          <td>${r.role}</td>
        </tr>
      `
        )
        .join("");
      opened.document.write(`
        <html>
          <head><title>${title}</title></head>
          <body style="font-family: Arial, sans-serif; padding: 24px;">
            <h2>${title}</h2>
            <p>Generated: ${new Date().toLocaleString()}</p>
            <table border="1" cellspacing="0" cellpadding="6" style="width:100%; border-collapse: collapse;">
              <thead>
                <tr><th>Time</th><th>User</th><th>Website</th><th>Data MB</th><th>IP</th><th>Role</th></tr>
              </thead>
              <tbody>${htmlRows || '<tr><td colspan="6">No logs found</td></tr>'}</tbody>
            </table>
          </body>
        </html>
      `);
      opened.document.close();
      opened.focus();
      opened.print();
    } catch (error) {
      setMessage(error.message || "Print failed.");
    }
  };

  if (loading) return <div style={{ color: "var(--text-muted)" }}>Loading data tools...</div>;

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: "0.6rem" }}>Data</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "1.25rem" }}>
        Filter logs by user, site, and date range, then export or print reports.
      </p>
      {message && <div style={{ marginBottom: "0.8rem", color: "#f59e0b" }}>{message}</div>}
      <div className="glass-card" style={{ padding: "1rem", marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Logs Export / Print</h3>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.7rem" }}>
          {currentUser?.role === "admin" && (
            <select className="input-field glass" value={selectedUserFilter} onChange={(e) => setSelectedUserFilter(e.target.value)}>
              <option value="">All users</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                </option>
              ))}
            </select>
          )}
          <input className="input-field glass" placeholder="Website contains..." value={websiteFilter} onChange={(e) => setWebsiteFilter(e.target.value)} />
          <input className="input-field glass" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <input className="input-field glass" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          <button className="btn-primary" onClick={applyFilters}>
            Apply Filter
          </button>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.8rem" }}>
          <button className="btn-primary" onClick={() => downloadCsv("filtered")} disabled={exporting}>
            Download Filtered
          </button>
          <button className="btn-primary" onClick={() => printLogs("filtered")}>
            Print Filtered
          </button>
          {currentUser?.role === "admin" && (
            <>
              <button className="btn-primary" onClick={() => downloadCsv("all")} disabled={exporting}>
                Download All
              </button>
              <button className="btn-primary" onClick={() => printLogs("all")}>
                Print All
              </button>
              <button className="btn-primary" onClick={() => downloadCsv("individual")} disabled={exporting || !selectedUserFilter}>
                Download Individual
              </button>
              <button className="btn-primary" onClick={() => printLogs("individual")} disabled={!selectedUserFilter}>
                Print Individual
              </button>
            </>
          )}
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)" }}>Time</th>
                <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)" }}>User</th>
                <th style={{ textAlign: "left", padding: "0.5rem", color: "var(--text-muted)" }}>Website</th>
                <th style={{ textAlign: "right", padding: "0.5rem", color: "var(--text-muted)" }}>Data MB</th>
              </tr>
            </thead>
            <tbody>
              {logRows.slice(0, 30).map((row) => (
                <tr key={row.log_id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                  <td style={{ padding: "0.5rem" }}>{new Date(row.timestamp).toLocaleString()}</td>
                  <td style={{ padding: "0.5rem" }}>{row.username}</td>
                  <td style={{ padding: "0.5rem", wordBreak: "break-all" }}>{row.website}</td>
                  <td style={{ padding: "0.5rem", textAlign: "right", fontFamily: "monospace" }}>{row.data_used_mb.toFixed(4)}</td>
                </tr>
              ))}
              {logRows.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ padding: "0.75rem", color: "var(--text-muted)" }}>
                    No filtered logs loaded yet. Click Apply Filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

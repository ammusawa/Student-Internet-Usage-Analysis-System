"use client";

import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
  LineChart, Line, Legend
} from 'recharts';
import { Users, Globe, Database, ArrowUpRight } from 'lucide-react';
import { getApiBase } from '@/lib/apiBase';

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#0ea5e9'];

export default function Dashboard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [topUsers, setTopUsers] = useState([]);
  const [topWebsites, setTopWebsites] = useState([]);
  const [categoryUsage, setCategoryUsage] = useState([]);
  const [trends, setTrends] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [proxyActiveClients, setProxyActiveClients] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const API_BASE = getApiBase();

      const meRes = await axios.get(`${API_BASE}/me`, { headers });
      setCurrentUser(meRes.data);

      if (meRes.data?.role === 'admin') {
        const [sumRes, usersRes, sitesRes, catRes, trendsRes, onlineRes, proxyClientsRes] = await Promise.all([
          axios.get(`${API_BASE}/metrics/usage-summary`, { headers }),
          axios.get(`${API_BASE}/metrics/top-users`, { headers }),
          axios.get(`${API_BASE}/metrics/top-websites`, { headers }),
          axios.get(`${API_BASE}/metrics/usage-by-category`, { headers }),
          axios.get(`${API_BASE}/metrics/trends`, { headers }),
          axios.get(`${API_BASE}/metrics/online-users`, { headers }),
          axios.get(`${API_BASE}/metrics/proxy-active-clients`, { headers })
        ]);

        setSummary(sumRes.data);
        setTopUsers(usersRes.data);
        setTopWebsites(sitesRes.data);
        setCategoryUsage(catRes.data);
        setTrends(trendsRes.data);
        setOnlineUsers(onlineRes.data);
        setProxyActiveClients(proxyClientsRes.data);
      } else {
        const myTrafficRes = await axios.get(`${API_BASE}/metrics/my-traffic`, { headers });
        const myTraffic = myTrafficRes.data || [];
        const totalDataMb = myTraffic.reduce((acc, item) => acc + (item.total_data_mb || 0), 0);
        const topWebsite = myTraffic.length > 0
          ? [...myTraffic].sort((a, b) => (b.total_data_mb || 0) - (a.total_data_mb || 0))[0].website
          : 'N/A';

        setSummary({
          total_data_mb: Number(totalDataMb.toFixed(2)),
          total_users: 1,
          top_website: topWebsite
        });
        setTopWebsites(
          myTraffic.map((item) => ({
            website: item.website,
            data_mb: Number((item.total_data_mb || 0).toFixed(2)),
            category: 'My Activity'
          }))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#94a3b8' }}>Loading metrics...</div>;
  }

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div style={{ animation: 'fade-in 0.5s ease' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>
          {isAdmin ? 'Overview Analytics' : 'My Overview'}
        </h1>
        <p style={{ color: '#94a3b8' }}>
          {isAdmin
            ? 'Comprehensive breakdown of student internet proxy traffic.'
            : 'Personal breakdown of your internet usage and activity.'}
        </p>
      </div>

      <div className="dashboard-grid">
        <div className="glass-card metric-card">
          <div className="metric-header">
            <span>Total Bandwidth</span>
            <Database size={18} color="var(--primary)" />
          </div>
          <div className="metric-value">{summary?.total_data_mb || 0} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>MB</span></div>
          <div style={{ marginTop: 'auto', paddingTop: '1rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.875rem' }}>
            <ArrowUpRight size={14} />
            <span>Updated live from logs</span>
          </div>
        </div>
        
        <div className="glass-card metric-card">
          <div className="metric-header">
            <span>{isAdmin ? 'Active Student Sessions' : 'My Sessions'}</span>
            <Users size={18} color="#8b5cf6" />
          </div>
          <div className="metric-value">{summary?.total_users || 0}</div>
        </div>

        <div className="glass-card metric-card">
          <div className="metric-header">
            <span>Most Visited Domain</span>
            <Globe size={18} color="#10b981" />
          </div>
          <div className="metric-value" style={{ fontSize: '1.5rem', wordBreak: 'break-all' }}>{summary?.top_website || 'N/A'}</div>
        </div>
        {isAdmin && (
          <div className="glass-card metric-card">
            <div className="metric-header">
              <span>Currently Online Users</span>
              <Users size={18} color="#22c55e" />
            </div>
            <div className="metric-value">{onlineUsers.length}</div>
          </div>
        )}
        {isAdmin && (
          <div className="glass-card metric-card">
            <div className="metric-header">
              <span>Proxy Active Clients (10m)</span>
              <Users size={18} color="#f59e0b" />
            </div>
            <div className="metric-value">{proxyActiveClients.length}</div>
          </div>
        )}
      </div>

      {isAdmin && (
      <div className="charts-grid">
        <div className="glass-card chart-card">
          <h3 className="chart-title">Data Usage Trends</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trends}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}MB`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Line type="monotone" dataKey="data_mb" stroke="var(--primary)" strokeWidth={3} dot={{ fill: 'var(--primary)', strokeWidth: 2 }} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-card chart-card">
          <h3 className="chart-title">Bandwidth by Category</h3>
          <div className="chart-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            {categoryUsage.length === 0 ? <div style={{ color: '#94a3b8' }}>No category data yet.</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryUsage}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="data_mb"
                    nameKey="category"
                  >
                    {categoryUsage.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                    formatter={(value) => `${value} MB`}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
      )}

      <div className="charts-grid" style={{ gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr' }}>
         {isAdmin && (
         <div className="glass-card chart-card">
          <h3 className="chart-title">Top Consumers (Students)</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topUsers} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}MB`} />
                <YAxis type="category" dataKey="username" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} width={80} />
                <Tooltip 
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                />
                <Bar dataKey="data_mb" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        )}

        <div className="glass-card" style={{ padding: '1.5rem', overflow: 'auto' }}>
          <h3 className="chart-title">{isAdmin ? 'Top Explored Websites' : 'My Top Websites'}</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>Website</th>
                <th style={{ padding: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>Category</th>
                <th style={{ padding: '0.75rem', color: '#94a3b8', fontWeight: '500', textAlign: 'right' }}>Usage (MB)</th>
              </tr>
            </thead>
            <tbody>
              {topWebsites.map((site, index) => (
                <tr key={index} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '0.75rem', fontWeight: '500' }}>{site.website}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', background: 'var(--primary-transparent)', color: 'var(--primary)', fontSize: '0.75rem' }}>
                      {site.category}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right', fontFamily: 'monospace' }}>{site.data_mb}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && (
      <div className="glass-card" style={{ padding: '1.5rem', overflow: 'auto', marginBottom: '1.5rem' }}>
        <h3 className="chart-title">Online Users (Portal Sessions)</h3>
        {onlineUsers.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>No users currently online.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>Username</th>
                <th style={{ padding: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>IP</th>
                <th style={{ padding: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>Device</th>
                <th style={{ padding: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>Last Heartbeat</th>
              </tr>
            </thead>
            <tbody>
              {onlineUsers.map((item) => (
                <tr key={`${item.user_id}-${item.ip_address}`} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '0.75rem' }}>{item.username}</td>
                  <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>{item.ip_address}</td>
                  <td style={{ padding: '0.75rem' }}>{item.device_identifier || 'N/A'}</td>
                  <td style={{ padding: '0.75rem' }}>{item.last_heartbeat_at ? new Date(item.last_heartbeat_at).toLocaleString() : 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}

      {isAdmin && (
      <div className="glass-card" style={{ padding: '1.5rem', overflow: 'auto', marginBottom: '1.5rem' }}>
        <h3 className="chart-title">Proxy Active Clients (Last 10 Minutes)</h3>
        {proxyActiveClients.length === 0 ? (
          <p style={{ color: '#94a3b8' }}>No proxy-active clients in the current window.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>Username</th>
                <th style={{ padding: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>IP</th>
                <th style={{ padding: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>Sites</th>
                <th style={{ padding: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>Traffic (MB)</th>
                <th style={{ padding: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {proxyActiveClients.map((item, idx) => (
                <tr key={`${item.ip_address}-${item.username}-${idx}`} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '0.75rem' }}>{item.username}</td>
                  <td style={{ padding: '0.75rem', fontFamily: 'monospace' }}>{item.ip_address}</td>
                  <td style={{ padding: '0.75rem' }}>{item.website_count}</td>
                  <td style={{ padding: '0.75rem' }}>{item.total_data_mb}</td>
                  <td style={{ padding: '0.75rem' }}>{new Date(item.last_seen_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}

"use client";

import { useEffect, useState } from 'react';
import { getApiBase } from '@/lib/apiBase';

export default function TrafficPage() {
  const apiBase = getApiBase();
  const [trafficData, setTrafficData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);
  const [siteUsersTraffic, setSiteUsersTraffic] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [disconnectingSessionId, setDisconnectingSessionId] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [flaggedSites, setFlaggedSites] = useState([]);
  const [newFlaggedSite, setNewFlaggedSite] = useState('');

  useEffect(() => {
    const fetchTraffic = async () => {
      try {
        const token = localStorage.getItem('token');
        const meRes = await fetch(`${apiBase}/me`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        let me = null;
        if (meRes.ok) {
          me = await meRes.json();
          setCurrentUser(me);
        }

        const trafficUrl = me?.role === 'admin' ? `${apiBase}/metrics/traffic` : `${apiBase}/metrics/my-traffic`;
        const res = await fetch(trafficUrl, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (res.ok) {
          const data = await res.json();
          setTrafficData(data);
        }
        if (me?.role === 'admin') {
          const flaggedRes = await fetch(`${apiBase}/flagged-sites`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (flaggedRes.ok) {
            setFlaggedSites(await flaggedRes.json());
          }
        }
      } catch (error) {
        console.error('Error fetching traffic:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTraffic();
  }, []);

  const handleSiteClick = async (website) => {
    if (currentUser?.role !== 'admin') {
      return;
    }
    setSelectedSite(website);
    setShowModal(true);
    setDetailsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/metrics/traffic/${encodeURIComponent(website)}/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setSiteUsersTraffic(data);
      } else {
        setSiteUsersTraffic([]);
      }
    } catch (error) {
      console.error('Error fetching site user traffic:', error);
      setSiteUsersTraffic([]);
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setActionMessage('');
  };

  const handleDisconnectUser = async (sessionId) => {
    setDisconnectingSessionId(sessionId);
    setActionMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/identity/sessions/${sessionId}/disconnect`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to disconnect user');
      }
      setActionMessage('User disconnected from internet session successfully.');
    } catch (error) {
      setActionMessage(error.message || 'Failed to disconnect user.');
    } finally {
      setDisconnectingSessionId(null);
    }
  };

  const refreshFlaggedSites = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${apiBase}/flagged-sites`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      setFlaggedSites(await res.json());
    }
  };

  const handleAddFlaggedSite = async () => {
    if (!newFlaggedSite.trim()) return;
    setActionMessage('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${apiBase}/flagged-sites`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ website: newFlaggedSite.trim().toLowerCase() })
      });
      if (!res.ok) throw new Error('Failed to add flagged site');
      setNewFlaggedSite('');
      setActionMessage('Flagged site updated.');
      await refreshFlaggedSites();
    } catch (error) {
      setActionMessage(error.message || 'Could not add flagged site.');
    }
  };

  const toggleFlaggedSite = async (siteId, activate) => {
    try {
      const token = localStorage.getItem('token');
      const endpoint = activate ? 'activate' : 'deactivate';
      const res = await fetch(`${apiBase}/flagged-sites/${siteId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to update flagged site');
      await refreshFlaggedSites();
    } catch (_error) {
      setActionMessage('Could not update flagged site.');
    }
  };


  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '1.5rem' }}>Traffic Logs</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        {currentUser?.role === 'admin'
          ? 'View detailed traffic consumption and see which users accessed each site.'
          : 'View your personal internet traffic and websites you have accessed.'}
      </p>
      {currentUser?.role === 'admin' && (
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Flagged Sites (Auto-Block)</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <input
              className="input-field glass"
              placeholder="example.com"
              value={newFlaggedSite}
              onChange={(e) => setNewFlaggedSite(e.target.value)}
              style={{ minWidth: '240px' }}
            />
            <button className="btn-primary" onClick={handleAddFlaggedSite}>Add Flagged Site</button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {flaggedSites.map((site) => (
              <span key={site.id} style={{ border: '1px solid var(--border)', borderRadius: '999px', padding: '0.25rem 0.6rem' }}>
                {site.website} {site.is_active ? '(active)' : '(inactive)'}
                <button
                  onClick={() => toggleFlaggedSite(site.id, site.is_active !== 1)}
                  style={{ marginLeft: '0.5rem', background: 'transparent', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}
                >
                  {site.is_active ? 'Disable' : 'Enable'}
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Loading traffic logs...</div>
      ) : (
        <div className="card glass" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontWeight: '600' }}>
              {currentUser?.role === 'admin' ? 'Site Traffic Overview' : 'My Traffic Overview'}
            </h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: '600', color: 'var(--text-muted)' }}>Website</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: '600', color: 'var(--text-muted)' }}>Data Used (MB)</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: '600', color: 'var(--text-muted)' }}>
                    {currentUser?.role === 'admin' ? 'Users Connected' : 'You'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {trafficData.length === 0 && (
                  <tr>
                    <td colSpan="3" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No traffic logs available.</td>
                  </tr>
                )}
                {trafficData.map((item, index) => (
                  <tr
                    key={index}
                    onClick={() => handleSiteClick(item.website)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: currentUser?.role === 'admin' ? 'pointer' : 'default',
                      background: selectedSite === item.website ? 'rgba(59,130,246,0.08)' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '1rem 1.5rem', fontWeight: '500' }}>{item.website}</td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span style={{ 
                        background: 'var(--primary-transparent)', 
                        color: 'var(--primary)', 
                        padding: '0.25rem 0.5rem', 
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        fontSize: '0.875rem'
                      }}>
                        {item.total_data_mb.toFixed(2)}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {item.users.map((user, i) => (
                          <span key={i} style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid var(--border)',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '20px',
                            fontSize: '0.8rem',
                            color: 'var(--text-muted)'
                          }}>
                            {user}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && currentUser?.role === 'admin' && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div
            className="glass-card"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(1000px, 95vw)', maxHeight: '85vh', overflow: 'auto', padding: '1.25rem' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontWeight: '600' }}>{`User Traffic Details • ${selectedSite}`}</h3>
              <button className="btn-primary" onClick={closeModal}>Close</button>
            </div>
            {actionMessage && (
              <div style={{ marginBottom: '0.75rem', color: actionMessage.includes('successfully') ? 'var(--success)' : 'var(--danger)' }}>
                {actionMessage}
              </div>
            )}
            {detailsLoading ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Loading user traffic...</p>
            ) : siteUsersTraffic.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>No user traffic found for this site.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>User</th>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>Role</th>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>IP Address</th>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)' }}>Last Seen</th>
                    <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', textAlign: 'right' }}>Traffic (MB)</th>
                    {currentUser?.role === 'admin' && (
                      <th style={{ padding: '0.75rem 0.5rem', color: 'var(--text-muted)', textAlign: 'right' }}>Action</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {siteUsersTraffic.map((u, idx) => (
                    <tr key={`${u.session_id}-${u.username}-${u.ip_address}-${idx}`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{u.username}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textTransform: 'capitalize' }}>{u.role.replace('_', ' ')}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace' }}>{u.ip_address}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{u.last_seen_at ? new Date(u.last_seen_at).toLocaleString() : 'N/A'}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontFamily: 'monospace' }}>{u.total_data_mb.toFixed(4)}</td>
                      {currentUser?.role === 'admin' && (
                        <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                          <button
                            className="btn-primary"
                            style={{ background: 'var(--danger)', padding: '0.45rem 0.75rem' }}
                            onClick={() => handleDisconnectUser(u.session_id)}
                            disabled={disconnectingSessionId === u.session_id}
                          >
                            {disconnectingSessionId === u.session_id ? 'Disconnecting...' : 'Disconnect'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

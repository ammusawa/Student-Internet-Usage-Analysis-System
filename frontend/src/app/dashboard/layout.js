"use client";

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Upload, LogOut, Activity, Wifi, ShieldCheck, BarChart3, Database } from 'lucide-react';
import { getApiBase } from '@/lib/apiBase';

export default function DashboardLayout({ children }) {
  const apiBase = getApiBase();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [portalState, setPortalState] = useState({ label: 'Checking...', color: 'var(--warning)' });
  const [currentUser, setCurrentUser] = useState(null);
  const profileLabel = (currentUser?.name || currentUser?.username || 'User').trim();
  const profileInitials = profileLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';

  useEffect(() => {
    setMounted(true);
    // Protect route
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    fetch(`${apiBase}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setCurrentUser(data);
      })
      .catch(() => {});
  }, [apiBase, pathname, router]);

  const handleLogout = () => {
    const token = localStorage.getItem('token');
    if (token) {
      fetch(`${apiBase}/portal/logout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => {});
    }
    localStorage.removeItem('token');
    router.push('/login');
  };

  useEffect(() => {
    if (!mounted) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    const sendHeartbeat = () => {
      fetch(`${apiBase}/portal/heartbeat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
        .then((res) => {
          if (!res.ok) throw new Error('heartbeat failed');
          return fetch(`${apiBase}/portal/status`, {
            headers: { Authorization: `Bearer ${token}` },
          });
        })
        .then((res) => {
          if (!res.ok) throw new Error('status failed');
          return res.json();
        })
        .then((data) => {
          setPortalState({ label: `Online • ${data.ip_address}`, color: 'var(--success)' });
        })
        .catch(() => {
          setPortalState({ label: 'Offline', color: 'var(--danger)' });
        });
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 120000);
    return () => clearInterval(interval);
  }, [mounted]);

  if (!mounted) return null;

  return (
    <div className="app-layout">
      <nav className="sidebar">
        <div className="sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Activity color="var(--primary)" />
          <span>StudentAuth</span>
        </div>
        <div className="sidebar-nav">
          <Link href="/dashboard" className={`nav-item ${pathname === '/dashboard' ? 'active' : ''}`}>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>
          <Link href="/dashboard/traffic" className={`nav-item ${pathname === '/dashboard/traffic' ? 'active' : ''}`}>
            <Activity size={20} />
            <span>{currentUser?.role === 'admin' ? 'Traffic' : 'My Traffic'}</span>
          </Link>
          {currentUser?.role === 'admin' && (
            <>
              <Link href="/dashboard/users" className={`nav-item ${pathname === '/dashboard/users' ? 'active' : ''}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                <span>Users</span>
              </Link>
              <Link href="/dashboard/identity" className={`nav-item ${pathname === '/dashboard/identity' ? 'active' : ''}`}>
                <Wifi size={20} />
                <span>Identity</span>
              </Link>
              <Link href="/dashboard/access-requests" className={`nav-item ${pathname === '/dashboard/access-requests' ? 'active' : ''}`}>
                <ShieldCheck size={20} />
                <span>Access Requests</span>
              </Link>
              <Link href="/dashboard/analysis" className={`nav-item ${pathname === '/dashboard/analysis' ? 'active' : ''}`}>
                <BarChart3 size={20} />
                <span>Analysis</span>
              </Link>
              <Link href="/dashboard/data" className={`nav-item ${pathname === '/dashboard/data' ? 'active' : ''}`}>
                <Database size={20} />
                <span>Data</span>
              </Link>
              <Link href="/dashboard/upload" className={`nav-item ${pathname === '/dashboard/upload' ? 'active' : ''}`}>
                <Upload size={20} />
                <span>Upload Logs</span>
              </Link>
            </>
          )}
        </div>
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
          <button onClick={handleLogout} className="nav-item" style={{ width: '100%', borderRadius: '8px', cursor: 'pointer' }}>
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>
      
      <main className="main-content">
        <header className="topbar glass">
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>
            {currentUser?.role === 'admin' ? 'Admin Dashboard' : 'User Dashboard'}
          </h2>
          <div className="topbar-right">
            <div className="portal-pill" style={{ background: 'var(--primary-transparent)', color: 'var(--primary)', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.875rem', fontWeight: '500' }}>
              <span style={{ color: portalState.color }}>{portalState.label}</span>
            </div>
            <Link href="/dashboard/profile" className="profile-link" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="profile-meta" style={{ textAlign: 'right', lineHeight: 1.1 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600' }}>{profileLabel}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                  {currentUser?.role?.replace('_', ' ') || 'user'}
                </div>
              </div>
              <div
                title={profileLabel}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-focus))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold'
                }}
              >
                {currentUser?.profile_image_url ? (
                  <img
                    src={`${apiBase}${currentUser.profile_image_url}`}
                    alt={profileLabel}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  profileInitials
                )}
              </div>
            </Link>
          </div>
        </header>
        <div className="page-content">
          {children}
        </div>
      </main>
    </div>
  );
}

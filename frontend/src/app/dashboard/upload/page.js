"use client";

import { useState } from 'react';
import axios from 'axios';
import { getApiBase } from '@/lib/apiBase';
import { UploadCloud, CheckCircle, FileText, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function UploadLogs() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus({ type: '', msg: '' });
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setStatus({ type: '', msg: '' });

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);

      const res = await axios.post(`${getApiBase()}/upload-logs`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setStatus({ type: 'success', msg: `Successfully processed file! Inserted ${res.data.records_inserted} log records.` });
      setFile(null);
    } catch (err) {
      console.error(err);
      setStatus({ type: 'error', msg: err.response?.data?.detail || 'Failed to process file. Ensure it is a valid Proxy Log CSV.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ animation: 'fade-in 0.5s ease', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Upload Proxy Logs</h1>
        <p style={{ color: '#94a3b8' }}>Ingest proxy server traffic logs (.csv) format.</p>
      </div>

      <div className="glass-card" style={{ padding: '2rem' }}>
        <div 
          className="uploader-zone" 
          style={{ position: 'relative', overflow: 'hidden' }}
          onClick={() => document.getElementById('file-input').click()}
        >
          <input 
            type="file" 
            id="file-input" 
            accept=".csv,.txt"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <UploadCloud className="uploader-icon" size={48} />
          <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Drag & Drop or Click to Browse</h3>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Compatible with standard Squid / CCProxy CSV logs</p>
        </div>

        {file && (
          <div style={{ marginTop: '2rem', padding: '1rem', background: 'var(--surface-hover)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <FileText color="var(--primary)" />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: '500' }}>{file.name}</p>
              <p style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{(file.size / 1024).toFixed(2)} KB</p>
            </div>
            <button 
              onClick={handleUpload}
              className="btn-primary"
              disabled={loading}
              style={{ background: loading ? '#94a3b8' : 'var(--primary)' }}
            >
              {loading ? 'Processing...' : 'Ingest Logs'}
            </button>
          </div>
        )}

        {status.msg && (
          <div style={{ 
            marginTop: '1.5rem', 
            padding: '1rem', 
            borderRadius: '8px',
            background: status.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${status.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            {status.type === 'success' ? <CheckCircle color="var(--success)" /> : <AlertCircle color="var(--danger)" />}
            <span style={{ color: status.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>{status.msg}</span>
          </div>
        )}
      </div>

      <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center' }}>
        <Link href="/dashboard" style={{ color: 'var(--primary)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          &larr; Back to Dashboard
        </Link>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}

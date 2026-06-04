import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { apiClient } from '@/services/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import { formatBytes, formatDate } from '@/utils/format';
import type { Dataset } from '@/types/models';
import type { PaginatedResponse } from '@/types/api';
import {
  Database, Search, Filter, LogOut, User as UserIcon,
  Globe, Lock, AlertCircle, Loader2, Trash2, Shield
} from 'lucide-react';

export function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Search & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // Fetch Datasets via SWR
  const queryParams = new URLSearchParams();
  if (searchTerm) queryParams.append('search', searchTerm);
  if (visibilityFilter) queryParams.append('visibility', visibilityFilter);
  queryParams.append('page', String(page));
  queryParams.append('page_size', String(pageSize));

  const { data, error, isLoading, mutate } = useSWR<PaginatedResponse<Dataset>>(
    `/datasets?${queryParams.toString()}`,
    async (url: string) => {
      const res = await apiClient.get<PaginatedResponse<Dataset>>(url);
      return res.data;
    }
  );

  const handleDelete = async (dataset: Dataset) => {
    if (window.confirm(`MODERATION ACTION: Are you absolutely sure you want to delete the dataset "${dataset.name}" (owned by: ${dataset.owner?.username || dataset.owner_keycloak_id || 'Unknown'})? This action cannot be undone and will delete all files.`)) {
      try {
        await apiClient.delete(`/datasets/${dataset.slug}`);
        mutate();
      } catch (err: any) {
        alert(err.response?.data?.detail || 'Failed to delete dataset');
      }
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Premium Header */}
      <header className="glass-panel" style={{
        margin: '24px 24px 0 24px',
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: 'var(--radius-md)',
        borderBottom: '1px solid var(--glass-border)'
      }}>
        <div className="flex-center" style={{ gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/admin')}>
          <div className="flex-center" style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-sm)',
            background: 'linear-gradient(135deg, hsl(var(--accent-rose)), #9f1239)'
          }}>
            <Shield size={22} color="var(--color-white-fixed)" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Daggle</h2>
            <span style={{ fontSize: '0.68rem', color: 'hsl(var(--accent-rose))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Admin Moderation
            </span>
          </div>
        </div>

        {/* Global Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-glass-subtle)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass-subtle)' }}>
          <button
            onClick={() => navigate('/workspace')}
            style={{ padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'hsl(var(--text-secondary))', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.color = 'white'}
            onMouseOut={(e) => e.currentTarget.style.color = 'hsl(var(--text-secondary))'}
          >
            My Workspace
          </button>
          <button
            onClick={() => navigate('/explore')}
            style={{ padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'hsl(var(--text-secondary))', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.color = 'white'}
            onMouseOut={(e) => e.currentTarget.style.color = 'hsl(var(--text-secondary))'}
          >
            Explore
          </button>
          {user?.roles?.includes('admin') && (
            <button
              style={{ padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--bg-glass-hover)', color: 'hsl(var(--accent-rose))', cursor: 'default', fontWeight: 600 }}
            >
              <Shield size={14} style={{ display: 'inline-block', marginRight: '6px', verticalAlign: '-2px' }} />
              Admin
            </button>
          )}
        </div>

        {/* User Card / Login */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user && (
            <>
              <button
                onClick={() => navigate('/profile')}
                className="btn btn-secondary"
                style={{ padding: '6px 14px 6px 6px', fontSize: '0.85rem', borderRadius: '24px', border: '1px solid var(--border-glass-card)' }}
              >
                <div style={{
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, hsl(var(--accent-purple)), hsl(var(--accent-indigo)))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'hsl(var(--text-primary))'
                }}>
                  <UserIcon size={14} />
                </div>
                <span style={{ fontWeight: 600 }}>{user?.username || 'Profile'}</span>
              </button>
              <button onClick={logout} className="btn btn-secondary" style={{ padding: '8px', borderRadius: '50%', border: '1px solid var(--border-glass-card)' }} title="Logout">
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Area */}
      <main className="container" style={{ flex: 1, padding: '40px 0', width: '100%' }}>
        <div className="glass-panel animate-fade-in" style={{
          padding: '32px',
          marginBottom: '32px',
          background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.05) 0%, rgba(159, 18, 57, 0.05) 100%)',
          border: '1px solid rgba(225, 29, 72, 0.2)',
          borderRadius: 'var(--radius-lg)'
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px', color: 'hsl(var(--text-primary))' }}>
            <Shield size={24} style={{ display: 'inline-block', marginRight: '12px', verticalAlign: '-4px', color: 'hsl(var(--accent-rose))' }} />
            Platform Moderation
          </h1>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', maxWidth: '800px', lineHeight: '1.6' }}>
            As an administrator, you can view all datasets on the platform (including private datasets) and permanently delete datasets that violate community guidelines.
          </p>
        </div>

        {/* Toolbar */}
        <div className="glass-panel animate-fade-in" style={{
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '20px',
          marginBottom: '28px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '280px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
              <input
                type="text"
                placeholder="Search datasets..."
                className="form-input"
                style={{ paddingLeft: '48px' }}
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              />
            </div>
          </div>
        </div>

        {/* Dataset Table */}
        {isLoading ? (
          <div className="flex-center" style={{ minHeight: '300px', flexDirection: 'column', gap: '16px' }}>
            <Loader2 size={40} className="spin" style={{ color: 'hsl(var(--accent-rose))', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'hsl(var(--text-secondary))' }}>Loading global datasets...</p>
          </div>
        ) : error ? (
          <div className="glass-panel flex-center" style={{ minHeight: '200px', border: '1px solid rgba(244,63,94,0.3)', padding: '24px' }}>
            <AlertCircle size={24} style={{ color: 'hsl(var(--accent-rose))', marginRight: '12px' }} />
            <p style={{ color: 'hsl(var(--accent-rose))', fontWeight: 500 }}>Failed to fetch datasets.</p>
          </div>
        ) : (
          <div className="glass-panel" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg-glass-subtle)', borderBottom: '1px solid var(--border-glass-subtle)' }}>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Dataset</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Visibility</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Owner ID</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'hsl(var(--text-secondary))' }}>Size</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: 'hsl(var(--text-secondary))', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((dataset) => (
                  <tr key={dataset.id} style={{ borderBottom: '1px solid var(--border-glass-subtle)' }}>
                    <td style={{ padding: '16px' }}>
                      <div style={{ fontWeight: 600, color: 'hsl(var(--text-primary))', marginBottom: '4px' }}>
                        {dataset.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
                        {dataset.slug}
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {dataset.visibility === 'public' ? <Globe size={11} /> : <Lock size={11} />}
                        {dataset.visibility}
                      </span>
                    </td>
                    <td style={{ padding: '16px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                      {dataset.owner?.username || dataset.owner_keycloak_id || 'Unknown'}
                    </td>
                    <td style={{ padding: '16px', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>
                      {formatBytes(dataset.total_size_bytes)}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'right' }}>
                      <button 
                        onClick={() => handleDelete(dataset)}
                        style={{
                          background: 'rgba(225, 29, 72, 0.1)',
                          border: '1px solid rgba(225, 29, 72, 0.3)',
                          color: 'hsl(var(--accent-rose))',
                          padding: '6px 12px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.85rem',
                          fontWeight: 600,
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = 'rgba(225, 29, 72, 0.2)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'rgba(225, 29, 72, 0.1)';
                        }}
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: 'hsl(var(--text-muted))' }}>
                      No datasets found on the platform.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}

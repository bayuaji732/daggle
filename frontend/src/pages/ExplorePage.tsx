import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR, { useSWRConfig } from 'swr';
import { apiClient } from '@/services/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import { formatBytes, formatDate } from '@/utils/format';
import type { Dataset } from '@/types/models';
import type { PaginatedResponse } from '@/types/api';
import {
  Database, Search, Filter, Plus, LogOut, User as UserIcon,
  Upload, Tag, Globe, Lock, CheckCircle, AlertCircle, Loader2, X,
  FolderOpen, HardDrive, Shield
} from 'lucide-react';


export function ExplorePage() {
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

  const { data, error, isLoading } = useSWR<PaginatedResponse<Dataset>>(
    `/datasets?${queryParams.toString()}`,
    async (url: string) => {
      const res = await apiClient.get<PaginatedResponse<Dataset>>(url);
      return res.data;
    },
    {
      refreshInterval: 4000, // Poll every 4s to track dataset PROCESSING → READY status
    }
  );

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
        <div className="flex-center" style={{ gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/explore')}>
          <div className="flex-center" style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-sm)',
            background: 'linear-gradient(135deg, hsl(var(--accent-purple)), hsl(var(--accent-indigo)))'
          }}>
            <Database size={22} color="var(--color-white-fixed)" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Daggle</h2>
            <span style={{ fontSize: '0.68rem', color: 'hsl(var(--accent-purple))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Explore Registry
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
            style={{ padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--bg-glass-hover)', color: 'hsl(var(--text-primary))', cursor: 'default', fontWeight: 600 }}
          >
            Explore
          </button>
          {user?.roles?.includes('admin') && (
            <button
              onClick={() => navigate('/admin')}
              style={{ padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'hsl(var(--accent-rose))', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(225, 29, 72, 0.1)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Shield size={14} style={{ display: 'inline-block', marginRight: '6px', verticalAlign: '-2px' }} />
              Admin
            </button>
          )}
        </div>

        {/* User Card / Login */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user ? (
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
          ) : (
            <button onClick={() => navigate('/')} className="btn btn-primary" style={{ padding: '8px 24px', fontSize: '0.9rem', fontWeight: 600, borderRadius: '24px' }}>
              Login
            </button>
          )}
        </div>
      </header>

      {/* Main Grid Area */}
      <main className="container" style={{ flex: 1, padding: '40px 0', width: '100%' }}>
        {/* Welcome Hero Banner */}
        <div className="glass-panel animate-fade-in" style={{
          padding: '32px',
          marginBottom: '32px',
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.04) 0%, rgba(99, 102, 241, 0.04) 100%)',
          border: '1px solid rgba(168, 85, 247, 0.15)',
          borderRadius: 'var(--radius-lg)'
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px', color: 'hsl(var(--text-primary))' }}>
            Explore Daggle Registry
          </h1>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', maxWidth: '800px', lineHeight: '1.6' }}>
            Search, discover, and download public datasets across the entire platform.
          </p>
        </div>

        {/* Toolbar Filter */}
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
                placeholder="Search datasets by name or tag..."
                className="form-input"
                style={{ paddingLeft: '48px' }}
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              />
            </div>
            <div style={{ position: 'relative', width: '180px' }}>
              <Filter size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
              <select
                className="form-input"
                style={{ paddingLeft: '40px', appearance: 'none', cursor: 'pointer' }}
                value={visibilityFilter}
                onChange={(e) => { setVisibilityFilter(e.target.value); setPage(1); }}
              >
                <option value="">All Visibility</option>
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            </div>
          </div>

          {user && (
            <button onClick={() => navigate('/workspace')} className="btn btn-primary" style={{ padding: '12px 24px' }}>
              Your Workspace
            </button>
          )}
        </div>

        {/* Dataset Cards Grid */}
        {isLoading ? (
          <div className="flex-center" style={{ minHeight: '300px', flexDirection: 'column', gap: '16px' }}>
            <Loader2 size={40} className="spin" style={{ color: 'hsl(var(--accent-purple))', animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'hsl(var(--text-secondary))' }}>Loading registered datasets...</p>
          </div>
        ) : error ? (
          <div className="glass-panel flex-center" style={{ minHeight: '200px', border: '1px solid rgba(244,63,94,0.3)', padding: '24px' }}>
            <AlertCircle size={24} style={{ color: 'hsl(var(--accent-rose))', marginRight: '12px' }} />
            <p style={{ color: 'hsl(var(--accent-rose))', fontWeight: 500 }}>Failed to fetch datasets. Check backend server logs.</p>
          </div>
        ) : data?.items.length === 0 ? (
          <div className="glass-panel flex-center" style={{ minHeight: '320px', flexDirection: 'column', padding: '48px', textAlign: 'center' }}>
            <Database size={48} style={{ color: 'hsl(var(--text-muted))', marginBottom: '16px' }} />
            <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>No Datasets Found</h3>
            <p style={{ color: 'hsl(var(--text-secondary))', maxWidth: '400px', marginBottom: '24px' }}>
              We couldn't find any registered datasets matching your filters. Upload a new dataset to get started.
            </p>
            <button onClick={() => setIsDrawerOpen(true)} className="btn btn-primary">
              <Plus size={16} /> Upload First Dataset
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '24px'
          }}>
            {data?.items.map((dataset) => (
              <div
                key={dataset.id}
                onClick={() => navigate(`/datasets/${dataset.slug}`)}
                className="glass-panel animate-fade-in"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%',
                  padding: '24px',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  border: '1px solid var(--glass-border)',
                  position: 'relative'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
                  e.currentTarget.style.boxShadow = '0 12px 30px rgba(168, 85, 247, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--glass-border)';
                  e.currentTarget.style.boxShadow = 'var(--glass-shadow)';
                }}
              >
                {/* Header Vis / Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <span className="badge badge-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {dataset.visibility === 'public' ? <Globe size={11} /> : <Lock size={11} />}
                      {dataset.visibility}
                    </span>
                  </div>
                  {dataset.status !== 'ready' && (
                    <span className={`badge badge-${dataset.status}`}>
                      {dataset.status}
                    </span>
                  )}
                </div>

                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px', color: 'hsl(var(--text-primary))' }}>
                  {dataset.name}
                </h3>

                <p style={{
                  fontSize: '0.85rem',
                  color: 'hsl(var(--text-secondary))',
                  lineHeight: '1.5',
                  height: '42px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  marginBottom: '20px'
                }}>
                  {dataset.description || 'No description provided.'}
                </p>

                {/* Tags */}
                {dataset.tags && dataset.tags.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    {dataset.tags.map((tag, idx) => (
                      <span key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--bg-glass-subtle)',
                        border: '1px solid var(--border-glass-subtle)',
                        color: 'hsl(var(--text-secondary))'
                      }}>
                        <Tag size={10} /> {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* File Types */}
                {dataset.file_types && dataset.file_types.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
                    {dataset.file_types.map((ftype, idx) => (
                      <span key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.7rem',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(56, 189, 248, 0.1)',
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                        color: 'hsl(var(--accent-cyan))'
                      }}>
                        <Database size={10} /> {ftype}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer details */}
                <div style={{
                  marginTop: 'auto',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid var(--border-glass-subtle)',
                  paddingTop: '14px',
                  fontSize: '0.75rem',
                  color: 'hsl(var(--text-muted))',
                  fontFamily: 'var(--font-mono)'
                }}>
                  <span>{formatBytes(dataset.total_size_bytes)}</span>
                  <span>{dataset.file_count} files</span>
                  <span>{formatDate(dataset.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Spin style */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}

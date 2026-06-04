import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useSWR, { useSWRConfig } from 'swr';
import { apiClient } from '@/services/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import { formatBytes, formatDate } from '@/utils/format';
import type { Dataset } from '@/types/models';
import type { PaginatedResponse } from '@/types/api';
import { 
  LogOut, Database, HardDrive, Loader2, Upload, X, AlertCircle, Plus, Settings, User as UserIcon,
  Search, Grid, List as ListIcon, Lock, Globe, Tag, Shield
} from 'lucide-react';

export function WorkspacePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { mutate } = useSWRConfig();

  // Search & Pagination State
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'card'>('card');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // Modal / Drawer State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadSlug, setUploadSlug] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadVis, setUploadVis] = useState<'public' | 'private'>('public');
  const [uploadTags, setUploadTags] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Auto-generate slug from name
  useEffect(() => {
    const formatted = uploadName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    setUploadSlug(formatted);
  }, [uploadName]);

  // Fetch only this user's datasets via SWR
  const queryParams = new URLSearchParams();
  queryParams.append('mine_only', 'true');
  if (searchTerm) queryParams.append('search', searchTerm);
  queryParams.append('page', String(page));
  queryParams.append('page_size', String(pageSize));

  const { data: datasetsData, isLoading: isDatasetsLoading } = useSWR<PaginatedResponse<Dataset>>(
    user ? `/datasets?${queryParams.toString()}` : null,
    async (url: string) => {
      const res = await apiClient.get<PaginatedResponse<Dataset>>(url);
      return res.data;
    }
  );

  const { data: statsData } = useSWR(
    user ? `/datasets/summary?mine_only=true` : null,
    async (url: string) => {
      const res = await apiClient.get(url);
      return res.data;
    }
  );

  const userDatasets = datasetsData?.items || [];

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) { setUploadError('Please select a dataset file to upload.'); return; }
    if (!uploadSlug || !/^[a-z0-9-]+$/.test(uploadSlug)) {
      setUploadError('Slug must contain only lowercase letters, numbers, and hyphens.'); return;
    }

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', file);
    const metadata = {
      name: uploadName,
      slug: uploadSlug,
      description: uploadDesc || undefined,
      visibility: uploadVis,
      tags: uploadTags.split(',').map(t => t.trim()).filter(t => t.length > 0)
    };
    formData.append('dataset_create', JSON.stringify(metadata));

    try {
      await apiClient.post('/datasets/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      });
      // Re-fetch datasets and stats
      mutate(`/datasets?${queryParams.toString()}`);
      mutate(`/datasets/summary?mine_only=true`);
      
      setIsDrawerOpen(false);
      setUploadName(''); setUploadSlug(''); setUploadDesc(''); setUploadTags(''); setFile(null);
      setUploadProgress(0);
    } catch (err: any) {
      console.error(err);
      setUploadError(err.response?.data?.detail || 'An error occurred during dataset upload.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
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
        <div className="flex-center" style={{ gap: '10px', cursor: 'pointer' }} onClick={() => navigate('/workspace')}>
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
              My Workspace
            </span>
          </div>
        </div>

        {/* Global Navigation Tabs */}
        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-glass-subtle)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass-subtle)' }}>
          <button 
            style={{ padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--bg-glass-hover)', color: 'hsl(var(--text-primary))', cursor: 'default', fontWeight: 600 }}
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

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
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
        </div>
      </header>

      {/* Main Workspace Content Grid */}
      <main className="container" style={{ flex: 1, padding: '40px 0', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Quick Stats Panel (4-grid) */}
          <div className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '24px' }}>My Ownership Stats</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              
              <div style={{ background: 'var(--bg-glass-subtle)', padding: '20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                  <Database size={16} style={{ color: 'hsl(var(--accent-purple))' }} /> Total Datasets
                </span>
                <span style={{ fontSize: '1.75rem', fontWeight: 700 }}>{statsData?.total || 0}</span>
              </div>
              
              <div style={{ background: 'var(--bg-glass-subtle)', padding: '20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                  <Globe size={16} style={{ color: 'hsl(var(--accent-teal))' }} /> Public Datasets
                </span>
                <span style={{ fontSize: '1.75rem', fontWeight: 700 }}>{statsData?.total_public || 0}</span>
              </div>

              <div style={{ background: 'var(--bg-glass-subtle)', padding: '20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                  <Lock size={16} style={{ color: 'hsl(var(--accent-rose))' }} /> Private Datasets
                </span>
                <span style={{ fontSize: '1.75rem', fontWeight: 700 }}>{statsData?.total_private || 0}</span>
              </div>

              <div style={{ background: 'var(--bg-glass-subtle)', padding: '20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                  <HardDrive size={16} style={{ color: 'hsl(var(--accent-indigo))' }} /> Total Storage
                </span>
                <span style={{ fontSize: '1.75rem', fontWeight: 700 }}>{formatBytes(statsData?.total_size_bytes || 0)}</span>
              </div>

            </div>
          </div>

          {/* Toolbar */}
          <div className="glass-panel animate-fade-in" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '280px' }}>
              <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
                <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))' }} />
                <input
                  type="text"
                  placeholder="Search my datasets..."
                  className="form-input"
                  style={{ paddingLeft: '48px' }}
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                />
              </div>
              <div style={{ display: 'flex', background: 'var(--bg-glass-subtle)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass-subtle)' }}>
                <button 
                  onClick={() => setViewMode('card')}
                  style={{ 
                    padding: '8px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                    background: viewMode === 'card' ? 'var(--bg-glass-active)' : 'transparent',
                    color: viewMode === 'card' ? 'white' : 'hsl(var(--text-muted))'
                  }}
                  title="Grid View"
                >
                  <Grid size={18} />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  style={{ 
                    padding: '8px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                    background: viewMode === 'list' ? 'var(--bg-glass-active)' : 'transparent',
                    color: viewMode === 'list' ? 'white' : 'hsl(var(--text-muted))'
                  }}
                  title="List View"
                >
                  <ListIcon size={18} />
                </button>
              </div>
            </div>

            <button onClick={() => setIsDrawerOpen(true)} className="btn btn-primary" style={{ padding: '10px 20px', fontSize: '0.9rem' }}>
              <Plus size={16} /> Upload Dataset
            </button>
          </div>

          {/* Owned Datasets Display */}
          <div className="glass-panel animate-fade-in" style={{ padding: '36px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '24px' }}>My Datasets</h3>
            
            {isDatasetsLoading ? (
              <div className="flex-center" style={{ padding: '40px 0', flexDirection: 'column', gap: '12px' }}>
                <Loader2 size={24} className="spin" style={{ color: 'hsl(var(--accent-purple))', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-muted))' }}>Loading my datasets...</p>
              </div>
            ) : userDatasets.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center', background: 'var(--bg-glass-subtle)', border: '1px dashed var(--border-glass-subtle)', borderRadius: 'var(--radius-md)' }}>
                <Database size={40} style={{ color: 'hsl(var(--text-muted))', margin: '0 auto 16px auto' }} />
                <h4 style={{ fontSize: '1.1rem', marginBottom: '8px' }}>No Datasets Found</h4>
                <p style={{ color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>You don't have any datasets matching this search.</p>
              </div>
            ) : viewMode === 'list' ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-glass-subtle)', paddingBottom: '10px' }}>
                      <th style={{ padding: '12px 8px', fontSize: '0.8rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Dataset Name</th>
                      <th style={{ padding: '12px 8px', fontSize: '0.8rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>File Types</th>
                      <th style={{ padding: '12px 8px', fontSize: '0.8rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Visibility</th>
                      <th style={{ padding: '12px 8px', fontSize: '0.8rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Size</th>
                      <th style={{ padding: '12px 8px', fontSize: '0.8rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase' }}>Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userDatasets.map((d: Dataset) => (
                      <tr 
                        key={d.id} 
                        onClick={() => navigate(`/datasets/${d.slug}`)}
                        style={{ borderBottom: '1px solid var(--border-glass-subtle)', cursor: 'pointer', transition: 'background 0.2s ease' }}
                        className="table-row-hover"
                      >
                        <td style={{ padding: '14px 8px', fontSize: '0.9rem', fontWeight: 600 }}>{d.name}</td>
                        <td style={{ padding: '14px 8px' }}>
                          <span style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))' }}>
                            {d.file_types?.join(', ') || '-'}
                          </span>
                        </td>
                        <td style={{ padding: '14px 8px' }}>
                          <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>{d.visibility}</span>
                        </td>
                        <td style={{ padding: '14px 8px', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>{formatBytes(d.total_size_bytes || 0)}</td>
                        <td style={{ padding: '14px 8px', fontSize: '0.85rem', color: 'hsl(var(--text-secondary))' }}>{formatDate(d.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
                {userDatasets.map((dataset) => (
                  <div
                    key={dataset.id}
                    onClick={() => navigate(`/datasets/${dataset.slug}`)}
                    className="glass-panel animate-fade-in"
                    style={{
                      display: 'flex', flexDirection: 'column', height: '100%',
                      padding: '24px', cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      border: '1px solid var(--glass-border)', position: 'relative'
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span className="badge badge-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {dataset.visibility === 'public' ? <Globe size={11} /> : <Lock size={11} />}
                          {dataset.visibility}
                        </span>
                      </div>
                      {dataset.status !== 'ready' && (
                        <span className={`badge badge-${dataset.status}`}>{dataset.status}</span>
                      )}
                    </div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px', color: 'hsl(var(--text-primary))' }}>{dataset.name}</h3>
                    <p style={{
                      fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', lineHeight: '1.5',
                      height: '42px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', marginBottom: '20px'
                    }}>
                      {dataset.description || 'No description provided.'}
                    </p>
                    {/* Tags */}
                    {dataset.tags && dataset.tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                        {dataset.tags.map((tag, idx) => (
                          <span key={idx} style={{
                            display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem',
                            padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-glass-subtle)',
                            border: '1px solid var(--border-glass-subtle)', color: 'hsl(var(--text-secondary))'
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
                    <div style={{
                      marginTop: 'auto',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderTop: '1px solid var(--border-glass-subtle)', paddingTop: '14px',
                      fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontFamily: 'var(--font-mono)'
                    }}>
                      <span>{formatBytes(dataset.total_size_bytes)}</span>
                      <span>{dataset.file_count} files</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Slide-over Upload Drawer Overlay */}
      {isDrawerOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'flex-end', zIndex: 1000, animation: 'fadeIn 0.25s ease'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            maxWidth: '520px', width: '100%', height: '100%', borderRadius: 0,
            borderLeft: '1px solid var(--border-glass-strong)', background: 'hsl(var(--bg-panel))',
            padding: '40px', display: 'flex', flexDirection: 'column', overflowY: 'auto'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Upload size={22} style={{ color: 'hsl(var(--accent-purple))' }} />
                <h3 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Upload New Dataset</h3>
              </div>
              <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'none', border: 'none', color: 'hsl(var(--text-muted))', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'hsl(var(--text-primary))' }}>Dataset File</label>
                <div style={{
                  border: '2px dashed var(--border-glass-strong)', borderRadius: 'var(--radius-md)', padding: '32px 16px',
                  textAlign: 'center', background: 'var(--bg-glass-subtle)', cursor: 'pointer', position: 'relative'
                }}>
                  <input type="file" required accept=".zip,.csv,.tsv,.xlsx,.xls,.txt,.json,.jsonl,.parquet,.jpg,.jpeg,.png,.webp,.mp3,.wav,.flac,.mp4,.avi,.mkv,.pdf,.docx"
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        const selectedFile = e.target.files[0];
                        setFile(selectedFile);
                        if (!uploadName) {
                          const baseName = selectedFile.name.replace(/\.[^/.]+$/, "");
                          const formattedName = baseName.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                          setUploadName(formattedName);
                        }
                      }
                    }}
                  />
                  <Upload size={32} style={{ color: 'hsl(var(--text-muted))', marginBottom: '12px' }} />
                  <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-primary))', fontWeight: 500 }}>{file ? file.name : 'Click to select or drag dataset file here'}</p>
                  <p style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', marginTop: '4px' }}>Supported: ZIP, CSV/TSV, Parquet, Excel, TXT, JSON, Docs (PDF/DOCX), Media (Max 500 MB)</p>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'hsl(var(--text-primary))' }}>Dataset Name</label>
                <input type="text" required placeholder="e.g. Cats vs Dogs Dataset" className="form-input" value={uploadName} onChange={(e) => setUploadName(e.target.value)} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'hsl(var(--text-primary))' }}>Slug Identifier</label>
                <input type="text" required pattern="^[a-z0-9-]+$" placeholder="e.g. cats-vs-dogs-dataset" className="form-input" value={uploadSlug} onChange={(e) => setUploadSlug(e.target.value)} />
                <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', display: 'block', marginTop: '6px' }}>Only lowercase letters, numbers, and hyphens.</span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'hsl(var(--text-primary))' }}>Description</label>
                <textarea rows={4} placeholder="Provide details about the dataset contents..." className="form-input" style={{ resize: 'none' }} value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'hsl(var(--text-primary))' }}>Visibility Mode</label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label className="flex-center" style={{ gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="visibility" value="public" checked={uploadVis === 'public'} onChange={() => setUploadVis('public')} style={{ accentColor: 'hsl(var(--accent-purple))' }} /> Public
                  </label>
                  <label className="flex-center" style={{ gap: '8px', cursor: 'pointer' }}>
                    <input type="radio" name="visibility" value="private" checked={uploadVis === 'private'} onChange={() => setUploadVis('private')} style={{ accentColor: 'hsl(var(--accent-purple))' }} /> Private
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'hsl(var(--text-primary))' }}>Tags</label>
                <input type="text" placeholder="e.g. image-classification, computer-vision" className="form-input" value={uploadTags} onChange={(e) => setUploadTags(e.target.value)} />
              </div>

              {uploadError && (
                <div style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', color: 'hsl(var(--accent-rose))', fontSize: '0.85rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <AlertCircle size={16} /> <span>{uploadError}</span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: 'auto', paddingTop: '20px' }}>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <button type="button" onClick={() => setIsDrawerOpen(false)} className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} disabled={uploading}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={uploading}>
                    {uploading ? (
                      <>
                        <Loader2 className="spin" size={16} style={{ animation: 'spin 1s linear infinite' }} /> 
                        {uploadProgress < 100 ? `Uploading ${uploadProgress}%...` : 'Processing...'}
                      </>
                    ) : 'Upload Dataset'}
                  </button>
                </div>
                {uploading && uploadProgress > 0 && (
                  <div style={{ width: '100%', background: 'var(--bg-glass-subtle)', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      background: uploadProgress < 100 ? 'hsl(var(--accent-cyan))' : 'hsl(var(--accent-purple))', 
                      width: `${uploadProgress}%`,
                      transition: 'width 0.3s ease, background 0.3s ease'
                    }} />
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

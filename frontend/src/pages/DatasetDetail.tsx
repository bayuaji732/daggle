import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import ReactMarkdown from 'react-markdown';
import { apiClient } from '@/services/apiClient';
import { useAuth } from '@/features/auth/AuthContext';
import { authService } from '@/features/auth/authService';
import { formatBytes, formatDate } from '@/utils/format';
import type { Dataset } from '@/types/models';
import type { PreviewResponse } from '@/types/api';
import {
  ArrowLeft, Trash2, AlertCircle, Loader2, Table, History, Globe, Lock, Download, File as FileIcon, Search, Eye, ChevronRight, ChevronDown, Folder, Code, FileText, Copy, Check
} from 'lucide-react';

type TreeNode = {
  name: string;
  type: 'folder' | 'file';
  path: string;
  size?: number;
  last_modified?: string;
  children?: { [key: string]: TreeNode };
  file?: any;
};

const FileTreeNode = ({ node, level, selectedFile, onSelectFile }: { node: TreeNode, level: number, selectedFile: any, onSelectFile: (file: any) => void }) => {
  const [isOpen, setIsOpen] = useState(level === 0 || level === 1); // Open root and first level folders by default

  if (node.type === 'file') {
    const isSelected = selectedFile?.filename === node.path;
    return (
      <button
        onClick={() => onSelectFile(node.file)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
          padding: `6px 12px 6px ${level * 16 + 12}px`,
          background: isSelected ? 'rgba(168,85,247,0.1)' : 'transparent',
          border: '1px solid transparent',
          borderColor: isSelected ? 'rgba(168,85,247,0.3)' : 'transparent',
          cursor: 'pointer', textAlign: 'left',
          color: isSelected ? 'hsl(var(--accent-purple))' : 'hsl(var(--text-secondary))',
          transition: 'background 0.2s',
          borderRadius: '4px'
        }}
        onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-glass-subtle)'; }}
        onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <FileIcon size={14} style={{ color: isSelected ? 'hsl(var(--accent-purple))' : 'hsl(var(--text-muted))', flexShrink: 0 }} />
          <span style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-mono)' }}>
            {node.name}
          </span>
        </div>
        {node.size !== undefined && (
          <span style={{ color: 'hsl(var(--text-muted))', fontSize: '0.75rem', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
            {formatBytes(node.size)}
          </span>
        )}
      </button>
    );
  }

  return (
    <div>
      {node.name !== 'root' && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex', alignItems: 'center', width: '100%',
            padding: `6px 12px 6px ${level * 16 + 4}px`,
            background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
            color: 'hsl(var(--text-secondary))', fontWeight: 600,
            transition: 'background 0.2s',
            borderRadius: '4px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass-subtle)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
          {isOpen ? <ChevronDown size={14} style={{ marginRight: '4px', color: 'hsl(var(--text-muted))' }} /> : <ChevronRight size={14} style={{ marginRight: '4px', color: 'hsl(var(--text-muted))' }} />}
          <Folder size={14} style={{ color: 'hsl(var(--accent-amber))', marginRight: '6px' }} />
          <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}>{node.name}</span>
        </button>
      )}
      {isOpen && node.children && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {Object.values(node.children)
            .sort((a, b) => {
              if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
              return a.name.localeCompare(b.name);
            })
            .map(child => (
              <FileTreeNode key={child.path} node={child} level={node.name === 'root' ? 0 : level + 1} selectedFile={selectedFile} onSelectFile={onSelectFile} />
            ))}
        </div>
      )}
    </div>
  );
};

const TabularPreviewViewer = ({ slug, filePath, version }: { slug: string, filePath: string, version: string | null }) => {
  const { data: preview, error, isLoading } = useSWR<PreviewResponse>(
    `/datasets/${slug}/preview?file_path=${encodeURIComponent(filePath)}${version ? `&version=${version}` : ''}`,
    async (url: string) => {
      const res = await apiClient.get<PreviewResponse>(url);
      return res.data;
    }
  );

  if (isLoading) {
    return (
      <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: '12px' }}>
        <Loader2 size={24} className="spin" style={{ color: 'hsl(var(--accent-cyan))', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Loading preview data...</p>
      </div>
    );
  }

  if (error || !preview || preview.error) {
    return (
      <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: '12px', opacity: 0.7 }}>
        <Eye size={32} style={{ color: 'hsl(var(--text-muted))' }} />
        <h4 style={{ color: 'hsl(var(--text-primary))', fontWeight: 600, margin: 0 }}>No Preview Available</h4>
        <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', textAlign: 'center', maxWidth: '300px', margin: 0 }}>
          {preview?.error || 'A preview cannot be generated for this specific file format at this time.'}
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-glass-subtle)',
      borderRadius: '8px',
      border: '1px solid var(--border-glass-subtle)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      boxShadow: 'inset 0 2px 10px var(--bg-glass-subtle)'
    }}>
      <div style={{ padding: '12px 16px', background: 'var(--bg-glass-subtle)', borderBottom: '1px solid var(--border-glass-subtle)', fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
        Showing {preview.preview_rows} of {preview.total_rows} rows • Type: {preview.type}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', fontFamily: 'var(--font-mono)', textAlign: 'left' }}>
          <thead style={{ background: 'var(--bg-glass-subtle)' }}>
            <tr>
              {preview.columns?.map((col: string, idx: number) => (
                <th key={idx} style={{ padding: '12px 16px', color: 'hsl(var(--text-primary))', fontWeight: 600, whiteSpace: 'nowrap', borderBottom: '1px solid var(--bg-glass-active)' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {preview.rows?.map((row: any, rIdx: number) => (
              <tr key={rIdx} style={{ transition: 'background 0.2s' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass-subtle)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                {preview.columns?.map((col: string, cIdx: number) => (
                  <td key={cIdx} style={{ padding: '10px 16px', color: 'hsl(var(--text-secondary))', whiteSpace: 'nowrap', borderBottom: '1px solid var(--bg-glass-subtle)' }}>
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const TextPreviewViewer = ({ slug, filePath, version }: { slug: string, filePath: string, version: string | null }) => {
  const { data: preview, error, isLoading } = useSWR<PreviewResponse>(
    `/datasets/${slug}/preview?file_path=${encodeURIComponent(filePath)}${version ? `&version=${version}` : ''}`,
    async (url: string) => {
      const res = await apiClient.get<PreviewResponse>(url);
      return res.data;
    }
  );

  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (preview?.content) {
      navigator.clipboard.writeText(preview.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: '12px' }}>
        <Loader2 size={24} className="spin" style={{ color: 'hsl(var(--accent-cyan))', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Loading preview content...</p>
      </div>
    );
  }

  if (error || !preview || preview.error) {
    return (
      <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: '12px', opacity: 0.7 }}>
        <Eye size={32} style={{ color: 'hsl(var(--text-muted))' }} />
        <h4 style={{ color: 'hsl(var(--text-primary))', fontWeight: 600, margin: 0 }}>No Preview Available</h4>
        <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', textAlign: 'center', maxWidth: '300px', margin: 0 }}>
          {preview?.error || 'A preview cannot be generated for this specific file format at this time.'}
        </p>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--bg-glass-subtle)',
      borderRadius: '8px',
      border: '1px solid var(--border-glass-subtle)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      boxShadow: 'inset 0 2px 10px var(--bg-glass-subtle)',
      position: 'relative'
    }}>
      <div style={{
        padding: '12px 16px',
        background: 'var(--bg-glass-subtle)',
        borderBottom: '1px solid var(--border-glass-subtle)',
        fontSize: '0.75rem',
        color: 'hsl(var(--text-muted))',
        fontFamily: 'var(--font-mono)',
        flexShrink: 0,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>Type: {preview.type} • File Size: {formatBytes(preview.file_size || 0)}</span>
        <button
          onClick={handleCopy}
          style={{
            background: 'var(--bg-glass-subtle)',
            border: '1px solid var(--border-glass-strong)',
            borderRadius: '4px',
            color: 'hsl(var(--text-primary))',
            padding: '4px 8px',
            fontSize: '0.7rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-glass-active)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'var(--border-glass-subtle)'}
        >
          {copied ? <Check size={12} style={{ color: 'hsl(var(--accent-teal))' }} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        <pre style={{
          margin: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.85rem',
          color: 'hsl(var(--text-secondary))',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all'
        }}>
          {preview.content}
        </pre>
      </div>
    </div>
  );
};

const DocxPreviewViewer = ({ downloadUrl }: { downloadUrl: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    apiClient.get(downloadUrl, { responseType: 'blob' })
      .then(res => {
        if (isMounted && containerRef.current) {
          import('docx-preview').then(docx => {
            docx.renderAsync(res.data, containerRef.current!).then(() => {
              if (isMounted) setLoading(false);
            }).catch(err => {
              console.error("docx-preview error", err);
              if (isMounted) {
                setError('Failed to render document preview.');
                setLoading(false);
              }
            });
          }).catch(err => {
            if (isMounted) {
              setError('Failed to load docx viewer module.');
              setLoading(false);
            }
          });
        }
      })
      .catch(err => {
        if (isMounted) {
          setError(err.message || 'Failed to fetch document');
          setLoading(false);
        }
      });

    return () => { isMounted = false; };
  }, [downloadUrl]);

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-glass-subtle)', borderRadius: '8px', overflow: 'hidden' }}>
      {loading && (
        <div className="flex-center" style={{ flex: 1, flexDirection: 'column', gap: '12px' }}>
          <Loader2 size={24} className="spin" style={{ color: 'hsl(var(--accent-cyan))', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>Loading document preview...</p>
        </div>
      )}
      {error && (
        <div className="flex-center" style={{ flex: 1, flexDirection: 'column', gap: '12px', opacity: 0.7 }}>
          <AlertCircle size={32} style={{ color: 'hsl(var(--accent-rose))' }} />
          <h4 style={{ color: 'hsl(var(--text-primary))', fontWeight: 600, margin: 0 }}>Preview Error</h4>
          <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', textAlign: 'center' }}>
            {error}
          </p>
        </div>
      )}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: 'auto',
          display: loading || error ? 'none' : 'block',
          backgroundColor: 'white'
        }}
      />
    </div>
  );
};

const FilePreviewViewer = ({ selectedFile, slug, version }: { selectedFile: any, slug: string, version: string | null }) => {
  if (!selectedFile) return null;

  const ext = selectedFile.filename.split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
  const isAudio = ['mp3', 'wav', 'flac', 'ogg'].includes(ext);
  const isVideo = ['mp4', 'avi', 'mov', 'mkv'].includes(ext);
  const isTabular = ['csv', 'tsv', 'parquet', 'xlsx', 'xls'].includes(ext);
  const isText = ['json', 'jsonl', 'txt'].includes(ext);
  const isPdf = ext === 'pdf';
  const isDocx = ext === 'docx';

  const downloadUrl = `${apiClient.defaults.baseURL}/datasets/${slug}/download?file_path=${encodeURIComponent(selectedFile.filename)}&preview=true${version ? `&version=${version}` : ''}`;

  if (isImage) {
    return (
      <div className="flex-center" style={{ height: '100%', background: 'var(--bg-glass-subtle)', borderRadius: '8px', overflow: 'hidden' }}>
        <img src={downloadUrl} alt={selectedFile.filename} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
      </div>
    );
  }

  if (isAudio) {
    return (
      <div className="flex-center" style={{ height: '100%', background: 'var(--bg-glass-subtle)', borderRadius: '8px' }}>
        <audio controls src={downloadUrl} style={{ width: '80%', maxWidth: '400px' }} />
      </div>
    );
  }

  if (isVideo) {
    return (
      <div className="flex-center" style={{ height: '100%', background: 'var(--bg-glass-subtle)', borderRadius: '8px', overflow: 'hidden' }}>
        <video controls src={downloadUrl} style={{ maxWidth: '100%', maxHeight: '100%' }} />
      </div>
    );
  }

  if (isPdf) {
    return (
      <div style={{ height: '100%', width: '100%', background: 'var(--bg-glass-subtle)', borderRadius: '8px', overflow: 'hidden' }}>
        <iframe src={downloadUrl} width="100%" height="100%" style={{ border: 'none' }} title="PDF Preview" />
      </div>
    );
  }

  if (isDocx) {
    return <DocxPreviewViewer downloadUrl={downloadUrl} />;
  }

  if (isTabular) {
    return <TabularPreviewViewer slug={slug} filePath={selectedFile.filename} version={version} />;
  }

  if (isText) {
    return <TextPreviewViewer slug={slug} filePath={selectedFile.filename} version={version} />;
  }

  return (
    <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: '12px', opacity: 0.7 }}>
      <Eye size={32} style={{ color: 'hsl(var(--text-muted))' }} />
      <h4 style={{ color: 'hsl(var(--text-primary))', fontWeight: 600, margin: 0 }}>No Preview Available</h4>
      <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem', textAlign: 'center', maxWidth: '300px', margin: 0 }}>
        A preview cannot be generated for this specific file format at this time.
      </p>
    </div>
  );
};

export function DatasetDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [deleting, setDeleting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [changelog, setChangelog] = useState('');
  const [isUploadingVersion, setIsUploadingVersion] = useState(false);
  const [uploadVersionProgress, setUploadVersionProgress] = useState(0);

  // Fix scroll position on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  // Fetch Dataset details
  const { data: dataset, error, isLoading } = useSWR<Dataset>(
    `/datasets/${slug}`,
    async (url: string) => {
      const res = await apiClient.get<Dataset>(url);
      return res.data;
    },
    {
      refreshInterval: (data) => data?.status !== 'ready' && data?.status !== 'failed' ? 3000 : 0
    }
  );

  // Fetch File List
  const { data: fileList, isLoading: isFilesLoading } = useSWR<any>(
    dataset?.status === 'ready' ? `/datasets/${slug}/files${selectedVersion ? `?version=${selectedVersion}` : ''}` : null,
    async (url: string) => {
      const res = await apiClient.get(url);
      return res.data;
    }
  );

  // Convert flat file list to tree
  const fileTree = useMemo(() => {
    if (!fileList?.files) return null;

    const root: TreeNode = { name: 'root', type: 'folder', path: '', children: {} };

    fileList.files.forEach((file: any) => {
      const parts = file.filename.split('/').filter(Boolean);
      let current = root;

      parts.forEach((part: string, index: number) => {
        if (index === parts.length - 1) {
          // File
          current.children![part] = {
            name: part,
            type: 'file',
            path: file.filename,
            size: file.size,
            last_modified: file.last_modified,
            file: file
          };
        } else {
          // Folder
          if (!current.children![part]) {
            current.children![part] = {
              name: part,
              type: 'folder',
              path: parts.slice(0, index + 1).join('/'),
              children: {}
            };
          }
          current = current.children![part];
        }
      });
    });

    return root;
  }, [fileList]);

  // Auto-select: whenever the file list changes, pick the first file if the current
  // selection doesn't exist in it (handles initial load AND version switches).
  useEffect(() => {
    if (!fileList?.files?.length) {
      setSelectedFile(null);
      return;
    }
    const fileExistsInList = fileList.files.some((f: any) => f.filename === selectedFile?.filename);
    if (!fileExistsInList) {
      setSelectedFile(fileList.files[0]);
    }
  }, [fileList]);

  // Reset selected file immediately when version changes so no stale preview fires
  useEffect(() => {
    setSelectedFile(null);
  }, [selectedVersion]);

  // CRITICAL: Compute a validated file reference that is null whenever the selected file
  // doesn't exist in the current file list. This prevents cross-version preview requests
  // during the render that happens BEFORE the effects above run (React renders first, runs
  // effects after — so we'd otherwise fire "PokemonData.csv + version=v1" briefly).
  const validSelectedFile = useMemo(() => {
    if (!selectedFile || !fileList?.files) return null;
    const exists = fileList.files.some((f: any) => f.filename === selectedFile.filename);
    return exists ? selectedFile : null;
  }, [selectedFile, fileList]);



  /** Redirect to Keycloak if not logged in. Returns true if authenticated. */
  const requireAuth = (): boolean => {
    if (!user) {
      authService.login();
      return false;
    }
    return true;
  };

  const handleDelete = async () => {
    if (!requireAuth()) return;
    if (!window.confirm('Are you absolutely sure you want to delete this dataset? This will remove all storage files and historical records.')) {
      return;
    }
    setDeleting(true);
    try {
      await apiClient.delete(`/datasets/${slug}`);
      navigate('/workspace');
    } catch (err) {
      console.error(err);
      alert('Failed to delete dataset. Check permissions.');
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDownload = () => {
    if (!requireAuth()) return;
    if (apiClient.defaults.baseURL) {
      window.location.href = `${apiClient.defaults.baseURL}/datasets/${slug}/download${selectedVersion ? `?version=${selectedVersion}` : ''}`;
    }
  };

  const handleFileDownload = (filePath: string) => {
    if (!requireAuth()) return;
    if (apiClient.defaults.baseURL) {
      window.location.href = `${apiClient.defaults.baseURL}/datasets/${slug}/download?file_path=${encodeURIComponent(filePath)}${selectedVersion ? `&version=${selectedVersion}` : ''}`;
    }
  };

  const handleVersionUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!versionFile || !requireAuth()) return;

    setIsUploadingVersion(true);
    const formData = new FormData();
    formData.append('file', versionFile);
    if (changelog.trim()) {
      formData.append('changelog', changelog.trim());
    }

    try {
      await apiClient.post(`/datasets/${slug}/versions`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadVersionProgress(percentCompleted);
          }
        }
      });
      setIsVersionModalOpen(false);
      setVersionFile(null);
      setChangelog('');
      // Trigger a re-fetch since dataset is now processing
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Failed to upload new version.');
    } finally {
      setIsUploadingVersion(false);
      setUploadVersionProgress(0);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '16px' }}>
        <Loader2 size={40} className="spin" style={{ color: 'hsl(var(--accent-purple))', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: 'hsl(var(--text-secondary))' }}>Loading dataset details...</p>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '20px', padding: '24px' }}>
        <AlertCircle size={48} style={{ color: 'hsl(var(--accent-rose))' }} />
        <h3 style={{ fontSize: '1.4rem' }}>Dataset Not Found</h3>
        <p style={{ color: 'hsl(var(--text-secondary))', textAlign: 'center', maxWidth: '400px' }}>
          This dataset may be private, or has been removed from the registry.
        </p>
        <button onClick={() => navigate('/explore')} className="btn btn-secondary">
          <ArrowLeft size={16} /> Back to Explore
        </button>
      </div>
    );
  }

  const isOwner = !!(user && (
    user.sub === dataset.owner?.sub ||
    user.sub === (dataset as any).owner_keycloak_id
  ));


  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: '80px' }}>
      <header className="glass-panel animate-fade-in" style={{
        margin: '24px 24px 32px 24px',
        padding: '20px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <button onClick={() => navigate(-1)} className="btn btn-secondary" style={{ padding: '8px 16px' }}>
          <ArrowLeft size={16} /> Back
        </button>

        <div style={{ display: 'flex', gap: '12px' }}>
          {dataset.status === 'ready' && (
            <>
              <button
                onClick={() => {
                  if (!requireAuth()) return;
                  const effectiveVersion = selectedVersion
                    || dataset.versions?.find((v: any) => v.is_latest)?.version
                    || dataset.versions?.[dataset.versions.length - 1]?.version;

                  const url = `http://localhost:8082/hub/daggle-launch?dataset_slug=${encodeURIComponent(dataset.slug)}&dataset_version=${encodeURIComponent(effectiveVersion)}`;
                  console.log('[Daggle] Launching Notebook:', url);
                  window.open(url, '_blank');
                }}
                className="btn btn-secondary"
                style={{ padding: '8px 20px', background: 'var(--bg-glass-subtle)', borderColor: 'var(--border-glass-strong)' }}
                title={!user ? 'Sign in to open in Notebook' : undefined}
              >
                <Code size={16} /> Open in Notebook
                {!user && <Lock size={13} style={{ marginLeft: '4px', opacity: 0.6 }} />}
              </button>
              <button
                onClick={handleBulkDownload}
                className="btn btn-primary"
                style={{ padding: '8px 20px' }}
                title={!user ? 'Sign in to download' : undefined}
              >
                <Download size={16} /> Download Dataset
                {!user && <Lock size={13} style={{ marginLeft: '4px', opacity: 0.8 }} />}
              </button>
            </>
          )}

          {isOwner && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="btn btn-secondary"
              style={{ borderColor: 'rgba(244,63,94,0.2)', color: 'hsl(var(--accent-rose))', background: 'rgba(244,63,94,0.02)' }}
            >
              <Trash2 size={16} /> {deleting ? 'Deleting...' : 'Delete Dataset'}
            </button>
          )}
        </div>
      </header>

      <main className="container" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* TOP SECTION */}
        <div style={{ padding: '0 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'hsl(var(--text-primary))', margin: 0 }}>
              {dataset.name}
            </h2>
            <span className="badge badge-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              {dataset.visibility === 'public' ? <Globe size={11} /> : <Lock size={11} />}
              {dataset.visibility}
            </span>
            {dataset.status !== 'ready' && (
              <span className={`badge badge-${dataset.status}`}>
                {dataset.status}
              </span>
            )}
            {dataset.versions && dataset.versions.length > 0 && (
              <span className="badge badge-secondary" style={{ background: 'rgba(56,189,248,0.1)', color: 'hsl(var(--accent-cyan))' }}>
                {selectedVersion || dataset.versions.find(v => v.is_latest)?.version || 'v1'}
              </span>
            )}
          </div>

          <div className="dataset-description-markdown" style={{ color: 'hsl(var(--text-secondary))', lineHeight: '1.6', fontSize: '1.1rem', maxWidth: '900px' }}>
            <ReactMarkdown>{dataset.description || 'No description provided.'}</ReactMarkdown>
          </div>

          {dataset.tags && dataset.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {dataset.tags.map((tag, idx) => (
                <span key={idx} style={{
                  fontSize: '0.85rem', padding: '6px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-glass-subtle)', border: '1px solid var(--border-glass-subtle)',
                  color: 'hsl(var(--text-secondary))'
                }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* MAIN SECTION: Data Explorer */}
        <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '600px', overflow: 'hidden' }}>

          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-glass-subtle)', background: 'var(--bg-glass-subtle)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            <Table size={20} style={{ color: 'hsl(var(--accent-cyan))' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'hsl(var(--text-primary))', margin: 0 }}>Data Explorer</h3>
          </div>

          {dataset.status !== 'ready' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '48px' }}>
              <div style={{ textAlign: 'center', maxWidth: '400px' }}>
                {dataset.status === 'processing' || dataset.status === 'pending' ? (
                  <>
                    <Loader2 className="spin" size={36} style={{ margin: '0 auto 16px auto', color: 'hsl(var(--accent-cyan))', animation: 'spin 1s linear infinite' }} />
                    <h4 style={{ fontWeight: 600, color: 'hsl(var(--text-primary))', marginBottom: '8px' }}>Processing Dataset Archive</h4>
                    <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
                      The server is currently unpacking and indexing this dataset.
                    </p>
                  </>
                ) : (
                  <>
                    <AlertCircle size={36} style={{ margin: '0 auto 16px auto', color: 'hsl(var(--accent-rose))' }} />
                    <h4 style={{ fontWeight: 600, color: 'hsl(var(--text-primary))', marginBottom: '8px' }}>Ingestion Failed</h4>
                    <p style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))' }}>
                      The uploaded archive could not be parsed correctly.
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

              {/* Left Pane: Tree File Explorer */}
              <div style={{
                width: '320px',
                borderRight: '1px solid var(--border-glass-subtle)',
                background: 'var(--bg-glass-subtle)',
                display: 'flex',
                flexDirection: 'column',
                flexShrink: 0
              }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border-glass-subtle)', flexShrink: 0 }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'hsl(var(--text-secondary))', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                    Files ({fileList?.total_files || 0})
                  </h4>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                  {isFilesLoading ? (
                    <div className="flex-center" style={{ padding: '24px' }}>
                      <Loader2 size={18} className="spin" style={{ color: 'hsl(var(--text-muted))', animation: 'spin 1s linear infinite' }} />
                    </div>
                  ) : (!fileTree || Object.keys(fileTree.children || {}).length === 0) ? (
                    <p style={{ padding: '16px', textAlign: 'center', color: 'hsl(var(--text-muted))', fontSize: '0.85rem' }}>
                      No files available.
                    </p>
                  ) : (
                    <FileTreeNode node={fileTree} level={0} selectedFile={selectedFile} onSelectFile={setSelectedFile} />
                  )}
                </div>
              </div>

              {/* Right Pane: File Preview Details */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-glass-hover)', overflow: 'hidden' }}>
                {validSelectedFile ? (
                  <>
                    <div style={{
                      padding: '16px 24px',
                      borderBottom: '1px solid var(--border-glass-subtle)',
                      background: 'var(--bg-glass-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexShrink: 0
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'rgba(168,85,247,0.1)', padding: '8px', borderRadius: '8px' }}>
                          <FileIcon size={20} style={{ color: 'hsl(var(--accent-purple))' }} />
                        </div>
                        <div>
                          <h4 style={{ color: 'hsl(var(--text-primary))', fontWeight: 600, fontSize: '1.05rem', fontFamily: 'var(--font-mono)', margin: '0 0 4px 0' }}>
                            {validSelectedFile.filename}
                          </h4>
                          <span style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                            {formatBytes(validSelectedFile.size)} • Modified {formatDate(validSelectedFile.last_modified)}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleFileDownload(validSelectedFile.filename)}
                        className="btn btn-secondary"
                        style={{ padding: '8px 16px', background: 'hsl(var(--bg-card))', borderColor: 'var(--bg-glass-active)', fontSize: '0.85rem' }}
                        title={!user ? 'Sign in to download' : undefined}
                      >
                        <Download size={14} /> Download File
                        {!user && <Lock size={12} style={{ marginLeft: '4px', opacity: 0.6 }} />}
                      </button>
                    </div>

                    <div style={{ flex: 1, minHeight: 0 }}>
                  <FilePreviewViewer selectedFile={validSelectedFile} slug={slug} version={selectedVersion} />
                </div>
                  </>
                ) : (
                  <div className="flex-center" style={{ height: '100%', flexDirection: 'column', gap: '16px', color: 'hsl(var(--text-muted))' }}>
                    <Search size={40} style={{ opacity: 0.5 }} />
                    <p style={{ fontSize: '0.95rem', margin: 0 }}>Select a file from the sidebar to preview.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM SECTION */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', marginTop: '16px' }}>

          {/* Metadata */}
          <div className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 16px 0', color: 'hsl(var(--text-primary))' }}>Metadata</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'hsl(var(--text-secondary))' }}>Total Size</span>
                <span style={{ color: 'hsl(var(--text-primary))', fontWeight: 600 }}>{formatBytes(dataset.total_size_bytes)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'hsl(var(--text-secondary))' }}>Files</span>
                <span style={{ color: 'hsl(var(--text-primary))', fontWeight: 600 }}>{dataset.file_count}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'hsl(var(--text-secondary))' }}>Downloads</span>
                <span style={{ color: 'hsl(var(--text-primary))', fontWeight: 600 }}>{dataset.download_count}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'hsl(var(--text-secondary))' }}>Created</span>
                <span style={{ color: 'hsl(var(--text-primary))', fontWeight: 600 }}>{formatDate(dataset.created_at)}</span>
              </div>
            </div>
          </div>


          {/* File Information */}
          <div className="glass-panel animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'hsl(var(--text-primary))', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Globe size={16} style={{ color: 'hsl(var(--accent-cyan))' }} /> File Information
            </h3>

            {/* Owner */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Published by</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, hsl(var(--accent-purple)), hsl(var(--accent-indigo)))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', fontWeight: 700, color: 'hsl(var(--text-primary))', flexShrink: 0
                }}>
                  {(dataset.owner?.display_name || dataset.owner?.name || dataset.owner?.username || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
                    {dataset.owner?.display_name || dataset.owner?.name || dataset.owner?.username || 'Unknown'}
                  </div>
                  {dataset.owner?.username && (
                    <div style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', fontFamily: 'var(--font-mono)' }}>
                      @{dataset.owner.username}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* File Formats */}
            {dataset.file_types && dataset.file_types.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', letterSpacing: '0.5px' }}>File Formats</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {dataset.file_types.map((ft) => (
                    <span key={ft} style={{
                      fontSize: '0.75rem', fontWeight: 600, fontFamily: 'var(--font-mono)',
                      padding: '3px 10px', borderRadius: '999px',
                      background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)',
                      color: 'hsl(var(--accent-cyan))'
                    }}>.{ft}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Last Updated */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'hsl(var(--text-secondary))' }}>Last Updated</span>
              <span style={{ color: 'hsl(var(--text-primary))', fontWeight: 600 }}>{formatDate(dataset.updated_at)}</span>
            </div>
          </div>

          {/* Version Control */}
          <div className="glass-panel animate-fade-in" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', gap: '8px', alignItems: 'center' }}>
                <History size={16} style={{ color: 'hsl(var(--accent-amber))' }} /> Version Control
              </h3>
              {isOwner && (
                <button
                  onClick={() => setIsVersionModalOpen(true)}
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: 'rgba(56,189,248,0.2)', color: 'hsl(var(--accent-cyan))', background: 'rgba(56,189,248,0.05)' }}
                >
                  Upload Version
                </button>
              )}
            </div>
            {!dataset.versions || dataset.versions.length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', margin: 0 }}>No historical versions registered.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {(dataset.versions || []).slice(0, 3).map((ver: any, idx: number) => {
                  const isCurrentSelection = selectedVersion === ver.version || (!selectedVersion && ver.is_latest);
                  
                  return (
                    <div 
                      key={ver.id} 
                      onClick={() => setSelectedVersion(ver.version)}
                      style={{ 
                        display: 'flex', gap: '12px', cursor: 'pointer', 
                        padding: '8px', borderRadius: '8px', 
                        background: isCurrentSelection ? 'var(--border-glass-subtle)' : 'transparent',
                        transition: 'background 0.2s',
                        border: isCurrentSelection ? '1px solid var(--bg-glass-active)' : '1px solid transparent'
                      }}
                    >
                      <div className="flex-center" style={{ flexDirection: 'column' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isCurrentSelection ? 'hsl(var(--accent-purple))' : 'var(--bg-glass-active)', border: isCurrentSelection ? '2px solid rgba(168,85,247,0.2)' : 'none' }} />
                        {idx < Math.min((dataset.versions || []).length, 3) - 1 && <div style={{ width: '2px', flex: 1, background: 'var(--bg-glass-subtle)', margin: '4px 0' }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                            {ver.version}
                            {ver.is_latest && <span style={{ fontSize: '0.65rem', background: 'rgba(168,85,247,0.15)', color: 'hsl(var(--accent-purple))', padding: '1px 6px', borderRadius: '4px', marginLeft: '6px' }}>LATEST</span>}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'hsl(var(--text-muted))', fontFamily: 'var(--font-mono)' }}>{formatBytes(ver.size_bytes)}</span>
                        </div>
                        <span style={{ fontSize: '0.65rem', color: 'hsl(var(--text-muted))', display: 'block', marginTop: '2px' }}>Released {formatDate(ver.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </main>

      {/* Upload Version Modal */}
      {isVersionModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: '24px'
        }}>
          <div className="glass-panel animate-fade-in" style={{
            padding: '32px', width: '100%', maxWidth: '500px',
            display: 'flex', flexDirection: 'column', gap: '24px'
          }}>
            <h3 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'hsl(var(--text-primary))' }}>Upload New Version</h3>
            
            <form onSubmit={handleVersionUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'hsl(var(--text-primary))' }}>Dataset File (ZIP, CSV, etc.)</label>
                <div style={{
                  border: '2px dashed var(--border-glass-strong)',
                  borderRadius: '12px',
                  padding: '32px',
                  textAlign: 'center',
                  background: 'rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}>
                  <input
                    type="file"
                    required
                    onChange={(e) => setVersionFile(e.target.files?.[0] || null)}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '16px', background: 'var(--bg-glass-subtle)', borderRadius: '50%' }}>
                      <FileText size={32} style={{ color: 'hsl(var(--accent-purple))' }} />
                    </div>
                    <div>
                      {versionFile ? (
                        <p style={{ color: 'hsl(var(--accent-cyan))', margin: 0, fontWeight: 600 }}>{versionFile.name}</p>
                      ) : (
                        <p style={{ color: 'hsl(var(--text-secondary))', margin: 0 }}>Drag & drop or click to select</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'hsl(var(--text-primary))' }}>Changelog (Optional)</label>
                <textarea 
                  className="form-input" 
                  placeholder="What changed in this version?"
                  value={changelog}
                  onChange={e => setChangelog(e.target.value)}
                  style={{ minHeight: '80px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsVersionModalOpen(false)} disabled={isUploadingVersion}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={!versionFile || isUploadingVersion}>
                    {isUploadingVersion ? (
                      <>
                        <Loader2 className="spin" size={16} style={{ animation: 'spin 1s linear infinite', marginRight: '6px' }} /> 
                        {uploadVersionProgress < 100 ? `Uploading ${uploadVersionProgress}%...` : 'Processing...'}
                      </>
                    ) : 'Upload Version'}
                  </button>
                </div>
                {isUploadingVersion && uploadVersionProgress > 0 && (
                  <div style={{ width: '100%', background: 'var(--bg-glass-subtle)', borderRadius: '999px', height: '6px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      background: uploadVersionProgress < 100 ? 'hsl(var(--accent-cyan))' : 'hsl(var(--accent-purple))', 
                      width: `${uploadVersionProgress}%`,
                      transition: 'width 0.3s ease, background 0.3s ease'
                    }} />
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* spin keyframes and markdown styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .dataset-description-markdown p { margin-bottom: 1em; }
        .dataset-description-markdown p:last-child { margin-bottom: 0; }
        .dataset-description-markdown ul, .dataset-description-markdown ol { margin-bottom: 1em; padding-left: 20px; }
        .dataset-description-markdown h1, .dataset-description-markdown h2, .dataset-description-markdown h3, .dataset-description-markdown h4 { color: hsl(var(--text-primary)); margin-top: 1.25em; margin-bottom: 0.5em; font-weight: 700; }
        .dataset-description-markdown h1:first-child, .dataset-description-markdown h2:first-child, .dataset-description-markdown h3:first-child { margin-top: 0; }
        .dataset-description-markdown strong { font-weight: 700; color: hsl(var(--text-primary)); }
        .dataset-description-markdown blockquote { border-left: 4px solid hsl(var(--accent-purple)); color: hsl(var(--text-muted)); margin: 1em 0; background: var(--bg-glass-subtle); padding: 12px 16px; border-radius: 4px; }
      `}} />
    </div>
  );
}

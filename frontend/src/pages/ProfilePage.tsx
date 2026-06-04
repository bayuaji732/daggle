import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { 
  ArrowLeft, LogOut, User as UserIcon, Mail, Shield, Check, Copy, 
  Key, Loader2, Save, Settings, Moon, Sun, Monitor
} from 'lucide-react';
import { useTheme } from '@/features/theme/ThemeContext';

export function ProfilePage() {
  const { user, logout, updateProfile } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  // Profile Form States
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Initialize fields from user context
  useEffect(() => {
    if (user) {
      const names = (user.name || '').split(' ');
      setFirstName(names[0] || user.username || '');
      setLastName(names.slice(1).join(' ') || '');
      const emailVal = user.email || '';
      setEmail(emailVal);
    }
  }, [user]);

  const handleCopyId = () => {
    if (user?.sub) {
      navigator.clipboard.writeText(user.sub);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      await updateProfile(firstName.trim(), lastName.trim(), email.trim());
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: any) {
      console.error(err);
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to update profile. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
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
            <Settings size={22} color="var(--color-white-fixed)" />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Daggle</h2>
            <span style={{ fontSize: '0.68rem', color: 'hsl(var(--accent-purple))', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Profile Settings
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-glass-subtle)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-glass-subtle)' }}>
          <button 
            onClick={() => navigate('/workspace')}
            style={{ padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'hsl(var(--text-secondary))', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.color = 'hsl(var(--text-primary))'}
            onMouseOut={(e) => e.currentTarget.style.color = 'hsl(var(--text-secondary))'}
          >
            My Workspace
          </button>
          <button 
            onClick={() => navigate('/explore')}
            style={{ padding: '8px 20px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'transparent', color: 'hsl(var(--text-secondary))', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s' }}
            onMouseOver={(e) => e.currentTarget.style.color = 'hsl(var(--text-primary))'}
            onMouseOut={(e) => e.currentTarget.style.color = 'hsl(var(--text-secondary))'}
          >
            Explore
          </button>
        </div>

        <button onClick={logout} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
          <LogOut size={16} /> Logout
        </button>
      </header>

      <main className="container" style={{ flex: 1, padding: '40px 0', width: '100%' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px', alignItems: 'start' }}>
          
          {/* Left Column: Identity Card */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-panel animate-fade-in" style={{ padding: '32px', textAlign: 'center', position: 'relative' }}>
              <div className="flex-center" style={{
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(99, 102, 241, 0.1))',
                border: '2px solid rgba(168, 85, 247, 0.3)',
                color: 'hsl(var(--accent-purple))',
                margin: '0 auto 20px auto',
                boxShadow: '0 8px 32px 0 rgba(168, 85, 247, 0.08)'
              }}>
                <UserIcon size={42} />
              </div>

              <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '6px' }}>{user?.name || user?.username}</h3>
              <p style={{ fontSize: '0.85rem', color: 'hsl(var(--text-secondary))', marginBottom: '20px' }}>@{user?.username}</p>

              <div className="flex-center" style={{ gap: '8px', flexWrap: 'wrap', marginBottom: '24px' }}>
                <span className="badge badge-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
                  <Shield size={12} />
                  {user?.roles?.includes('admin') ? 'Admin' : 'Developer'}
                </span>
              </div>

              <hr style={{ borderColor: 'var(--border-glass-subtle)', margin: '20px 0' }} />

              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: '0.7rem', color: 'hsl(var(--text-muted))', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Account ID
                </p>
                <div style={{
                  display: 'flex', alignItems: 'center', background: 'var(--bg-glass-subtle)',
                  border: '1px solid var(--border-glass-subtle)', borderRadius: 'var(--radius-sm)',
                  padding: '8px 12px', justifyContent: 'space-between'
                }}>
                  <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'hsl(var(--text-secondary))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '170px' }}>
                    {user?.sub}
                  </span>
                  <button onClick={handleCopyId} style={{ background: 'none', border: 'none', color: copiedId ? 'hsl(var(--accent-emerald))' : 'hsl(var(--text-muted))', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }} title="Copy Account ID">
                    {copiedId ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Edit Form & Preferences */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Edit Profile Form */}
            <div className="glass-panel animate-fade-in" style={{ padding: '36px' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '24px' }}>Update Profile Information</h3>

              {message && (
                <div style={{
                  padding: '12px 16px', borderRadius: 'var(--radius-sm)', marginBottom: '24px', fontSize: '0.9rem',
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
                  border: `1px solid ${message.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(244, 63, 94, 0.2)'}`,
                  color: message.type === 'success' ? 'hsl(var(--accent-emerald))' : 'hsl(var(--accent-rose))'
                }}>
                  {message.text}
                </div>
              )}

              <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>First Name</label>
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="form-input" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Last Name</label>
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className="form-input" />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Email Address</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center' }}>
                      <Mail size={16} />
                    </span>
                    <input type="text" value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" style={{ paddingLeft: '38px' }} placeholder="e.g. user@example.com" />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.8rem', color: 'hsl(var(--text-muted))', fontWeight: 600 }}>Username (Read Only)</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'hsl(var(--text-muted))', display: 'flex', alignItems: 'center' }}>
                      <Key size={16} />
                    </span>
                    <input type="text" value={user?.username || ''} disabled className="form-input" style={{ paddingLeft: '38px', background: 'var(--bg-glass-subtle)', color: 'hsl(var(--text-muted))', cursor: 'not-allowed' }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                  <button type="submit" disabled={saving} className="btn btn-primary" style={{ padding: '10px 20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {saving ? <><Loader2 size={16} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Saving changes...</> : <><Save size={16} /> Save Changes</>}
                  </button>
                </div>
              </form>
            </div>

            {/* Preferences Section */}
            <div className="glass-panel animate-fade-in" style={{ padding: '36px' }}>
               <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '24px' }}>Preferences</h3>
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                 <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                   <label style={{ fontSize: '0.9rem', color: 'hsl(var(--text-secondary))', fontWeight: 600 }}>Theme Appearance</label>
                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                     
                     <button 
                       onClick={() => setTheme('light')}
                       style={{
                         padding: '10px 12px', borderRadius: 'var(--radius-md)',
                         background: theme === 'light' ? 'rgba(168, 85, 247, 0.1)' : 'var(--bg-glass-subtle)',
                         border: `2px solid ${theme === 'light' ? 'hsl(var(--accent-purple))' : 'var(--border-glass-subtle)'}`,
                         color: theme === 'light' ? 'hsl(var(--accent-purple))' : 'hsl(var(--text-secondary))',
                         cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                         transition: 'all 0.2s'
                       }}
                     >
                       <Sun size={18} />
                       <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Light</span>
                     </button>
                     
                     <button 
                       onClick={() => setTheme('dark')}
                       style={{
                         padding: '10px 12px', borderRadius: 'var(--radius-md)',
                         background: theme === 'dark' ? 'rgba(168, 85, 247, 0.1)' : 'var(--bg-glass-subtle)',
                         border: `2px solid ${theme === 'dark' ? 'hsl(var(--accent-purple))' : 'var(--border-glass-subtle)'}`,
                         color: theme === 'dark' ? 'hsl(var(--accent-purple))' : 'hsl(var(--text-secondary))',
                         cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                         transition: 'all 0.2s'
                       }}
                     >
                       <Moon size={18} />
                       <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Dark</span>
                     </button>

                     <button 
                       onClick={() => setTheme('system')}
                       style={{
                         padding: '10px 12px', borderRadius: 'var(--radius-md)',
                         background: theme === 'system' ? 'rgba(168, 85, 247, 0.1)' : 'var(--bg-glass-subtle)',
                         border: `2px solid ${theme === 'system' ? 'hsl(var(--accent-purple))' : 'var(--border-glass-subtle)'}`,
                         color: theme === 'system' ? 'hsl(var(--accent-purple))' : 'hsl(var(--text-secondary))',
                         cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                         transition: 'all 0.2s'
                       }}
                     >
                       <Monitor size={18} />
                       <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>System</span>
                     </button>

                   </div>
                 </div>
               </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

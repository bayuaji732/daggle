import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { Database, Lock, User, AlertCircle, Mail } from 'lucide-react';

export function LandingPage() {
  const { isAuthenticated, login, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const isLoading = authLoading;

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate('/workspace');
    }
  }, [isAuthenticated, isLoading, navigate]);



  return (
    <div className="landing-layout flex-center animate-fade-in" style={{
      minHeight: '100vh',
      flexDirection: 'column',
      padding: '40px 24px',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background Decorative Rings / Glows */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '800px',
        height: '800px',
        background: 'radial-gradient(circle, rgba(168, 85, 247, 0.05) 0%, transparent 60%)',
        zIndex: -1,
        pointerEvents: 'none'
      }} />

      {/* Main Glassmorphic Portal Card */}
      <main className="glass-panel animate-fade-in" style={{
        maxWidth: '420px',
        width: '100%',
        padding: '40px 32px',
        position: 'relative',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
        border: '1px solid var(--border-glass-card)'
      }}>
        {/* Branding Icon inside Card */}
        <div className="flex-center" style={{
          width: '56px',
          height: '56px',
          borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, hsl(var(--accent-purple)), hsl(var(--accent-indigo)))',
          boxShadow: '0 8px 24px rgba(168, 85, 247, 0.25)',
          margin: '0 auto 20px auto'
        }}>
          <Database size={28} color="var(--color-white-fixed)" />
        </div>

        {/* Title */}
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 800,
          color: 'hsl(var(--text-primary))',
          textAlign: 'center',
          marginBottom: '8px',
          letterSpacing: '-0.02em'
        }}>
          Daggle
        </h1>

        {/* Subtitle */}
        <p style={{
          color: 'hsl(var(--text-secondary))',
          fontSize: '1rem',
          textAlign: 'center',
          marginBottom: '28px',
          lineHeight: '1.5'
        }}>
          Securely manage, version, and mount machine learning datasets for training environments.
        </p>

        {/* SSO Button */}
        <button
          onClick={login}
          disabled={isLoading}
          className="btn btn-primary"
          style={{
            width: '100%',
            justifyContent: 'center',
            padding: '14px 24px',
            fontSize: '1rem',
            borderRadius: 'var(--radius-md)',
            fontWeight: 700,
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            boxShadow: '0 4px 20px rgba(168, 85, 247, 0.4)'
          }}
        >
          {isLoading ? (
            <span style={{
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              border: '2px solid var(--border-glass-strong)',
              borderTopColor: 'white',
              animation: 'spin 0.8s linear infinite',
              display: 'inline-block'
            }} className="spinner" />
          ) : (
            'Sign In'
          )}
        </button>
      </main>

      <footer style={{
        marginTop: '32px',
        fontSize: '0.75rem',
        color: 'hsl(var(--text-muted))',
        fontFamily: 'var(--font-mono)',
        letterSpacing: '0.05em'
      }}>
        © 2026 Daggle Project. All rights reserved.
      </footer>

      <style dangerouslySetInnerHTML={{
        __html: `
        .login-input:focus {
          border-color: hsl(var(--accent-purple)) !important;
          box-shadow: 0 0 0 3px rgba(168, 85, 247, 0.15) !important;
          background: var(--bg-glass-subtle) !important;
        }
        .login-input:hover:not(:focus) {
          border-color: var(--border-glass-hover) !important;
        }
        .spinner {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  );
}

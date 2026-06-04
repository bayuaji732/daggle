import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireRole?: string;
}

export function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div className="flex-center animate-fade-in" style={{ minHeight: '100vh', flexDirection: 'column', gap: '20px' }}>
        <div style={{
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          border: '3px solid var(--border-glass-subtle)',
          borderTopColor: 'hsl(var(--accent-purple))',
          animation: 'spin 1s linear infinite'
        }} />
        <h3 style={{ fontFamily: 'var(--font-heading)', color: 'hsl(var(--text-secondary))', fontWeight: 500 }}>
          Authenticating Daggle session...
        </h3>

        <style dangerouslySetInnerHTML={{
          __html: `
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (requireRole && (!user?.roles || !user.roles.includes(requireRole))) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

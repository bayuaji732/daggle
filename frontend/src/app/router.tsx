import { Routes, Route } from 'react-router-dom';
import { LandingPage } from '@/pages/LandingPage';
import { ExplorePage } from '@/pages/ExplorePage';
import { DatasetDetail } from '@/pages/DatasetDetail';
import { WorkspacePage } from '@/pages/WorkspacePage';
import { ProfilePage } from '@/pages/ProfilePage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { AdminPage } from '@/pages/AdminPage';

export function AppRouter() {
  return (
    <Routes>
      {/* Public routes — no login required */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/explore" element={<ExplorePage />} />
      <Route path="/datasets/:slug" element={<DatasetDetail />} />

      {/* Protected routes — login required */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireRole="admin">
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/workspace"
        element={
          <ProtectedRoute>
            <WorkspacePage />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<LandingPage />} />
    </Routes>
  );
}

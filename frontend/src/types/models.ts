export interface User {
  sub?: string;            // Keycloak UUID (stable identity)
  keycloak_id?: string;
  username: string;
  email: string;
  name?: string;
  display_name?: string;
  roles?: string[];
  email_verified?: boolean;
}

export interface Dataset {
  id: number;
  slug: string;
  name: string;
  description?: string;
  tags?: string[];
  file_types?: string[];
  visibility: 'public' | 'private' | 'protected';
  status: 'pending' | 'processing' | 'ready' | 'failed';
  owner?: User;
  owner_keycloak_id?: string;
  total_size_bytes: number;
  file_count: number;
  download_count: number;
  latest_version?: DatasetVersion;
  versions?: DatasetVersion[];
  created_at: string;
  updated_at: string;
}

export interface DatasetVersion {
  id: number;
  dataset_id: number;
  version: string;
  description?: string;
  changelog?: string;
  size_bytes: number;
  file_count: number;
  is_latest: boolean;
  created_at: string;
}

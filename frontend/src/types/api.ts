export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ApiError {
  detail: string;
  error_code?: string;
}

export interface PreviewResponse {
  type: string;
  columns?: string[];
  rows?: Record<string, any>[];
  content?: string;
  total_rows?: number;
  preview_rows?: number;
  file_size?: number;
  error?: string;
}


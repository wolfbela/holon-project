export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface ApiError {
  error: string;
  stack?: string;
}

export interface TicketStats {
  total: number;
  open: number;
  closed: number;
  byPriority: {
    low: number;
    medium: number;
    high: number;
  };
  avgResponseTime: string;
}

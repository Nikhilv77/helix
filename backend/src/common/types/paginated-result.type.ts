export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<TData> {
  data: TData[];
  meta: {
    pagination: PaginationMeta;
  };
}

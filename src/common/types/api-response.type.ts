export interface ApiSuccessResponse<TData> {
  success: true;
  data: TData;
  meta: Record<string, unknown>;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details: Record<string, unknown>;
  };
  timestamp: string;
  path: string;
}

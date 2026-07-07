export interface SharedFileMetadata {
  version: 1;
  name: string;
  mimeType: string;
  message?: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  stack?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiErrorPayload;
  message?: string;
}

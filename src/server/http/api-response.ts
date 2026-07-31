import { NextResponse } from "next/server";
import { isRecord } from "../common/utils/is-record";
import { isApiRouteError } from "./api-error";

interface ResponsePayload<TData> {
  data: TData;
  meta?: Record<string, unknown>;
}

export function apiSuccess<TData>(data: TData): NextResponse {
  const payload = normalizePayload(data);

  return NextResponse.json({
    success: true,
    data: payload.data,
    meta: payload.meta ?? {},
    timestamp: new Date().toISOString()
  });
}

export function apiError(error: unknown, path: string): NextResponse {
  const normalized = normalizeError(error);

  return NextResponse.json(
    {
      success: false,
      error: {
        code: normalized.code,
        message: normalized.message,
        details: normalized.details
      },
      timestamp: new Date().toISOString(),
      path
    },
    { status: normalized.statusCode }
  );
}

function normalizePayload<TData>(data: TData): ResponsePayload<TData> {
  if (isRecord(data) && "data" in data) {
    return {
      data: data.data as TData,
      meta: isRecord(data.meta) ? data.meta : {}
    };
  }

  return { data };
}

function normalizeError(error: unknown): {
  statusCode: number;
  code: string;
  message: string;
  details: Record<string, unknown>;
} {
  if (isApiRouteError(error)) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details
    };
  }

  if (isNestHttpException(error)) {
    const statusCode = error.getStatus();
    const response = error.getResponse();

    if (statusCode >= 500) {
      return {
        statusCode,
        code: codeFromStatus(statusCode),
        message: statusCode === 503 ? extractMessage(response, "Service unavailable") : "Internal server error",
        details: extractDetails(response)
      };
    }

    return {
      statusCode,
      code: extractCode(response, statusCode),
      message: extractMessage(response, error.message),
      details: extractDetails(response)
    };
  }

  return {
    statusCode: 500,
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error",
    details: {}
  };
}

function isNestHttpException(error: unknown): error is {
  message: string;
  getStatus: () => number;
  getResponse: () => unknown;
} {
  return (
    typeof error === "object" &&
    error !== null &&
    "getStatus" in error &&
    typeof (error as { getStatus?: unknown }).getStatus === "function" &&
    "getResponse" in error &&
    typeof (error as { getResponse?: unknown }).getResponse === "function"
  );
}

function extractCode(response: unknown, statusCode: number): string {
  return isRecord(response) && typeof response.code === "string"
    ? response.code
    : codeFromStatus(statusCode);
}

function extractMessage(response: unknown, fallback: string): string {
  if (typeof response === "string") {
    return response;
  }

  if (isRecord(response) && typeof response.message === "string") {
    return response.message;
  }

  if (isRecord(response) && Array.isArray(response.message)) {
    return "Validation failed";
  }

  return fallback;
}

function extractDetails(response: unknown): Record<string, unknown> {
  if (isRecord(response) && isRecord(response.details)) {
    return response.details;
  }

  if (isRecord(response) && Array.isArray(response.message)) {
    return { messages: response.message };
  }

  return {};
}

function codeFromStatus(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 422:
      return "UNPROCESSABLE_ENTITY";
    case 503:
      return "SERVICE_UNAVAILABLE";
    default:
      return "INTERNAL_SERVER_ERROR";
  }
}

import { NextResponse } from "next/server";
import { isRecord } from "../common/utils/is-record";
import { AppHttpError } from "../common/http-error";
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
  if (isApiRouteError(error) || error instanceof AppHttpError) {
    return {
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
      details: error.details
    };
  }

  return {
    statusCode: 500,
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error",
    details: {}
  };
}






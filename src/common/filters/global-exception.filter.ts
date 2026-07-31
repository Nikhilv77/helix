import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger
} from "@nestjs/common";
import { Request, Response } from "express";
import { ERROR_CODES } from "../constants/error-codes";
import { ApiErrorResponse } from "../types/api-response.type";
import { isRecord } from "../utils/is-record";

interface NormalizedError {
  statusCode: number;
  code: string;
  message: string;
  details: Record<string, unknown>;
}

const HTTP_STATUS = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const;

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const normalized = this.normalizeException(exception);

    if (normalized.statusCode >= HTTP_STATUS.INTERNAL_SERVER_ERROR) {
      this.logger.error(normalized.message, exception instanceof Error ? exception.stack : undefined);
    }

    const body: ApiErrorResponse = {
      success: false,
      error: {
        code: normalized.code,
        message: normalized.message,
        details: normalized.details
      },
      timestamp: new Date().toISOString(),
      path: request.originalUrl
    };

    response.status(normalized.statusCode).json(body);
  }

  private normalizeException(exception: unknown): NormalizedError {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();

      if (statusCode === HTTP_STATUS.INTERNAL_SERVER_ERROR) {
        return {
          statusCode,
          code: this.codeFromStatus(statusCode),
          message: "Internal server error",
          details: {}
        };
      }

      if (typeof response === "string") {
        return {
          statusCode,
          code: this.codeFromStatus(statusCode),
          message: response,
          details: {}
        };
      }

      if (isRecord(response)) {
        return {
          statusCode,
          code: this.extractCode(response, statusCode),
          message: this.extractMessage(response, exception.message),
          details: this.extractDetails(response)
        };
      }
    }

    return {
      statusCode: HTTP_STATUS.INTERNAL_SERVER_ERROR,
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
      details: {}
    };
  }

  private extractCode(response: Record<string, unknown>, statusCode: number): string {
    return typeof response.code === "string" ? response.code : this.codeFromStatus(statusCode);
  }

  private extractMessage(response: Record<string, unknown>, fallback: string): string {
    const message = response.message;

    if (typeof message === "string") {
      return message;
    }

    if (Array.isArray(message) && message.every((entry) => typeof entry === "string")) {
      return "Validation failed";
    }

    return fallback;
  }

  private extractDetails(response: Record<string, unknown>): Record<string, unknown> {
    const details = response.details;

    if (isRecord(details)) {
      return details;
    }

    if (Array.isArray(response.message)) {
      return { messages: response.message };
    }

    return {};
  }

  private codeFromStatus(statusCode: number): string {
    switch (statusCode) {
      case HTTP_STATUS.BAD_REQUEST:
        return ERROR_CODES.BAD_REQUEST;
      case HTTP_STATUS.NOT_FOUND:
        return ERROR_CODES.NOT_FOUND;
      case HTTP_STATUS.SERVICE_UNAVAILABLE:
        return ERROR_CODES.SERVICE_UNAVAILABLE;
      case HTTP_STATUS.UNAUTHORIZED:
        return ERROR_CODES.UNAUTHORIZED;
      case HTTP_STATUS.FORBIDDEN:
        return ERROR_CODES.FORBIDDEN;
      case HTTP_STATUS.CONFLICT:
        return ERROR_CODES.CONFLICT;
      case HTTP_STATUS.UNPROCESSABLE_ENTITY:
        return ERROR_CODES.UNPROCESSABLE_ENTITY;
      default:
        return ERROR_CODES.INTERNAL_SERVER_ERROR;
    }
  }
}

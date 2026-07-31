import {
  ArgumentsHost,
  BadRequestException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException
} from "@nestjs/common";
import { Request, Response } from "express";
import { GlobalExceptionFilter } from "./global-exception.filter";

describe("GlobalExceptionFilter", () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function createHost() {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const request = {
      originalUrl: "/api/v1/example"
    } as Request;
    const response = {
      status
    } as unknown as Response;
    const host = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response
      })
    } as ArgumentsHost;

    return { host, status, json };
  }

  it("formats HTTP exceptions consistently", () => {
    const filter = new GlobalExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new BadRequestException(["name must be a string"]), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: {
          code: "BAD_REQUEST",
          message: "Validation failed",
          details: {
            messages: ["name must be a string"]
          }
        },
        path: "/api/v1/example"
      })
    );
  });

  it("hides internal exception details in responses", () => {
    const filter = new GlobalExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new InternalServerErrorException("database password leaked"), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error",
          details: {}
        },
        path: "/api/v1/example"
      })
    );
  });

  it("preserves safe service unavailable response payloads", () => {
    const filter = new GlobalExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(
      new ServiceUnavailableException({
        code: "DESIGN_GENERATION_FAILED",
        message: "System design generation failed",
        details: {
          designSessionId: "33333333-3333-4333-8333-333333333333"
        }
      }),
      host
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: {
          code: "DESIGN_GENERATION_FAILED",
          message: "System design generation failed",
          details: {
            designSessionId: "33333333-3333-4333-8333-333333333333"
          }
        },
        path: "/api/v1/example"
      })
    );
  });
});

import { AppHttpError, HTTP_STATUS } from "../http-error";

export class ServiceUnavailableErrorException extends AppHttpError {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(HTTP_STATUS.SERVICE_UNAVAILABLE, code, message, details);
  }
}

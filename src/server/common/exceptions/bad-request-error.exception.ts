import { AppHttpError, HTTP_STATUS } from "../http-error";

export class BadRequestErrorException extends AppHttpError {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(HTTP_STATUS.BAD_REQUEST, code, message, details);
  }
}

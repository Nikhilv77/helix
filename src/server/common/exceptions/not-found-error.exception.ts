import { AppHttpError, HTTP_STATUS } from "../http-error";

export class NotFoundErrorException extends AppHttpError {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(HTTP_STATUS.NOT_FOUND, code, message, details);
  }
}

import { AppHttpError, HTTP_STATUS } from "../http-error";

export class ConflictErrorException extends AppHttpError {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super(HTTP_STATUS.CONFLICT, code, message, details);
  }
}

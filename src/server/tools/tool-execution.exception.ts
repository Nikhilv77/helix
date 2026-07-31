import { AppHttpError, HTTP_STATUS, type HttpStatusCode } from "../common/http-error";

export type ToolExecutionErrorCode =
  | "TOOL_NOT_FOUND"
  | "TOOL_INPUT_INVALID"
  | "TOOL_OUTPUT_INVALID"
  | "TOOL_EXECUTION_FAILED";

export class ToolExecutionException extends AppHttpError {
  constructor(
    code: ToolExecutionErrorCode,
    message: string,
    details: Record<string, unknown> = {},
    statusCode: HttpStatusCode = HTTP_STATUS.BAD_REQUEST
  ) {
    super(statusCode, code, message, details);
  }
}

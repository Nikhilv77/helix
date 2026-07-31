import { HttpException, HttpStatus } from "@nestjs/common";

export type ToolExecutionErrorCode =
  | "TOOL_NOT_FOUND"
  | "TOOL_INPUT_INVALID"
  | "TOOL_OUTPUT_INVALID"
  | "TOOL_EXECUTION_FAILED";

export class ToolExecutionException extends HttpException {
  constructor(
    code: ToolExecutionErrorCode,
    message: string,
    details: Record<string, unknown> = {},
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST
  ) {
    super(
      {
        code,
        message,
        details
      },
      statusCode
    );
  }
}


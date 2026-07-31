import { ConflictException } from "@nestjs/common";

export class ConflictErrorException extends ConflictException {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super({
      code,
      message,
      details
    });
  }
}

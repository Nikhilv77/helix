import { NotFoundException } from "@nestjs/common";

export class NotFoundErrorException extends NotFoundException {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super({
      code,
      message,
      details
    });
  }
}

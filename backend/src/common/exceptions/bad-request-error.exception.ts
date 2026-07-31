import { BadRequestException } from "@nestjs/common";

export class BadRequestErrorException extends BadRequestException {
  constructor(code: string, message: string, details: Record<string, unknown> = {}) {
    super({
      code,
      message,
      details
    });
  }
}


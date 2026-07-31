import { KnowledgeSourceType } from "@prisma/client";
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";
import { Trim } from "../../common/decorators/trim.decorator";

export class CreateKnowledgeDocumentDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @IsEnum(KnowledgeSourceType)
  sourceType!: KnowledgeSourceType;

  @Trim()
  @IsOptional()
  @IsUrl({
    protocols: ["http", "https"],
    require_protocol: true
  })
  @MaxLength(2000)
  sourceUrl?: string | null;

  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(200000)
  content!: string;
}

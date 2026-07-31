import { KnowledgeSourceType } from "@prisma/client";
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";
import { Type } from "class-transformer";
import { Trim } from "../../common/decorators/trim.decorator";

export class RetrievalSearchDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  query!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50)
  topK?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  minSimilarity?: number;

  @IsOptional()
  @IsEnum(KnowledgeSourceType)
  sourceType?: KnowledgeSourceType;

  @IsOptional()
  @IsUUID()
  documentId?: string;
}

import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { Trim } from "../../common/decorators/trim.decorator";

export class UpdateDesignSessionDto {
  @Trim()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @Trim()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  problemStatement?: string;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  currentStep?: string;
}

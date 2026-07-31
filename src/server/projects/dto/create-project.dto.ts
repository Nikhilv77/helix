import { IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { Trim } from "../../common/decorators/trim.decorator";

export class CreateProjectDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name!: string;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

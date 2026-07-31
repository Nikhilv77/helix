import { IsString, MaxLength, MinLength } from "class-validator";
import { Trim } from "../../common/decorators/trim.decorator";

export class CreateDesignSessionDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title!: string;

  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  problemStatement!: string;
}

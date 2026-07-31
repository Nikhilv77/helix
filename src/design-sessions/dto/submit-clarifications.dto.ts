import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested
} from "class-validator";
import { Trim } from "../../common/decorators/trim.decorator";

export class ClarificationAnswerDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  questionId!: string;

  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(3000)
  answer!: string;
}

export class SubmitClarificationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ClarificationAnswerDto)
  answers!: ClarificationAnswerDto[];
}


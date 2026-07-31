import { ProjectStatus } from "@prisma/client";
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { Trim } from "../../common/decorators/trim.decorator";
import { PaginationQueryDto } from "../../common/dto/pagination-query.dto";

export const PROJECT_SORT_FIELDS = ["createdAt", "updatedAt", "name", "status"] as const;
export type ProjectSortField = (typeof PROJECT_SORT_FIELDS)[number];

export class ListProjectsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @Trim()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

  @IsOptional()
  @IsIn(PROJECT_SORT_FIELDS)
  sortBy: ProjectSortField = "createdAt";
}

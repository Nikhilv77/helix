import { Body, Controller, Post } from "@nestjs/common";
import { RetrievalSearchDto } from "./dto/retrieval-search.dto";
import { RetrievalSearchResponse, RetrievalService } from "./retrieval.service";

@Controller({
  path: "retrieval",
  version: "1"
})
export class RetrievalController {
  constructor(private readonly retrievalService: RetrievalService) {}

  @Post("search")
  search(@Body() body: RetrievalSearchDto): Promise<RetrievalSearchResponse> {
    return this.retrievalService.search(body);
  }
}

import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, map } from "rxjs";
import { ApiSuccessResponse } from "../types/api-response.type";
import { isRecord } from "../utils/is-record";

interface ResponsePayload<TData> {
  data: TData;
  meta?: Record<string, unknown>;
}

@Injectable()
export class ApiResponseInterceptor<TData>
  implements NestInterceptor<TData, ApiSuccessResponse<TData>>
{
  intercept(_context: ExecutionContext, next: CallHandler<TData>): Observable<ApiSuccessResponse<TData>> {
    return next.handle().pipe(
      map((data) => {
        const payload = this.normalizePayload(data);

        return {
          success: true,
          data: payload.data,
          meta: payload.meta ?? {},
          timestamp: new Date().toISOString()
        };
      })
    );
  }

  private normalizePayload(data: TData): ResponsePayload<TData> {
    if (isRecord(data) && "data" in data) {
      const meta = isRecord(data.meta) ? data.meta : {};

      return {
        data: data.data as TData,
        meta
      };
    }

    return {
      data
    };
  }
}

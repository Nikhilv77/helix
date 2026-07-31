import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { GlobalExceptionFilter } from "./filters/global-exception.filter";
import { ApiResponseInterceptor } from "./interceptors/api-response.interceptor";
import { RequestLoggingInterceptor } from "./interceptors/request-logging.interceptor";

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiResponseInterceptor
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor
    }
  ]
})
export class CommonModule {}

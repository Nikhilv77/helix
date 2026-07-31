import { Global, Module } from "@nestjs/common";
import { AppConfigService } from "./app-config.service";
import { validateEnvironment } from "./environment.schema";

@Global()
@Module({
  providers: [
    {
      provide: AppConfigService,
      useFactory: () => new AppConfigService(validateEnvironment(process.env))
    }
  ],
  exports: [AppConfigService]
})
export class ConfigModule {}

import "dotenv/config";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";
import { NestFactory } from "@nestjs/core";
import { json } from "express";
import { AppModule } from "./app.module";
import { AppConfigService } from "./config/app-config.service";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(AppConfigService);

  app.use(json({ limit: "1mb" }));
  app.setGlobalPrefix("api");
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: "1"
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.enableShutdownHooks();
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      if (!origin || config.corsOrigins.includes("*") || config.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    }
  };

  app.enableCors(corsOptions);

  try {
    await app.listen(config.port);
  } catch (error) {
    if (isAddressInUseError(error)) {
      console.error(
        `Port ${config.port} is already in use. Stop the existing backend process or set PORT to another value.`
      );
      console.error(`Find the process with: lsof -nP -iTCP:${config.port} -sTCP:LISTEN`);
      await app.close();
      process.exit(1);
    }

    throw error;
  }
}

void bootstrap();

function isAddressInUseError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "EADDRINUSE"
  );
}

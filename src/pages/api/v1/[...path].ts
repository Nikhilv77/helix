import "reflect-metadata";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import type { CorsOptions } from "@nestjs/common/interfaces/external/cors-options.interface";
import { NestFactory } from "@nestjs/core";
import { ExpressAdapter } from "@nestjs/platform-express";
import type { NextApiRequest, NextApiResponse } from "next";
import express, { json } from "express";
import { AppModule } from "../../../../backend/src/app.module";
import { AppConfigService } from "../../../../backend/src/config/app-config.service";

export const config = {
  api: {
    bodyParser: false
  }
};

let cachedServer: express.Express | null = null;

async function getServer(): Promise<express.Express> {
  if (cachedServer) {
    return cachedServer;
  }

  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bodyParser: false,
    logger: process.env.NODE_ENV === "production" ? ["error", "warn"] : undefined
  });
  const appConfig = app.get(AppConfigService);

  server.use(json({ limit: "1mb" }));
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

  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      if (!origin || appConfig.corsOrigins.includes("*") || appConfig.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    }
  };

  app.enableCors(corsOptions);
  await app.init();
  cachedServer = server;

  return server;
}

export default async function handler(
  request: NextApiRequest,
  response: NextApiResponse
): Promise<void> {
  const server = await getServer();

  server(request, response);
}

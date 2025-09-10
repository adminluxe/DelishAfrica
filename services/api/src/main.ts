import "reflect-metadata";
import * as dotenv from "dotenv";
dotenv.config();
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import * as cookieParser from "cookie-parser";
import * as express from "express";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.use(cookieParser());
  app.setGlobalPrefix("api");

  // Stripe webhook needs raw body
  app.use("/webhooks/stripe", express.raw({ type: "application/json" }));

  await app.listen(process.env.PORT || 4000);
  console.log(`API listening on http://localhost:${process.env.PORT || 4000}`);
}
bootstrap();

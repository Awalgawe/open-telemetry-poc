import { fastifyOtelInstrumentation, tracer } from "./init-opentelemetry";
import Fastify, {
  FastifyBaseLogger,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { createYoga } from "graphql-yoga";
import { builder } from "./schema"; // Import the GraphQL schema
import type Redis from "ioredis";
import redis from "./redis";
import pino from "pino";
import pretty from "pino-pretty"; // Import pino-pretty
import elasticsearch, { initElasticsearch } from "./elasticsearch-client";
import db, { initDB } from "./kysely-client";
import { Span, SpanStatusCode } from "@opentelemetry/api";

export interface YogaContext {
  req: FastifyRequest;
  reply: FastifyReply;
  redis: Redis;
  logger: FastifyBaseLogger;
  elasticsearch: typeof elasticsearch;
  db: typeof db;
}

async function start(span: Span) {
  const logger = pino(
    {
      transport: {
        target: "pino-pretty", // Use pino-pretty for log formatting
        options: {
          colorize: true, // Enable colored output
        },
      },
    },
    pretty()
  );

  logger.info("Starting...");

  span.addEvent("Initializing clients");

  await Promise.all([initDB(logger), initElasticsearch(logger)]);

  span.addEvent("Initializing Fastify server");

  // Create a Fastify server
  const app = Fastify({
    loggerInstance: logger,
  });

  app.register(fastifyOtelInstrumentation.plugin());

  // Create a Yoga instance
  const yoga = createYoga<YogaContext>({
    schema: builder.toSchema(),
    logging: {
      debug: (...args) => args.forEach((arg) => app.log.debug(arg)),
      info: (...args) => args.forEach((arg) => app.log.info(arg)),
      warn: (...args) => args.forEach((arg) => app.log.warn(arg)),
      error: (...args) => args.forEach((arg) => app.log.error(arg)),
    },
  });

  // Register Yoga as a Fastify route
  app.route({
    url: yoga.graphqlEndpoint,
    method: ["GET", "POST", "OPTIONS"],
    handler: async (req, reply) => {
      const response = await yoga.handleNodeRequestAndResponse(req, reply, {
        req,
        reply,
        redis,
        logger: app.log,
        elasticsearch,
        db,
      });

      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });

      reply.status(response.status);
      reply.send(response.body);

      return reply;
    },
  });

  // Define a sample route
  app.get("/ping", async (request, reply) => {
    return { message: "pong" };
  });

  // Start the server
  app.listen({ port: 3000, host: "0.0.0.0" }, (err, address) => {
    if (err) {
      console.error("Error starting server:", err);
      process.exit(1);
    }
    console.log(`Server running at ${address}`);
  });

  span.setStatus({ code: SpanStatusCode.OK });

  span.end();
}

tracer.startActiveSpan("bootstrapping", { root: true }, start);

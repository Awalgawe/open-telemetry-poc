import { NodeSDK } from "@opentelemetry/sdk-node";
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis";
import { GraphQLInstrumentation } from "@opentelemetry/instrumentation-graphql";
import { Resource } from "@opentelemetry/resources";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { FastifyOtelInstrumentation } from "@fastify/otel";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import {
  trace,
  diag,
  DiagConsoleLogger,
  DiagLogLevel,
} from "@opentelemetry/api";
import { PgInstrumentation } from "@opentelemetry/instrumentation-pg";
import { DataloaderInstrumentation } from "@opentelemetry/instrumentation-dataloader";

const otlpExporter = new OTLPTraceExporter({
  url: "http://jaeger:4318/v1/traces",
});

export const fastifyOtelInstrumentation = new FastifyOtelInstrumentation({});

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: "api",
  }),
  spanProcessor: new SimpleSpanProcessor(otlpExporter),
  instrumentations: [
    new HttpInstrumentation(),
    new IORedisInstrumentation(),
    new GraphQLInstrumentation(),
    fastifyOtelInstrumentation,
    new PgInstrumentation(),
    new DataloaderInstrumentation(),
  ],
});

try {
  sdk.start();
  console.log("OpenTelemetry initialized for GraphQL and ioredis");
  console.log("Use @fastify/otel for Fastify instrumentation");
} catch (error) {
  console.error("Error initializing OpenTelemetry:", error);
}

export const tracer = trace.getTracer("api");

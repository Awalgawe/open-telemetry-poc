import { tracer } from "./init-opentelemetry";
import SchemaBuilder, { InterfaceParam, SchemaTypes } from "@pothos/core";
import TracingPlugin, { isRootField } from "@pothos/plugin-tracing";
import { createOpenTelemetryWrapper } from "@pothos/tracing-opentelemetry";
import { YogaContext } from ".";
import { table_name, TestItem } from "./kysely-client";
import DataLoaderPlugin from "@pothos/plugin-dataloader";

const createSpan = createOpenTelemetryWrapper(tracer, {
  includeSource: true,
});

export const builder = new SchemaBuilder<{ Context: YogaContext }>({
  plugins: [TracingPlugin, DataLoaderPlugin],
  tracing: {
    default: (config) => isRootField(config),
    wrap: (resolver, config) => createSpan(resolver, config),
  },
});

const myObjectRef = builder.objectRef("MyObject");

const myObject = builder.objectType(myObjectRef, {
  fields: (t) => ({
    id: t.string({
      tracing: true,
      async resolve(source, args, { redis, logger }) {
        let response = await redis.get("id");

        if (!response) {
          logger.info("Setting response to 'id'");
          response = "id";
          await redis.set("id", response);
        } else {
          logger.info("Response found in cache");
        }

        return response;
      },
    }),
    name: t.string({
      resolve: () => "MyObject",
    }),
  }),
});

const index = "test";

interface TestIndexDocument {
  title: string;
  content: string;
  timestamp: string;
}

const myElasticsearchRef = builder.objectRef<TestIndexDocument>(
  "MyElasticsearchObject"
);

const myElasticsearchObject = builder.objectType(myElasticsearchRef, {
  fields: (t) => ({
    title: t.string({
      resolve: (source) => source.title,
    }),
    content: t.string({ resolve: (source) => source.content }),
    timestamp: t.string({
      resolve: (source, _, { logger }) => {
        logger.info({ source });
        return source.timestamp;
      },
    }),
  }),
});

const myDBObjectRef = builder.objectRef<TestItem>("MyDBObject");

const MyDBObject = builder.objectType(myDBObjectRef, {
  fields: (t) => ({
    id: t.int({
      resolve: (source) => source.id,
    }),
    description: t.string({
      resolve: (source) => source.description,
    }),
    created_at: t.string({
      resolve: (source) => source.created_at.toISOString(),
    }),
  }),
});

const loadableObject = builder.loadableObject<
  TestItem,
  number,
  // @ts-expect-error ignore
  InterfaceParam<SchemaTypes>[],
  number
>("LoadableObject", {
  load(keys, { db }) {
    return db
      .selectFrom(table_name)
      .where("id", "in", keys)
      .selectAll()
      .execute();
  },
  fields: (t) => ({
    id: t.int({
      resolve: (source) => source.id,
    }),
    description: t.string({
      resolve: (source) => source.description,
    }),
    created_at: t.string({
      resolve: (source) => source.created_at,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    fromDataloader: t.field({
      type: loadableObject,
      resolve: () => 1,
    }),
    fromDB: t.field({
      type: MyDBObject,
      async resolve(source, args, { db }) {
        return await db.selectFrom(table_name).selectAll().executeTakeFirst();
      },
    }),
    fromElasticSearch: t.field({
      type: myElasticsearchObject,
      async resolve(source, args, { elasticsearch }) {
        const response = await elasticsearch.search<TestIndexDocument>({
          index,
          body: {
            query: {
              match_all: {},
            },
          },
        });

        return response.hits.hits[0]?._source;
      },
    }),

    fromRedis: t.string({
      async resolve(source, ags, { redis, logger }) {
        let response = await redis.get("hello");

        if (!response) {
          logger.info("Setting response to 'world'");
          response = "world";
          await redis.set("hello", response);
        } else {
          logger.info("Response found in cache");
        }

        return response;
      },
    }),
    nested: t.field({
      type: myObject,
      resolve: () => ({}),
    }),
  }),
});

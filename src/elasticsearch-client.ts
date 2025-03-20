import { Client } from "@elastic/elasticsearch";
import { Logger } from "pino";

export const index = "test";

// Interface for the 'test' index
export interface TestIndexDocument {
  title: string;
  content: string;
  timestamp: string;
}

const client = new Client({
  node: "http://elasticsearch:9200", // Connect to the Elasticsearch service in the Docker network
});

export default client;

export async function initElasticsearch(logger: Logger) {
  const indexExists = await client.indices.exists({ index });

  if (indexExists) {
    return;
  }

  logger.info("Creating the 'test' index in Elasticsearch");

  await client.indices.create({
    index,
    body: {
      mappings: {
        properties: {
          title: { type: "text" },
          content: { type: "text" },
          timestamp: { type: "date" },
        },
      },
    },
  });

  logger.info("Add a sample document to the 'test' index");

  await client.index<TestIndexDocument>({
    index,
    document: {
      title: "Sample Document",
      content: "This is a test document for Elasticsearch.",
      timestamp: new Date().toISOString(),
    },
  });
}

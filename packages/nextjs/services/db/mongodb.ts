import { MongoClient, MongoClientOptions } from "mongodb";
import { attachDatabasePool } from "@vercel/functions";

const uri = process.env.MONGODB_URI;
const options: MongoClientOptions = {
  appName: "devrel.vercel.integration",
};

let client: MongoClient | undefined;

if (!uri) {
  throw new Error(
    "MongoDB URI is not defined. Please check your MONGODB_URI environment variable."
  );
}

if (process.env.NODE_ENV === "development") {
  const globalWithMongo = global as typeof globalThis & {
    _mongoClient?: MongoClient;
  };

  if (!globalWithMongo._mongoClient) {
    globalWithMongo._mongoClient = new MongoClient(uri, options);
  }

  client = globalWithMongo._mongoClient;
} else {
  client = new MongoClient(uri, options);

  attachDatabasePool(client);
}

export default client;

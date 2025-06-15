import { Worker } from "bullmq";
import { QdrantVectorStore } from "@langchain/qdrant";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { QdrantClient } from "@qdrant/js-client-rest";
import { CharacterTextSplitter } from "@langchain/textsplitters";
import dotenv from "dotenv";
import IORedis from "ioredis";

dotenv.config();
console.log("🚀 Worker started");

const COLLECTION_NAME = "test1";

const embeddings = new HuggingFaceInferenceEmbeddings({
  apiKey: process.env.HF_TOKEN,
	model: "sentence-transformers/all-mpnet-base-v2",
  maxRetries: 5,
  config: {
    timeout: 20000,
  },
});

const client = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
  checkCompatibility: false,
  timeout:40000,
});

const worker = new Worker(
  "file-upload-queue",
  async (job) => {
    try {
      console.log(`📦 Processing job:`, job.data);
      const { filename, path } = job.data;

      const loader = new PDFLoader(path);
      const docs = await loader.load();

      const splitter = new CharacterTextSplitter({
        separator: "\n",
        chunkSize: 500,
        chunkOverlap: 50,
      });

      const splitDocs = await splitter.splitDocuments(
        docs.map((doc) => ({
          pageContent: doc.pageContent,
          metadata: {
            source: filename,
            loc: { pageNumber: doc.metadata.loc?.pageNumber || 1 },
          },
        }))
      );

      console.log("📄 Split into", splitDocs.length, "chunks");

      // Try to create collection (ignore 409 if it exists)
      try {
        await client.createCollection(COLLECTION_NAME, {
          vectors: {
            size: 768,
            distance: "Cosine",
          },
        });
        console.log(`✅ Collection '${COLLECTION_NAME}' created`);
      } catch (err) {
        if (err.status === 409) {
          console.log(`ℹ️ Collection '${COLLECTION_NAME}' already exists`);
        } else if (err.status === 403) {
          console.error("🚫 Forbidden: Your API key lacks permission to create collections");
          throw err;
        } else {
          console.error("❌ Failed to create collection:", err);
          throw err;
        }
      }

      const vectorStore = await QdrantVectorStore.fromExistingCollection(
        embeddings,
        {
          client,
          collectionName: COLLECTION_NAME,
        }
      );

      await vectorStore.addDocuments(splitDocs);
      console.log(`✅ Added all ${splitDocs.length} documents to Qdrant`);
    } catch (err) {
      console.error("❌ Worker error:", err);
      throw err;
    }
  },
  {
    concurrency: 2,
    connection: new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
    }),
  }
);

worker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err);
});

worker.on("error", (err) => {
  console.error("💥 Worker-level error:", err);
});

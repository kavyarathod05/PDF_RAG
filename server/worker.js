import { Worker } from "bullmq";
import { QdrantVectorStore } from "@langchain/qdrant";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { QdrantClient } from "@qdrant/js-client-rest";
import { CharacterTextSplitter } from "@langchain/textsplitters";
import dotenv from "dotenv";
dotenv.config();
console.log("worker started");

const embeddings = new HuggingFaceInferenceEmbeddings({
  apiKey: process.env.HF_TOKEN,
  maxRetries: 5,
  config: {
    timeout: 20000,
  },
});

const client = new QdrantClient({ url: "http://localhost:6333" });

const worker = new Worker(
  "file-upload-queue",
  async (job) => {
    try {
      console.log(`Job:`, job.data);
      const { filename, path } = job.data; // CHANGED: No JSON.parse

      // Load PDF
      const loader = new PDFLoader(path);
      const docs = await loader.load();

      const splitter = new CharacterTextSplitter({
        separator: "\n",
        chunkSize: 500,
        chunkOverlap: 50,
      });

      // CHANGED: Add metadata before splitting
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

      // DEBUG: Show first few chunks
      splitDocs.slice(0, 3).forEach((doc, i) => {
        console.log(`Chunk ${i + 1}:\n${doc.pageContent}\n`);
      });

      console.log("after fetching client");

      // NEW: Check if collection exists, create if not
      try {
        await client.getCollection("test1");
      } catch (err) {
        console.log("Collection test1 not found, creating...");
        await client.createCollection("test1", {
          vectors: {
            size: 768, // Matches HuggingFace embeddings
            distance: "Cosine",
          },
        });
      }

      const vectorStore = await QdrantVectorStore.fromExistingCollection(
        embeddings,
        {
          client,
          collectionName: "test1",
        }
      );

      // CHANGED: Add splitDocs instead of docs
      await vectorStore.addDocuments(splitDocs);

      console.log(`✅ All docs are added to vector store`);
    } catch (err) {
      console.error("❌ Error in worker:", err);
      throw err; // Retry job
    }
  },
  {
    concurrency: 2, // CHANGED: Reduced for stability
    connection: {
      host: "localhost",
      port: 6379,
    },
  }
);

worker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err);
});

worker.on("error", (err) => {
  console.error("Worker error:", err);
});
import express from "express";
import cors from "cors";
import multer from "multer";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { CharacterTextSplitter } from "@langchain/textsplitters";
// import { Queue } from "bullmq";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAI } from "openai";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
// import IORedis from "ioredis";

// Load environment variables
dotenv.config();
// console.log("🔧 REDIS_URL:", process.env.REDIS_URL);
console.log("🔧 HF_TOKEN:", process.env.HF_TOKEN);
console.log("🔧 QDRANT_URL:", process.env.QDRANT_URL);
console.log("🔧 QDRANT_API_KEY:", process.env.QDRANT_API_KEY);

// Ensure globalThis.fetch is available
if (!globalThis.fetch) {
  globalThis.fetch = fetch;
}

// Initialize OpenAI
const openai = new OpenAI({
  baseURL: "https://router.huggingface.co/nscale/v1",
  apiKey: process.env.HF_TOKEN,
});

// // Redis connection
// const redisConnection = new IORedis(process.env.REDIS_URL, {
//   maxRetriesPerRequest: null,
// });

// Qdrant connection
const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
   timeout: 5000, // Optional: avoid long hangs
  checkCompatibility: false,
});

// Setup Express
const app = express();
app.use(cors());
app.use(express.json());

// Ensure uploads folder exists
const uploadDir = path.join(process.cwd(), "uploads");
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`Created uploads directory: ${uploadDir}`);
  }
} catch (error) {
  console.error("Error creating uploads directory:", error);
  process.exit(1);
}

// Setup BullMQ queue
// const queue = new Queue("file-upload-queue", { connection: redisConnection });

// Setup multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});
const upload = multer({ dest: "uploads/" }); // Use a known local path

app.get("/", (req, res) => {
  return res.json({ status: "All good" });
});

// Upload route
app.post("/upload/pdf", upload.single("pdf"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const { filename, path: filePath } = req.file;

  try {
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();
    console.log(docs);
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
    const COLLECTION_NAME="test3";
    try {
      await qdrantClient.createCollection(COLLECTION_NAME, {
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
        console.error("🚫 Forbidden: API key lacks permission to create collections");
        return res.status(403).json({ error: "Not authorized to create collections" });
      } else {
        throw err;
      }
    }

    const embeddings = new HuggingFaceInferenceEmbeddings({
      apiKey: process.env.HF_TOKEN,
      modelName: "sentence-transformers/all-MiniLM-L6-v2", // smaller/faster model
      maxRetries: 5,
      config: {
        timeout: 50000,
      },
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
      client: qdrantClient,
      collectionName: COLLECTION_NAME,
    });

    await vectorStore.addDocuments(splitDocs);

    console.log(`✅ Added all ${splitDocs.length} documents to Qdrant`);

    res.status(200).json({
      message: "File uploaded and processed successfully",
      filename: req.file.filename,
    });
  } catch (error) {
    console.error("❌ Upload processing error:", error);
    res.status(500).json({ error: "Failed to process uploaded file" });
  }
});
// Chat route
app.get("/chat", async (req, res) => {
  const userQuery = req.query.message;

  if (!userQuery || typeof userQuery !== "string") {
    return res.status(400).json({ error: "Valid message query is required" });
  }

  try {
    const embeddings = new HuggingFaceInferenceEmbeddings({
      apiKey: process.env.HF_TOKEN,
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        client: qdrantClient,
        collectionName: "test3",
      }
    );

    const retriever = vectorStore.asRetriever({ k: 5 });
    const docs = await retriever.invoke(userQuery);
    console.log(docs);
    
    const messages = [
      {
        role: "system",
        content: `You are a helpful AI assistant. Use the following context to answer:\n\n${docs
          .map((doc) => doc.pageContent)
          .join("\n")}`,
      },
      { role: "user", content: userQuery },
    ];

    res.setHeader("Content-Type", "application/json");

    async function retry(fn, retries = 3, delay = 2000) {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          return await fn();
        } catch (err) {
          if (attempt < retries) await new Promise((res) => setTimeout(res, delay));
        }
      }
      throw new Error("All retries failed");
    }

    const stream = await retry(() =>
      openai.chat.completions.create({
        model: "meta-llama/Llama-3.1-8B-Instruct",
        messages,
        temperature: 0.8,
        top_p: 0.7,
        stream: true,
      })
    );

    let fullResponse = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) fullResponse += content;
    }

   function formatResponse(rawText) {
  return rawText
    .replace(/\*\*(.*?)\*\*/g, "$1") // remove bold markdown
    .replace(/\d+\.\s+/g, "- ")       // convert numbered list to bullets
    .replace(/[ \t]*\n[ \t]*/g, "\n") // normalize line breaks
    .replace(/\n{2,}/g, "\n\n")       // reduce multiple blank lines
    .trim();
}
console.log("Raw AI response:\n", fullResponse);
console.log("Formatted:\n", formatResponse(fullResponse));

    res.json({
      role: "assistant",
      response: formatResponse(fullResponse),
      documents: docs.map((doc) => ({
        pageContent: doc.pageContent,
        metadata: doc.metadata,
      })),
    });
  } catch (err) {
    console.error("Chat generation error:", err);
    res.status(500).json({ error: "Chat generation failed" });
  }
});

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`✅ Server started on http://localhost:${PORT}`);
});
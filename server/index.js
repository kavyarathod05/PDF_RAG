import express from "express";
import cors from "cors";
import multer from "multer";
import { Queue } from "bullmq";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { QdrantClient } from "@qdrant/js-client-rest";
import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAI } from "openai";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path"; // Ensure imported
import fs from "fs"; // Ensure imported

dotenv.config();

if (!globalThis.fetch) {
  globalThis.fetch = fetch;
}

const openai = new OpenAI({
  baseURL: "https://router.huggingface.co/nscale/v1",
  apiKey: process.env.HF_TOKEN,
});

const app = express();

// FIXED: Ensure uploads directory exists with error handling
const uploadDir = path.join(process.cwd(), "uploads"); // Use process.cwd() for reliability
try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true }); // recursive: true creates parent dirs if needed
    console.log(`Created uploads directory: ${uploadDir}`);
  }
} catch (error) {
  console.error("Error creating uploads directory:", error);
  process.exit(1); // Exit if directory creation fails (critical for uploads)
}

const queue = new Queue("file-upload-queue", {
  connection: {
    host: "127.0.0.1",
    port: 6379,
  },
});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  return res.json({ status: "All good" });
});

app.post("/upload/pdf", upload.single("pdf"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    await queue.add("file-ready", {
      filename: req.file.originalname,
      destination: req.file.destination,
      path: req.file.path,
    });

    res.status(200).json({
      message: "File uploaded successfully",
      filename: req.file.filename,
    });
  } catch (error) {
    console.error("Error queuing file:", error);
    res.status(500).json({ error: "Failed to process file upload" });
  }
});

app.get("/chat", async (req, res) => {
  const userQuery = req.query.message;

  if (!userQuery || typeof userQuery !== "string") {
    return res
      .status(400)
      .json({ error: "Valid message query parameter is required" });
  }

  try {
    const client = new QdrantClient({ url: "http://localhost:6333" });

    const embeddings = new HuggingFaceInferenceEmbeddings({
      apiKey: process.env.HF_TOKEN,
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        client,
        collectionName: "test1",
      }
    );

    const retriever = vectorStore.asRetriever({ k: 5 });
    const docs = await retriever.invoke(userQuery);

    console.log(
      "Retrieved Docs:",
      docs.map((doc) => ({
        content: doc.pageContent.slice(0, 50) + "...",
        metadata: doc.metadata,
      }))
    );

    const messages = [
      {
        role: "system",
        content: `You are a helpful AI assistant. Use the following context to answer the user's question:\n\nContext: ${docs
          .map((doc) => doc.pageContent)
          .join("\n")}`,
      },
      {
        role: "user",
        content: userQuery,
      },
    ];

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    async function retry(fn, retries = 3, delay = 2000) {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          return await fn();
        } catch (err) {
          console.warn(`Attempt ${attempt} failed:`, err.message);
          if (attempt < retries)
            await new Promise((res) => setTimeout(res, delay));
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
      if (content) {
        fullResponse += content;
      }
    }
    function formatResponse(rawText) {
      return rawText
        .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold markdown (**text** → text)
        .replace(/\d+\.\s+/g, "- ") // Numbered list → bullet points
        .replace(/\s*\n\s*/g, "\n") // Clean up line breaks
        .replace(/([a-zA-Z]):/g, "\n\n$1:") // Add spacing before section titles
        .trim();
    }

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

app.listen(8000, () => {
  console.log(`✅ Server started on http://localhost:8000`);
});

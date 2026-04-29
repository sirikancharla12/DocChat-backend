import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";
import multer from "multer";
import pdfParse from "pdf-parse";


dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

let documentText = "";

app.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Only PDF files are supported" });
    }

    const pdfData = await pdfParse(req.file.buffer);
    let extractedText = pdfData.text?.trim();

    console.log("Extracted length:", extractedText?.length);

    // 🔥 IMPORTANT CHECK
    if (!extractedText || extractedText.length < 50) {
      return res.status(400).json({
        error: "This PDF is scanned/image-based. Please upload a text-based PDF.",
      });
    }

    documentText = extractedText;

    res.json({
      message: "File uploaded and text extracted successfully",
      length: documentText.length,
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Ask question
app.post("/ask", async (req, res) => {
  try {
    if (!documentText) {
      return res.status(400).json({ error: "Upload a document first" });
    }

    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Question is required" });
    }

    const prompt = `
You are a strict document-based assistant.

You MUST answer ONLY using the provided document.

If the answer is not clearly found, reply exactly:
"Not in document"

--- DOCUMENT START ---
${documentText}
--- DOCUMENT END ---

Question: ${query}
`;

    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [{ role: "user", content: prompt }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      answer: response.data.choices[0].message.content,
    });
  } catch (err) {
    console.log(err.response?.data || err.message);
    res.status(500).json({ error: "Error answering question" });
  }
});

app.listen(5000, () => console.log("Server running on 5000"));
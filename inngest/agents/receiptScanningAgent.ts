import { createAgent, createTool } from "@inngest/agent-kit";
import { z } from "zod";

// Manually call the Gemini API using fetch()
async function callGeminiAPI(messages: any) {
  const apiKey = process.env.GEMINI_API_KEY; // Ensure this is set in your .env
  const response = await fetch("https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + apiKey, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ 
      contents: messages 
    }),
  });

  const data = await response.json();
  return data;
}

// Define the receipt parsing tool
const parsePdfTool = createTool({
  name: "parse-pdf",
  description: "Analyzes the given pdf",
  parameters: z.object({
    pdfUrl: z.string(),
  }),
  handler: async ({ pdfUrl }, { step }) => {
    try {
      // Call Gemini API instead of Claude
      return await callGeminiAPI([
        {
          role: "user",
          parts: [
            { 
              text: `Extract the data from the receipt and return the structured output as follows: 
              (Include the JSON format here exactly like in your example)` 
            },
            { 
              inlineData: { mimeType: "application/pdf", data: pdfUrl } 
            }
          ]
        }
      ]);
    } catch (error) {
      console.error(error);
      throw error;
    }
  },
});

// Define the receipt scanning agent
export const receiptScanningAgent = createAgent({
  name: "Receipt Scanning Agent",
  description:
    "Processes receipt images and PDFs to extract key information such as vendor names, dates, amounts, and line items",
  system: `You are an AI-powered receipt-scanning assistant... (rest of your prompt here)`,
  tools: [parsePdfTool],
});

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import convex from "@/lib/convexClient";
import { client } from "@/lib/schematic";
import { createAgent, createTool } from "@inngest/agent-kit";
import { z } from "zod";

// Tool to call Gemini API
const geminiTool = createTool({
  name: "gemini-api-call",
  description: "Calls Google Gemini API to process receipt data",
  parameters: z.object({
    messages: z.array(z.object({
      role: z.string(),
      content: z.string(),
    })),
  }),
  handler: async ({ messages }) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: messages }),
        }
      );

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Gemini API Error:", error);
      return { error: "Failed to call Gemini API" };
    }
  },
});

// Tool to save extracted data to the database
const saveToDatabaseTool = createTool({
  name: "save-to-database",
  description: "Saves extracted receipt data to the convex database",
  parameters: z.object({
    fileDisplayName: z.string(),
    receiptId: z.string(),
    merchantName: z.string(),
    merchantAddress: z.string(),
    merchantContact: z.string(),
    transactionDate: z.string(),
    transactionAmount: z.number(),
    receiptSummary: z.string(),
    currency: z.string(),
    items: z.array(
      z.object({
        name: z.string(),
        quantity: z.number(),
        unitPrice: z.number(),
        totalPrice: z.number(),
      })
    ),
  }),
  handler: async (params) => {
    try {
      const { receiptId, ...receiptData } = params;

      // Save to convex database
      const { userId } = await convex.mutation(
        api.receipts.updateReceiptWithExtractedData,
        { id: receiptId as Id<"receipts">, ...receiptData }
      );

      // Track the event for analytics
      await client.track({ event: "scan", company: { id: userId }, user: { id: userId } });

      return { addedToDb: "Success" };
    } catch (error) {
      return { addedToDb: "Failed", error: error.message || "Unknown error" };
    }
  },
});

// Define the agent using Gemini (via the custom tool)
export const databaseAgent = createAgent({
  name: "Database Agent",
  description: "Processes receipt data and saves it to the database.",
  system: "You process receipt data, structure it, and save it efficiently.",
  tools: [geminiTool, saveToDatabaseTool], // Use Gemini API as a tool
});

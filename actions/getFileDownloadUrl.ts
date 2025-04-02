"use server";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import convex from "@/lib/convexClient";

// Server action to get download URL for a file in convex storage

export async function getFileDownloadUrl(fileId: Id<"_storage"> | string) {
  try {
    // Get download URL from convex
    const downloadUrl = await convex.query(api.receipts.getReceiptDownloadUrl, {
      fileId: fileId as Id<"_storage">,
    });

    if (!downloadUrl) {
      throw new Error("Could not generate download URL");
    }

    return {
      success: true,
      downloadUrl,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

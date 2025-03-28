"use server";

import { api } from "@/convex/_generated/api";
import convex from "@/lib/convexClient";
import { currentUser } from "@clerk/nextjs/server";
import { getFileDownloadUrl } from "./getFileDownloadUrl";

export async function uploadPDF(formData: FormData) {
  const user = await currentUser();

  if (!user) {
    return {
      success: false,
      error: "Unauthenticated",
    };
  }

  try {
    // Obtain pdf file from form data
    const file = formData.get("file") as File;

    if (!file) {
      return {
        success: false,
        error: "No file uploaded",
      };
    }

    // Validate file type
    if (
      !file.type.includes("pdf") &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return {
        success: false,
        error: "Only PDF files can be uploaded",
      };
    }

    // Get upload URL from convex
    const uploadUrl = await convex.mutation(api.receipts.generateUploadUrl, {});

    // Convert file to array buffer for fetch API
    const arrayBuffer = await file.arrayBuffer();

    // Upload file to convex storage
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": file.type,
      },
      body: new Uint16Array(arrayBuffer),
    });

    if (!uploadResponse.ok) {
      throw new Error(
        `Failed to upload the file: ${uploadResponse.statusText}`,
      );
    }
    // Get storage Id
    const { storageId } = await uploadResponse.json();

    // Add receipt to db
    const receiptId = await convex.mutation(api.receipts.storeReceipt, {
      userId: user.id,
      fileId: storageId,
      fileName: file.name,
      size: file.size,
      mimeType: file.type,
    });

    // Generate file URL
    const fileUrl = await getFileDownloadUrl(storageId);

    // Trigger inngest agent

    return {
      success: true,
      data: {
        receiptId,
        fileName: file.name,
      },
    };
  } catch (error) {
    console.error("Error uploading PDF", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "An unknown error occurred",
    };
  }
}

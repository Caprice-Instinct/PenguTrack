import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Function to generate convex upload url for client
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    //  Generating a URL client can use to upload a file
    return await ctx.storage.generateUploadUrl();
  },
});

export const storeReceipt = mutation({
  args: {
    userId: v.string(),
    fileId: v.id("_storage"),
    fileName: v.string(),
    size: v.number(),
    mimeType: v.string(),
  },
  handler: async (ctx, args) => {
    // Save receipt to db
    const receiptId = await ctx.db.insert("receipts", {
      userId: args.userId,
      fileName: args.fileName,
      fileId: args.fileId,
      uploadedAt: Date.now(),
      size: args.size,
      mimeType: args.mimeType,
      status: "pending",

      // Fields for the extracted data as null for now
      merchantName: undefined,
      merchantAddress: undefined,
      merchantContact: undefined,
      transactionDate: undefined,
      transactionAmount: undefined,
      currency: undefined,
      items: [],
    });

    return receiptId;
  },
});

// Function to fetch all receipts
export const getReceipts = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Return receipts for authenticated user
    return await ctx.db
      .query("receipts")
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .collect();
  },
});

// Function get a single receipts by Id
export const getReceiptById = query({
  args: {
    id: v.id("receipts"),
  },
  handler: async (ctx, args) => {
    // Get the receipt
    const receipt = await ctx.db.get(args.id);

    // Verify user has access to the receipt
    if (receipt) {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) {
        throw new Error("Not authenticated");
      }

      const userId = identity.subject;
      if (receipt.userId !== userId) {
        throw new Error("Not authorised to access this receipt");
      }
    }
  },
});

// Generate a URL to download a receipt file
export const getReceiptDownloadUrl = query({
  args: {
    fileId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    // Get temporary download URL from convex to download file
    return await ctx.storage.getUrl(args.fileId);
  },
});

// Update receipt status
// export const updateReceiptStatus = mutation({
//   args: {
//     id: v.id("receipts"),
//     status: v.string(),
//   },
//   handler: async (ctx, args) => {
//     // Verify if user has access to the receipt
//     const receipt = await ctx.db.get(args.id);

//     if (!receipt) {
//       throw new Error("Receipt not found");
//     }

//     const identity = await ctx.auth.getUserIdentity();
//     if (!identity) {
//       throw new Error("Not authenticated");
//     }

//     const userId = identity.subject;
//     if (receipt.userId !== userId) {
//       throw new Error("Not authorised to access this receipt");
//     }

//     await ctx.db.patch(args.id, {
//       status: args.status,
//     });
//     return true;
//   },
// });

// Delete receipt and its file
export const deleteReceipt = mutation({
  args: {
    id: v.id("receipts"),
  },
  handler: async (ctx, args) => {
    const receipt = await ctx.db.get(args.id);

    if (!receipt) {
      throw new Error("Receipt not found");
    }

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const userId = identity.subject;
    if (receipt.userId !== userId) {
      throw new Error("Not authorised to access this receipt");
    }

    // Delete file from storage
    await ctx.storage.delete(receipt.fileId);

    // Delete receipt from db
    await ctx.db.delete(args.id);

    return true;
  },
});

// Update a receipt with extracted data
export const updateReceiptWithExtractedData = mutation({
  args: {
    id: v.id("receipts"),
    fileDisplayName: v.string(),
    merchantName: v.string(),
    merchantAddress: v.string(),
    merchantContact: v.string(),
    transactionDate: v.string(),
    transactionAmount: v.number(),
    currency: v.string(),
    receiptSummary: v.string(),
    items: v.array(
      v.object({
        name: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        totalPrice: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const receipt = await ctx.db.get(args.id);

    if (!receipt) {
      throw new Error("Receipt not found");
    }

    //  Update receipt with extracted data from the AI agents
    await ctx.db.patch(args.id, {
      fileDisplayName: args.fileDisplayName,
      merchantName: args.merchantName,
      merchantAddress: args.merchantAddress,
      merchantContact: args.merchantContact,
      transactionDate: args.transactionDate,
      transactionAmount: args.transactionAmount,
      currency: args.currency,
      receiptSummary: args.receiptSummary,
      items: args.items,
      status: "processed",
    });

    return {
      userId: receipt.userId,
    };
  },
});

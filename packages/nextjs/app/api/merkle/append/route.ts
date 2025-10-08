// app/api/merkle/append/route.ts

import { NextRequest, NextResponse } from "next/server";
import { IncrementalMerkleTree } from "~~/utils/circuit/merkle-tree";

export async function POST(request: NextRequest) {
  let tree: IncrementalMerkleTree | undefined;
  try {
    const body = await request.json();
    const { leafHash } = body;

    if (
      !leafHash ||
      typeof leafHash !== "string" ||
      !leafHash.startsWith("0x")
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid or missing leafHash. Must be a 0x-prefixed hex string.",
        },
        { status: 400 }
      );
    }

    const leafHashBigInt = BigInt(leafHash);

    tree = await IncrementalMerkleTree.create();

    const leafIndex = tree.getNextIndex();

    await tree.append(leafHashBigInt);

    const newRoot = await tree.getRoot();

    console.log(
      `Successfully appended leaf at index ${leafIndex}. New root: 0x${newRoot.toString(16)}`
    );

    return NextResponse.json({
      success: true,
      leafIndex: leafIndex.toString(),
      newRoot: "0x" + newRoot.toString(16),
    });
  } catch (error) {
    console.error("Error appending to merkle tree:", error);
    return NextResponse.json(
      {
        error: "Failed to append to merkle tree",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  } finally {
    if (tree) {
      await tree.close();
    }
  }
}

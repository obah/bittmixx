import { NextRequest, NextResponse } from "next/server";
import { IncrementalMerkleTree } from "~~/utils/circuit/merkle-tree";

export async function GET(request: NextRequest) {
  let tree: IncrementalMerkleTree | undefined;
  try {
    tree = await IncrementalMerkleTree.create();

    const rootHash = await tree.getRoot();

    return NextResponse.json({
      rootHash: "0x" + rootHash.toString(16),
      success: true,
    });
  } catch (error) {
    console.error("Error getting merkle root:", error);
    return NextResponse.json(
      {
        error: "Failed to get merkle root",
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

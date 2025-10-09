import { NextRequest, NextResponse } from "next/server";
import { IncrementalMerkleTree } from "~~/utils/circuit/merkle-tree";

export async function POST(request: NextRequest) {
  let tree: IncrementalMerkleTree | undefined;
  try {
    const body = await request.json();
    const { leafIndex } = body;

    if (leafIndex === undefined || leafIndex === null) {
      return NextResponse.json(
        {
          error: "Invalid or missing leafIndex.",
        },
        { status: 400 }
      );
    }

    const leafIndexBigInt = BigInt(leafIndex);

    tree = await IncrementalMerkleTree.create();

    // Check if the index is valid (not beyond the next index)
    if (leafIndexBigInt >= tree.getNextIndex()) {
      return NextResponse.json(
        {
          error: `Invalid leaf index. Must be less than ${tree.getNextIndex().toString()}`,
        },
        { status: 400 }
      );
    }

    const proof = await tree.getProof(leafIndexBigInt);

    // Convert siblings to hex strings
    const siblingsHex = proof.siblings.map((s) => "0x" + s.toString(16));

    return NextResponse.json({
      success: true,
      siblings: siblingsHex,
      isEvenSides: proof.isEvenSides,
    });
  } catch (error) {
    console.error("Error generating merkle proof:", error);
    return NextResponse.json(
      {
        error: "Failed to generate merkle proof",
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

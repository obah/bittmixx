export const appendNewLeaf = async (hash: string) => {
  try {
    const response = await fetch("/api/merkle/append", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ leafHash: hash }),
    });

    const data = await response.json();

    if (response.ok) {
      return data.leafIndex;
    } else {
      console.error("Failed to append leaf:", data.error);
      return null;
    }
  } catch (error) {
    console.error("An error occurred:", error);
    return null;
  }
};

export const getMerkleRoot = async () => {
  try {
    const response = await fetch("/api/merkle/root");
    const data = await response.json();
    return data.rootHash;
  } catch (error) {
    console.error("An error occurred:", error);
    return null;
  }
};

export const getMerkleProof = async (leafIndex: string | number | bigint) => {
  try {
    const response = await fetch("/api/merkle/proof", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ leafIndex: leafIndex.toString() }),
    });

    const data = await response.json();

    if (response.ok) {
      return {
        proof: data.siblings,
        isEvenSides: data.isEvenSides,
      };
    } else {
      console.error("Failed to generate proof:", data.error);
      return null;
    }
  } catch (error) {
    console.error("An error occurred:", error);
    return null;
  }
};

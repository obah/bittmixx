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
      console.log("Successfully appended leaf!");
      console.log("Leaf Index:", data.leafIndex);
      console.log("New Merkle Root:", data.newRoot);
    } else {
      console.error("Failed to append leaf:", data.error);
    }
  } catch (error) {
    console.error("An error occurred:", error);
  }
};

export const getMerkleRoot = async () => {
  try {
    const response = await fetch("/api/merkle/root");
    const data = await response.json();
    return data.rootHash;
  } catch (error) {
    console.error("An error occurred:", error);
  }
};

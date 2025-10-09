"use client";

import Link from "next/link";
import Image from "next/image";
import { ConnectedAddress } from "~~/components/ConnectedAddress";
import { generateNote } from "~~/utils/circuit/generate-note";
import {
  getMerkleRoot,
  appendNewLeaf,
  getMerkleProof,
} from "~~/utils/circuit/merkle-functions";
import { useEffect } from "react";

const Home = () => {
  useEffect(() => {
    const processNote = async () => {
      const { nullifier, nullifierHash, secret, commitment } = generateNote(
        "gold",
        1000
      );

      console.log("nullifier", nullifier);
      console.log("nullifierHash", nullifierHash);
      console.log("secret", secret);
      console.log("commitment", commitment);

      // Append the commitment to the merkle tree
      const commitmentHex = "0x" + commitment.toString(16);
      const leafIndex = await appendNewLeaf(commitmentHex);

      if (leafIndex !== null) {
        console.log("Appended leaf at index:", leafIndex);

        // Get the merkle proof for the newly appended leaf
        const proofData = await getMerkleProof(leafIndex);

        // Get the root after commitment was appended
        const root = await getMerkleRoot();

        if (proofData && root) {
          console.log("Root (after commitment appended):", root);
          console.log("isEvenSides:", proofData.isEvenSides);
          console.log("Proof:", proofData.proof);
        }
      }
    };

    processNote();
  }, []);

  return (
    <div className="flex items-center flex-col grow pt-10">
      <div className="px-5">
        <h1 className="text-center">
          <span className="block text-2xl mb-2">Welcome to</span>
          <span className="block text-4xl font-bold">Scaffold-Stark 2</span>
        </h1>
        <ConnectedAddress />
        <p className="text-center text-lg">
          Edit your smart contract{" "}
          <code className="bg-underline italic text-base font-bold max-w-full break-words break-all inline-block">
            your_contract.cairo
          </code>{" "}
          in{" "}
          <code className="bg-underline italic text-base font-bold max-w-full break-words break-all inline-block">
            packages/snfoundry/contracts/src
          </code>
        </p>
      </div>

      <div className="bg-container grow w-full mt-16 px-8 py-12">
        <div className="flex justify-center items-center gap-12 flex-col sm:flex-row">
          <div className="flex flex-col bg-base-100 relative text-[12px] px-10 py-10 text-center items-center max-w-xs rounded-3xl border border-gradient">
            <div className="trapeze"></div>
            <Image
              src="/debug-icon.svg"
              alt="icon"
              width={26}
              height={30}
            ></Image>
            <p>
              Tinker with your smart contract using the{" "}
              <Link href="/debug" passHref className="link">
                Debug Contracts
              </Link>{" "}
              tab.
            </p>
          </div>
          <div className="flex flex-col bg-base-100 relative text-[12px] px-10 py-10 text-center items-center max-w-xs rounded-3xl border border-gradient">
            <div className="trapeze"></div>
            <Image
              src="/explorer-icon.svg"
              alt="icon"
              width={20}
              height={32}
            ></Image>
            <p>
              Play around with Multiwrite transactions using
              useScaffoldMultiWrite() hook
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;

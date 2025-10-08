import { num, hash } from "starknet";
import { createHash } from "crypto";

// Stark field modulus
const FIELD_PRIME =
  (BigInt(1) << BigInt(251)) +
  BigInt(17) * (BigInt(1) << BigInt(192)) +
  BigInt(1);

function poseidonHash(left: bigint, right: bigint): bigint {
  return BigInt(hash.computePoseidonHash(left, right));
}

function randomFelt(): bigint {
  let rand = BigInt(
    "0x" +
      crypto
        .getRandomValues(new Uint8Array(32))
        .reduce((str, b) => str + b.toString(16).padStart(2, "0"), "")
  );
  return rand % FIELD_PRIME;
}

export function generateNote(
  secretString: string,
  amount: number
): {
  nullifier: bigint;
  secret: bigint;
  commitment: bigint;
  note: string;
} {
  const nullifier = randomFelt();
  const secret =
    BigInt("0x" + createHash("sha256").update(secretString).digest("hex")) %
    FIELD_PRIME;

  const amountBigInt = BigInt(amount) % FIELD_PRIME;
  const halfCommitment = poseidonHash(nullifier, secret);
  const commitment = poseidonHash(halfCommitment, amountBigInt);

  const note = `bittmixx-1-${num.toHex(nullifier)}${num.toHex(secret)}${num.toHex(amountBigInt)}`;

  return {
    nullifier,
    secret,
    commitment,
    note,
  };
}

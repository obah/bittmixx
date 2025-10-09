import { num, hash } from "starknet";
import { createHash } from "crypto";

// Stark field modulus
const FIELD_PRIME =
  (BigInt(1) << BigInt(251)) +
  BigInt(17) * (BigInt(1) << BigInt(192)) +
  BigInt(1);

function poseidonHash(data: bigint[]): bigint {
  return BigInt(hash.computePoseidonHashOnElements(data));
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

export function getSecret(secretString: string): bigint {
  return (
    BigInt("0x" + createHash("sha256").update(secretString).digest("hex")) %
    FIELD_PRIME
  );
}

export function generateNote(
  secretString: string,
  amount: number
): {
  nullifier: bigint;
  nullifierHash: bigint;
  secret: bigint;
  commitment: bigint;
  note: string;
} {
  const nullifier = randomFelt();
  const secret = getSecret(secretString);

  const amountBigInt = BigInt(amount) % FIELD_PRIME;
  const commitment = poseidonHash([nullifier, secret, amountBigInt]);
  const nullifierHash = poseidonHash([nullifier]);

  const note = `bittmixx-1-${num.toHex(nullifier)}${num.toHex(secret)}${num.toHex(amountBigInt)}`;

  return {
    nullifier,
    nullifierHash,
    secret,
    commitment,
    note,
  };
}

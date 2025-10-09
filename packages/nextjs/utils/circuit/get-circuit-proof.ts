import { getHonkCallData, getZKHonkCallData } from "garaga";
import { readFile } from "fs/promises";

export enum HonkFlavor {
  KECCAK = 0,
  STARKNET = 1,
}

import { MongoClient } from "mongodb";
import { hash } from "starknet";

const poseidon = (left: bigint, right: bigint): bigint =>
  BigInt(hash.computePoseidonHash(left, right));

export const ZEROS: bigint[] = [
  BigInt("0x7554b99b848ff915c72eac90896aed27aaa91c261555e9e44be24657ee608a9"),
  BigInt("0x2ea7dc6626e3fad5b66fb926858b984127fa9dda7648312dd7064d062a24d22"),
  BigInt("0xa959be1b2b3ee8c311bed4cd2f229de7a63f0a2dc4aa4210f19323bb21406"),
  BigInt("0x7822ace87349b2adef2c6ca2596a7db832b400e67f1bf86188420681aef6ef6"),
  BigInt("0x3a0bb4aa8de0d028770db036be9457a3f6f26756fea057d5ef8fee17cbdc055"),
  BigInt("0x7ea750e861f38562c7f72e207f2231df9b7727d4b4f5192567b8a6e2b38f959"),
  BigInt("0x180fc05d21fa9295e6dae7fcfdef06a06884917f6e838a7241bd59b5f1ab5b4"),
  BigInt("0x4998e0fdb04e781f8d1026d15c20e87b0325aa3ecc4f366818508e8e9e6a5d8"),
  BigInt("0x19c5abdbe636b2596b44183913bde2c1c57a78495e805e6d983437f6c8aac72"),
  BigInt("0x5b69adc3e341b1f4e36e62753b77ddcbab86c2cb719533fd5f295c7a6fda770"),
  BigInt("0x3dd38373769ba36e495d2d0b85a5cde962dc33c7d9fcbf436df0cca73664b38"),
  BigInt("0x45fcaf8f71bc0c672acce73015841d8bb6b9f93c33154fe0dc6e7aed1562a17"),
  BigInt("0x784c51b780562ae9b467416107809bade1266fed37d6e1d958e586316d7ef87"),
  BigInt("0x6f232f90818dd4d4cc72c6cbe3d85970e213acf86ea6af8ab413b7059190d47"),
  BigInt("0x66440b67d8db85cacaec0e22c260f8e11aea2fade4783c7b1f0a652c86ef648"),
  BigInt("0x4e1a56b8c17ffc4c866c561bea7e826237e5668cf1bc1b52023c0f14f481c67"),
  BigInt("0x13d5fdff4c5576d404e59c0c532e25f099ec12a4c1976aa320a0aa1b598333"),
  BigInt("0x4ff2a3e592792df1cafbd211a6ba7e6b532f95181a5c0e2a198d7983f12248d"),
  BigInt("0x6e0e2711cd83623c42df0baa166d83c9d548093d76b4a5354393a63d2a2fadd"),
  BigInt("0x58ac1a7d24ddfcdd50ed28936ba67287f6c059d9e6a317ac65b9bd9ea6b5452"),
  BigInt("0x1a60143d89152defa494251d32fab178896d1c16c1e0ed3211383db28630474"),
  BigInt("0x1740c233ac95868df3fbdf344abf8cd7a578c30e66b39d0730424d4dd405ccf"),
  BigInt("0x5153f228e51beae5826e09039193dd5964cde17aa40e3455f1f656896da7273"),
  BigInt("0x523d18a65fa29180502ad030427c90799fff2d76d5d491906709efca91a6f5b"),
  BigInt("0x225a531d8095144e0ae99550462c96b5799846566fecfe5a968e317d077540d"),
  BigInt("0x6acf1972d3551f4e117446365aa9a0f8ba4386aecbf5ae4d6e6656bcde99dca"),
  BigInt("0x381be93bc040ec0af5555f61f75f0f740e1a0bd1ac38d6a150bd298f4020737"),
  BigInt("0xd8384c1015a4aa24c31faf29b0ce60a625e9f3c55a5ee61d123cb5fea2f9b5"),
  BigInt("0x1b1baca8e5accee543cee56eb979807b0e25c2b6b44bdfa302fe939ef7985ad"),
  BigInt("0x5d2db6c0f536b68d97c232027811785dbc12b03c65d65abb6e7d674188254ca"),
  BigInt("0x2947216af433dca22823668b485406b4a2480c1d009557703771ee517ca3f92"),
  BigInt("0x5dc143b94d93bfa68b3e23e92eb85f3128a65471753b51acf66e5387f2882d2"),
];

export class IncrementalMerkleTree {
  private readonly depth: number = 32;
  private zeros: bigint[];
  private client: MongoClient;
  private db: any;
  private nextIndexKey: string = "nextIndex";
  private nextIndex: bigint = 0n;

  private constructor() {
    const mongoUrl = process.env.MONGODB_URI;
    if (!mongoUrl) {
      throw new Error("MongoDB URI not found in environment variables");
    }

    this.zeros = [...ZEROS];
    const zeroRoot = poseidon(
      this.zeros[this.depth - 1],
      this.zeros[this.depth - 1]
    );
    this.zeros.push(zeroRoot);

    this.client = new MongoClient(mongoUrl);
  }

  public static async create(): Promise<IncrementalMerkleTree> {
    const tree = new IncrementalMerkleTree();
    await tree.initDB();
    return tree;
  }

  private async initDB() {
    await this.client.connect();
    this.db = this.client.db("merkleDB").collection("nodes");
    await this.db.createIndex({ key: 1 }, { unique: true });
    await this.loadNextIndex();
  }

  private async loadNextIndex() {
    const doc = await this.db.findOne({ key: this.nextIndexKey });
    this.nextIndex = doc ? BigInt(doc.value) : 0n;
  }

  private async saveNextIndex() {
    await this.db.updateOne(
      { key: this.nextIndexKey },
      { $set: { value: this.nextIndex.toString() } },
      { upsert: true }
    );
  }

  private async getNode(level: number, index: bigint): Promise<bigint> {
    if (level >= this.zeros.length) {
      throw new Error(`Invalid level: ${level}`);
    }
    const key = `${level}:${index.toString()}`;
    const doc = await this.db.findOne({ key });
    return doc ? BigInt(doc.value) : this.zeros[level];
  }

  private async setNode(level: number, index: bigint, value: bigint) {
    const key = `${level}:${index.toString()}`;
    if (value === this.zeros[level]) {
      await this.db.deleteOne({ key });
    } else {
      await this.db.updateOne(
        { key },
        { $set: { value: value.toString() } },
        { upsert: true }
      );
    }
  }

  public async update(index: bigint, leafHash: bigint) {
    let currentHash = leafHash;
    let currentIndex = index;

    for (let level = 0; level < this.depth; level++) {
      await this.setNode(level, currentIndex, currentHash);

      const isLeft = currentIndex % 2n === 0n;
      const siblingIndex = isLeft ? currentIndex + 1n : currentIndex - 1n;
      const siblingHash = await this.getNode(level, siblingIndex);

      currentHash = isLeft
        ? poseidon(currentHash, siblingHash)
        : poseidon(siblingHash, currentHash);
      currentIndex /= 2n;
    }

    await this.setNode(this.depth, 0n, currentHash);

    if (index >= this.nextIndex) {
      this.nextIndex = index + 1n;
      await this.saveNextIndex();
    }
  }

  public async append(leafHash: bigint) {
    const currentIndex = this.nextIndex;
    this.nextIndex++;
    await this.saveNextIndex();
    await this.update(currentIndex, leafHash);
  }

  public async getRoot(): Promise<bigint> {
    return this.getNode(this.depth, 0n);
  }

  public getNextIndex(): bigint {
    return this.nextIndex;
  }

  public async getProof(
    index: bigint
  ): Promise<{ siblings: bigint[]; isEvenSides: boolean[] }> {
    const siblings: bigint[] = [];
    const isEvenSides: boolean[] = [];
    let currentIndex = index;
    for (let level = 0; level < this.depth; level++) {
      const isEven = currentIndex % 2n === 0n;
      isEvenSides.push(isEven);
      const siblingIndex = isEven ? currentIndex + 1n : currentIndex - 1n;
      siblings.push(await this.getNode(level, siblingIndex));
      currentIndex /= 2n;
    }
    return { siblings, isEvenSides };
  }

  public async getLeaf(index: bigint): Promise<bigint> {
    return this.getNode(0, index);
  }

  public async close() {
    await this.client.close();
  }
}

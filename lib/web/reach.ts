import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

export type Reach = "loopback" | "private" | "public";

const rank: Record<Reach, number> = { loopback: 2, private: 1, public: 0 };

const LOOPBACK = new BlockList();
LOOPBACK.addSubnet("127.0.0.0", 8);
LOOPBACK.addAddress("::1", "ipv6");
const PRIVATE = new BlockList();
for (const [net, bits] of [
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
] as const)
  PRIVATE.addSubnet(net, bits);
PRIVATE.addSubnet("fc00::", 7, "ipv6");
PRIVATE.addSubnet("fe80::", 10, "ipv6");

const ofAddress = (address: string): Reach => {
  const family = isIP(address) === 6 ? "ipv6" : "ipv4";
  if (LOOPBACK.check(address, family)) return "loopback";
  return PRIVATE.check(address, family) ? "private" : "public";
};

const resolve = async (name: string): Promise<Reach> => {
  if (name === "localhost" || name.endsWith(".localhost")) return "loopback";
  if (isIP(name)) return ofAddress(name);
  if (name.endsWith(".local")) return "private";
  const found = await lookup(name, { all: true }).catch(() => []);
  return found.map(({ address }) => ofAddress(address)).reduce<Reach>((best, one) => (rank[one] > rank[best] ? one : best), "public");
};

export const Reach = { rank, resolve };

import type { MarkdownDocument } from "comark";

export type MdNode = MarkdownDocument["nodes"][number];

export type MdElement = Extract<MdNode, [string, ...unknown[]]>;

export const isElement = (node: MdNode): node is MdElement => typeof node !== "string" && typeof node[0] === "string";

export const soleChild = (node: MdElement): MdNode | undefined => (node.length === 3 ? node[2] : undefined);

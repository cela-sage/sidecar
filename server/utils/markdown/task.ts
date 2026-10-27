import { isElement, soleChild, type MdElement, type MdNode } from "./node.ts";

interface Card {
  node: MdNode;
  waiting: boolean;
}

const opensSection = (node: MdNode): boolean => isElement(node) && (node[0] === "h1" || node[0] === "h2");

const isTag = (node: MdNode | undefined, tag: string): node is MdElement =>
  !!node && isElement(node) && node[0] === tag;

const inlineOf = (kids: MdNode[]): MdNode[] => {
  const [head, ...rest] = kids;
  if (!isTag(head, "p")) return kids;
  const [, , ...inline] = head;
  return [...inline, ...rest];
};

const waitingText = (number: MdElement): string | undefined => {
  const span = soleChild(number);
  const text = isTag(span, "span") ? soleChild(span) : undefined;
  return typeof text === "string" ? text : undefined;
};

const cardOf = (item: MdNode): Card => {
  if (!isTag(item, "li")) return { node: item, waiting: false };
  const [, props, ...kids] = item;
  const [number, ...caption] = inlineOf(kids);
  if (!isTag(number, "strong")) return { node: item, waiting: false };
  const text = waitingText(number);
  if (typeof text !== "string")
    return { node: ["li", { ...props, class: "card" }, number, ...caption], waiting: false };
  const strong: MdNode = ["strong", number[1], `[${text}]`];
  return { node: ["li", { ...props, class: "card", "data-waiting": true }, strong, ...caption], waiting: true };
};

const chipOf = (count: number): string => `${count} number${count === 1 ? " needs" : "s need"} data`;

const shape = (nodes: MdNode[]): MdNode[] => {
  const title = nodes.find(isElement);
  const body = title?.[0] === "h1" ? nodes.filter((node) => node !== title) : nodes.slice();
  const heading = body.findIndex((node) => isTag(node, "h2") && node[1].id === "impact");
  if (heading < 0) return body;
  const next = body.findIndex((node, at) => at > heading && opensSection(node));
  const stop = next < 0 ? body.length : next;
  const at = body.findIndex((node, i) => i > heading && i < stop && isTag(node, "ul"));
  const list = body[at];
  const impact = body[heading];
  if (!isTag(list, "ul") || !isTag(impact, "h2")) return body;
  const [, props, ...items] = list;
  const cards = items.map(cardOf);
  body[at] = ["ul", { ...props, class: "impact" }, ...cards.map((card) => card.node)];
  const waiting = cards.filter((card) => card.waiting).length;
  if (!waiting) return body;
  const [tag, attrs, ...kids] = impact;
  body[heading] = [tag, { ...attrs, "data-needs-data": chipOf(waiting) }, ...kids];
  return body;
};

export const TaskPage = { shape };

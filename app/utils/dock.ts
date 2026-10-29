import type { DockTab } from "../../shared/types/dock.ts";

interface Placing {
  tabs: DockTab[];
  ids?: string[];
  tab: DockTab;
  to: number;
}

const arranged = (tabs: DockTab[], ids: string[] = []): DockTab[] => {
  const rank = (tab: DockTab): number => {
    const at = ids.indexOf(tab.id);
    return at < 0 ? ids.length : at;
  };
  return tabs.toSorted((a, b) => rank(a) - rank(b));
};

const placed = ({ tabs, ids = [], tab, to }: Placing): string[] => {
  const order = arranged(tabs, ids)
    .map((one) => one.id)
    .filter((id) => id !== tab.id);
  order.splice(to, 0, tab.id);
  return [...order, ...ids.filter((id) => !order.includes(id))];
};

export const DockOrder = { arranged, placed };

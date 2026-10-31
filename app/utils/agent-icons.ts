import type { Role } from "~~/shared/types/task";
import type { Mark } from "./org.ts";

const PACK = [
  7034, 19418, 10170, 29850, 11631, 19325, 13300, 9673, 28026, 5822, 23529, 9639, 16228, 27959, 15677, 19428, 4732,
  29876, 4687, 11411, 7890, 26937, 7881, 11956, 25843, 26187, 11866, 9470, 26045, 13778, 19772, 20331, 16178, 27094,
  24308, 18735, 19865, 6118, 19678, 29426, 6009, 20147, 26518, 27115, 31142, 26492, 4855, 6035, 4731, 5817, 15770,
  12070, 7023, 15780, 31134, 9631, 7126, 11422, 12018, 15513, 27593, 25753, 31028, 25751,
];
const INKS = 8;

export interface AgentCell {
  row: number;
  col: number;
}

export interface AgentCardInfo {
  name: string;
  role?: Role;
  project?: string;
  work: string;
  mark: Mark;
  step?: string;
  joined?: string;
}

const slotOf = (icon: number): number => ((Math.trunc(icon) % PACK.length) + PACK.length) % PACK.length;

const cellsOf = (icon: number): AgentCell[] => {
  const mask = PACK[slotOf(icon)] ?? 0;
  const cells: AgentCell[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if ((mask >>> (row * 3 + (col < 3 ? col : 4 - col))) & 1) cells.push({ row, col });
    }
  }
  return cells;
};

const inkOf = (icon: number): number => slotOf(icon) % INKS;

export const AgentIcons = { cellsOf, count: PACK.length, inkOf };

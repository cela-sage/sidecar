import type { SessionCommand } from "~~/shared/types/command";

export interface SlashMenuOptions {
  text: () => string;
  commands: () => SessionCommand[];
  complete: (row: SessionCommand) => void;
}

const STEPS: Partial<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 };

export const isPlainEnter = (event: KeyboardEvent): boolean =>
  event.key === "Enter" && !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey;

export const useSlashMenu = ({ text, commands, complete }: SlashMenuOptions) => {
  const cursor = ref(0);
  const isDismissed = ref(false);
  const typing = computed(() => (isDismissed.value ? undefined : SlashCommand.typing(text())));
  const rows = computed(() => (typing.value ? SlashCommand.matching(commands(), typing.value.query) : []));

  // Enter on a row already typed in full falls through, so the command can be sent.
  const onKey = (event: KeyboardEvent): boolean => {
    const step = STEPS[event.key];
    const row = rows.value[cursor.value];
    if (!rows.value.length) return false;
    if (step) cursor.value = Math.min(Math.max(cursor.value + step, 0), rows.value.length - 1);
    else if (row && (event.key === "Tab" || (isPlainEnter(event) && typing.value?.query !== row.name))) complete(row);
    else if (event.key === "Escape") isDismissed.value = true;
    else return false;
    event.preventDefault();
    return true;
  };

  watch(text, () => {
    isDismissed.value = false;
    cursor.value = 0;
  });

  return { cursor, onKey, rows };
};

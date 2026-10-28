export interface ConversationTarget {
  key: string;
  title: string;
  open?: () => void;
}

export interface ConversationMenuAsk {
  target: ConversationTarget;
  x: number;
  y: number;
}

export const $conversationMenu = defineStore(() => {
  const asked = shallowRef<ConversationMenuAsk>();

  const openFor = (event: MouseEvent, target: ConversationTarget): void => {
    asked.value = { target, x: event.clientX, y: event.clientY };
  };

  return { asked, openFor };
});

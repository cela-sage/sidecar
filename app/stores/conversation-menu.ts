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

const REVEAL_MS = 1600;

export const $conversationMenu = defineStore(() => {
  const tree = useOrgTree();
  const folds = useOrgFolds();
  const asked = shallowRef<ConversationMenuAsk>();
  const peeking = ref<string>();
  const revealing = ref<string>();
  const lit = computed(() => peeking.value ?? revealing.value);
  let timer: ReturnType<typeof setTimeout> | undefined;

  const openFor = (event: MouseEvent, target: ConversationTarget): void => {
    asked.value = { target, x: event.clientX, y: event.clientY };
  };

  const reveal = async (key: string): Promise<void> => {
    const group = Org.placeOf(tree.value, key)?.group;
    if (group && !folds.isOpen(group.project.key)) folds.toggle(group.project.key, false);
    clearTimeout(timer);
    revealing.value = key;
    await nextTick();
    const row = document.querySelector(`[data-conversation="${CSS.escape(key)}"]`);
    const isStill = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row?.scrollIntoView({ block: "nearest", behavior: isStill ? "auto" : "smooth" });
    timer = setTimeout(() => {
      if (revealing.value === key) revealing.value = undefined;
    }, REVEAL_MS);
  };

  return { asked, lit, openFor, peeking, reveal };
});

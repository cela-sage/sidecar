<script lang="ts" setup>
import { ArrowRight, ArrowUp, ChevronDown, Terminal, Trash2, X } from "@lucide/vue";
import { Titles } from "~~/shared/utils/titles";
import type { MascotState } from "~/components/claude/mascot.vue";
import type { DoorContext, DoorTarget } from "~/stores/door";
import type { OrgProject } from "~/utils/org";
import type { TaskMeta } from "~/utils/tasks";

type Tone = "live" | "waits" | "quiet";

const sc = useSidecar();
const chrome = useChrome();
const route = useRoute();
const task = $task();
const desk = $desk();
const door = $door();
const terminal = $terminal();
const field = useTemplateRef<{ focus: () => void }>("field");
const body = useTemplateRef<HTMLElement>("body");
const isPicking = ref(false);
const keepsContext = ref(true);

const CHIPS: Record<"conversation" | "task", string[]> = {
  conversation: ["What needs me?", "Route the inbox", "Open a task from this conversation"],
  task: ["Where does it stand?", "What is it waiting on?", "What did I decide on it?"],
};

const onConversation = computed(() => route.path.startsWith("/c/"));
const front = computed(() =>
  onConversation.value ? sc.sessions.value.find((one) => one.key === sc.sessionKey.value) : undefined,
);
const tasks = computed(() => Tasks.of(sc.catalogue.value));
const openTask = computed(() =>
  onConversation.value && chrome.view.current.value === "tasks"
    ? tasks.value.find((one) => one.slug === task.slug)
    : undefined,
);

const context = computed<DoorContext | undefined>(() => {
  if (openTask.value) {
    const { slug, title } = openTask.value;
    return { kind: "task", slug, title: title || deslug(slug) };
  }
  if (front.value) return { kind: "conversation", key: front.value.key, title: nameOf(front.value) };
  return undefined;
});
const contextKey = computed(() => (context.value?.kind === "task" ? context.value.slug : context.value?.key));
const sending = computed(() => (keepsContext.value ? context.value : undefined));

const inbox = computed(() => tasks.value.filter((one) => one.task.state === "unassigned"));
const tree = computed(() => Org.treeOf({ sessions: sc.sessions.value, tasks: tasks.value, projects: task.projects }));
const candidates = computed(() => [
  ...tree.value.assistants,
  ...tree.value.projects.flatMap((group) => [...group.leads, ...group.tasks.flatMap((one) => one.leads)]),
  ...tree.value.unplaced,
]);

const isEmpty = computed(() => !door.thread.length);
const showsInbox = computed(() => isEmpty.value && inbox.value.length > 0);
const isBusy = computed(() => door.assistant?.status === "busy");
const step = computed(() => (isBusy.value ? door.assistant?.detail || "Working" : undefined));
const mascot = computed<MascotState>(() => (isBusy.value ? "running" : "idle"));

const who = computed(() => {
  if (door.mode === "new") return { name: "Assistant", id: "new" };
  const title = door.assistant ? nameOf(door.assistant) : "";
  const parsed = Titles.parse(title);
  const after = parsed?.role ? parsed.words.slice(parsed.words.indexOf(parsed.role) + 1).join(" ") : "";
  return { name: "Assistant", id: after || door.key || "" };
});

const sub = computed<{ text: string; tone: Tone }>(() => {
  if (door.mode === "new") {
    const anyLive = door.assistants.some((one) => one.live);
    return anyLive
      ? { text: "a new assistant · starts with no history", tone: "quiet" }
      : { text: "No assistant is running · your message starts one", tone: "quiet" };
  }
  const title = door.assistant ? nameOf(door.assistant) : (door.key ?? "");
  if (isBusy.value) return { text: `${title} · working`, tone: "live" };
  if (door.assistant?.status === "waiting") return { text: `${title} · waits on you`, tone: "waits" };
  return { text: `${title} · acts for you`, tone: "quiet" };
});

const greeting = computed(() => {
  if (door.mode === "new") return "What should the new assistant work on?";
  if (sending.value?.kind === "task") return `Ask about ${sending.value.title}, or tell the assistant what to do.`;
  return "What should the assistant do?";
});

const chips = computed(() => CHIPS[sending.value?.kind === "task" ? "task" : "conversation"]);

const placeholder = computed(() =>
  door.thread.length
    ? "Ask the assistant something else, or @ someone…"
    : "Ask the assistant, or @ someone in the tree…",
);

const attachKey = computed(() => (door.mode === "assistant" ? door.key : undefined));

const routeOf = (meta: TaskMeta): OrgProject | undefined =>
  tree.value.projects.find((one) => one.project.key === desk.routes[meta.slug]);
const routable = computed(() => inbox.value.filter((one) => !!routeOf(one)));
const tintOf = (key = ""): string =>
  Tasks.tintOf(
    key,
    tree.value.projects.map((one) => one.project.key),
  );

const routeTask = (meta: TaskMeta): void => {
  const to = routeOf(meta);
  if (to) void desk.place(meta, to.project);
};

const routeAll = (): void => {
  for (const one of routable.value) routeTask(one);
};

const focus = (): void => void nextTick(() => field.value?.focus());

const open = (): void => {
  door.isOpen = true;
  void desk.load();
  focus();
};

const close = (): void => {
  door.isOpen = false;
  isPicking.value = false;
};

const pick = (next: DoorTarget): void => {
  door.target = next;
  isPicking.value = false;
  focus();
};

const fill = (chip = chips.value[0]): void => {
  if (chip) door.draft = chip;
  focus();
};

const send = (): void => {
  void door.send({ text: door.draft, ...(sending.value ? { context: sending.value } : {}) });
};

const onKey = (event: KeyboardEvent): void => {
  if (event.key !== "Enter" || !event.altKey || event.metaKey || event.ctrlKey || event.defaultPrevented) return;
  event.preventDefault();
  if (door.isOpen) focus();
  else open();
};

watch(contextKey, () => (keepsContext.value = true));
watch(
  () => [door.thread.length, door.thread.at(-1)?.step, door.thread.at(-1)?.answer, door.isOpen],
  () => void nextTick(() => body.value?.scrollTo({ top: body.value.scrollHeight })),
);

useEvents().on("task.changed", ({ data }) => door.hearChange(data.slug, data.state));
onMounted(() => {
  window.addEventListener("keydown", onKey);
  onScopeDispose(() => window.removeEventListener("keydown", onKey));
});
</script>

<template>
  <div class="door" data-region="ask-door">
    <UiSurface v-if="!door.isOpen" class="rest-island" pad="none" shape="pill" variant="glass-liquid">
      <button
        class="rest plain-button focusable"
        data-tip="Ask the assistant · {alt enter}"
        type="button"
        @click="open"
      >
        <span class="perch"><ClaudeMascot :size="30" :state="mascot" /></span>
        <span class="who">
          <span class="who-name">Assistant</span>
          <span v-if="step" class="who-line shimmer">{{ step }}</span>
          <span v-else class="who-line" data-quiet="true">acts for you</span>
        </span>
        <span v-if="inbox.length" class="count" data-tip="In the inbox, waiting to be routed"
          ><OrgMark mark="queued" />{{ inbox.length }}</span
        >
        <span class="ask">Ask</span>
      </button>
    </UiSurface>

    <UiSurface v-else class="panel" aria-label="Ask Claude" pad="none" role="dialog" shape="island" variant="raised">
      <header class="head">
        <span class="perch"><ClaudeMascot :size="30" :state="mascot" /></span>
        <button
          class="pick plain-button focusable"
          data-region="door-pick"
          data-tip="Pick who to ask, or start a new assistant"
          type="button"
          aria-haspopup="menu"
          :aria-expanded="isPicking"
          @click="isPicking = !isPicking"
        >
          <span class="pick-name">{{ who.name }}</span>
          <span class="pick-id mono-meta">{{ who.id }}</span>
          <UiIcon class="pick-chevron" :icon="ChevronDown" size="xs" />
        </button>
        <span class="spacer" />
        <UiIconButton
          v-if="!isEmpty"
          :icon="Trash2"
          aria-label="Clear this thread"
          data-tip="Clear this thread"
          size="xs"
          @click="door.clear()"
        />
        <UiIconButton
          v-if="attachKey"
          :icon="Terminal"
          aria-label="Attach in your terminal"
          data-tip="Attach in your terminal"
          size="xs"
          @click="terminal.attach(attachKey)"
        />
        <UiIconButton :icon="ChevronDown" aria-label="Collapse" data-tip="Collapse · {esc}" size="xs" @click="close" />
      </header>
      <p class="sub mono-meta">
        <span class="sub-dot dot" :data-tone="sub.tone" /><span class="sub-text">{{ sub.text }}</span>
      </p>
      <DoorMenu v-if="isPicking" class="menu" @pick="pick" />

      <div ref="body" class="body">
        <section v-if="showsInbox" class="inbox" aria-label="Inbox">
          <div class="inbox-head">
            <span class="inbox-title">Inbox</span>
            <span class="mono-meta">{{ inbox.length }} to route</span>
          </div>
          <div class="inbox-rows">
            <div v-for="one in inbox" :key="one.slug" class="inbox-row">
              <OrgMark mark="queued" />
              <button class="inbox-name plain-button focusable" type="button" @click="task.show({ slug: one.slug })">
                {{ one.title || deslug(one.slug) }}
              </button>
              <UiButton
                v-if="routeOf(one)"
                :data-tip="`Route to ${routeOf(one)?.project.name}'s Project Lead`"
                :icon="ArrowRight"
                size="xs"
                variant="outline"
                @click="routeTask(one)"
                ><span class="square" :data-tint="tintOf(routeOf(one)?.project.key)" />{{
                  routeOf(one)?.project.name
                }}</UiButton
              >
            </div>
          </div>
          <UiButton v-if="routable.length > 1" class="route-all" size="xs" variant="primary" @click="routeAll"
            >Route all {{ routable.length }}</UiButton
          >
        </section>
        <template v-else-if="isEmpty">
          <div class="greet">
            <span class="greeting">{{ greeting }}</span>
            <span class="about-it">
              It sees every project, routes tasks to their Project Lead, drafts, and does anything on the board you
              could. An @ points it at anyone in the tree.
            </span>
          </div>
          <div v-if="chips.length" class="chips" role="listbox" aria-label="Fill the prompt">
            <button
              v-for="chip in chips"
              :key="chip"
              class="chip plain-button focusable"
              data-tip="Fills the prompt · {tab}"
              role="option"
              type="button"
              @click="fill(chip)"
            >
              {{ chip }}
            </button>
          </div>
        </template>
        <DoorThread />
      </div>

      <footer class="foot">
        <span v-if="sending" class="context" data-tip="Goes with your message. Remove it to ask without it">
          <span class="about mono-meta">about</span>
          <span class="context-name">{{ sending.title }}</span>
          <button class="remove plain-button focusable" aria-label="Remove" type="button" @click="keepsContext = false">
            <UiIcon :icon="X" size="xs" />
          </button>
        </span>
        <div class="compose">
          <DoorField
            ref="field"
            v-model="door.draft"
            :candidates="candidates"
            :placeholder="placeholder"
            @escape="close"
            @fill="fill()"
            @send="send"
          />
          <button
            class="send plain-button focusable"
            aria-label="Send"
            data-tip="Send · {enter}"
            type="button"
            :disabled="!door.draft.trim()"
            @click="send"
          >
            <UiIcon :icon="ArrowUp" size="sm" />
          </button>
        </div>
      </footer>
    </UiSurface>
  </div>
</template>

<style scoped>
.door {
  @apply pointer-events-auto relative flex flex-none flex-col items-end;
}

.rest-island {
  @apply shadow-md;
}

.rest {
  @apply flex h-12 items-center gap-2 rounded-full border-0 bg-transparent py-0 pr-1.5 pl-1 text-left text-fg;
}

.perch {
  @apply flex h-9 w-9.5 flex-none items-center justify-center;
}

.who {
  @apply flex max-w-55 min-w-0 flex-col gap-px;
}

.who-name {
  @apply typo-body leading-tight font-extrabold;
}

.who-line {
  @apply truncate typo-caption leading-tight font-medium;
}

.who-line[data-quiet="true"] {
  @apply font-normal text-muted;
}

.count {
  @apply inline-flex h-5.5 flex-none items-center gap-1.25 rounded-full bg-sunken px-2 typo-mono-micro font-semibold text-fg;
}

.ask {
  @apply ml-1 inline-flex h-8.5 flex-none items-center rounded-full bg-fg px-3.5 typo-caption font-semibold text-canvas;
}

.panel {
  @apply relative flex max-h-[calc(100vh_-_var(--stage-top)_-_var(--gutter))] w-110 max-w-full flex-col overflow-hidden shadow-lg;
}

.head {
  @apply flex flex-none items-center gap-1.5 px-2 pt-2.5 pb-1;
}

.pick {
  @apply -ml-1 inline-flex h-7.5 min-w-0 items-center gap-1.75 rounded-full border-0 bg-transparent py-0 pr-2 pl-1.5 text-fg transition-colors duration-(--duration-fast) ease-out;
}

.pick[aria-expanded="true"] {
  @apply bg-sunken;
}

@media (hover: hover) and (pointer: fine) {
  .pick:hover {
    @apply bg-sunken;
  }
}

.pick-name {
  @apply flex-none typo-body-strong font-extrabold;
}

.pick-id {
  @apply min-w-0 truncate text-muted normal-case;
}

.pick-chevron {
  @apply flex-none text-muted;
}

.spacer {
  @apply flex-1;
}

.sub {
  @apply m-0 flex flex-none items-center gap-1.5 px-4 pb-2 text-subtle normal-case;
}

.sub-text {
  @apply min-w-0 truncate;
}

.sub-dot {
  @apply size-1.5 bg-subtle;
}

.sub-dot[data-tone="live"] {
  @apply breathe bg-primary;
}

.sub-dot[data-tone="waits"] {
  @apply bg-warning;
}

.menu {
  @apply absolute top-12 left-11 z-4;
}

.body {
  @apply flex min-h-0 flex-1 scrollbar-thin flex-col gap-3 overflow-y-auto px-4 pt-1 pb-4;
}

.greet {
  @apply flex flex-col gap-1.5 pt-1;
}

.greeting {
  @apply typo-subheading leading-snug font-bold text-pretty;
}

.about-it {
  @apply typo-caption leading-normal text-pretty text-muted;
}

.chips {
  @apply -mx-2 flex flex-col gap-px;
}

.chip {
  @apply flex h-7.5 items-center rounded-lg border-0 bg-transparent px-2 text-left typo-body text-muted transition-colors duration-(--duration-fast) ease-out;
}

@media (hover: hover) and (pointer: fine) {
  .chip:hover {
    @apply bg-sunken text-fg;
  }
}

.inbox {
  @apply flex flex-col gap-2;
}

.inbox-head {
  @apply flex items-center gap-2 text-muted;
}

.inbox-title {
  @apply typo-body font-bold text-fg;
}

.inbox-rows {
  @apply flex flex-col overflow-hidden rounded-xl border border-border;
}

.inbox-row {
  @apply box-border flex min-h-9.5 items-center gap-2 border-t border-t-border py-1.5 pr-2 pl-2.5 first:border-t-0;
}

.inbox-name {
  @apply min-w-0 flex-1 truncate border-0 bg-transparent p-0 text-left typo-caption text-fg;
}

.square {
  @apply size-1.75 flex-none rounded-xs bg-tint;
}

.route-all {
  @apply self-start;
}

.foot {
  @apply flex flex-none flex-col gap-1.5 border-t border-t-border py-2 pr-2 pl-3;
}

.context {
  @apply inline-flex h-6 max-w-full items-center gap-1.5 self-start rounded-full border border-border bg-sunken pr-1.5 pl-2.25 typo-caption font-semibold;
}

.about {
  @apply flex-none text-subtle normal-case;
}

.context-name {
  @apply min-w-0 truncate;
}

.remove {
  @apply inline-flex flex-none border-0 bg-transparent p-0 text-muted;
}

.compose {
  @apply flex items-end gap-2;
}

.send {
  @apply inline-flex size-7.5 flex-none items-center justify-center rounded-full border-0 bg-fg text-canvas transition-opacity duration-(--duration-fast) ease-out;
}

.send:disabled {
  @apply opacity-35;
}
</style>

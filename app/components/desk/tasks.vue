<script lang="ts" setup>
import { useShortcuts } from "@cela/design";
import { useIntervalFn } from "@vueuse/core";
import { Titles } from "~~/shared/utils/titles";
import type { TaskMeta } from "~/utils/tasks";

const emit = defineEmits<{ back: [] }>();

const READ_MS = 5000;
const STAND_MS = 60_000;

const sc = useSidecar();
const chrome = useChrome();
const task = $task();
const desk = $desk();
const events = useEvents();
const cursor = ref<string>();

const tasks = computed(() => Tasks.of(sc.catalogue.value).sort(Tasks.order));
const inbox = computed(() => tasks.value.filter((one) => one.task.state === "unassigned"));
const groups = computed(() => Tasks.groupsOf(tasks.value, task.projects));
const asked = computed(() => new Set(desk.asks.map((ask) => ask.slug)));
const own = computed(
  () =>
    tasks.value.filter((one) => !["done", "unassigned"].includes(one.task.state) && !asked.value.has(one.slug)).length,
);

const heading = computed(() => {
  const n = asked.value.size;
  return n ? `${plural(n, "task")} ${n === 1 ? "needs" : "need"} you` : "Nothing needs you";
});

const hint = computed(() => {
  const n = own.value;
  const runs = `${n === 1 ? "runs" : "run"} on ${n === 1 ? "its" : "their"} own`;
  if (asked.value.size) return n ? `The other ${n} ${runs}.` : "";
  const across = `across ${plural(task.projects.length, "project")}`;
  const lead = n ? `${plural(n, "task")} ${runs} ${across}.` : `Nothing runs ${across} right now.`;
  return `${lead} What lands in the inbox waits for a project.`;
});

const asOf = computed(() =>
  desk.standing ? new Date(desk.standing.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
);

const order = computed(() => [
  ...new Set([
    ...desk.asks.map((ask) => ask.slug),
    ...groups.value.flatMap((group) => (task.isGroupOpen(group) ? group.tasks.map((one) => one.slug) : [])),
    ...inbox.value.map((one) => one.slug),
  ]),
]);

const lineOf = (meta: TaskMeta): string => {
  const ask = desk.asks.find((one) => one.slug === meta.slug);
  if (ask) return ask.question;
  const lead = Tasks.railOf(sc.sessions.value, meta.slug).find((one) => Titles.parse(nameOf(one))?.role === "TL");
  return meta.task.state === "done" ? "" : (lead?.detail ?? "");
};

const projectOf = (key = ""): string | undefined => task.projects.find((one) => one.key === key)?.name;

const reveal = (): void =>
  document.querySelector("[data-region^='desk-'][data-active='true']")?.scrollIntoView({ block: "nearest" });

const move = (step: number): void => {
  const list = order.value;
  if (!list.length) return;
  const at = cursor.value ? list.indexOf(cursor.value) : step > 0 ? -1 : list.length;
  cursor.value = list[Math.min(Math.max(at + step, 0), list.length - 1)];
  void nextTick(reveal);
};

const openPicked = (): boolean => {
  if (!cursor.value || document.activeElement?.closest("button, a[href], input")) return false;
  void navigateTo(`/tasks/${cursor.value}`);
  return true;
};

const heard = (): void => {
  void desk.load();
  void task.readTasks();
};

void task.loadProjects();
void desk.load();
void desk.stand();
events.on("task.changed", heard);
events.on("task.escalated", heard);
events.on("task.decided", heard);
useIntervalFn(heard, READ_MS);
useIntervalFn(desk.stand, STAND_MS);

useShortcuts(
  {
    ArrowDown: { repeat: true, run: () => move(1) },
    ArrowUp: { repeat: true, run: () => move(-1) },
    Enter: openPicked,
    N: () => {
      desk.isNaming = true;
    },
    "Mod+Z": () => desk.undoLast(),
    Escape: () => {
      if (!chrome.dismiss()) emit("back");
    },
  },
  { when: () => !sc.failure.value },
);
</script>

<template>
  <main class="stage" data-region="desk-tasks">
    <div class="columns">
      <div class="main">
        <div class="lead">
          <ListeningTag />
          <h1 class="title">{{ heading }}</h1>
          <p v-if="hint" class="hint">{{ hint }}</p>
        </div>

        <section v-if="desk.asks.length" class="needs" aria-label="Needs you">
          <span class="label mono-meta">Needs you</span>
          <DeskNeeds
            v-for="ask in desk.asks"
            :key="ask.thread"
            :active="cursor"
            :ask="ask"
            :project="projectOf(ask.project)"
          />
        </section>

        <section class="projects" aria-label="Projects" data-tip="Open · {enter}, {up down} moves">
          <div class="projects-head">
            <span class="label mono-meta">Where each project stands</span>
            <span class="spacer" />
            <span v-if="asOf" class="label mono-meta">from the assistant · {{ asOf }}</span>
          </div>
          <div class="groups" @mousemove="cursor = undefined">
            <DeskProject
              v-for="group in groups"
              :key="group.key"
              :active="cursor"
              :group="group"
              :line-of="lineOf"
              :sentence="desk.standing?.projects[group.key]"
            />
          </div>
        </section>
      </div>

      <DeskInbox :active="cursor" :tasks="inbox" />
    </div>
  </main>
</template>

<style scoped>
.stage {
  @apply absolute inset-0 grid overflow-y-auto;
}

.columns {
  @apply m-auto grid w-260 max-w-[calc(100%_-_2_*_var(--gutter))] grid-cols-[minmax(0,600px)_minmax(0,1fr)] items-start gap-x-14 py-(--stage-top);
}

.main {
  @apply flex min-w-0 flex-col gap-6;
}

.lead {
  @apply flex flex-col gap-2.5;
}

.title {
  @apply m-0 typo-heading-xl font-extrabold text-fg;
}

.hint {
  @apply m-0 typo-body-md text-pretty text-muted;
}

.needs,
.projects {
  @apply flex flex-col gap-2.5;
}

.projects {
  @apply gap-1.5;
}

.projects-head {
  @apply flex items-center gap-2;
}

.label {
  @apply text-subtle;
}

.spacer {
  @apply flex-1;
}

.groups {
  @apply flex flex-col gap-1;
}
</style>

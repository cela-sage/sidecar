<script lang="ts" setup>
import type { TaskLook } from "~/utils/tasks";
import type { TaskStory } from "~/utils/timeline";

const { story } = defineProps<{ story: TaskStory }>();

interface Note {
  look: TaskLook;
  title: string;
  text: string;
}

const day = (at: string): string => {
  const when = new Date(at);
  return when.toDateString() === new Date().toDateString()
    ? when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : when.toLocaleDateString([], { day: "numeric", month: "short" });
};

const note = computed<Note | undefined>(() => {
  const { archived, finished, resumed, waiting } = story;
  if (waiting)
    return {
      look: "waiting",
      title: `Waiting${waiting.on ? ` on ${waiting.on}` : ""} since ${day(waiting.since)}`,
      text: `Nothing for you to do, like WAIT on your board.${waiting.reason ? ` It waits until ${waiting.reason}.` : ""} The Individual Contributor picks it back up when they do.`,
    };
  if (resumed)
    return {
      look: "running",
      title: `${resumed.on ?? "They"} came back at ${day(resumed.at)}`,
      text: `The Individual Contributor picked the task back up on its own after ${resumed.waited}.`,
    };
  if (finished)
    return {
      look: "needs",
      title: `Finished at ${day(finished.at)}`,
      text: "The Individual Contributor finished its work, and only you archive it. Check it, kill its agents, then archive it from the strip or the row's menu.",
    };
  if (archived)
    return {
      look: "archived",
      title: `Archived at ${day(archived.at)}`,
      text:
        archived.who === "YOU"
          ? "You checked it and archived it."
          : "An Individual Contributor closed it, before archiving became your mark.",
    };
  return undefined;
});
</script>

<template>
  <div v-if="note" class="note" role="status" data-region="task-note" :data-look="note.look">
    <TaskDot class="note-dot" :look="note.look" />
    <span class="lines">
      <span class="title">{{ note.title }}</span>
      <span class="text">{{ note.text }}</span>
    </span>
  </div>
</template>

<style scoped>
.note {
  @apply flex items-start gap-2.5 rounded-xl border border-border bg-sunken px-3.5 py-3;
}

.note-dot {
  @apply mt-1.25 size-2 flex-none;
}

.lines {
  @apply flex min-w-0 flex-1 flex-col gap-0.75;
}

.title {
  @apply typo-body font-bold;
}

.text {
  @apply typo-caption leading-normal text-pretty text-muted;
}
</style>

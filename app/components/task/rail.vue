<script lang="ts" setup>
import type { LiveSession } from "~~/shared/types/session";
import { Titles } from "~~/shared/utils/titles";
import type { AgentState, TaskLook } from "~/utils/tasks";

const { sessions } = defineProps<{ sessions: LiveSession[] }>();

const LOOK: Record<AgentState, TaskLook> = { working: "running", "needs input": "needs", completed: "done" };

const rows = computed(() =>
  sessions.map((session) => {
    const name = nameOf(session);
    const title = Titles.parse(name);
    const state = Tasks.agentStateOf(session);
    return {
      key: session.key,
      token: title?.token,
      rest: title?.rest ?? name,
      isLead: title?.role === "TL",
      state,
      look: LOOK[state],
      agents: session.agents ?? [],
      detail: session.detail,
      at: turnAt(session.lastActive),
    };
  }),
);

function turnAt(ms?: number): string {
  if (!ms) return "";
  const at = new Date(ms);
  const today = at.toDateString() === new Date().toDateString();
  const time = at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return today ? time : `${at.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
}
</script>

<template>
  <aside class="rail" aria-label="Conversations on this task" data-region="task-rail">
    <header class="head">
      <span class="title">Conversations</span>
      <span class="meta mono-meta">{{ rows.length }} · claude agents</span>
    </header>
    <div class="rows">
      <p v-if="!rows.length" class="empty">
        No conversation runs this task yet. One started with this task's slug in its title lists here.
      </p>
      <div
        v-for="row in rows"
        :key="row.key"
        class="row"
        data-cmt="conversation"
        :data-cmt-label="row.rest"
        :data-cmt-tell="`the ${row.rest} conversation on this task`"
        :data-look="row.look"
      >
        <div class="line">
          <TaskDot class="row-dot" :look="row.look" />
          <div class="what">
            <span class="name"
              ><span v-if="row.token" class="token">[{{ row.token }}]</span> {{ row.rest }}</span
            >
            <span class="facts">
              <span class="state mono-meta">{{ row.state }}</span>
              <span v-if="!row.isLead && row.detail" class="note">{{ row.detail }}</span>
            </span>
          </div>
        </div>
        <div v-if="row.isLead && row.agents.length" class="agents">
          <span class="label mono-meta">subagents</span>
          <span v-for="agent in row.agents" :key="agent.name" class="chip">{{ agent.name }}</span>
        </div>
        <div v-if="row.isLead && row.detail" class="turn">
          <span class="label mono-meta">last turn{{ row.at ? ` · ${row.at}` : "" }}</span>
          <span class="said">{{ row.detail }}</span>
        </div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.rail {
  @apply flex min-h-0 flex-col overflow-hidden border-l border-l-border;
}

.head {
  @apply flex flex-none items-center gap-2 px-3.5 pt-3 pb-2;
}

.title {
  @apply typo-body font-bold;
}

.meta {
  @apply text-muted normal-case;
}

.rows {
  @apply flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-2.5 pb-(--float-clear);
}

.empty {
  @apply m-0 px-1 typo-caption leading-normal text-pretty text-muted;
}

.row {
  @apply flex flex-none flex-col gap-2 rounded-xl border border-border py-2.5 pr-2.5 pl-3;
}

.row[data-look="needs"] {
  @apply border-error;
}

.line {
  @apply flex items-start gap-2.25;
}

.row-dot {
  @apply mt-1.25;
}

.what {
  @apply flex min-w-0 flex-1 flex-col gap-0.75;
}

.name {
  @apply typo-body-strong leading-snug wrap-break-word;
}

.token {
  @apply text-muted;
}

.facts {
  @apply flex flex-wrap items-center gap-1.5;
}

.state {
  @apply text-muted;
}

.row[data-look="running"] .state {
  @apply text-primary;
}

.row[data-look="needs"] .state {
  @apply text-error;
}

.note {
  @apply typo-caption text-muted;
}

.agents,
.turn {
  @apply flex flex-wrap items-center gap-1.25 pl-4;
}

.turn {
  @apply flex-col items-start gap-0.75;
}

.label {
  @apply text-subtle;
}

.chip {
  @apply rounded-full border border-border bg-raised px-2 py-0.5 typo-meta font-semibold text-fg;
}

.said {
  @apply typo-body leading-normal text-pretty text-muted;
}

.row[data-look="needs"] .said {
  @apply text-fg;
}
</style>

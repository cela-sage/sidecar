<script lang="ts" setup>
import type { ReviewThread } from "~~/shared/types/artifact";
import type { LiveSession } from "~~/shared/types/session";
import { Titles } from "~~/shared/utils/titles";
import type { AgentState, TaskLook } from "~/utils/tasks";

const {
  asking = [],
  conversation,
  sessions,
  slug,
} = defineProps<{ asking?: ReviewThread[]; conversation?: string; sessions: LiveSession[]; slug: string }>();

const LOOK: Record<AgentState, TaskLook> = { working: "running", "needs input": "needs", completed: "done" };

const terminal = $terminal();
const picked = ref<string>();

// The lead that escalated has ended its turn, so claude agents calls it completed while it waits on Marco.
const rows = computed(() =>
  sessions.map((session) => {
    const name = nameOf(session);
    const title = Titles.parse(name);
    const asked = asking.find((thread) => thread.ask?.from === name);
    const state: AgentState = asked ? "needs input" : Tasks.agentStateOf(session);
    const at = turnAt(asked ? Date.parse(asked.at) : session.lastActive);
    const isHeld = terminal.holds(session.key);
    return {
      key: session.key,
      name,
      token: title?.token,
      rest: title?.rest ?? name,
      isLead: title?.role === "TL",
      isHeld,
      state: isHeld ? `${state} · in your terminal` : state,
      look: LOOK[state],
      agents: session.agents ?? [],
      detail: asked ? `${asked.body} It's on the task, waiting on you.` : session.detail,
      when: `${asked ? "asked" : "last turn"}${at ? ` · ${at}` : ""}`,
    };
  }),
);

const selected = computed(() => {
  const leads = rows.value.filter((row) => row.isLead);
  return (leads.find((row) => row.key === picked.value) ?? leads.find((row) => row.key === conversation) ?? leads[0])
    ?.key;
});

const pick = (row: { key: string; isLead: boolean }): void => {
  if (row.isLead) picked.value = row.key;
};

const turnAt = (ms?: number): string => {
  if (!ms) return "";
  const at = new Date(ms);
  const today = at.toDateString() === new Date().toDateString();
  const time = at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return today ? time : `${at.toLocaleDateString([], { day: "numeric", month: "short" })} ${time}`;
};
</script>

<template>
  <aside class="rail" aria-label="Conversations on this task" data-region="task-rail">
    <header class="head">
      <span class="title">Conversations</span>
      <span class="meta mono-meta">{{ rows.length }}</span>
      <span
        class="foot-dot"
        :data-following="terminal.state.following"
        :data-tip="
          terminal.state.following
            ? 'sidecar terminal is following, so Attach detaches the current conversation and opens the one you pick'
            : 'sidecar terminal isn\'t running, so Attach copies the claude attach line instead'
        "
      />
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
        :data-held="row.isHeld"
        :data-lead="row.isLead"
        :data-look="row.look"
        :data-selected="row.key === selected"
        @click="pick(row)"
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
          <TaskAttach :conversation="row.key" />
        </div>
        <div v-if="row.isLead && row.agents.length" class="agents">
          <span class="label mono-meta">subagents</span>
          <span v-for="agent in row.agents" :key="agent.name" class="chip">{{ agent.name }}</span>
        </div>
        <div v-if="row.isLead && row.detail" class="turn">
          <span class="label mono-meta">{{ row.when }}</span>
          <span class="said">{{ row.detail }}</span>
        </div>
        <TaskMessage v-if="row.key === selected" :conversation="row.key" :name="row.name" :slug="slug" />
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
  @apply flex flex-none flex-col gap-1.5 rounded-xl border border-border py-2 pr-2 pl-2.5;
}

.foot-dot {
  @apply ml-auto dot size-1.5 flex-none bg-subtle;
}

.foot-dot[data-following="true"] {
  @apply breathe bg-primary;
}

.row[data-lead="true"] {
  @apply cursor-pointer;
}

.row[data-held="true"] {
  @apply bg-sunken;
}

.row[data-selected="true"] {
  @apply border-border-strong;
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
  @apply line-clamp-3 typo-caption leading-normal text-pretty text-muted;
}

.row[data-look="needs"] .said {
  @apply text-fg;
}
</style>

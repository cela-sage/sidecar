<script lang="ts" setup>
import type { Role } from "~~/shared/types/task";
import { MARK_LABEL } from "~/components/org/mark.vue";
import type { AgentCardInfo } from "~/utils/agent-icons";

const ROLE_NAME: Record<Role, string> = {
  EA: "Assistant",
  DL: "Domain Lead",
  SL: "Solution Lead",
  IC: "Individual Contributor",
};

const { card, icon } = defineProps<{ card: AgentCardInfo; icon: number }>();
const emit = defineEmits<{ open: [] }>();

const line = computed(() =>
  [card.role ? ROLE_NAME[card.role] : "Conversation", card.project].filter(Boolean).join(" · "),
);
const status = computed(() => (card.mark === "working" && card.step ? card.step : MARK_LABEL[card.mark]));
</script>

<template>
  <div class="card" role="dialog" :aria-label="card.name">
    <div class="who">
      <OrgAgentIcon :icon="icon" :is-killed="card.mark === 'killed'" :size="44" />
      <div class="names">
        <span class="title">
          <span class="name">{{ card.name }}</span>
          <span v-if="card.role" class="role">{{ card.role }}</span>
        </span>
        <span class="line">{{ line }}</span>
      </div>
    </div>
    <dl class="facts">
      <div class="fact">
        <dt class="mono-meta">Works on</dt>
        <dd class="work">{{ card.work }}</dd>
      </div>
      <div class="fact">
        <dt class="mono-meta">Status</dt>
        <dd class="status">
          <OrgMark :mark="card.mark" />
          <span class="state" :data-working="card.mark === 'working'">{{ status }}</span>
        </dd>
      </div>
      <div v-if="card.joined" class="fact">
        <dt class="mono-meta">Joined</dt>
        <dd class="joined">{{ card.joined }}</dd>
      </div>
    </dl>
    <UiButton
      class="open"
      data-tip="Its conversation, with Artifacts, Review, Files and History"
      size="xs"
      variant="secondary"
      @click="emit('open')"
      >Open conversation</UiButton
    >
  </div>
</template>

<style scoped>
.card {
  @apply flex w-72 flex-col gap-3 rounded-xl border border-border bg-raised p-3.5 text-left shadow-lg;
}

.who {
  @apply flex items-center gap-3;
}

.names {
  @apply flex min-w-0 flex-1 flex-col gap-0.75;
}

.title {
  @apply flex items-center gap-1.75;
}

.name {
  @apply typo-body-strong font-extrabold text-fg;
}

.role {
  @apply flex-none rounded-sm bg-sunken px-1.25 py-px typo-mono-pico font-semibold tracking-wide text-muted;
}

.line {
  @apply truncate typo-caption text-muted;
}

.facts {
  @apply m-0 flex flex-col gap-1.75;
}

.fact {
  @apply flex items-baseline gap-2.5;
}

.fact dt {
  @apply w-15.5 flex-none text-subtle;
}

.fact dd {
  @apply m-0 min-w-0 flex-1;
}

.work {
  @apply typo-caption-strong text-fg;
}

.status {
  @apply flex items-center gap-1.75;
}

.state {
  @apply min-w-0 truncate typo-caption-medium text-fg;
}

.state[data-working="true"] {
  @apply shimmer;
}

.joined {
  @apply typo-caption text-muted;
}

.open {
  @apply self-start;
}
</style>

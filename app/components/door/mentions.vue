<script lang="ts" setup>
import { Titles } from "~~/shared/utils/titles";
import type { OrgConversation } from "~/utils/org";

const { cursor, rows } = defineProps<{ cursor: number; rows: OrgConversation[] }>();
const emit = defineEmits<{ pick: [row: OrgConversation]; point: [at: number] }>();

const tokenOf = (row?: OrgConversation): string => (row ? (Titles.parse(row.title)?.token ?? "") : "");
const startsGroup = (at: number): boolean => at === 0 || tokenOf(rows[at - 1]) !== tokenOf(rows[at]);
</script>

<template>
  <div class="mentions" role="listbox" aria-label="Pick who to message" data-region="door-mentions">
    <p v-if="!rows.length" class="none">Nobody in the tree matches that.</p>
    <template v-for="(row, at) in rows" :key="row.key">
      <span v-if="startsGroup(at)" class="section mono-meta">{{ tokenOf(row) }}</span>
      <OrgRow
        :id="row.key"
        :is-selected="at === cursor"
        :mark="row.mark"
        :name="row.title"
        @mousemove="emit('point', at)"
        @mousedown.prevent
        @open="emit('pick', row)"
      />
    </template>
  </div>
</template>

<style scoped>
.mentions {
  @apply flex max-h-50 flex-col gap-px overflow-y-auto rounded-box bg-raised p-1.5 shadow-lg ring-1 ring-border-strong;
}

.section {
  @apply flex h-6 flex-none items-center px-1.5 text-subtle normal-case;
}

.none {
  @apply m-0 p-2 typo-caption text-muted;
}
</style>

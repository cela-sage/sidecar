<script lang="ts" setup>
import type { DoorExchange, DoorReceipt } from "~/stores/door";

const door = $door();

const canUndo = (receipt: DoorReceipt): boolean =>
  !receipt.isUndone && receipt.was === "unassigned" && receipt.now !== "unassigned";

const isLast = (one: DoorExchange): boolean => door.thread.at(-1)?.id === one.id;
</script>

<template>
  <div class="thread" data-region="door-thread">
    <div v-for="one in door.thread" :key="one.id" class="exchange">
      <p class="you">{{ one.text }}</p>

      <div v-if="one.receipts.length" class="receipts">
        <div v-for="receipt in one.receipts" :key="`${receipt.slug}-${receipt.now}`" class="receipt">
          <OrgMark :mark="receipt.isUndone ? 'queued' : 'completed'" />
          <span class="what">
            <span class="title">{{ receipt.title }}</span>
            <span class="note mono-meta">{{
              receipt.isUndone ? "back in the inbox" : `${receipt.was} to ${receipt.now}`
            }}</span>
          </span>
          <button
            v-if="canUndo(receipt)"
            class="link plain-button focusable"
            data-tip="Put it back in the inbox"
            type="button"
            @click="door.undo(receipt)"
          >
            Undo
          </button>
        </div>
      </div>

      <p v-if="one.step === 'working'" class="busy shimmer">{{ one.doing || "Reading it" }}</p>

      <div v-if="one.step === 'waiting'" class="asks">
        <span class="asks-eyebrow mono-meta"><span class="asks-dot dot" />Waiting on your answer</span>
        <Prose v-if="one.answer" :value="one.answer" />
        <span class="asks-hint">Answer below.</span>
      </div>
      <Prose v-else-if="one.step === 'answered' && one.answer" class="says" :value="one.answer" />
      <p v-if="one.step === 'failed'" class="failure" role="alert">{{ one.failure }}</p>

      <p v-if="isLast(one) && one.step === 'answered' && door.assistant" class="foot mono-meta">
        kept in {{ nameOf(door.assistant) }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.thread {
  @apply flex flex-col gap-4;
}

.exchange {
  @apply flex flex-col gap-3;
}

.you {
  @apply m-0 max-w-11/12 self-end rounded-box rounded-br-sm bg-sunken px-3 py-2 typo-body leading-normal text-pretty whitespace-pre-wrap;
}

.receipts {
  @apply flex flex-col overflow-hidden rounded-xl border border-border;
}

.receipt {
  @apply box-border flex min-h-9.5 items-center gap-2 border-t border-t-border py-1.5 pr-2 pl-2.5 first:border-t-0;
}

.what {
  @apply flex min-w-0 flex-1 flex-col gap-px;
}

.title {
  @apply truncate typo-caption;
}

.note {
  @apply truncate text-muted normal-case;
}

.link {
  @apply flex-none border-0 bg-transparent px-1 typo-caption font-semibold text-muted underline underline-offset-3;
}

.busy {
  @apply m-0 typo-body;
}

.says {
  @apply typo-body;
}

.asks {
  @apply flex flex-col gap-2 rounded-xl bg-sunken p-3;
}

.asks-eyebrow {
  @apply flex items-center gap-1.5 font-semibold text-warning;
}

.asks-dot {
  @apply size-1.75 bg-warning;
}

.asks-hint {
  @apply typo-caption text-muted;
}

.failure {
  @apply m-0 rounded-field border border-error bg-error-soft px-3 py-2 typo-caption text-error;
}

.foot {
  @apply m-0 -mt-1 truncate text-subtle normal-case;
}
</style>

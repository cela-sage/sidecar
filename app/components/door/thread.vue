<script lang="ts" setup>
import type { DoorExchange } from "~/stores/door";

const { step } = defineProps<{ step?: string }>();
const door = $door();
const questions = $questions();

const isLast = (one: DoorExchange): boolean => door.thread.at(-1)?.id === one.id;
const lines = computed(() => DoorTurns.linesOf(door.thread));
const ask = computed(() => questions.openIn(door.key));
</script>

<template>
  <div class="thread" data-region="door-thread">
    <div v-for="one in door.thread" :key="one.id" class="exchange">
      <p class="you">{{ one.text }}</p>

      <div v-if="one.receipts.length" class="receipts">
        <DoorReceipt v-for="receipt in one.receipts" :key="`${receipt.slug}-${receipt.now}`" :receipt="receipt" />
      </div>

      <p v-if="one.isWaking" class="busy" role="status">
        <OrgMark mark="working" />
        <span class="busy-line shimmer">Waking {{ door.assistant?.name ?? "the assistant" }}</span>
      </p>
      <QuestionAsk v-else-if="ask && lines.get(one.id) === 'live'" :ask="ask" />
      <p v-else-if="lines.get(one.id) === 'live'" class="busy" role="status">
        <OrgMark mark="working" />
        <span class="busy-line shimmer">{{ step || "Reading your message" }}</span>
      </p>
      <p v-else-if="lines.get(one.id) === 'queued'" class="busy" role="status">
        <OrgMark mark="queued" />
        <span class="busy-line shimmer">Queued until it finishes what it is on</span>
      </p>

      <Prose v-if="one.step === 'answered' && one.answer" class="says" :value="one.answer" />
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

.busy {
  @apply m-0 flex min-w-0 items-center gap-2 typo-body;
}

.busy-line {
  @apply min-w-0 truncate;
}

.says {
  @apply typo-body;
}

.failure {
  @apply m-0 rounded-field border border-error bg-error-soft px-3 py-2 typo-caption text-error;
}

.foot {
  @apply m-0 -mt-1 truncate text-subtle normal-case;
}
</style>

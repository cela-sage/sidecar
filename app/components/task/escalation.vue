<script lang="ts" setup>
import { ArrowUp, Check, History } from "@lucide/vue";
import { useNow } from "@vueuse/core";
import type { ReviewThread } from "~~/shared/types/artifact";
import { Titles } from "~~/shared/utils/titles";
import type { Answer } from "~/stores/task";

const { thread, isSending = false } = defineProps<{ thread: ReviewThread; isSending?: boolean }>();
const emit = defineEmits<{ decide: [answer: Answer] }>();

const now = useNow({ interval: 30_000 });
const words = ref("");

const ask = computed(() => thread.ask);
const decision = computed(() => ask.value?.decision);
const isAsking = computed(() => !decision.value);
const byYou = computed(() => decision.value?.who === "YOU");
const what = computed(() => (ask.value?.kind === "hire" ? "Hire" : "Escalation"));
const pick = computed(() => ask.value?.verdict?.pick);

const clock = (at?: string): string =>
  at ? new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

const speaker = (title?: string): { badge: string; token?: string; rest: string } => {
  const parsed = title ? Titles.parse(title) : undefined;
  return {
    badge: parsed?.role ?? "IC",
    token: parsed?.token,
    rest: parsed?.rest ?? title ?? "The Individual Contributor",
  };
};

const asker = computed(() => speaker(ask.value?.from));
const judge = computed(() => speaker(ask.value?.verdict?.from ?? "[DL] the Domain Lead"));
const asked = computed(() =>
  isAsking.value
    ? `needs input · ${relativeAge(thread.at, now.value.getTime())}`
    : `asked at ${clock(thread.at)}`,
);
const later = computed(() => (decision.value ? Timeline.span(thread.at, decision.value.at) : ""));

function send(answer: Answer): void {
  if (!isSending) emit("decide", answer);
}

function sendWords(): void {
  const text = words.value.trim();
  if (text) send({ text });
}
</script>

<template>
  <section
    v-if="ask"
    class="card"
    aria-label="Escalation from the Individual Contributor"
    data-region="task-escalation"
    :data-asking="isAsking"
  >
    <header class="head">
      <span v-if="isAsking" class="needs-dot dot" />
      <UiIcon v-else class="check" :icon="Check" size="xs" />
      <span class="what">{{ what }}</span>
      <span class="meta mono-meta">{{ clock(thread.at) }} · notified you</span>
      <span class="spacer" />
      <span v-if="isAsking" class="needs">Needs you</span>
      <span v-else class="settled"
        ><UiIcon :icon="Check" size="xs" />{{ byYou ? "Settled by you" : "Settled by the Domain Lead" }} ·
        {{ clock(decision?.at) }}</span
      >
    </header>

    <div class="body">
      <div v-if="thread.anchor?.quote" class="about">
        <span v-if="thread.anchor.label" class="eyebrow mono-meta">{{ thread.anchor.label }}</span>
        <blockquote class="quote">{{ thread.anchor.quote }}</blockquote>
      </div>

      <div class="say">
        <span class="badge">{{ asker.badge }}</span>
        <div class="lines">
          <span class="by">
            <span class="title"
              ><span v-if="asker.token" class="token">[{{ asker.token }}]</span> {{ asker.rest }}</span
            >
            <span class="state mono-meta" :data-asking="isAsking">{{ asked }}</span>
          </span>
          <span class="text">{{ thread.body }}</span>
        </div>
      </div>

      <div v-if="ask.verdict" class="say">
        <span class="badge">DL</span>
        <div class="lines">
          <span class="by">
            <span class="title"
              ><span v-if="judge.token && judge.token !== 'DL'" class="token">[{{ judge.token }}]</span>
              {{ judge.rest }}</span
            >
            <span class="state mono-meta">{{ decision && !byYou ? "settled it" : "judged it yours" }}</span>
          </span>
          <span class="text">{{ ask.verdict.text }}</span>
        </div>
      </div>

      <div v-if="isAsking" class="choices" role="radiogroup" aria-label="Your decision">
        <button
          v-for="(option, i) in ask.options"
          :key="option"
          class="choice plain-button focusable"
          type="button"
          role="radio"
          aria-checked="false"
          :data-picked="pick === i + 1"
          :disabled="isSending"
          @click="send({ option: i + 1 })"
        >
          <span class="radio" aria-hidden="true" />
          <span class="label">{{ option }}</span>
          <span v-if="pick === i + 1" class="pick mono-meta">Domain Lead's pick</span>
        </button>
        <div class="own" :data-typing="!!words.trim()">
          <input
            v-model="words"
            class="own-field"
            type="text"
            aria-label="Answer in your own words"
            placeholder="Or answer in your own words…"
            @keydown.enter.prevent="sendWords"
          />
          <UiIconButton
            v-if="words.trim()"
            :icon="ArrowUp"
            label="Send"
            data-tip="Send · {↵}. It goes to the Individual Contributor and into the history"
            size="sm"
            variant="filled"
            @click="sendWords"
          />
        </div>
      </div>

      <template v-else-if="decision">
        <div class="say">
          <span class="badge" data-you="true">{{ byYou ? "YOU" : "DL" }}</span>
          <div class="lines">
            <span class="by">
              <span class="title">{{ byYou ? "You decided" : "The Domain Lead settled it" }}</span>
              <span class="state mono-meta">{{ clock(decision.at) }} · {{ later }} later</span>
            </span>
            <span class="text">{{ decision.text }}</span>
          </div>
        </div>
        <p class="kept">
          <UiIcon :icon="History" size="xs" />
          {{
            byYou
              ? "Sent to the conversation that asked and kept in your decisions, so nobody asks it again."
              : "Sent to the conversation that asked and kept in the workstream's history."
          }}
        </p>
      </template>
    </div>
  </section>
</template>

<style scoped>
.card {
  @apply overflow-hidden rounded-2xl border border-border-strong bg-raised;
}

.card[data-asking="true"] {
  @apply border-error;
}

.head {
  @apply flex items-center gap-2 border-b border-b-border bg-sunken py-2.25 pr-3 pl-3.5;
}

.needs-dot {
  @apply size-1.75 flex-none bg-error;
}

.check {
  @apply flex-none text-fg;
}

.what {
  @apply flex-none typo-body font-bold;
}

.meta {
  @apply min-w-0 truncate text-muted;
}

.spacer {
  @apply flex-1;
}

.needs,
.settled {
  @apply box-border inline-flex h-5.5 flex-none items-center gap-1.25 rounded-full border bg-raised px-2.25 typo-meta-semibold;
}

.needs {
  @apply border-error text-error;
}

.settled {
  @apply border-border-strong text-fg;
}

.body {
  @apply flex flex-col gap-3 px-3.5 pt-3 pb-3.5;
}

.about {
  @apply flex flex-col gap-1.5;
}

.eyebrow {
  @apply text-subtle;
}

.quote {
  @apply m-0 rounded-r-md border-l-2 border-l-primary bg-sunken px-2.5 py-1.5 typo-caption leading-normal text-muted italic;
}

.say {
  @apply flex gap-2.5;
}

.badge {
  @apply inline-flex size-5.5 flex-none items-center justify-center rounded-full bg-primary-soft typo-mono-nano font-semibold text-primary-deep;
}

.badge[data-you="true"] {
  @apply box-border border border-border-strong bg-raised typo-mono-pico font-semibold text-fg;
}

.lines {
  @apply flex min-w-0 flex-1 flex-col gap-0.75;
}

.by {
  @apply flex min-w-0 items-center gap-2;
}

.title {
  @apply min-w-0 truncate typo-caption font-bold;
}

.token {
  @apply font-semibold text-muted;
}

.state {
  @apply flex-none text-muted;
}

.state[data-asking="true"] {
  @apply text-error;
}

.text {
  @apply typo-body leading-relaxed text-pretty whitespace-pre-line;
}

.choices {
  @apply flex flex-col gap-1.5 pl-8;
}

.choice {
  @apply flex items-center gap-2.5 rounded-xl border border-border bg-transparent px-3 py-2.25 text-left text-fg transition-colors duration-(--duration-fast) ease-out;
}

.choice[data-picked="true"] {
  @apply border-border-strong bg-raised;
}

@media (hover: hover) and (pointer: fine) {
  .choice:hover {
    @apply bg-sunken;
  }
}

.radio {
  @apply box-border size-4 flex-none rounded-full border-2 border-border-strong;
}

.label {
  @apply flex-1 typo-body leading-snug;
}

.choice[data-picked="true"] .label {
  @apply font-semibold;
}

.pick {
  @apply flex-none rounded-full bg-sunken px-1.75 py-0.5 tracking-wider text-muted normal-case;
}

.own {
  @apply flex items-end gap-2 rounded-xl border border-dashed border-border-strong;
}

.own[data-typing="true"] {
  @apply border-solid border-primary bg-sunken py-1.5 pr-1.5;
}

.own-field {
  @apply h-9.5 min-w-0 flex-1 border-0 bg-transparent px-3 typo-body text-fg outline-none;
}

.own[data-typing="true"] .own-field {
  @apply h-7.5;
}

.kept {
  @apply m-0 flex items-center gap-2 pl-8 typo-caption leading-normal text-muted;
}
</style>

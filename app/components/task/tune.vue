<script lang="ts" setup>
import { X } from "@lucide/vue";

export type TunePhase = "typed" | "tuning" | "proposed" | "split";

const {
  phase,
  proposal = "",
  scope,
  sections = [],
  words,
} = defineProps<{
  phase: TunePhase;
  proposal?: string;
  scope: string;
  sections?: string[];
  words?: [number, number];
}>();

const instruction = defineModel<string>({ default: "" });

const emit = defineEmits<{ cancel: []; discard: []; keep: []; stop: []; tune: [] }>();

const field = useTemplateRef<HTMLTextAreaElement>("field");
const card = useTemplateRef<HTMLElement>("card");

const scopeLabel = computed(() => (phase === "split" ? `${sections.length} paragraphs` : scope));

const ESCAPE: Record<TunePhase, () => void> = {
  typed: () => emit("cancel"),
  split: () => emit("cancel"),
  tuning: () => emit("stop"),
  proposed: () => emit("discard"),
};

function onKey(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    ESCAPE[phase]();
    return;
  }
  if (event.key !== "Enter" || event.shiftKey) return;
  event.preventDefault();
  if (phase === "typed" && instruction.value.trim()) emit("tune");
  if (phase === "proposed") emit("keep");
}

function focus(): void {
  (field.value ?? card.value)?.focus();
}

onMounted(() => void nextTick(focus));
watch(
  () => phase,
  () => void nextTick(focus),
);
defineExpose({ focus });
</script>

<template>
  <div class="tune" data-region="tune" @keydown="onKey">
    <div v-if="phase === 'proposed'" class="proposal">{{ proposal }}</div>
    <section ref="card" class="card" role="dialog" aria-label="Tune with the assistant" tabindex="-1">
      <header class="head">
        <span class="scope mono-meta">Tune · {{ scopeLabel }}</span>
        <span class="only mono-meta">{{ phase === "split" ? "one paragraph at a time" : "this paragraph only" }}</span>
        <span class="spacer" />
        <UiIconButton :icon="X" label="Cancel" data-tip="Cancel · {esc}" size="xs" @click="emit('cancel')" />
      </header>
      <div class="body">
        <template v-if="phase === 'typed'">
          <textarea
            ref="field"
            v-model="instruction"
            class="field"
            aria-label="How to tune this paragraph"
            placeholder="Shorter, and lead with what it costs you."
            rows="2"
          />
          <span class="help"
            >The assistant rewrites this paragraph and nothing else, and you keep it or throw it away.</span
          >
        </template>
        <template v-else-if="phase === 'split'">
          <span class="said">
            Tune works on one paragraph at a time, and your selection runs from {{ sections[0] }} into
            {{ sections.at(-1) }}.
          </span>
          <span class="help">Narrow it to one paragraph, or tune each in turn.</span>
        </template>
        <template v-else>
          <span class="asked">{{ instruction }}</span>
          <span v-if="phase === 'tuning'" class="working">Rewriting the {{ scope }} paragraph</span>
          <span v-else class="changed mono-meta">
            <span class="dot" />1 paragraph changed<template v-if="words">
              · {{ words[0] }} to {{ words[1] }} words</template
            >
          </span>
        </template>
        <footer class="actions">
          <UiButton
            v-if="phase === 'typed' || phase === 'split'"
            data-flow="tune-go"
            :data-tip="phase === 'split' ? 'Select one paragraph to tune it' : 'Tune · {enter}'"
            :disabled="phase === 'split' || !instruction.trim()"
            size="xs"
            @click="emit('tune')"
            >Tune</UiButton
          >
          <UiButton v-if="phase === 'tuning'" data-tip="Stop · {esc}" size="xs" variant="outline" @click="emit('stop')"
            >Stop</UiButton
          >
          <template v-if="phase === 'proposed'">
            <UiButton
              data-flow="tune-discard"
              data-tip="Discard · {esc}"
              size="xs"
              variant="outline"
              @click="emit('discard')"
              >Discard</UiButton
            >
            <UiButton
              data-flow="tune-keep"
              data-tip="Keep · {enter}"
              size="xs"
              variant="secondary"
              @click="emit('keep')"
              >Keep</UiButton
            >
          </template>
        </footer>
      </div>
    </section>
  </div>
</template>

<style scoped>
.tune {
  @apply flex max-w-105 flex-col gap-2.5;
}

.proposal {
  @apply -mx-1 rounded-sm bg-primary-soft px-1 py-0.5 font-mono typo-caption leading-relaxed whitespace-pre-wrap text-fg;
}

.card {
  @apply flex flex-col overflow-hidden rounded-2xl bg-raised shadow-lg ring-1 ring-border outline-none;
}

.head {
  @apply flex items-center gap-2 pt-2.5 pr-2 pb-1.5 pl-3.5;
}

.scope {
  @apply text-subtle;
}

.only {
  @apply rounded-full bg-sunken px-1.75 py-px text-muted normal-case;
}

.spacer {
  @apply flex-1;
}

.body {
  @apply flex flex-col gap-2.5 px-3.5 pt-1 pb-3.5;
}

.field {
  @apply box-border min-h-16 w-full resize-none rounded-xl border border-primary bg-sunken px-3 py-2.5 font-sans typo-body leading-normal text-fg outline-none;
}

.help {
  @apply typo-caption leading-normal text-pretty text-muted;
}

.said {
  @apply typo-body leading-normal text-pretty;
}

.asked {
  @apply border-l-2 border-l-border-strong pl-2 typo-caption leading-normal text-muted;
}

.working {
  @apply shimmer typo-body;
}

.changed {
  @apply flex items-center gap-2 text-muted;
}

.changed .dot {
  @apply size-1.5 bg-primary;
}

.actions {
  @apply flex items-center justify-end gap-2 pt-0.5;
}
</style>

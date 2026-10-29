<script lang="ts" setup>
import { Terminal } from "@lucide/vue";
import type { ConversationTurn } from "~/composables/useConversation";
import type { PromptSent } from "~/stores/prompt";
import type { AskedQuestion } from "~/stores/questions";

type Block =
  | { kind: "said" | "note"; key: string; turn: ConversationTurn }
  | { kind: "you"; key: string; turn: ConversationTurn; text: string; images: string[] }
  | { kind: "pictures"; key: string; paths: string[] }
  | { kind: "ran"; key: string; line?: string; printed: string[] }
  | { kind: "asking"; key: string; ask: AskedQuestion }
  | { kind: "tools"; key: string; turns: ConversationTurn[] };

const sc = useSidecar();
const prompt = $prompt();
const questions = $questions();
const terminal = $terminal();
const busy = $busy();
const tree = useOrgTree();
const live = useConversation(() => sc.sessionKey.value);
const clock = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });

const key = computed(() => sc.sessionKey.value ?? "");
// The turn bus knows a turn is open before its first block lands, which is when Stop matters most.
const isBusy = computed(() => !!busy.keys[key.value]?.doing || live.isBusy.value);
const session = computed(() => sc.sessions.value.find((one) => one.key === key.value));
const name = computed(() => Org.placeOf(tree.value, key.value)?.row.name ?? (session.value ? nameOf(session.value) : ""));
// A pick stands in until a turn lands after it, which names the model the session really runs, switched or refused.
const model = computed(() => {
  const pick = prompt.chosen[key.value];
  if (!pick) return live.model.value;
  const newest = live.stream.value.findLast((turn) => turn.model);
  return newest && newest.at > pick.at ? live.model.value : pick.model;
});

const mode = computed(() => {
  const move = prompt.moved[key.value];
  if (!move) return live.mode.value;
  const newest = live.stream.value.findLast((turn) => turn.mode);
  return newest && newest.at > move.at ? live.mode.value : move.mode;
});

const blocks = computed<Block[]>(() => {
  const out: Block[] = [];
  for (const [at, turn] of live.stream.value.entries()) {
    const id = `${turn.at}-${at}`;
    const last = out.at(-1);
    if (turn.kind === "acting") {
      const ask = turn.tool === "AskUserQuestion" && turn.ref ? questions.open[turn.ref] : undefined;
      if (ask) out.push({ kind: "asking", key: id, ask });
      else if (last?.kind === "tools") last.turns.push(turn);
      else out.push({ kind: "tools", key: id, turns: [turn] });
    } else if (turn.kind === "command") {
      out.push({ kind: "ran", key: id, line: turn.text, printed: [] });
    } else if (turn.kind === "printed") {
      if (last?.kind === "ran") last.printed.push(turn.text);
      else out.push({ kind: "ran", key: id, printed: [turn.text] });
    } else if (turn.role === "user") {
      const pasted = PastedImages.sourcesOf(turn.text);
      const attached = AttachedFiles.imagesOf(turn.text);
      if (pasted.length && last?.kind === "you") last.images.push(...pasted);
      if (!pasted.length && attached.text) out.push({ kind: "you", key: id, turn, text: attached.text, images: [] });
      const paths = pasted.length ? pasted : attached.paths;
      if (paths.length) out.push({ kind: "pictures", key: `${id}-pictures`, paths });
    } else if (turn.role === "system") out.push({ kind: "note", key: id, turn });
    else out.push({ kind: "said", key: id, turn });
  }
  const claimed = new Set(out.flatMap((block) => (block.kind === "asking" ? [block.ask.ref] : [])));
  for (const ask of Object.values(questions.open)) {
    if (ask.key === key.value && !claimed.has(ask.ref)) out.push({ kind: "asking", key: ask.ref, ask });
  }
  return out;
});

const isAsking = computed(() => blocks.value.some((block) => block.kind === "asking"));

const partsOf = ({ images, text }: Extract<Block, { kind: "you" }>) =>
  PastedImages.partsOf(text).map((part) =>
    part.kind === "text" ? part : { ...part, path: images.find((path) => PastedImages.numberOf(path) === part.number) },
  );

// A message queued behind a running turn reaches the stream only once delivered, so the sent copy stands in until then.
const landedOf = (one: PromptSent): boolean =>
  live.stream.value.some(
    (turn) =>
      (turn.role === "user" || turn.kind === "command") && turn.at >= one.at - 5000 && turn.text.trim() === one.text,
  );
const pending = computed(() => prompt.sent.filter((one) => one.key === key.value && !landedOf(one)));
const refusal = computed(() => prompt.refused[key.value]);

watch([() => live.stream.value.length, () => prompt.sent.length], () => {
  for (const one of prompt.sent) if (one.key === key.value && landedOf(one)) prompt.landed(one);
});
</script>

<template>
  <section class="conversation" data-region="conversation">
    <div class="scroll">
      <div class="column">
        <UiStateMessage v-if="!blocks.length && !pending.length" class="empty"
          >Nothing has been said in this conversation yet.</UiStateMessage
        >
        <template v-for="block in blocks" :key="block.key">
          <div v-if="block.kind === 'you'" class="you">
            <p class="bubble">
              <template v-for="(part, at) in partsOf(block)" :key="at"
                ><ConversationImageRef v-if="part.kind === 'image'" :number="part.number" :path="part.path" /><template
                  v-else
                  >{{ part.text }}</template
                ></template
              >
            </p>
            <span v-if="block.turn.via === 'terminal'" class="typed mono-meta">
              <UiIcon :icon="Terminal" size="xs" />typed in your terminal · {{ clock.format(block.turn.at) }}
            </span>
          </div>
          <div v-else-if="block.kind === 'pictures'" class="you">
            <ProseMediaSet class="pictures" :conversation="key" :paths="block.paths.join('\n')" />
          </div>
          <div v-else-if="block.kind === 'ran'" class="ran">
            <p v-if="block.line" class="line"><span class="arrow" aria-hidden="true">❯</span>{{ block.line }}</p>
            <pre v-for="(text, at) in block.printed" :key="at" class="printed">{{ text }}</pre>
          </div>
          <p v-else-if="block.kind === 'note'" class="note mono-meta">{{ block.turn.text }}</p>
          <Prose v-else-if="block.kind === 'said'" class="said" :conversation="key" :value="block.turn.text" />
          <QuestionAsk v-else-if="block.kind === 'asking'" :ask="block.ask" />
          <ConversationTools
            v-else-if="block.kind === 'tools'"
            :is-busy="isBusy"
            :results="live.results.value"
            :turns="block.turns"
          />
        </template>
        <template v-for="one in pending" :key="one.at">
          <div v-if="SlashCommand.parse(one.text)" class="ran" data-pending="true">
            <p class="line"><span class="arrow" aria-hidden="true">❯</span>{{ one.text }}</p>
            <span class="queued mono-meta">{{ isBusy ? "queued behind the turn in flight" : "sending" }}</span>
          </div>
          <div v-else class="you" data-pending="true">
            <p class="bubble">{{ one.text }}</p>
            <span class="typed mono-meta">{{ isBusy ? "queued behind the turn in flight" : "sending" }}</span>
          </div>
        </template>
        <p v-if="refusal" class="refused" role="status">
          <span>Run /{{ refusal.name }} in your terminal</span>
          <UiButton size="xs" variant="outline" @click="terminal.attach(key)">Attach</UiButton>
        </p>
        <p v-if="prompt.isWaking" class="busy" role="status">
          <ClaudeMascot :size="20" state="thinking" />
          <span class="busy-line shimmer">Waking {{ name }}</span>
        </p>
        <p v-if="isBusy && !isAsking" class="busy" role="status">
          <ClaudeMascot :size="20" :state="live.mascot.value" />
          <span class="busy-line shimmer">{{ live.step.value || "Working" }}</span>
        </p>
      </div>
    </div>
    <ConversationPrompt
      v-if="key"
      :has-history="!!blocks.length"
      :is-busy="isBusy"
      :mode="mode"
      :model="model"
      :name="name"
    />
  </section>
</template>

<style scoped>
.conversation {
  @apply flex h-full min-h-0 flex-col;
}

/* Reversed, so the browser keeps the newest turn in view as the stream grows and leaves a reader scrolled up alone. */
.scroll {
  @apply flex min-h-0 flex-1 flex-col-reverse overflow-y-auto;
}

.column {
  @apply mx-auto box-border flex w-full max-w-187 flex-col gap-3.5 px-6 pt-4 pb-3.5;
}

.empty {
  @apply py-6;
}

.you {
  @apply flex flex-col items-end gap-1.25;
}

.bubble {
  @apply m-0 max-w-130 rounded-2xl bg-sunken px-3.5 py-2.25 typo-body leading-normal text-pretty whitespace-pre-wrap;
}

.pictures {
  @apply w-full max-w-90;
}

.you[data-pending="true"] .bubble {
  @apply opacity-60;
}

.typed {
  @apply inline-flex items-center gap-1.25 pr-1 text-muted normal-case;
}

.note {
  @apply m-0 self-center text-subtle normal-case;
}

.ran {
  @apply flex flex-col gap-1 typo-mono-meta font-mono;
}

.ran[data-pending="true"] {
  @apply opacity-60;
}

.line {
  @apply m-0 flex gap-2 text-fg;
}

.arrow {
  @apply flex-none text-subtle;
}

.printed {
  @apply m-0 ml-4 font-mono whitespace-pre-wrap text-muted;
}

.queued {
  @apply ml-4 text-muted normal-case;
}

.refused {
  @apply m-0 flex items-center gap-2.5 typo-caption text-muted;
}

.said {
  @apply typo-body;
}

.busy {
  @apply m-0 flex min-w-0 items-center gap-2.5 typo-body;
}

.busy-line {
  @apply min-w-0 truncate font-medium;
}
</style>

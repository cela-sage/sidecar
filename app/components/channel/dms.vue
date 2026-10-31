<script lang="ts" setup>
const channel = $channel();

const dms = computed(() => (channel.room ? ChannelView.dmsOf(channel.room, channel.cast) : []));
const open = computed(() => dms.value.find((one) => one.id === channel.pair) ?? dms.value[0]);
</script>

<template>
  <div class="dms" data-region="channel-dms">
    <UiStateMessage v-if="!dms.length" align="center" class="empty"
      >No DMs yet. A relay between two of this workstream's agents shows here.</UiStateMessage
    >
    <template v-else>
      <nav class="list" aria-label="DMs between agents">
        <div class="list-head">
          <span class="eyebrow mono-meta">Between agents</span>
          <span class="sub">you can read every one</span>
        </div>
        <button
          v-for="dm in dms"
          :key="dm.id"
          class="pair plain-button focusable"
          type="button"
          :aria-current="dm.id === open?.id"
          @click="channel.pair = dm.id"
        >
          <span class="duo">
            <ChannelFace :size="22" :speaker="dm.pair[0]" />
            <ChannelFace class="second" is-stacked :size="22" :speaker="dm.pair[1]" />
          </span>
          <span class="pair-words">
            <span class="pair-names">{{ dm.names }}</span>
            <span class="pair-last">{{ dm.last }}</span>
          </span>
          <time class="at" :datetime="dm.at">{{ clockOf(dm.at) }}</time>
        </button>
      </nav>
      <section v-if="open" class="read" :aria-label="open.names">
        <header class="read-head">
          <span class="duo">
            <ChannelFace :size="22" :speaker="open.pair[0]" />
            <ChannelFace class="second" is-stacked :size="22" :speaker="open.pair[1]" />
          </span>
          <span class="read-names">{{ open.names }}</span>
          <span class="chip">DM</span>
          <span class="spacer" />
          <span class="note">Only they get notified. Neither sees that you read it.</span>
        </header>
        <div class="scroll">
          <div class="log" role="log" :aria-label="`DMs between ${open.names}`">
            <div v-for="(one, at) in open.messages" :key="at" class="said">
              <ChannelFace is-openable :size="36" :speaker="one.from" />
              <div class="said-body">
                <div class="said-head">
                  <span class="said-name" :data-tip="ChannelCast.tipOf(one.from)">{{ one.from.name }}</span>
                  <span v-if="one.from.role" class="role">{{ one.from.role }}</span>
                  <time class="at" :datetime="one.at">{{ clockOf(one.at) }}</time>
                </div>
                <p class="said-text">{{ one.text }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.dms {
  @apply flex min-h-0 flex-1;
}

.empty {
  @apply flex-1 py-10;
}

.list {
  @apply box-border flex w-75 flex-none flex-col gap-0.5 overflow-y-auto border-r border-r-border px-2 py-2.5;
}

.list-head {
  @apply flex items-baseline gap-2 px-2 pt-1 pb-2;
}

.eyebrow {
  @apply text-subtle;
}

.sub {
  @apply typo-caption text-muted;
}

.pair {
  @apply flex items-center gap-2.5 rounded-lg border border-transparent bg-transparent p-2 text-left text-fg;
}

.pair[aria-current="true"] {
  @apply border-border-strong bg-sunken;
}

@media (hover: hover) and (pointer: fine) {
  .pair:not([aria-current="true"]):hover {
    @apply bg-sunken;
  }
}

.duo {
  @apply relative h-7.5 w-8.5 flex-none;
}

.duo > :first-child {
  @apply absolute top-0 left-0;
}

.second {
  @apply absolute top-2 left-3;
}

.pair-words {
  @apply flex min-w-0 flex-1 flex-col gap-0.5;
}

.pair-names {
  @apply typo-caption-strong;
}

.pair-last {
  @apply truncate typo-caption text-muted;
}

.at {
  @apply flex-none typo-mono-micro text-subtle;
}

.read {
  @apply flex min-w-0 flex-1 flex-col;
}

.read-head {
  @apply flex h-13 flex-none items-center gap-2.5 border-b border-b-border px-5;
}

.read-names {
  @apply typo-body-strong font-extrabold tracking-tight;
}

.chip {
  @apply flex-none rounded-full bg-sunken px-1.75 py-0.5 typo-mono-pico font-semibold tracking-widest text-muted;
}

.spacer {
  @apply flex-1;
}

.note {
  @apply truncate typo-caption text-muted;
}

.scroll {
  @apply flex min-h-0 flex-1 flex-col-reverse overflow-y-auto;
}

.log {
  @apply flex flex-col gap-4 px-5 pt-4 pb-(--float-clear);
}

.said {
  @apply grid grid-cols-[--spacing(9)_minmax(0,1fr)] gap-x-2.5;
}

.said-body {
  @apply flex min-w-0 flex-col gap-0.75;
}

.said-head {
  @apply flex items-baseline gap-1.75;
}

.said-name {
  @apply typo-body font-extrabold;
}

.role {
  @apply flex-none rounded-sm bg-sunken px-1.25 py-px typo-mono-pico font-semibold tracking-wide text-muted;
}

.said-text {
  @apply m-0 typo-body leading-relaxed text-pretty whitespace-pre-wrap;
}
</style>

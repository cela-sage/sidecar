<script lang="ts" setup>
import type { SurfaceVariant } from "@cela/design";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ExternalLink, RotateCw, Search, X } from "@lucide/vue";

const { slug, variant } = defineProps<{ slug: string; variant: SurfaceVariant }>();

const web = $web();
const find = $find();
const field = useTemplateRef<HTMLInputElement>("field");
const seek = useTemplateRef<HTMLElement>("seek");
const scrolled = ref(0);
const { address, cancel, commit, draft, edit, host, isEditing, isWeb, meta, openOut, title } = useArtifactAddress({
  focus: () => {
    field.value?.focus();
    field.value?.select();
  },
  slug: () => slug,
});

const count = computed(() => {
  const got = find.result;
  if (!find.query || !got) return "";
  return got.matches ? `${got.active} of ${got.matches}` : "No matches";
});

watch(
  () => find.focusing,
  async () => {
    cancel();
    await nextTick();
    const input = seek.value?.querySelector("input");
    input?.focus();
    input?.select();
  },
);
watch(isEditing, (on) => {
  if (on) find.close();
});

function onSeekKey(event: KeyboardEvent): void {
  if (event.key === "Enter") {
    event.preventDefault();
    find.step(event.shiftKey ? -1 : 1);
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    find.leave();
  }
}

// The host reads quieter than the path, as the design draws it; the field under it carries the caret and the selection.
const lead = computed(() =>
  isWeb.value
    ? (/^([a-z][a-z0-9+.-]*:\/\/)?[^/?#]*/i.exec(draft.value)?.[0] ?? "")
    : draft.value.slice(0, draft.value.lastIndexOf("/") + 1),
);
const tail = computed(() => draft.value.slice(lead.value.length));

function track(): void {
  requestAnimationFrame(() => (scrolled.value = field.value?.scrollLeft ?? 0));
}
</script>

<template>
  <UiSurface
    class="island"
    data-region="title-island"
    :data-editing="isEditing"
    :data-finding="find.isOpen"
    pad="none"
    shape="pill"
    :variant="variant"
  >
    <div v-if="find.isOpen" ref="seek" class="seek" data-region="web-find" role="search">
      <UiTextInput
        v-model="find.query"
        aria-label="Find in page"
        autocomplete="off"
        placeholder="Find in page"
        spellcheck="false"
        type="search"
        variant="bare"
        @keydown="onSeekKey"
      >
        <template #leading>
          <UiIcon class="icon" :icon="Search" size="sm" />
        </template>
      </UiTextInput>
      <span v-if="count" class="count" aria-live="polite">{{ count }}</span>
      <span class="rule" />
      <ChromeAction
        :icon="ChevronUp"
        :is-disabled="!find.result?.matches"
        shape="inset"
        tip="Previous match · {cmd shift G}"
        @click="find.step(-1)"
      />
      <ChromeAction
        :icon="ChevronDown"
        :is-disabled="!find.result?.matches"
        shape="inset"
        tip="Next match · {cmd G}"
        @click="find.step(1)"
      />
      <ChromeAction :icon="X" shape="inset" tip="Close · {esc}" @click="find.leave()" />
    </div>
    <template v-else>
      <template v-if="isWeb">
        <ChromeAction
          data-region="web-back"
          :icon="ChevronLeft"
          :is-disabled="!web.history.back"
          shape="inset"
          tip="Back · {cmd [}"
          @click="web.step(-1)"
        />
        <ChromeAction
          data-region="web-forward"
          :icon="ChevronRight"
          :is-disabled="!web.history.forward"
          shape="inset"
          tip="Forward · {cmd ]}"
          @click="web.step(1)"
        />
        <ChromeAction
          data-region="web-reload"
          :icon="RotateCw"
          shape="inset"
          tip="Reload · {cmd R}"
          @click="web.reload()"
        />
        <span class="rule" />
      </template>
      <form v-if="isEditing" class="edit" data-region="web-address" @submit.prevent="commit">
        <WebFavicon v-if="isWeb" class="icon" :address="draft" :page="web.page" />
        <ArtifactsKindIcon v-else-if="meta" :meta="meta" />
        <span class="box">
          <input
            ref="field"
            v-model="draft"
            aria-label="Address"
            autocomplete="off"
            class="field"
            inputmode="url"
            spellcheck="false"
            type="text"
            @blur="cancel"
            @input="track"
            @keydown.esc.prevent.stop="cancel"
            @keyup="track"
            @scroll="track"
            @select="track"
          />
          <span class="mirror" aria-hidden="true">
            <span class="line" :style="{ translate: `${-scrolled}px 0` }"
              ><span class="lead">{{ lead }}</span
              >{{ tail }}</span
            >
          </span>
        </span>
      </form>
      <button
        v-else
        v-press
        class="named focusable"
        type="button"
        data-region="web-address"
        :data-tip="isWeb ? 'Show the URL · {cmd L}' : 'Show the path · {cmd L}'"
        @click="edit"
      >
        <WebFavicon v-if="isWeb" class="icon" :address="address" :page="web.page" />
        <ArtifactsKindIcon v-else-if="meta" :meta="meta" />
        <span class="title">{{ title }}</span>
        <span class="host">{{ host }}</span>
      </button>
      <ChromeAction
        :icon="ExternalLink"
        is-quiet
        shape="inset"
        :tip="isWeb ? 'Open in your browser' : 'Open in its own app'"
        @click="openOut"
      />
    </template>
  </UiSurface>
</template>

<style scoped>
/* Named in full, since the surface's own transition gives way to this rule and the flat fill would snap into glass. */
.island {
  @apply flex h-(--island-row-h) w-full items-center gap-0.5 px-1 py-0 transition-[background-color,box-shadow,backdrop-filter] duration-(--duration-base) ease-in-out;
}

.island[data-editing="true"],
.island[data-finding="true"]:focus-within {
  @apply ring-3 ring-primary-soft ring-offset-1 ring-offset-primary duration-(--duration-fast) ease-out;
}

.seek {
  @apply flex min-w-0 flex-1 items-center gap-0.5 self-stretch pl-2;
}

.count {
  @apply flex-none pr-1 typo-meta-strong whitespace-nowrap text-muted tabular-nums;
}

.rule {
  @apply mx-1 my-0 h-4.5 w-px flex-none bg-border;
}

.named {
  @apply flex h-8 min-w-0 flex-1 cursor-text items-center gap-2 rounded-full border-0 bg-transparent px-1 py-0 text-left text-fg;
}

.icon {
  @apply text-muted;
}

.title {
  @apply min-w-0 flex-initial truncate typo-body-strong font-bold;
}

.host {
  @apply ml-auto min-w-0 flex-initial truncate font-mono typo-meta-strong text-muted;
}

/* The icon sits where it does unedited, so the typed address starts where the title did. */
.edit {
  @apply m-0 flex min-w-0 flex-1 items-center gap-2 self-stretch pl-1;
}

.box {
  @apply relative min-w-0 flex-1 self-stretch;
}

.field,
.mirror {
  @apply font-mono typo-body-strong;
}

/* Its text is drawn by the mirror above it, so only the caret and the selection show from here. */
.field {
  @apply absolute inset-0 size-full border-0 bg-transparent py-0 pr-1 pl-0 text-transparent caret-primary outline-none;
}

.field::selection {
  @apply bg-primary-soft text-transparent;
}

.mirror {
  @apply pointer-events-none absolute inset-y-0 right-1 left-0 flex items-center overflow-hidden whitespace-pre text-fg;
}

/* Same weight as the field, or its glyphs would drift off the caret it draws. */
.lead {
  @apply text-muted;
}

@media (prefers-reduced-motion: reduce) {
  .island {
    @apply transition-none;
  }
}
</style>

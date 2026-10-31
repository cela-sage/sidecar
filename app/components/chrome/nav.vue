<script lang="ts" setup>
import { useShortcuts } from "@cela/design";
import { ArrowLeft, ArrowRight } from "@lucide/vue";

const sc = useSidecar();
const nav = $nav();

const backTip = computed(() => (nav.back ? `Back to ${nav.labelOf(nav.back.place)} · {cmd [}` : "Back · {cmd [}"));
const forwardTip = computed(() =>
  nav.forward ? `Forward to ${nav.labelOf(nav.forward.place)} · {cmd ]}` : "Forward · {cmd ]}",
);

// A web page in front owns ⌘[ for its own history, and Monaco owns it for outdent.
const isOwnedElsewhere = (): boolean =>
  (areBrowserKeysLive() && sc.artifact.value?.kind === "web") ||
  !!document.activeElement?.closest(".monaco-editor");

useShortcuts(
  {
    "Mod+BracketLeft": () => nav.move(-1),
    "Mod+BracketRight": () => nav.move(1),
  },
  { when: () => !isOwnedElsewhere() && !sc.failure.value },
);
</script>

<template>
  <span class="nav" role="group" aria-label="Back and forward">
    <UiIconButton
      :icon="ArrowLeft"
      aria-label="Back"
      :data-tip="backTip"
      :disabled="!nav.back"
      size="sm"
      @click="nav.move(-1)"
    />
    <UiIconButton
      :icon="ArrowRight"
      aria-label="Forward"
      :data-tip="forwardTip"
      :disabled="!nav.forward"
      size="sm"
      @click="nav.move(1)"
    />
  </span>
</template>

<style scoped>
.nav {
  @apply flex flex-none items-center gap-0.5;
}
</style>

<script lang="ts" setup>
import { Send } from "@lucide/vue";

const sc = useSidecar();
const tray = useTray();
const notes = $notes();

// A note box saves on its own Enter and prevents it, so only a ⌘↵ nobody handled lands here.
function onKey(event: KeyboardEvent): void {
  if (event.key !== "Enter" || event.defaultPrevented || !(event.metaKey || event.ctrlKey)) return;
  event.preventDefault();
  void notes.send();
}

onMounted(() => {
  window.addEventListener("keydown", onKey);
  onScopeDispose(() => window.removeEventListener("keydown", onKey));
  // The chips are deliberately not persisted, so a refresh would drop typed words with no receipt.
  function warn(event: BeforeUnloadEvent): void {
    if (tray.items.value.some((item) => !item.isSent)) event.preventDefault();
  }
  window.addEventListener("beforeunload", warn);
  onScopeDispose(() => window.removeEventListener("beforeunload", warn));
});
</script>

<template>
  <div v-if="sc.sessionKey.value" class="notes" data-region="composer-notes">
    <ComposerTray />
    <div v-if="tray.count.value" class="pills">
      <UiSurface class="pill" pad="none" shape="pill" variant="glass-liquid">
        <button
          v-press
          class="send focusable"
          type="button"
          data-tip="Send to Claude · {cmd enter}"
          :disabled="notes.isSending"
          @click="notes.send"
        >
          <UiIcon :icon="Send" size="sm" />
          {{ notes.isSending ? notes.sendingLabel : `Send ${plural(tray.count.value, "note")} to Claude` }}
        </button>
      </UiSurface>
    </div>
  </div>
</template>

<style scoped>
.notes {
  @apply flex flex-col items-end gap-2;
}

.pills {
  @apply flex w-full items-end justify-end gap-2;
}

.pills > * {
  @apply pointer-events-auto;
}

.pill {
  @apply flex h-(--island-row-h) items-center overflow-hidden;
}

.send {
  @apply inline-flex h-full cursor-pointer items-center gap-2 rounded-4xl border-0 bg-primary px-4 py-0 typo-body-strong text-primary-content;
}

.send:disabled {
  @apply cursor-progress opacity-70;
}
</style>

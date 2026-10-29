<script lang="ts" setup>
import type { LiveSession } from "~~/shared/types/session";

const { session } = defineProps<{ session: LiveSession }>();

const LABELS: Record<Face, string> = {
  conversation: "Conversation",
  artifacts: "Artifacts",
  review: "Review",
  files: "Files",
  history: "History",
};

const sc = useSidecar();
const chrome = useChrome();
const review = useReview();

// Counted only from what is already held, so the row never reads a face's data before that face opens.
const counts = computed<Partial<Record<Face, number>>>(() => {
  const snapshot = review.snapshot.value;
  const held: [Face, number][] = [
    ["artifacts", Artifacts.listedBy({ catalogue: sc.catalogue.value, session }).length],
    ["review", snapshot?.key === session.key ? snapshot.files.length : 0],
  ];
  return Object.fromEntries(held.filter(([, count]) => count > 0));
});

const options = computed(() =>
  chrome.view.faces.value.map((face) => ({
    count: counts.value[face],
    hint: `${LABELS[face]} of this conversation`,
    label: LABELS[face],
    value: face,
  })),
);

const face = computed<Face>({
  get: () => chrome.view.current.value,
  set: (next) => chrome.view.set(next),
});
</script>

<template>
  <nav class="faces" aria-label="Faces of this conversation">
    <UiSegmented v-model="face" data-region="view-switcher" :options="options" />
  </nav>
</template>

<style scoped>
.faces {
  @apply flex h-11.5 flex-none items-center border-b border-b-border px-4.5 pb-2.5;
}
</style>

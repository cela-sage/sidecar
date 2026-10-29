<script lang="ts" setup>
import type { FileStat } from "~~/shared/types/files";
import type { ChatMedia } from "~/components/conversation/media.vue";

const { conversation: own, paths } = defineProps<{ conversation?: string; paths: string }>();

const sc = useSidecar();
const provided = inject(proseConversation, undefined);
const conversation = computed(() => own ?? provided);
const cwd = computed(() => sc.sessions.value.find((one) => one.key === conversation.value)?.cwd);
const sizes = ref(new Map<string, number>());

const named = computed(() =>
  paths.split("\n").flatMap((path) => {
    const kind = FileKind.of(path);
    const absolute = path.startsWith("/") ? path : cwd.value && `${cwd.value}/${path.replace(/^\.\//, "")}`;
    if (!conversation.value || !absolute || path.startsWith("~")) return [];
    if (kind !== "image" && kind !== "video" && kind !== "audio") return [];
    return [{ path, kind, absolute, src: Preview.srcOf({ conversation: conversation.value, path: absolute }) }];
  }),
);

const items = computed(() =>
  named.value.flatMap((one): ChatMedia[] => {
    const size = sizes.value.get(one.absolute);
    return size ? [{ path: one.path, kind: one.kind, src: one.src, size }] : [];
  }),
);
const pictures = computed(() => items.value.filter((one) => one.kind !== "audio"));
const sounds = computed(() => items.value.filter((one) => one.kind === "audio"));

watch(
  named,
  async (list) => {
    if (!conversation.value) return;
    const at = `/api/sessions/${encodeURIComponent(conversation.value)}/files/stat`;
    const stats = await Promise.all(
      list.map((one) => $fetch<FileStat>(at, { query: { path: one.absolute } }).catch(() => undefined)),
    );
    sizes.value = new Map(stats.flatMap((one) => (one?.size ? [[one.path, one.size] as const] : [])));
  },
  { immediate: true },
);
</script>

<template>
  <div v-if="items.length" class="media-set">
    <div v-if="pictures.length" class="pictures" :data-single="pictures.length === 1">
      <ConversationMedia v-for="one in pictures" :key="one.path" :media="one" />
    </div>
    <ConversationMedia v-for="one in sounds" :key="one.path" :media="one" />
  </div>
</template>

<style scoped>
.media-set {
  @apply flex flex-col gap-2.5;
}

.pictures {
  @apply grid grid-cols-2 gap-2.5;
}

.pictures[data-single="true"] {
  @apply grid-cols-1;
}
</style>

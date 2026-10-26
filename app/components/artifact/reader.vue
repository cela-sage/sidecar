<script lang="ts" setup>
import { Check, RotateCcw } from "@lucide/vue";
import type { FrameHit, FrameMark, FramePending, FrameSelection } from "~/types/frame";
import type { ArtifactDetail } from "~~/shared/types/artifact";
import type { DiffGap } from "~~/shared/types/versions";
import { FileKind } from "~~/shared/utils/file-kind";

type Stage = "live" | "reading" | "unreadable" | "version";

interface FrameHandle {
  clearPick: () => void;
  docs: () => Document[];
  element: () => HTMLIFrameElement | undefined;
}

const { conversation, slug } = defineProps<{ conversation: string; slug: string }>();

const GAP: Record<DiffGap, string> = {
  "missing-content": "no version of this file was stored for this turn",
  skipped: "this file is not versioned — it was over the size budget",
  "store-failed": "the version store could not be read",
  "unknown-baseline": "what stood before this file was first touched could not be reconstructed",
  "unresolved-target": "there is no version of this file at the point being asked for",
};

const sc = useSidecar();
const chrome = useChrome();
const web = $web();
const sides = $sideQuestion();
const shown = useFaceShown();

const frame = ref<FrameHandle>();
const marks = ref<FrameMark[]>([]);
const measured = ref(false);
const panel = ref<FrameSelection>();
const pendingEdits = ref<FramePending[]>([]);
const edition = ref(0);
const awaiting = ref(false);
const closedIds = new Set<string>();
const frameReady = ref(false);
const zoom = ref(1);
const inlineAsk = useState<boolean>("sc:inline-ask", () => false);
const inlineArmed = useState<boolean>("sc:inline-armed", () => false);

// The last page stays in sc.artifact until the next one lands, and none of it belongs to this slug.
const held = computed(() => (sc.artifact.value?.slug === slug ? sc.artifact.value : undefined));
const path = computed(() => held.value?.path);
const threads = computed(() => held.value?.threads ?? []);
const format = computed(() => held.value?.format);
const isPage = computed(() => format.value === "html");
const markdown = computed(() => format.value === "md");
const isNotebook = computed(() => format.value === "ipynb");
const media = computed(() => (format.value === "media" && path.value ? FileKind.of(path.value) : undefined));
const versions = useReadVersions({ path, sessionKey: sc.sessionKey, diffable: markdown });
const live = computed(() => !versions.at.value);
// A stored .md or notebook version is raw text, so the render route draws it rather than srcdoc.
const versionSrc = computed(() =>
  (markdown.value || isNotebook.value) && versions.at.value
    ? `/artifact/${slug}?session=${encodeURIComponent(conversation)}&turn=${versions.at.value}`
    : undefined,
);
const mediaSrc = computed(() => `/api/artifacts/${encodeURIComponent(slug)}/raw?v=${edition.value}`);
const createdVersion = computed(() => versions.list.value.find((one) => one.turn === versions.at.value)?.created);
// A .md a turn created has nothing to diff against, so it keeps the full rendered view.
const showDiff = computed(() => markdown.value && !!versions.at.value && !createdVersion.value);

const stage = computed<Stage>(() => {
  if (!versions.at.value) return "live";
  if (showDiff.value) return versions.diffState.value ? "version" : "reading";
  const got = versions.content.value;
  if (!got) return "reading";
  return got.found ? "version" : "unreadable";
});

const html = computed(() => {
  const got = versions.content.value;
  return isPage.value && got?.found ? got.content : undefined;
});

const gap = computed(() => {
  const got = versions.content.value;
  return got && !got.found ? GAP[got.reason] : "";
});

const docs = (): Document[] => frame.value?.docs() ?? [];
const anchor = useScrollAnchor({ frame: () => frame.value?.element(), marks: () => marks.value });
const notebook = useNotebook(() => (isNotebook.value ? slug : undefined));
useBrowserKeys();
useFrameFind(docs);

function onMarks(next: FrameMark[]): void {
  marks.value = next;
  measured.value = true;
}

function toSelection(hit: FrameHit): FrameSelection {
  return {
    bottom: hit.top + hit.height,
    left: hit.left + hit.width / 2,
    mark: {
      height: hit.height,
      key: hit.key,
      label: hit.label,
      left: hit.left,
      text: hit.text,
      top: hit.top,
      width: hit.width,
    },
    path: hit.path,
    quote: hit.text,
    top: hit.top,
  };
}

function bump(): void {
  anchor.hold();
  frameReady.value = false;
  edition.value += 1;
}

function closeInline(): void {
  awaiting.value = false;
  panel.value = undefined;
  frame.value?.clearPick();
}

function takePending(next: FramePending[]): void {
  pendingEdits.value = next.filter((edit) => !closedIds.has(edit.id));
}

function onReady(): void {
  frameReady.value = true;
  anchor.restore();
  awaiting.value = pendingEdits.value.length > 0;
  if (isNotebook.value && live.value) notebook.attach(docs());
}

// The comment popover and the edit panel both anchor to the pick, so only one may be open.
function openInline(): void {
  const hit = chrome.comment.pick.value;
  if (!hit || !isPage.value) return;
  chrome.comment.close();
  panel.value = toSelection(hit);
}

function onApplied(): void {
  awaiting.value = true;
  bump();
}

async function settle(action: "accept" | "revert", edit: FramePending): Promise<void> {
  const at = sc.slug.value;
  if (!at) return;
  anchor.hold();
  frameReady.value = false;
  try {
    await $fetch(`/api/artifacts/${at}/edit`, {
      body: { action, id: edit.id, path: edit.path },
      method: "POST",
    });
    closedIds.add(edit.id);
    pendingEdits.value = pendingEdits.value.filter((row) => row.id !== edit.id);
    if (!pendingEdits.value.length) closeInline();
    bump();
  } catch (error) {
    anchor.drop();
    frameReady.value = true;
    chrome.toast(failReason(error) ?? "That change could not be settled", "destructive");
  }
}

async function onDisk(): Promise<void> {
  const got = await $fetch<ArtifactDetail>(`/api/artifacts/${slug}`).catch(() => undefined);
  if (got && sc.slug.value === slug) sc.artifact.value = got;
  if (live.value) bump();
}

useArtifactChanges(
  () => (held.value ? slug : undefined),
  () => void onDisk(),
);

watch(
  () => web.edition,
  () => {
    if (shown.value) bump();
  },
);

watch([() => chrome.comment.pick.value, live, isPage], ([hit, on, page]) => {
  if (shown.value) inlineArmed.value = Boolean(hit) && on && page;
});

watch(inlineAsk, (ask) => {
  if (!ask) return;
  inlineAsk.value = false;
  openInline();
});

// Re-asserted after every pull, like the conversation key: the poll re-picks a slug whenever the held one is unknown.
watch(
  [() => conversation, () => slug, () => sc.sessions.value, shown],
  () => {
    if (!shown.value) return;
    sc.sessionKey.value = conversation;
    sc.slug.value = slug;
  },
  { immediate: true },
);

watch([() => sc.slug.value, () => versions.at.value], () => {
  marks.value = [];
  measured.value = false;
  panel.value = undefined;
  pendingEdits.value = [];
  awaiting.value = false;
  closedIds.clear();
  zoom.value = 1;
  anchor.drop();
  // Armed from the button, comment mode is sticky and global; the document it was armed against is gone.
  chrome.comment.disarm();
});

function onWin(event: KeyboardEvent): void {
  if (event.key !== "Escape" || !shown.value) return;
  const [edit] = pendingEdits.value;
  if (!edit) return;
  event.preventDefault();
  void settle("revert", edit);
}

onMounted(() => {
  window.addEventListener("keydown", onWin);
});

watch(
  () => slug,
  (_, left) => sides.leave(conversation, "artifact", left),
);

onScopeDispose(() => {
  window.removeEventListener("keydown", onWin);
  inlineArmed.value = false;
  chrome.comment.disarm();
  sides.leave(conversation, "artifact", slug);
});
</script>

<template>
  <div class="page" data-region="artifact-view" :data-media="!!media">
    <PreviewStage v-if="held && media" v-model:zoom="zoom" data-region="artifact-page" :kind="media" :src="mediaSrc" />

    <template v-else-if="held">
      <ArtifactVersions
        v-model="versions.at.value"
        :baseline="versions.baseline.value"
        :head="versions.head.value"
        :list="versions.list.value"
        :listed="versions.listed.value"
        :reading="versions.reading.value"
        :skipped="versions.skipped.value"
        :slug="slug"
        :unreachable="versions.unreachable.value"
      />

      <NotebookBar v-if="isNotebook && live" :view="notebook" />

      <CommentLayer
        v-slot="{ canAsk, inset }"
        :file="path"
        :live="live"
        :marks="marks"
        :ready="measured && !showDiff"
        :slug="slug"
        :threads="threads"
        @reload="bump"
      >
        <ArtifactDiff
          v-if="showDiff && stage === 'version'"
          data-region="artifact-page"
          :path="path!"
          :state="versions.diffState.value!"
        />

        <ArtifactFrame
          v-else-if="stage === 'live' || stage === 'version'"
          ref="frame"
          data-region="artifact-page"
          :can-ask="canAsk"
          :can-edit="isPage"
          :edition="edition"
          :file="path"
          :html="html"
          :inset="inset"
          :slug="slug"
          :src="versionSrc"
          :version="versions.at.value"
          @edit="openInline"
          @marks="onMarks"
          @pending="takePending"
          @ready="onReady"
        />

        <div v-if="stage === 'reading' || stage === 'unreadable'" class="gap" data-region="version-gap">
          <UiStateMessage v-if="stage === 'reading'" align="center" kind="loading">
            Reading turn {{ versions.at.value }}…
          </UiStateMessage>
          <UiStateMessage v-else align="center" kind="error">
            This version could not be read back. {{ gap }}.
            <template #action>
              <UiButton size="xs" variant="outline" @click="versions.at.value = undefined">Back to latest</UiButton>
            </template>
          </UiStateMessage>
        </div>

        <ArtifactInline
          v-if="panel"
          :held="awaiting || pendingEdits.length > 0"
          :live="live"
          :selection="panel"
          :slug="slug"
          @applied="onApplied"
          @done="closeInline"
        />

        <UiSurface
          v-for="edit in pendingEdits"
          :key="edit.id"
          class="settle"
          data-region="inline-panel"
          pad="none"
          variant="raised"
          :style="{ left: `${edit.left}px`, top: `${edit.top}px` }"
        >
          <UiIconButton :icon="Check" label="Keep the new text" size="xs" @click="settle('accept', edit)">
            Accept
          </UiIconButton>
          <UiIconButton :icon="RotateCcw" label="Restore the old text" size="xs" @click="settle('revert', edit)">
            Revert
          </UiIconButton>
        </UiSurface>
      </CommentLayer>
    </template>

    <div v-else-if="sc.missing.value === slug" class="blank">
      <UiStateMessage align="center" kind="error">
        <b>{{ slug }}</b> could not be read from the artifacts directory.
      </UiStateMessage>
      <slot name="blank" />
    </div>
    <UiStateMessage v-else align="center" class="opening" kind="loading">Reading the page…</UiStateMessage>
  </div>
</template>

<style scoped>
.page {
  @apply flex min-h-full w-full flex-col;
}

.page[data-media="true"] {
  @apply h-full min-h-0;
}

/* Only the artifact runs to the edges; its chrome insets itself. */
.page > :deep([data-region="version-tabs"]) {
  @apply mx-auto w-full max-w-(--page-w) px-(--gutter);
}

.gap,
.blank {
  @apply mx-auto w-full max-w-(--page-w) rounded-box border border-dashed border-border-strong bg-raised px-7 py-10 text-center typo-body-md text-muted;
}

.opening {
  @apply py-10;
}

.settle {
  @apply absolute z-28 inline-flex translate-x-2 -translate-y-1/2 items-center gap-0.5 px-1 py-0.5;
}
</style>

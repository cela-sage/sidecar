import type { ComputedRef, MaybeRefOrGetter, Ref } from "vue";
import type { MaybeComputed } from "~/composables/useSidecar";
import type { ArtifactMeta } from "~~/shared/types/artifact";
import { addressOf, isLocalPath } from "~~/lib/web/target";

export interface ArtifactAddressOptions {
  /** Puts the caret in the field once it shows, the address selected so typing replaces it. */
  focus: () => void;
  slug: MaybeRefOrGetter<string>;
}

export interface ArtifactAddress {
  address: ComputedRef<string>;
  cancel: () => void;
  commit: () => Promise<void>;
  draft: Ref<string>;
  edit: () => Promise<void>;
  host: ComputedRef<string>;
  isWeb: ComputedRef<boolean>;
  isEditing: Ref<boolean>;
  meta: MaybeComputed<ArtifactMeta>;
  openOut: () => Promise<void>;
  title: ComputedRef<string>;
}

export function useArtifactAddress({ focus, slug }: ArtifactAddressOptions): ArtifactAddress {
  const sc = useSidecar();
  const web = $web();
  const chrome = useChrome();
  const links = useLinks();
  const shown = useFaceShown();
  const isEditing = ref(false);
  const draft = ref("");

  const meta = computed(() => {
    const held = sc.artifact.value;
    return held?.slug === toValue(slug) ? held : sc.catalogue.value.find((one) => one.slug === toValue(slug));
  });
  const isWeb = computed(() => meta.value?.kind === "web");
  const path = computed(() => (isWeb.value ? "" : (meta.value?.path ?? "")));
  const address = computed(() => {
    if (isWeb.value) return web.page?.url ?? meta.value?.url ?? "";
    return path.value ? `file://${encodeURI(path.value)}` : "";
  });
  const host = computed(() => {
    if (!isWeb.value) return path.value ? homePath(path.value.slice(0, path.value.lastIndexOf("/"))) : "";
    return address.value ? new URL(address.value).host : "";
  });
  const title = computed(() => {
    if (!isWeb.value) return path.value ? basename(path.value) : "";
    return web.page?.title || meta.value?.title || (address.value ? Web.pageOf(address.value) : "");
  });

  async function edit(): Promise<void> {
    if (isWeb.value) draft.value = address.value ? Web.typed(address.value) : "";
    else draft.value = homePath(path.value);
    isEditing.value = true;
    await nextTick();
    focus();
  }

  function cancel(): void {
    isEditing.value = false;
  }

  // A file has no tab to navigate in place, so an address typed over one opens a Web artifact of its own.
  async function commit(): Promise<void> {
    const typed = draft.value.trim();
    isEditing.value = false;
    if (!typed) return;
    if (isLocalPath(typed)) return links.open(typed);
    const to = addressOf(typed);
    if (!to) return;
    if (!isWeb.value) return links.open(to.href);
    if (to.href !== address.value) web.visit(to);
  }

  // Chrome refuses a file:// address from the sidecar's page, so the server opens a file in its own app.
  async function openOut(): Promise<void> {
    if (isWeb.value) {
      if (address.value) window.open(address.value, "_blank", "noopener");
      return;
    }
    await $fetch(`/api/artifacts/${toValue(slug)}/outside`, { method: "POST" }).catch((error: unknown) =>
      chrome.toast(failReason(error) ?? "The file could not be opened outside the sidecar", "destructive"),
    );
  }

  watch(() => toValue(slug), cancel);
  watch(
    () => web.addressing,
    () => {
      if (shown.value) void edit();
    },
  );

  return { address, cancel, commit, draft, edit, host, isEditing, isWeb, meta, openOut, title };
}

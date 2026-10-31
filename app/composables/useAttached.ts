import { Paperclip } from "@lucide/vue";
import type { ComputedRef, Ref } from "vue";
import type { ComposerPieceItem } from "~/components/composer/input.vue";
import type { Attachment } from "~/utils/attachments";

export interface AttachedDraft {
  attach: (list: File[]) => void;
  clear: () => void;
  files: Ref<Attachment[]>;
  isPending: ComputedRef<boolean>;
  pieces: ComputedRef<ComposerPieceItem[]>;
  remove: (path: string) => void;
}

// An upload that resolves after its composer is gone must not keep a preview, since nothing would release it.
export const useAttached = (): AttachedDraft => {
  const chrome = useChrome();
  const files = ref<Attachment[]>([]);
  const pending = ref(0);
  let isGone = false;

  const pieces = computed<ComposerPieceItem[]>(() =>
    files.value.map((one) => ({ id: one.path, icon: Paperclip, label: one.name, preview: one.preview, tip: one.path })),
  );

  const upload = async (file: File): Promise<void> => {
    pending.value += 1;
    const got = await Attachments.upload(file).catch((error: unknown) => {
      chrome.toast(failReason(error) ?? `${file.name} did not attach`, "destructive");
      return undefined;
    });
    pending.value -= 1;
    if (!got) return;
    if (isGone) Attachments.release([got]);
    else files.value.push(got);
  };

  const attach = (list: File[]): void => {
    for (const file of list) void upload(file);
  };

  const remove = (path: string): void => {
    Attachments.release(files.value.filter((one) => one.path === path));
    files.value = files.value.filter((one) => one.path !== path);
  };

  const clear = (): void => {
    Attachments.release(files.value);
    files.value = [];
  };

  onScopeDispose(() => {
    isGone = true;
    clear();
  });

  return { attach, clear, files, isPending: computed(() => pending.value > 0), pieces, remove };
};

import type { ReviewThread } from "~~/shared/types/artifact";
import type { Answer } from "~/stores/task";

export interface TaskDecide {
  decide: (thread: ReviewThread, answer: Answer) => Promise<void>;
  isSending: Ref<boolean>;
}

export const useTaskDecide = (): TaskDecide => {
  const task = $task();
  const chrome = useChrome();
  const isSending = ref(false);

  async function decide(thread: ReviewThread, answer: Answer): Promise<void> {
    isSending.value = true;
    await task
      .decide(thread.id, answer)
      .then(({ told }) => {
        if (!told) chrome.toast("Decided. Whoever asked isn't running, so they read it in the history");
      })
      .catch((error: unknown) => chrome.toast(failReason(error) ?? "The decision didn't save", "destructive"));
    isSending.value = false;
  }

  return { decide, isSending };
};

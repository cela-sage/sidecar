import type { SidecarEvent } from "~~/shared/types/events";

const LOCK = "sidecar:task-notices";

export const useTaskNotices = (): void => {
  const task = $task();
  const isLeading = ref(false);

  function raise({ data }: SidecarEvent<"task.escalated">): void {
    if (!isLeading.value) return;
    const subtitle = data.kind === "hire" ? "A hire needs you" : "Needs you";
    if ("Notification" in window && Notification.permission === "granted") {
      const notice = new Notification(`${subtitle} · ${data.title}`, { body: data.question, tag: data.thread });
      notice.onclick = () => {
        window.focus();
        notice.close();
        task.show({ slug: data.slug });
      };
      return;
    }
    void $fetch(`/api/tasks/${encodeURIComponent(data.slug)}/notify`, {
      method: "POST",
      body: { subtitle, text: data.question },
    }).catch(() => undefined);
  }

  onMounted(() => {
    if (!navigator.locks) isLeading.value = true;
    else
      void navigator.locks.request(LOCK, () => {
        isLeading.value = true;
        return new Promise<void>(() => undefined);
      });
    if ("Notification" in window && Notification.permission === "default")
      void Notification.requestPermission().catch(() => undefined);
  });

  useEvents().on("task.escalated", raise);
};

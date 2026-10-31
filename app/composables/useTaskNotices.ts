import type { SidecarEvent } from "~~/shared/types/events";

const LOCK = "sidecar:task-notices";

interface Notice {
  slug: string;
  subtitle: string;
  title: string;
  text: string;
  tag: string;
  open: () => void;
}

export const useTaskNotices = (): void => {
  const channel = $channel();
  const boss = $bossNotice();
  const isLeading = ref(false);

  const notify = ({ slug, subtitle, title, text, tag, open }: Notice): void => {
    if (!isLeading.value) return;
    if ("Notification" in window && Notification.permission === "granted") {
      const notice = new Notification(`${subtitle} · ${title}`, { body: text, tag });
      notice.onclick = () => {
        window.focus();
        notice.close();
        open();
      };
      return;
    }
    void $fetch(`/api/tasks/${encodeURIComponent(slug)}/notify`, { method: "POST", body: { subtitle, text } }).catch(
      () => undefined,
    );
  };

  const escalated = ({ data }: SidecarEvent<"task.escalated">): void =>
    notify({
      slug: data.slug,
      subtitle: data.kind === "hire" ? "A hire needs you" : "Needs you",
      title: data.title,
      text: data.question,
      tag: data.thread,
      open: () => channel.land({ slug: data.slug, tab: "document" }),
    });

  // A window in front shows the raise as its own notice, with Reply, so the system one is only for an app in the back.
  const raised = ({ data }: SidecarEvent<"channel.raised">): void => {
    if (document.hasFocus()) return;
    notify({
      slug: data.slug,
      subtitle: "@boss",
      title: data.title,
      text: data.text,
      tag: data.post,
      open: () => boss.open(data),
    });
  };

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

  useEvents().on("task.escalated", escalated);
  useEvents().on("channel.raised", raised);
};

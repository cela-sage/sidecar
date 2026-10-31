import type { Channel } from "~~/shared/types/channel";
import type { ChannelRaised, SidecarEvent, Topics } from "~~/shared/types/events";
import type { Segment, Speaker } from "~/utils/channel-cast";

export type NoticePhase = "shown" | "replying" | "sending";

export interface BossNotice {
  raise: ChannelRaised;
  at: string;
  from: Speaker;
  segments: Segment[];
  project?: string;
  phase: NoticePhase;
}

export const $bossNotice = defineStore(() => {
  const sc = useSidecar();
  const task = $task();
  const channel = $channel();
  const chrome = useChrome();
  const notice = ref<BossNotice>();
  const draft = ref("");

  const isInView = (slug: string): boolean =>
    task.slug === slug && channel.tab === "messages" && document.visibilityState === "visible" && document.hasFocus();

  const stillRaised = async ({ slug, post }: ChannelRaised): Promise<Channel | undefined> => {
    const room = await channel.read(slug).catch(() => undefined);
    return room?.raised.includes(post) ? room : undefined;
  };

  const isShowing = (raise: ChannelRaised): boolean => notice.value?.raise.post === raise.post;

  const dismiss = (): void => {
    notice.value = undefined;
    draft.value = "";
  };

  // The bus replays what it missed after a reconnect, so a raise is shown only while the channel still holds it.
  const hear = async ({ data: raise, at }: SidecarEvent<"channel.raised">): Promise<void> => {
    if (isInView(raise.slug)) return;
    const room = await stillRaised(raise);
    if (!room || (notice.value && notice.value.phase !== "shown")) return;
    const cast = ChannelCast.castOf(room, sc.sessions.value);
    const meta = Tasks.of(sc.catalogue.value).find((one) => one.slug === raise.slug);
    const project = task.projects.find((one) => one.key === meta?.task.project)?.name;
    notice.value = {
      raise,
      at,
      from: ChannelCast.speaker(cast, raise.from),
      segments: ChannelCast.segmentsOf(raise.text, cast),
      phase: "shown",
      ...(project ? { project } : {}),
    };
    draft.value = "";
  };

  const settle = async ({ slug, raised }: Topics["channel.changed"]): Promise<void> => {
    const was = notice.value;
    if (!was || was.raise.slug !== slug || was.phase === "sending") return;
    if (raised && (await stillRaised(was.raise))) return;
    if (isShowing(was.raise)) dismiss();
  };

  const reply = (): void => {
    if (notice.value) notice.value = { ...notice.value, phase: "replying" };
  };

  const open = (raise: ChannelRaised | undefined = notice.value?.raise): void => {
    if (!raise) return;
    if (isShowing(raise)) dismiss();
    channel.land({ slug: raise.slug, thread: raise.post });
  };

  const send = async (): Promise<void> => {
    const was = notice.value;
    const text = draft.value.trim();
    if (!was || was.phase === "sending" || !text) return;
    notice.value = { ...was, phase: "sending" };
    const { slug, post, from } = was.raise;
    const sent = await channel.send({ slug, text, thread: post }).catch((error: unknown) => {
      chrome.toast(failReason(error) ?? `Could not reply to ${was.from.name}`, "destructive");
      return undefined;
    });
    if (!isShowing(was.raise)) return;
    if (!sent) {
      notice.value = { ...was, phase: "replying" };
      return;
    }
    dismiss();
    const name = was.from.name;
    chrome.notify({
      text: sent.reach.notified.includes(from) ? `Replied in ${name}'s thread. ${name} picked it up` : `Replied in ${name}'s thread`,
      action: "Open",
      tip: "Open the thread",
      open: () => open(was.raise),
    });
  };

  return { dismiss, draft, hear, notice, open, reply, send, settle };
});

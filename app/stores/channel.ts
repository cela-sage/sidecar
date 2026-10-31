import { useLocalStorage } from "@vueuse/core";
import type { Channel, ChannelPost } from "~~/shared/types/channel";
import type { Topics } from "~~/shared/types/events";
import type { ComposerRoster } from "~/components/composer/input.vue";
import type { Cast } from "~/utils/channel-cast";
import type { ChannelTab } from "~/utils/channel-view";

export interface Landing {
  slug: string;
  tab?: ChannelTab;
  thread?: string;
}

export interface PostInput {
  slug: string;
  text: string;
  thread?: string;
}

export const $channel = defineStore(() => {
  const sc = useSidecar();
  const task = $task();
  const busy = $busy();
  const chrome = useChrome();
  const room = ref<Channel>();
  const tab = ref<ChannelTab>("messages");
  const thread = ref<string>();
  const pair = ref<string>();
  const since = ref<string>();
  const isSending = ref(false);
  const seen = useLocalStorage<Record<string, string>>("sc:channel-seen", {});
  let landing: Landing | undefined;
  let isFirstRead = false;

  const cast = computed<Cast>(() => (room.value ? ChannelCast.castOf(room.value, sc.sessions.value) : new Map()));

  const working = computed(() => {
    const doing = Object.entries(busy.keys).flatMap(([key, one]) => (one.doing ? [key] : []));
    const busyNow = room.value?.members.flatMap((one) => (one.status === "busy" ? [one.key] : [])) ?? [];
    return new Set([...doing, ...busyNow]);
  });

  const roster = computed<ComposerRoster | undefined>(() => {
    const channel = room.value;
    if (!channel) return undefined;
    return {
      offer: (query) => ChannelPicker.offer({ channel, cast: cast.value, query, busy: working.value }),
      tones: (text) => ChannelCast.tonesOf(text, cast.value),
    };
  });

  const read = (slug: string): Promise<Channel> => $fetch<Channel>(`/api/tasks/${encodeURIComponent(slug)}/channel`);

  const send = ({ slug, text, thread: root }: PostInput): Promise<ChannelPost> =>
    $fetch<ChannelPost>(`/api/tasks/${encodeURIComponent(slug)}/channel`, {
      method: "POST",
      body: { text, ...(root ? { thread: root } : {}) },
    });

  const markSeen = (): void => {
    const latest = room.value && ChannelView.latestOf(room.value);
    if (room.value && latest && tab.value === "messages") seen.value = { ...seen.value, [room.value.slug]: latest };
  };

  const load = async (): Promise<void> => {
    const at = task.slug;
    if (!at) return;
    const got = await read(at).catch(() => undefined);
    if (task.slug !== at || !got) return;
    room.value = got;
    if (thread.value) thread.value = ChannelView.rootOf(got, thread.value);
    if (isFirstRead && !ChannelView.firstNewOf(got, since.value)) since.value = ChannelView.latestOf(got);
    isFirstRead = false;
    markSeen();
  };

  const arrive = (slug: string): void => {
    const wanted = landing?.slug === slug ? landing : undefined;
    landing = undefined;
    tab.value = wanted?.tab ?? ChannelView.tabFor(Tasks.of(sc.catalogue.value).find((one) => one.slug === slug));
    thread.value = wanted?.thread;
    pair.value = undefined;
    since.value = seen.value[slug];
    isFirstRead = true;
    if (room.value?.slug !== slug) room.value = undefined;
    void load();
  };

  const land = (to: Landing): void => {
    landing = to;
    if (task.slug === to.slug) arrive(to.slug);
    else task.show({ slug: to.slug });
  };

  const post = async (text: string, root?: string): Promise<boolean> => {
    const slug = task.slug;
    if (!slug || isSending.value || !text.trim()) return false;
    isSending.value = true;
    const sent = await send({ slug, text, ...(root ? { thread: root } : {}) }).then(
      () => true,
      (error: unknown) => {
        chrome.toast(failReason(error) ?? "Could not post in the channel", "destructive");
        return false;
      },
    );
    isSending.value = false;
    if (sent) await load();
    return sent;
  };

  const heard = ({ slug }: Topics["channel.changed"]): void => {
    if (slug === task.slug) void load();
  };

  watch(
    () => task.slug,
    (slug) => {
      if (slug) arrive(slug);
      else room.value = undefined;
    },
    { immediate: true },
  );
  watch(tab, markSeen);

  return { cast, heard, isSending, land, load, pair, post, read, room, roster, send, since, tab, thread };
});

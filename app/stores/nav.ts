import type { NavHistory, Place } from "~/utils/nav";

type Kind = Place["kind"];
type PlaceOf<K extends Kind> = Extract<Place, { kind: K }>;

export const $nav = defineStore(() => {
  const sc = useSidecar();
  const task = $task();
  const channel = $channel();
  const history = ref<NavHistory>(Nav.empty);

  const here = computed((): Place | undefined => {
    if (task.slug) return { kind: "channel", slug: task.slug, ...(channel.thread ? { thread: channel.thread } : {}) };
    return sc.sessionKey.value ? { kind: "conversation", key: sc.sessionKey.value } : undefined;
  });

  const exists = (place: Place): boolean =>
    place.kind === "conversation"
      ? sc.sessions.value.some((one) => one.key === place.key)
      : Tasks.of(sc.catalogue.value).some((one) => one.slug === place.slug);

  const GO: { [K in Kind]: (place: PlaceOf<K>) => void } = {
    conversation: ({ key }) => {
      task.close();
      if (key === sc.sessionKey.value) return;
      sc.sessionKey.value = key;
      void navigateTo(`/c/${key}`, { replace: true });
    },
    channel: ({ slug, thread }) => channel.land({ slug, ...(thread ? { thread } : {}) }),
  };

  const goTo = <K extends Kind>(kind: K, place: PlaceOf<K>): void => GO[kind](place);

  const go = (place: Place): void => goTo(place.kind, place);

  const labelOf = (place: Place): string => {
    if (place.kind === "channel") return `#${place.slug}`;
    const session = sc.sessions.value.find((one) => one.key === place.key);
    return session ? (session.agent?.name ?? nameOf(session)) : place.key;
  };

  const back = computed(() => Nav.step(history.value, -1, exists));
  const forward = computed(() => Nav.step(history.value, 1, exists));

  const move = (by: 1 | -1): void => {
    const stop = by < 0 ? back.value : forward.value;
    if (!stop) return;
    history.value = { ...history.value, at: stop.at };
    go(stop.place);
  };

  watch(
    here,
    (place) => {
      if (place) history.value = Nav.visit(history.value, place);
    },
    { immediate: true },
  );

  return { back, forward, go, labelOf, move };
});

import type { MaybeRefOrGetter } from "vue";
import z from "zod";

const Change = z.object({ hash: z.string() });

export function useArtifactChanges(slug: MaybeRefOrGetter<string | undefined>, onChange: () => void): void {
  let source: EventSource | undefined;
  let known: string | undefined;

  const take = (message: MessageEvent<string>): void => {
    const hash = Change.safeParse(JSON.parse(message.data)).data?.hash;
    if (!hash) return;
    if (known && hash !== known) onChange();
    known = hash;
  };

  watch(
    () => toValue(slug),
    (at) => {
      source?.close();
      source = undefined;
      known = undefined;
      if (!at) return;
      source = new EventSource(`/api/artifacts/${encodeURIComponent(at)}/stream`);
      source.addEventListener("ready", take);
      source.addEventListener("changed", take);
    },
    { immediate: true },
  );
  onScopeDispose(() => source?.close());
}

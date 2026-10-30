import type { ComputedRef } from "vue";
import type { MaybeComputed } from "~/composables/useSidecar";
import type { LiveSession, SessionState } from "~~/shared/types/session";

export interface Screen {
  session: MaybeComputed<LiveSession>;
  sessionState: ComputedRef<SessionState>;
}

/** Never the raw key while anything more human is on hand — the id is the last resort. */
export function nameOf(session: LiveSession): string {
  return session.name || basename(session.cwd) || session.key;
}

export function ageOf(session: LiveSession): string {
  return relativeAge(session.lastActive ? new Date(session.lastActive).toISOString() : undefined);
}

export function placeOf(session: LiveSession): string {
  return [homePath(session.cwd), session.gitBranch].filter(Boolean).join(" · ");
}

export function useScreen(): Screen {
  const sc = useSidecar();

  const session = computed(() => sc.sessions.value.find((s) => s.key === sc.sessionKey.value));

  // A live process that has not reported a status yet is treated as idle rather than guessed busy.
  const sessionState = computed<SessionState>(() => {
    const here = session.value;
    if (here?.life !== "alive") return "gone";
    return here.status ?? "idle";
  });

  return { session, sessionState };
}

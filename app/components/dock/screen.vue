<script lang="ts" setup>
import "@xterm/xterm/css/xterm.css";
import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { Terminal, type ITheme } from "@xterm/xterm";
import { useDebounceFn, useResizeObserver } from "@vueuse/core";
import type { DockTab } from "~~/shared/types/dock";

const { isShown, tab } = defineProps<{ isShown: boolean; tab: DockTab }>();

type Link = "connecting" | "open" | "closed";
type Sent = { kind: "input"; data: string } | { kind: "resize"; cols: number; rows: number };

const dock = $dock();
const host = useTemplateRef<HTMLElement>("host");
const link = ref<Link>("connecting");
const fit = new FitAddon();
let socket: WebSocket | undefined;
let term: Terminal | undefined;

const send = (message: Sent): void => {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
};

const socketUrl = (): string => {
  const url = new URL(`/api/dock/${encodeURIComponent(tab.id)}`, location.href);
  url.protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
};

const themeOf = (el: HTMLElement): ITheme => {
  const style = getComputedStyle(el);
  const token = (name: string): string => style.getPropertyValue(`--${name}`).trim();
  return {
    background: token("raised"),
    foreground: token("ink"),
    cursor: token("primary"),
    cursorAccent: token("raised"),
    selectionBackground: token("primary-soft"),
    black: token("sunken"),
    brightBlack: token("subtle"),
    red: token("error"),
    brightRed: token("error"),
    green: token("success"),
    brightGreen: token("success"),
    yellow: token("warning"),
    brightYellow: token("warning"),
    blue: token("info"),
    brightBlue: token("info"),
    magenta: token("accent"),
    brightMagenta: token("primary"),
    cyan: token("primary-deep"),
    brightCyan: token("primary-deep"),
    white: token("muted"),
    brightWhite: token("ink"),
  };
};

// The dock's own keys, which the shell would otherwise also receive as an escape sequence.
const isDockKey = (event: KeyboardEvent): boolean =>
  (event.altKey && event.key === "F12") || (event.metaKey && event.key.toLowerCase() === "t");

const settle = (): void => {
  if (!term || !isShown) return;
  fit.fit();
  dock.size = { cols: term.cols, rows: term.rows };
};

onMounted(() => {
  const el = host.value;
  if (!el) return;
  term = new Terminal({
    allowProposedApi: true,
    cursorBlink: true,
    fontFamily: getComputedStyle(el).fontFamily,
    fontSize: 12,
    macOptionIsMeta: true,
    theme: themeOf(el),
  });
  term.loadAddon(fit);
  term.loadAddon(new Unicode11Addon());
  term.unicode.activeVersion = "11";
  term.open(el);
  settle();

  socket = new WebSocket(socketUrl());
  socket.addEventListener("open", () => {
    link.value = "open";
    if (term) send({ kind: "resize", cols: term.cols, rows: term.rows });
  });
  socket.addEventListener("close", () => (link.value = "closed"));
  socket.addEventListener("message", (event: MessageEvent<string>) => term?.write(event.data));
  term.attachCustomKeyEventHandler((event) => !isDockKey(event));
  term.onData((data) => send({ kind: "input", data }));
  term.onBinary((data) => send({ kind: "input", data }));
  term.onResize(({ cols, rows }) => send({ kind: "resize", cols, rows }));
  if (isShown) term.focus();
});

watch(
  () => isShown,
  async (now) => {
    if (!now) return;
    await nextTick();
    settle();
    term?.focus();
  },
);

// Each fit reflows the whole buffer, and one per drag frame overruns xterm's idle deadline.
useResizeObserver(host, useDebounceFn(settle, 80));

onBeforeUnmount(() => {
  socket?.close();
  term?.dispose();
});
</script>

<template>
  <div v-show="isShown" class="screen" :data-link="link">
    <div ref="host" class="host" />
  </div>
</template>

<style scoped>
.screen {
  @apply flex h-full min-h-0 flex-col overflow-hidden;
}

.host {
  @apply min-h-0 flex-1 bg-raised px-4 py-2.5 font-mono;
}

.screen[data-link="closed"] .host {
  @apply opacity-60;
}
</style>

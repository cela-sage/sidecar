import { Terminal } from "~~/server/utils/terminal";
import type { TerminalState } from "~~/shared/types/events";

export default defineEventHandler((): TerminalState => Terminal.state());

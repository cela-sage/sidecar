import type { ArtifactEditAction } from "../../../shared/types/artifact.ts";
import { applyArtifactEdit, resolveArtifactEdit, type ArtifactEditFail, type ArtifactEditOutcome } from "./html.ts";
import { MarkdownEdits } from "./markdown.ts";

export type EditFormat = "html" | "md";

export type EditOutcome = { id?: string; ok: true; text: string } | { ok: false; reason: ArtifactEditFail };

export interface EditInput {
  action: ArtifactEditAction;
  id: string;
  path: string;
  replacement: string;
  selection: string;
  text: string;
}

const textOf = (outcome: ArtifactEditOutcome): EditOutcome =>
  outcome.ok ? { id: outcome.id, ok: true, text: outcome.html } : outcome;

const ENGINES: Record<EditFormat, (input: EditInput) => EditOutcome> = {
  html: (input) =>
    textOf(
      input.action === "apply"
        ? applyArtifactEdit({
            html: input.text,
            path: input.path,
            replacement: input.replacement,
            selection: input.selection,
          })
        : resolveArtifactEdit({ action: input.action, html: input.text, id: input.id, path: input.path }),
    ),
  md: (input) =>
    input.action === "apply"
      ? MarkdownEdits.apply({ replacement: input.replacement, selection: input.selection, text: input.text })
      : MarkdownEdits.resolve({ action: input.action, id: input.id, text: input.text }),
};

const FAILURES: Record<EditFormat, Record<ArtifactEditFail, string>> = {
  html: {
    ambiguous: "That path matches more than one element",
    invalid: "invalid edit",
    "not-found": "That element is not on the page",
    stale: "The element's text has changed",
  },
  md: {
    ambiguous: "That paragraph appears more than once",
    invalid: "invalid edit",
    "not-found": "That edit is not on the page",
    stale: "The paragraph has changed",
  },
};

export const Edits = {
  failure: (format: EditFormat, reason: ArtifactEditFail): string => FAILURES[format][reason],
  run: (format: EditFormat, input: EditInput): EditOutcome => ENGINES[format](input),
};

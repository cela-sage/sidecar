import type { ArtifactTask } from "../../../shared/types/task.ts";
import { pageCss } from "./css.ts";
import { bodyOf, escapeHtml } from "./render.ts";

export const Markdown = {
  body: bodyOf,

  async page({ ds, markdown, task, title }: Markdown.Page): Promise<string> {
    return Markdown.document({ body: await bodyOf(markdown, task), ds, task, title });
  },

  document({ body, css = "", ds, task, title }: Markdown.Document): string {
    const system = ds ? ` data-ds="${escapeHtml(ds)}"` : "";
    const marked = task ? ` data-task="${task.state}"` : "";
    return [
      "<!doctype html>",
      `<html lang="en" data-theme="light"${system}>`,
      "<head>",
      '<meta charset="utf-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1">',
      `<title>${escapeHtml(title)}</title>`,
      `<style>${pageCss()}\n${css}</style>`,
      "</head>",
      `<body><main class="page"${marked}>${body}</main></body>`,
      "</html>",
    ].join("\n");
  },

  escape: escapeHtml,
};

export namespace Markdown {
  export interface Page {
    ds?: string;
    markdown: string;
    task?: ArtifactTask;
    title: string;
  }

  export interface Document {
    body: string;
    css?: string;
    ds?: string;
    task?: ArtifactTask;
    title: string;
  }
}

import z from "zod";

const Lines = z.union([z.string(), z.array(z.string())]);
const Bundle = z.record(z.string(), z.unknown());

const Stream = z.looseObject({ output_type: z.literal("stream"), name: z.string(), text: Lines });
const Display = z.looseObject({ output_type: z.literal("display_data"), data: Bundle, metadata: Bundle.optional() });
const Result = z.looseObject({
  output_type: z.literal("execute_result"),
  data: Bundle,
  metadata: Bundle.optional(),
  execution_count: z.number().nullable(), // external contract: nbformat
});
const Failure = z.looseObject({
  output_type: z.literal("error"),
  ename: z.string(),
  evalue: z.string(),
  traceback: z.array(z.string()),
});
// A kind a newer kernel adds is kept as written and drawn as nothing, rather than failing the whole notebook.
const Unknown = z.looseObject({ output_type: z.string() });
const Known = z.union([Stream, Display, Result, Failure]);
const Output = z.union([Known, Unknown]);

const Code = z.looseObject({
  cell_type: z.literal("code"),
  id: z.string().optional(),
  source: Lines,
  outputs: z.array(Output).default([]),
  execution_count: z.number().nullable().default(null), // external contract: nbformat
});
const Prose = z.looseObject({
  cell_type: z.enum(["markdown", "raw"]),
  id: z.string().optional(),
  source: Lines,
  attachments: z.record(z.string(), Bundle).optional(),
});

const Schema = z.looseObject({
  cells: z.array(z.union([Code, Prose])),
  metadata: z
    .looseObject({
      title: z.string().optional(),
      kernelspec: z.looseObject({ name: z.string(), language: z.string().optional() }).optional(),
      language_info: z.looseObject({ name: z.string() }).optional(),
    })
    .default({}),
  nbformat: z.number(),
  nbformat_minor: z.number(),
});

export type Notebook = z.infer<typeof Schema>;
export type NotebookCell = Notebook["cells"][number];
export type CodeCell = z.infer<typeof Code>;
export type NotebookOutput = z.infer<typeof Output>;
export type KnownOutput = z.infer<typeof Known>;

export const NotebookFormat = {
  parse(text: string): Notebook | undefined {
    try {
      return Schema.safeParse(JSON.parse(text)).data;
    } catch {
      return undefined;
    }
  },

  // Jupyter writes one space of indent and a trailing newline, so a run leaves a diff of the cell it ran.
  write(notebook: Notebook): string {
    return `${JSON.stringify(notebook, undefined, 1)}\n`;
  },

  textOf(lines: string | string[]): string {
    return Array.isArray(lines) ? lines.join("") : lines;
  },

  linesOf(text: string): string[] {
    return text.split(/(?<=\n)/);
  },

  // Cells before nbformat 4.5 carry no id, so their place stands in for one.
  keyOf(cell: NotebookCell, index: number): string {
    return cell.id ?? `cell-${index}`;
  },

  isCode(cell: NotebookCell): cell is CodeCell {
    return cell.cell_type === "code";
  },

  known(output: NotebookOutput): KnownOutput | undefined {
    return Known.safeParse(output).data;
  },

  kernelOf(notebook: Notebook): string {
    return notebook.metadata.kernelspec?.name ?? "python3";
  },

  languageOf(notebook: Notebook): string {
    return notebook.metadata.language_info?.name ?? notebook.metadata.kernelspec?.language ?? "python";
  },

  titleOf(notebook: Notebook): string | undefined {
    if (notebook.metadata.title) return notebook.metadata.title;
    const first = notebook.cells.find((cell) => cell.cell_type === "markdown");
    return first && /^#[ \t]+(.+?)[ \t#]*$/m.exec(NotebookFormat.textOf(first.source))?.[1];
  },
};

export interface SessionModel {
  id: string;
  name: string;
  about?: string;
}

export interface ModelFamily {
  family: string;
  models: SessionModel[];
}

const CURRENT: SessionModel[] = [
  { id: "claude-fable-5-1", name: "Fable 5.1", about: "The most capable, slower" },
  { id: "claude-opus-5-5", name: "Opus 5.5", about: "Hard, long tasks · default" },
  { id: "claude-sonnet-5-5", name: "Sonnet 5.5", about: "Fast, for everyday work" },
  { id: "claude-haiku-5-5", name: "Haiku 5.5", about: "Fastest, for quick edits" },
];

const OLDER: ModelFamily[] = [
  { family: "Fable", models: [{ id: "claude-fable-5", name: "Fable 5" }] },
  {
    family: "Opus",
    models: [
      { id: "claude-opus-5", name: "Opus 5" },
      { id: "claude-opus-4-8", name: "Opus 4.8" },
      { id: "claude-opus-4-7", name: "Opus 4.7" },
    ],
  },
  {
    family: "Sonnet",
    models: [
      { id: "claude-sonnet-5", name: "Sonnet 5" },
      { id: "claude-sonnet-4-6", name: "Sonnet 4.6" },
    ],
  },
  { family: "Haiku", models: [{ id: "claude-haiku-4-5", name: "Haiku 4.5" }] },
];

const known = new Map([...CURRENT, ...OLDER.flatMap((one) => one.models)].map((one) => [one.id, one.name]));

const nameOf = (id: string): string => known.get(id) ?? id;

export const SessionModels = { current: CURRENT, older: OLDER, nameOf };

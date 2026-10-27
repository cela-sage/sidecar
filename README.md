# sidecar

**A local app beside a Claude Code conversation, where you read what Claude makes, comment on any block of it and send the notes back.**

It is two things in one plugin. The Nuxt app at the root of this repo is the sidecar itself: the conversations, the Artifacts face with its comment layer, Web artifacts, Review, Files and History. The Claude Code mod in `hooks/` keeps the sidecar on the conversation you are in, gives the session `/sidecar`, keeps the review that Review shows, and tells Claude the sidecar is there.

---

## Install

You need Node 24 or newer. Claude Code loads any directory under `~/.claude/skills/` as a plugin, so point that name at a clone and set it up:

```bash
git clone git@github.com:cela-sage/sidecar.git ~/src/sidecar
ln -s ~/src/sidecar ~/.claude/skills/sidecar
cd ~/src/sidecar
pnpm install
bin/sidecar setup
```

`sidecar setup` asks how the sidecar runs, as a desktop app or a webapp in Chrome, records the node it ran on in `~/.claude/sidecar/node` for a Claude Code started outside an nvm shell, and starts it. Open a new conversation and `/sidecar` is there.

## What Claude is told

While the plugin is installed, the mod adds one section to every system prompt, from `rules/sidecar.md`: the sidecar is installed, pages and documents written for you to read go into `~/.claude/sidecar/artifacts/` as `<slug>.html` or `<slug>.md`, the chat reply says only what Claude did while any explanation goes there as a `.md`, a message opening on a `[[sidecar]]` line is you writing from the sidecar, and a page's open threads are read with `sidecar comments <slug>` before it changes. Uninstalling the plugin takes the section away, and nothing is written into anyone's `CLAUDE.md` or rules.

## The CLI

`bin/sidecar` is the sidecar's CLI, and `/sidecar` is that CLI inside a Claude Code session with the session's id in `CLAUDE_CODE_SESSION_ID`, so `/sidecar stop` is `sidecar stop`:

```sh
sidecar             # same as open
sidecar open [key]  # start it when down, point it at the conversation, raise an open sidecar or open one
sidecar open --artifact <slug|url>  # the same, showing that page or address in Artifacts
sidecar comments <slug>  # a page's threads; --reply <n> "..." answers one, --resolve <n> "..." closes it
sidecar task <slug> [verb]  # a task's lane: state, assign, escalate, hire, judge, decide, done; bare prints where it stands
sidecar terminal    # run once in the terminal you use for Claude Code, so Attach in the sidecar opens a conversation there
sidecar setup [desktop|web]  # choose how it runs and set it up; prompts on first run
sidecar publish <topic> <json>  # append an event every open sidecar hears
sidecar status      # whether it is up and where
sidecar start       # build it, then start it in the background, waiting until it answers
sidecar stop        # wherever it was started from, a terminal's pnpm dev included
sidecar restart     # stop, build and start, which is how a change to the sidecar goes live
sidecar update      # pull the latest sidecar on the branch and rebuild your surface, leaving a running app open
sidecar import      # re-read Chrome's cookies into the desktop app, with the app closed
sidecar uninstall   # remove the desktop app and all its data, back to a clean slate
```

It runs from a production build in `.output`, because `nuxt dev` holds about 2.5 GB more for its
bundler, so an edit to the sidecar shows up only after `sidecar restart`. To work on it with hot
reload, run `sidecar stop` and then `pnpm dev`, and `sidecar restart` brings the build back.

The conversation `open` points at is the key given, else the Claude Code session it runs in, read
from `CLAUDE_CODE_SESSION_ID`; from a plain terminal it just opens the app. It serves
`http://sidecar.localhost:4747` unless `SIDECAR_URL` says otherwise and logs to
`~/.claude/sidecar/server.log`. Stop only signals a server that answers as the sidecar, so another app
on the port is left alone. The sidecar starts when you run `sidecar`, `/sidecar` or `open`, which
brings it up when it is down, so nothing runs it at login.

| It resolves           | In this order                                                           |
| --------------------- | ----------------------------------------------------------------------- |
| Where artifacts live  | `NOTES_ARTIFACTS`, then `~/.claude/sidecar/artifacts`                   |
| Who a comment is from | The `user` key in `~/.claude/sidecar/config.json`, defaulting to "User" |
| What runs a notebook  | `SIDECAR_PYTHON`, then `python3`                                        |
| What a task's on      | `projects` in `~/.claude/sidecar/config.json`, then the five lanes      |

## Artifacts and their comments

Every page in the artifacts folder lists in the Artifacts face, a `.html`, a `.md` or a `.ipynb` notebook, and
each conversation shows the pages it wrote, read off `~/.claude/artifacts/session-<key>`, the list a
conversation's writes are recorded in. A page that list records for the first time while the sidecar is
running gets a toast that opens it. A page carries a comment layer, and a `.md` is commented in the sidecar,
which keeps its threads in one trailing `<!-- rv:seed -->` comment, or in `~/.claude/sidecar/comments/` for a
`.md` outside the folder and for a notebook or an image anywhere. `sidecar comments <slug>` prints the threads
and answers them, and picks up a page's Save from `~/Downloads` when no sidecar is running.

An open artifact follows its file. The sidecar keeps one watch per open file and draws the page again when
what it renders changes, putting the block that was at the top of the pane back where it was, so Claude
rewriting a plan you are reading leaves you on the same paragraph. A comment written into a page's own seed,
or a write the sidecar made itself, never reloads it.

Every artifact sits in the same browser frame. The address island in the middle shows a site's title and
host, or a file's name and folder, and ⌘L edits it: an address or a search opens a site, and `~/…`, `/…` or
`file:///…` opens the file, which Open a URL above the list takes as well. Back, forward and reload show only
for a site, since a file refreshes itself, and ⌘R reads either again. Hovering a link shows where it goes in
the bottom left corner, the path as `~/…` for a file, cut in the middle when it is long so the host and the
file name both stay in view. Resting on a web link for a moment grows that address into a card with the
page's title, description, image and site, read off its head by `/api/web/preview`, which a remote page's
link to this machine never reaches, the same line the proxy draws. The open-outside action sends a site to your browser and a file to its own app.
Fullscreen hides the bar until the pointer reaches the top edge of the window, and keeps it while you type in
it, find, or have the list open.

## Notebooks

A `.ipynb` renders as a page: Markdown cells through the sidecar's Markdown, code highlighted, and the outputs
Jupyter would draw, tables, images, text and tracebacks in their colours. A bar above it shows the kernel with
Run all, Interrupt and Restart, and each code cell has its own run button. The first run starts
`python3 -m jupyter_server` on 127.0.0.1 with a random token, so the Python it uses needs `jupyter_server` and
`ipykernel` (`pip install jupyter_server ipykernel`), and then one kernel per notebook in the notebook's own
folder. Outputs stream into the page as they arrive, and each finished cell's outputs and count are written back
into the `.ipynb` the way Jupyter saves, so they survive a reload and Claude can read what ran. A failing cell
cancels the cells queued after it. The Jupyter server stops with the sidecar, and stops itself after an hour
idle if the sidecar died first. In Files a notebook previews without its run buttons.

`sidecar open --artifact localhost:3000/guide`, or any http or https address, opens a live site the same
way: the sidecar serves it through a local proxy that adds the comment layer, keeps the Web artifact in
`~/.claude/sidecar/web/`, and `sidecar comments` answers its threads like a page's. A Web artifact is a
tab, and every Web artifact is a tab of the same browser. Open a URL always makes a new one, and inside it
links, redirects, forms and the address bar go to any site in place, with back and forward walking through
all of them. Every site gets one host of its own under the sidecar's, such as
`www.reddit.com.https.sidecar.localhost`, the same in every artifact, so a site's cookies are shared by its
other hosts as in a tab, cross-site scripts and their CORS answers work, and a sign-in, a solved captcha or
anything a site stores carries from one Web artifact to the next. Cookies and storage last across
conversations and restarts. Text that isn't an address searches Google, in Open a URL and in the address
bar alike. `sidecar open --artifact <url>` and a link clicked in the sidecar reuse the conversation's
artifact already opened on or showing that address, so Claude opening localhost:3000 every turn doesn't
pile up copies. The proxy sends each request as a browser tab would rather than as a framed page, while a
frame a site makes inside its own page still reaches the site as a frame, which claude.ai's artifacts
need, and a sign-in popup such as Google's is told and answered at the site's real address. A site can
never navigate the sidecar window itself, and a page reaches no host closer to this machine than its own,
so a remote site can't call localhost or the local network through it, the way Chrome's Private Network
Access draws the line. Each artifact keeps its own back and forward history in its record, so ⌘[ and ⌘]
step through it after a switch or a reload, and ⌘L edits the address. A link clicked in the sidecar opens
there too, a web address as a Web entry and a local file the sidecar can draw, a page, a `.md`, a notebook, an
image, a video, audio or a PDF, as a File entry, which `~/.claude/sidecar/tracked.json` remembers until you
remove it, so the sidecar serves only files someone opened. A file it cannot draw opens in Files. A web address you or Claude write in the chat, outside code, becomes a Web entry of that
conversation too, and a path to a file it can draw becomes a File entry as if its link were clicked, written
bare, in inline code or as a `file://` link, from `/`, `~` or the conversation's folder, while one in a fenced
block or to a file not there yet is left alone. Each lands once per conversation, read off the transcript,
so an entry you remove stays removed. It
lands as it is said, whichever conversation is on screen, with the toast a new page gets, and one said
while the sidecar was stopped lands quietly once it is back. A page a WebFetch or WebSearch brought back
never does, even when Claude cites it in its sources, unless you write it yourself.

## Tasks

A task is a `.md` in the artifacts folder whose stamp holds a state, which the Mode plugin writes with
`artifact stamp <slug> --project cela --state running`. The state is one of unassigned, assigned, assessed,
running, blocked, waiting and done, and a task is unassigned exactly while its project is empty. `/tasks/<slug>`
opens it on the task face. On the left the Desk comes first with the inbox of unassigned tasks, then each
project with its tasks. The sheet shows where the task is in its life, its four parts, and the conversations
on it: a conversation is the task's when its title has a role token and the task's slug, as
`[Cela] TL sidecar-task-board follower` does, or the ticket a Moneyfarm task is named after, and it lists with
the state `claude agents` gives it and the subagents running inside it. A comment on the document goes to the
conversation the stamp's `lead` names, else the first Task Lead on it. The selected Task Lead row, that one
unless you click another, has a message field that sends what you write through `/api/sessions/:key/message`,
and anything the sidecar sends a Task Lead that way lands in the task's history as your message.

Edit, or E, puts the markdown in an editor beside the page it renders, and saves as you type unless the file
changed on disk since you opened it. A pasted image is saved to `~/.claude/sidecar/uploads/<slug>/` and linked
as `../uploads/<slug>/<name>`, which resolves from the artifacts folder on disk and from `/uploads/` in the
sidecar, and shows as a captioned figure. ⌘K tunes the paragraph around the selection with the fast model, and
the proposal is written into the file between `<del data-sc-edit>` and `<ins data-sc-edit>`, struck and
highlighted until Keep or Discard, so a reload or the read view still offers it. Outside edit mode ⌘K stays
Comment, and holding C comments in either.

### The Desk

A Tasks tab in the top-right island, beside a conversation's faces or a task's Document and History, and on
its own wherever there are none, opens the Desk on Tasks from any page.

`/desk` opens on Tasks, with Conversations, the list it showed before, one switch away at the top. A task
waiting on your decision or a hire comes first as a red card with its question. Each project follows with its
counts, one sentence from the fast model over its tasks and conversations, cached a minute, and its tasks, open
while any is. The inbox on the right holds the unassigned tasks, each with the fast model's Route to suggestion,
cached until the task changes. Dropping a card on a project, or pressing Route, assigns it through the lane with
`PATCH /api/tasks/:slug`, so it lands in the history and on the bus, and the toast's Undo, or ⌘Z, puts it back.
Eight seconds after the drop, unless undone, the project's Project Lead, its newest live conversation titled
with PL and the project's token, gets the task to assess. New task, or N, asks for a title, writes an unassigned
`.md` with the four parts as headings through `POST /api/tasks`, and opens it in Edit.

### Following the terminal

`sidecar terminal`, started once in the terminal you use for Claude Code, owns a pty there and listens on
`/api/attach/stream`. Attach on a conversation, on the task's rail or in the Terminal pill's menu, posts
`POST /api/attach {key}`; the follower writes Ctrl+Z to the conversation it holds, which detaches it with the
session still running, and runs `claude attach <key>` for the next. The pill says which conversation the terminal
holds and its menu lists the task's conversations, while a switch you make inside Claude Code with the left arrow
is not seen. With no follower running, the pill explains `sidecar terminal` and Attach copies the
`claude attach` line instead. q stops the follower while it holds nothing. The stream opens with a `ready`
event carrying what the sidecar thinks the terminal holds, so the follower says it is following at once and
corrects the sidecar when the two differ.

### The task lane

A task's life goes through `sidecar task`, which the Task Leads and the Project Lead call so the logic that
comments the board and notifies you lives in one place:

```sh
sidecar task <slug>                                   # its state, what waits on a decision, your decisions, the history
sidecar task <slug> state waiting --on "Cosmico" --reason "they confirm they have Fattura 1/2026"
sidecar task <slug> assign cela
sidecar task <slug> escalate "Which model runs a Task Lead?" --options "Sonnet xhigh" --options "Opus" --quote "the text it is about"
sidecar task <slug> hire "a tester, to drive the CLI, Sonnet xhigh"
sidecar task <slug> judge "Yours, it sets the budget of every task" --pick 1
sidecar task <slug> decide 1                          # or decide "your own words"; --thread <n> names one
sidecar task <slug> done
```

Each verb rewrites the stamp in the layout Mode writes, appends to the task's history and publishes on the
event bus, so an open task face updates as it happens. An escalation is a thread on the document with an `ask`
holding its options, the Project Lead's verdict and pick, and in the end the decision; it blocks the task, and
deciding it puts the task back to running and tells the conversation that asked, under the `[[sidecar]]`
marker. A hire is the same thread with Approve and Refuse, and blocks nothing. Who called is read off the
conversation's title: a role token makes it that role, and no token makes it you, except that a decide is always
yours, whichever conversation runs it, since you are the lane's only decider. Waiting needs `--reason`.

Escalate and hire notify you. When a sidecar page is open, the one holding the `sidecar:task-notices` lock
raises a notification whose click opens `/tasks/<slug>`; with no page open, or without notification permission,
it is `osascript display notification`, whose click can only open Script Editor, since macOS ties it to that app.

### The history

Each task keeps `~/.claude/sidecar/history/<slug>.jsonl`, one entry a line, from four feeds: every turn a Task
Lead ends with an answer, which the mod hands over off `turn.complete` for a conversation whose title holds TL
and the task's slug or ticket; status and content changes, from the lane and from Edit mode's saves and Keep;
escalations, verdicts and your decisions; and what you type at a Task Lead's own prompt or send it from the
sidecar, while a relayed message stays out, since one from another lead reads the same. `sidecar task <slug>` run from a Project Lead also marks
the history read.

History, beside Document at the top of the task face, opens on where it stands: the fast model's two or three
sentences over the history, cached in `<slug>.stands.json` until the file changes. Below it each entry has its
time, a TL, PL or YOU badge and chips for what it moved, consecutive turns and nearby edits fold into one, a
line marks what is new since the Project Lead read it, and your decisions filters to those. The right panel
shows a decision as its escalation, a turn as the Task Lead wrote it, and what the history is made of.

On the document, an open escalation sits above the task with its options as one-click choices, the Project
Lead's pick marked, or your own words, the four parts fold to one line each, and the Task Lead's rail row turns
red. Once settled it folds to a row that links to the history, and the strip says it was settled by you. A
waiting task says what it waits on, nothing for you to do, and a resumed or done one says when.

The projects are the `projects` list in `~/.claude/sidecar/config.json`, each `{ key, name, token, folder }`,
where `token` is the bracketed prefix its conversations' titles carry. Without one they are Moneyfarm, Cela,
Nana, madong and meta, under `~/Notes`.

## Desktop or web

A Web artifact has two setups, and which one you get is the surface you pick in `sidecar setup`. The
light option is the proxy above: a Web artifact is a framed page, and most sites, a sign-in asked once
inside the sidecar and a reCAPTCHA work, while a few sites refuse to be framed and passkeys do not.
Choosing desktop builds a small Electron shell around the same sidecar, packages it to
`~/Applications/Claude Code Sidecar.app` and opens it. Inside the shell a Web artifact is a real top-level
page on Chromium rather than a framed one, so Gmail, Reddit and anything that refused framing all work,
and the comment layer, the pins and Ask Claude draw over it as before. Since Electron has no find bar of its
own, ⌘F there turns the title island into one for any artifact, searching the page and its frames, with ↵ or
⌘G for the next match and ⇧↵ or ⇧⌘G for the previous; a site with its own ⌘F, such as Docs, keeps it, and the
web surface leaves ⌘F to Chrome. ⌘+, ⌘− and ⌘0, or a trackpad pinch, zoom the whole app the way a Chrome tab
zooms, the page inside it included, and the zoom is kept across launches, while a file preview keeps its own
pinch and zoom pill. The top edge of the app is its title bar, so it drags the window and a double click there
zooms or minimises it as System Settings says. The title island starts at the window's left edge with the
traffic lights inside it, before the sidecar icon, and the shell moves them with the zoom. On first launch the shell copies
your Chrome cookies into its own session, decrypting them with a key it reads from the login Keychain once
(the one macOS prompt you will see), so you arrive signed in to the same accounts as in Chrome.
`sidecar import` re-reads them later, with the app closed. The cookies are a copy rather than shared live,
so a session that expires is refreshed by importing again. A site's own sign-in popup, Continue with Google
and the like, opens as a sheet centred over the page with the rest dimmed rather than a separate window,
staying a real child window underneath so the sign-in still completes, though a fresh Google sign-in from
scratch may still be refused inside any embedded browser, with an Open in Chrome item in the View menu as
the escape hatch. On the desktop surface `sidecar open` opens the app rather than a Chrome window;
`sidecar uninstall` removes it and all its data, back to a clean slate. The shell is `desktop/`, its own
pnpm package, so the Electron binary is downloaded only when you build the app and never by the light
setup.

## Events

Claude talks to the sidecar through events, the way a Kafka producer talks to its consumers. Each
event is one line appended to `~/.claude/sidecar/events.jsonl` under a topic, with the conversation's
key, the time and a payload, and the sidecar streams that log to every open window, so an event
published while the sidecar is down still arrives once it starts. The topics and their payloads are
`Topics` in `shared/types/events.ts`, and a topic only exists once it has a parser in
`lib/sidecar/events.ts`, which refuses a payload that does not fit it.

| Topic              | Payload                 | Published by                                                                    | What the sidecar does                       |
| ------------------ | ----------------------- | ------------------------------------------------------------------------------- | ------------------------------------------- |
| `artifact.created` | `slug`, `title`, `path` | the sidecar, when a conversation's list first records a page it was not showing | Lists the page, and a notification opens it |
| `task.changed`     | `slug`, `state`         | the task lane, for every stamp change and every history entry                    | The task face reads the task again          |
| `task.escalated`   | `slug`, `title`, `thread`, `kind`, `question` | `sidecar task <slug> escalate` and `hire`                      | Shows the escalation and notifies you       |
| `task.decided`     | `slug`, `thread`, `text`, `who` | `sidecar task <slug> decide`, and a choice on the task face             | Settles the escalation on the face          |
| `terminal.changed` | `following`, `held`     | the server, when `sidecar terminal` connects, leaves or attaches a conversation | The Terminal pill and the rail's Attach     |

A producer in this repo calls `publish({ topic, data })` from `lib/sidecar/events.ts`, and anything
else runs `sidecar publish artifact.created '{"slug":"…","path":"…"}'`. A component consumes with
`useEvents().on("artifact.created", ({ data, key }) => …)`, typed by topic and dropped with the
component's scope. Outside the app, `/api/events/stream` is plain server-sent events: each message is
named after its topic and its id is the offset to resume from, `?topic=` narrows it, and `?since=` or a
`Last-Event-ID` header replays from an offset where a new connection starts at the end.

Inside the server a write to any transcript reaches `transcripts.on("grew", ({ key, path }) => …)` from
`server/utils/sessions/transcripts.ts`, fed by the one watcher in `server/plugins/transcripts.ts`, so the
mascot's turn stream and link adoption subscribe to it instead of watching files of their own.

## Asking Claude

Ask Claude is `/btw` from the sidecar: the mascot beside the notes slides its field out on hover, and ⌥↵
or a click puts the cursor in it, folding back once the pointer and focus have left, asks a side question
with the whole conversation as context, and nothing reaches the transcript or interrupts the turn. Its
exchanges stack in one scrolling thread, which Clear empties with Undo, and they live in the page's memory
only. `POST /api/sessions/<key>/ask` with `kind: "btw"` copies the transcript to the OS temp dir with its
`last-prompt` record pointed at the newest entry, so the running turn is included, then runs the session's
own build from `~/.local/share/claude/versions` with `--resume <copy> --fork-session
--no-session-persistence` and hooks off, and sends the undocumented `side_question` control request over
stream-json. It works on a finished conversation too, and since that request is internal, a Claude Code
upgrade can break it, which shows as a failed answer.

A comment asks a blank Claude instead: Ask (⌘↵) in the comment popover opens a side question card where
you picked, under the lines in Review and Files or in an artifact's margin, and posts `kind: "blank"`.
That is a fresh `claude -p` on Sonnet with no conversation and none of your configuration (no setting
sources, hooks, MCP servers or slash commands), whose only tools are Read, Glob and Grep in the session's
folder, plus the picked file's folder through `--add-dir` when it sits outside. It stops after 8 turns or
two minutes, and with the session's folder gone it reads nothing. Its first question carries the place
and the picked lines numbered from the file, so a "line 14" in the answer is the file's line 14, and Send
to conversation hands the place, a short quote and the exchanges over as your next message, with
whatever is still in the field as its last paragraph. The threads live in the `$sideQuestion` store, in
memory only like `/btw`.

## The mod

Bare `/sidecar` is `sidecar open`: it starts the sidecar when it is down and points it at this conversation,
brings a sidecar window already open to the front, and otherwise opens it as the surface `sidecar setup`
chose. Typing in a session's prompt points the sidecar there too, at most once every two seconds, and never
holds up a keystroke, and what that point does is the switching mode below. Each turn also leaves an empty `~/.claude/sidecar/conversations/<session key>`, which
is how the sidecar still lists a conversation after it has ended. A turn that ends on the main loop with an
answer, and a prompt you type, go to `sidecar task --heard turn` and `--heard message` on stdin, which keeps them
only for a Task Lead's conversation, in its task's history.

It also keeps the review the sidecar's Review face shows. Before Claude's first edit to a file, through
Edit, Write, NotebookEdit or a shell command, it stores what the file held, and each turn it records which
files moved, in `~/.claude/sidecar/review/<session id>/review.json` beside a `blobs/` folder of contents by
hash. Every hook reads the session id afresh, because a `/clear` carries on under a new id with no
`session.start` and a compaction can leave the mod's state empty, so the review and the sidecar both move
to the live id and reload what is on disk. Review's approve and reject, for lines, hunks, files or a whole
folder, arrive as relayed messages whose whole body is the action's JSON, which the mod takes out of the
conversation and applies itself, so it stays the only writer, and a reject tells Claude which files
changed under it. Every decision keeps both sides of what it touched, so Review's ⌘Z undoes the last one
and ⌘⇧Z redoes it, up to 50 back, unless Claude edited that file since. A decision over several files is
labelled by how many and the folder they share, as in `approving 8 files in .claude/hooks/`, so the undo
tooltip stays one line.

The sidecar URL is the `url` option in `/config`, `http://sidecar.localhost:4747` by default: its own name
and port, so it never shares an origin or a port with another app on `localhost:3000`. The name needs no
setup, because Chrome, curl and Node resolve any `*.localhost` to this machine and the dev server accepts
those names; the port is `devServer.port` in `nuxt.config.ts`. Typing's point goes to `localhost` on the
same port, and the CLI gets the option as `SIDECAR_URL`.

```
POST /api/follow  {"key":"<8-hex session key>","source":"claude"|"prompt","face"?:"files"|"history"|"review","slug"?:"<artifact>"}  ->  {"listeners": <open pages>}
```

The sidecar keeps the latest target in memory and streams it to every open page on `/api/follow/stream`.
While a page listens it also reads Terminal's front tab title with osascript once a second and points the
sidecar at the conversation that tab switches to, so a terminal tab switch counts as moving without typing.

Whether a move by typing or by Terminal's tab switches the sidecar is the switching mode, picked from the
island beside the theme toggle and remembered per window. Ask to switch, the default, shows a card in the
bottom left, over everything else including a fullscreen artifact, with the conversation's name, folder and what it is doing, which switches there when pressed and
stays until pressed, dismissed or no longer needed, asking once per move so typing on in that conversation
doesn't bring a dismissed card back. Auto switch moves straight there, as the sidecar always did, and Manual
switch never moves on its own. An explicit `/sidecar` or `sidecar open` always lands whatever the mode, and so
does Listening, which has no conversation of its own to stay on.

What the sidecar sends a session, notes and Review's buttons alike, opens on a `[[sidecar]]` line
(`[[cc-sidecar]]` and `[[mode-relay v1]]` before it, still read) and reaches Claude Code as a peer message.
Claude Code frames a peer message, with the "Another Claude session sent a message:" line above it and the
"This came from another Claude session" paragraph below, only when it stores the row, after
`session.receive` has run. So the mod's `session.receive` drops the marker and its `session.append` takes
the frame off the row, and the conversation shows only what you wrote. A Review action is the whole body
under the marker, run by `session.receive` and never shown; a note that only quotes one is left alone:

```
[[sidecar]]
{"do":"approve"|"reject","paths":[...]}
{"do":"accept-lines"|"reject-lines","path":"...","old":[1-based],"new":[1-based]}
{"do":"undo"|"redo"}
```

## Develop

The app is `pnpm dev`, `pnpm typecheck`, `pnpm test` and `pnpm build`. The mod is one hooks module,
`hooks/register.tsx`, with the review logic in `hooks/review/`, checked with `pnpm test:mod`, which runs
`claude plugin validate` on the repo root and `claude plugin test` on a copy of the mod alone, since the
test runner takes every `*.test.ts` under its folder.

Removing a conversation in the sidecar also runs `mode forget` when the [mode](https://github.com/EthanITA/Mode)
plugin is installed, found through `~/.claude/mode/plugin-root`, so mode's share of it goes too.

## Licence

MIT, in `LICENSE`.

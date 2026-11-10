# Reset the project chat list on collapse

After **Show more**, closing a project folder clears its expanded chat list. Reopening the folder shows the initial five chats, and **Show more** is available again. Other project folders keep their own expansion state.

The patch uses Codex's existing project list controls and resets only the closing project's **Show more** state. It is independent of `project-memberships` and defaults to `auto` on reviewed builds. Set `project-list-reset` to `disabled` to keep the stock behavior.

To check it after rebuilding and relaunching, open two project folders with enough chats to show **Show more**. Expand both lists, then close and reopen one folder. Confirm that it returns to the first five in the same order, can be expanded again, and the other folder stays expanded.

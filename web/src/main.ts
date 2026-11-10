import "../styles/fonts.css";
import "../styles/base.css";
import "../styles/layout.css";
import "../styles/components.css";
import { api, errorFrom, exists, isHeld, request, setHold, type State } from "./api.ts";
import { ChangeList, changesItem } from "./changelist.ts";
import { copyButton } from "./copy.ts";
import { askNewFile, confirmDiscard } from "./dialogs.ts";
import type { EditorState } from "./editor.ts";
import { applyFont } from "./font.ts";
import { icon, iconButton } from "./icons.ts";
import { bindKeys, isPlainClick } from "./keys.ts";
import * as live from "./live.ts";
import { openSearch } from "./search.ts";
import { openHelp } from "./shortcuts.ts";
import * as sidebar from "./sidebar.ts";
import * as theme from "./theme.ts";
import * as view from "./view.ts";
import { applyWidth } from "./width.ts";

// The editor and CodeMirror load on the first edit: they are more than
// half of the page's code. Until then, nothing is open in the editor.
let editor: typeof import("./editor.ts") | undefined;
let editorLoad: Promise<typeof import("./editor.ts")> | undefined;

function loadEditor() {
  editorLoad ??= import("./editor.ts").then(
    (module) => (editor = module),
    (error) => {
      // The next edit tries again: mdame may be back.
      editorLoad = undefined;
      throw error;
    },
  );
  return editorLoad;
}

/** The path of the file open in the editor, if any. */
function editedPath(): string | null {
  return editor?.openPath() ?? null;
}

const app = document.getElementById("mdame-app") as HTMLElement;
const status = document.getElementById("mdame-status") as HTMLElement;

const fileStatus = document.createElement("span");
fileStatus.className = "mdame-file-status";

const changes = new ChangeList();
const changesStatus = changesItem(
  openFile,
  () => {
    changes.clear();
    changesStatus.update(changes.paths);
  },
);

function showStatus(state: State) {
  const workspace = document.createElement("span");
  workspace.textContent = state.workspace.root;
  const version = document.createElement("span");
  version.className = "mdame-version";
  version.textContent = state.version;
  status.replaceChildren(
    workspace,
    fileStatus,
    changesStatus.el,
    version,
    iconButton(
      "Keyboard shortcuts",
      "keyboard",
      () => openHelp(state.version),
      "Keyboard shortcuts (?)",
    ),
    theme.themeButton(state.themes),
  );
}

function showFileStatus(path: string, file: view.FileView) {
  const name = document.createElement("span");
  name.textContent = path;
  const modified = document.createElement("span");
  modified.textContent = new Date(file.modified * 1000).toLocaleString();
  const copyPath = copyButton({ label: "Copy path", iconName: "link", text: () => path });
  fileStatus.replaceChildren(name, modified, copyPath);
  if (file.editable) {
    fileStatus.append(
      iconButton("Edit", "pencil", () => startEditing(path), "Edit (e)"),
      iconButton("Revisions", "recent", () => startEditing(path, true), "Revisions (h)"),
    );
  }
  if (file.family !== "image") {
    const content = async () => {
      const response = await request(view.rawUrl(path));
      if (!response.ok) throw errorFrom(response.status, null);
      return response.text();
    };
    fileStatus.append(copyButton({ label: "Copy content", iconName: "copy", text: content }));
  }
}

function showEditStatus(state: EditorState) {
  const name = document.createElement("span");
  name.textContent = state.path;
  const dot = document.createElement("span");
  dot.className = "mdame-unsaved";
  dot.textContent = "●";
  dot.title = "Unsaved changes";
  dot.hidden = !state.dirty;
  const modified = document.createElement("span");
  modified.textContent = new Date(state.modified * 1000).toLocaleString();
  const error = document.createElement("span");
  error.className = "mdame-status-error";
  error.setAttribute("role", "alert");
  error.textContent = state.error ?? "";
  const label = state.preview ? "Hide preview" : "Show preview";
  const preview = iconButton(label, "columns", () => editor?.togglePreview());
  preview.setAttribute("aria-pressed", String(state.preview));
  const revisions = iconButton("Revisions", "recent", () => editor?.toggleRevisions(), "Revisions (h)");
  revisions.setAttribute("aria-pressed", String(state.revisions));
  const save = document.createElement("button");
  save.className = "mdame-status-button";
  save.title = "Save (Ctrl+S)";
  save.textContent = "Save";
  save.addEventListener("click", () => editor?.save());
  fileStatus.replaceChildren(name, dot, modified, error);
  // The revisions take the place of the preview.
  if (!state.revisions) fileStatus.append(preview);
  fileStatus.append(revisions, save);
}

const content = document.createElement("div");
content.id = "mdame-content";

let fileCount = 0;

/** The file that the address names, and whether it is open in the editor. */
function route(): { path: string | null; editing: boolean } {
  const edited = sidebar.pathFromUrl(location.pathname, "/edit/");
  if (edited !== null) return { path: edited, editing: true };
  return { path: sidebar.pathFromUrl(location.pathname), editing: false };
}

function editUrl(path: string): string {
  return "/edit/" + sidebar.encodePath(path);
}

let routes = 0;

/** Shows what the address names: the editor, in diff mode if
 * `withRevisions`, or the view. */
function showRoute(withRevisions = false) {
  const { path, editing } = route();
  const id = ++routes;
  sidebar.setCurrent(path);
  if (path) {
    changes.opened(path);
    changesStatus.update(changes.paths);
  }
  if (editing && path) {
    fileStatus.replaceChildren();
    loadEditor().then(
      (loaded) => {
        // Another route may have come during the first load.
        if (id !== routes) return;
        // Before `forget`: the editor of another file leaves it.
        loaded.unmount();
        view.forget(path);
        loaded.mount(content, path, showEditStatus, withRevisions);
      },
      () => {
        if (id !== routes) return;
        view.forget(path);
        view.message(content, "Reload the page once mdame is back: the editor did not load.");
      },
    );
  } else {
    editor?.unmount();
    showContent(path);
  }
}

/** Whether the editor's unsaved edits may be lost: none, or the user agrees. */
async function mayLeaveEditor(): Promise<boolean> {
  return !editor?.isDirty() || (await confirmDiscard());
}

/** Set when `e` opened the editor over the view of the same file: closing
 * goes back to that view rather than adding to the history. */
let editingFromView = false;

function startEditing(path: string, withRevisions = false) {
  history.pushState(null, "", editUrl(path));
  editingFromView = true;
  showRoute(withRevisions);
}

/** The file that the view shows, if the editor may open it: as the Edit
 * button. */
function editableShown(): string | null {
  const { path, editing } = route();
  if (!path || editing || view.shownPath() !== path || !view.shownFile()?.editable) return null;
  return path;
}

/** `h` and `r`: diff mode, from the view too. */
function toggleRevisions() {
  if (route().editing) {
    editor?.toggleRevisions();
    return;
  }
  const path = editableShown();
  if (path) startEditing(path, true);
}

async function stopEditing() {
  const { path, editing } = route();
  if (!editing || !path || !(await mayLeaveEditor())) return;
  editor?.unmount();
  if (editingFromView) {
    editingFromView = false;
    history.back();
  } else {
    history.replaceState(null, "", sidebar.viewUrl(path));
    showRoute();
  }
}

function showContent(path: string | null) {
  // While the discard dialog of a Back is open, the address already names
  // the next page but the editor is still on screen.
  if (editedPath() !== null) return;
  fileStatus.replaceChildren();
  if (path) view.showFile(content, path).then((file) => file && showFileStatus(path, file));
  else view.showNothing(content, fileCount === 0);
}

function refreshContent(path: string) {
  if (editedPath() !== null) return;
  view.refreshFile(content, path).then((file) => {
    if (file) showFileStatus(path, file);
    // Not found now: the old time and copy buttons would be wrong.
    else if (view.shownPath() === undefined && path === sidebar.pathFromUrl(location.pathname)) {
      fileStatus.replaceChildren();
    }
  });
}

let contentTimer: ReturnType<typeof setTimeout> | undefined;

/** A save often arrives as several events in one batch: they share one
 * render. */
function refreshContentSoon(path: string) {
  clearTimeout(contentTimer);
  contentTimer = setTimeout(() => {
    if (path === sidebar.pathFromUrl(location.pathname)) refreshContent(path);
  }, 50);
}

let diskTimer: ReturnType<typeof setTimeout> | undefined;

/** The events of one save share one check. */
function checkDiskSoon() {
  clearTimeout(diskTimer);
  diskTimer = setTimeout(() => editor?.checkDisk(), 50);
}

let treeTimer: ReturnType<typeof setTimeout> | undefined;

/** Each request walks the whole folder: the events of one batch, which
 * arrive together, share one. */
function refreshTree() {
  clearTimeout(treeTimer);
  treeTimer = setTimeout(() => {
    sidebar.refreshTree().then((count) => {
      if (count === null) return;
      fileCount = count;
      // The empty-workspace page and "Choose a file" depend on the count.
      if (!route().path) showContent(null);
    });
  }, 50);
}

/** Keeps showing the open file, or a file in a folder, after a rename. */
async function follow(moved: string) {
  // As in showContent: the editor may still be on screen.
  if (editedPath() !== null) return;
  const current = sidebar.pathFromUrl(location.pathname);
  if (!current) return;
  // An editor that saves by renaming the file to a backup writes it again
  // at once, possibly in the next batch: the page stays on the file.
  const stayed = await exists(view.rawUrl(current));
  if (sidebar.pathFromUrl(location.pathname) !== current) return;
  if (stayed) {
    refreshContent(current);
    return;
  }
  // The old address names nothing now: replace it rather than add to Back.
  history.replaceState(null, "", sidebar.viewUrl(moved) + location.hash);
  view.renameShown(moved);
  sidebar.setCurrent(moved);
  refreshContent(moved);
}

function onEvent(event: live.LiveEvent) {
  // Until the state check after a reconnection: it refetches everything.
  if (isHeld()) return;
  changes.apply(event, route().path);
  changesStatus.update(changes.paths);
  const current = sidebar.pathFromUrl(location.pathname);
  const reaction = live.react(event, current, sidebar.orderDependsOn);
  if (reaction.kind === "reload") {
    refresh();
    return;
  }
  if (reaction.tree) refreshTree();
  view.refreshImages(content);
  const edited = editedPath();
  if (edited !== null && live.concerns(event, edited)) checkDiskSoon();
  if (reaction.followTo) follow(reaction.followTo);
  else if (reaction.refresh && current) refreshContentSoon(current);
}

/** Shows `url` in the page, as a new history entry. */
function go(url: string) {
  editingFromView = false;
  history.pushState(null, "", url);
  sidebar.closeSidebarOverlay();
  showRoute();
}

async function openFile(path: string, hash = "") {
  if (await mayLeaveEditor()) go(sidebar.viewUrl(path) + hash);
}

/** Opens the search panel. A line that the user picks opens in the view,
 * scrolled to its block. */
function search() {
  openSearch((path, line) => openFile(path, `#L${line}`));
}

/** Asks for the path of a new file, creates it and opens it in the editor. */
async function newFile(folder: string) {
  if (!(await mayLeaveEditor())) return;
  const path = await askNewFile(folder);
  if (path !== null) go(editUrl(path));
}

// Links to `/view/…` open without a page load, as sidebar rows do.
content.addEventListener("click", (event) => {
  if (!isPlainClick(event)) return;
  const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
  if (!link) return;
  const url = new URL(link.href);
  const path = url.origin === location.origin ? sidebar.pathFromUrl(url.pathname) : null;
  if (path === null) return;
  event.preventDefault();
  openFile(path, url.hash);
});

async function showWorkspace(state: State) {
  const { root, start } = state.workspace;
  if (start && location.pathname === "/") {
    history.replaceState(null, "", sidebar.viewUrl(start));
  }
  const current = route().path;
  const nav = document.createElement("nav");
  nav.id = "mdame-sidebar";
  nav.setAttribute("aria-label", "Files");
  const handle = document.createElement("div");
  handle.className = "mdame-resize";
  const backdrop = document.createElement("div");
  backdrop.className = "mdame-backdrop";
  const frame = document.createElement("div");
  frame.className = "mdame-frame";
  frame.append(nav, handle, content, backdrop);
  app.replaceChildren(frame);
  const button = document.createElement("button");
  button.className = "mdame-icon-button";
  button.append(icon("panel"));
  status.prepend(button);
  sidebar.setupLayout({ frame, nav, handle, backdrop, button });
  bindKeys({
    b: sidebar.toggleSidebar,
    "/": sidebar.focusFilter,
    e: () => {
      const path = editableShown();
      if (path) startEditing(path);
    },
    h: toggleRevisions,
    r: toggleRevisions,
    s: search,
    "?": () => openHelp(state.version),
  });
  const mounted = sidebar.mount(nav, {
    root,
    current,
    onOpen: openFile,
    onNewFile: newFile,
    onSearch: search,
  });
  // Only the empty-workspace page needs the tree: a file shows at once.
  if (current) showRoute();
  fileCount = await mounted;
  if (!current) showContent(current);
}

addEventListener("popstate", async () => {
  const left = editedPath();
  const fromView = editingFromView;
  editingFromView = false;
  const next = route();
  // A `#…` link in the preview: mounting the editor again would drop the edits.
  if (left !== null && next.editing && next.path === left) return;
  // The address has already changed: put the editor's back if the user
  // keeps editing. It takes the place of the entry that the user left.
  if (left !== null && !(await mayLeaveEditor())) {
    history.pushState(null, "", editUrl(left));
    editingFromView = fromView;
    return;
  }
  showRoute();
});

// Esc reaches the page from inside CodeMirror too: bindKeys ignores it there.
addEventListener("keydown", (event: KeyboardEvent) => {
  // An input method uses Esc to cancel what it composes.
  if (event.key !== "Escape" || event.defaultPrevented || event.isComposing) return;
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
  // Esc in a dialog or a menu closes it.
  // Focus may have left the dialog for the page, after a click on its text.
  if (document.querySelector("dialog[open], :popover-open")) return;
  // The sidebar's own listener closes its overlay first.
  if (!route().editing || sidebar.isOverlayOpen()) return;
  // Otherwise the browser applies this Esc to the dialog that it opens,
  // which closes at once.
  event.preventDefault();
  if (editor?.revisionsShown()) editor.closeRevisions();
  else stopEditing();
});

/** The root on screen, once shown. */
let shownRoot: string | undefined;

function show(state: State) {
  // After a reconnection, the workspace is already on screen.
  if (state.workspace.root === shownRoot) return;
  shownRoot = state.workspace.root;
  showStatus(state);
  showWorkspace(state);
}

/** Counts the closes of the WebSocket. */
let closes = 0;

/** Refetches everything on screen, after events may have been missed. */
async function refresh() {
  const closed = closes;
  const state = await api<State>("GET", "/api/state");
  // The answer may come from the mdame that is gone since.
  if (closes !== closed) return;
  // The server restarted on another folder.
  if (shownRoot && state.workspace.root !== shownRoot) {
    // The leave-page warning lets the user stay, to copy unsaved edits.
    setHold("Copy your text, then reload the page: mdame now shows another folder.");
    location.reload();
    return;
  }
  setHold(null);
  show(state);
  refreshTree();
  view.refreshImages(content);
  const current = sidebar.pathFromUrl(location.pathname);
  if (current) refreshContent(current);
  // The editor that failed to load meanwhile shows why. Without
  // `editorLoad`, its code failed to load.
  if (route().editing && (editor ? editor.mountFailed() : !editorLoad)) showRoute();
  editor?.checkDisk();
  editor?.refreshPreview();
}

theme.apply();
applyFont();
applyWidth();

// The code or the token in the address has done its work: the cookie now
// stands for it, and a reload must not send it again.
if (location.search) history.replaceState(null, "", location.pathname + location.hash);

await live.connect({
  onEvent,
  onReconnect: refresh,
  onClose: () => {
    closes++;
    setHold("Try again once mdame is back.");
  },
});

const state = await api<State>("GET", "/api/state");
show(state);

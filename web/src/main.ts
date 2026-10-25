import "../styles/base.css";
import "../styles/layout.css";
import "../styles/components.css";
import { api, errorFrom, exists, type State } from "./api.ts";
import { copyButton } from "./copy.ts";
import { askHistory, askNewFile, confirmDiscard } from "./dialogs.ts";
import * as editor from "./editor.ts";
import { icon, iconButton } from "./icons.ts";
import { bindKeys, isPlainClick } from "./keys.ts";
import * as live from "./live.ts";
import * as picker from "./picker.ts";
import * as sidebar from "./sidebar.ts";
import * as view from "./view.ts";

const app = document.getElementById("mdame-app") as HTMLElement;
const status = document.getElementById("mdame-status") as HTMLElement;

const fileStatus = document.createElement("span");
fileStatus.className = "mdame-file-status";

function showStatus(state: State) {
  const workspace = document.createElement("span");
  workspace.textContent = state.workspace ? state.workspace.root : "No workspace";
  const version = document.createElement("span");
  version.textContent = state.version;
  status.replaceChildren(workspace, fileStatus, version);
}

function showFileStatus(path: string, file: view.FileView) {
  const name = document.createElement("span");
  name.textContent = path;
  const modified = document.createElement("span");
  modified.textContent = new Date(file.modified * 1000).toLocaleString();
  const copyPath = copyButton({ label: "Copy path", iconName: "link", text: () => path });
  fileStatus.replaceChildren(name, modified, copyPath);
  if (file.family !== "image") {
    fileStatus.append(iconButton("Edit", "pencil", () => startEditing(path), "Edit (e)"));
    const content = async () => {
      const response = await fetch(view.rawUrl(path));
      if (!response.ok) throw errorFrom(response.status, null);
      return response.text();
    };
    fileStatus.append(copyButton({ label: "Copy content", iconName: "copy", text: content }));
  }
}

function showEditStatus(state: editor.EditorState) {
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
  const preview = iconButton(label, "columns", editor.togglePreview);
  preview.setAttribute("aria-pressed", String(state.preview));
  const save = document.createElement("button");
  save.className = "mdame-status-button";
  save.title = "Save (Ctrl+S)";
  save.textContent = "Save";
  save.addEventListener("click", () => editor.save());
  fileStatus.replaceChildren(name, dot, modified, error, preview, save);
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

/** Shows what the address names: the editor or the view. */
function showRoute() {
  const { path, editing } = route();
  sidebar.setCurrent(path);
  if (editing && path) {
    fileStatus.replaceChildren();
    view.forget();
    editor.mount(content, path, showEditStatus);
  } else {
    editor.unmount();
    showContent(path);
  }
}

/** Whether the editor's unsaved edits may be lost: none, or the user agrees. */
async function mayLeaveEditor(): Promise<boolean> {
  return !editor.isDirty() || (await confirmDiscard());
}

/** Set when `e` opened the editor over the view of the same file: closing
 * goes back to that view rather than adding to the history. */
let editingFromView = false;

function startEditing(path: string) {
  history.pushState(null, "", editUrl(path));
  editingFromView = true;
  showRoute();
}

async function stopEditing() {
  const { path, editing } = route();
  if (!editing || !path || !(await mayLeaveEditor())) return;
  editor.unmount();
  if (editingFromView) {
    editingFromView = false;
    history.back();
  } else {
    history.replaceState(null, "", sidebar.viewUrl(path));
    showRoute();
  }
}

function showContent(path: string | null) {
  fileStatus.replaceChildren();
  if (path) view.showFile(content, path).then((file) => file && showFileStatus(path, file));
  else view.showNothing(content, fileCount === 0);
}

function refreshContent(path: string) {
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
  diskTimer = setTimeout(editor.checkDisk, 50);
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
  const current = sidebar.pathFromUrl(location.pathname);
  const reaction = live.react(event, current, shownRoot === null, sidebar.orderDependsOn);
  if (reaction.kind === "reload") refresh();
  if (reaction.kind !== "update") return;
  if (reaction.tree) refreshTree();
  view.refreshImages(content);
  const edited = editor.openPath();
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
  const { root, start } = state.workspace!;
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
  sidebar.setupLayout({ frame, handle, backdrop, button });
  bindKeys({
    b: sidebar.toggleSidebar,
    "/": sidebar.focusFilter,
    e: () => {
      const { path, editing } = route();
      if (path && !editing && view.shownPath() === path) startEditing(path);
    },
  });
  const mounted = sidebar.mount(nav, { root, current, onOpen: openFile, onNewFile: newFile });
  // Only the empty-workspace page needs the tree: a file shows at once.
  if (current) showRoute();
  fileCount = await mounted;
  if (!current) showContent(current);
}

addEventListener("popstate", async () => {
  const left = editor.openPath();
  editingFromView = false;
  const next = route();
  if (left !== null && !(next.editing && next.path === left)) {
    // The address has already changed: put the editor's back if the user
    // keeps editing.
    if (!(await mayLeaveEditor())) {
      history.pushState(null, "", editUrl(left));
      return;
    }
  }
  showRoute();
});

// Esc reaches the page from inside CodeMirror too: bindKeys ignores it there.
addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
  // Esc in a dialog closes the dialog.
  if ((event.target as Element).closest?.("dialog")) return;
  if (!route().editing) return;
  // Otherwise the browser applies this Esc to the dialog that it opens,
  // which closes at once.
  event.preventDefault();
  stopEditing();
});

/** The root on screen: null on the picker, undefined before the first show. */
let shownRoot: string | null | undefined;

function show(state: State) {
  const root = state.workspace?.root ?? null;
  // The tab that opened a workspace also gets its `workspace` event.
  if (root === shownRoot) return;
  // The server restarted on another workspace, or on the picker.
  if (shownRoot) {
    location.reload();
    return;
  }
  shownRoot = root;
  showStatus(state);
  if (state.workspace) {
    picker.unmount();
    showWorkspace(state);
  } else {
    picker.mount(app, { state, onOpen: show });
  }
}

/** Refetches everything on screen, after events may have been missed. */
async function refresh() {
  show(await api<State>("GET", "/api/state"));
  if (!shownRoot) return;
  refreshTree();
  view.refreshImages(content);
  const current = sidebar.pathFromUrl(location.pathname);
  if (current) refreshContent(current);
  editor.checkDisk();
}

await live.connect({ onEvent, onReconnect: refresh });

const state = await api<State>("GET", "/api/state");
show(state);
if (state.needs_setup) {
  askHistory();
}

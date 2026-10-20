import "../styles/base.css";
import "../styles/layout.css";
import "../styles/components.css";
import { api, errorFrom, exists, type State } from "./api.ts";
import { copyButton } from "./copy.ts";
import { askHistory } from "./dialogs.ts";
import { icon } from "./icons.ts";
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
    const content = async () => {
      const response = await fetch(view.rawUrl(path));
      if (!response.ok) throw errorFrom(response.status, null);
      return response.text();
    };
    fileStatus.append(copyButton({ label: "Copy content", iconName: "copy", text: content }));
  }
}

const content = document.createElement("div");
content.id = "mdame-content";

let fileCount = 0;

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
      if (!sidebar.pathFromUrl(location.pathname)) showContent(null);
    });
  }, 50);
}

/** Keeps showing the open file, or a file in a folder, after a rename. */
async function follow(from: string, to: string) {
  const current = sidebar.pathFromUrl(location.pathname);
  const moved = current && live.movedPath(current, from, to);
  if (!moved) return;
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

let workspaceBeforeShow = false;

function onEvent(event: live.LiveEvent) {
  if (event.type === "workspace") {
    if (shownRoot === null) refresh();
    // The first state may be older than this event.
    else if (shownRoot === undefined) workspaceBeforeShow = true;
    return;
  }
  if (event.type === "resync") {
    refresh();
    return;
  }
  const paths = event.type === "renamed" ? [event.from, event.to] : [event.path];
  if (event.type !== "changed" || sidebar.orderDependsOn(event.path)) refreshTree();
  for (const path of paths) view.refreshImages(content, path);
  const current = sidebar.pathFromUrl(location.pathname);
  if (!current) return;
  const moved = event.type === "renamed" && !live.isWithin(current, event.to);
  if (moved && live.isWithin(current, event.from)) follow(event.from, event.to);
  // Asks again rather than show "Not found": a save, or a folder moved
  // in, can bring the file back.
  else if (paths.some((path) => live.isWithin(current, path))) refreshContentSoon(current);
}

function openFile(path: string, hash = "") {
  history.pushState(null, "", sidebar.viewUrl(path) + hash);
  sidebar.setCurrent(path);
  sidebar.closeSidebarOverlay();
  showContent(path);
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
  const current = sidebar.pathFromUrl(location.pathname);
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
  bindKeys({ b: sidebar.toggleSidebar, "/": sidebar.focusFilter });
  const mounted = sidebar.mount(nav, { root, current, onOpen: openFile });
  // Only the empty-workspace page needs the tree: a file shows at once.
  if (current) showContent(current);
  fileCount = await mounted;
  if (!current) showContent(current);
}

addEventListener("popstate", () => {
  const path = sidebar.pathFromUrl(location.pathname);
  sidebar.setCurrent(path);
  showContent(path);
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
  view.refreshAllImages(content);
  const current = sidebar.pathFromUrl(location.pathname);
  if (current) refreshContent(current);
}

await live.connect({ onEvent, onReconnect: refresh });

const state = await api<State>("GET", "/api/state");
show(state);
if (workspaceBeforeShow && shownRoot === null) refresh();
if (state.needs_setup) {
  askHistory();
}

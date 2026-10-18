import "../styles/base.css";
import "../styles/layout.css";
import "../styles/components.css";
import { api, errorFrom, type State } from "./api.ts";
import { copyButton } from "./copy.ts";
import { askHistory } from "./dialogs.ts";
import { icon } from "./icons.ts";
import { bindKeys, isPlainClick } from "./keys.ts";
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

function show(state: State) {
  showStatus(state);
  if (state.workspace) {
    picker.unmount();
    showWorkspace(state);
  } else {
    picker.mount(app, { state, onOpen: show });
  }
}

const state = await api<State>("GET", "/api/state");
show(state);
if (state.needs_setup) {
  askHistory();
}

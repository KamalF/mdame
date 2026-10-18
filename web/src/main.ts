import "../styles/base.css";
import "../styles/layout.css";
import "../styles/components.css";
import { api, type State } from "./api.ts";
import { askHistory } from "./dialogs.ts";
import { icon } from "./icons.ts";
import { bindKeys } from "./keys.ts";
import * as picker from "./picker.ts";
import * as sidebar from "./sidebar.ts";
import * as view from "./view.ts";

const app = document.getElementById("mdame-app") as HTMLElement;
const status = document.getElementById("mdame-status") as HTMLElement;

function showStatus(state: State) {
  const workspace = document.createElement("span");
  workspace.textContent = state.workspace ? state.workspace.root : "No workspace";
  const version = document.createElement("span");
  version.textContent = state.version;
  status.replaceChildren(workspace, version);
}

const content = document.createElement("div");
content.id = "mdame-content";

let shown: string | null | undefined;

function showContent(path: string | null) {
  // Moving between `#…` of the same file only scrolls.
  if (path === shown) {
    view.scrollToHash();
    return;
  }
  shown = path;
  if (path) view.showFile(content, path);
  else view.showNothing(content);
}

function openFile(path: string, hash = "") {
  history.pushState(null, "", sidebar.viewUrl(path) + hash);
  sidebar.setCurrent(path);
  sidebar.closeSidebarOverlay();
  showContent(path);
}

// Links in a file point to `/raw/…`; those to a file of the tree open it
// here instead. Others, such as a PDF, stay plain links.
content.addEventListener("click", (event) => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
  const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
  if (!link) return;
  const url = new URL(link.href);
  const path = url.origin === location.origin ? view.rawPath(url.pathname) : null;
  if (path === null || !sidebar.hasFile(path)) return;
  event.preventDefault();
  openFile(path, url.hash);
});

function showWorkspace(state: State) {
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
  sidebar.mount(nav, { root, current, onOpen: openFile });
  showContent(current);
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

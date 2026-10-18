import "../styles/base.css";
import "../styles/layout.css";
import "../styles/components.css";
import { api, type State } from "./api.ts";
import { copyButton } from "./copy.ts";
import { askHistory } from "./dialogs.ts";
import { icon } from "./icons.ts";
import { bindKeys } from "./keys.ts";
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

function showFileStatus(path: string | null, file: view.FileView | null) {
  if (!file) {
    fileStatus.replaceChildren();
    return;
  }
  const name = document.createElement("span");
  name.textContent = path;
  const modified = document.createElement("span");
  modified.textContent = new Date(file.modified * 1000).toLocaleString();
  const copyPath = copyButton({ label: "Copy path", iconName: "link", text: () => path! });
  fileStatus.replaceChildren(name, modified, copyPath);
  if (file.family !== "image") {
    const content = async () => {
      const response = await fetch(view.rawUrl(path!));
      if (!response.ok) throw new Error(`the server answered ${response.status}`);
      return response.text();
    };
    fileStatus.append(copyButton({ label: "Copy content", iconName: "copy", text: content }));
  }
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
  showFileStatus(path, null);
  if (path) view.showFile(content, path).then((file) => file && showFileStatus(path, file));
  else view.showNothing(content, sidebar.isEmpty());
}

function openFile(path: string, hash = "") {
  history.pushState(null, "", sidebar.viewUrl(path) + hash);
  sidebar.setCurrent(path);
  sidebar.closeSidebarOverlay();
  showContent(path);
}

// Links in a file point to `/raw/…`; they open here instead. A missing
// file gets the not-found page, a PDF one with a link to the raw file.
content.addEventListener("click", (event) => {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
  const link = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
  if (!link) return;
  const url = new URL(link.href);
  const path = url.origin === location.origin ? view.rawPath(url.pathname) : null;
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
  await sidebar.mount(nav, { root, current, onOpen: openFile });
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

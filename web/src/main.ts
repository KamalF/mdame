import "../styles/base.css";
import "../styles/layout.css";
import "../styles/components.css";
import { api, type State } from "./api.ts";
import { askHistory } from "./dialogs.ts";
import { icon } from "./icons.ts";
import { bindKeys } from "./keys.ts";
import * as picker from "./picker.ts";
import * as sidebar from "./sidebar.ts";

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

function showContent(path: string | null) {
  const line = document.createElement("p");
  line.className = "mdame-placeholder";
  line.textContent = path
    ? `${path}: viewing files comes in milestone 4.`
    : "Choose a file in the sidebar.";
  content.replaceChildren(line);
}

function openFile(path: string) {
  history.pushState(null, "", sidebar.viewUrl(path));
  sidebar.setCurrent(path);
  sidebar.closeSidebarOverlay();
  showContent(path);
}

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

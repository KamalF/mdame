import "../styles/base.css";
import "../styles/components.css";
import { api, type State } from "./api.ts";
import { askHistory } from "./dialogs.ts";
import * as picker from "./picker.ts";

const app = document.getElementById("mdame-app") as HTMLElement;
const status = document.getElementById("mdame-status") as HTMLElement;

function showStatus(state: State) {
  const workspace = document.createElement("span");
  workspace.textContent = state.workspace ? state.workspace.root : "No workspace";
  const version = document.createElement("span");
  version.textContent = state.version;
  status.replaceChildren(workspace, version);
}

function showWorkspace(state: State) {
  const { root, start } = state.workspace!;
  if (start && location.pathname === "/") {
    history.pushState(null, "", `/view/${encodeURIComponent(start)}`);
  }
  const line = document.createElement("p");
  line.className = "mdame-placeholder";
  line.textContent = `${root} is open. Viewing files comes in milestone 4.`;
  app.replaceChildren(line);
}

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

import { api } from "./api.ts";

const CHOICES = [
  {
    value: "workspace",
    label: "In the workspace",
    detail: "In a .mdame/ folder that git ignores. The revisions move with the folder.",
  },
  {
    value: "state",
    label: "In your state folder",
    detail: "In ~/.local/state/mdame/. Nothing is added to the workspace.",
  },
];

/** Asks once where to keep revisions. Esc saves the selected choice too. */
export function askHistory() {
  const dialog = document.createElement("dialog");
  dialog.className = "mdame-dialog";
  dialog.setAttribute("aria-labelledby", "mdame-setup-title");

  const form = document.createElement("form");
  form.method = "dialog";

  const title = document.createElement("h2");
  title.id = "mdame-setup-title";
  title.textContent = "Where should mdame keep revisions?";
  const intro = document.createElement("p");
  intro.textContent = "mdame saves the previous version of a file each time you save it.";

  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.className = "mdame-hidden";
  legend.textContent = "Revision location";
  fieldset.append(legend);
  for (const [index, choice] of CHOICES.entries()) {
    const label = document.createElement("label");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "history";
    radio.value = choice.value;
    radio.checked = index === 0;
    const text = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = choice.label;
    const detail = document.createElement("span");
    detail.textContent = choice.detail;
    text.append(strong, detail);
    label.append(radio, text);
    fieldset.append(label);
  }

  const note = document.createElement("p");
  note.className = "mdame-dialog-note";
  note.textContent =
    "You can change this later in ~/.config/mdame/config.toml. Old revisions do not move.";

  const error = document.createElement("p");
  error.className = "mdame-dialog-error";
  error.setAttribute("role", "alert");

  const actions = document.createElement("div");
  actions.className = "mdame-dialog-actions";
  const button = document.createElement("button");
  button.textContent = "Continue";
  actions.append(button);

  form.append(title, intro, fieldset, note, error, actions);
  dialog.append(form);
  document.body.append(dialog);

  // "close" follows both Continue and Esc.
  dialog.addEventListener("close", async () => {
    const history = (form.elements.namedItem("history") as RadioNodeList).value;
    try {
      await api("PUT", "/api/settings", { history });
      dialog.remove();
    } catch (failure) {
      error.textContent = (failure as Error).message;
      dialog.showModal();
    }
  });
  dialog.showModal();
  button.focus();
}

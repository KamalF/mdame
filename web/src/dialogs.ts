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

/** Shows a modal dialog: its title, `body`, then `buttons`. */
function modal(id: string, heading: string, body: Node[], buttons: HTMLButtonElement[]) {
  const dialog = document.createElement("dialog");
  dialog.className = "mdame-dialog";
  dialog.setAttribute("aria-labelledby", id);
  const form = document.createElement("form");
  form.method = "dialog";
  const title = document.createElement("h2");
  title.id = id;
  title.textContent = heading;
  const actions = document.createElement("div");
  actions.className = "mdame-dialog-actions";
  actions.append(...buttons);
  form.append(title, ...body, actions);
  dialog.append(form);
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, form };
}

function errorLine(): HTMLParagraphElement {
  const error = document.createElement("p");
  error.className = "mdame-dialog-error";
  error.setAttribute("role", "alert");
  return error;
}

/** Asks once where to keep revisions. Esc saves the selected choice too. */
export function askHistory() {
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

  const error = errorLine();
  const button = document.createElement("button");
  button.textContent = "Continue";
  const { dialog, form } = modal(
    "mdame-setup-title",
    "Where should mdame keep revisions?",
    [intro, fieldset, note, error],
    [button],
  );

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
  button.focus();
}

/** Asks before unsaved edits are lost. Resolves true to discard them. */
export function confirmDiscard(): Promise<boolean> {
  const intro = document.createElement("p");
  intro.textContent = "The changes since the last save will be lost.";
  const keep = document.createElement("button");
  keep.value = "keep";
  keep.className = "is-secondary";
  keep.textContent = "Keep editing";
  const discard = document.createElement("button");
  discard.value = "discard";
  discard.textContent = "Discard";
  const { dialog } = modal(
    "mdame-discard-title",
    "Discard unsaved changes?",
    [intro],
    [keep, discard],
  );
  keep.focus();
  // Esc closes with an empty returnValue: it keeps the edits.
  return new Promise((resolve) => {
    dialog.addEventListener("close", () => {
      dialog.remove();
      resolve(dialog.returnValue === "discard");
    });
  });
}

/**
 * The path of a new file from what the user typed: a name with no
 * extension gets `.md`. Null when the name is empty.
 */
export function newFilePath(input: string): string | null {
  // The server creates docs/a.md for docs//a.md, and live events name
  // docs/a.md: the editor must hold the same path.
  const path = input.trim().replace(/\/{2,}/g, "/");
  const name = path.slice(path.lastIndexOf("/") + 1);
  if (!name) return null;
  // A leading dot starts a hidden name, not an extension.
  return name.lastIndexOf(".") > 0 ? path : `${path}.md`;
}

/**
 * Asks for the path of a new file, starting in `folder`, and creates it.
 * Resolves to its path, or null if the user cancels.
 */
export function askNewFile(folder: string): Promise<string | null> {
  const field = document.createElement("input");
  field.type = "text";
  field.setAttribute("aria-labelledby", "mdame-new-title");
  field.autocomplete = "off";
  field.spellcheck = false;
  field.value = folder ? `${folder}/` : "";
  const note = document.createElement("p");
  note.className = "mdame-dialog-note";
  note.textContent = "The path starts at the workspace folder. A name with no extension gets .md.";

  const error = errorLine();
  // Not a submit button: Enter in the field must create, not cancel.
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "is-secondary";
  cancel.textContent = "Cancel";
  const create = document.createElement("button");
  create.value = "create";
  create.textContent = "Create";
  const { dialog } = modal("mdame-new-title", "New file", [field, note, error], [cancel, create]);
  cancel.addEventListener("click", () => dialog.close());
  field.focus();

  return new Promise((resolve) => {
    const retry = (message: string) => {
      error.textContent = message;
      dialog.showModal();
    };
    dialog.addEventListener("close", async () => {
      if (dialog.returnValue !== "create") {
        dialog.remove();
        resolve(null);
        return;
      }
      // Esc keeps the last returnValue: without this, it would create.
      dialog.returnValue = "";
      const path = newFilePath(field.value);
      if (path === null) {
        retry("Type a name for the file.");
        return;
      }
      try {
        await api("POST", "/api/file", { path });
        dialog.remove();
        resolve(path);
      } catch (failure) {
        retry((failure as Error).message);
      }
    });
  });
}

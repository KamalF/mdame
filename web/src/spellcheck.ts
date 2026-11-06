import { Compartment, type Extension } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { load, store } from "./storage.ts";

const KEY = "mdame:spellcheck";
const compartment = new Compartment();
/** The editors on screen: a new choice applies to them at once. */
const views = new Set<EditorView>();

/** On, unless the user turned it off. */
export function chosenSpellcheck(stored: unknown): boolean {
  return stored !== false;
}

export function spellcheckOn(): boolean {
  return chosenSpellcheck(load<unknown>(KEY, null));
}

/** CodeMirror turns the browser's spellcheck off by default. */
function attribute(on: boolean): Extension {
  return EditorView.contentAttributes.of({ spellcheck: String(on) });
}

/** The extension of an editor, whose spellcheck follows the choice. */
export function spellcheck(): Extension {
  return [
    compartment.of(attribute(spellcheckOn())),
    ViewPlugin.define((view) => {
      views.add(view);
      return { destroy: () => views.delete(view) };
    }),
  ];
}

export function chooseSpellcheck(on: boolean) {
  store(KEY, on);
  for (const view of views) view.dispatch({ effects: compartment.reconfigure(attribute(on)) });
}

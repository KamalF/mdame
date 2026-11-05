import { isWithin, type LiveEvent, movedPath } from "./live.ts";

const MARKDOWN = /\.(md|markdown)$/i;

/** The markdown files that changed on disk while the tab is open, newest
 * first. The tab keeps it in memory only. */
export class ChangeList {
  #paths: string[] = [];

  get paths(): readonly string[] {
    return this.#paths;
  }

  /** Takes in a live event. `open` is the file on screen, which is never
   * listed: the page shows its change already. */
  apply(event: LiveEvent, open: string | null) {
    if (event.type === "resync") return;
    if (event.type === "renamed") {
      const moved = this.#paths.map((path) => movedPath(path, event.from, event.to) ?? path);
      // A program that saves by renaming a new file over the path moves
      // nothing that the list holds: that is a change to the path.
      if (moved.every((path, index) => path === this.#paths[index])) {
        this.#add(event.to, open);
      } else {
        // A file moved over a listed one: the list keeps one entry.
        this.#paths = moved.filter(
          (path, index) => moved.indexOf(path) === index && MARKDOWN.test(path),
        );
      }
    } else if (event.type === "removed") {
      this.#paths = this.#paths.filter((path) => !isWithin(path, event.path));
    } else {
      this.#add(event.path, open);
    }
  }

  /** The tab opened `path`, from anywhere: it leaves the list. */
  opened(path: string) {
    this.#paths = this.#paths.filter((listed) => listed !== path);
  }

  clear() {
    this.#paths = [];
  }

  #add(path: string, open: string | null) {
    if (path === open || !MARKDOWN.test(path)) return;
    this.#paths = [path, ...this.#paths.filter((listed) => listed !== path)];
  }
}

/**
 * The status bar's item for the list. With one file, it shows its name,
 * and a click opens it. With several, it shows the newest name and `+N`,
 * and a click opens a menu of them, newest first, with Clear at the end.
 */
export function changesItem(open: (path: string) => void, clear: () => void) {
  const wrapper = document.createElement("span");
  wrapper.className = "mdame-changes";
  const button = document.createElement("button");
  button.className = "mdame-changes-button";
  const menu = document.createElement("div");
  menu.className = "mdame-menu";
  menu.popover = "auto";
  let paths: readonly string[] = [];

  // With several files, the button opens the menu as its popover target.
  button.addEventListener("click", () => {
    if (paths.length === 1) open(paths[0]);
  });

  function renderMenu() {
    const items = paths.map((path) => {
      const item = document.createElement("button");
      item.textContent = path;
      item.addEventListener("click", () => {
        menu.hidePopover();
        open(path);
      });
      return item;
    });
    const clearItem = document.createElement("button");
    clearItem.className = "mdame-menu-separated";
    clearItem.textContent = "Clear";
    clearItem.addEventListener("click", () => {
      menu.hidePopover();
      clear();
    });
    menu.replaceChildren(...items, clearItem);
  }

  menu.addEventListener("beforetoggle", (event) => {
    if ((event as ToggleEvent).newState !== "open") return;
    renderMenu();
    // Above the button, at its right edge: the status bar is at the bottom.
    const rect = button.getBoundingClientRect();
    menu.style.right = `${innerWidth - rect.right}px`;
    menu.style.bottom = `${innerHeight - rect.top + 4}px`;
  });

  /** Shows `next`, newest first. */
  function update(next: readonly string[]) {
    paths = next;
    if (paths.length === 0) {
      if (menu.matches(":popover-open")) menu.hidePopover();
      wrapper.replaceChildren();
      return;
    }
    const newest = paths[0];
    const name = newest.slice(newest.lastIndexOf("/") + 1);
    button.textContent = paths.length === 1 ? name : `${name} +${paths.length - 1}`;
    button.title =
      paths.length === 1
        ? `Changed on disk: ${newest}`
        : `${paths.length} files changed on disk`;
    button.popoverTargetElement = paths.length > 1 ? menu : null;
    if (paths.length === 1 && menu.matches(":popover-open")) menu.hidePopover();
    else if (menu.matches(":popover-open")) renderMenu();
    // Taken out of the page, even for a moment, an open menu closes.
    if (!wrapper.hasChildNodes()) wrapper.append(button, menu);
  }

  return { el: wrapper, update };
}

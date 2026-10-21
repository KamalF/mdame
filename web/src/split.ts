import { load, store } from "./storage.ts";

const MIN = 0.2;
const MAX = 0.8;

function clamp(fraction: number): number {
  return Math.min(MAX, Math.max(MIN, fraction));
}

/** Makes `divider` resize the first pane of `split`, as a fraction of its
 * width, remembered across pages. */
export function setupSplit(split: HTMLElement, divider: HTMLElement) {
  let fraction = MIN;

  function setFraction(next: number) {
    fraction = clamp(next);
    split.style.setProperty("--split", String(fraction));
    divider.setAttribute("aria-valuenow", String(Math.round(fraction * 100)));
  }

  divider.setAttribute("role", "separator");
  divider.setAttribute("aria-orientation", "vertical");
  divider.setAttribute("aria-label", "Editor width");
  divider.setAttribute("aria-valuemin", String(MIN * 100));
  divider.setAttribute("aria-valuemax", String(MAX * 100));
  divider.tabIndex = 0;
  setFraction(Number(load("mdame:split", 0.5)) || 0.5);

  divider.addEventListener("pointerdown", (event) => {
    divider.setPointerCapture(event.pointerId);
    const box = split.getBoundingClientRect();
    const move = (moved: PointerEvent) => setFraction((moved.clientX - box.left) / box.width);
    split.classList.add("is-resizing");
    divider.addEventListener("pointermove", move);
    divider.addEventListener(
      "lostpointercapture",
      () => {
        divider.removeEventListener("pointermove", move);
        split.classList.remove("is-resizing");
        store("mdame:split", fraction);
      },
      { once: true },
    );
  });

  divider.addEventListener("keydown", (event) => {
    const step = ({ ArrowLeft: -0.05, ArrowRight: 0.05 } as Record<string, number>)[event.key];
    if (!step) return;
    event.preventDefault();
    setFraction(fraction + step);
    store("mdame:split", fraction);
  });
}

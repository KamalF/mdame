// A classic script in <head>, run before the first paint. `main.js` is a
// module, which runs once the page is parsed: the browser may have painted
// the system's theme by then.
import { apply } from "./stylesheets.ts";

apply(true);

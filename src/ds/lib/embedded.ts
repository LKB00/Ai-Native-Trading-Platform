import { createContext } from "react";

/**
 * True inside documentation previews. Page-level components such as AppShell render plain
 * containers instead of landmarks (main, aside) there, so a docs page keeps one main landmark.
 */
export const EmbeddedContext = createContext(false);

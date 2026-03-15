/**
 * Tiptap extension for [[wikilink]] syntax with autocomplete.
 *
 * - Renders [[Note Title]] as a styled inline element
 * - Typing [[ triggers autocomplete popup with note titles
 * - Selecting a note inserts [[Note Title]]
 */

import { Node, mergeAttributes } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

/**
 * Decoration plugin that highlights [[wikilinks]] in the editor
 */
const wikilinkDecorationPlugin = new PluginKey("wikilinkDecoration");

const createDecorationPlugin = () =>
  new Plugin({
    key: wikilinkDecorationPlugin,
    state: {
      init(_, state) {
        return buildDecorations(state.doc);
      },
      apply(tr, oldDecorations) {
        if (tr.docChanged) {
          return buildDecorations(tr.doc);
        }
        return oldDecorations;
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const buildDecorations = (doc: any): DecorationSet => {
  const decorations: Decoration[] = [];

  doc.descendants((node: { isText: boolean; text?: string }, pos: number) => {
    if (!node.isText || !node.text) return;

    const re = /\[\[([^\]]+)\]\]/g;
    let match;
    while ((match = re.exec(node.text)) !== null) {
      const from = pos + match.index;
      const to = from + match[0].length;
      decorations.push(
        Decoration.inline(from, to, {
          class: "wikilink",
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
};

/**
 * Wikilink node extension — renders [[...]] with styling
 */
export const WikilinkDecoration = Node.create({
  name: "wikilinkDecoration",

  addProseMirrorPlugins() {
    return [createDecorationPlugin()];
  },
});

export default WikilinkDecoration;

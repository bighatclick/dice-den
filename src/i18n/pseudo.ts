/**
 * Pseudo-locale "xx" (specs.md §11): every letter accented and each string about
 * 40% longer, so hard-coded text and layouts that can't grow stand out.
 */
const ACCENTED: Record<string, string> = Object.fromEntries(
  [...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c, i) => [
    c,
    [...'áƀçďéƒĝĥíĵķĺɱñóþǫŕšţúṽŵẋýžÁƁÇĎÉƑĜĤÍĴĶĹṀÑÓÞǪŔŠŢÚṼŴẊÝŽ'][i],
  ]),
);

const PLACEHOLDER = /(\{\{[^}]+\}\})/;

export function pseudoString(text: string): string {
  const body = text
    .split(PLACEHOLDER)
    .map((part) => (PLACEHOLDER.test(part) ? part : [...part].map((c) => ACCENTED[c] ?? c).join('')))
    .join('');
  const pad = '~'.repeat(Math.ceil(text.length * 0.4));
  return `[${body}${pad}]`;
}

type Tree = { [key: string]: string | Tree };

export function pseudoLocalize(tree: Tree): Tree {
  return Object.fromEntries(
    Object.entries(tree).map(([k, v]) => [k, typeof v === 'string' ? pseudoString(v) : pseudoLocalize(v)]),
  );
}

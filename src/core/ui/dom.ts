type Child = Node | string | null | undefined | false;

export interface ElementProps {
  className?: string;
  text?: string;
  attrs?: Record<string, string>;
}

/** Atajo para crear elementos DOM: `h('div', { className: 'card' }, [hijos])`. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps = {},
  children: Child[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.className) el.className = props.className;
  if (props.text !== undefined) el.textContent = props.text;
  if (props.attrs) for (const [name, value] of Object.entries(props.attrs)) el.setAttribute(name, value);
  for (const child of children) if (child) el.append(child);
  return el;
}

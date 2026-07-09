/** Join class names, dropping falsy values. Lightweight shadcn-style `cn`. */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
}

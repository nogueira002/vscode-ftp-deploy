export const DEFAULT_EXCLUDES = [
  "node_modules",
  ".git",
  ".cache",
  "backups",
  "logs",
  ".DS_Store",
];

export function isExcludedName(name: string): boolean {
  return DEFAULT_EXCLUDES.includes(name);
}

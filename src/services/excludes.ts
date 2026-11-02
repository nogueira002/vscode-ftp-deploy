export const DEFAULT_EXCLUDES = [
  "node_modules",
  ".git",
  ".cache",
  "backups",
  "logs",
  ".DS_Store",
  "venv",
  ".venv",
  "__pycache__",
];

export function isExcludedName(name: string): boolean {
  return DEFAULT_EXCLUDES.includes(name);
}

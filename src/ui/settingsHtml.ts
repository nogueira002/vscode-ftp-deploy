import { Connection } from "../types";

export function renderSettings(
  connections: Connection[],
  autoUpload: boolean
): string {
  const rows = connections.length
    ? connections.map(serverRow).join("")
    : `<p class="empty">No servers configured yet.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); }
  h2 { margin-top: 0; }
  .section { margin-bottom: 24px; }
  .toggle { display:flex; align-items:center; gap: 10px; }
  .toggle input { width: 16px; height: 16px; }
  .hint { font-size: 11px; opacity: .6; margin-top: 4px; }
  .server {
    display:flex; align-items:center; justify-content:space-between;
    padding: 10px 12px; border: 1px solid var(--vscode-widget-border, rgba(128,128,128,.25));
    border-radius: 6px; margin-bottom: 8px;
  }
  .server .info { display:flex; flex-direction:column; }
  .server .name { font-weight: 600; }
  .server .meta { font-size: 12px; opacity: .7; }
  .server .actions { display:flex; gap: 6px; }
  button {
    padding: 5px 12px; border: none; border-radius: 3px; cursor: pointer;
    background: var(--vscode-button-background); color: var(--vscode-button-foreground);
  }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  .empty { opacity: .6; }
</style>
</head>
<body>
  <h2>FTP Deploy — Settings</h2>

  <div class="section">
    <label class="toggle">
      <input type="checkbox" id="autoUpload" ${autoUpload ? "checked" : ""}>
      Auto-upload on save
    </label>
    <div class="hint">When on, saving a file uploads it to a server. With several
      servers it asks which one (once per file per session).</div>
  </div>

  <div class="section">
    <h3>Servers</h3>
    ${rows}
    <button id="add">+ Add server</button>
  </div>

<script>
  const vscode = acquireVsCodeApi();
  document.getElementById("autoUpload").addEventListener("change", (e) => {
    vscode.postMessage({ type: "toggleAuto", value: e.target.checked });
  });
  document.getElementById("add").addEventListener("click", () => {
    vscode.postMessage({ type: "add" });
  });
  for (const el of document.querySelectorAll("[data-action]")) {
    el.addEventListener("click", () => {
      vscode.postMessage({ type: el.getAttribute("data-action"), id: el.getAttribute("data-id") });
    });
  }
</script>
</body>
</html>`;
}

function serverRow(conn: Connection): string {
  const name = escapeHtml(conn.name);
  const meta = escapeHtml(`${conn.protocol} · ${conn.host} · ${conn.remotePath}`);
  return `<div class="server">
    <div class="info">
      <span class="name">${name}</span>
      <span class="meta">${meta}</span>
    </div>
    <div class="actions">
      <button class="secondary" data-action="test" data-id="${conn.id}">Test</button>
      <button class="secondary" data-action="edit" data-id="${conn.id}">Edit</button>
      <button class="secondary" data-action="remove" data-id="${conn.id}">Remove</button>
    </div>
  </div>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

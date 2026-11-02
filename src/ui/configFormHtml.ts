import { Connection } from "../types";

export function renderConfigForm(existing?: Connection): string {
  const value = (text?: string) => (text ? escapeHtml(text) : "");
  const selected = (protocol: string) =>
    existing?.protocol === protocol ? "selected" : "";
  const passwordHint = existing?.hasPassword
    ? "(guardada — deixa vazio para manter)"
    : "";
  const passphraseHint = existing?.hasPassphrase
    ? "(guardada — deixa vazio para manter)"
    : "";

  return `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body { font-family: var(--vscode-font-family); padding: 20px; color: var(--vscode-foreground); }
  h2 { margin-top: 0; }
  label { display:block; margin: 12px 0 4px; font-size: 12px; opacity: .85; }
  input, select {
    width: 100%; box-sizing: border-box; padding: 6px 8px;
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent); border-radius: 3px;
  }
  .row { display:flex; gap: 12px; }
  .row > div { flex: 1; }
  .buttons { margin-top: 20px; display:flex; gap: 10px; }
  button {
    padding: 7px 16px; border: none; border-radius: 3px; cursor: pointer;
    background: var(--vscode-button-background); color: var(--vscode-button-foreground);
  }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  #status { margin-top: 16px; padding: 10px; border-radius: 3px; display:none; white-space: pre-wrap; }
  #status.ok { display:block; background: rgba(46,160,67,.15); border: 1px solid rgba(46,160,67,.5); }
  #status.err { display:block; background: rgba(248,81,73,.15); border: 1px solid rgba(248,81,73,.5); }
  #status.info { display:block; background: var(--vscode-editorWidget-background); }
  .hint { font-size: 11px; opacity: .6; margin-top: 2px; }
</style>
</head>
<body>
  <h2>${existing ? "Editar servidor" : "Novo servidor"}</h2>

  <label>Nome</label>
  <input id="name" value="${value(existing?.name)}" placeholder="O meu servidor">

  <div class="row">
    <div>
      <label>Protocolo</label>
      <select id="protocol">
        <option value="sftp" ${selected("sftp")}>SFTP (SSH)</option>
        <option value="ftp" ${selected("ftp")}>FTP</option>
      </select>
    </div>
    <div>
      <label>Porta</label>
      <input id="port" type="number" value="${existing?.port ?? 22}">
    </div>
  </div>

  <label>Host</label>
  <input id="host" value="${value(existing?.host)}" placeholder="exemplo.com ou 1.2.3.4">

  <label>Utilizador</label>
  <input id="username" value="${value(existing?.username)}" placeholder="utilizador">

  <label>Password</label>
  <input id="password" type="password" placeholder="${passwordHint}">
  <div class="hint">Guardada no cofre seguro do VS Code (SecretStorage).</div>

  <label>Caminho da chave privada (SFTP, opcional)</label>
  <input id="privateKeyPath" value="${value(existing?.privateKeyPath)}" placeholder="/Users/tu/.ssh/id_ed25519">

  <label>Passphrase da chave (opcional)</label>
  <input id="passphrase" type="password" placeholder="${passphraseHint}">

  <label>Pasta remota</label>
  <input id="remotePath" value="${value(existing?.remotePath) || "/"}" placeholder="/public_html">

  <div class="buttons">
    <button class="secondary" id="btnTest">Testar ligacao</button>
    <button id="btnSave">Guardar</button>
  </div>

  <div id="status"></div>

<script>
  const vscode = acquireVsCodeApi();
  const ids = ["name","protocol","port","host","username","password","privateKeyPath","passphrase","remotePath"];
  function collect() {
    const data = {};
    for (const id of ids) { data[id] = document.getElementById(id).value; }
    return data;
  }
  function setStatus(cls, text) {
    const el = document.getElementById("status");
    el.className = cls; el.textContent = text;
  }
  document.getElementById("protocol").addEventListener("change", (e) => {
    document.getElementById("port").value = e.target.value === "ftp" ? 21 : 22;
  });
  document.getElementById("btnTest").addEventListener("click", () => {
    vscode.postMessage({ type: "test", data: collect() });
  });
  document.getElementById("btnSave").addEventListener("click", () => {
    vscode.postMessage({ type: "save", data: collect() });
  });
  window.addEventListener("message", (ev) => {
    const m = ev.data;
    if (m.type === "testing") { setStatus("info", "A ligar..."); }
    else if (m.type === "testResult") { setStatus(m.ok ? "ok" : "err", m.message); }
  });
</script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

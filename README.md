# FTP Deploy Connector

![Build](https://github.com/nogueira002/vscode-ftp-deploy/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.85-blue.svg)

Extensao de VS Code que traz para o editor um fluxo de **deployment estilo
PhpStorm**: configurar servidores por **SFTP/FTP** num painel visual, navegar os
ficheiros remotos numa **arvore** na barra lateral e fazer **download/upload**.

> Nasceu da frustracao de o VS Code nao ter, de origem, um painel de ligacao ao
> servidor como o do PhpStorm. Esta extensao preenche essa lacuna.

## Funcionalidades

- **Painel de configuracao visual** com botao **Testar ligacao** — sem editar
  ficheiros JSON a mao.
- **Arvore de ficheiros remotos** na barra lateral: navega pastas e abre
  ficheiros do servidor.
- **Download** de ficheiros e pastas (remoto para local).
- **Upload** do ficheiro aberto (local para remoto).
- Suporte a **SFTP** (com chave privada e passphrase) e a **FTP**.
- Passwords e passphrases guardadas no **SecretStorage cifrado** do VS Code —
  nunca em texto simples.

## Instalacao

### Opcao A — ficheiro `.vsix` (utilizacao normal)

1. Descarrega o `.vsix` mais recente da pagina de
   [Releases](https://github.com/nogueira002/vscode-ftp-deploy/releases)
   (ou gera-o com os passos da Opcao B).
2. Instala, de uma de duas maneiras:
   - **Interface:** `Cmd/Ctrl+Shift+X` -> menu `...` (canto superior) ->
     **Install from VSIX...** -> escolhe o ficheiro.
   - **Terminal:**
     ```bash
     code --install-extension ftp-deploy-connector-0.1.0.vsix
     ```
3. Recarrega a janela (`Developer: Reload Window`). O icone **FTP Deploy**
   aparece na barra de atividades.

Para gerar o proprio `.vsix` a partir do codigo:

```bash
npm install
npx @vscode/vsce package
```

### Opcao B — a partir do codigo (desenvolvimento)

```bash
git clone https://github.com/nogueira002/vscode-ftp-deploy.git
cd vscode-ftp-deploy
npm install
npm run compile
```

Abre a pasta no VS Code e carrega **F5**. Abre uma segunda janela
(*Extension Development Host*) com a extensao ja carregada.

## Como usar

1. Abre a pasta do teu projeto (destino dos downloads).
2. Clica no icone **FTP Deploy** na barra de atividades (esquerda).
3. Botao **+** (Adicionar servidor) -> preenche o formulario -> **Testar
   ligacao** -> **Guardar**.
4. Expande o servidor na arvore para navegar o remoto.
5. Botao direito num ficheiro/pasta -> **Download**. Com um ficheiro local
   aberto, usa o comando `FTP Deploy: Upload do ficheiro aberto`.

## Comandos

| Comando | Accao |
|---|---|
| `FTP Deploy: Adicionar servidor` | Abre o painel de configuracao |
| `FTP Deploy: Testar ligacao` | Liga e lista a pasta remota |
| `FTP Deploy: Download (remoto -> local)` | Descarrega ficheiro/pasta |
| `FTP Deploy: Upload do ficheiro aberto` | Envia o ficheiro ativo |
| `FTP Deploy: Atualizar` | Recarrega a arvore |

## Seguranca

- Passwords e passphrases ficam no **SecretStorage** do VS Code, cifrado pelo
  sistema operativo.
- A restante configuracao (host, utilizador, porta, caminhos) fica no
  `globalState` da extensao.
- Nenhum segredo e escrito no `package.json` nem em ficheiros do projeto.

## Roadmap

- [ ] Upload automatico ao gravar (uploadOnSave)
- [ ] Sincronizacao de pastas com comparacao de datas
- [ ] Suporte a FTPS (FTP sobre TLS)
- [ ] Mapeamentos local <-> remoto por pasta
- [ ] Publicacao no VS Code Marketplace

## Contribuir

Contribuicoes sao bem-vindas! Ve o [CONTRIBUTING.md](CONTRIBUTING.md).

## Licenca

[MIT](LICENSE) (c) 2026 Ricardo Nogueira

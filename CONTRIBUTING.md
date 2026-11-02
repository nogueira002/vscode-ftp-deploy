# Como contribuir

Obrigado pelo interesse em melhorar o FTP Deploy Connector!

## Ambiente de desenvolvimento

1. Faz fork e clona o repositorio.
2. Instala as dependencias:
   ```bash
   npm install
   ```
3. Compila (ou deixa a compilar em modo watch):
   ```bash
   npm run watch
   ```
4. Carrega **F5** no VS Code para abrir o *Extension Development Host* com a
   extensao carregada.

## Estrutura do codigo

| Ficheiro | Responsabilidade |
|---|---|
| `src/extension.ts` | Ponto de entrada; liga as pecas |
| `src/commands.ts` | Regista os comandos e trata da interface |
| `src/types.ts` | Modelo de dados |
| `src/remote/RemoteClient.ts` | Interface comum de cliente remoto |
| `src/remote/SftpClient.ts` | Implementacao SFTP |
| `src/remote/FtpClient.ts` | Implementacao FTP |
| `src/remote/clientFactory.ts` | Escolhe a implementacao pelo protocolo |
| `src/services/TransferService.ts` | Download, upload e teste de ligacao |
| `src/storage/ConnectionStore.ts` | Persistencia e segredos |
| `src/ui/RemoteTreeProvider.ts` | Arvore da barra lateral |
| `src/ui/ConfigPanel.ts` | Logica do painel de configuracao |
| `src/ui/configFormHtml.ts` | HTML do formulario |

## Antes de abrir um Pull Request

- Garante que `npm run compile` corre sem erros.
- Descreve claramente o que mudaste e porque.
- Uma funcionalidade ou correcao por PR, sempre que possivel.

## Reportar problemas

Abre uma [issue](https://github.com/nogueira002/vscode-ftp-deploy/issues)
com passos para reproduzir, a versao do VS Code e o sistema operativo.

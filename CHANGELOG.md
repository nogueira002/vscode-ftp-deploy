# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project
follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-11-02

### Added
- Settings page (gear icon in the view) to manage servers and toggle
  auto-upload.
- Upload via right-click on a file or folder in the Explorer (and in the editor).
  With several servers it asks which one.
- Auto-upload on save (on by default). With several servers it asks which one,
  once per file per session.
- Folder upload (recursive) over SFTP and FTP.

## [0.1.0] - 2026-11-02

### Added
- Configure servers over SFTP and FTP through a visual panel with a
  "Test connection" button.
- Remote file tree in the sidebar (PhpStorm-style browsing).
- Download files and folders (remote to local).
- Upload the active file (local to remote).
- Open remote files directly in the editor.
- Passwords and passphrases stored in the VS Code encrypted SecretStorage.

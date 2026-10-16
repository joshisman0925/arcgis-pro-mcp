---
name: setup
description: Install, diagnose, or update the local ArcGIS Pro Add-in required by ArcGIS Pro MCP. Use when setting up this plugin on a Windows computer, when the connection is missing, or when the loaded Add-in is older than the bundled package.
---

Use native Windows tools. This integration requires Windows, Node.js 20+ and licensed ArcGIS Pro. A browser-only assistant cannot install local software.

1. Find the installed plugin root from the host context. Inspect `scripts/install-addin.ps1` and `native/checksums.json` in that root before executing setup. The plugin bundles its own MCP dependencies; do not run npm install or download an unpinned runtime at session startup.
2. Run the bundled installer with `-CheckOnly` to inspect the Pro version and installed package. It does not change settings. Pro 3.3 is tested; later 3.x are forward-compatibility candidates. Do not claim they were tested. Pro 3.0–3.2 and 2.x are not supported by this binary; do not just edit desktopVersion to bypass this.
3. If an update is needed, ask the user to save their work and close Pro. Never kill Pro or save unrelated GIS edits. Run the bundled installer without `-CheckOnly` only within the user's installation request. It installs this add-in in the user's Documents/ArcGIS/AddIns folder and backs up the previous package. Respect organization signing policies; do not disable them.
4. Ask the user to normally open Pro and a map. Day-to-day use does not require VSCode F5. Use list_sessions, ping, get_map to verify the loaded version and capabilities. Installer success alone is not runtime verification.
5. The host manages this plugin's MCP entry. Do not add a second manual MCP entry if the plugin already provides it. If migrating an existing manual entry, back it up and disable only this connector's duplicate after the plugin has been verified.
6. Report actual versions, verified steps, and remaining prerequisites. Do not change user data or run editing tools as part of installation.

For an existing installation, read the bundled `UPDATE-PROMPT.md`. Identify the installation source and active MCP path before updating. Use the host's documented marketplace/plugin update mechanism; never guess update commands or edit managed plugin caches. A marketplace sync alone does not prove the active plugin was updated. For a manual ZIP installation, verify the release SHA-256, keep the old directory and back up the connector configuration before switching paths. Do not create duplicate MCP entries.

Installation and upgrade share `scripts/install-addin.ps1`. Its `-CheckOnly` output includes `installedVersion`, `packageVersion`, `packageAlreadyMatches`, `updateRequired`, and `downgradeBlocked`. A newer installed Add-in must not be automatically replaced by an older bundle. Matching hashes skip installation; matching version numbers alone do not. Verify the actual MCP initialization version and loaded Add-in version/actions after reconnecting. Preserve old packages and backups for recovery; report incomplete steps explicitly.

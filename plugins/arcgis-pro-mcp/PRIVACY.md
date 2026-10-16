# Privacy Policy

Effective date: 2026-10-16. Maintainer: joshisman0925. Support and privacy questions: https://github.com/joshisman0925/arcgis-pro-mcp/issues . Do not post confidential GIS data or credentials in public issues.

This connector runs on the user's Windows computer. It has no maintainer-operated backend, accounts, telemetry or analytics. Its MCP Server communicates with the local Pro Add-in through a same-user Windows Named Pipe. It does not listen on a network port.

When invoked, tools may read project paths, map and layer names, data source paths, schemas, selected IDs, bounded attribute rows, renderer definitions, raster metadata and camera state. Responses are sent to the AI client that requested them. That client may send them to its model provider under its own settings and privacy terms. This plugin does not control the provider's storage or retention.

Write tools change only what their operation specifies: map settings, requested exports, new geoprocessing outputs, or explicit feature edits. Saving all pending edits or the project is a separate operation with explicit parameters. Pro and connected GIS services may log or store those operations under their own policies. Accessing remote layers can contact Esri or other services already configured by the user.

The production connector does not create persistent query-history files. Renderer restore tokens are retained in Pro process memory, with up to 100 snapshots, and disappear when Pro closes. Generated exports and datasets remain until the user removes them. Installer backups remain in the user's LocalAppData/ArcGISProMcp/backups folder until removed by the user.

Developer test scripts write local validation reports and may retain temporary test datasets. They are not run automatically by installing the plugin. Reports may contain project paths and sample attributes and must be reviewed before sharing. AI client logs are controlled by that client.

Installation may download release files from GitHub; building from source also downloads packages from npm. No access token or password is bundled in the plugin. Organization policies and ArcGIS licensing remain applicable.

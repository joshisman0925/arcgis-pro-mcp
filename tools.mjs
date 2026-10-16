import * as z from 'zod/v4';

const pid = z.number().int().positive().max(Number.MAX_SAFE_INTEGER).describe('Process ID from list_sessions');
const text = z.string().min(1).max(4096);
const name = z.string().min(1).max(255).refine(s => s.trim().length > 0, 'Must not be blank');
const id = z.string().regex(/^[0-9]+$/).refine(s => BigInt(s) <= 9223372036854775807n, 'Must fit Int64');
const scalar = z.union([z.string().max(8192), z.number().finite().refine(n => !Number.isInteger(n) || Number.isSafeInteger(n), 'Use a string for integers beyond JS safe range'), z.boolean(), z.null()]);
const fields = z.array(name).min(1).max(50);
const filter = z.strictObject({ field: name, operator: z.enum(['eq', 'ne', 'gt', 'ge', 'lt', 'le', 'is_null', 'not_null']), value: scalar.optional() })
  .refine(f => ['is_null', 'not_null'].includes(f.operator) || (f.value !== undefined && f.value !== null), 'Comparison requires a non-null value');
const filters = z.array(filter).max(20);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/).describe('RGB hex color, e.g. #FF8800');
const base = { processId: pid };
const layer = { ...base, layerUri: text };
const output = { outputPath: text.describe('Absolute local output path; existing targets are refused'), format: z.enum(['png', 'pdf']), dpi: z.number().int().min(72).max(600).default(150) };
const attributes = z.record(name, scalar).refine(v => Object.keys(v).length > 0 && Object.keys(v).length <= 50, 'Provide 1–50 fields');
const query = { ...layer, fields: fields.optional(), filters: filters.default([]), selectedOnly: z.boolean().default(false), limit: z.number().int().min(1).max(1000).default(100), offset: z.number().int().min(0).max(100000).default(0) };

// name, title, description, strict input shape, readOnly, destructive, idempotent
export const definitions = [
  ['list_sessions', 'List Pro sessions', 'List local Pro processes. Check connector loading with ping.', {}, true, false, true],
  ['ping', 'Check Pro connection', 'Read Add-in version and supported actions.', base, true, false, true],
  ['get_map', 'Read active map', 'Read active map, layer URIs, parent groups, display and selection states.', base, true, false, true],
  ['get_fields', 'Read fields', 'Read field metadata, editability and nullability.', layer, true, false, true],
  ['get_selection', 'Read selected IDs', 'Read count and up to 1000 Object IDs as strings.', layer, true, false, true],
  ['set_visibility', 'Set layer visibility', 'Set display checkbox; does not save project.', { ...layer, visible: z.boolean() }, false, false, true],
  ['rename_layer', 'Rename layer', 'Rename the active-map layer; does not save project.', { ...layer, name }, false, false, true],
  ['query_features', 'Query feature attributes', 'Read bounded attribute rows. Filters are ANDed; no raw SQL. Geometry is excluded.', query, true, false, true],
  ['get_layer_source', 'Read layer source', 'Read source path, dataset, connection availability and TIFF extension. Credentials are omitted.', layer, true, false, true],
  ['select_features', 'Select matching features', 'Select by structured filters or Object IDs. Requires a nonempty filter or ID list.', { ...layer, filters: filters.default([]), objectIds: z.array(id).min(1).max(1000).optional(), mode: z.enum(['new', 'add', 'remove', 'intersect']).default('new') }, false, false, true],
  ['clear_selection', 'Clear feature selection', 'Clear the specified layer selection, or all feature selections in active map when URI is omitted.', { ...base, layerUri: text.optional() }, false, false, true],
  ['zoom_to', 'Zoom map view', 'Zoom to full extent, a layer, or selected features in a layer.', { ...base, target: z.enum(['full', 'layer', 'selection']), layerUri: text.optional() }, false, false, true],
  ['get_renderer', 'Read feature symbology', 'Read feature renderer CIM JSON and create a session-scoped restore token.', layer, true, false, false],
  ['set_simple_renderer', 'Set single-symbol style', 'Set a single color and size/width. Returns a renderer restore token.', { ...layer, color, size: z.number().min(0.1).max(100).default(3) }, false, false, false],
  ['set_graduated_renderer', 'Set graduated colors', 'Classify a numeric field and apply a color ramp; returns a restore token.', { ...layer, field: name, classes: z.number().int().min(2).max(20).default(5), method: z.enum(['NaturalBreaks', 'EqualInterval', 'Quantile']).default('NaturalBreaks'), startColor: color.default('#FFFFCC'), endColor: color.default('#800026') }, false, false, false],
  ['restore_renderer', 'Restore feature symbology', 'Restore a token created for this exact project/map/layer in the same Pro session. Last 100 snapshots retained.', { ...layer, token: text }, false, false, true],
  ['set_transparency', 'Set layer transparency', 'Set transparency from 0 (opaque) to 100 (transparent), returning before/after.', { ...layer, transparency: z.number().min(0).max(100) }, false, false, true],
  ['add_layer', 'Add layer', 'Add a local GIS dataset or HTTPS ArcGIS service to the active map.', { ...base, source: text, name: name.optional(), groupUri: text.optional() }, false, false, false],
  ['remove_layer', 'Remove layer from map', 'Remove a layer or group from map only; never deletes source data. Group removal also removes children from map.', { ...layer, confirm: z.literal(true) }, false, true, false],
  ['create_group', 'Create layer group', 'Create a group in the map or a parent group.', { ...base, name, parentGroupUri: text.optional() }, false, false, false],
  ['move_layer', 'Move layer', 'Move into a group or the map root at a zero-based sibling index.', { ...layer, groupUri: text.optional(), index: z.number().int().min(0).max(10000) }, false, false, true],
  ['list_maps', 'List project maps', 'Read map names, URIs and map types from the current project.', base, true, false, true],
  ['activate_map', 'Activate map', 'Activate an existing map pane or open the map in a new pane.', { ...base, mapUri: text }, false, false, true],
  ['get_raster_info', 'Read raster information', 'Read raster source, extent, cell size, spatial reference, pixel type, band count and NoData.', layer, true, false, true],
  ['get_camera', 'Read view camera', 'Read camera coordinates, spatial reference, heading, pitch, roll and scale.', base, true, false, true],
  ['set_camera', 'Set view camera', 'Change supplied camera properties in current camera spatial reference; omitted values remain unchanged.', { ...base, x: z.number().finite().optional(), y: z.number().finite().optional(), z: z.number().finite().optional(), heading: z.number().min(-360).max(360).optional(), pitch: z.number().min(-90).max(90).optional(), roll: z.number().min(-180).max(180).optional(), scale: z.number().positive().optional() }, false, false, true],
  ['set_layer_elevation', 'Set feature elevation', 'In 3D, set on-ground, relative-to-ground or absolute feature elevation with offset. Returns prior elevation definition.', { ...layer, mode: z.enum(['on_ground', 'relative_to_ground', 'absolute']), offset: z.number().min(-100000).max(100000).default(0) }, false, false, true],
  ['set_vertical_exaggeration', 'Set surface exaggeration', 'In a scene, set exaggeration for a surface URI returned by get_map.', { ...base, surfaceUri: text, factor: z.number().positive().max(100) }, false, false, true],
  ['list_layouts', 'List project layouts', 'Read layout names and URIs.', base, true, false, true],
  ['export_map', 'Export active map', 'Export active view to PNG/PDF. Refuses an existing file and does not save the project.', { ...base, ...output, width: z.number().int().min(100).max(10000).default(1920), height: z.number().int().min(100).max(10000).default(1080) }, false, false, false],
  ['export_layout', 'Export layout', 'Export layout to PNG/PDF at its page size. Refuses an existing file.', { ...base, layoutUri: text, ...output }, false, false, false],
  ['list_geoprocessing_tools', 'List allowed geoprocessing', 'Read the whitelist, required input counts and tool parameters.', base, true, false, true],
  ['run_geoprocessing', 'Run allowed geoprocessing', 'Run Buffer, Clip, Intersect, Project or CopyFeatures. Output must be new; geoprocessing results are persisted independently of project edits. Allow up to 120 seconds.', { ...base, tool: z.enum(['buffer', 'clip', 'intersect', 'project', 'copy_features']), inputLayerUris: z.array(text).min(1).max(10), outputPath: text, distance: z.number().positive().max(10000000).optional(), distanceUnit: z.enum(['Meters', 'Kilometers', 'Feet']).default('Meters'), targetWkid: z.number().int().positive().optional(), confirm: z.literal(true) }, false, true, false],
  ['update_attributes', 'Update explicit feature attributes', 'Edit at most 100 explicit Object IDs using one Pro EditOperation; returns old/new values. Does not save edits. Requires editing enabled.', { ...layer, objectIds: z.array(id).min(1).max(100), values: attributes, expectedValues: attributes.optional(), confirm: z.literal(true) }, false, true, false],
  ['create_feature', 'Create feature', 'Create one feature from Esri JSON geometry with explicit spatial reference and attributes using EditOperation; does not save edits.', { ...layer, geometryJson: z.string().min(2).max(500000), values: z.record(name, scalar).refine(v => Object.keys(v).length <= 50, 'At most 50 fields').default({}), confirm: z.literal(true) }, false, true, false],
  ['get_project_state', 'Read project edit state', 'Read project path, pending edit state and editing-enabled state before saving.', base, true, false, true],
  ['save_edits', 'Save all pending edits', 'Saves ALL current project data edits, including edits outside MCP. Not scoped to the last MCP operation.', { ...base, confirmAllPendingEdits: z.literal(true) }, false, true, false],
  ['save_project', 'Save current project', 'Save all current project map/layout changes to its existing APRX; does not save feature edits.', { ...base, confirmEntireProject: z.literal(true) }, false, true, false],
];

export const toolNames = definitions.map(([name]) => name);
export const legacyActions = new Set(['ping', 'get_map', 'get_fields', 'get_selection', 'set_visibility', 'rename_layer']);

export function inputSchema(name, shape) {
  return z.strictObject(shape).superRefine((args, ctx) => {
    const fail = message => ctx.addIssue({ code: 'custom', message });
    if (name === 'select_features' && !args.filters.length && !args.objectIds?.length) fail('Provide filters or Object IDs');
    if (name === 'zoom_to' && args.target !== 'full' && !args.layerUri) fail('This zoom target requires layerUri');
    if (name === 'set_camera' && Object.keys(args).length === 1) fail('Provide at least one camera property');
    if (['export_map', 'export_layout', 'run_geoprocessing'].includes(name) && (!/^[a-zA-Z]:[\\/]/.test(args.outputPath) || /(^|[\\/])\.\.([\\/]|$)/.test(args.outputPath))) fail('Output must be an absolute local Windows path without traversal');
    if (['export_map', 'export_layout'].includes(name) && !args.outputPath.toLowerCase().endsWith('.' + args.format)) fail('Output extension must match format');
    if (name === 'create_feature') {
      try {
        const geometry = JSON.parse(args.geometryJson);
        if (!geometry || Array.isArray(geometry) || !geometry.spatialReference) fail('Esri JSON geometry requires spatialReference');
      } catch { fail('geometryJson must contain valid JSON'); }
    }
    if (name === 'run_geoprocessing') {
      const count = args.inputLayerUris.length;
      if (['buffer', 'project', 'copy_features'].includes(args.tool) && count !== 1) fail('Tool requires exactly one input');
      if (args.tool === 'clip' && count !== 2 || args.tool === 'intersect' && count < 2) fail('Tool requires two or more inputs; Clip exactly two');
      if (args.tool === 'buffer' && args.distance === undefined) fail('Buffer requires distance');
      if (args.tool === 'project' && args.targetWkid === undefined) fail('Project requires targetWkid');
      if (args.tool !== 'buffer' && args.distance !== undefined) fail('distance only applies to Buffer');
      if (args.tool !== 'project' && args.targetWkid !== undefined) fail('targetWkid only applies to Project');
    }
  });
}

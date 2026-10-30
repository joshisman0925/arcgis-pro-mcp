"""Create the disposable ArcGIS Pro project used by docs/submission/review-test-cases.json.

Everything is synthetic. The script only writes inside --root (default D:/review) and refuses to
touch a non-empty folder that it did not create, so it never edits a user's own APRX or data.
Run with the arc_env ArcPy 3.3+ Python while ArcGIS Pro does not have the review project open:

    python scripts/create-review-fixture.py [--root D:/review] [--replace]
"""
import argparse
import os
import shutil
import sys

import arcpy

MARKER = "DISPOSABLE-REVIEW-FIXTURE.txt"
WKID = 3826  # TWD97 / TM2 zone 121, metres
X0, Y0 = 302000.0, 2770000.0


def prepare_root(root, replace):
    if os.path.isdir(root) and os.listdir(root):
        if not os.path.isfile(os.path.join(root, MARKER)):
            sys.exit(f"{root} is not empty and has no {MARKER}; refusing to touch it")
        if not replace:
            sys.exit(f"{root} already holds a review fixture; pass --replace to rebuild it")
        shutil.rmtree(root)
    os.makedirs(os.path.join(root, "exports"))
    with open(os.path.join(root, MARKER), "w", encoding="utf-8") as f:
        f.write("Synthetic, disposable ArcGIS Pro review fixture created by scripts/create-review-fixture.py.\n"
                "Safe to delete. Contains no real GIS data.\n")


def create_feature_classes(gdb, sr):
    roads = arcpy.management.CreateFeatureclass(gdb, "Roads", "POLYLINE", spatial_reference=sr)[0]
    arcpy.management.AddField(roads, "Name", "TEXT", field_length=50)
    arcpy.management.AddField(roads, "Length", "DOUBLE")
    with arcpy.da.InsertCursor(roads, ["SHAPE@", "Name", "Length"]) as cur:
        for i in range(6):
            line = arcpy.Polyline(arcpy.Array([arcpy.Point(X0, Y0 + i * 200), arcpy.Point(X0 + 400 + i * 150, Y0 + i * 200)]), sr)
            cur.insertRow([line, f"Road {i + 1}", round(line.length, 2)])

    parcels = arcpy.management.CreateFeatureclass(gdb, "Parcels", "POLYGON", spatial_reference=sr)[0]
    arcpy.management.AddField(parcels, "Area", "DOUBLE")
    arcpy.management.AddField(parcels, "Zone", "TEXT", field_length=20)
    with arcpy.da.InsertCursor(parcels, ["SHAPE@", "Area", "Zone"]) as cur:
        for r in range(4):
            for c in range(4):
                w, h = 80 + 30 * c, 60 + 25 * r
                x, y = X0 + c * 250, Y0 - 300 - r * 200
                poly = arcpy.Polygon(arcpy.Array([arcpy.Point(x, y), arcpy.Point(x + w, y), arcpy.Point(x + w, y + h), arcpy.Point(x, y + h)]), sr)
                cur.insertRow([poly, round(poly.area, 2), "Residential" if (r + c) % 2 else "Commercial"])

    wells = arcpy.management.CreateFeatureclass(gdb, "Wells", "POINT", spatial_reference=sr)[0]
    arcpy.management.AddField(wells, "WellId", "TEXT", field_length=20)
    arcpy.management.AddField(wells, "Depth", "DOUBLE")
    with arcpy.da.InsertCursor(wells, ["SHAPE@XY", "WellId", "Depth"]) as cur:
        for i in range(8):
            cur.insertRow([(X0 + 120 * i, Y0 + 1400 + 60 * (i % 3)), f"W-{i + 1:02d}", 20.0 + 7.5 * i])
    return roads, parcels, wells


def create_project(root, data_gdb, scratch_gdb, layers):
    blank = os.path.join(arcpy.GetInstallInfo()["InstallDir"], r"Resources\ArcToolBox\Services\routingservices\data\Blank.aprx")
    path = os.path.join(root, "review.aprx")
    arcpy.mp.ArcGISProject(blank).saveACopy(path)
    project = arcpy.mp.ArcGISProject(path)
    project.homeFolder = root
    project.defaultGeodatabase = scratch_gdb
    for empty in project.listMaps():
        project.deleteItem(empty)  # Blank.aprx ships an empty "Map"; keep one unambiguous map.
    m = project.createMap("Review Map", "MAP")
    m.spatialReference = arcpy.SpatialReference(WKID)
    for basemap in [lyr for lyr in m.listLayers() if lyr.isBasemapLayer]:
        m.removeLayer(basemap)  # createMap adds an online basemap; keep the fixture offline.
    for fc in layers:
        m.addDataFromPath(fc)
    layout = project.createLayout(11, 8.5, "INCH", "Review Layout")
    frame = layout.createMapFrame(arcpy.Polygon(arcpy.Array([arcpy.Point(0.5, 0.5), arcpy.Point(10.5, 0.5), arcpy.Point(10.5, 8), arcpy.Point(0.5, 8)])), m, "Review Frame")
    frame.camera.setExtent(frame.getLayerExtent(m.listLayers("Parcels")[0], False, True))
    project.save()
    # Existing file for the "refuse to overwrite" negative case.
    layout.exportToPDF(os.path.join(root, "exports", "existing-report.pdf"), resolution=96)
    return path, [lyr.name for lyr in m.listLayers()]


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--root", default="D:/review")
    parser.add_argument("--replace", action="store_true", help="rebuild a fixture this script created earlier")
    args = parser.parse_args()
    root = os.path.abspath(args.root)
    prepare_root(root, args.replace)
    sr = arcpy.SpatialReference(WKID)
    data_gdb = arcpy.management.CreateFileGDB(root, "review-data.gdb")[0]
    scratch_gdb = arcpy.management.CreateFileGDB(root, "scratch.gdb")[0]
    layers = create_feature_classes(data_gdb, sr)
    path, names = create_project(root, data_gdb, scratch_gdb, layers)
    counts = {os.path.basename(fc): int(arcpy.management.GetCount(fc)[0]) for fc in layers}
    print(f"project: {path}\nlayers: {names}\nfeatures: {counts}\nscratch: {scratch_gdb}")


if __name__ == "__main__":
    main()

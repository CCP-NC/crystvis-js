import { IsosurfaceMesh } from '@ccp-nc/crystvis-js/lib/primitives/index.js';

export default async function (vis, console) {
    const cif = await fetch('data/CHA.cif').then((r) => r.text());
    vis.loadModels(cif, 'cif', 'cha');
    vis.displayModel('cha_CHA');

    // Distance from the cell centre, in grid points, on a 24 x 24 x 24 grid
    const n = 24;
    const c = n / 2;
    const field = [];
    for (let x = 0; x < n; x++) {
        field.push([]);
        for (let y = 0; y < n; y++) {
            field[x].push([]);
            for (let z = 0; z < n; z++) {
                field[x][y].push(Math.hypot(x - c, y - c, z - c));
            }
        }
    }

    // The surface is the sphere of radius 6 grid points
    const iso = new IsosurfaceMesh(field, 6, vis.model.cell, { color: 0x66ccff, opacity: 0.4 });
    vis.addPrimitive(iso);
    console.log('Sphere radius', 6 / n, 'of the cell edge');
}

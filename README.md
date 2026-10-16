# crystvis-js

A [three.js](https://threejs.org/) viewer for crystal structures, molecules, and NMR tensors in the browser. It reads common crystallographic and NMR file formats and renders them with WebGL into any element on a page.

**Documentation, with live examples: [ccp-nc.github.io/crystvis-js](https://ccp-nc.github.io/crystvis-js/)**

- Ball-and-stick rendering with orbit, zoom, and pan controls, supercells, and molecules made whole across periodic boundaries.
- A query language for selecting atoms by element, position, bonding, or molecule, with click and box selection.
- Labels, colours, distance lines, spheres, isosurfaces, and screenshots.
- NMR tensors (shielding, EFG, hyperfine) drawn as ellipsoids, with tensor parameters in the usual conventions and the relative orientation of two tensors shown as Euler disks.

Supported formats: CIF (via [crystcif-parse](https://github.com/CCP-NC/crystcif-parse)), Extended XYZ, CASTEP `.cell`, CASTEP `.magres`, and Magres-JSON (schema in [schemas/magres.json](schemas/magres.json)).

## Install

```bash
npm install @ccp-nc/crystvis-js
```

crystvis-js is an ES module, so use it with a bundler such as Vite, esbuild, or webpack. It needs a browser with WebGL2.

## Use

```html
<div id="viewer" style="height: 480px"></div>
```

```js
import CrystVis from '@ccp-nc/crystvis-js';

const vis = new CrystVis('#viewer');
const cif = await fetch('structure.cif').then((r) => r.text());

const status = vis.loadModels(cif, 'cif', 'structure'); // { structure_<datablock>: 0 | 'error' }
const name = Object.keys(status)[0];
if (status[name] === 0) {
    vis.displayModel(name);
}
```

The [guides](https://ccp-nc.github.io/crystvis-js/) cover loading, selecting, styling, and NMR tensors. The [API reference](https://ccp-nc.github.io/crystvis-js/api/) has the full signatures. To upgrade from an older version, see the [upgrading notes](https://ccp-nc.github.io/crystvis-js/upgrading.html) and the [CHANGELOG](CHANGELOG.md).

## Develop

```bash
npm install
npm test           # Mocha unit tests in test/
npm start          # dev server with the demo (demo/) and browser tests (test/test-html/)
npm run docs       # build the guides and API reference into docs/
npm run docs-serve # preview docs/ locally
```

[AGENTS.md](AGENTS.md) describes the architecture, conventions, and known gotchas, for both human contributors and coding agents.

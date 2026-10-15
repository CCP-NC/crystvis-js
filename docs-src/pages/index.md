---
title: Crystal structures and NMR tensors in the browser
nav: Overview
description: crystvis-js is a Three.js library for displaying crystal structures, molecules, and NMR tensors in a web page.
order: 0
---

{{example index-hero hero}}

# crystvis-js

Visualise crystal structures, molecules, and NMR tensors in any web page, using WebGL.

## Quick start

1. Install the package from npm.

    ```bash
    npm install @ccp-nc/crystvis-js
    ```

2. Add a container with a height, then create a viewer in it.

    ```html
    <div id="viewer" style="height: 480px"></div>
    ```

    ```js
    import CrystVis from '@ccp-nc/crystvis-js';

    const vis = new CrystVis('#viewer');
    ```

3. Fetch a structure file, load it, and display it. CIF models are named `prefix_datablock`, so this one is `cha_CHA`.

    ```js
    const cif = await fetch('CHA.cif').then((r) => r.text());
    vis.loadModels(cif, 'cif', 'cha');
    vis.displayModel('cha_CHA');
    ```

## Guides

- [Getting started](getting-started.html): install the package, create a viewer, and fix common errors.
- [Loading structures](loading.html): supported formats, supercells, and molecular crystals.
- [Selecting atoms](selecting.html): queries, clicks, box selection, and the camera.
- [Styling and annotations](styling.html): colours, sizes, and labels on atoms.
- [NMR tensors](nmr.html): ellipsoids, Euler disks, and relative orientations.
- [API reference](api/index.html): every class and method, generated from the source.

## What it is not

- It has no CDN or script-tag build. Use a bundler such as Vite, esbuild, or webpack.
- It does not draw coordination polyhedra.
- It has no hover events. Use `onAtomClick` for clicks.

---
title: Getting started
description: Install crystvis-js, create a viewer, load a structure, handle errors, and use the viewer controls.
order: 1
---

# Getting started

This page takes you from an empty web page to a displayed structure. It then covers errors, framework use, the mouse and keyboard controls, and common problems.

## Install and requirements

```bash
npm install @ccp-nc/crystvis-js
```

crystvis-js is an ES module, so you need a bundler such as Vite, esbuild, or webpack. There is no CDN or script-tag build. The browser must support WebGL2.

```js
import CrystVis from '@ccp-nc/crystvis-js';
```

`CrystVis` is the default export. `TensorData` and `RelativeTensorOrientation` are named exports.

## Create a viewer

Pass a CSS selector or an element as the first argument. The container must have a height, because the viewer draws into it.

```html
<div id="viewer" style="height: 480px"></div>
```

```js
const vis = new CrystVis('#viewer');
```

With no size arguments, the viewer fills its container and resizes when the container does. To fix the size instead, pass a width and height in pixels:

```js
const vis = new CrystVis(document.getElementById('viewer'), 800, 600);
```

A fourth argument passes options to the three.js renderer. The default is `{antialias: true, alpha: true}`.

> **Pitfall:** A container with no height gives a blank canvas. Set a height in CSS, or pass a fixed width and height.

## Load and display your first structure

This example fetches `CHA.cif`, a chabazite zeolite, and displays its unit cell. The console panel shows the model name, the atom count, and the elements present.

{{example getting-started-first}}

`loadModels` returns a status object, and CIF models are named `prefix_datablock`. The prefix here is `cha`, and the data block is `CHA`. `displayModel` shows one model at a time.

`displayModel` centres the camera on the displayed atoms and zooms so that they fill the view. If you change `vis.displayed` afterwards, call `vis.fitCamera()` to fit the camera to the new set. To make the camera orbit around a particular point, use `vis.centerCamera([x, y, z])`.

## Handle loading errors

`loadModels` returns a status object keyed by model name. Each value is `0` on success, or an error string. CIF, CELL, and magres errors come back this way. XYZ parse errors and an unknown format are thrown instead, so wrap the call in `try`/`catch` as well.

```js
function showStructure(text, format, prefix) {
    try {
        const status = vis.loadModels(text, format, prefix);
        const name = Object.keys(status).find((n) => status[n] === 0);
        if (!name) {
            console.error('Could not load', prefix, status);
            return;
        }
        vis.displayModel(name);
    } catch (err) {
        console.error('Could not load', prefix, err.message);
    }
}
```

To load a file the user picks, read it as text and take the format from the file name:

```html
<input type="file" id="file" accept=".cif,.xyz,.cell,.magres,.json">
```

```js
document.getElementById('file').addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    const format = lower.endsWith('.magres.json') ? 'magres-json' : lower.split('.').pop();
    const prefix = file.name.replace(/\.[^.]+$/, '');
    const reader = new FileReader();
    reader.onload = () => showStructure(reader.result, format, prefix);
    reader.readAsText(file);
});
```

## Use it inside a framework

Create the viewer after the container is in the DOM, and call `dispose()` when the component unmounts. `dispose()` releases the WebGL context, so skipping it leaks GPU memory on every mount.

In React:

```jsx
import { useEffect, useRef } from 'react';
import CrystVis from '@ccp-nc/crystvis-js';

export function StructureViewer({ cif }) {
    const ref = useRef(null);

    useEffect(() => {
        const vis = new CrystVis(ref.current);
        const status = vis.loadModels(cif, 'cif', 'structure');
        const name = Object.keys(status)[0];
        if (status[name] === 0) vis.displayModel(name);
        return () => vis.dispose();
    }, [cif]);

    return <div ref={ref} style={{ height: 480 }} />;
}
```

In Vue, with `<script setup>`:

```html
<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import CrystVis from '@ccp-nc/crystvis-js';

const container = ref(null);
let vis;

onMounted(() => {
    vis = new CrystVis(container.value);
});

onUnmounted(() => vis?.dispose());
</script>

<template>
    <div ref="container" style="height: 480px"></div>
</template>
```

## Mouse and keyboard controls

| Action | Input |
| --- | --- |
| Rotate | Left-drag |
| Zoom | Mouse wheel, or middle-drag |
| Pan | Right-drag, or Ctrl/Cmd + left-drag |
| Select one atom | Click an atom |
| Add an atom to the selection | Shift + click |
| Toggle an atom in the selection | Ctrl/Cmd + click |
| Toggle the atoms in a box | Shift + drag |
| Nudge the view | Arrow keys (click the viewer first) |
| Look down the x, y, or z axis | X, Y, or Z |

A pointer movement of less than 5 px counts as a click, so a slightly moved click still selects an atom. Only atoms can be clicked. Bonds and the background ignore clicks.

## Troubleshooting

- **The canvas is blank.** The container has zero height. Give it a height in CSS, or pass a fixed width and height to the constructor.
- **The viewer does not start.** It needs WebGL2. If `document.createElement('canvas').getContext('webgl2')` returns `null`, use another browser or turn on hardware acceleration.
- **`The requested model does not exist.`** The name you passed to `displayModel` is not a loaded model. Check `Object.keys(status)` after loading. CIF names include the data block, so `'cha'` fails and `'cha_CHA'` works.

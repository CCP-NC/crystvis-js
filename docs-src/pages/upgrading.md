---
title: Upgrading
nav: Upgrading
description: What changed in each crystvis-js release that affects your code, and what to do about it.
order: 90
---

# Upgrading

This page lists the changes that affect your code, newest first, with the steps to adapt. For every change, see the [CHANGELOG on GitHub](https://github.com/ccp-nc/crystvis-js/blob/main/CHANGELOG.md).

## Unreleased

- **The camera fits on display.** `displayModel()` centres and zooms on the displayed atoms. If you restore a saved view, call `setCameraState()` after `displayModel()`, as before. After you change `vis.displayed`, call `vis.fitCamera()`.
- **Primitives persist.** Objects added with `addPrimitive()` stay on screen across `displayModel()` calls until you call `removePrimitive()`. Remove any code that re-adds them after each display.
- **`reloadModel()` merges parameters.** `reloadModel(name, params)` merges `params` over the model's current parameters, rather than resetting the others to defaults. Views and atoms you held before the reload are stale.
- **Errors are `Error` objects.** Unknown model names, invalid click flags and ModelView operations across different models now throw `Error`. Code that compared a caught value with a string must use `err.message`. The status object from `loadModels()` is unchanged.
- **Labels follow the theme.** Labels use the theme's label colour when you don't pass `color`: white on the dark theme, black on the light. Link labels use the link colour, then the theme. Use the new `labelColor` parameter to set link label colour separately.
- **Flat query lists.** `{elements: ['Si', 'O']}`, `indices: [0, 1, 2]` and `molecule: [a, b]` now work. The nested forms still work. The new `labels` query matches crystallographic site labels, for example `{labels: ['O1', 'O2']}`.

## 0.8.1

`TensorData.euler()` now returns correct angles for axial tensors whose two lowest eigenvalues are equal, when you request passive angles. No code change is needed. If you stored Euler angles for such tensors, recompute them.

## 0.8.0: relative orientation replaces eulerTo

This release is breaking. `TensorData.eulerTo()` and `TensorData.equivalentEulerTo()` have been removed. Use `relativeOrientationTo()` instead, which returns a `RelativeTensorOrientation`.

The old method returned one Euler triple in radians:

```js
const [alpha, beta, gamma] = tensorA.eulerTo(tensorB, 'zyz', true);
```

The new method returns an object that describes every valid solution:

```js
const orientation = tensorA.relativeOrientationTo(tensorB, {sequence: 'zyz', active: true});
const [alpha, beta, gamma] = orientation.configurations[0].euler;
```

`configurations` is only filled for discrete orientations. Check `orientation.orientationClass` first. For `'continuous'` or `'indeterminate'` orientations, use `freeRotation` and the `RelativeTensorOrientation` reference in the [API reference](api/RelativeTensorOrientation.html) instead of a list of angles.

## 0.7.0

This release is not breaking, but two points may affect your code:

- The return value of `loadModels()` is a status object keyed by model name, with `0` for success or an error string. The old documentation described it as an array. Read it with `Object.keys(status)`.
- Call `dispose()` on a viewer when you remove it from the page. It releases the WebGL context and event listeners. See [Getting started](getting-started.html#use-it-inside-a-framework).

## 0.6.0: three.js 0.178

crystvis-js moved from three.js 0.137 to 0.178. Most users see only small changes in lighting and colour. If you add your own three.js objects, shaders, or textures to a viewer, change the following:

- Set colours with `material.color.set(hex)`. Assigning `material.color = new THREE.Color(hex)` can fail to update the material.
- Declare texture colour spaces with `texture.colorSpace = THREE.SRGBColorSpace`. This replaces `texture.encoding`.
- Set `glslVersion: THREE.GLSL3` on a `RawShaderMaterial` that uses GLSL 3.0. Do not write a `#version` line in the shader source, because three.js adds it.
- Set `renderer.outputColorSpace = THREE.SRGBColorSpace`. This replaces `outputEncoding`.

Materials can look slightly different after the change, so check your visualisations and retune lights if needed. Where possible, use the crystvis-js APIs rather than three.js objects directly.

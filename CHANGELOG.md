# Changelog

All notable changes to crystvis-js will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added
- New documentation site with task-oriented guides (getting started, loading, selecting, styling, NMR tensors) and live, runnable examples. It is built by `npm run docs` from `docs-src/` alongside the JSDoc API reference, which now also covers `TensorData` and `RelativeTensorOrientation`.
- `AGENTS.md`, with architecture notes, conventions, and known gotchas for contributors and coding agents.
- `CrystVis.fitCamera(view, padding)` centres the camera on a set of atoms (by default the displayed ones) and zooms so they fill the view.
- A `labels` query selects atoms by crystallographic site label, for example `model.find({labels: ['O1', 'O2']})`.
- `RelativeTensorOrientation#canonicalConfigurations` lists the configurations whose Euler angles lie in the canonical NMR ranges.
- `loadModels()` accepts the parser options `frame` (which frame of a multi-frame XYZ file to load), `shieldingTag` and `efgTag`.

### Changed
- `displayModel()` now fits the camera to the displayed atoms, instead of using a fixed 40 Å view centred on the cell. A saved view can still be restored with `setCameraState()` after `displayModel()`.
- The `elements`, `indices`, `labels` and `molecule` queries accept a flat list, so `{elements: ['Si', 'O']}` selects both elements. Previously only the first value was used, unless the list was wrapped as `[['Si', 'O']]`, which still works.
- Objects added with `addPrimitive()` now persist across `displayModel()` calls until `removePrimitive()`.
- `reloadModel()` merges the new parameters over the model's current ones, instead of resetting the rest to defaults.
- Every error is now thrown as an `Error`. Some were thrown as plain strings, such as an unknown model name in `displayModel()`.
- Atom labels default to the theme's label colour, and link labels to the link colour. Both used to be white whatever the theme. Link labels also accept a separate `labelColor`.
- `addEllipsoids()` skips atoms with no data, such as `hf` on atoms without hyperfine data, instead of throwing. It also no longer changes the `convention` of the tensor passed in.
- `setProperty('visible')` with no value resets atoms to visible. The `visible`, `highlighted`, `opacity`, `radius` and `scale` setters no longer throw while the model is not displayed.
- `model.addSphere()` accepts an atom as its centre.
- The default box-selection handler no longer logs to the console.

### Fixed
- The bundled bitmap font failed to parse in browsers, because its `%` glyph broke the data-URI decoding. Text labels then threw `must specify a { font } in options`.
- API reference class pages were saved under their module path, such as `api/lib_visualizer.module_js-CrystVis.html`, so `api/CrystVis.html` returned 404. They now sit at `api/<Class>.html`, and the search index points at the new names.
- Parameters passed to `loadModels()` or `reloadModel()` (for example `supercell`) leaked into every later load.
- The `molecule` query only processed the first atom when given several.
- Setting an atom's `radius` to `null`, or calling `setProperty('radius')` with no value, made the atom vanish instead of resetting it.
- `labelProperties`, `ellipsoidProperties`, and `eulerProperties` (and their per-atom versions) ignored falsy values such as `0` or `false`.
- `displayModel()` with no argument left `displayed` pointing at the old model, so a later `vis.displayed = ...` threw.
- `IsosurfaceMesh` failed to build, because it called a three.js method removed in r125.
- `efgAtomicToHz()` and `iscAtomicToHz()` did not convert `nqr_eigenvalues`.
- The demo's selection highlighting was off, because it set `highlight_selected` instead of `highlightSelected`.
- JSDoc errors: `efgAtomicToHz` takes Q in millibarn; `rotateByAngleAxis` and `euler()` use radians; `centerCamera`, `getScreenshotData`, and `theme` are now documented.

### Removed
- `docs-tutorials/`. Its content now lives in the guides, with errors corrected: there is no `elems` query alias, and `CMD_BUTTON` equals `CTRL_BUTTON` on every platform.

## [0.8.1] - 2026-10-15

### Fixed
- `TensorData.euler()` returned angles that did not rebuild the tensor for axial tensors whose two lowest eigenvalues coincide (for example a dipolar coupling with d > 0, or an axial shielding with zeta > 0 in Haeberlen order) when the passive angles were requested. The free angle is now zeroed on the correct side, and the eigenvalue order used for that choice follows the `eval_convention` argument.

## [0.8.0] - 2026-07-29

### Changed
- **Breaking:** Relative Euler-angle consumers must migrate from `TensorData.eulerTo()` and `TensorData.equivalentEulerTo()` to `TensorData.relativeOrientationTo()`. See the [upgrading notes](https://ccp-nc.github.io/crystvis-js/upgrading.html) and the [NMR tensors guide](https://ccp-nc.github.io/crystvis-js/nmr.html).

## [0.7.0] - 2026-03-11

### Added
- `CrystVis.dispose()` — full teardown of the WebGL context, animation loop, orbit
  controls, resize observer and all event listeners. `isDisposed` getter reflects state.
  Methods throw if called on a disposed instance. (#17)
- `CrystVis.getCameraState()` / `setCameraState(state)` — snapshot and restore the
  camera position, target and zoom level as a plain serialisable object. (#20)
- `CrystVis.onCameraChange(callback)` — subscribe to live camera-change events
  (rotate / pan / zoom); returns an unsubscribe function. (#20)
- `CrystVis.getModelSource(name)` — retrieve the raw file text and extension originally
  passed to `loadModels()`. (#20)
- `CrystVis.getModelParameters(name)` — retrieve the merged loading parameters used when
  a model was last loaded or reloaded. (#20)
- `CrystVis.getModelMeta(name)` — retrieve `{ prefix, originalName }` metadata stored at
  load time. (#20)
- `CrystVis.onModelListChange(callback)` — subscribe to events fired whenever the set of
  loaded models changes (load, delete, unloadAll); returns an unsubscribe function. (#20)
- `CrystVis.onDisplayChange(callback)` — subscribe to events fired whenever the displayed
  model changes; callback receives the new model name or `null`. (#20)
- `CrystVis.unloadAll()` — remove all loaded models atomically (one renderer clear, one
  set of change events). (#20)
- `ModelView.toIndices()` — serialise a selection to a plain index array. (#20)
- `ModelView.toLabels()` — serialise a selection to an array of crystallographic site
  labels (`crystLabel`), resilient to atom-index reordering. (#20)
- `Model.viewFromIndices(indices)` — reconstruct a `ModelView` from a saved index array. (#20)
- `Model.viewFromLabels(labels)` — reconstruct a `ModelView` from a saved label array. (#20)
- `Renderer.getCameraState()` / `setCameraState(state)` / `onCameraChange(callback)` —
  lower-level camera state API used by `CrystVis`. (#20)
- Visualisation of hyperfine tensors from `magres_old` blocks in Magres files as
  ellipsoids. (#19)

### Fixed
- `loadModels()` return value corrected in README and JSDoc: it returns a status object
  (keys = model names, values = `0` or error string), not an array. (#18)

### Changed
- Updated several dependencies. (#12, #13, #16)

## [0.6.1] - 2026-01-22

### Changed
 - Added support for selecting a specific frame when loading multi-frame XYZ/Extended XYZ files via an `index` option.
 - Proper handling and conversion of per-atom 9-element tensors in Extended XYZ files: `ms` (magnetic shielding) and `efg` tensors are detected and converted to `TensorData` objects.
 - Improved Extended XYZ parsing: stricter handling of atom lines and properties to avoid accidental token merging when input contains stray newlines.
 - Parser now reports clearer errors for malformed Extended XYZ files.

## [0.6.0] - 2025-07-18

### Added
- Documentation on Three.js migration.
- Improved error handling for shader compilation.
- Better color space handling for all primitives.

### Changed
- Updated Three.js from version 0.137 to 0.178.
- Fixed color handling across all primitives to work with new Three.js color management.
- Fixed shader handling for GLSL 3.0 compatibility.
- Improved text rendering with better color handling and transparency.
- Refined material properties for better appearance in the new renderer.

### Fixed
- Color issues when upgrading to Three.js 0.178.
- Text rendering and transparency problems.
- Shader compilation errors with GLSL 3.0.
- EllipsoidMesh color handling with different material types.
- Proper handling of atoms and bond materials.

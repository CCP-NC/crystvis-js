# AGENTS.md

Guidance for agents and humans changing crystvis-js. The code under `lib/` is the source of truth. Scripts in `package.json` are authoritative for the build and test commands.

## What this is

A three.js viewer for crystal structures, molecules and NMR tensors in the browser. The public surface is the default export `CrystVis` plus the named exports `TensorData` and `RelativeTensorOrientation` (`index.js`). Everything else (`Model`, `ModelView`, `AtomImage`, `BondImage`, primitives) is reached through a viewer instance or `vis.model`. Deep imports such as `lib/primitives/index.js` work but are not stable API.

## Commands

CI (`.github/workflows/test.yml`) runs these in order. Use the same sequence locally:

```
npm ci
npx eslint . --ext .js
npm run build-resources
npm run build-demo
npm run build-html-test
npm test
```

`npm start` builds and serves the demo and browser tests. `npm run docs` then `npm run docs-serve` builds and serves the docs site.

## Architecture map

Layers, from the bottom up:

- **Loading**: `lib/loader.js` dispatches by format to `lib/formats/{cif,xyz,cell,magres,magres-json}.js`. CIF parsing uses `@ccp-nc/crystcif-parse`.
- **Model**: `lib/model.js`. Periodic images, bonds (including across boundaries), molecules, queries, plus the `AtomImage` and `BondImage` classes.
- **ModelView**: `lib/modelview.js`. Immutable sets of image indices on one model, with bulk operations (labels, ellipsoids, Euler disks, properties).
- **Renderer**: `lib/render.js`. Scene groups (model and primitives), orthographic camera, click raycasting, `lib/selbox.js` (box selection), `lib/orbit.js` (controls).
- **Façade**: `lib/visualizer.js` (`CrystVis`). Model registry, displayed and selected state, events. Most users touch only this layer.
- **Primitives**: `lib/primitives/*` (atoms, shapes, ellipsoids, Euler disks, text, isosurfaces, cell box, dither).
- **Maths and data**: `lib/tensor.js` (`TensorData`), `lib/relative-orientation.js`, `lib/query.js` (query parser), `lib/data.js` and `lib/nmrdata.js` (elements, isotopes, colours), `lib/utils.js`.
- **Where common changes go**: a new query form goes in `Model`'s query methods, parsed by `lib/query.js`. A new per-atom visual goes in `AtomImage` setters and `ModelView.setProperty`. A new drawn object goes in `lib/primitives/` and is added through a `Model` or `ModelView` adder. A new file format goes in `lib/loader.js`.

## Core concepts

- **Base atom vs image.** `model.length` counts base-cell atoms, indexed by `AtomImage.index`. `model.atoms` holds every periodic image in the supercell, indexed by `AtomImage.imgIndex`. `ijk` is the cell offset. ModelViews store `imgIndex` values. Per-atom arrays such as `ms` and `efg` are per base atom; read them with `getArrayValue`.
- **Displayed set.** `vis.displayed` defines what is drawn. After `displayModel(name)` it is only the `[0,0,0]` cell. To show the supercell, set `vis.displayed = vis.model.find({all: []})`. The setter requires a ModelView.
- **Loading.** `loadModels()` returns `{modelName: 0 | errorString}`. CIF gives one model per data block (`prefix_<block>`). Atoms bond when closer than the mean of their scaled vdW radii. The user-facing behaviour is documented in `docs-src/pages/`; read the relevant guide before changing a feature.
- **Graphics lifecycle.** Labels, ellipsoids, Euler disks, links and spheres belong to the model and exist only while it is displayed. Add them after `displayModel()`.
- **Units.** Lengths in Å. Angles in radians unless a parameter says otherwise. Tensor values in the file's units (ppm for shielding). `efgAtomicToHz` takes Q in millibarn.
- **Tensor conventions.** `TensorData.convention` is `increasing`, `decreasing`, `haeberlen` or `nqr`. The `addEllipsoids` default follows the array name: `ms` gives haeberlen, `efg` gives nqr, anything else gives increasing.
- **Relative orientation display.** `ModelView.addEulerDisks(orientation, name, params)` draws a RelativeTensorOrientation. Per atom, `atom.getEulerDisks(name)` gives `setConfiguration(id)` and `animateToConfiguration(id, ms)`.
- **Orientation vocabulary.** Use the terms defined in `CONTEXT.md` in docs, comments and new names, and do not coin synonyms. Existing API names such as `setConfiguration` and `EulerDisks` stay as they are, even where `CONTEXT.md` lists a term to avoid.

## Gotchas (current behaviour)

These are deliberate or not yet changed. If you change one, add a regression test, a CHANGELOG entry, and update any docs page that mentions it.

- **Query arguments are positional.** The value is spread into the query function. `elements`, `indices`, `labels` and `molecule` flatten their arguments, so flat or nested lists both work. `sphere: [center, r]`, `box: [c0, c1]`, `bonded: [atoms, distance, exact]` and `cell: [[i, j, k]]` take positional arguments. Keep new list-style queries flattening, for consistency.
- Queries and bonds see only images inside the loaded supercell (default `supercell: [1,1,1]`).
- `loadModels()` reports errors two ways. CIF, cell, magres and magres-json errors come back as strings in the status object. XYZ parse errors and unknown formats throw. Everything that throws throws an `Error`; keep it that way.
- `reloadModel()` rebuilds the Model, so held ModelViews and AtomImages are stale afterwards. Parser options (`frame`, `shieldingTag`, `efgTag`) apply only at load time.
- Labels, ellipsoids, Euler disks, links and spheres are created only while the model is displayed, and silently do nothing otherwise. AtomImage property setters store their value and apply it on display.
- `viewFromLabels()` restores every periodic image that shares a label, so a view round-tripped through `toLabels()` can grow.
- `displayModel()` fits the camera to the displayed atoms. Changing `vis.displayed` does not; call `fitCamera()`.
- `configurations` holds every PAS-frame configuration, with β in [0, π]. `canonicalConfigurations` is the subset in the NMR ranges (four for a triaxial pair).
- `CMD_BUTTON` and `CTRL_BUTTON` are both 16. Ctrl and Cmd/Meta are one flag on every platform.
- There are no polyhedra, hover events or public lighting controls.

## Changing the library

- **Public members** (reachable from `index.js`) need JSDoc. Keep `index.js` to the three public exports. Members prefixed `_` are private; tests may reach into them.
- **User-visible change**: update the relevant guide in `docs-src/pages/`. A new feature also gets a live example in `docs-src/examples/`.
- **CHANGELOG.md**: add an entry under "Unreleased" (Keep a Changelog). Mark breaking changes with **Breaking:** and point to `docs-src/pages/upgrading.md`.
- **Bug fixes** get a regression test in `test/`.
- **Renames and removals** of public members are breaking under semver. Flag them in the CHANGELOG as shown for 0.8.0.
- **New file format**: register the parser in the `parsers` map in `Loader.load()` (`lib/loader.js`), where names are lowercased and `extxyz` aliases `xyz`. Make it return the same structure as the existing parsers and report failures as the loader expects. Add fixtures to `test/data/`, a test in `test/loader.js`, and a note in `docs-src/pages/loading.md`.
- **Magres-JSON contract** (`schemas/magres.json`, version "1.0"): a change needs an explicit version decision and updated fixtures in `test/data/`.
- **Style**: ES modules, `'use strict'`, 4-space indent, `import _ from 'lodash'`, `import * as mjs from 'mathjs'`, and `addStaticVar` for class constants. Match the surrounding file. The ESLint config (`eslint.config.js`) is authoritative.

## Generated files (do not hand-edit)

### Gitignored build output

These do not exist in a fresh clone. Build them before running tests or the demo. Never commit them.

- `lib/shaders/index.js` and `lib/assets/fonts/bmpfonts.js` are baked by `npm run build-resources` from `index.in.js` / `bmpfonts.in.js` and the shader and font sources. They exist because consumer bundlers do not reliably inline `.vert`, `.frag`, `.fnt` or `.png` imports, so the package ships them as JS strings and data URIs. Any bundler or packaging change must keep that working. The build runs from the `prepare` script (on `npm install` and `npm ci`) and from `prestart`.
- `demo/demo.js` (`npm run build-demo`) and `test/test-html/testbuild.js` (`npm run build-html-test`) are bundles built from their sources.
- `docs/` is wiped and rebuilt by `npm run docs`. On push to `master`, `.github/workflows/deploy-docs.yml` uploads it as a GitHub Pages artifact and deploys it. There is no `gh-pages` branch.

### Committed but generated

Change the generator, then regenerate and commit the output.

- The bitmap font `.png` and `.fnt` files in `lib/assets/fonts/` are rendered from `fonts/` by `npm run build-fonts`. Its font list is hand-maintained in `scripts/build-fonts.js`. Run `build-fonts` before `build-resources`, because the resources build inlines the files the font build produces.
- `lib/nmrdata.js` (element and isotope data) is printed to stdout by `tools/compile_periodic.py`.

## Docs system

- A guide is `docs-src/pages/<slug>.md` with front matter (`title`, `nav`, `description`, `order`). An `order` of 90 or more makes it a footer link. Start with one H1 and a short lede. Each H2 is a sidebar TOC entry, so name it by task.
- `{{example <name>}}` on its own line embeds `docs-src/examples/<name>.js` as a live viewer. The file must be `export default async function (vis, console) {...}`. Its imports and body are both shown and executed, so they cannot drift. `vis` is already attached to the viewer.
- Examples import only from `'@ccp-nc/crystvis-js'` (or `'@ccp-nc/crystvis-js/lib/primitives/index.js'`). The build aliases this to the repo. Load data from `data/`. Keep examples short, focused and copy-pasteable.
- Use plain fenced code for things that should not run live, such as install commands and framework wrappers.
- Link to classes as `api/<Class>.html`. The build rewrites these. The API reference is generated from JSDoc (`jsconf.json`) into `docs/api/`.
- The build bundles examples but does not run them, so a broken example passes `npm run docs`. Verify docs by running `npm run docs` and `npm run docs-serve`, then opening the pages in a browser with WebGL2. Example errors appear in red in the plate's log panel.
- Example data is copied from `test/data/` into `docs/data/` at build time. Add new fixtures to `test/data/`, not to `docs-src/`.

## Verifying changes

- Unit tests (`npm test`, currently Mocha) run `test/*.js` in Node. `test/setup-dom.cjs` installs a DOM shim (currently jsdom) and a stub WebGL context, so nothing really renders in these tests.
- CrystVis tests bypass the constructor and use a mock renderer (`makeMockVis` in `test/visualizer.js`). Use this pattern for façade logic.
- Anything that renders (primitives, shaders, text, camera, click picking) must be checked in a browser: the demo in `demo/`, the browser tests in `test/test-html/`, or the docs examples. `npm start` builds and serves the first two.
- Test fixtures live in `test/data/`.
- Lint with `npx eslint . --ext .js`, as CI does; there is no lint script. `eslint.config.js` ignores `demo/` and `test/test-html/`, so the bundles are not linted. `test/_gen_euler_stress.mjs` generates stress-test Magres files and is not part of `npm test`.

## Related documents

- `CONTEXT.md`: domain glossary for relative tensor orientation.
- `CHANGELOG.md`: release history and the Unreleased section.
- `schemas/magres.json`: the Magres-JSON contract.
- `docs-src/pages/upgrading.md`: migration notes for users.
- `README.md`: user-facing overview.

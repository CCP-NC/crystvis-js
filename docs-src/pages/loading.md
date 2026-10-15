---
title: Loading structures
nav: Loading structures
description: Load CIF, Extended XYZ, CASTEP cell, Magres and Magres-JSON files, name and manage models, and control supercells, whole molecules and bonds.
order: 2
---

# Loading structures

`loadModels` parses the text of a structure file and stores the result as one or more named models. This page covers the supported formats, how models are named, and the parameters that control how each model is built.

## Supported formats

Pass the file's contents as a string, along with its format string. The table lists what each format needs and what you get back.

| Format string | File | Requirements | What you get |
| --- | --- | --- | --- |
| `cif` | CIF | One or more data blocks with a cell and symmetry. | One model per data block, named `prefix_block`. |
| `xyz` (also `extxyz`) | Extended XYZ | The comment line must contain both `Lattice="..."` and a `Properties` string that starts with `species:S:1:pos:R:3`. Plain XYZ without a cell is rejected. | One model. Columns with nine real values named by `shieldingTag` and `efgTag` (default `ms` and `efg`) become a `TensorData` per atom. Other columns become arrays. Multi-frame files load the last frame unless you set `frame`. |
| `cell` | CASTEP `.cell` | One positions block, either `POSITIONS_ABS` or `POSITIONS_FRAC`. One lattice block, either `LATTICE_CART` or `LATTICE_ABC`. A units line (`ang` or `bohr`) may follow the block name for the absolute and Cartesian blocks. Å is the default. | One model with the atoms and cell. No tensors. |
| `magres` | CASTEP `.magres` | The first line is `#$magres-abinitio-v` followed by a version number. An `[atoms]` block with a `lattice` line is required. The optional `[magres]` block can hold `ms`, `efg`, `isc` and `sus`. | One model. `ms` and `efg` are arrays of `TensorData`, one per atom. `isc` is an N×N array. `sus` goes to `model.info`. `hf` tensors come from a `magres_old` block when one is present. |
| `magres-json` | Magres-JSON (text or parsed object) | `version` must be `"1.0"`. `atoms` needs `units`, `lattice` and `atom`. See the example below. | One model. The same `ms`, `efg`, `isc` and `hf` arrays as `magres`. `sus` goes to `model.info`. |

For Magres-JSON, the validator checks the object against `schemas/magres.json`. A minimal valid object looks like this:

```js
const structure = {
    version: '1.0',
    atoms: {
        units: [['lattice', 'Angstrom'], ['atom', 'Angstrom']],
        lattice: [[[10, 0, 0], [0, 10, 0], [0, 0, 10]]],
        atom: [
            { species: 'H', label: 'H', index: 1, position: [1, 2, 3] },
            { species: 'C', label: 'C', index: 1, position: [4, 5, 6] }
        ]
    },
    magres: {
        units: [['ms', 'ppm']],
        ms: [
            { atom: { label: 'H', index: 1 }, sigma: [[30, 0, 0], [0, 30, 0], [0, 0, 30]] }
        ]
    }
};
vis.loadModels(structure, 'magres-json', 'demo');
```

Each tensor array needs a declared unit in `magres.units`: `ms` is `ppm`, `efg` is `au`, `isc` is `10^19.T^2.J^-1`, `sus` is `10^-6.cm^3.mol^-1`, and `hf` is `MHz`. The `magres` block is optional. The `calculation` object is optional and is kept as metadata.

## How models are named

The prefix defaults to the format string, so `loadModels(text, 'xyz')` produces a model called `xyz`. A CIF file with several data blocks produces one model per block, named `prefix_block`. For example, `loadModels(cif, 'cif', 'cha')` on a file with the block `CHA` gives `cha_CHA`. Other formats produce a single model named after the prefix.

If a name is already taken, the new model gets a suffix: `_1`, then `_2`, and so on.

Do not build names by hand. Read them from the status object that `loadModels` returns. Its keys are the model names, and each value is `0` on success or an error message string:

```js
const status = vis.loadModels(cif, 'cif', 'cha');
const names = Object.keys(status).filter((name) => status[name] === 0);
vis.displayModel(names[0]);
```

## Show the whole supercell

`supercell` is a parameter that repeats the cell of a periodic structure. It defaults to `[1, 1, 1]`. The `supercell` value is only used for periodic structures.

`displayModel` shows only the cell at offset `[0, 0, 0]`. To show every image in the supercell, set `vis.displayed` to a view of all atoms. `displayModel` fits the camera to the atoms it shows, so call `vis.fitCamera()` after changing `vis.displayed` to frame the new set. In the example, `vis.model.length` counts atoms in the base cell, and `vis.model.atoms` holds every image.

{{example loading-supercell}}

## Keep molecules whole

The `molecularCrystal` parameter controls molecules that cross the cell boundary:

- `false` (the default) leaves each atom where the file puts it, so a molecule can appear split across faces of the cell.
- `true` moves atoms across periodic boundaries so each molecule is whole in the cell.
- `null` turns this on automatically when the structure has a C–H bond.

Molecules are found from the bonds (see the next section), so the bond rule also decides which atoms form a molecule. With `molecularCrystal: true`, `model.positions` returns the shifted coordinates, not the ones in the file.

{{example loading-molecular}}

## Control which atoms are bonded

Two atoms are bonded when their distance is less than the mean of their radii. Each radius is the element's van der Waals radius multiplied by a scale factor. The global factor is `vdwScaling`, which defaults to `1.0`. An element listed in `vdwElementScaling` uses its own factor instead, so `{ H: 0.8 }` shrinks hydrogen radii only. Bonds across periodic boundaries are included.

Bonds are fixed when the model is built. To change them, load the file again with new parameters, or call `reloadModel`.

{{example loading-bonds}}

## Work with several models

`vis.modelList` lists the names of all loaded models. `displayModel(name)` shows one of them and clears the previous one, and `displayModel()` with no argument clears the scene. `deleteModel(name)` removes one model, and `unloadAll()` removes all of them.

`reloadModel(name, parameters)` rebuilds a model under the same name, and it does not return anything. The parameters you pass are merged over the model's current ones, so you only need to give the ones that change. If the model is on screen, it is redisplayed. Any `Model`, `ModelView` or `AtomImage` you held before is out of date, so query the model again.

Two events let you keep a UI in step with the loaded models. Both return an unsubscribe function:

- `onModelListChange(cb)` calls `cb(names)` after `loadModels`, `deleteModel` and `unloadAll`.
- `onDisplayChange(cb)` calls `cb(name)` when `displayModel` completes, with `null` when the scene is cleared.

{{example loading-models}}

## Read back what was loaded

Each model keeps the text, format, prefix and parameters it was loaded with, so you can save a session and restore it later. The getters return copies, or `null` for an unknown name.

```js
const source = vis.getModelSource('ethanol');   // { text, extension }
const params = vis.getModelParameters('ethanol'); // includes defaults such as supercell
const meta = vis.getModelMeta('ethanol');       // { prefix, originalName }

vis.loadModels(source.text, source.extension, meta.prefix, params);
```

On a loaded model, `model.cell` returns the base cell as a 3×3 array in Å, `model.periodic` is `true` when the structure is periodic in all three directions, and `model.info` holds format-specific extras, such as the `sus` tensor from a Magres file.

## Set loading parameters

Pass parameters as the fourth argument to `loadModels`. Any you leave out take the defaults below. The XYZ options (`frame`, `shieldingTag`, `efgTag`) only apply when loading, and other formats ignore them.

| Parameter | Default | Effect |
| --- | --- | --- |
| `supercell` | `[1, 1, 1]` | Repeats the cell of a periodic structure. |
| `molecularCrystal` | `false` | `true` makes molecules whole across cell boundaries. `null` turns this on when the structure has a C–H bond. |
| `useNMRActiveIsotopes` | `false` | Sets each element's isotope to the most common one with non-zero spin. |
| `vdwScaling` | `1.0` | Global factor for van der Waals radii. |
| `vdwElementScaling` | `{}` | Per-element factors, for example `{ H: 0.8 }`. An element listed here uses its own factor instead of `vdwScaling`. |
| `frame` | `-1` | Multi-frame XYZ only. The frame to load, 0-based. Negative values count from the end, so `-1` is the last frame. |
| `shieldingTag` | `'ms'` | XYZ only. The property name read as the shielding tensor. |
| `efgTag` | `'efg'` | XYZ only. The property name read as the EFG tensor. |

To load the first frame of a multi-frame XYZ file, such as `test/data/ethanol_with_tensors.xyz` (three frames), pass `frame: 0`:

```js
const xyz = await fetch('data/ethanol_with_tensors.xyz').then((r) => r.text());
vis.loadModels(xyz, 'xyz', 'first', { frame: 0 });
vis.displayModel('first');
```

## Limitations

- **Errors** are reported in two ways. For CIF, CASTEP cell, Magres and Magres-JSON, a failed load does not throw. The status value for that model is the error message, and the viewer shows a notification. For Extended XYZ, a parse error throws, and so does an unknown format string. All thrown errors are `Error` objects, so `err.message` works. Wrap calls in `try`/`catch` and check the status object. See [handling loading errors](getting-started.html#handle-loading-errors).
- **Units** for `lattice` and `atom` must be `ang` or `Angstrom`. The tensor units are checked against the list above, but values are not converted.

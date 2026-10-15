---
title: Selecting atoms
nav: Selecting atoms
description: Find atoms with queries, combine them, walk bonds and molecules, respond to clicks and box drags, and save a selection or camera view.
order: 3
---

# Selecting atoms

Queries pick out atoms by element, site label, position, or bonding. Clicks and box drags change the selection, and you can save a selection or the camera view and restore it later.

## Models, views and atoms

A `Model` holds every atom image in the supercell you loaded. `model.length` is the number of atoms in the base cell, and `model.atoms` is the full list of periodic images, each an `AtomImage`. Each image has two indices:

- `atom.index` is the atom's index in the base cell, shared by all its periodic images.
- `atom.imgIndex` is its position in `model.atoms`, and identifies this one image.

A [`ModelView`](api/ModelView.html) is a set of image indices on one model. The two views that matter most are `vis.displayed`, which is what the scene shows, and `vis.selected`, which is what is highlighted. Both are `ModelView`s, and assigning anything else throws an error. By default, `vis.displayed` is the `[0,0,0]` cell, and `displayModel()` centres the camera on it. After you change `vis.displayed`, call `vis.fitCamera()` to centre and zoom on the new atoms.

Queries return `ModelView`s, and their set operations return new views rather than changing the one you have. A view refers to the atoms themselves, so `setProperty` on a result changes the atoms on screen.

## Find atoms with a query

Call `model.find(query)` with an object whose single key is the query name and whose value is the query's arguments. The table lists every query that the model accepts.

| Query | Argument form | Matches |
| --- | --- | --- |
| `all` | `{all: []}` | Every atom image in the supercell. |
| `elements` | `{elements: ['Si', 'O']}` | Atoms whose element is one of the symbols. |
| `labels` | `{labels: ['O1', 'O3']}` | Atoms whose site label (`crystLabel`) is one of the labels, in every periodic image. |
| `indices` | `{indices: [0, 1, 2]}` | Atoms with these base-cell indices, in every periodic image. |
| `molecule` | `{molecule: [a, b]}` | Every atom in the molecules that contain `a` or `b`. |
| `cell` | `{cell: [[i, j, k]]}` | Atoms in the cell with offset `[i, j, k]`. |
| `box` | `{box: [[x0, y0, z0], [x1, y1, z1]]}` | Atoms inside an axis-aligned box. Corners are positions in Å, or `AtomImage`s. |
| `sphere` | `{sphere: [center, r]}` | Atoms within `r` Å of `center`. The centre is a position in Å, or an `AtomImage`. |
| `bonded` | `{bonded: [atoms, distance, exact]}` | Atoms within `distance` bonds of `atoms`. With `exact` set to `true`, only atoms at exactly that distance. See [Walk bonds and molecules](#walk-bonds-and-molecules). |

`elements`, `labels`, `indices` and `molecule` take a list of values, which can be flat or nested. The others take positional arguments. The section on [which queries take lists](#pass-lists-of-values) explains the difference.

> **Note:** Queries only see the images in the loaded supercell. The default `[1,1,1]` misses neighbours across the cell boundary, so load a larger supercell when a search crosses a boundary, for example `{supercell: [2, 2, 2]}` for a search centred near an edge.

The example picks the Si atom nearest the centre of the cell in chabazite, so all its neighbours lie inside the displayed cell. It then selects the O atoms within 3.5 Å of it. Click an atom to change the selection in the same way.

{{example selecting-sphere}}

Use `view.find(query)` to search only within an existing view. `unique_labels_multiplicity` counts the atoms in a view by site label.

## Pass lists of values

`elements`, `labels`, `indices` and `molecule` each take a list of values. You can write the list flat or nested, and both select the same atoms: `{elements: ['Si', 'O']}` and `{elements: [['Si', 'O']]}` are equivalent. A single value also works, so `{elements: 'O'}` is fine.

`sphere`, `box`, `bonded` and `cell` take positional arguments, so the list is the arguments themselves. `{sphere: [center, 3.5]}` is a centre and a radius, and `{cell: [[0, 0, 0]]}` is one cell offset. Write `{cell: [0, 0, 0]}` by mistake and the query silently finds nothing, because the list is read as three arguments.

## Combine queries

Combine queries with `$and`, `$or` and `$xor`. An object with several keys is an implicit `$and`, so these two queries are the same:

```js
model.find({ elements: 'O', sphere: [[0, 0, 0], 3] });
model.find({ $and: [{ elements: 'O' }, { sphere: [[0, 0, 0], 3] }] });
```

`$or` takes the union of its queries, and `$xor` takes the atoms that match exactly one of them. Each operator takes a list of queries.

ModelViews have set operations that work on results you already hold. Each returns a new view, and both views must belong to the same model:

| Method | Result |
| --- | --- |
| `a.and(b)` | Atoms in both views. |
| `a.or(b)` | Atoms in either view. |
| `a.xor(b)` | Atoms in one view but not both. |
| `a.not()` | Every atom in the model that is not in `a`. |
| `a.remove(b)` | Atoms in `a` that are not in `b`. |
| `a.find(query)` | Atoms in `a` that also match the query. |

The example selects the O atoms in the `[0,0,0]` cell and then removes the ones within 3 Å of the origin. It colours what remains.

{{example selecting-combine}}

## Walk bonds and molecules

Bonds come from the distance between atoms, and bonds across a periodic boundary count too. The `bonded` query walks outward from one or more atoms. `{bonded: [atom, 1]}` returns the direct neighbours, and `{bonded: [atom, 2, true]}` returns only the atoms exactly two bonds away. The starting atoms are never included.

The `molecule` query returns whole molecules. For a molecular crystal, pass `molecularCrystal: true` to `loadModels` so that molecules are kept whole across cell boundaries. A value of `null` detects organic molecules automatically, from C–H bonds.

The example colours the direct neighbours of one carbon atom, and the atoms two bonds away. It then shows only that molecule, hides the unit-cell box with `model.box.visible = false`, and calls `vis.fitCamera()`, which centres the camera on the molecule and zooms so it fills the view.

{{example selecting-bonded}}

## Select by site label

Site labels come from the CIF file, such as `O1` or `T1`. The `labels` query selects atoms by these labels, and it matches every periodic image of each site. The example lists the labels of the oxygen atoms in chabazite, then colours two of the sites.

{{example selecting-labels}}

## One atom per site

`uniqueSites()` returns a view with one atom for each site label. It keeps the first image it finds for each label, so the result has one atom per crystallographic site, whatever the supercell. To take whole sites, use the `labels` query instead.

```js
const oxygens = vis.model.find({ elements: 'O' });
const sites = oxygens.uniqueSites();
console.log(sites.length, 'sites');
console.log(oxygens.unique_labels_multiplicity); // {label: count}
```

Formats without site labels, such as XYZ, get generated labels such as `Si_1`, so each base atom gets its own label. `crystLabel` is shared by all the periodic images of one base atom.

## Respond to clicks

Use `vis.onAtomClick(callback, flags)` to run your own code when an atom is clicked. The callback receives the `AtomImage` and the browser event:

```js
vis.onAtomClick((atom, event) => {
    console.log(atom.crystLabel, atom.element);
}, CrystVis.LEFT_CLICK);
```

Flags are bit values that you add together. Pass exactly one button flag, then any modifiers you need:

| Flag | Value | Meaning |
| --- | --- | --- |
| `CrystVis.LEFT_CLICK` | 1 | Left button. |
| `CrystVis.MIDDLE_CLICK` | 2 | Middle button. |
| `CrystVis.RIGHT_CLICK` | 4 | Right button. |
| `CrystVis.ALT_BUTTON` | 8 | Alt key held. |
| `CrystVis.CTRL_BUTTON` | 16 | Ctrl or Cmd key held. |
| `CrystVis.CMD_BUTTON` | 16 | The same value as `CTRL_BUTTON`. Ctrl and Cmd are treated alike on every platform. |
| `CrystVis.SHIFT_BUTTON` | 32 | Shift key held. |

By default, a left click selects the atom, Shift and left click adds it to the selection, and Ctrl or Cmd and left click toggles it. A callback you register for a flag replaces that default. Pass `null` to restore the default, for example `vis.onAtomClick(null, CrystVis.LEFT_CLICK)`. Only atoms can be clicked, not bonds, and there is no hover event.

The example logs the site and position of each atom you left-click. It keeps the default selection behaviour by setting `vis.selected` itself. Right-click an atom to log the atoms bonded to it. Click atoms in the viewer to try it.

{{example selecting-click}}

## Select with a box

Hold Shift and drag across the viewer to draw a selection box. Each atom inside the box is passed to the callback as a `ModelView`. A box that is too small is ignored.

By default, the box toggles the atoms it covers, so they are added to the selection or removed from it if they are already selected. To use your own behaviour, pass a callback to `onAtomBox`:

```js
vis.onAtomBox((view) => {
    vis.selected = vis.selected.or(view);
});
```

Pass `null` to restore the default toggling.

## Save and restore a selection or view

A `ModelView` can be saved as plain data. `toIndices()` gives the image indices, and `model.viewFromIndices()` restores them. These indices depend on the supercell, so restore the selection onto the same file loaded with the same parameters.

`toLabels()` and `model.viewFromLabels()` save site labels instead. They survive a reload that changes atom order, but a label matches every periodic image of that site, so the restored view can contain more atoms than you saved.

The camera state is plain data too. `getCameraState()` returns the position, target, and zoom, and `setCameraState()` restores them. `onCameraChange(callback)` fires whenever the camera moves, and returns a function that removes the listener.

This code saves the selection and camera to `localStorage`, and restores them when the page loads again:

```js
const key = 'crystvis-view';

function saveView(vis) {
    localStorage.setItem(key, JSON.stringify({
        indices: vis.selected.toIndices(),
        camera: vis.getCameraState(),
    }));
}

function restoreView(vis) {
    const saved = JSON.parse(localStorage.getItem(key));
    if (!saved) return;
    vis.selected = vis.model.viewFromIndices(saved.indices);
    vis.setCameraState(saved.camera);
}

const stopCamera = vis.onCameraChange(() => saveView(vis));
// Call stopCamera() before disposing of the viewer.
```

The camera callback fires many times during a drag, so you may want to throttle the saving. Call `dispose()` on the viewer when you unmount it.

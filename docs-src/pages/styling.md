---
title: Styling and annotations
nav: Styling
description: Set atom colour, size, opacity and visibility, label atoms, draw distances and spheres, choose a theme, add three.js objects and isosurfaces, and save screenshots.
order: 4
---

# Styling and annotations

Most styling is set on a `ModelView` with `setProperty`. Labels, distances, and spheres are drawn on the model, and the theme sets the background. This page covers each one, and ends with custom three.js objects and screenshots.

## Change colour, size and opacity

Each atom has `color`, `opacity`, `radius` (in Å), `scale` (a multiplier on the default radius), `visible`, and `highlighted`. `setProperty(name, value)` sets one of these across a view. The value can be:

- a single value, used for every atom in the view
- an array with one value per atom, in the same order as `view.atoms`
- a function `(atom, i)` that returns the value for each atom

Leave out the value to reset the property to its default. For `color`, `opacity`, `radius`, and `scale`, that means the CPK colour, full opacity, the default radius, and a scale of 1. For `visible`, it means visible.

Colours can be hex integers such as `0xff0000` or CSS strings such as `'#8fdb95'`. Setting an atom's colour or opacity also sets the same on the bonds at its ends. Opacity below 1 makes the atom transparent.

The example shrinks the oxygen atoms, recolours the silicon atoms, and makes the oxygen semi-transparent.

{{example styling-properties}}

## Colour atoms by a property

To colour atoms from data, pass a function. It receives each `AtomImage` and its index in the view, and returns a colour. Hex integers are the simplest return value, so a function that computes a number works directly.

The example maps each atom's fractional z coordinate onto a blue-to-red ramp:

{{example styling-gradient}}

If you already have one value per atom, pass an array of the same length as the view instead of a function.

## Show and hide atoms

`vis.displayed` is the set of atoms that is shown. To show a subset, set `displayed` to a new view. Setting it hides the old view and shows the new one.

```js
vis.displayed = vis.displayed.remove(vis.model.find({ elements: 'O' }));
```

`remove(view)` returns a view without the atoms in `view`. Avoid `not()` here: it is the complement over every atom in the model, including atoms in other cells, not over the displayed set.

`displayModel()` centres the camera on the displayed atoms and zooms so they fill the view. After you change `vis.displayed`, call `vis.fitCamera()` to do the same for the new set. It takes any ModelView, `vis.fitCamera(view, padding)`, and `padding` (default 0.1) sets the margin.

`view.hide()` and `view.show()` change visibility without changing `displayed`, so the next time you set `displayed` the change is undone. Set `displayed` instead. To hide one atom, set `atom.visible = false`. The value is kept if the model is not displayed, and applied when it is shown.

## Adjust bonds

There is no view-level bond API. Each atom has `atom.bonds`, a list of `BondImage` objects with `radius` (default 0.2 Å), `visible`, `length`, `atom1`, and `atom2`. Set these properties on the bonds you want:

```js
vis.displayed.map((a) => a.bonds).flat().forEach((b) => {
    b.radius = 0.1;
});

vis.displayed.map((a) => a.bonds).flat()
    .filter((b) => b.atom1.element === 'O' || b.atom2.element === 'O')
    .forEach((b) => {
        b.visible = false;
    });
```

With the default 1×1×1 supercell, a bond to an atom in a neighbouring cell is not drawn, because that atom is not part of the model. Load a larger supercell if you need those bonds.

## Label atoms

`addLabels(text, name, params)` adds a text label to each atom in the view. `text` is a string, an array, or a function `(atom, i)`, and it defaults to the element symbol. `name` identifies the label set, so that `removeLabels(name)` and `labelProperties(name, property, value)` can find it.

The third argument is an object, or a function that returns one per atom. The useful options are:

- `height`: the label size in Å (default `0.04`)
- `shift`: an `[x, y, z]` offset from the atom (default: one atomic radius to the right)
- `color`, `faceCamera`, `fixScale`, and `onOverlay`

Call `labelProperties(name, property)` with no value to read a property, which returns an array. Call it with a value to set one, for example `labelProperties('site', 'color', 0xf2d21b)`. It only changes atoms that already have that label.

If a view holds several images of the same site, call `uniqueSites()` first. It keeps one atom per `crystLabel`. The example loads an organic crystal with `molecularCrystal: true`, so each molecule is whole, then shows one molecule, hides the cell box, fits the camera to the molecule, and labels its heavy atoms. Hydrogens stay visible but unlabelled:

{{example styling-labels}}

Labels take the theme's `label_color` (white on dark, black on light) unless you pass `color`. A label keeps the colour it had when it was added, so set the theme before you add labels.

## Draw distances and spheres

`vis.model.addLink(from, to, name, label, params)` draws a line between two points. `from` and `to` can be `[x, y, z]` in Å or `AtomImage` objects. The optional `label` is text drawn at the midpoint, and `params` takes `color`, `dashed`, `linewidth`, and `onOverlay`. Reusing a `name` replaces the earlier line. Use `removeGraphics(name)` to remove one graphic, and `clearGraphics()` to remove them all.

`vis.model.addSphere(center, radius, name, params)` draws a sphere with `radius` in Å. `center` is `[x, y, z]` or an `AtomImage`. Its defaults are a white colour and an opacity of 0.5.

A link label takes the link's `color`, or the theme's `label_color` if there is none. Use `labelColor` to set the label colour separately.

The example takes the silicon nearest the cell centre, links it to its nearest bonded oxygen, and links it to the nearest silicon that does not share an oxygen with it. It then draws a 3 Å sphere around the silicon. The labels show the distances:

{{example styling-links}}

> **Note:** `addLink` and `addSphere` do nothing, and do not throw, unless the model is displayed. Call them after `displayModel`.

## Unit cell and theme

`vis.theme` is `'dark'` (the default, with a black background) or `'light'`. You can also pass an object with hex-integer values for the keys `background`, `foreground`, `highlight`, `cell_line_color`, and `label_color`. The library reads `background`, `cell_line_color`, and `label_color`. It stores `foreground` and `highlight` but does not use them, so give all five keys anyway.

The unit-cell box takes `cell_line_color` when its model is first displayed. Set the theme before `displayModel`, or set `vis.model.box.color` afterwards, as the example does. Labels and notifications take `label_color` when they are created.

The example switches to the light theme, sets a cobalt box, labels two sites, and adds a notification. The labels are black because they are created after the theme changes:

{{example styling-theme}}

## Add your own three.js objects and isosurfaces

`vis.addPrimitive(object)` adds any `THREE.Object3D` to the scene, and `vis.removePrimitive(object)` removes it. Its coordinates are in Å, in the same frame as the atom positions. The object stays in the scene across `displayModel()` calls until you remove it.

`IsosurfaceMesh` draws a surface through a volumetric field. Import it from the library's internal path, `@ccp-nc/crystvis-js/lib/primitives/index.js`. This is not part of the stable public API, so its constructor may change between releases.

```js
new IsosurfaceMesh(field, threshold, lattice, options)
```

- `field` is a nested array indexed as `field[x][y][z]`. Grid point `i` sits at fraction `i / n` of the cell along that axis, where `n` is the grid size. The field spans the whole cell.
- `threshold` is in the same units as the field values. The surface is where the field equals the threshold.
- `lattice` is the 3×3 cell matrix, for example `vis.model.cell`.
- `options` takes `color` (default `0x00ff00`), `opacity` (default `0.5`), `opacityMode`, and `isoMethod`.

`opacityMode` is `IsosurfaceMesh.RENDER_DITHER` (the default), `RENDER_PHONG`, or `RENDER_WFRAME`. `isoMethod` is `IsosurfaceMesh.ISO_SURFACE_NETS` (the default), `ISO_MARCHING_CUBES`, or `ISO_MARCHING_TETRAHEDRA`. The `color` and `opacity` properties can be changed later. Opacity has no effect in wireframe mode.

The example builds a 24³ grid whose values are the distance from the cell centre, then draws the surface at a radius of 6 grid points:

{{example styling-isosurface}}

## Save a screenshot

`vis.getScreenshotData(transparent = true, pixelRatio = 3)` returns a PNG data URL of the current view. It is synchronous: it renders a frame and reads the canvas before it returns. Pass `false` for `transparent` to get an opaque background in the theme's background colour.

```js
const link = document.createElement('a');
link.href = vis.getScreenshotData(false, 2);
link.download = 'structure.png';
link.click();
```

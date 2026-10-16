---
title: NMR tensors
nav: NMR tensors
description: Read shielding, EFG and hyperfine tensors from magres and extended XYZ files, draw them as ellipsoids, and show how the principal axes of two tensors are related.
order: 5
---

# NMR tensors

CrystVis reads per-atom tensors such as NMR shielding (`ms`) and electric field gradients (`efg`) and wraps each one in a `TensorData` object. You can read its parameters, draw it as an ellipsoid, and show how the principal axes of two tensors are oriented relative to each other.

## Where tensor data comes from

The loaders store tensors as named per-atom arrays on the model:

| Format | Arrays | Notes |
| --- | --- | --- |
| `magres` (CASTEP) | `ms`, `efg`, `isc`, `hf` | Other tags keep their own name, for example `efg_local`, `efg_nonlocal` and `isc_fc`. `hf` comes from the older `magres_old` block. |
| `magres-json` | `ms`, `efg`, `isc`, `sus`, `hf` | Pass a string or an object. |
| `xyz` (extended XYZ) | `ms`, `efg` | Nine-column properties with those names. |

Units follow the file. `ms` is in ppm, `efg` is in atomic units, `isc` is in 10¹⁹ T² J⁻¹, and `hf` is in MHz.

Each array has one entry per atom in the base cell, and periodic images share the entry of their base atom. `isc` is an N×N array of arrays, and `hf` can contain `null` for atoms without hyperfine data. Check that an array exists before you use it:

```js
if (vis.model.hasArray('ms')) {
    const perAtom = vis.model.getArray('ms');       // one TensorData per base atom
    const tensor = atom.getArrayValue('ms');        // the TensorData for this atom
}
```

## Read tensor parameters

A `TensorData` diagonalises the symmetric part of its matrix. The getters below expose the results. Eigenvalues in Haeberlen order are `haeberlen_eigenvalues`, and eigenvalues in NQR order are `nqr_eigenvalues`. Both are fixed, whatever `convention` is set to.

| Getter | Value |
| --- | --- |
| `isotropy` | The mean of the three eigenvalues, σiso. |
| `anisotropy` | λ₃ − (λ₁ + λ₂)/2, with λ₁, λ₂, λ₃ in Haeberlen order. |
| `reduced_anisotropy` | λ₃ − σiso, with λ in Haeberlen order. |
| `asymmetry` | (λ₂ − λ₁)/`reduced_anisotropy`, with λ in Haeberlen order. |
| `span` | The largest minus the smallest eigenvalue. |
| `skew` | 3(λ_mid − σiso)/`span`, with λ_mid the middle eigenvalue in increasing order. |
| `symmetry` | 2 if spherical, 1 if axial, 0 if triaxial. |

The eigenvalues and eigenvectors that `eigenvalues` and `eigenvectors` return depend on the `convention` property. The four orderings are:

| Convention | How the three principal axes are ordered |
| --- | --- |
| `increasing` | λ_xx ≤ λ_yy ≤ λ_zz. This is the default. |
| `decreasing` | λ_xx ≥ λ_yy ≥ λ_zz. |
| `haeberlen` | Axis z has the largest \|λ − σiso\|, x the middle one and y the smallest. Used for `ms`. |
| `nqr` | Axis z has the largest \|λ − σiso\|, y the middle one and x the smallest. Used for `efg`. |

The third axis of each frame is the cross product of the first two, so each PAS frame is right-handed.

> **Note:** These formulas are the ones `tensor.js` implements. Some papers define anisotropy or asymmetry with a different sign or factor, so check before you compare numbers.

The example loads ethanol. It logs the isotropic shielding, anisotropy and asymmetry for each site, and it writes σiso onto every atom as a label.

{{example nmr-parameters}}

## Draw tensors as ellipsoids

`ModelView.addEllipsoids` draws one ellipsoid per atom, and `AtomImage.addEllipsoid` does the same for a single atom. The data argument can be a function of the atom, an array, or a single tensor. Each ellipsoid's semi-axes lie along the PAS axes, and each has a length equal to its eigenvalue times `scalingFactor`.

The default convention depends on the array name: `ms` uses `haeberlen`, `efg` uses `nqr`, and anything else uses `increasing`. Set `convention` in the parameters to override it.

The main parameters are `color` (default `0xff0000`), `opacity` (default 0.5), `scalingFactor` (default 1.0), and the `showEllipsoid`, `showCircles` and `showAxes` flags.

The default `scalingFactor` of 1.0 is far too large for shielding in ppm. A 30 ppm eigenvalue would give a 30 Å radius. The example below uses 0.075 for `ms`, so a 30 ppm H atom has a radius of about 2.3 Å. Most of the size of a shielding ellipsoid comes from σiso, so differences in shape are small. Choose the scale for the data you are showing.

Atoms whose data is `null` or `undefined`, such as `hf` on atoms without hyperfine data, are skipped, so you do not need to filter the array first.

The first live example draws the shielding tensor of each H atom in blue:

{{example nmr-ellipsoids}}

Electric field gradients use `nqr` ordering by default. The second example draws the EFG of each C and O atom, with a separate scale for each element because their magnitudes differ. It then computes the quadrupolar coupling of O-17.

{{example nmr-efg}}

`efgAtomicToHz(Q)` returns a converted copy of the tensor, in Hz, and `haeberlen_eigenvalues[2]` is the zz component. The example divides by 10⁶ to report MHz. Q is in millibarn, and the isotope tables give O-17 as −25.58 mb. The example gets Q from the atom itself: `atom.isotope = 17` selects O-17, and `atom.isotopeData.Q` returns its moment. The default O isotope is O-16, which has no quadrupole moment (`Q` is `null`). The result is about 11.19 MHz.

## Build a tensor yourself

Use `new TensorData(...)` to make a tensor from data you already have. The constructor accepts a 3×3 array, a flat array of nine values in row-major order, or `[eigenvalues, eigenvectors]`, where the eigenvectors are the columns of a 3×3 matrix. The constructor works on the symmetric part of the matrix. The antisymmetric part is kept but ignored by the getters.

```js
import { TensorData } from '@ccp-nc/crystvis-js';

const fromMatrix = new TensorData([[10, 0, 0], [0, 20, 0], [0, 0, 60]]);
const fromFlat = new TensorData([10, 0, 0, 0, 20, 0, 0, 0, 60]);

// Eigenvectors are the columns of the matrix. This rotation is zyz (0.5, 1.0, 0.3) rad.
const R = [
    [0.311302, -0.598137, 0.73846],
    [0.506809, 0.761837, 0.403423],
    [-0.803888, 0.248672, 0.540302],
];
const fromPAS = new TensorData([[10, 20, 60], R]);

// Euler angles in radians. Pass degrees = true for degrees.
const [alpha, beta, gamma] = fromPAS.euler('zyz', true, 'haeberlen');
```

`euler(sequence = 'zyz', active = true, convention = null, degrees = false)` returns `[α, β, γ]`. It uses the tensor's `convention` unless you pass one. The angles are in radians unless `degrees` is `true`.

## Relate two tensor orientations

`relativeOrientationTo(other, specification)` returns a `RelativeTensorOrientation`. It describes how the PAS frame of one tensor is rotated onto the PAS frame of the other. The specification options are:

| Option | Default | Meaning |
| --- | --- | --- |
| `sourceConvention`, `targetConvention` | Each tensor's `convention` | The PAS ordering used for each tensor. |
| `sequence` | `'zyz'` | Euler sequence, `'zyz'` or `'zxz'`. |
| `active` | `true` | `true` for an active rotation, `false` for a passive one. |
| `tolerance` | `1e-6` | Relative tolerance, scaled by the larger of 1 and the norm of each tensor. |
| `singularGauge` | `'gamma-zero'` | Which angle is reported as zero in a singular state. Either `'gamma-zero'` or `'alpha-zero'`. |

The `orientationClass` property tells you what you can do with the result:

| Class | When it occurs | What to do |
| --- | --- | --- |
| `discrete` | Neither tensor is spherical, and no axial tensor has its unique axis on x. | Use `configurations`, which is a finite list. |
| `continuous` | An axial tensor has its unique axis on x in the chosen ordering. | `configurations` is empty. Read `freeRotation` and show the frames without angles. |
| `indeterminate` | One tensor is spherical. | `configurations` is empty and there are no angles to show. |

Haeberlen and NQR ordering always place an axial tensor's unique axis on z. An axial tensor is therefore `discrete` with those orderings. The `continuous` case appears only with `increasing` or `decreasing` ordering, when that ordering puts the unique axis on x.

### Configurations

A discrete orientation has one configuration for each pair of equivalent PAS frames. Each frame can be flipped by a 180° rotation about one of its own axes, and the tensor's symmetry allows that. Each configuration has these fields:

- `id`, for example `source:flip-x|target:identity`. It is unique within one orientation object.
- `source.frame` and `target.frame`, the PAS frames as 3×3 matrices whose columns are the principal axes.
- `euler`, the `[α, β, γ]` angles in radians that reproduce the relative rotation.
- `activeRotation` and `passiveRotation`, the rotation matrices for each sense.
- `singular` and `gauge`, described below.

There are 16 configurations for two triaxial tensors, 8 when one tensor is axial, and 4 when both are axial. To find a configuration by its ID, call `orientation.configuration(id)`.

In `configurations`, α and γ lie in [0, 2π) and β lies in [0, π]. `canonicalConfigurations` is the subset in the NMR ranges: β in [0, 90°], and γ below 180° for an active rotation or α below 180° for a passive one. A triaxial pair has four of them. For ethanol's C1 pair (`ms` against `efg`), this gives four:

```js
const canonical = orientation.canonicalConfigurations;
```

Passive angles describe the same geometry as the inverse rotation. β is the same as for the active sense, but α and γ are different. Use the sense that your data convention uses.

### Singular states

When |sin β| is within `tolerance`, the first and last rotations are not separately defined. In that case `configuration.singular.isSingular` is `true`, and only the combined twist is meaningful. `singularGauge` chooses which angle is reported as zero. `'gamma-zero'` sets γ to zero and puts the twist into α, and `'alpha-zero'` does the reverse. `configuration.singular.gauge` records which gauge was used.

For an axial tensor, the rotation about its unique axis is free. Discrete solutions set that angle to zero, and `configuration.gauge.zeroed` says which one. The Euler disks mark it with a ring rather than an arc.

## Show the relative orientation with Euler disks

`atom.addEulerDisks(orientation, name, parameters)` draws the two PAS frames on an atom. `view.addEulerDisks` does the same for each atom in the view. The source frame is drawn in `color1` and the target frame in `color2`. The disks also show the α, β and γ arcs for the selected configuration and the line of nodes.

| Parameter | Default | Meaning |
| --- | --- | --- |
| `configurationId` | The first configuration | The configuration to show first. |
| `radius` | `4.0` | Disk radius, in Å. |
| `scalingFactor` | `5.0` | The axes are drawn at `radius` × `scalingFactor`. |
| `color1`, `color2` | Red, green | Colours for the source and target frames. |
| `opacity` | `0.75` | Opacity of the disks. |

With the defaults, the axes are about 20 Å long, so set both `radius` and `scalingFactor` for a molecule. `atom.getEulerDisks(name)` returns the `EulerDisks` object, or `null` if none exists. Call `setConfiguration(id)` to jump to a configuration, or `animateToConfiguration(id, ms = 300)` to animate there.

Only discrete orientations can be cycled. A `continuous` orientation draws static frames, and `addEulerDisks` throws for an `indeterminate` one.

The example draws the disks on the first carbon only. It shows the first canonical configuration, logs the four canonical configurations with their Euler angles in degrees, and steps through them when that carbon is clicked. A callback passed to `onAtomClick` replaces the default selection, so other atoms no longer select when clicked.

{{example nmr-euler}}

## Terms

This page uses the terms defined in [CONTEXT.md](https://github.com/ccp-nc/crystvis-js/blob/main/CONTEXT.md), including PAS frame, PAS ordering, Euler specification, configuration ID, orientation class and singular display state. The full signatures are in the API reference for [`TensorData`](api/TensorData.html) and [`RelativeTensorOrientation`](api/RelativeTensorOrientation.html).

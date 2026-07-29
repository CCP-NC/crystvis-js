# Relative tensor orientation migration

> **Status:** planned breaking API change. MagresView 2 must migrate before adopting the Euler-angle visualisation overhaul.

For a complete downstream integration procedure, see the [MagresView 2 implementation guide](MagresView2RelativeOrientationGuide.md).

The relative-orientation API will replace the scalar-only `TensorData.eulerTo()` and `TensorData.equivalentEulerTo()` methods with:

```js
const orientation = tensorA.relativeOrientationTo(tensorB, {
	sourceConvention: 'haeberlen',
	targetConvention: 'nqr',
	sequence: 'zyz',
	active: true,
	tolerance: 1e-6,
});
```

`orientation` will be a `RelativeTensorOrientation` object. It is the source of truth for numerical Euler solutions and their 3D visualisation. It will explicitly include:

- the source and target PAS orderings;
- the Euler sequence (`zyz` or `zxz`) and rotation sense (`active` or `passive`);
- the orientation class: `discrete`, `continuous`, or `indeterminate`;
- selectable PAS-frame configurations, each with source/target frames, a relative rotation, and a canonical Euler solution;
- singular-state metadata, including the canonical zero-angle gauge when the line of nodes is undefined; and
- explicit axial free-rotation/reference-gauge metadata.

The `specification.tolerance` value will be the single scale-aware relative threshold for all orientation comparisons. Its default is $10^{-6}$, applied relative to $\max(1,\lVert T_A\rVert_2,\lVert T_B\rVert_2)$.

## Migration implications for MagresView 2

- Do not consume an unlabelled array of Euler triples.
- Populate the equivalent-angle cycle button from `orientation.configurations`; this is a finite list only for `discrete` orientations.
- Do not offer a cycle button for a `continuous` or `indeterminate` orientation. A later UI may bind an axial `freeRotation` parameter to a slider.
- Treat configuration IDs as instance-local. When rebuilding an orientation, request nearest-frame matching from the previously selected frames rather than restoring an ID based on arbitrary eigenvector signs.
- Pass the same `RelativeTensorOrientation` object to the visualiser so the displayed axes, arcs, and numeric solution always refer to the selected configuration. Call `setConfiguration(configuration.id)` or `animateToConfiguration(configuration.id)` on the Euler disk primitive.
- Handle a singular display state separately: $\beta$ may have a canonical numeric value, but the separate first/third rotations and line of nodes are not physically defined. The default `singularGauge: 'gamma-zero'` reports $\gamma=0$ and assigns the residual rotation to $\alpha$. Set `singularGauge: 'alpha-zero'` to report $\alpha=0$ instead; both choices reconstruct the same rotation. Read `configuration.singular.gauge` to label this presentation choice.
- A `continuous` orientation caused by axial symmetry is different: its free rotation is physically unobservable. It has no canonical Euler triple, so use `freeRotation` metadata rather than displaying a fabricated numeric angle set.

## Canonical angle ranges

For a fixed PAS-frame configuration, the exact proper-Euler decomposition has $\beta \in [0,180^\circ]$. Narrower NMR ranges select a representative from the orientation equivalence class and must not be applied to a configuration while retaining its ID.

For a canonical representative, the target NMR ranges are:

| Rotation sense | $\alpha$ | $\beta$ | $\gamma$ |
| --- | --- | --- | --- |
| Active | $[0,360^\circ)$ | $[0,90^\circ]$ | $[0,180^\circ)$ |
| Passive | $[0,180^\circ)$ | $[0,90^\circ]$ | $[0,360^\circ)$ |

The visualiser renders the stored PAS frames and derives annotations from the selected configuration, rather than infer angles from rendered axes.

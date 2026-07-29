# Tensor Orientation Visualisation

This context defines the language for presenting the relative orientation of two NMR tensor principal-axis systems.

## Language

**PAS frame**:
A right-handed, ordered orthonormal frame formed by a tensor's principal axes under a selected eigenvalue-ordering convention.
_Avoid_: tensor orientation, eigenvector set

**PAS ordering**:
The eigenvalue-ordering convention used independently to form a tensor's PAS frame, such as increasing, decreasing, Haeberlen, or NQR order.

**Euler specification**:
The relationship-level choice of Euler sequence (`zyz` or `zxz`) and rotation sense (`active` or `passive`).

**Euler decomposition**:
The ordered elementary rotations defined by `rotateTensor()` for an Euler specification. It is the normative geometric meaning of rendered angle arcs.

**PAS-frame configuration**:
One selectable pair of equivalent PAS frames for the source and target tensors, each differing only by a right-handed 180° axis-flip symmetry.
_Avoid_: Euler configuration, disk configuration

**Configuration ID**:
The stable within-orientation identifier `source:<transform>|target:<transform>`, ordered lexicographically over `identity`, `flip-x`, `flip-y`, and `flip-z` PAS-frame transforms. Across rebuilt orientations, selection continuity is determined by nearest-frame matching rather than PAS signs or IDs.

**Relative rotation**:
The proper rotation mapping the source PAS frame in a PAS-frame configuration to its target PAS frame.
_Avoid_: relative Euler angles

**Relative tensor orientation**:
The framework-independent relationship between two tensor PAS frames, including their configurations, relative rotations, Euler solutions, and orientation class.

**Relative Euler solution**:
A canonical Euler-angle representation of a relative rotation under a specified Euler sequence and active/passive interpretation. Active solutions use $\alpha \in [0,360^\circ)$, $\beta \in [0,90^\circ]$, $\gamma \in [0,180^\circ)$; passive solutions exchange the reduced $\alpha$ and $\gamma$ ranges.
_Avoid_: equivalent angle set

**Degenerate PAS**:
A PAS whose eigenvalue symmetry leaves one or more axis directions physically undetermined.
_Avoid_: ambiguous tensor

**Reference gauge**:
The displayed but physically arbitrary transverse-axis orientation chosen for an axial PAS; its free rotation is explicit and is not included in the discrete configuration count.

**Orientation class**:
The physical determinacy of a relative tensor orientation: `discrete` for a finite set of PAS-frame configurations (including an axial tensor whose unique axis lies on the PAS Z, whose free rotation is gauged to zero), `continuous` for the fallback case where an axial tensor's chosen ordering places its unique axis on X so there is no simple single-angle gauge (shown statically), or `indeterminate` for a spherical tensor.

**Gauged Euler angle**:
The Euler angle corresponding to the free rotation about an axial tensor's unique axis, fixed to zero by convention: the last angle (γ, active) for an axial target, the first (α, active) for an axial source, both when both tensors are axial. It is displayed as zero and marked by the reference-gauge ring rather than a rotation arc.

**Configuration transition**:
An animation between PAS-frame configurations that interpolates the source and target PAS frames independently, then derives the changing relative rotation and visual annotations from those frames.

**Singular display state**:
A presentation state for a relative rotation with $|\sin\beta| \le \varepsilon$, where the line of nodes and separate first/third Euler rotations are undefined; the visualisation shows only the determined combined twist.

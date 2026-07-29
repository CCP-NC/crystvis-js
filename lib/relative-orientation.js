'use strict';

import * as mjs from 'mathjs';

const PI = Math.PI;
const FRAME_TRANSFORMS = [
    { name: 'identity', matrix: [[1, 0, 0], [0, 1, 0], [0, 0, 1]] },
    { name: 'flip-x', matrix: [[1, 0, 0], [0, -1, 0], [0, 0, -1]] },
    { name: 'flip-y', matrix: [[-1, 0, 0], [0, 1, 0], [0, 0, -1]] },
    { name: 'flip-z', matrix: [[-1, 0, 0], [0, -1, 0], [0, 0, 1]] }
];

function array(matrix) {
    return matrix.toArray ? matrix.toArray() : matrix;
}

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (v) => { const n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; };

// Replace an axial tensor's (physically arbitrary) transverse axes with a
// deterministic gauge derived solely from its unique axis (assumed column 2).
// This removes the reference-gauge freedom from the drawing so that axis-flips
// which only spin the degenerate plane become identical, while unique-axis sign
// flips (which draw differently) are preserved.
function canonicalAxialFrame(frame) {
    const u = [frame[0][2], frame[1][2], frame[2][2]];
    const helper = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const e1 = normalize(cross(helper, u));
    const e2 = cross(u, e1);
    return [
        [e1[0], e2[0], u[0]],
        [e1[1], e2[1], u[1]],
        [e1[2], e2[2], u[2]]
    ];
}

function wrap(angle) {
    return ((angle % (2 * PI)) + 2 * PI) % (2 * PI);
}

function elementaryRotation(alpha, beta, gamma, sequence, active) {
    const rz = angle => [[Math.cos(angle), -Math.sin(angle), 0], [Math.sin(angle), Math.cos(angle), 0], [0, 0, 1]];
    const middle = sequence === 'zyz'
        ? [[Math.cos(beta), 0, Math.sin(beta)], [0, 1, 0], [-Math.sin(beta), 0, Math.cos(beta)]]
        : [[1, 0, 0], [0, Math.cos(beta), -Math.sin(beta)], [0, Math.sin(beta), Math.cos(beta)]];
    const first = mjs.matrix(rz(alpha));
    const last = mjs.matrix(rz(gamma));
    return active
        ? mjs.multiply(mjs.multiply(first, middle), last)
        : mjs.multiply(mjs.multiply(mjs.inv(last), mjs.inv(middle)), mjs.inv(first));
}

function decomposeActive(rotation, sequence, tolerance, singularGauge) {
    const R = array(rotation);
    const sineBeta = Math.hypot(R[0][2], R[1][2]);
    const beta = Math.atan2(sineBeta, Math.max(-1, Math.min(1, R[2][2])));
    const singular = sineBeta <= tolerance;
    let alpha;
    let gamma;

    if (singular) {
        gamma = 0;
        if (R[2][2] >= 0) {
            alpha = Math.atan2(R[1][0], R[0][0]);
        } else if (sequence === 'zyz') {
            alpha = Math.atan2(-R[1][0], -R[0][0]);
        } else {
            alpha = Math.atan2(R[1][0], R[0][0]);
        }
        if (singularGauge === 'alpha-zero') {
            gamma = R[2][2] >= 0 ? alpha : -alpha;
            alpha = 0;
        }
    } else if (sequence === 'zyz') {
        alpha = Math.atan2(R[1][2], R[0][2]);
        gamma = Math.atan2(R[2][1], -R[2][0]);
    } else {
        alpha = Math.atan2(R[0][2], -R[1][2]);
        gamma = Math.atan2(R[2][0], R[2][1]);
    }

    return {
        angles: [wrap(alpha), beta, wrap(gamma)],
        singular: {
            isSingular: singular,
            lineOfNodesDefined: !singular,
            gauge: singular ? singularGauge : null
        }
    };
}

function classify(eigenvalues, tolerance) {
    const [a, b, c] = eigenvalues;
    const ab = Math.abs(a - b) <= tolerance;
    const bc = Math.abs(b - c) <= tolerance;
    return ab && bc ? 'spherical' : (ab || bc ? 'axial' : 'triaxial');
}

function symmetryMetadata(eigenvalues, frame, tolerance) {
    const tensorClass = classify(eigenvalues, tolerance);
    if (tensorClass !== 'axial') return { class: tensorClass };

    const [a, b] = eigenvalues;
    const uniqueAxis = Math.abs(a - b) <= tolerance ? 2 : 0;
    const degenerateAxes = uniqueAxis === 2 ? [0, 1] : [1, 2];
    return {
        class: tensorClass,
        uniqueAxis,
        uniqueAxisVector: frame.map(row => row[uniqueAxis]),
        degenerateAxes
    };
}

/**
 * The physical relative orientation of the symmetric parts of two tensor PAS frames.
 */
class RelativeTensorOrientation {
    constructor(source, target, specification = {}) {
        this.source = source;
        this.target = target;
        this.specification = {
            sourceConvention: specification.sourceConvention ?? source.convention,
            targetConvention: specification.targetConvention ?? target.convention,
            sequence: (specification.sequence ?? specification.eulerSequence ?? 'zyz').toLowerCase(),
            active: specification.active ?? specification.rotationSense !== 'passive',
            tolerance: specification.tolerance ?? 1e-6,
            singularGauge: specification.singularGauge ?? 'gamma-zero',
            tensorPart: 'symmetric'
        };
        if (!['zyz', 'zxz'].includes(this.specification.sequence)) {
            throw new Error('Euler sequence must be "zyz" or "zxz".');
        }
        if (!['gamma-zero', 'alpha-zero'].includes(this.specification.singularGauge)) {
            throw new Error('Singular Euler gauge must be "gamma-zero" or "alpha-zero".');
        }

        this.sourceTolerance = this.specification.tolerance * Math.max(1, mjs.norm(source.symmetric, 2));
        this.targetTolerance = this.specification.tolerance * Math.max(1, mjs.norm(target.symmetric, 2));
        this.rotationTolerance = Math.max(this.sourceTolerance, this.targetTolerance);
        this.tolerance = this.rotationTolerance;
        this.sourceEigenvalues = source.sorted_eigenvalues(this.specification.sourceConvention);
        this.targetEigenvalues = target.sorted_eigenvalues(this.specification.targetConvention);
        this.sourceClass = classify(this.sourceEigenvalues, this.sourceTolerance);
        this.targetClass = classify(this.targetEigenvalues, this.targetTolerance);
        this.sourceFrame = array(source.sorted_eigenvectors(this.specification.sourceConvention));
        this.targetFrame = array(target.sorted_eigenvectors(this.specification.targetConvention));
        this.sourceSymmetry = symmetryMetadata(this.sourceEigenvalues, this.sourceFrame, this.sourceTolerance);
        this.targetSymmetry = symmetryMetadata(this.targetEigenvalues, this.targetFrame, this.targetTolerance);

        // An axial (non-spherical) tensor still has a well-defined relative
        // orientation: its axial symmetry only frees the rotation about its
        // unique axis, which we gauge to zero. That is clean when the unique axis
        // is on the PAS Z (the free angle is then simply the first/last Euler
        // rotation). When the chosen ordering places the unique axis on X there
        // is no simple single-angle gauge, so we fall back to a static display
        // and flag the issue so the UI can recommend a better ordering.
        const sourceAxial = this.sourceClass === 'axial';
        const targetAxial = this.targetClass === 'axial';
        const anySpherical = this.sourceClass === 'spherical' || this.targetClass === 'spherical';
        const sourceOnX = sourceAxial && this.sourceSymmetry.uniqueAxis !== 2;
        const targetOnX = targetAxial && this.targetSymmetry.uniqueAxis !== 2;
        this.gaugeProblematic = !anySpherical && (sourceOnX || targetOnX);
        // Per-side axial info: null, or the symmetry metadata for an axial tensor.
        this.axial = {
            source: sourceAxial ? this.sourceSymmetry : null,
            target: targetAxial ? this.targetSymmetry : null
        };

        this.orientationClass = anySpherical
            ? 'indeterminate'
            : this.gaugeProblematic
                ? 'continuous'
                : 'discrete';
        this.freeRotation = this.orientationClass === 'continuous'
            ? {
                domain: [0, 2 * PI],
                source: sourceAxial ? this.sourceSymmetry : null,
                target: targetAxial ? this.targetSymmetry : null,
                // The unique axis sits on X under the chosen ordering: recommend
                // an ordering that places it on Z for a discrete Euler solution.
                problematic: true,
                onX: { source: sourceOnX, target: targetOnX }
            }
            : null;
        this.configurations = this.orientationClass === 'discrete' ? this._buildConfigurations() : [];
    }
    _buildConfigurations() {
        const sourceFrame = mjs.matrix(this.sourceFrame);
        const targetFrame = mjs.matrix(this.targetFrame);
        const sequence = this.specification.sequence;
        const active = this.specification.active;
        // In the discrete path any axial tensor has its unique axis on Z (the
        // problematic on-X case is routed to 'continuous'). The rotation about
        // that unique axis is then a free gauge: it is the first Euler rotation
        // (alpha, about z of the source) for an axial source, and the last
        // (gamma, about z of the target) for an axial target. Zero it.
        const srcAxial = !!this.axial.source;   // source unique axis == z_A
        const tgtAxial = !!this.axial.target;   // target unique axis == z_B
        const round = a => a.flat().map(x => Math.round(x / 1e-6)).join(',');
        const configurations = [];
        const seen = new Set();
        for (const sourceTransform of FRAME_TRANSFORMS) {
            let source = mjs.multiply(sourceFrame, sourceTransform.matrix);
            if (srcAxial) source = mjs.matrix(canonicalAxialFrame(array(source)));
            for (const targetTransform of FRAME_TRANSFORMS) {
                let target = mjs.multiply(targetFrame, targetTransform.matrix);
                if (tgtAxial) target = mjs.matrix(canonicalAxialFrame(array(target)));

                // Dedupe by the *drawing* (canonicalised frames). For an axial
                // tensor, flips that only spin its degenerate plane now map to the
                // same frame and collapse; unique-axis sign flips draw differently
                // and are kept (ADR-0003). Triaxial frames are all distinct, so all
                // 16 survive (unchanged behaviour).
                const key = round(array(source)) + '|' + round(array(target));
                if (seen.has(key)) continue;
                seen.add(key);

                // Intrinsic relative rotation (target expressed in the source PAS
                // frame): makes beta the angle between the z axes.
                const relativeRotation = mjs.multiply(mjs.transpose(source), target);
                // Active angles decompose this rotation; passive angles describe the
                // same orientation as a frame rotation and are the active-style
                // decomposition of its inverse (transpose). This is why the two
                // conventions give different angle triples for the same geometry.
                const decompInput = active ? relativeRotation : mjs.transpose(relativeRotation);
                const solution = decomposeActive(
                    decompInput, sequence, this.rotationTolerance, this.specification.singularGauge
                );
                let [alpha, beta, gamma] = solution.angles;
                // The free gauge angle for an axial tensor is the rotation about its
                // unique axis: the first Euler angle of whichever tensor is the
                // "reference" and the last of the "object". Decomposing the inverse
                // for the passive case swaps first↔last, so the gauged angle swaps.
                const zeroAlpha = active ? srcAxial : tgtAxial;
                const zeroGamma = active ? tgtAxial : srcAxial;
                if (zeroAlpha) alpha = 0;
                if (zeroGamma) gamma = 0;

                // Rotation the reported angles reconstruct under the chosen sense.
                const rotation = elementaryRotation(alpha, beta, gamma, sequence, active);
                // For a purely discrete (triaxial/triaxial) pair the gauged angles
                // equal the decomposed ones, so verify the reconstruction as before.
                if (!srcAxial && !tgtAxial) {
                    if (mjs.norm(mjs.subtract(rotation, relativeRotation), 'fro') > this.rotationTolerance * 10) {
                        throw new Error('Euler decomposition did not reconstruct the relative rotation.');
                    }
                }
                const activeRotation = mjs.multiply(target, mjs.transpose(source));
                configurations.push({
                    id: `source:${sourceTransform.name}|target:${targetTransform.name}`,
                    source: { transform: sourceTransform.name, frame: array(source) },
                    target: { transform: targetTransform.name, frame: array(target) },
                    activeRotation: array(activeRotation),
                    passiveRotation: array(mjs.transpose(activeRotation)),
                    rotation: array(rotation),
                    euler: [alpha, beta, gamma],
                    singular: solution.singular,
                    // Which Euler angle (if any) is a free gauge fixed to zero, and
                    // which side is axial, so the renderer can flag the gauge.
                    gauge: {
                        zeroed: { alpha: zeroAlpha, gamma: zeroGamma },
                        axialSource: srcAxial,
                        axialTarget: tgtAxial
                    }
                });
            }
        }
        return configurations;
    }

    configuration(id) {
        return this.configurations.find(configuration => configuration.id === id) ?? null;
    }
}

export { FRAME_TRANSFORMS, RelativeTensorOrientation };

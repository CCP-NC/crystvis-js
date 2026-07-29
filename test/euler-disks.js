'use strict';

import * as chai from 'chai';
import * as THREE from 'three';
import { EulerDisks } from '../lib/primitives/euler.js';
import { TensorData } from '../lib/tensor.js';

const expect = chai.expect;

// The full EulerDisks constructor builds TextSprites, which need an async
// bitmap font not loaded in the test environment. We exercise the new
// continuous static-frame path on the prototype with real THREE groups.
function makeBareDisks() {
    const disks = Object.create(EulerDisks.prototype);
    disks.disk1Group = new THREE.Group();
    disks.disk2Group = new THREE.Group();
    disks.axes1 = new THREE.Group();
    disks.axes2 = new THREE.Group();
    disks.alphaArc = new THREE.Group();
    disks.betaArc = new THREE.Group();
    disks.gammaArc = new THREE.Group();
    disks.alphaLabel = new THREE.Object3D();
    disks.betaLabel = new THREE.Object3D();
    disks.gammaLabel = new THREE.Object3D();
    disks.lineOfNodesVis = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 1);
    disks.freeRing1 = new THREE.Object3D();
    disks.freeRing2 = new THREE.Object3D();
    disks.radius = 4.0;
    disks.scalingFactor = 5.0;
    return disks;
}

describe('EulerDisks continuous static frame', function () {
    it('renders a continuous (unique-axis-on-X) orientation statically instead of throwing', function () {
        const triaxial = new TensorData([[10, 1, 2], [1, 20, 1], [2, 1, 30]]);
        const axial = new TensorData([[15, 0, 0], [0, 15, 0], [0, 0, 30]]);
        // Decreasing ordering places the axial unique axis on X ⇒ flagged continuous.
        const orientation = triaxial.relativeOrientationTo(axial, { targetConvention: 'decreasing' });
        expect(orientation.orientationClass).to.equal('continuous');

        const disks = makeBareDisks();
        const equivalents = disks.setOrientation(orientation);

        // No discrete equivalent sets for a continuous orientation.
        expect(equivalents).to.deep.equal([]);
        expect(disks.configurationId).to.equal(null);
        // Angle arcs and line of nodes are undefined here, so hidden.
        [disks.alphaArc, disks.betaArc, disks.gammaArc,
            disks.alphaLabel, disks.betaLabel, disks.gammaLabel,
            disks.lineOfNodesVis].forEach(o => expect(o.visible).to.equal(false));
        // Frames are actually applied (non-identity source frame => rotated group).
        expect(disks.disk1Group.quaternion.length()).to.be.closeTo(1, 1e-9);
        // Reference gauge is made explicit: the axial target (unique axis = x)
        // shows its free-rotation ring, tilted to encircle x.
        expect(disks.freeRing1.visible).to.equal(false);
        expect(disks.freeRing2.visible).to.equal(true);
        expect(disks.freeRing2.rotation.y).to.be.closeTo(Math.PI / 2, 1e-9);
    });

    it('tilts the free-rotation ring when the unique axis is x', function () {
        const triaxial = new TensorData([[10, 1, 2], [1, 20, 1], [2, 1, 30]]);
        // Decreasing ordering puts the distinct eigenvalue first => uniqueAxis = 0
        // (local x), so the ring must be tilted to encircle x.
        const axial = new TensorData([[30, 0, 0], [0, 15, 0], [0, 0, 15]]);
        const orientation = axial.relativeOrientationTo(triaxial, { sourceConvention: 'decreasing' });
        expect(orientation.orientationClass).to.equal('continuous');

        const disks = makeBareDisks();
        disks.setOrientation(orientation);
        // Source is the axial tensor here.
        expect(disks.freeRing1.visible).to.equal(true);
        expect(disks.freeRing1.rotation.y).to.be.closeTo(Math.PI / 2, 1e-9);
        expect(disks.freeRing2.visible).to.equal(false);
    });

    it('renders an axial (unique-Z) orientation discretely: hides the gauged arc, shows the ring', function () {
        const triaxial = new TensorData([[10, 1, 2], [1, 20, 1], [2, 1, 30]]);
        const axial = new TensorData([[15, 0, 0], [0, 15, 0], [0, 0, 30]]);  // Haeberlen ⇒ unique on Z
        const orientation = triaxial.relativeOrientationTo(axial);
        expect(orientation.orientationClass).to.equal('discrete');

        const disks = makeBareDisks();
        const equivalents = disks.setOrientation(orientation);
        expect(equivalents.length).to.equal(8);
        // Active configuration is set (not the static null of the continuous case).
        expect(disks.configurationId).to.not.equal(null);
        // Target is axial: gamma is a gauge, so its arc/label are hidden and the
        // target ring is shown (untilted, unique axis on Z); beta arc is drawn.
        expect(disks.gammaArc.visible).to.equal(false);
        expect(disks.gammaLabel.visible).to.equal(false);
        expect(disks.betaArc.visible).to.equal(true);
        expect(disks.freeRing2.visible).to.equal(true);
        expect(disks.freeRing2.rotation.y).to.equal(0);
        expect(disks.freeRing1.visible).to.equal(false);
    });

    it('still throws for an indeterminate (spherical) orientation', function () {
        const spherical = new TensorData([[5, 0, 0], [0, 5, 0], [0, 0, 5]]);
        const triaxial = new TensorData([[10, 1, 2], [1, 20, 1], [2, 1, 30]]);
        const orientation = triaxial.relativeOrientationTo(spherical);
        expect(orientation.orientationClass).to.equal('indeterminate');

        const disks = makeBareDisks();
        expect(() => disks.setOrientation(orientation)).to.throw(/indeterminate/);
    });
});

describe('Euler arc geometry maps onto the displayed axes', function () {
    const col = (f, i) => new THREE.Vector3(f[0][i], f[1][i], f[2][i]);
    const rot = (v, axis, ang) => v.clone().normalize()
        .applyQuaternion(new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), ang));

    for (const sequence of ['zyz', 'zxz']) {
        it(`beta equals angle(z_A, z_B) and the arcs land on the axes (${sequence})`, function () {
            const A = new TensorData([[10, 1, 2], [1, 20, 1], [2, 1, 30]]);
            const B = new TensorData([[12, 0, 3], [0, 18, 1], [3, 1, 25]]);
            const orientation = A.relativeOrientationTo(B, { sequence, active: true });

            for (const c of orientation.configurations) {
                if (c.singular.isSingular) continue;
                const [alpha, beta, gamma] = c.euler;
                const zA = col(c.source.frame, 2);
                const zB = col(c.target.frame, 2);
                const refA = sequence === 'zxz' ? col(c.source.frame, 0) : col(c.source.frame, 1);
                const refB = sequence === 'zxz' ? col(c.target.frame, 0) : col(c.target.frame, 1);

                // beta is exactly the angle between the two z axes.
                const zAngle = Math.acos(Math.max(-1, Math.min(1, zA.dot(zB))));
                expect(beta).to.be.closeTo(zAngle, 1e-9);

                // Line of nodes built from alpha; the three arcs land on the axes.
                const node = rot(refA, zA, alpha);
                expect(rot(zA, node, beta).distanceTo(zB.clone().normalize())).to.be.lessThan(1e-9);
                expect(rot(node, zB, gamma).distanceTo(refB.clone().normalize())).to.be.lessThan(1e-9);
            }
        });
    }
});

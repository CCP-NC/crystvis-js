'use strict';

import * as chai from 'chai';
import chaiAlmost from 'chai-almost';
import * as mjs from 'mathjs';
import { TensorData } from '../lib/tensor.js';
import { RelativeTensorOrientation } from '../lib/relative-orientation.js';

chai.use(chaiAlmost(1e-8));
const { expect } = chai;

function expectConfigurations(source, target, specification) {
    const orientation = source.relativeOrientationTo(target, specification);
    expect(orientation).to.be.instanceOf(RelativeTensorOrientation);
    expect(orientation.orientationClass).to.equal('discrete');
    expect(orientation.configurations).to.have.length(16);

    for (const configuration of orientation.configurations) {
        const sourceFrame = mjs.matrix(configuration.source.frame);
        const targetFrame = mjs.matrix(configuration.target.frame);
        const activeRotation = mjs.matrix(configuration.activeRotation);
        const rotation = mjs.matrix(configuration.rotation);
        expect(mjs.det(sourceFrame)).to.almost.equal(1);
        expect(mjs.det(targetFrame)).to.almost.equal(1);
        expect(mjs.det(activeRotation)).to.almost.equal(1);
        expect(mjs.multiply(activeRotation, sourceFrame)).to.deep.almost.equal(targetFrame);

        const [alpha, beta, gamma] = configuration.euler;
        const reconstructed = mjs.matrix((awaitlessEulerRotation(alpha, beta, gamma, specification.sequence, specification.active)));
        expect(reconstructed).to.deep.almost.equal(rotation);
    }
    return orientation;
}

function awaitlessEulerRotation(alpha, beta, gamma, sequence, active) {
    const rz = a => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
    const middle = sequence === 'zyz'
        ? [[Math.cos(beta), 0, Math.sin(beta)], [0, 1, 0], [-Math.sin(beta), 0, Math.cos(beta)]]
        : [[1, 0, 0], [0, Math.cos(beta), -Math.sin(beta)], [0, Math.sin(beta), Math.cos(beta)]];
    const first = mjs.matrix(rz(alpha));
    const last = mjs.matrix(rz(gamma));
    return active
        ? mjs.multiply(mjs.multiply(first, middle), last)
        : mjs.multiply(mjs.multiply(mjs.inv(last), mjs.inv(middle)), mjs.inv(first));
}

describe('RelativeTensorOrientation', () => {
    const source = new TensorData([[1, 0, 0], [0, 2, 0], [0, 0, 4]]);
    const target = new TensorData([[2, 1, 0], [1, 3, 1], [0, 1, 5]]);

    for (const sequence of ['zyz', 'zxz']) {
        for (const active of [true, false]) {
            it(`maps all PAS-frame configurations for ${sequence} ${active ? 'active' : 'passive'} rotations`, () => {
                const orientation = expectConfigurations(source, target, { sequence, active });
                expect(orientation.configurations[0].id).to.equal('source:identity|target:identity');
                expect(orientation.configurations[15].id).to.equal('source:flip-z|target:flip-z');
            });
        }
    }

    it('makes beta the angle between the z principal axes (arcs map onto axes)', () => {
        // Randomised, independent cross-check of the intrinsic convention: for
        // every PAS-frame configuration, beta must equal the geometric angle
        // between the source and target z axes, and the reported rotation must be
        // the source-frame intrinsic rotation (sourceᵀ·target, active).
        const rz = a => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
        const ry = b => [[Math.cos(b), 0, Math.sin(b)], [0, 1, 0], [-Math.sin(b), 0, Math.cos(b)]];
        const randRot = () => mjs.multiply(mjs.multiply(
            rz(Math.random() * 2 * Math.PI),
            ry(Math.acos(2 * Math.random() - 1))), rz(Math.random() * 2 * Math.PI));
        const fromFrame = (F, v) => mjs.multiply(mjs.multiply(F, mjs.diag(v)), mjs.transpose(F));
        for (let i = 0; i < 25; i++) {
            const s = new TensorData(fromFrame(randRot(), [1.0, 2.5, 4.3]));
            const t = new TensorData(fromFrame(randRot(), [-1.2, 0.7, 3.9]));
            const orientation = s.relativeOrientationTo(t, { sequence: 'zyz', active: true });
            expect(orientation.orientationClass).to.equal('discrete');
            for (const cfg of orientation.configurations) {
                const sF = mjs.matrix(cfg.source.frame);
                const tF = mjs.matrix(cfg.target.frame);
                // intrinsic convention
                const intrinsic = mjs.multiply(mjs.transpose(sF), tF);
                expect(mjs.matrix(cfg.rotation)).to.deep.almost.equal(intrinsic);
                // beta = angle between z axes (3rd columns)
                const sz = cfg.source.frame.map(r => r[2]);
                const tz = cfg.target.frame.map(r => r[2]);
                const zAngle = Math.acos(Math.max(-1, Math.min(1, mjs.dot(sz, tz))));
                expect(cfg.euler[1]).to.almost.equal(zAngle);
            }
            // a canonical beta<=90 representative always exists
            expect(orientation.configurations.some(c => c.euler[1] <= Math.PI / 2 + 1e-9)).to.equal(true);
        }
    });

    it('gives different angle triples for active vs passive (same beta, both reconstruct)', () => {
        for (const sequence of ['zyz', 'zxz']) {
            const activeSol = source.relativeOrientationTo(target, { sequence, active: true });
            const passiveSol = source.relativeOrientationTo(target, { sequence, active: false });
            for (let i = 0; i < activeSol.configurations.length; i++) {
                const a = activeSol.configurations[i].euler;
                const p = passiveSol.configurations[i].euler;
                if (activeSol.configurations[i].singular.isSingular) continue;
                // Beta (angle between the z axes) is convention-independent.
                expect(p[1]).to.almost.equal(a[1]);
                // Alpha/gamma genuinely change with the convention.
                expect(Math.abs(p[0] - a[0]) + Math.abs(p[2] - a[2])).to.be.greaterThan(1e-3);
                // Passive angles reconstruct the same physical rotation (as inverse).
                const recon = awaitlessEulerRotation(p[0], p[1], p[2], sequence, false);
                const rel = mjs.multiply(mjs.transpose(mjs.matrix(passiveSol.configurations[i].source.frame)),
                    mjs.matrix(passiveSol.configurations[i].target.frame));
                expect(recon).to.deep.almost.equal(rel);
            }
        }
    });

    it('gives an axial (unique-axis-on-Z) tensor a discrete gauged solution', () => {
        // diag(1,1,2): Haeberlen puts the unique axis on Z, so the relative
        // orientation is discrete with the free rotation (gamma, target axial)
        // gauged to zero and deduped to 8 configurations.
        const axial = new TensorData([[1, 0, 0], [0, 1, 0], [0, 0, 2]]);
        const orientation = source.relativeOrientationTo(axial);
        expect(orientation.orientationClass).to.equal('discrete');
        expect(orientation.targetClass).to.equal('axial');
        expect(orientation.configurations).to.have.length(8);
        for (const c of orientation.configurations) {
            expect(c.euler[2]).to.equal(0);            // gamma gauged to zero
            expect(c.gauge.zeroed.gamma).to.equal(true);
            expect(c.gauge.axialTarget).to.equal(true);
        }
    });

    it('routes an axial tensor with its unique axis on X to a flagged continuous case', () => {
        // Decreasing ordering puts the unique axis on X: no simple single-angle
        // gauge, so it falls back to a flagged continuous (static) display.
        const axial = new TensorData([[1, 0, 0], [0, 1, 0], [0, 0, 2]]);
        const orientation = source.relativeOrientationTo(axial, { targetConvention: 'decreasing' });
        expect(orientation.orientationClass).to.equal('continuous');
        expect(orientation.gaugeProblematic).to.equal(true);
        expect(orientation.configurations).to.deep.equal([]);
        expect(orientation.freeRotation.problematic).to.equal(true);
        expect(orientation.freeRotation.onX.target).to.equal(true);
    });

    it('classifies a spherical tensor as indeterminate', () => {
        const spherical = new TensorData([[3, 0, 0], [0, 3, 0], [0, 0, 3]]);
        const indeterminate = source.relativeOrientationTo(spherical);
        expect(indeterminate.orientationClass).to.equal('indeterminate');
        expect(indeterminate.configurations).to.deep.equal([]);
    });

    it('gives two axial tensors a discrete solution with alpha=gamma=0 (4 configs)', () => {
        const axialA = new TensorData([[1, 0, 0], [0, 1, 0], [0, 0, 2]]);
        const axialB = new TensorData([[5, 0, 0], [0, 5, 0], [0, 0, 9]]);
        const orientation = axialA.relativeOrientationTo(axialB);
        expect(orientation.orientationClass).to.equal('discrete');
        expect(orientation.configurations).to.have.length(4);
        for (const c of orientation.configurations) {
            expect(c.euler[0]).to.equal(0);
            expect(c.euler[2]).to.equal(0);
        }
    });

    it('classifies each tensor with its own scale-aware tolerance', () => {
        const smallTriaxial = new TensorData([[1, 0, 0], [0, 1 + 1e-4, 0], [0, 0, 1 + 2e-4]]);
        const hugeTriaxial = new TensorData([[1e12, 0, 0], [0, 2e12, 0], [0, 0, 4e12]]);
        const orientation = smallTriaxial.relativeOrientationTo(hugeTriaxial, { tolerance: 1e-6 });
        expect(orientation.sourceClass).to.equal('triaxial');
        expect(orientation.targetClass).to.equal('triaxial');
        expect(orientation.orientationClass).to.equal('discrete');
        expect(orientation.configurations).to.have.length(16);
    });

    it('marks parallel and anti-parallel PAS axes as singular', () => {
        const identity = new TensorData([[1, 0, 0], [0, 2, 0], [0, 0, 3]]);
        const orientation = identity.relativeOrientationTo(identity);
        expect(orientation.configurations.every(configuration => configuration.singular.isSingular)).to.equal(true);
    });

    it('uses a documented zero-angle gauge for singular Euler solutions', () => {
        const tensor = new TensorData([[1, 0, 0], [0, 2, 0], [0, 0, 3]]);
        for (const sequence of ['zyz', 'zxz']) {
            for (const active of [true, false]) {
                for (const singularGauge of ['gamma-zero', 'alpha-zero']) {
                    const orientation = tensor.relativeOrientationTo(tensor, { sequence, active, singularGauge });
                    for (const configuration of orientation.configurations) {
                        if (!configuration.singular.isSingular) continue;
                        const zeroIndex = singularGauge === 'gamma-zero' ? 2 : 0;
                        expect(configuration.euler[zeroIndex]).to.almost.equal(0);
                        expect(configuration.singular.gauge).to.equal(singularGauge);
                        const reconstructed = awaitlessEulerRotation(
                            ...configuration.euler,
                            sequence,
                            active
                        );
                        expect(reconstructed).to.deep.almost.equal(mjs.matrix(configuration.rotation));
                    }
                }
            }
        }
    });
});
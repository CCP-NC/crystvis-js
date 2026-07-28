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

    it('classifies axial and spherical tensors without inventing discrete configurations', () => {
        const axial = new TensorData([[1, 0, 0], [0, 1, 0], [0, 0, 2]]);
        const spherical = new TensorData([[3, 0, 0], [0, 3, 0], [0, 0, 3]]);
        const continuous = source.relativeOrientationTo(axial);
        const indeterminate = source.relativeOrientationTo(spherical);
        expect(continuous.orientationClass).to.equal('continuous');
        expect(continuous.configurations).to.deep.equal([]);
        expect(continuous.freeRotation).to.not.equal(null);
        expect(indeterminate.orientationClass).to.equal('indeterminate');
        expect(indeterminate.configurations).to.deep.equal([]);
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
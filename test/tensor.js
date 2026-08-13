'use strict';


import * as chai from 'chai';
import chaiAlmost from 'chai-almost'

import * as mjs from 'mathjs'

import {
    TensorData,
    rotateTensor,
    equivalentEuler,
    convertToMatrix
} from '../lib/tensor.js'

import {
    arraysAlmostEqual
} from '../lib/utils.js'

import {
    getIsotopeData
} from '../lib/data.js'
chai.use(chaiAlmost(1e-3));

const expect = chai.expect;


const PI = mjs.pi;


describe('convertToMatrix', () => {
    it('should convert 3x3 array to mathjs matrix', () => {
        const input = [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9]
        ];
        const result = convertToMatrix(input);
        expect(result).to.deep.equal(mjs.matrix(input));
    });

    it('should convert 9-element array to 3x3 mathjs matrix', () => {
        const input = [1, 2, 3, 4, 5, 6, 7, 8, 9];
        const expected = mjs.matrix([
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9]
        ]);
        const result = convertToMatrix(input);
        expect(result).to.deep.equal(expected);
    });

    it('should convert eigenvalues and eigenvectors to mathjs matrix', () => {
        const eigs = [1, 2, 3];
        const evecs = [
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
        ];
        const input = [eigs, evecs];
        const expected = mjs.matrix([
            [1, 0, 0],
            [0, 2, 0],
            [0, 0, 3]
        ]);
        const result = convertToMatrix(input);
        expect(result).to.deep.equal(expected);
    });

    it('should return mathjs matrix if input is already a 3x3 matrix', () => {
        const input = mjs.matrix([
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9]
        ]);
        const result = convertToMatrix(input);
        expect(result).to.deep.equal(input);
    });

    it('should convert object with eigenvalues and eigenvectors to mathjs matrix', () => {
        const input = {
            eigenvalues: [1, 2, 3],
            eigenvectors: [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ]
        };
        const expected = mjs.matrix([
            [1, 0, 0],
            [0, 2, 0],
            [0, 0, 3]
        ]);
        const result = convertToMatrix(input);
        expect(result).to.deep.equal(expected);
    });

    it('should throw error for invalid array length', () => {
        const input = [1, 2, 3, 4];
        expect(() => convertToMatrix(input)).to.throw('Array must be 3x3 or 9-element or [eigenvalues, eigenvectors]');
    });

    it('should throw error for invalid input type', () => {
        const input = 'invalid';
        expect(() => convertToMatrix(input)).to.throw('Invalid input type');
    });
});

describe('#tensordata', function() {

    it('should properly separate the symmetric part of a tensor', function() {
        var td = new TensorData([
            [0, 2, 1],
            [0, 0, 1],
            [1, 1, 0]
        ]);

        expect(td.symmetric).to.deep.equal([
            [0, 1, 1],
            [1, 0, 1],
            [1, 1, 0]
        ]);

        expect(td.asymmetric).to.deep.equal([
            [0, 1, 0],
            [-1, 0, 0],
            [0, 0, 0]
        ]);
    });

    it('should compute and order eigenvalues properly', function() {

        var td = new TensorData([
            [1, 2, 3],
            [2, 3, 4],
            [3, 4, 5]
        ]);

        expect(td.eigenvalues).to.deep.almost.equal([-6.234754e-01, 0,
            9.623475e+00
        ]);

        // Reconstruct the matrix
        var ev = td.eigenvectors;
        var D = mjs.diag(td.eigenvalues);
        var evT = mjs.transpose(ev);
        expect(mjs.multiply(ev, mjs.multiply(D, evT))).to.deep.almost.equal(td.symmetric);
    });

    it('should change bases properly', function() {

        var td0 = new TensorData([
            [15, 2, 2],
            [ 2, 3, 6],
            [ 2, 6, 9]
        ]);

        var td1 = td0.rotate(td0.eigenvectors);
        expect(td1.symmetric).to.deep.almost.equal(mjs.diag(td0.eigenvalues));

        // And vice versa...
        var td2 = td1.rotate(td0.eigenvectors, true);
        expect(td2.symmetric).to.deep.almost.equal(td0.symmetric);
    });

    // rotateByAngle
    it('should rotate a tensor by an angle properly', function() {
            
            var td = new TensorData([
                [1,0.25,0.1],
                [0.5,2,0],
                [0.5,0,3]
            ]);
    
            var td_rotated = td.rotateByAngleAxis(PI / 2, "z");
            expect(td_rotated._M._data).to.deep.almost.equal([
                [-0.25, 1, 0.1],
                [-2, 0.5, 0],
                [0, 0.5, 3]
            ]);
    
    });


    it('should order eigenvalues properly following the Haeberlen convention', function() {

        var td = new TensorData([
            [1,0,0],
            [0,2,0],
            [0,0,-6]
        ]);

        // Haeberlen order:
        // e_x = 2 
        // e_y = 1
        // e_z = -6

        expect(td.isotropy).to.equal(-1);
        expect(td.haeberlen_eigenvalues).to.deep.equal([2, 1, -6]);
        expect(td.anisotropy).to.equal(-7.5);
        expect(td.reduced_anisotropy).to.equal(-5);
        expect(td.asymmetry).to.equal(0.2);
        expect(td.span).to.equal(8);
        expect(td.skew).to.almost.equal(0.75);

        expect(td.haeberlen_eigenvectors).to.deep.equal([
            [0, 1, 0],
            [1, 0, 0],
            [0, 0, -1],
        ]);

    });

    it ('should order eigenvalues properly following the NQR convention', function() {

        var td = new TensorData([
            [-6,0,0],
            [0,2,0],
            [0,0,1]
        ]);

        // NQR order:
        expect(td.nqr_eigenvalues).to.deep.equal([1, 2, -6]);
        expect(td.nqr_eigenvectors).to.deep.equal([
            [0, 0, -1],
            [0, 1, 0],
            [1, 0, 0],
        ]);

        
    });

    it ('should order eigenvalues properly following various conventions', function() {
        var td = new TensorData([
            [1,0,0],
            [0,2,0],
            [0,0,-6]
        ]);

        // Haeberlen order:
        expect(td.sorted_eigenvalues("haeberlen")).to.deep.equal([2, 1, -6]);
        // NQR order:
        expect(td.sorted_eigenvalues("nqr")).to.deep.equal([1, 2, -6]);
        // Increasing order:
        expect(td.sorted_eigenvalues("increasing")).to.deep.equal([-6, 1, 2]);
        // Decreasing order:
        expect(td.sorted_eigenvalues("decreasing")).to.deep.equal([2, 1, -6]);

    });

    it ('should order eigenvectors properly following various conventions', function() {
        var td = new TensorData([
            [1,0,0],
            [0,2,0],
            [0,0,-6]
        ]);

        // Haeberlen order:
        expect(td.sorted_eigenvectors("haeberlen")).to.deep.equal(td._haeb_evecs);
        expect(td.sorted_eigenvectors("haeberlen")).to.deep.equal([
            [0, 1, 0],
            [1, 0, 0],
            [0, 0, -1],
        ]);
        // NQR order:
        const nqrEv = td.sorted_eigenvectors("nqr");
        const nqrD = mjs.diag(td.sorted_eigenvalues("nqr"));
        expect(mjs.matrix(mjs.multiply(nqrEv, mjs.multiply(nqrD, mjs.transpose(nqrEv))))).to.deep.almost.equal(mjs.matrix(td.symmetric));
        // Increasing order:
        // this should be the default order so it should be the same as the
        // result of get eigenvectors
        expect(td.sorted_eigenvectors("increasing")).to.deep.equal(td.eigenvectors);
        // explicitly, we should get:
        expect(td.sorted_eigenvectors("increasing")).to.deep.equal([
            [0, 1, 0],
            [0, 0, 1],
            [1, 0, 0],
        ]);
        // Decreasing order:
        expect(td.sorted_eigenvectors("decreasing")).to.deep.equal([
            [0, 1, 0],
            [1, 0, 0],
            [0, 0, -1],
        ]);

        // Test for symmetric case:
        var td2 = new TensorData([
            [1,0,0],
            [0,1,0],
            [0,0,1]
        ]);
        for (const conv of ["increasing", "decreasing", "haeberlen", "nqr"]) {
            const evConv = td2.sorted_eigenvectors(conv);
            const dConv = mjs.diag(td2.sorted_eigenvalues(conv));
            expect(mjs.matrix(mjs.multiply(evConv, mjs.multiply(dConv, mjs.transpose(evConv))))).to.deep.almost.equal(mjs.matrix(td2.symmetric));
        }
        

        // [1, 0, 0]
        // [0, 1, 0]
        // [0, 0, 2]
        // has evals [1, 1, 2]
        // and evecs
        // [0, 0, 1]
        // [0, 1, 0]
        // [1, 0, 0]
        var td3 = new TensorData([
            [1,0,0],
            [0,1,0],
            [0,0,2]
        ]);
        for (const conv of ["increasing", "decreasing", "haeberlen", "nqr"]) {
            const ev3 = td3.sorted_eigenvectors(conv);
            const d3 = mjs.diag(td3.sorted_eigenvalues(conv));
            expect(mjs.matrix(mjs.multiply(ev3, mjs.multiply(d3, mjs.transpose(ev3))))).to.deep.almost.equal(mjs.matrix(td3.symmetric));
        }

        // Check if setting the convention works
        td3.convention = "haeberlen";
        expect(td3.eigenvectors).to.deep.equal(td3.sorted_eigenvectors("haeberlen"));
        td3.convention = "increasing";
        expect(td3.eigenvectors).to.deep.equal(td3.sorted_eigenvectors("increasing"));
        td3.convention = "decreasing";
        expect(td3.eigenvectors).to.deep.equal(td3.sorted_eigenvectors("decreasing"));
        td3.convention = "nqr";
        expect(td3.eigenvectors).to.deep.equal(td3.sorted_eigenvectors("nqr"));



    });

    it ('should convert properly an EFG tensor to Hz', function() {

        var efg = new TensorData([
            [ 1.05124449e-01,  1.42197546e-01,  1.53489044e+00],
            [ 1.42197546e-01,  2.40599479e-02, -9.03880151e-01],
            [ 1.53489044e+00, -9.03880151e-01, -1.29184397e-01]
        ]);

        // Convert to Hz
        var Q = getIsotopeData('O', 17).Q;
        efg = efg.efgAtomicToHz(Q);

        // Comparison in kHz
        expect(efg.haeberlen_eigenvalues[2]/1e3).to.almost.equal(11233.854188);
    });

    it ('should convert properly an ISC tensor to Hz', function() {

        var isc = new TensorData([
            [1.8373758951855776, -0.6444912603875048, 0.03379154211567881], 
            [-0.6738855911039692, 0.72064084469826, -0.4004091413405982], 
            [0.014472208799926917, -0.3990514190555465, 0.3282668712885049]
        ]);

        // Convert to Hz
        var g1 = getIsotopeData('C', 13).gamma;
        var g2 = getIsotopeData('H', 1).gamma;
        isc = isc.iscAtomicToHz(g1, g2);

        // Comparison in kHz
        expect(isc.haeberlen_eigenvalues[2]).to.almost.equal(6.53565087);
    });

    it ('should properly calculate general Euler angles', function() {
        
        var A = new TensorData([
            [1,0,0],
            [0,2,0],
            [0,0,-6]
        ]);
        A.convention = "increasing";
        let euler_convention = 'zyz';
        let active = true;
        expect(A.eigenvalues).to.deep.equal([-6, 1, 2]);
        const aEulerInc = A.euler(euler_convention, active);
        expect(A.equivalentEuler(euler_convention, active)).to.satisfy(sets =>
            sets.some(s => arraysAlmostEqual(s, aEulerInc))
        ); 
        A.convention = "decreasing";
        expect(A.eigenvalues).to.deep.equal([2, 1, -6]);
        expect(A.equivalentEuler(euler_convention, active)).to.satisfy(sets => sets.some(s => arraysAlmostEqual(s, A.euler(euler_convention, active))));
        A.convention = "haeberlen";
        expect(A.eigenvalues).to.deep.equal([2, 1, -6]);
        expect(A.equivalentEuler(euler_convention, active)).to.satisfy(sets => sets.some(s => arraysAlmostEqual(s, A.euler(euler_convention, active))));
        A.convention = "nqr";
        expect(A.eigenvalues).to.deep.equal([1, 2, -6]);
        expect(A.equivalentEuler(euler_convention, active)).to.satisfy(sets => sets.some(s => arraysAlmostEqual(s, A.euler(euler_convention, active))));



        const data = [
            [1.00, 0.12, 0.13],
            [0.21, 2.00, 0.23],
            [0.31, 0.32, -6.00]
        ];
        
        let B = new TensorData(data);

        // Eigenvalue ordering (make sure we're testing the right thing)
        let eigs_ref = [-6.01598555, 0.97774119, 2.03824436];
        expect(B.eigenvalues).to.deep.almost.equal(eigs_ref.slice(0, 3));
        
        
        // --- Euler ZYZ (active) convention --- #
        euler_convention = 'zyz';
        active = true;
        let ref_euler_c =  [ 80.51125264,  87.80920208, 178.59212804].map((x) => x*PI/180);
        let ref_euler_d =  [227.77364892,   2.60398404,  32.71068295].map((x) => x*PI/180);
        let ref_euler_h =  [227.77364892,   2.60398404,  32.71068295].map((x) => x*PI/180);
        let ref_euler_n =  [227.77364892,   2.60398404, 122.71068295].map((x) => x*PI/180);
        const assertInEquiv = (tensor, mode, active, conv, ref) => {
            const equiv = tensor.equivalentEuler(mode, active, conv);
            expect(equiv.some(s => arraysAlmostEqual(s, ref, 1e-3))).to.equal(true, `expected equivalent sets for ${conv} to contain ${ref}`);
        };

        // check when setting the convention for the tensor overall
        B.convention = "increasing";
        expect(B.euler(euler_convention, active)).to.deep.almost.equal(ref_euler_c);
        B.convention = "decreasing";
        assertInEquiv(B, euler_convention, active, "decreasing", ref_euler_d);
        B.convention = "haeberlen";
        assertInEquiv(B, euler_convention, active, "haeberlen", ref_euler_h);
        B.convention = "nqr";
        assertInEquiv(B, euler_convention, active, "nqr", ref_euler_n);

        // Check that it works when setting the convention for the euler angles in the function call
        expect(B.euler(euler_convention, active, 'increasing')).to.deep.almost.equal(ref_euler_c);
        assertInEquiv(B, euler_convention, active, 'decreasing', ref_euler_d);
        assertInEquiv(B, euler_convention, active, 'haeberlen', ref_euler_h);
        assertInEquiv(B, euler_convention, active, 'nqr', ref_euler_n);
        
        // --- Euler ZYZ (passive) convention --- #
        euler_convention = 'zyz';
        active = false;
        ref_euler_c =  [  1.40787196,  87.80920208,  99.48874736].map((x) => x*PI/180);
        ref_euler_d =  [147.28931705,   2.60398404, 312.22635108].map((x) => x*PI/180);
        ref_euler_h =  [147.28931705,   2.60398404, 312.22635108].map((x) => x*PI/180);
        ref_euler_n =  [ 57.28931705,   2.60398404, 312.22635108].map((x) => x*PI/180);
        expect(B.euler(euler_convention, active, 'increasing')).to.deep.almost.equal(ref_euler_c);
        assertInEquiv(B, euler_convention, active, 'decreasing', ref_euler_d);
        assertInEquiv(B, euler_convention, active, 'haeberlen', ref_euler_h);
        assertInEquiv(B, euler_convention, active, 'nqr', ref_euler_n);


        // --- Euler ZXZ (active) convention --- #
        euler_convention = 'zxz';
        active = true;
        ref_euler_c =  [170.51125264,  87.80920208,  88.59212804].map((x) => x*PI/180);
        ref_euler_d =  [317.77364892,   2.60398404, 122.71068295].map((x) => x*PI/180);
        ref_euler_h =  [317.77364892,   2.60398404, 122.71068295].map((x) => x*PI/180);
        ref_euler_n =  [317.77364892,   2.60398404,  32.71068295].map((x) => x*PI/180);
        expect(B.euler(euler_convention, active, 'increasing')).to.deep.almost.equal(ref_euler_c);
        assertInEquiv(B, euler_convention, active, 'decreasing', ref_euler_d);
        assertInEquiv(B, euler_convention, active, 'haeberlen', ref_euler_h);
        assertInEquiv(B, euler_convention, active, 'nqr', ref_euler_n);
        
        // ZXZ Passive:
        euler_convention = 'zxz';
        active = false;
        ref_euler_c = [ 91.40787196,  87.80920208,   9.48874736].map((x) => x*PI/180);
        ref_euler_d = [ 57.28931705,   2.60398404, 222.22635108].map((x) => x*PI/180);
        ref_euler_h = [ 57.28931705,   2.60398404, 222.22635108].map((x) => x*PI/180);
        ref_euler_n = [147.28931705,   2.60398404, 222.22635108].map((x) => x*PI/180);
        expect(B.euler(euler_convention, active, 'increasing')).to.deep.almost.equal(ref_euler_c);
        assertInEquiv(B, euler_convention, active, 'decreasing', ref_euler_d);
        assertInEquiv(B, euler_convention, active, 'haeberlen', ref_euler_h);
        assertInEquiv(B, euler_convention, active, 'nqr', ref_euler_n);




    });


    it ('should properly calculate equivalent Euler angles', function() {
        const ref_euler_c = [
            [3*PI/2, PI/2,   0],
            [3*PI/2, PI/2, PI],
            [  PI/2, PI/2, PI],
            [  PI/2, PI/2,   0],
        ];
        const ref_euler_d = [
            [PI/2, 0, 0],
            [PI/2, 0, PI],
            [3*PI/2, PI, PI],
            [3*PI/2, PI, 0],
        ];
        const ref_euler_h = ref_euler_d;
        const ref_euler_n = [
            [0, 0, 0],
            [0, 0, PI],
            [PI, PI, PI],
            [PI, PI, 0],
        ];
        let A = new TensorData([
            [1,0,0],
            [0,2,0],
            [0,0,-6]
        ]);
        let euler_convention = 'zyz';
        let active = true;
        
        const assertSetsMatch = (got, ref) => {
            expect(got.length).to.equal(ref.length);
            for (const r of ref) {
                expect(got.some(g => arraysAlmostEqual(g, r, 1e-3))).to.equal(true, `expected set to contain ${r}`);
            }
        };

        const assertSetsReconstruct = (tensor, mode, active, convention) => {
            const sets = tensor.equivalentEuler(mode, active, convention);
            expect(sets).to.have.length(4);
            const PAS = mjs.diag(tensor.sorted_eigenvalues(convention));
            for (const [alpha, beta, gamma] of sets) {
                const M = rotateTensor(alpha, beta, gamma, PAS, mode, active).toArray();
                expect(M).to.deep.almost.equal(tensor.symmetric);
            }
        };

        assertSetsMatch(A.equivalentEuler(euler_convention, active, 'increasing'), ref_euler_c);
        assertSetsReconstruct(A, euler_convention, active, 'decreasing');
        assertSetsReconstruct(A, euler_convention, active, 'haeberlen');
        assertSetsReconstruct(A, euler_convention, active, 'nqr');

        // TODO add tests for zxz convention
    });


    it ('should properly calculate Euler angles for edge cases', function() {
        // TODO
        // Spherical tensors
        // ms H 1 100 0 0 0 100 0 0 0 100
        let A = new TensorData([
            [1,0,0],
            [0,1,0],
            [0,0,1]
        ]);
        // eigenvalues: 1, 1, 1
        expect(A.eigenvalues).to.deep.equal([1, 1, 1]);
        // should be zeros for all conventions combinations
        for (let conv of ['zyz', 'zxz']) {
            for (let active of [true, false]) {
                for (let order of ['increasing', 'decreasing', 'haeberlen', 'nqr']) {
                    expect(A.euler(conv, active, order)).to.deep.almost.equal([0, 0, 0]);
                }
            }
        }
        
        // Now a case with no degenerate eigenvalues
        // but with Gimbal lock
        let B = new TensorData([
            [1,0.5,0],
            [0.5,1,0],
            [0,0,2]
        ]);
        expect(B.eigenvalues).to.deep.equal([0.50, 1.50, 2.00]);
        // TODO: this case needs to be investigated once a suitable reference is found
        // console log {zyz, zxz} and {active, passive} for increasing
        // console.log("ZYZa", A.euler('zyz', true, 'increasing').map((x) => x*180/PI));
        // console.log("ZYZp", A.euler('zyz', false, 'increasing').map((x) => x*180/PI));
        // console.log("ZXZa", A.euler('zxz', true, 'increasing').map((x) => x*180/PI));
        // console.log("ZXZp", A.euler('zxz', false, 'increasing').map((x) => x*180/PI));

        // expect(B.euler('zyz', true, 'increasing')).to.deep.almost.equal([135, 0, 0].map((x) => x*PI/180));
        // expect(B.euler('zyz', false)).to.deep.almost.equal([0, 0, 225].map((x) => x*PI/180));
        // expect(B.euler('zxz', true)).to.deep.almost.equal([135, 0, 0].map((x) => x*PI/180));
        // expect(B.euler('zxz', false)).to.deep.almost.equal([0, 0, 225].map((x) => x*PI/180));
    

        // TODO! add more. Fix the ones that are failing.

        let D = new TensorData([
            [5, 0 ,0],
            [0, 10, 0],
            [0, 0, 5]
        ]);
        expect(D.equivalentEuler('zyz', true, 'increasing')).to.satisfy(sets => sets.some(s => arraysAlmostEqual(s, D.euler('zyz', true, 'increasing'))));
        let E = new TensorData([
            [10, 0 ,0],
            [0, 5, 0],
            [0, 0, 5]
        ]);
        expect(E.equivalentEuler('zyz', true, 'increasing')).to.satisfy(sets => sets.some(s => arraysAlmostEqual(s, E.euler('zyz', true, 'increasing'))));



    });

    it ('should construct labelled relative PAS-frame rotations', function() {
        let A = new TensorData([
            [1, 0, 0],
            [0, 2, 0],
            [0, 0, 4]
        ]);

        const Bdata = [
            [1.00, 0.12, 0.13],
            [0.21, 2.00, 0.23],
            [0.31, 0.32, -6.00]
        ];
        
        let B = new TensorData(Bdata);

        for (const sequence of ['zyz', 'zxz']) {
            for (const active of [true, false]) {
                const orientation = A.relativeOrientationTo(B, { sequence, active });
                expect(orientation.orientationClass).to.equal('discrete');
                expect(orientation.configurations).to.have.length(16);
                expect(new Set(orientation.configurations.map(({ id }) => id)).size).to.equal(16);
                for (const configuration of orientation.configurations) {
                    const source = mjs.matrix(configuration.source.frame);
                    const target = mjs.matrix(configuration.target.frame);
                    const activeRotation = mjs.matrix(configuration.activeRotation);
                    const passiveRotation = mjs.matrix(configuration.passiveRotation);
                    expect(mjs.det(source)).to.almost.equal(1);
                    expect(mjs.det(target)).to.almost.equal(1);
                    expect(mjs.det(activeRotation)).to.almost.equal(1);
                    expect(mjs.multiply(activeRotation, source)).to.deep.almost.equal(target);
                    expect(passiveRotation).to.deep.almost.equal(mjs.transpose(activeRotation));
                    expect(configuration.singular.isSingular).to.equal(false);
                    expect(configuration.euler.every(Number.isFinite)).to.equal(true);
                    expect(configuration.euler[1]).to.be.within(0, PI);
                }
            }
        }
    });

    it('should report spherical relative orientations as indeterminate', () => {

        let A = new TensorData([
            [1,0,0],
            [0,1,0],
            [0,0,1]
        ]);
        let B = new TensorData([
            [2,0,0],
            [0,2,0],
            [0,0,2]
        ]);

        const orientation = A.relativeOrientationTo(B);
        expect(orientation.orientationClass).to.equal('indeterminate');
        expect(orientation.configurations).to.deep.equal([]);
        expect(orientation.freeRotation).to.equal(null);
        expect(orientation.configuration('source:identity|target:identity')).to.equal(null);
    });

    it('should reconstruct all relative rotations for the TensorView triaxial example', () => {
        // # ALA case from the TensorView for MATLAB examples dir
        // Note the ordering of the equivalent Euler angle sets is 
        // not the same as in TensorView for MATLAB,
        // But the sets themselves are the same

        // Probably the MS tensor
        let A = new TensorData([
            [ -5.9766,   -60.302,   -10.8928],
            [-65.5206,   -23.0881,  -25.2372],
            [ -9.5073,   -28.2399,   56.2779],
        ]);
        // probably the EFG tensor
        let B = new TensorData([
            [-0.7806, 0.7215, 0.2987],
            [ 0.7215, 1.3736, 0.9829],
            [ 0.2987, 0.9829, -0.5929]
        ]);

        // Reconstruct the intrinsic relative rotation (z-y-z / z-x-z) from the
        // reported Euler angles, and check the physical invariants.
        const rz = a => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
        function eulerRotation(alpha, beta, gamma, sequence, active) {
            const middle = sequence === 'zyz'
                ? [[Math.cos(beta), 0, Math.sin(beta)], [0, 1, 0], [-Math.sin(beta), 0, Math.cos(beta)]]
                : [[1, 0, 0], [0, Math.cos(beta), -Math.sin(beta)], [0, Math.sin(beta), Math.cos(beta)]];
            const first = mjs.matrix(rz(alpha));
            const last = mjs.matrix(rz(gamma));
            return active
                ? mjs.multiply(mjs.multiply(first, middle), last)
                : mjs.multiply(mjs.multiply(mjs.inv(last), mjs.inv(middle)), mjs.inv(first));
        }

        for (const sequence of ['zyz', 'zxz']) {
            for (const active of [true, false]) {
                const orientation = A.relativeOrientationTo(B, { sequence, active });
                expect(orientation.configurations).to.have.length(16);
                for (const configuration of orientation.configurations) {
                    // Euler angles reconstruct the (intrinsic) relative rotation.
                    const reconstructed = eulerRotation(...configuration.euler, sequence, active);
                    expect(reconstructed).to.deep.almost.equal(mjs.matrix(configuration.rotation));
                    // The lab-frame active rotation maps the source frame onto the target.
                    expect(mjs.multiply(mjs.matrix(configuration.activeRotation), mjs.matrix(configuration.source.frame)))
                        .to.deep.almost.equal(mjs.matrix(configuration.target.frame));
                }
            }
        }



    });


    it('should give axial tensor pairs (unique axis on Z) a discrete gauged solution', () => {

        // First an example from the MagresView2 tests 
        // (Both are axially symmetric tensors - tricky case!)
        // The first is *almost* a spherical tensor, but not quite
        // 
        let A = new TensorData([
            [0.93869474, 0.33129348, -0.09537721],
            [0.33771007, -0.93925902, 0.06119153],
            [-0.06931155, -0.08965002, -0.99355865]
        ]);
        // 
        let B = new TensorData([
            [-0.52412461, 0.49126909, -0.69566377],
            [-0.56320663, 0.41277966, 0.71582906],
            [0.63882054, 0.76698607, 0.06033803]
        ]);
    
        // First make sure the eigenvalues are correct:
        const refAEigenvalues = [-0.99706147, -0.99706146, 1.0];
        const refBEigenvalues = [-0.52550346, -0.52550346, 1.0];
        expect(A.eigenvalues).to.deep.almost.equal(refAEigenvalues);
        expect(B.eigenvalues).to.deep.almost.equal(refBEigenvalues);

        // Now let's check the individual Euler angles
        const aEulerDeg = A.euler("zyz", true, null, true);
        const aEquivDeg = A.equivalentEuler("zyz", true, null, true);
        expect(aEquivDeg.some(e => Math.abs(e[0] - aEulerDeg[0]) < 1e-2 && Math.abs(e[1] - aEulerDeg[1]) < 1e-2)).to.equal(true);
        expect(B.euler("zyz", true, null, true)).to.deep.almost.equal([ 92.1953, 51.7056, 0.0])


        const orientation = A.relativeOrientationTo(B, { tolerance: 1e-4 });
        expect(orientation.sourceClass).to.equal('axial');
        expect(orientation.targetClass).to.equal('axial');
        // Both unique axes on Z ⇒ discrete, alpha=gamma=0, deduped to 4 configs.
        expect(orientation.orientationClass).to.equal('discrete');
        expect(orientation.configurations).to.have.length(4);
        for (const c of orientation.configurations) {
            expect(c.euler[0]).to.equal(0);
            expect(c.euler[2]).to.equal(0);
            expect(c.gauge.axialSource).to.equal(true);
            expect(c.gauge.axialTarget).to.equal(true);
        }
    });

    it('should give mixed-symmetry (one axial, unique on Z) pairs a discrete gauged solution', () => {
        let A = new TensorData([
            [1.0, 0.0, 0.0],
            [0.0, 2.0, 0.0],
            [0.0, 0.0, 1.0]
        ]);
        let B = new TensorData([
            [1.00, 0.12,  0.13],
            [0.21, 2.00,  0.23],
            [0.31, 0.32, -6.00]
        ]);
        // A is axial with its unique axis on Z (eigenvalues 1,1,2 → Haeberlen z).
        const forward = B.relativeOrientationTo(A, { tolerance: 1e-4 });  // target axial
        const reverse = A.relativeOrientationTo(B, { tolerance: 1e-4 });  // source axial
        expect(forward.orientationClass).to.equal('discrete');
        expect(reverse.orientationClass).to.equal('discrete');
        expect(forward.configurations).to.have.length(8);
        expect(reverse.configurations).to.have.length(8);
        for (const c of forward.configurations) expect(c.euler[2]).to.equal(0);  // gamma gauged
        for (const c of reverse.configurations) expect(c.euler[0]).to.equal(0);  // alpha gauged
    });




    it('should mark parallel and anti-parallel triaxial PAS frames as singular', () => {
        const tensor = new TensorData([[1, 0, 0], [0, 2, 0], [0, 0, 3]]);
        for (const sequence of ['zyz', 'zxz']) {
            for (const active of [true, false]) {
                const orientation = tensor.relativeOrientationTo(tensor, { sequence, active });
                expect(orientation.configurations).to.have.length(16);
                for (const configuration of orientation.configurations) {
                    expect(configuration.singular.isSingular).to.equal(true);
                    expect(configuration.singular.lineOfNodesDefined).to.equal(false);
                    expect(configuration.singular.gauge).to.equal('gamma-zero');
                    expect(configuration.euler[2]).to.almost.equal(0);
                    const zAlignment = configuration.rotation[2][2];
                    expect(configuration.euler[1]).to.almost.equal(zAlignment > 0 ? 0 : PI);
                }
            }
        }
    });

    it('should construct TensorData from an existing TensorData object (copy constructor)', () => {
        const orig = new TensorData([
            [1.2, 0.3, 0.4],
            [0.3, 2.5, 0.1],
            [0.4, 0.1, -5.0]
        ]);
        const copy = new TensorData(orig);
        expect(copy.data).to.deep.almost.equal(orig.data);
        expect(copy.eigenvalues).to.deep.almost.equal(orig.eigenvalues);
        expect(copy.eigenvectors).to.deep.almost.equal(orig.eigenvectors);
    });

    it('should guarantee right-handed eigenvector matrices (det == 1) for all conventions', () => {
        const td = new TensorData([
            [10.5,  2.1, -1.4],
            [ 2.1, -4.2,  0.8],
            [-1.4,  0.8,  8.7]
        ]);
        for (const convention of ['increasing', 'decreasing', 'haeberlen', 'nqr']) {
            td.convention = convention;
            const ev = td.eigenvectors;
            const det = mjs.det(mjs.matrix(ev));
            expect(det).to.almost.equal(1.0);
        }
    });

    it('should reconstruct symmetric matrix from eigenvalues and eigenvectors across all conventions', () => {
        const td = new TensorData([
            [12.1,  3.2, -0.5],
            [ 3.2,  1.4,  2.8],
            [-0.5,  2.8, -8.3]
        ]);
        for (const convention of ['increasing', 'decreasing', 'haeberlen', 'nqr']) {
            const evals = td.sorted_eigenvalues(convention);
            const evecs = td.sorted_eigenvectors(convention);
            const V = mjs.matrix(evecs);
            const D = mjs.diag(evals);
            const VT = mjs.transpose(V);
            const reconstructed = mjs.multiply(mjs.multiply(V, D), VT).toArray();
            expect(reconstructed).to.deep.almost.equal(td.symmetric);
        }
    });

    it('should calculate consistent scalar reductions (iso, aniso, red_aniso, asym, span, skew)', () => {
        const td = new TensorData([
            [ 1.0, 0.2, 0.3],
            [ 0.2, 2.0, 0.4],
            [ 0.3, 0.4,-6.0]
        ]);
        const evalsInc = td.sorted_eigenvalues('increasing');
        const evalsHaeb = td.sorted_eigenvalues('haeberlen');
        
        const expectedIso = (evalsInc[0] + evalsInc[1] + evalsInc[2]) / 3.0;
        const expectedSpan = evalsInc[2] - evalsInc[0];
        const expectedSkew = 3.0 * (evalsInc[1] - expectedIso) / expectedSpan;
        
        const expectedAniso = evalsHaeb[2] - (evalsHaeb[0] + evalsHaeb[1]) / 2.0;
        const expectedRedAniso = evalsHaeb[2] - expectedIso;
        const expectedAsym = (evalsHaeb[1] - evalsHaeb[0]) / expectedRedAniso;

        expect(td.isotropy).to.almost.equal(expectedIso);
        expect(td.span).to.almost.equal(expectedSpan);
        expect(td.skew).to.almost.equal(expectedSkew);
        expect(td.anisotropy).to.almost.equal(expectedAniso);
        expect(td.reduced_anisotropy).to.almost.equal(expectedRedAniso);
        expect(td.asymmetry).to.almost.equal(expectedAsym);
    });

});


describe('rotateTensor', () => {
    // TODO add more tests of this
    it('throws an error for unsupported modes', () => {
        expect(() => rotateTensor(0, 0, 0, mjs.matrix(), 'unsupported', true)).throw('Only zyz and zxz modes are implemented so far');
    });

    it('returns the correct for zero rotation', () => {
        const PAS = mjs.matrix([
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1]
        ]);
        const result = rotateTensor(0, 0, 0, PAS, 'zyz', true);
        expect(result).to.deep.almost.equal(PAS);
    });
});

describe('equivalentEuler', () => {

    it('should return the correct number of equivalent angles', () => {
        const eulerAngles = [PI / 2, PI / 3, PI / 4];
        const result = equivalentEuler(eulerAngles, true);
        expect(result.length).to.equal(4);
    });

    it('should return correct equivalent angles for zyz convention and active rotation', () => {
        const eulerAngles = [3*PI/2, PI/2, 0];
        const ref_euler_c = [
            [3*PI/2, PI/2,   0],
            [3*PI/2, PI/2, PI],
            [  PI/2, PI/2, PI],
            [  PI/2, PI/2,   0],
        ];
        const result = equivalentEuler(eulerAngles, true);
        expect(result).to.deep.almost.equal(ref_euler_c);

    });

    it('should return correct equivalent angles for zxz convention and active rotation', () => {
        const eulerAngles = [0, PI/2, PI/2];
        const ref_euler_c = [
            [0, PI/2, PI/2],
            [0, PI/2, 3*PI/2],
            [PI, PI/2, PI/2],
            [PI, PI/2, 3*PI/2],
        ];
        const result = equivalentEuler(eulerAngles, true);
        expect(result).to.deep.almost.equal(ref_euler_c);

    });

    it('should return correct equivalent angles for zyz convention and passive rotation', () => {
        const eulerAngles = [0, PI/2, 3*PI/2];
        const ref_euler_c = [
            [0, PI/2, 3*PI/2],
            [PI, PI/2, 3*PI/2],
            [PI, PI/2, PI/2],
            [0, PI/2, PI/2],
        ];
        const result = equivalentEuler(eulerAngles, false);
        expect(result).to.deep.almost.equal(ref_euler_c);

    });

    it('should return correct equivalent angles for zxz convention and passive rotation', () => {
        const eulerAngles = [PI/2, PI/2, PI];
        const ref_euler_c = [
            [PI/2, PI/2, PI],
            [3*PI/2, PI/2, PI],
            [PI/2, PI/2, 0],
            [3*PI/2, PI/2, 0],
        ];
        const result = equivalentEuler(eulerAngles, false);
        expect(result).to.deep.almost.equal(ref_euler_c);

    });
   
    it('should handle spherical tensors', () => {
        const eulerAngles = [0, 0, 0];
        // zyz, active
        let ref_euler_c = [
            [0, 0, 0],
            [0, 0, PI],
            [PI, PI, PI],
            [PI, PI, 0],
        ];
        let result = equivalentEuler(eulerAngles, true);
        expect(result).to.deep.almost.equal(ref_euler_c);
        // zyz, passive
        ref_euler_c = [
            [0, 0, 0],
            [PI, 0, 0],
            [PI, PI, PI],
            [0, PI, PI],
        ];
        result = equivalentEuler(eulerAngles, false);
        expect(result).to.deep.almost.equal(ref_euler_c);

        // zxz, active
        ref_euler_c = [
            [0, 0, 0],
            [0, 0, PI],
            [PI, PI, PI],
            [PI, PI, 0],
        ];
        result = equivalentEuler(eulerAngles, true);
        expect(result).to.deep.almost.equal(ref_euler_c);

        // zxz, passive
        ref_euler_c = [
            [0, 0, 0],
            [PI, 0, 0],
            [PI, PI, PI],
            [0, PI, PI],
        ];
        result = equivalentEuler(eulerAngles, false);
        expect(result).to.deep.almost.equal(ref_euler_c);

    });
    

});
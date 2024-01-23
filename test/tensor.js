'use strict';


import * as chai from 'chai';
import chaiAlmost from 'chai-almost'

import * as mjs from 'mathjs'

import {
    TensorData,
    rotateTensor,
    equivalentEuler
} from '../lib/tensor.js'

import {
    getIsotopeData
} from '../lib/data.js'

chai.use(chaiAlmost(1e-3));

const expect = chai.expect;

const PI = mjs.pi;

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
        expect(td.sorted_eigenvectors("nqr")).to.deep.equal([
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
        ]);
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

        // TODO add tests for symmetric cases such as:
        // [1, 0, 0]
        // [0, 1, 0]
        // [0, 0, 1]
        var td2 = new TensorData([
            [1,0,0],
            [0,1,0],
            [0,0,1]
        ]);
        expect(td2.sorted_eigenvectors("increasing")).to.deep.equal(td2.eigenvectors);
        expect(td2.sorted_eigenvectors("decreasing")).to.deep.equal(td2.eigenvectors);
        expect(td2.sorted_eigenvectors("haeberlen")).to.deep.equal(td2.eigenvectors);
        

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
        expect(td3.sorted_eigenvectors("increasing")).to.deep.equal(td3.eigenvectors);
        // TODO: double-check haeberlen and decreasing orders
        // (They agree with soprano dev as of 2024/01/22)
        expect(td3.sorted_eigenvectors("decreasing")).to.deep.equal([
            [0, 0, -1],
            [0, 1, 0],
            [1, 0, 0],
        ]);
        expect(td3.sorted_eigenvectors("haeberlen")).to.deep.equal([
            [0, 1, 0],
            [1, 0, 0],
            [0, 0, -1],
        ]);
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

    it ('should convert properly calculate general Euler angles', function() {
        
        var A = new TensorData([
            [1,0,0],
            [0,2,0],
            [0,0,-6]
        ]);
        A.convention = "increasing";
        let euler_convention = 'zyz';
        let active = true;
        expect(A.eigenvalues).to.deep.equal([-6, 1, 2]);
        expect(A.euler(euler_convention, active)).to.deep.almost.equal([270.0, 90.0, 0.0].map((x) => x*PI/180)); 
        A.convention = "decreasing";
        expect(A.eigenvalues).to.deep.equal([2, 1, -6]);
        expect(A.euler(euler_convention, active)).to.deep.almost.equal([90.0, 0.0, 0.0].map((x) => x*PI/180));
        A.convention = "haeberlen";
        expect(A.eigenvalues).to.deep.equal([2, 1, -6]);
        expect(A.euler(euler_convention, active)).to.deep.almost.equal([90.0, 0.0, 0.0].map((x) => x*PI/180));
        A.convention = "nqr";
        expect(A.eigenvalues).to.deep.equal([1, 2, -6]);
        expect(A.euler(euler_convention, active)).to.deep.almost.equal([0.0, 0.0, 0.0].map((x) => x*PI/180));



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
        // check when setting the convention for the tensor overall
        B.convention = "increasing";
        // active
        expect(B.euler(euler_convention, active)).to.deep.almost.equal(ref_euler_c);
        B.convention = "decreasing";
        expect(B.euler(euler_convention, active)).to.deep.almost.equal(ref_euler_d);
        B.convention = "haeberlen"; // gives the same result as decreasing for this case
        expect(B.euler(euler_convention, active)).to.deep.almost.equal(ref_euler_h);
        B.convention = "nqr";
        expect(B.euler(euler_convention, active)).to.deep.almost.equal(ref_euler_n);

        // Check that it works when setting the convention for the euler angles in the function call
        expect(B.euler(euler_convention, active, 'increasing')).to.deep.almost.equal(ref_euler_c);
        expect(B.euler(euler_convention, active, 'decreasing')).to.deep.almost.equal(ref_euler_d);
        expect(B.euler(euler_convention, active, 'haeberlen')).to.deep.almost.equal(ref_euler_h);
        expect(B.euler(euler_convention, active, 'nqr')).to.deep.almost.equal(ref_euler_n);
        
        // --- Euler ZYZ (passive) convention --- #
        // TODO the passive tests are all failing. Correct beta and gamma, but wrong alpha...
        euler_convention = 'zyz';
        active = false;
        ref_euler_c =  [  1.40787196,  87.80920208,  99.48874736].map((x) => x*PI/180);
        ref_euler_d =  [147.28931705,   2.60398404, 312.22635108].map((x) => x*PI/180);
        ref_euler_h =  [147.28931705,   2.60398404, 312.22635108].map((x) => x*PI/180);
        ref_euler_n =  [ 57.28931705,   2.60398404, 312.22635108].map((x) => x*PI/180);
        expect(B.euler(euler_convention, active, 'increasing')).to.deep.almost.equal(ref_euler_c);
        expect(B.euler(euler_convention, active, 'decreasing')).to.deep.almost.equal(ref_euler_d);
        expect(B.euler(euler_convention, active, 'haeberlen')).to.deep.almost.equal(ref_euler_h);
        expect(B.euler(euler_convention, active, 'nqr')).to.deep.almost.equal(ref_euler_n);


        // --- Euler ZXZ (active) convention --- #
        euler_convention = 'zxz';
        active = true;
        ref_euler_c =  [170.51125264,  87.80920208,  88.59212804].map((x) => x*PI/180);
        ref_euler_d =  [317.77364892,   2.60398404, 122.71068295].map((x) => x*PI/180);
        ref_euler_h =  [317.77364892,   2.60398404, 122.71068295].map((x) => x*PI/180);
        ref_euler_n =  [317.77364892,   2.60398404,  32.71068295].map((x) => x*PI/180);
        expect(B.euler(euler_convention, active, 'increasing')).to.deep.almost.equal(ref_euler_c);
        expect(B.euler(euler_convention, active, 'decreasing')).to.deep.almost.equal(ref_euler_d);
        expect(B.euler(euler_convention, active, 'haeberlen')).to.deep.almost.equal(ref_euler_h);
        expect(B.euler(euler_convention, active, 'nqr')).to.deep.almost.equal(ref_euler_n);
        
        // ZXZ Passive:
        // Passive zyz and zxz currently fail! Why?
        euler_convention = 'zxz';
        active = false;
        ref_euler_c = [ 91.40787196,  87.80920208,   9.48874736].map((x) => x*PI/180);
        ref_euler_d = [ 57.28931705,   2.60398404, 222.22635108].map((x) => x*PI/180);
        ref_euler_h = [ 57.28931705,   2.60398404, 222.22635108].map((x) => x*PI/180);
        ref_euler_n = [147.28931705,   2.60398404, 222.22635108].map((x) => x*PI/180);
        expect(B.euler(euler_convention, active, 'increasing')).to.deep.almost.equal(ref_euler_c);
        expect(B.euler(euler_convention, active, 'decreasing')).to.deep.almost.equal(ref_euler_d);
        expect(B.euler(euler_convention, active, 'haeberlen')).to.deep.almost.equal(ref_euler_h);
        expect(B.euler(euler_convention, active, 'nqr')).to.deep.almost.equal(ref_euler_n);




    });


    it ('should convert properly calculate equivalent Euler angles', function() {
        const ref_euler_c = [
            [3*PI/2, PI/2,   0],
            [3*PI/2, PI/2, PI],
            [  PI/2, PI/2, PI],
            [  PI/2, PI/2,   0],
        ];
        let A = new TensorData([
            [1,0,0],
            [0,2,0],
            [0,0,-6]
        ]);
        let euler_convention = 'zyz';
        let active = true;
        expect(A.equivalentEuler(euler_convention, active, 'increasing')).to.deep.almost.equal(ref_euler_c);

        // TODO add tests for zxz convention
    });


    it ('should convert properly calculate Euler angles for edge cases', function() {
        // TODO
    });

    // ms H 1 100 0 0 0 100 0 0 0 100
    let A = new TensorData([
        [1,0,0],
        [0,1,0],
        [0,0,1]
    ]);

    // ms H 2 100 50 0 50 100 0 0 0 200
    let B = new TensorData([
        [100,50,0],
        [50,100,0],
        [0,0,200]
    ]);
    // eigenvalues: 50, 150, 200
    expect(B.eigenvalues).to.deep.equal([50, 150, 200]);
    console.log(B.equivalentEuler('zyz', true))
    // expect(B.euler('zyz', true)).to.deep.almost.equal([135, 0, 0].map((x) => x*PI/180));
    // expect(B.euler('zyz', false)).to.deep.almost.equal([0, 0, 225].map((x) => x*PI/180));
    // expect(B.euler('zxz', true)).to.deep.almost.equal([135, 0, 0].map((x) => x*PI/180));
    // expect(B.euler('zxz', false)).to.deep.almost.equal([0, 0, 225].map((x) => x*PI/180));

    // efg H 1 0  0  2. 1.41421356 1.41421356 0   1.41421356 -1.41421356  0  
    let C = new TensorData([
        [0, 0, 2],
        [mjs.sqrt(2), mjs.sqrt(2), 0],
        [mjs.sqrt(2), -mjs.sqrt(2), 0]
    ]);

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
        const result = equivalentEuler(eulerAngles, 'zyz', true);
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
        const result = equivalentEuler(eulerAngles, 'zyz', true);
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
        const result = equivalentEuler(eulerAngles, 'zxz', true);
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
        const result = equivalentEuler(eulerAngles, 'zyz', false);
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
        const result = equivalentEuler(eulerAngles, 'zxz', false);
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
        let result = equivalentEuler(eulerAngles, 'zyz', true);
        expect(result).to.deep.almost.equal(ref_euler_c);
        // zyz, passive
        ref_euler_c = [
            [0, 0, 0],
            [PI, 0, 0],
            [PI, PI, PI],
            [0, PI, PI],
        ];
        result = equivalentEuler(eulerAngles, 'zyz', false);
        expect(result).to.deep.almost.equal(ref_euler_c);

        // zxz, active
        ref_euler_c = [
            [0, 0, 0],
            [0, 0, PI],
            [PI, PI, PI],
            [PI, PI, 0],
        ];
        result = equivalentEuler(eulerAngles, 'zxz', true);
        expect(result).to.deep.almost.equal(ref_euler_c);

        // zxz, passive
        ref_euler_c = [
            [0, 0, 0],
            [PI, 0, 0],
            [PI, PI, PI],
            [0, PI, PI],
        ];
        result = equivalentEuler(eulerAngles, 'zxz', false);
        expect(result).to.deep.almost.equal(ref_euler_c);

    });
    

});
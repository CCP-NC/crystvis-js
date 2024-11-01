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
import { deepAlmostEqualUnordered } from '../lib/utils.js';

chai.use(chaiAlmost(1e-3));

const expect = chai.expect;
const assert = chai.assert;


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

        // Test for symmetric case:
        var td2 = new TensorData([
            [1,0,0],
            [0,1,0],
            [0,0,1]
        ]);
        expect(td2.sorted_eigenvectors("increasing")).to.deep.equal(td2.eigenvectors);
        expect(td2.sorted_eigenvectors("decreasing")).to.deep.equal(td2.eigenvectors);
        expect(td2.sorted_eigenvectors("haeberlen")).to.deep.equal(td2.eigenvectors);
        expect(td2.sorted_eigenvectors("nqr")).to.deep.equal(td2.eigenvectors);
        

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
        // same as increasing in this case
        expect(td3.sorted_eigenvectors("nqr")).to.deep.equal([
            [1, 0, 0],
            [0, 1, 0],
            [0, 0, 1],
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
        // TODO: soprano gives [270, 90, 0] as one of the equivalent euler angles for this case,
        // but the first in the list is [90, 90, 0]...
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
        expect(A.equivalentEuler(euler_convention, active, 'increasing')).to.deep.almost.equal(ref_euler_c);
        expect(A.equivalentEuler(euler_convention, active, 'decreasing')).to.deep.almost.equal(ref_euler_d);
        expect(A.equivalentEuler(euler_convention, active, 'haeberlen')).to.deep.almost.equal(ref_euler_h);
        expect(A.equivalentEuler(euler_convention, active, 'nqr')).to.deep.almost.equal(ref_euler_n);

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
    

        // efg H 1 0  0  2. 1.41421356 1.41421356 0   1.41421356 -1.41421356  0  
        let C = new TensorData([
            [0, 0, 2],
            [mjs.sqrt(2), mjs.sqrt(2), 0],
            [mjs.sqrt(2), -mjs.sqrt(2), 0]
        ]);
        // TODO! add more. Fix the ones that are failing.

        let D = new TensorData([
            [5, 0 ,0],
            [0, 10, 0],
            [0, 0, 5]
        ]);
        expect(D.euler('zyz', true, 'increasing')).to.deep.almost.equal([90,90, 0].map((x) => x*PI/180));
        let E = new TensorData([
            [10, 0 ,0],
            [0, 5, 0],
            [0, 0, 5]
        ]);
        expect(E.euler('zyz', true, 'increasing')).to.deep.almost.equal([180,90, 0].map((x) => x*PI/180));



    });

    it ('should properly calculate relative rotation matrices', function() {
        let A = new TensorData([
            [0, 0, 2],
            [mjs.sqrt(2), mjs.sqrt(2), 0],
            [mjs.sqrt(2), -mjs.sqrt(2), 0]
        ]);

        const Bdata = [
            [1.00, 0.12, 0.13],
            [0.21, 2.00, 0.23],
            [0.31, 0.32, -6.00]
        ];
        
        let B = new TensorData(Bdata);

        let I = [
            [1,0,0],
            [0,1,0],
            [0,0,1]
        ]
        let Itensor = new TensorData(I);
        // basic tests:
        // Self rotation -> identity
        let R = A.rotationTo(A);
        expect(R).to.deep.almost.equal(I);
        // Rotation to itself -> identity
        expect(Itensor.rotationTo(Itensor)).to.deep.almost.equal(I);
        // // Rotation from identity to another tensor -> that tensor
        expect(Itensor.rotationTo(A)).to.deep.almost.equal(mjs.transpose(A.eigenvectors));
        expect(Itensor.rotationTo(B)).to.deep.almost.equal(mjs.transpose(B.eigenvectors));
        
        // actual tests:
        R = A.rotationTo(B);
        // make sure it's a rotation matrix
        // make sure determinant is 1
        expect(mjs.det(R)).to.almost.equal(1);
        // make sure it's orthogonal
        expect(mjs.multiply(R, mjs.transpose(R))).to.deep.almost.equal(I);

        // make sure it rotates A into B
        expect(mjs.multiply(R, mjs.transpose(A.eigenvectors))).to.deep.almost.equal(mjs.transpose(B.eigenvectors));
        // survives re-ordering of eigenvalues
        A.convention = "decreasing";
        B.convention = "nqr";
        R = A.rotationTo(B);
        expect(mjs.multiply(R, mjs.transpose(A.eigenvectors))).to.deep.almost.equal(mjs.transpose(B.eigenvectors));
        
    });

    // spherical tensor
    it('should calculate relative Euler angles correctly for spherical tensors', () => {

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

        const equivalent_eulers = A.equivalentEulerTo(B, "zyz", true, 1e-12, true)
        const ref_eulers = [
            [  0.0,   0.0,   0.0],
            [180.0, 180.0,   0.0],
            [180.0, 180.0, 180.0],
            [  0.0,   0.0, 180.0],
            [  0.0, 180.0, 180.0],
            [180.0,   0.0, 180.0],
            [180.0,   0.0,   0.0],
            [  0.0, 180.0,   0.0],
            [180.0, 180.0, 180.0],
            [  0.0,   0.0, 180.0],
            [  0.0,   0.0,   0.0],
            [180.0, 180.0,   0.0],
            [180.0,   0.0,   0.0],
            [  0.0, 180.0,   0.0],
            [  0.0, 180.0, 180.0],
            [180.0,   0.0, 180.0]
        ];
        expect(equivalent_eulers).to.deep.almost.equal(ref_eulers);


    });

    it('calculates relative Euler angles correctly for general case', () => {
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

        let equivalent_eulers = A.equivalentEulerTo(B, "zyz", true, 1e-12, true)
        let ref_eulers = [
            [155.10491563,  89.95022697,  24.80660839],
            [335.10491563,  90.04977303, 335.19339161],
            [335.10491563,  90.04977303, 155.19339161],
            [155.10491563,  89.95022697, 204.80660839],
            [204.89508437,  90.04977303, 204.80660839],
            [ 24.89508437,  89.95022697, 155.19339161],
            [ 24.89508437,  89.95022697, 335.19339161],
            [204.89508437,  90.04977303,  24.80660839],
            [ 24.89508437,  90.04977303, 204.80660839],
            [204.89508437,  89.95022697, 155.19339161],
            [204.89508437,  89.95022697, 335.19339161],
            [ 24.89508437,  90.04977303,  24.80660839],
            [335.10491563,  89.95022697,  24.80660839],
            [155.10491563,  90.04977303, 335.19339161],
            [155.10491563,  90.04977303, 155.19339161],
            [335.10491563,  89.95022697, 204.80660839],
        ];
        expect(equivalent_eulers).to.deep.almost.equal(ref_eulers);

        // ZYZ passive
        equivalent_eulers = A.equivalentEulerTo(B, "zyz", false, 1e-12, true)
        ref_eulers = [
            [ 155.19339161,  89.95022697,  24.89508437],
            [ 204.80660839,  90.04977303, 204.89508437],
            [  24.80660839,  90.04977303, 204.89508437],
            [ 335.19339161,  89.95022697,  24.89508437],
            [ 335.19339161,  90.04977303, 335.10491563],
            [  24.80660839,  89.95022697, 155.10491563],
            [ 204.80660839,  89.95022697, 155.10491563],
            [ 155.19339161,  90.04977303, 335.10491563],
            [ 335.19339161,  90.04977303, 155.10491563],
            [  24.80660839,  89.95022697, 335.10491563],
            [ 204.80660839,  89.95022697, 335.10491563],
            [ 155.19339161,  90.04977303, 155.10491563],
            [ 155.19339161,  89.95022697, 204.89508437],
            [ 204.80660839,  90.04977303,  24.89508437],
            [  24.80660839,  90.04977303,  24.89508437],
            [ 335.19339161,  89.95022697, 204.89508437]
        ];
        expect(equivalent_eulers).to.deep.almost.equal(ref_eulers);

        // ZXZ active
        equivalent_eulers = A.equivalentEulerTo(B, "zxz", true, 1e-12, true)
        ref_eulers = [
            [245.10491563,  89.95022697, 114.80660839],
            [ 65.10491563,  90.04977303, 245.19339161],
            [ 65.10491563,  90.04977303,  65.19339161],
            [245.10491563,  89.95022697, 294.80660839],
            [114.89508437,  90.04977303, 294.80660839],
            [294.89508437,  89.95022697,  65.19339161],
            [294.89508437,  89.95022697, 245.19339161],
            [114.89508437,  90.04977303, 114.80660839],
            [294.89508437,  90.04977303, 294.80660839],
            [114.89508437,  89.95022697,  65.19339161],
            [114.89508437,  89.95022697, 245.19339161],
            [294.89508437,  90.04977303, 114.80660839],
            [ 65.10491563,  89.95022697, 114.80660839],
            [245.10491563,  90.04977303, 245.19339161],
            [245.10491563,  90.04977303,  65.19339161],
            [ 65.10491563,  89.95022697, 294.80660839],
        ];
        expect(equivalent_eulers).to.deep.almost.equal(ref_eulers);

        // ZXZ passive
        equivalent_eulers = A.equivalentEulerTo(B, "zxz", false, 1e-12, true)
        ref_eulers = [
            [ 65.19339161,  89.95022697, 294.89508437],
            [294.80660839,  90.04977303, 114.89508437],
            [114.80660839,  90.04977303, 114.89508437],
            [245.19339161,  89.95022697, 294.89508437],
            [245.19339161,  90.04977303,  65.10491563],
            [114.80660839,  89.95022697, 245.10491563],
            [294.80660839,  89.95022697, 245.10491563],
            [ 65.19339161,  90.04977303,  65.10491563],
            [245.19339161,  90.04977303, 245.10491563],
            [114.80660839,  89.95022697,  65.10491563],
            [294.80660839,  89.95022697,  65.10491563],
            [ 65.19339161,  90.04977303, 245.10491563],
            [ 65.19339161,  89.95022697, 114.89508437],
            [294.80660839,  90.04977303, 294.89508437],
            [114.80660839,  90.04977303, 294.89508437],
            [245.19339161,  89.95022697, 114.89508437],
        ];
        expect(equivalent_eulers).to.deep.almost.equal(ref_eulers);
        // I manually re-ordered the reference angle sets, but we could 
        // also use the deepAlmostEqualUnordered function
        // assert.isTrue(deepAlmostEqualUnordered(equivalent_eulers, ref_eulers, 1e-3), 'Arrays are deeply almost equal');



    });


    it('calculates relative Euler angles correctly for axial symmetry cases', () => {

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
        expect(A.euler("zyz", true, null, true)).to.deep.almost.equal([ 189.8040, 87.5997, 0.0])
        expect(B.euler("zyz", true, null, true)).to.deep.almost.equal([ 92.1953, 51.7056, 0.0])


        let eulers = A.equivalentEulerTo(B, "zyz", true, 1e-4, true)
        let ref_euler = [
            [  0.0000,  85.5337,   0.0000], // 1
            [180.0000,  94.4663,   0.0000], // 2
            [180.0000,  94.4663, 180.0000], // 3
            [  0.0000,  85.5337, 180.0000], // 4
            [  0.0000,  94.4663, 180.0000], // 5
            [180.0000,  85.5337, 180.0000], // 6
            [180.0000,  85.5337,   0.0000], // 7
            [  0.0000,  94.4663,   0.0000], // 8
            [180.0000,  94.4663, 180.0000], // 9
            [  0.0000,  85.5337, 180.0000], // 10
            [  0.0000,  85.5337,   0.0000], // 11
            [180.0000,  94.4663,   0.0000], // 12
            [180.0000,  85.5337,   0.0000], // 13
            [  0.0000,  94.4663,   0.0000], // 14
            [  0.0000,  94.4663, 180.0000], // 15
            [180.0000,  85.5337, 180.0000], // 16
        ];
        expect(eulers).to.deep.almost.equal(ref_euler);

        // ZXZ

        // Now let's check the individual Euler angles
        expect(A.euler("zxz", true, null, true)).to.deep.almost.equal([ 279.8040, 87.5997, 0.0])
        expect(B.euler("zxz", true, null, true)).to.deep.almost.equal([ 182.1953, 51.7056, 0.0])


        eulers = A.equivalentEulerTo(B, "zxz", true, 1e-4, true)
        ref_euler = [
            [ 90.0000000,  85.53372296,   0.0000000], // 1
            [270.0000000,  94.46627704,   0.0000000], // 2
            [270.0000000,  94.46627704, 180.0000000], // 3
            [ 90.0000000,  85.53372296, 180.0000000], // 4
            [270.0000000,  94.46627704, 180.0000000], // 5
            [ 90.0000000,  85.53372296, 180.0000000], // 6
            [ 90.0000000,  85.53372296,   0.0000000], // 7
            [270.0000000,  94.46627704,   0.0000000], // 8
            [ 90.0000000,  94.46627704, 180.0000000], // 9
            [270.0000000,  85.53372296, 180.0000000], // 10
            [270.0000000,  85.53372296,   0.0000000], // 11
            [ 90.0000000,  94.46627704,   0.0000000], // 12
            [270.0000000,  85.53372296,   0.0000000], // 13
            [ 90.0000000,  94.46627704,   0.0000000], // 14
            [ 90.0000000,  94.46627704, 180.0000000], // 15
            [270.0000000,  85.53372296, 180.0000000] // 16
        ];
        expect(eulers).to.deep.almost.equal(ref_euler);

    });

    // # Now let's test the case where the first tensor is axially symmetry 
    // # and the second has no symmetry
    it('calculates relative Euler angles correctly for mixed symmetry cases', () => {
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
        let euler1 = A.euler("zyz", true, null, true);
        let euler2 = B.euler("zyz", true, null, true);
        expect(euler1).to.deep.almost.equal([90.0, 90.0, 0.0]);
        expect(euler2).to.deep.almost.equal([80.51125,  87.80920, 178.59213]);

        // ----------------------------------------------
        // Non-axially symmetric -> axially symmetric
        // (B->A (A is axially symmetric, B is not))
        let eulers = B.equivalentEulerTo(A, "zyz", true, 1e-4, true)
        let ref_zyza = [
            [  0.000000,     9.73611618,  78.52514082],
            [180.000000,   170.26388382, 281.47485918],
            [180.000000,   170.26388382, 101.47485918],
            [  0.000000,     9.73611618, 258.52514082],
            [  0.000000,   170.26388382, 258.52514082],
            [180.000000,     9.73611618, 101.47485918],
            [180.000000,     9.73611618, 281.47485918],
            [  0.000000,   170.26388382,  78.52514082],
            [180.000000,   170.26388382, 258.52514082],
            [  0.000000,     9.73611618, 101.47485918],
            [  0.000000,     9.73611618, 281.47485918],
            [180.000000,   170.26388382,  78.52514082],
            [180.000000,     9.73611618,  78.52514082],
            [  0.000000,   170.26388382, 281.47485918],
            [  0.000000,   170.26388382, 101.47485918],
            [180.000000,     9.73611618, 258.52514082],
        ];
        assert.isTrue(deepAlmostEqualUnordered(eulers, ref_zyza, 1e-3), 'Arrays are deeply almost equal');

        // ZYZ passive
        eulers = B.equivalentEulerTo(A, "zyz", false, 1e-4, true)
        let ref_zyzp = [
            [ 78.52514082,   9.73611618,   0.00000000 ],
            [281.47485918, 170.26388382, 180.00000000 ],
            [101.47485918, 170.26388382, 180.00000000 ],
            [258.52514082,   9.73611618,   0.00000000 ],
            [258.52514082, 170.26388382,   0.00000000 ],
            [101.47485918,   9.73611618, 180.00000000 ],
            [281.47485918,   9.73611618, 180.00000000 ],
            [ 78.52514082, 170.26388382,   0.00000000 ],
            [258.52514082, 170.26388382, 180.00000000 ],
            [101.47485918,   9.73611618,   0.00000000 ],
            [281.47485918,   9.73611618,   0.00000000 ],
            [ 78.52514082, 170.26388382, 180.00000000 ],
            [ 78.52514082,   9.73611618, 180.00000000 ],
            [281.47485918, 170.26388382,   0.00000000 ],
            [101.47485918, 170.26388382,   0.00000000 ],
            [258.52514082,   9.73611618, 180.00000000 ],
        ];
        assert.isTrue(deepAlmostEqualUnordered(eulers, ref_zyzp, 1e-3), 'Arrays are deeply almost equal');

        // ZXZ active
        eulers = B.equivalentEulerTo(A, "zxz", true, 1e-4, true)
        let ref_zxza = [
            [  0.000000,     9.73611618, 348.52514082],
            [180.000000,   170.26388382,  11.47485918],
            [180.000000,   170.26388382, 191.47485918],
            [  0.000000,     9.73611618, 168.52514082],
            [  0.000000,   170.26388382, 168.52514082],
            [180.000000,     9.73611618, 191.47485918],
            [180.000000,     9.73611618,  11.47485918],
            [  0.000000,   170.26388382, 348.52514082],
            [180.000000,   170.26388382, 168.52514082],
            [  0.000000,     9.73611618, 191.47485918],
            [  0.000000,     9.73611618,  11.47485918],
            [180.000000,   170.26388382, 348.52514082],
            [180.000000,     9.73611618, 348.52514082],
            [  0.000000,   170.26388382,  11.47485918],
            [  0.000000,   170.26388382, 191.47485918],
            [180.000000,     9.73611618 ,168.52514082]
        ];
        assert.isTrue(deepAlmostEqualUnordered(eulers, ref_zxza, 1e-3), 'Arrays are deeply almost equal');

        // ZXZ passive
        eulers = B.equivalentEulerTo(A, "zxz", false, 1e-4, true)
        let ref_zxzp = [
            [348.52514082,   9.73611618,   0.00000000 ],
            [ 11.47485918, 170.26388382, 180.00000000 ],
            [191.47485918, 170.26388382, 180.00000000 ],
            [168.52514082,   9.73611618,   0.00000000 ],
            [168.52514082, 170.26388382,   0.00000000 ],
            [191.47485918,   9.73611618, 180.00000000 ],
            [ 11.47485918,   9.73611618, 180.00000000 ],
            [348.52514082, 170.26388382,   0.00000000 ],
            [168.52514082, 170.26388382, 180.00000000 ],
            [191.47485918,   9.73611618,   0.00000000 ],
            [ 11.47485918,   9.73611618,   0.00000000 ],
            [348.52514082, 170.26388382, 180.00000000 ],
            [348.52514082,   9.73611618, 180.00000000 ],
            [ 11.47485918, 170.26388382,   0.00000000 ],
            [191.47485918, 170.26388382,   0.00000000 ],
            [168.52514082,   9.73611618, 180.00000000 ],
        ];
        assert.isTrue(deepAlmostEqualUnordered(eulers, ref_zxzp, 1e-3), 'Arrays are deeply almost equal');



        // ----------------------------------------------
        // Axially symmetric -> non-axially symmetric

        // ZYZ active
        // active zyz from A to B should give the same results as passive B to A, ignoring order 
        eulers = A.equivalentEulerTo(B, "zyz", true, 1e-4, true)
        assert.isTrue(deepAlmostEqualUnordered(eulers, ref_zyzp, 1e-3), 'Arrays are deeply almost equal');

        // ZYZ passive
        // active zyz from A to B should give the same results as active B to A, ignoring order of 
        eulers = A.equivalentEulerTo(B, "zyz", false, 1e-4, true)
        assert.isTrue(deepAlmostEqualUnordered(eulers, ref_zyza, 1e-3), 'Arrays are deeply almost equal');

        // ZXZ active
        // active zxz from A to B should give the same results as passive B to A, ignoring order
        eulers = A.equivalentEulerTo(B, "zxz", true, 1e-4, true)
        assert.isTrue(deepAlmostEqualUnordered(eulers, ref_zxzp, 1e-3), 'Arrays are deeply almost equal');

        // ZXZ passive
        // passive zxz from A to B should give the same results as active B to A, ignoring order
        eulers = A.equivalentEulerTo(B, "zxz", false, 1e-4, true)
        assert.isTrue(deepAlmostEqualUnordered(eulers, ref_zxza, 1e-3), 'Arrays are deeply almost equal');


    });




    it('calculates relative Euler angles correctly for gimbal lock case', () => {

        const c30 = mjs.sqrt(3)/ 2.0;
        const c45 = mjs.sqrt(2) / 2.0;
        const c60 = 0.5;
        // 
        let A = new TensorData([
            [c30,  c60, 0.0],
            [-c60, c30, 0.0],
            [ 0.0, 0.0, 1.0]
        ]);
        // 
        let B = new TensorData([
            [c45,  c45, 0.0],
            [-c45, c45, 0.0],
            [ 0.0, 0.0, 1.0]
        ]);

        const eulers1 = A.eulerTo(B, "zyz", true, 1e-12)
        const eulers2 = A.eulerTo(B, "zxz", true, 1e-12,)
        const eulers3 = A.eulerTo(B, "zyz", false, 1e-12)
        const eulers4 = A.eulerTo(B, "zxz", false, 1e-12)
        const ref_euler = [0.0, 0.0, 0.0];
        expect(eulers1).to.deep.almost.equal(ref_euler);
        expect(eulers2).to.deep.almost.equal(ref_euler);
        expect(eulers3).to.deep.almost.equal(ref_euler);
        expect(eulers4).to.deep.almost.equal(ref_euler);
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
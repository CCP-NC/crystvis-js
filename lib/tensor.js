'use strict';

/**
 * @fileoverview TensorData class to store tensors like NMR data and such.
 * @module
 */

import _ from 'lodash';
import * as mjs from 'mathjs';
import { WasmNMRTensor } from 'nmrtensor-wasm';
import { arraysAlmostEqual, rotate_matrix } from './utils.js';
import { RelativeTensorOrientation } from './relative-orientation.js';

const efg2hz = 234964.77815245767;
const isc2hz = 1.6784031762379067e-16;    // hbar/(2*pi)*1e19
const PI = mjs.pi

function createRz(angle) {
    return mjs.matrix([
        [mjs.cos(angle), -mjs.sin(angle), 0],
        [mjs.sin(angle), mjs.cos(angle), 0],
        [0, 0, 1]
    ]);
}

function createRy(angle) {
    return mjs.matrix([
        [mjs.cos(angle), 0, mjs.sin(angle)],
        [0, 1, 0],
        [-mjs.sin(angle), 0, mjs.cos(angle)]
    ]);
}

function createRx(angle) {
    return mjs.matrix([
        [1, 0, 0],
        [0, mjs.cos(angle), -mjs.sin(angle)],
        [0, mjs.sin(angle), mjs.cos(angle)]
    ]);
}

/**
 * 
 * @param {*} alpha in radians 
 * @param {*} beta in radians
 * @param {*} gamma in radians
 * @param {*} PAS (principal axis system)
 * @param {*} mode (e.g. 'zyz')
 * @param {*} active (true: active rotation, false: passive rotation)
 * 
 * @returns {mathjs.Matrix} rotation matrix
 * 
 */
function eulerRotation(alpha, beta, gamma, mode = 'zyz', active = true) {
    if (mode != 'zyz' && mode != 'zxz')
        throw new Error('Only zyz and zxz modes are implemented so far');

    // Initialize the rotation matrix as diagonal
    let R = mjs.matrix([
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1]
    ]);

    let rz1, rx2, rz3;
    
    if (mode === 'zyz') {
        rz1 = createRz(alpha);
        rx2 = createRy(beta);
        rz3 = createRz(gamma);
    }
    else if (mode === 'zxz') {
        rz1 = createRz(alpha);
        rx2 = createRx(beta);
        rz3 = createRz(gamma);
    }

    if (active) {
        R = mjs.multiply(mjs.multiply(rz1, rx2), rz3);
    } else {
        rz1 = mjs.inv(rz1);
        rx2 = mjs.inv(rx2);
        rz3 = mjs.inv(rz3);
        R = mjs.multiply(mjs.multiply(rz3, rx2), rz1);
    }
    return R;
}

function rotateTensor(alpha, beta, gamma, PAS, mode, active) {
    const R = eulerRotation(alpha, beta, gamma, mode, active);
    // R*PAS R^-1
    return mjs.multiply(mjs.multiply(R, PAS), mjs.inv(R));
}

class TensorData {

    /**
     * Create a TensorData object, to store whole tensors, 
     * diagonalise their symmetric part and return derived quantities
     * 
     * @param {Array | mathjs.Matrix | TensorData} M     Tensor in 3x3 matrix form
     * 
     */
    constructor(M) {

        M = convertToMatrix(M);
        this._M = M.clone();

        var MT = mjs.transpose(M);
        this._Msymm = mjs.divide(mjs.add(M, MT), 2.0);
        this._Masymm = mjs.subtract(M, this._Msymm);

        // Instantiate Rust nmrtensor-wasm core
        const flatValues = this._Msymm._data.flat();
        this._wasm = new WasmNMRTensor(flatValues, 'increasing');

        this._convention = 'increasing';

        this._evals = Array.from(this._wasm.sorted_eigenvalues('increasing'));
        this._orig_evals = Array.from(this._evals);

        const evecsFlat = this._wasm.sorted_eigenvectors('increasing');
        this._evecs = [
            [evecsFlat[0], evecsFlat[3], evecsFlat[6]],
            [evecsFlat[1], evecsFlat[4], evecsFlat[7]],
            [evecsFlat[2], evecsFlat[5], evecsFlat[8]]
        ];
        this._orig_evecs = mjs.transpose(this._evecs);

        this._iso = this._wasm.isotropy;

        const evals = this._evals;
        const EPS = 1e-6;
        const degeneracies = _.countBy(evals, function(x) {
            return mjs.round(x/EPS)*EPS;
        });
        this._symmetry = evals.length - _.keys(degeneracies).length;

        this._haeb_evals = this.sorted_eigenvalues('haeberlen');
        this._haeb_evecs = this.sorted_eigenvectors('haeberlen');
        this._nqr_evals = this.sorted_eigenvalues('nqr');
        this._nqr_evecs = this.sorted_eigenvectors('nqr');
    }
    
    sort_eigs() {
        this._haeb_evals = this.sorted_eigenvalues('haeberlen');
        this._haeb_evecs = this.sorted_eigenvectors('haeberlen');
        this._nqr_evals = this.sorted_eigenvalues('nqr');
        this._nqr_evecs = this.sorted_eigenvectors('nqr');
    }
        

    get data() {
        return JSON.parse(JSON.stringify(this._M._data));
    }

    get symmetric() {
        return JSON.parse(JSON.stringify(this._Msymm._data));
    }

    get asymmetric() {
        return JSON.parse(JSON.stringify(this._Masymm._data));
    }

    get convention() {
        return this._convention;
    }

    set convention(convention) {
        this._convention = convention;
        if (this._Msymm) {
            this._wasm = new WasmNMRTensor(this._Msymm._data.flat(), convention);
        }
    }

    get eigenvalues() {
        return Array.from(this.sorted_eigenvalues(this.convention));
    }

    get eigenvectors() {
        return JSON.parse(JSON.stringify(this.sorted_eigenvectors(this.convention)));
    }
    get haeberlen_eigenvalues() {
        return Array.from(this.sorted_eigenvalues('haeberlen'));
    }

    get haeberlen_eigenvectors() {
        return JSON.parse(JSON.stringify(this.sorted_eigenvectors('haeberlen')));
    }

    get nqr_eigenvalues() {
        return Array.from(this.sorted_eigenvalues('nqr'));
    }

    get nqr_eigenvectors() {
        return JSON.parse(JSON.stringify(this.sorted_eigenvectors('nqr')));
    }

    get isotropy() {
        return this._wasm.isotropy;
    }

    get anisotropy() {
        return this._wasm.anisotropy;
    }

    get reduced_anisotropy() {
        const haeb = this.haeberlen_eigenvalues;
        return haeb[2] - this.isotropy;
    }

    get asymmetry() {
        return this._wasm.asymmetry;
    }

    get span() {
        return this._wasm.span;
    }

    get skew() {
        const s = this.span;
        if (Math.abs(s) < 1e-10) return 0;
        const inc = this.sorted_eigenvalues('increasing');
        return 3 * (inc[1] - this.isotropy) / s;
    }

    get symmetry() {
        // 2 if all eigenvalues are the same
        // 1 if two eigenvalues are the same
        // 0 if all eigenvalues are different
        return this._symmetry;
    }

    /**
     * Rotate the TensorData by a given basis, either as passive or active
     * transformation. Returns the rotated TensorData (does not modify this in
     * place). Default is passive. The convention is such that for a symmetric
     * tensor,
     *
     * T.rotate(T.eigenvectors)
     *
     * returns the diagonalised tensor.
     * 
     * @param  {Array | mathjs.Matrix | TensorData}  basis  Basis to rotate into
     * @param  {Boolean}                             active If true, make it an active transformation (default is false)
     * 
     * @return {TensorData}                                 Rotated tensor
     */
    rotate(basis, active = false) {
        // Rotate the tensor by the given basis of vectors
        if (basis instanceof mjs.Matrix)
            basis = basis._data;
        if (basis instanceof TensorData)
            basis = basis._M._data;

        var bR = basis;
        var bL = mjs.transpose(basis);

        if (active) {
            bR = bL;
            bL = basis;
        }
        var rdata = mjs.multiply(bL, this._M._data, bR);

        return new TensorData(rdata);
    }


    /**
     * Rotate the TensorData by a given angle around a given axis. 
     * Uses the rotate_matrix utility function.
     * 
     * @param {number|Array} a - The angle that the matrix is rotated around the vector 'v'. 'a'
     * can also be a vector and then 'a' is rotated into 'v'. Angles are in degrees!
     * @param {string|Array} v - Vector to rotate the matrix around. Vectors can be given as
     * strings: 'x', '-x', 'y', ... .These correspond to the *local* coordinate system of the tensor if intrinsic == true.
     * @param {boolean} intrinsic - If true, rotate the tensor intrinsically (default is true). i.e. the tensor is rotated in the local coordinate system.
     * 
     * @return {TensorData}      Rotated tensor
     * 
     */
    rotateByAngleAxis(angle, axis, intrinsic = true) {

        // if (intrinsic) {
        //     // convert axis to local coordinates
        //     axis = mjs.multiply(mjs.inv(this.eigenvectors), string2vector(axis));
        //     if (typeof angle != 'number') {
        //         angle = mjs.multiply(mjs.inv(this.eigenvectors), string2vector(angle));
        //     }
        // }

        if (typeof angle === 'number') {
            angle = angle * 180 / PI; // convert to degrees for the rotate_matrix function
        }

        // Rotate the tensor by the given angle around the given axis
        let M = rotate_matrix(this._M._data, angle, axis);
        return new TensorData(M);
    }


    /**
     * Calculate the Euler angles for the TensorData. Returns an array of
     * [alpha, beta, gamma] in degrees.
     * 
     * This function is based on the code from TensorView for MATLAB by
     * Leo Svenningsson and Leonard J. Mueller
     * https://doi.org/10.1016/j.ssnmr.2022.101849
     * 
     * @param {String} mode       Mode to use: either 'zyz' or 'zxz' (default is 'zyz')
     * @param {Boolean} active     If true, make it an active transformation (default is false)
     * @param {String} convention  Eval ordering convention to use (default is whatever is set in 'this.convention)
     * @param {Boolean} degrees    If true, return angles in degrees (default is false)
     * @param {Number} EPS         Tolerance for comparing eigenvalues etc. (default is 1e-6)
     * 
     * @return {Array}             Array of [alpha, beta, gamma] in radians
     * 
     * TODO: check edge cases, esp. axial symmetry 
     * TODO: add in conversion from radians to degrees
     */
    euler(mode = 'zyz', active = true, eval_convention = null, degrees = false, EPS = 1e-6) {
        let convention = eval_convention != null ? eval_convention : this.convention;
        if (this.symmetry === 2) {
            return [0, 0, 0];
        }
        let rads;
        if (convention === this.convention) {
            rads = Array.from(this._wasm.euler_angles(mode, active));
        } else {
            const flat = this._M._data.flat();
            const tempWasm = new WasmNMRTensor(flat, convention);
            rads = Array.from(tempWasm.euler_angles(mode, active));
        }
        if (degrees) {
            return rads.map(a => a * 180 / PI);
        }
        return rads;
    }

    equivalentEuler(mode = 'zyz', active = true, eval_convention = null, degrees = false) {
        let convention = eval_convention != null ? eval_convention : this.convention;
        let flat;
        if (convention === this.convention) {
            flat = Array.from(this._wasm.equivalent_euler_angles(mode, active));
        } else {
            const flatM = this._M._data.flat();
            const tempWasm = new WasmNMRTensor(flatM, convention);
            flat = Array.from(tempWasm.equivalent_euler_angles(mode, active));
        }
        let sets = [];
        for (let i = 0; i < flat.length; i += 3) {
            let set = [flat[i], flat[i+1], flat[i+2]];
            if (degrees) {
                set = set.map(a => a * 180 / PI);
            }
            sets.push(set);
        }
        return sets;
    }

    relativeOrientationTo(otherTensor, specification = {}) {
        return new RelativeTensorOrientation(this, otherTensor, specification);
    }



    /**
     * Convert this TensorData to return a clone that has been converted from
     * atomic units to Hertz, assuming it's an Electric Field Gradient tensor.
     * 
     * @param  {Number} Q       Quadrupolar moment of the given nucleus (barn)
     * 
     * @return {TensorData}     Converted tensor
     */
    efgAtomicToHz(Q) {

        // Clone self, then multiply all the necessary quantities
        var clone = _.clone(this);

        var k = efg2hz*Q;

        clone._M = mjs.multiply(this._M, k);
        clone._Msymm = mjs.multiply(this._Msymm, k);
        clone._Masymm = mjs.multiply(this._Masymm, k);

        clone._wasm = new WasmNMRTensor(clone._Msymm._data.flat(), this.convention);
        clone._iso = clone._wasm.isotropy;

        clone._evals = mjs.multiply(this._evals, k);
        clone._haeb_evals = mjs.multiply(this._haeb_evals, k);

        return clone;
    }

    /**
     * Convert this TensorData to return a clone that has been converted from
     * atomic units to Hertz, assuming it's an Indirect Spin-spin Coupling 
     * tensor.
     * 
     * @param  {Number} g1  Gyromagnetic ratio of the first atom
     * @param  {Number} g2  Gyromagnetic ratio of the second atom
     * 
     * @return {TensorData}     Converted tensor
     */
    iscAtomicToHz(g1, g2) {

        // Clone self, then multiply all the necessary quantities
        var clone = _.clone(this);

        var k = isc2hz*g1*g2;

        clone._M = mjs.multiply(this._M, k);
        clone._Msymm = mjs.multiply(this._Msymm, k);
        clone._Masymm = mjs.multiply(this._Masymm, k);

        clone._wasm = new WasmNMRTensor(clone._Msymm._data.flat(), this.convention);
        clone._iso = clone._wasm.isotropy;

        clone._evals = mjs.multiply(this._evals, k);
        clone._haeb_evals = mjs.multiply(this._haeb_evals, k);

        return clone;        
    }

    /**
     * Get the eigenvalues of the tensor, sorted in the given convention.
     * 
     * @param  {String} convention  Convention to sort the eigenvalues by.
     *                             Can be "increasing", "decreasing",
     *                            "haeberlen" or "nqr".
     * @param  {Boolean} return_indices  If true, return the indices of the
     *                                  sorted eigenvalues, in addition to the
     *                                 sorted eigenvalues.
     * 
     * @return {Array}  Array of sorted eigenvalues, or array of sorted
     *                 eigenvalues and indices, depending on the value of
     *                return_indices.
     * 
     * @throws {Error}  If the convention is not one of the above.
     * 
     * @example
     * // Get the eigenvalues of a tensor, sorted in increasing order
     * var tensor = new TensorData([[1, 0, 0], [0, 2, 0], [0, 0, -6]]);
     * var sorted = tensor.sorted_eigenvalues("increasing");
     * // sorted = [-6, 1, 2]
     * 
     */
    
    sorted_eigenvalues(convention, return_indices=false) {
        const evals = Array.from(this._wasm.sorted_eigenvalues(convention));
        if (return_indices) {
            const inc = Array.from(this._wasm.sorted_eigenvalues('increasing'));
            const sort_i = evals.map(v => {
                const idx = inc.findIndex(x => Math.abs(x - v) < 1e-8);
                return idx >= 0 ? idx : 0;
            });
            return [evals, sort_i];
        }
        return evals;
    }
        
    /**
     * Get the eigenvectors of the tensor, sorted in the given convention.
     * 
     * @param  {String} convention  Convention to sort the eigenvalues by.
     *                            Can be "increasing", "decreasing",
     *                           "haeberlen" or "nqr".
     * 
     * @return {Array}  Array of sorted eigenvectors.
     */
    sorted_eigenvectors(convention) {
        const flat = this._wasm.sorted_eigenvectors(convention);
        const sanitize = x => (Math.abs(x) < 1e-12 ? 0 : x);
        return [
            [sanitize(flat[0]), sanitize(flat[3]), sanitize(flat[6])],
            [sanitize(flat[1]), sanitize(flat[4]), sanitize(flat[7])],
            [sanitize(flat[2]), sanitize(flat[5]), sanitize(flat[8])]
        ];
    }


}


function eulerFromU(U, mode='zyz', active=true, EPS=1e-6) {
    let alpha = 0;
    let beta = 0;
    let gamma = 0;

    if (!active) {
        U = mjs.inv(U);
    }

    let cos_beta = U[2][2];
    // Fix for the occasional numerical error
    cos_beta = Math.min(Math.max(cos_beta, -1), 1);
    beta = mjs.acos(cos_beta);

    if (mode.toLowerCase() === 'zyz') {

        if (mjs.abs(cos_beta - 1) < EPS) {
            console.warn()
            // beta = 0
            alpha = mjs.acos(U[0][0]);
            gamma = 0;
        } else {

            alpha = mjs.atan2(U[1][2] / mjs.sin(beta), U[0][2] / mjs.sin(beta));
            gamma = mjs.atan2(U[2][1] / mjs.sin(beta), -U[2][0] / mjs.sin(beta));
            
        }
    }
    else if (mode.toLowerCase() === 'zxz') {
        if (mjs.abs(cos_beta - 1) < EPS) {
            // beta = 0
            alpha = mjs.acos(U[0][0]);
            gamma = 0;
        } else {
            alpha = mjs.atan2(U[0][2] / mjs.sin(beta), -U[1][2] / mjs.sin(beta));
            gamma = mjs.atan2(U[2][0] / mjs.sin(beta), U[2][1] / mjs.sin(beta));
        }
    }
    else {
        throw new Error('Only zyz and zxz modes are implemented so far');
    }

    return [alpha, beta, gamma];
}

function normaliseEulerAngles(eulerAngles, active = true, eps = 1e-6) {
    const passive = !active;
    let [alpha, beta, gamma] = eulerAngles;

    // wrap any negative angles
    alpha = mjs.mod(alpha, 2 * PI);
    beta  = mjs.mod(beta,  2 * PI);
    gamma = mjs.mod(gamma, 2 * PI);

    if (passive) {

        if (beta > PI) {
            beta = 2 * PI - beta;
            gamma = gamma - PI;
            gamma = mjs.mod(gamma, 2 * PI);
        }

        if (beta >= PI / 2 - eps) {
            alpha = PI - alpha;
            alpha = mjs.mod(alpha, 2 * PI);
            beta = PI - beta;
            beta = mjs.mod(beta, 2 * PI);
            gamma = PI + gamma;
            gamma = mjs.mod(gamma, 2 * PI);
        }

        if (alpha >= PI - eps) alpha = alpha - PI;
    } else {
        if (beta > PI) {
            beta = 2 * PI - beta;
            alpha = alpha - PI;
            alpha = mjs.mod(alpha, 2 * PI);
        }

        if (beta >= PI / 2 - eps) {
            alpha = alpha + PI;
            alpha = mjs.mod(alpha, 2 * PI);
            beta = PI - beta;
            beta = mjs.mod(beta, 2 * PI);
            gamma = PI - gamma;
            gamma = mjs.mod(gamma, 2 * PI);
        }

        if (gamma >= PI - eps) gamma = gamma - PI;
    }

    return [alpha, beta, gamma];
}

function handleEulerEdgeCases(eulerAngles, eigenvalues, originalTensor, mode = 'zyz', active = false, eps = 1e-6) {
    const A = [...originalTensor];
    const passive = !active;
    const [e1, e2, e3] = eigenvalues;
    const degeneracy = eigenvalues.filter(value => mjs.abs(value - e1) < eps).length;

    if (degeneracy === 1) return normaliseEulerAngles(eulerAngles, active, eps);
    if (degeneracy === 3) return [0, 0, 0];
    if (degeneracy !== 2) throw new Error('Degeneracy must be 1, 2, or 3.');

    if (mjs.abs(e1 - e2) < eps) {
        eulerAngles[2] = 0;
    } else if (mjs.abs(e2 - e3) < eps) {
        eulerAngles[0] = 0;
        if (mode.toLowerCase() === 'zyz') {
            const gamma = mjs.abs(mjs.asin(mjs.sqrt((A[1][1] - e2) / (e1 - e2))));
            let beta;
            if (mjs.abs(gamma - PI / 2) < eps) {
                beta = 0;
            } else if (mjs.abs(A[1][2]) < eps && mjs.abs(A[0][1]) < eps) {
                beta = mjs.abs(mjs.asin(mjs.sqrt((A[2][2] - e3) / (e1 - e3 + (e2 - e1) * mjs.sin(gamma) ** 2))));
            } else {
                beta = mjs.atan2(-A[1][2] / (mjs.sin(gamma) * mjs.cos(gamma) * (e1 - e2)), A[0][1] / (mjs.sin(gamma) * mjs.cos(gamma) * (e1 - e2)));
            }
            eulerAngles[1] = beta;
            eulerAngles[2] = gamma;
        } else if (mode.toLowerCase() === 'zxz') {
            const alpha = mjs.abs(mjs.asin(mjs.sqrt((A[0][0] - e2) / (e1 - e2))));
            let beta;
            if (mjs.abs(alpha - PI / 2) < eps) {
                beta = 0;
            } else if (mjs.abs(A[0][1]) < eps && mjs.abs(A[1][2]) < eps) {
                beta = mjs.abs(mjs.asin(mjs.sqrt((A[2][2] - e3) / (e1 - e3 + (e2 - e1) * mjs.sin(alpha) ** 2))));
            } else {
                beta = mjs.atan2(-A[0][1] / (mjs.sin(alpha) * mjs.cos(alpha) * (e1 - e2)), A[1][2] / (mjs.sin(alpha) * mjs.cos(alpha) * (e1 - e2)));
            }
            eulerAngles[0] = alpha;
            eulerAngles[1] = beta;
        }
        if (passive) {
            const [alpha, beta, gamma] = eulerAngles;
            eulerAngles = normaliseEulerAngles([-gamma, -beta, -alpha], active, eps);
        }
    } else {
        throw new Error(`Unexpected degeneracy when computing Euler angles. Eigenvalues are ordered: ${eigenvalues}`);
    }

    return normaliseEulerAngles(eulerAngles, active, eps);
}

/**
 * Calculates equivalent Euler angles for a given set of Euler angles.
 *
 * @param {Array} eulerAngles - An array of three Euler angles [alpha, beta, gamma] in **radians**.
 * @param {boolean} [active=true] - Whether the rotation is active or passive.
 * @param {boolean} [degrees=false] - Whether to return the angles in degrees. If false, the angles are returned in radians.
 *
 * @returns {Array} An array of four sets of equivalent Euler angles. Each set of angles is an array of three elements.
 *
 * The first set of angles is the original Euler angles. The remaining sets are calculated based on the convention and whether the rotation is active or passive.
 *
 * If degrees is true, all angles are converted to degrees.
 */
function equivalentEuler(eulerAngles, active = true, degrees = false) {
    // the order of these doesn't really matter, but has been chosen to match 
    // that in the TensorView for MATLAB code 
    // (which is different to that in the corresponding paper)
    const passive = !active;
    let equivAngles = mjs.zeros([4, 3]);

    let [alpha, beta, gamma] = eulerAngles;

    // set the first row of the array to the original Euler angles
    equivAngles[0] = [alpha, beta, gamma];
    if (passive) {
        equivAngles[1] = [PI + alpha, beta, gamma];
        equivAngles[2] = [PI - alpha, PI - beta, PI + gamma];
        equivAngles[3] = [2 * PI - alpha, PI - beta, PI + gamma];
    } else {
        equivAngles[1] = [alpha, beta, PI + gamma];
        equivAngles[2] = [PI + alpha, PI - beta, PI - gamma];
        equivAngles[3] = [PI + alpha, PI - beta, 2 * PI - gamma];
    }

    // now wrap any negative angles in equivAngles or > 2pi
    equivAngles = equivAngles.map(value => value.map(value => mjs.mod(value, 2 * PI)));

    // convert to degrees if necessary
    if (degrees) {
        equivAngles = equivAngles.map(value => value.map(value => mjs.multiply(value, 180 / PI)));
    }
    
    return equivAngles;
}


function convertToMatrix(M) {
    if (M instanceof TensorData) {
        return M._M;
    } else if (Array.isArray(M)) {
        if (M.length === 3 && M[0].length === 3) {
            // Convert 3x3 array to mathjs matrix
            return mjs.matrix(M);
        } else if (M.length === 9) {
            // Convert 9-element array to 3x3 mathjs matrix
            return mjs.matrix([M.slice(0, 3), M.slice(3, 6), M.slice(6, 9)]);
        } else if (M.length === 2) {
            // Assume it's the eigenvalues and eigenvectors
            const eigs = M[0];
            const evecs = M[1];
            M = mjs.multiply(mjs.multiply(evecs, mjs.diag(eigs)), mjs.transpose(evecs));
            return mjs.matrix(M);
        } else {
            throw new Error('Array must be 3x3 or 9-element or [eigenvalues, eigenvectors]');
        }
    } else if (M instanceof mjs.Matrix) {
        if (M.size()[0] !== 3 || M.size()[1] !== 3) {
            throw new Error('Matrix must be 3x3');
        }
        return M;
    } else if (typeof M === 'object' && M.eigenvalues && M.eigenvectors) {
        const eigs = M.eigenvalues;
        const evecs = M.eigenvectors;
        M = mjs.multiply(mjs.multiply(evecs, mjs.diag(eigs)), mjs.transpose(evecs));
        return mjs.matrix(M);
    } else {
        throw new Error('Invalid input type');
    }
}

export {
    equivalentEuler,
    eulerFromU,
    rotateTensor,
    TensorData,
    convertToMatrix,
}

'use strict';

/**
 * @fileoverview TensorData class to store tensors like NMR data and such.
 * @module
 */

import _ from 'lodash';
import * as mjs from 'mathjs';

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
function rotateTensor(alpha, beta, gamma, PAS, mode, active) {
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

        if (M instanceof TensorData)
            M = M._M;
        else if (M instanceof Array)
            M = mjs.matrix(M);

        this._M = M;

        var MT = mjs.transpose(M);
        this._Msymm = mjs.divide(mjs.add(M, MT), 2.0);
        this._Masymm = mjs.subtract(M, this._Msymm);

        // Diagonalize
        var eigs = mjs.eigs(this._Msymm);
        // Sort by eigenvalue magnitude
        var evecs = eigs.eigenvectors.map(e => e.vector._data);
        eigs = _.zip(eigs.values._data, evecs);
        eigs = _.sortBy(eigs, function(x) {
            return x[0];
        });
        eigs = _.unzip(eigs);

        this._evals = eigs[0];

        // store original eigenvectors and eigenvalues (before making them right-handed)
        this._orig_evals = Array.from(this._evals);
        this._orig_evecs = mjs.transpose(eigs[1]);


        // Make it right-handed
        evecs = eigs[1];
        evecs[2] = mjs.cross(evecs[0], evecs[1]);
        this._evecs = mjs.transpose(evecs);

        // Isotropy
        this._iso = mjs.mean(this._evals);

        // number of degeneracies
        const EPS = 1e-4;
        const degeneracies = _.countBy(this._evals, function(x) {
            return mjs.round(x/EPS)*EPS;
        });
        // symmetry
        // 2 if all eigenvalues are the same
        // 1 if two eigenvalues are the same
        // 0 if all eigenvalues are different
        this._symmetry = this._evals.length - _.keys(degeneracies).length;


        // Save evals and evecs in Haeberlen and NQR order for convenience
        this._haeb_evals = this.sorted_eigenvalues('haeberlen');
        this._haeb_evecs = this.sorted_eigenvectors('haeberlen');
        this._nqr_evals = this.sorted_eigenvalues('nqr');
        this._nqr_evecs = this.sorted_eigenvectors('nqr');

        // Default convention is increasing
        this._convention = 'increasing';
    }
    
    /**
     * This method sorts the eigenvalues and eigenvectors in Haeberlen and NQR order.
     * 
     * Haeberlen Order:
     * The method first calculates the absolute difference between each eigenvalue and the isotropic value.
     * These differences are then sorted in ascending order. The sorted eigenvalues are stored in `this._haeb_evals`.
     * The corresponding eigenvectors are also sorted in the same order, but with the first and second elements swapped.
     * The sorted eigenvectors are stored in `this._haeb_evecs`.
     * 
     * NQR Order:
     * The method then repeats the same process for the original eigenvalues, but without swapping the first and second elements.
     * The sorted original eigenvalues are stored in `this._nqr_evals`.
     * 
     * Note: The method uses the lodash (`_`) library for the `zip`, `range`, and `sortBy` functions.
     * The `mjs.transpose` function is used to transpose the array of eigenvectors, and `mjs.cross` is used to calculate the cross product of two vectors.
     */
    sort_eigs() {
        console.log('sorting eigenvalues and eigenvectors')
        var evecs = mjs.transpose(this._evecs);
        // Haeberlen order
        var iso = this._iso;
        var haeb = _.zip(_.range(3), this._evals);
        haeb = _.sortBy(haeb, function(x) {
            return mjs.abs(x[1] - iso);
        });
        // x and y are swapped in this order
        this._haeb_evals = [
            this._evals[haeb[1][0]],
            this._evals[haeb[0][0]],
            this._evals[haeb[2][0]]
        ];
    
        this._haeb_evecs = mjs.transpose([
            evecs[haeb[1][0]],
            evecs[haeb[0][0]],
            mjs.cross(evecs[haeb[1][0]], evecs[haeb[0][0]])
        ]);
    
    
        // NQR order
        var nqr = _.zip(_.range(3), this._orig_evals);
        // same sorting function as for Haeberlen
        nqr = _.sortBy(nqr, function(x) {
            return mjs.abs(x[1] - iso);
        });
        // but in this case we don't swap the x and y
        this._nqr_evals = [
            this._orig_evals[nqr[0][0]],
            this._orig_evals[nqr[1][0]],
            this._orig_evals[nqr[2][0]]
        ];
        let nqr_evecs = mjs.transpose(this._orig_evecs);
        this._nqr_evecs = mjs.transpose([
            nqr_evecs[nqr[0][0]],
            nqr_evecs[nqr[1][0]],
            mjs.cross(nqr_evecs[nqr[0][0]], nqr_evecs[nqr[1][0]])
        ]);
        
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
    }

    get eigenvalues() {
        return Array.from(this.sorted_eigenvalues(this.convention));
    }

    get eigenvectors() {
        return JSON.parse(JSON.stringify(this.sorted_eigenvectors(this.convention)));
    }
    get haeberlen_eigenvalues() {
        return Array.from(this._haeb_evals);
    }

    get haeberlen_eigenvectors() {
        return JSON.parse(JSON.stringify(this._haeb_evecs));
    }

    get nqr_eigenvalues() {
        return Array.from(this._nqr_evals);
    }

    get nqr_eigenvectors() {
        return JSON.parse(JSON.stringify(this._nqr_evecs));
    }

    get isotropy() {
        return this._iso;
    }

    get anisotropy() {
        return this._haeb_evals[2] - (this._haeb_evals[0] + this._haeb_evals[1]) / 2.0;
    }

    get reduced_anisotropy() {
        return this._haeb_evals[2] - this._iso;
    }

    get asymmetry() {
        var ra = this.reduced_anisotropy;
        return (this._haeb_evals[1] - this._haeb_evals[0]) / ra;
    }

    get span() {
        return this._evals[2] - this._evals[0];
    }

    get skew() {
        var s = this.span;
        return 3 * (this._evals[1] - this._iso) / s;
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
     * 
     * @return {Array}             Array of [alpha, beta, gamma] in radians
     * 
     * TODO: check edge cases, esp. axial symmetry 
     * TODO: add in conversion from radians to degrees
     */
    euler(mode = 'zyz', active = true, eval_convention = null, degrees = false) {
        let convention = eval_convention != null ? eval_convention : this.convention;
        // Tolerance for comparing eigenvalues etc.
        const EPS = 1e-6;
        // Eigenvalues and eigenvectors of the symmetric part of the tensor
        const sorted_evals = this.sorted_eigenvalues(convention);
        // deep copy of the eigenvectors
        let U = JSON.parse(JSON.stringify(this.sorted_eigenvectors(convention)));

        // invert U if not active
        if (!active) {
            // I'm not sure why we need to multiply by -1 here
            // but I was getting the wrong alpha angles without it
            // (wrong wrt TensorView/Soprano)
            U = mjs.inv(mjs.multiply(U, -1));
        }

        let alpha = 0
        let beta = 0
        let gamma = 0
        
        // number of unique eigenvalues (within tolerance)
        const symm = this.symmetry;

        if (symm == 2) {
            // all eigenvalues are the same -> spherical symmetry
            // no need to calculate the Euler angles
            return [0, 0, 0];
        }

        // PAS = principal axis system
        // it has the eigenvalues on the diagonals, zeros elsewhere
        const PAS = new mjs.diag(sorted_evals);
        // PASv is just the eigenvalues in a vector
        const PASv = sorted_evals;


        // Euler angles
        // initialising the angles
        [alpha, beta, gamma] = eulerFromU(U, mode, EPS);

        let M = rotateTensor(alpha, beta, gamma, PAS, mode, active);
        // U PAS U^-1
        let CF = mjs.multiply(mjs.multiply(U, PAS), mjs.inv(U));

        // now let's check to make sure M and Cf are nearly the same
        // this is because the eigenvalue solver is not always perfect
        // and we want to make sure that the angles are correct
        // TODO! this doesn't seem to be working since the rotation doesn't give us 
        // the same tensor as the diagonalisation even after the U -> -U trick
        if (mjs.norm(mjs.subtract(M, CF)) > EPS) {
            console.log('M and CF are not the same. Trying again with -U');
            // if they are not the same, we can simply flip all the signs of U
            // and try again
            U = mjs.multiply(-1, U);
            [alpha, beta, gamma] = eulerFromU(U, mode, EPS);
            M = rotateTensor(alpha, beta, gamma, PAS, mode, active);
            CF = mjs.multiply(mjs.multiply(U, PAS), mjs.inv(U));
            // if they are still not the same, then we have a problem
            if (mjs.norm(mjs.subtract(M, CF)) > EPS) {
                console.warn('M and CF are still not the same. Something is wrong.');
                // throw new Error('M and CF are still not the same. Something is wrong.');
            }
        }

        console.log('U', U);
        // standardise/normalise angle ranges is done inside the handleEulerEdgeCases function
        [alpha, beta, gamma] = handleEulerEdgeCases([alpha, beta, gamma], this.eigenvalues, this.symmetric, mode, active, EPS);
        console.log('alpha, beta, gamma', alpha, beta, gamma);

        // convert to degrees if necessary
        if (degrees) {
            alpha = mjs.multiply(alpha, 180 / PI);
            beta = mjs.multiply(beta, 180 / PI);
            gamma = mjs.multiply(gamma, 180 / PI);
        }

        
        
        return [alpha, beta, gamma];
    }
    // method wrapping around the equivalentEuler function
    equivalentEuler(mode = 'zyz', active = true, eval_convention = null, degrees = false) {
        let eulers = this.euler(mode, active, eval_convention, degrees);
        return equivalentEuler(eulers, mode, active, degrees);
    }

    rotationTo(otherTensor) {
        // wrapper around the rotationTo function
        return rotationTo(this.eigenvectors, otherTensor.eigenvectors);
    }


    /**
     * Calculates the Euler angles that rotate this tensor to another tensor.
     *
     * @param {TensorData} otherTensor - The tensor to which we want to rotate.
     * @param {string} [convention='zyz'] - The convention to use for the Euler angles. Default is 'zyz'.
     * @param {boolean} [active=true] - Whether to use active rotation or passive. Default is true (active).
     * @param {number} [eps=1e-6] - The tolerance for considering two tensors as identical. Default is 1e-6.
     *
     * @returns {Array} The Euler angles [alpha, beta, gamma] in degrees that rotate this tensor to the other tensor.
     *
     * @throws {Error} If the tensors are identical or if the Euler angles are ambiguous for degenerate tensors.
     *
     * @warns If the tensors are identical or if the Euler angles are ambiguous for degenerate tensors.
     */
    eulerTo(otherTensor, convention = 'zyz', active = true, eps = 1e-6) {
        convention = convention.toLowerCase();

        let Aevals  = this.eigenvalues;
        let Bevals  = otherTensor.eigenvalues;
        let Aevecs  = this.eigenvectors;
        let Bevecs  = otherTensor.eigenvectors;
        // first make sure they're not the same!
        if (mjs.deepEqual(this._evals, otherTensor._evals)) {
            // check eigenvectors are the same up to a sign
            if (mjs.deepEqual(Aevecs, Bevecs) || mjs.deepEqual(Aevecs, mjs.multiply(-1, Bevecs))) {
                console.warn("The tensors are identical. Returning zero Euler angles.");
                return [0, 0, 0];
            }
        }
        if (this.symmetry == 1 && otherTensor.symmetry == 1) {
            // Both are axially symmetric - need to be careful
            console.warn(
                "Some of the Euler angles are ambiguous for degenerate tensors.\n" +
                "Care must be taken when comparing the Euler angles of degenerate tensors.\n" +
                `Degeneracy of tensor 1: ${this._degeneracy} (Eigenvalues: ${this._evals})` +
                `Degeneracy of tensor 2: ${otherTensor._degeneracy} (Eigenvalues: ${otherTensor._evals})`
            );
    
            // alternative from the code
            let Rrel1 = mjs.multiply(mjs.inv(Bevecs), Aevecs);
            let B_at_A = mjs.multiply(Rrel1, mjs.multiply(mjs.diag(Aevals), mjs.inv(Rrel1)));
    
            // quick check if the angles are all zero:
            if (mjs.abs(B_at_A[1][2] + B_at_A[0][2] + B_at_A[0][1]) < eps) {
                console.warn("The tensors are perfectly aligned. Returning zero Euler angles.");
                return [0, 0, 0];
            }
    
            if (convention == 'zyz') {
                // If both are axially symmetric, then
                let alpha = 0;
                let gamma = 0;
                let beta = mjs.asin(mjs.sqrt(
                    (B_at_A[2][2] - Aevals[2]) /
                    (Aevals[0] - Aevals[2])
                ));
                beta = mjs.abs(beta); // we can choose the sign of beta arbitrarily
                return [alpha, beta, gamma];
            }
    
            if (convention == 'zxz') {
                // in this convention, it depends on the unique axis
                // but the possible angles are:
                let a = PI / 2;
                let b = mjs.asin(-1 * mjs.sqrt(
                    (B_at_A[2][2] - Aevals[2]) /
                    (Aevals[0] - Aevals[2])
                ));
                b = mjs.abs(b); // we can choose the sign arbitrarily
                let c = 0;
    
                if (mjs.abs(Bevals[0] - Bevals[1]) < eps) {
                    // Unique axis is z
                    return [a, b, c]; // 90, arcsin(...), 0
                } else if (mjs.abs(Bevals[1] - Bevals[2]) < eps) {
                    // Unique axis is x
                    return [c, a, b]; // 0, 90, arcsin(...)
                } else {
                    throw new Error('Unexpected eigenvalue ordering for axially symmetric tensor in zxz convention. Eigenvalues are: ' + Bevals);
                }
            }
            // if neither zyz nor zxz, warn
            console.warn('Euler angles for axially symmetric tensors are only corrected for zyz and zxz conventions. Returning the uncorrected Euler angles.');
        }
    
        let R = rotationTo(this.eigenvectors, otherTensor.eigenvectors);
        if (otherTensor.symmetry == 1 && this.symmetry != 1) {
            console.warn('The second tensor is axially symmetric, but the first is not. The Euler angles may be incorrect.');
            // then let's swap them around, then transpose the result
            // TODO: test this! 
            R = mjs.transpose(otherTensor.rotationTo(this));
        }
        let eulerAngles = eulerFromU(R, convention);
        eulerAngles = normaliseEulerAngles(eulerAngles, active, eps);
        return eulerAngles;
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

        clone._iso = this._iso*k;

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

        clone._iso = this._iso*k;

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
        const EPS = 1e-6;
        let evals = this._orig_evals;
        let iso = this._iso;
        let sort_i = [];
    
        if (mjs.norm(mjs.subtract(evals, iso)) < EPS) {
            // isotropic tensor (all eigenvalues are the same)
            sort_i = [0, 1, 2];
        // TODO: what about the case where two eigenvalues are the same?
        } else {
            convention = convention.toLowerCase();
            switch (convention) {
                case "increasing":
                case "i":
                    sort_i = _.sortBy(_.range(3), x => evals[x]);
                    break;
                case "decreasing":
                case "d":
                    sort_i = _.sortBy(_.range(3), x => evals[x]).reverse();
                    break;
                case "haeberlen":
                case "h":
                    sort_i = _.sortBy(_.range(3), x => mjs.abs(evals[x] - iso));
                    [sort_i[0], sort_i[1]] = [sort_i[1], sort_i[0]];
                    break;
                case "nqr":
                case "n":
                    sort_i = _.sortBy(_.range(3), x => mjs.abs(evals[x] - iso));
                    break;
                default:
                    throw new Error("Unknown eigenvalue sorting convention: " + convention);
            }
        }
    
        let sorted_evals = sort_i.map(i => this._evals[i]);
        return return_indices ? [sorted_evals, sort_i] : sorted_evals;
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
        // use this.sorted_eigenvalues to get the indices
        let [, sort_i] = this.sorted_eigenvalues(convention, true);
        let evecs = mjs.transpose(this._orig_evecs);
        // make right-handed
        let sorted_evecs = mjs.transpose([
            evecs[sort_i[0]],
            evecs[sort_i[1]],
            mjs.cross(evecs[sort_i[0]], evecs[sort_i[1]])
        ]);

        return sorted_evecs;
    }


}


function eulerFromU(U, mode='zyz', EPS=1e-6) {
    let alpha = 0;
    let beta = 0;
    let gamma = 0;

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
            gamma  = mjs.mod(gamma, 2 * PI);
        }

        if (beta >= PI / 2 - eps) {
            alpha = PI - alpha;
            alpha  = mjs.mod(alpha, 2 * PI);
            beta = PI - beta;
            beta = mjs.mod(beta, 2 * PI);
            gamma = PI + gamma;
            gamma = mjs.mod(gamma, 2 * PI);
        }

        if (alpha >= PI - eps) {
            alpha = alpha - PI;
        }
    } else {
        if (beta > PI) {
            beta = 2 * PI - beta;
            alpha = alpha - PI;
            alpha  = mjs.mod(alpha, 2 * PI);
        }

        if (beta >= PI / 2 - eps) {
            alpha = alpha + PI;
            alpha  = mjs.mod(alpha, 2 * PI);
            beta = PI - beta;
            beta = mjs.mod(beta, 2 * PI);
            gamma = PI - gamma;
            gamma = mjs.mod(gamma, 2 * PI);
        }

        if (gamma >= PI - eps) {
            gamma = gamma - PI;
        }
    }

    return [alpha, beta, gamma];
}


function handleEulerEdgeCases(eulerAngles, eigenvalues, originalTensor, mode = "zyz", active = false, eps = 1e-6) {
    let A = [...originalTensor]; // copy the original tensor
    let passive = !active;
    // only handle zyz or zxz for now
    if (!["zyz", "zxz"].includes(mode.toLowerCase())) {
        console.warn(`Edge cases not handled for ${mode} mode. Returning unmodified Euler angles.`);
        return eulerAngles;
    }

    // Check for degeneracy
    let degeneracy = eigenvalues.reduce((acc, val) => acc + (mjs.abs(val - eigenvalues[0]) < eps ? 1 : 0), 0);
    let [e1, e2, e3] = eigenvalues;
    if (degeneracy === 1) {
        // No degeneracy, just check that we're in the right range
        eulerAngles = normaliseEulerAngles(eulerAngles, active);

        return eulerAngles;
    }

    // this is the tricky one - doubly degenerate (axial symmetry )
    else if (degeneracy === 2) {
        if (mjs.abs(e1 - e2) < eps) {
            // We have the unique axis along z
            // we are free to set gamma to zero
            eulerAngles[2] = 0;
        }
        else if (mjs.abs(e2 - e3) < eps) {
            // We have the unique axis along x
            // we are free to set alpha to zero
            eulerAngles[0] = 0;
    
            // But now we have to be careful
            if (mode.toLowerCase() === "zyz") {
                let gamma = mjs.asin(mjs.sqrt((A[1][1] - e2) / (e1 - e2))); // +/- this
                gamma = mjs.abs(gamma); // we can choose the sign to be positive
                let beta;
                if (mjs.abs(gamma - PI/2) < eps) {
                    // We're free to choose beta to be zero
                    beta = 0.0;
                }
                else {
                    // TODO: Confirm that A[1,2] = A[2,1] since A should be symmetric? (is it?)
                    // if the original tensor entries [1,2] and [0,1] are both zero
                    if (mjs.abs(A[1][2]) < eps && mjs.abs(A[0][1]) < eps) {
                        beta = mjs.asin(mjs.sqrt((A[2][2] - e3) / (e1 - e3 + (e2 - e1)*mjs.sin(gamma)**2)));
                        beta = mjs.abs(beta); // we can choose the sign to be positive
                    }
                    else {
                        beta = mjs.atan2(
                            -1*A[1][2] / (mjs.sin(gamma) * mjs.cos(gamma)*(e1 - e2)),
                            A[0][1] / (mjs.sin(gamma) * mjs.cos(gamma)*(e1 - e2))
                        );
                    }
                }
                // Done with zyz
                eulerAngles[1] = beta;
                eulerAngles[2] = gamma;
    
                if (passive) {
                    let [a,b,c] = eulerAngles;
                    eulerAngles = normaliseEulerAngles([-c,-b,-a], active);
                }

            }
            else if (mode.toLowerCase() === "zxz") {
                let alpha = mjs.asin(mjs.sqrt((A[0][0] - e2) / (e1 - e2))); // +/- this
                alpha = mjs.abs(alpha); // we can choose the sign to be positive
                let beta;
                if (mjs.abs(alpha - PI/2) < eps) {
                    // We're free to choose beta to be zero
                    beta = 0.0;
                }
                else {
                    // TODO: Confirm that A[0,1] = A[1,0] since A should be symmetric? (is it?)
                    // if the original tensor entries [0,1] and [1,2] are both zero
                    if (mjs.abs(A[0][1]) < eps && mjs.abs(A[1][2]) < eps) {
                        beta = mjs.asin(mjs.sqrt((A[2][2] - e3) / (e1 - e3 + (e2 - e1)*mjs.sin(alpha)**2)));
                        beta = mjs.abs(beta); // we can choose the sign to be positive
                    }
                    else {
                        beta = mjs.atan2(
                            -1*A[0][1] / (mjs.sin(alpha) * mjs.cos(alpha)*(e1 - e2)),
                            A[1][2] / (mjs.sin(alpha) * mjs.cos(alpha)*(e1 - e2))
                        );
                    }
                }
                // Done with zxz
                eulerAngles[0] = alpha;
                eulerAngles[1] = beta;

                if (passive) {
                    let [a,b,c] = eulerAngles;
                    eulerAngles = normaliseEulerAngles([-c,-b,-a], active);
                }
            }
        }
        else {
            // We shouldn't have the unique axis along y for 
            // reasonably sorted eigenvalues
            throw new Error("Unexpected degeneracy when computing Euler angles.\nEigenvalues are ordered: " + eigenvalues);
        }
    }
    else if (degeneracy === 3) {
        // All eigenvalues are the same
        // We can set all angles to zero
        eulerAngles = [0, 0, 0];
    }
    else {
        throw new Error("Degeneracy must be 1, 2, or 3.");
    }
    return eulerAngles;
}

/**
 * Calculates equivalent Euler angles for a given set of Euler angles.
 *
 * @param {Array} eulerAngles - An array of three Euler angles [alpha, beta, gamma] in **radians**.
 * @param {string} [convention="zyz"] - The Euler angle convention. Can be "zyz" or "zxz".
 * @param {boolean} [active=true] - Whether the rotation is active or passive.
 * @param {boolean} [degrees=false] - Whether to return the angles in degrees. If false, the angles are returned in radians.
 *
 * @returns {Array} An array of four sets of equivalent Euler angles. Each set of angles is an array of three elements.
 *
 * The first set of angles is the original Euler angles. The remaining sets are calculated based on the convention and whether the rotation is active or passive.
 *
 * If degrees is true, all angles are converted to degrees.
 */
function equivalentEuler(eulerAngles, convention = "zyz", active = true, degrees = false) {
    // the order of these doesn't really matter, but has been chosen to match 
    // that in the TensorView for MATLAB code 
    // (which is different to that in the corresponding paper)
    const passive = !active;
    convention = convention.toLowerCase();
    let equivAngles = mjs.zeros([4, 3]);

    let [alpha, beta, gamma] = eulerAngles;

    // set the first row of the array to the original Euler angles
    equivAngles[0] = [alpha, beta, gamma];
    if (convention === "zyz") {
        if (passive) {
            equivAngles[1] = [PI + alpha, beta, gamma];
            equivAngles[2] = [PI - alpha, PI - beta, PI + gamma];
            equivAngles[3] = [2 * PI - alpha, PI - beta, PI + gamma];
        } else {
            equivAngles[1] = [alpha, beta, PI + gamma];
            equivAngles[2] = [PI + alpha, PI - beta, PI - gamma];
            equivAngles[3] = [PI + alpha, PI - beta, 2 * PI - gamma];
        }
    } else if (convention === "zxz") {
        if (passive) {
            equivAngles[1] = [PI + alpha, beta, gamma];
            equivAngles[2] = [PI - alpha, PI - beta, PI + gamma];
            equivAngles[3] = [2 * PI - alpha, PI - beta, PI + gamma];
        } else {
            equivAngles[1] = [alpha, beta, PI + gamma];
            equivAngles[2] = [PI + alpha, PI - beta, PI - gamma];
            equivAngles[3] = [PI + alpha, PI - beta, 2 * PI - gamma];
        }
    }

    // now wrap any negative angles in equivAngles or > 2pi
    equivAngles = equivAngles.map(value => value.map(value => mjs.mod(value, 2 * PI)));

    // convert to degrees if necessary
    if (degrees) {
        equivAngles = equivAngles.map(value => value.map(value => mjs.multiply(value, 180 / PI)));
    }
    
    return equivAngles;
}



function rotationTo(eigenvectors1, eigenvectors2) {
    /*
    Returns the rotation matrix that rotates the tensor1 to the tensor2.
    TODO: check direction. I think this gives the rotation tensor1 to tensor2, rather than
    the rotation of tensor1 in the reference frame of tensor2.

    B = R A
    B A^-1 = R
    */
    console.log('Running rotationTo');
    // aliases
    let R1 = eigenvectors1
    let R2 = eigenvectors2;
    //TODO: check direction. I think this gives the rotation tensor1 to tensor2, rather than
    // the rotation of tensor1 in the reference frame of tensor2.
    // let R = mjs.multiply(mjs.inv(R1), R2);
    
    // This gives starting coordinates as R1 and final coordinates as R2:
    let R = mjs.multiply(R2, mjs.inv(R1));
    // Need to guarantee that R expresses a *proper* rotation
    // (i.e. det(R) = 1)
    if (mjs.det(R) < 0) {
        R = R.map((value, index) => {
            if (index % R.length === 2) {
                return mjs.multiply(value, -1);
            }
            return value;
        });
    }

    return R;
}

export {
    equivalentEuler,
    rotateTensor,
    TensorData
}

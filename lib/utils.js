'use strict';

/** 
 * @fileoverview Utility functions
 * @module
 */

import _ from 'lodash';
import * as THREE from 'three';
import * as mjs from 'mathjs';


/**
 * Compute a full list of indices of all cells for 
 * a supercell of given size
 * @param {Array} scell        Size of the requested supercell 
 */
function supercellGrid(scell) {
    var bounds = _.map(scell, function(x) {
        var lb = Math.ceil(-x / 2)+(1-x%2); // This makes it so that for even supercells we skew on the positive side
        if (Object.is(lb, -0)) {
            lb = 0; // Avoids -0
        }
        var ub = Math.ceil(x / 2)+(1-x%2);
        return [lb, ub];
    });
    var grid = [];

    for (var i = bounds[0][0]; i < bounds[0][1]; ++i) {
        for (var j = bounds[1][0]; j < bounds[1][1]; ++j) {
            for (var k = bounds[2][0]; k < bounds[2][1]; ++k) {
                grid.push([i, j, k]);
            }
        }
    }

    return grid;
}

/**
 * Reduce a tuple of atomic index + i,j,k cell indices to a single integer
 * @param  {int}    i       Atomic index
 * @param  {Array}  ijk     Cell indices
 * @param  {Array}  scell   Supercell size
 * @param  {int}    n       Number of atoms in the model
 * 
 * @return {int}            Overall index
 */
function supercellIndex(i, ijk, scell, n) {

    ijk = _.map(ijk, function(x, i) {
        return x + Math.floor((scell[i]-1)/2); // Important (depends on the convention in supercellGrid)
    });

    // If any of these is smaller than 0, we're sure to be out
    if (ijk[0] < 0 || ijk[1] < 0 || ijk[2] < 0) {
        return -1;
    }
    if (ijk[0] >= scell[0] || ijk[1] >= scell[1] || ijk[2] >= scell[2]) {
        return -1;
    }

    var itot = ijk[2] + ijk[1] * scell[2] + ijk[0] * scell[2] * scell[1];
    itot = i + itot*n;

    return itot;
}

/**
 * Turn a unit cell expressed as Array of Arrays into a THREE.Matrix3 object
 * @param {Array}   cell    Cell in Array form
 *
 * @return {THREE.Matrix3}  Cell in THREE.Matrix3 form
 */
function cellMatrix3(cell) {
    var lc = cell;
    cell = new THREE.Matrix3();
    cell.set(lc[0][0], lc[1][0], lc[2][0],
        lc[0][1], lc[1][1], lc[2][1],
        lc[0][2], lc[1][2], lc[2][2]);

    return cell;
}

/** Add a static variable to a class definition, old style (will become 
 * obsolete once the static keyword is widely accepted in ES) 
 * @param {Object}  cls      Class 
 * @param {String}  name     Name of the variable to define
 * @param {any}     value    Value to assign to it
 */
function addStaticVar(cls, name, value) {
    Object.defineProperty(cls, name, {
        value: value,
        writable: false
    });
}

/** Shift a CPK Color to be more distinct (used for isotopes) 
 *
 * @param {int}    basec    Base color to modify. Can be anything accepted
 *                             by the THREE.Color constructor, but by default
 *                             we assume it's an hex integer.
 * @param {float}  shift    Shift to apply. Should range from -1 to 1.
 *
 * @return  {int}           Shifted color, returned as hex code.
 * 
 * */
function shiftCpkColor(basec, shift=0) {
    let c = new THREE.Color(basec);
    let hsl = {};
    c.getHSL(hsl);
    // Here the goal is to choose a color that's still similar enough
    // to the original, but also contrasts to it.
    // We shift it more in hue if it's not very saturated/bright, and
    // also shift its lightness towards 0.5 and saturation towards 1,
    // so the hue becomes more evident

    /*
    let f = ((1.0-hsl.s)/2 + Math.abs(hsl.l-0.5))*0.7 + 0.3;
    hsl.h = (hsl.h+shift*f*0.5)%1;

    f *= 0.4;
    hsl.s = f+(1-f)*hsl.s;
    f *= 0.5;
    hsl.l = f/2.0+(1-f)*hsl.l;
    */
   
    // How close to white/black is the color?
    let bw = Math.abs(hsl.l-0.5)/0.5;

    if (Math.abs(bw-1) < 1e-2) {
        // By convention we set the hue as blue
        hsl.h = 0.6666;
    }

    // Reduce/increase luminance most for blacks and whites
    hsl.l = (hsl.l-0.5)*(1-0.05*bw)+0.5;
    // Increase saturation most for blacks and whites
    hsl.s = hsl.s + 0.8*bw;
    // Rotate hue least for vivid colors
    hsl.h = (hsl.h+0.1*(0.5+bw)*shift);

    c.setHSL(hsl.h, hsl.s, hsl.l);

    return c.getHex();
}

/** Produce a low-collision hash code from a string argument. The algorithm
 * is inspired by Java's .hashCode() method.
 * 
 * @param {String} arg    The string to hash
 * 
 * @return {int}          Hash code
 */
function hashCode(arg) {
    arg = arg.toString(); // For sanity
    let hash = 0;

    for (let i = 0; i < arg.length; ++i) {
        let char = arg.charCodeAt(i);
        hash = ((hash<<5)-hash)+char;
        hash = hash & hash; // Convert to 32bit integer
    }

    return hash;
}


/**
 * Compare floating point numbers for equality with a given tolerance
 * 
 * @param {float} a    First number
 * @param {float} b    Second number
 * @param {float} tol  Tolerance (absolute)
 * 
 * @return {bool}      True if the numbers are equal within the tolerance
 * 
 * TODO: could add relative tolerance as well
 */
function floatEqual(a, b, tol=1e-6) {
    // check for NaNs
    if (a !== a || b !== b) {
        return false;
    }

    return Math.abs(a-b) < tol;
}


/**
 * Checks if two arrays are almost equal within a given tolerance.
 *
 * @param {Array} array1 - The first array.
 * @param {Array} array2 - The second array.
 * @param {number} tolerance - The tolerance value.
 * @returns {boolean} Returns true if the arrays are almost equal, false otherwise.
 */
function arraysAlmostEqual(array1, array2, tolerance=1e-12) {
    // check the dimension of each array
    if (array1.length !== array2.length) {
        return false;
    }
    return _.every(_.zip(array1, array2), ([a, b]) => {
        // if both a and b are arrays, recursively check them
        if (Array.isArray(a) && Array.isArray(b)) {
            return arraysAlmostEqual(a, b, tolerance);
        }
        // if only one of a and b is an array, they are not equal
        else if (Array.isArray(a) || Array.isArray(b)) {
            return false;
        }
        // if neither a nor b is an array, check their difference
        else {
            return Math.abs(a - b) <= tolerance;
        }
    });
}


/**
 * Converts an array of tensor data to a THREE.Matrix3 object.
 *
 * @param {number[]} tensorData - The array of tensor data.
 * @returns {THREE.Matrix3} The converted THREE.Matrix3 object.
 */
function tensorDataToMatrix3(tensorData) {
    let M = new THREE.Matrix3();
    M.set(
        tensorData[0][0], tensorData[0][1], tensorData[0][2],
        tensorData[1][0], tensorData[1][1], tensorData[1][2],
        tensorData[2][0], tensorData[2][1], tensorData[2][2]
    );
    return M;
}

/**
 * Converts a THREE.Matrix3 object to an array of tensor data.
 *
 * @param {THREE.Matrix3} M - The THREE.Matrix3 object.
 * @returns {number[]} The converted array of tensor data.
 */
function matrix3ToTensorData(M) {
    return [
        [M.elements[0], M.elements[1], M.elements[2]],
        [M.elements[3], M.elements[4], M.elements[5]],
        [M.elements[6], M.elements[7], M.elements[8]]
    ];
}


/**
 * Converts a string to a vector.
 *
 * If the string starts with a '-', the function is called recursively with the rest of the string,
 * and the resulting vector is negated.
 *
 * If the string is 'x', 'y', or 'z', a vector with a 1.0 in the corresponding position is returned.
 * For example, 'x' returns [1.0, 0.0, 0.0], 'y' returns [0.0, 1.0, 0.0], and 'z' returns [0.0, 0.0, 1.0].
 *
 * @param {string} v - The string to convert to a vector.
 * @returns {number[]} The converted vector.
 */
function string2vector(v) {
    if (typeof v === 'string') {
        v = v.toLowerCase();
        if (v[0] === '-') {
            return string2vector(v.slice(1)).map(x => -x);
        }
        let w = [0, 0, 0];
        w['xyz'.indexOf(v)] = 1.0;
        return w;
    }
    return v;
}

/**
 * Rotates a matrix based on a vector and an angle, or two vectors. Inspired by the ASE Atoms rotate method.
 *
 * @param {Array} M - The matrix to rotate.
 * @param {number|Array} a - The angle that the matrix is rotated around the vector 'v'. 'a'
 * can also be a vector and then 'a' is rotated into 'v'. Angles are in degrees!
 * @param {string|Array} v - Vector to rotate the matrix around. Vectors can be given as
 * strings: 'x', '-x', 'y', ... .
 *
 * @throws {Error} If the norm of the vector 'v' or 'a' is zero, or if a valid rotation axis cannot be found.
 *
 * @example
 * // Rotate 90 degrees around the z-axis, so that the x-axis is
 * // rotated into the y-axis:
 * M = mjs.diag([1, 1, 1]); // Identity matrix
 * rotate([M, 90, 'z');   // Returns [[0, 1, 0], [-1, 0, 0], [0, 0, 1]]
 * rotate([M, 'x', 'y']); // Returns [[0, 1, 0], [-1, 0, 0], [0, 1, 1]]
 * rotate([M, [1, 0, 0], [0, 1, 0]]); // Returns [[0, 1, 0], [-1, 0, 0], [0, 0, 1]]
 
 * rotate([M, -90, 'z');   // Returns [[0, -1, 0], [1, 0, 0], [0, 0, 1]]
 * rotate([M, 90, '-z');   // Returns [[0, -1, 0], [1, 0, 0], [0, 0, 1]]
 * 
 * @returns {Array} The rotated matrix.
 * 
 */
function rotate_matrix(M, a, v) {

    if (typeof a !== 'number') {
        [a, v] = [v, a];
    }

    v = string2vector(v);
    let normv = mjs.norm(v);

    if (normv === 0.0) {
        throw new Error('Cannot rotate: norm(v) == 0');
    }

    let c, s;
    if (typeof a === 'number') {
        a *= Math.PI / 180;
        v = v.map(x => x / normv);
        c = Math.cos(a);
        s = Math.sin(a);
    } else {
        let v2 = string2vector(a);
        v = v.map(x => x / normv);
        let normv2 = mjs.norm(v2);
        if (normv2 === 0) {
            throw new Error('Cannot rotate: norm(v) == 0');
        }
        v2 = v2.map(x => x / normv2);
        c = mjs.dot(v, v2);
        v = mjs.cross(v, v2);
        s = mjs.norm(v);
        if (s < 1e-7) {
            v = mjs.cross([0, 0, 1], v2);
            if (mjs.norm(v) < 1e-7) {
                v = mjs.cross([1, 0, 0], v2);
            }
            if (mjs.norm(v) < 1e-7) {
                throw new Error('Cannot find a valid rotation axis');
            }
        } else if (s > 0) {
            v = v.map(x => x / s);
        }
    }

    // Return a copy of M with the rotation applied
    return M.map(cell => {
        let crossProduct = mjs.cross(cell, v.map(x => x * s));
        let dotProduct = mjs.dot(cell, v);
        return cell.map((x, i) => c * x - crossProduct[i] + dotProduct * (1.0 - c) * v[i]);
    });
}

// Euler angle to rotation matrix conversion
function euler2rot(euler_angles, convention) {
    convention = convention.toUpperCase();
    const alpha = euler_angles[0];
    const beta = euler_angles[1];
    const gamma = euler_angles[2];


    const Rx = mjs.matrix([
        [1, 0, 0],
        [0, mjs.cos(alpha), -mjs.sin(alpha)],
        [0, mjs.sin(alpha), mjs.cos(alpha)],
      ]);
    
      const Ry = mjs.matrix([
        [mjs.cos(beta), 0, mjs.sin(beta)],
        [0, 1, 0],
        [-mjs.sin(beta), 0, mjs.cos(beta)],
      ]);
    
      const Rz = mjs.matrix([
        [mjs.cos(gamma), -mjs.sin(gamma), 0],
        [mjs.sin(gamma), mjs.cos(gamma), 0],
        [0, 0, 1],
      ]);

    // Apply the rotation in the correct order
    let rotation;
    if (convention === 'ZYZ') {
        rotation = mjs.multiply(mjs.multiply(Rz, Ry), Rz);
    }
    else if (convention === 'ZXZ') {
        rotation = mjs.multiply(mjs.multiply(Rz, Rx), Rz);
    }
    else {
        throw new Error('Invalid Euler angle convention');
    }

    // return as a normal array
    return rotation.toArray();
}



function tryallanglestest(euler_angles, pas1, pasv2, arel1, convention, eps = 1e-3) {
    // eps to number of decimal places
    const n_decimals = Math.ceil(Math.pow(10, -eps));
    // Make a copy of the input angles
    let euler_angles_out = [...euler_angles];
    let rrel_check = mjs.matrix(euler2rot(euler_angles, convention));
    let mcheck = mjs.round(mjs.multiply(mjs.multiply(rrel_check, pas1), mjs.inv(rrel_check)), 14);

    // Define the ways in which the angles should be updated
    let [alpha, beta, gamma] = euler_angles;
    let updates = [
        () => [alpha + Math.PI, beta, gamma],
        () => [2 * Math.PI - alpha, Math.PI - beta, gamma + Math.PI],
        () => [Math.PI - alpha, Math.PI - beta, gamma + Math.PI],
    ];

    // Check if pasv2[0] is approximately equal to pasv2[1]
    if (mjs.deepEqual(mjs.round(pasv2[0], n_decimals), mjs.round(pasv2[1], n_decimals))) {
        // Iterate over the updates, updating only if the angles don't match
        for (let update of updates) {
            if (!mjs.deepEqual(mjs.round(arel1, n_decimals), mjs.round(mcheck, n_decimals))) {
                let [alpha_out, beta_out, gamma_out] = update();
                [euler_angles_out, mcheck] = _compute_rotation([alpha_out, beta_out, gamma_out], arel1, pas1, convention, 1);
            } else {
                break; // If the angles match, we're done
            }
        }

        // If the last condition is still true, print a message
        if (!mjs.deepEqual(mjs.round(arel1, n_decimals), mjs.round(mcheck, n_decimals))) {
            throw new Error('Failed isequal check at (_tryallanglestest) please contact the developers for help to resolve this issue.');
        }
    }

    return euler_angles_out;
}

// Placeholder for the _compute_rotation function
function _compute_rotation(euler_angles, arel1, pas1, convention, rotation_type) {
    let rrel_check = mjs.matrix(euler2rot(euler_angles, convention));
    let mcheck = mjs.round(mjs.multiply(mjs.multiply(rrel_check, pas1), mjs.inv(rrel_check)), 14);

    let component1, component2, component3, component4, euler_convention;

    if (rotation_type === 1) {
        component1 = arel1[2][0] + arel1[2][1] * mcheck[2][1] / mcheck[2][0];
        component2 = mcheck[2][0] + mcheck[2][1] * mcheck[2][1] / mcheck[2][0];
        component3 = arel1[2][1] - arel1[2][0] * mcheck[2][1] / mcheck[2][0];
        component4 = mcheck[2][0] + mcheck[2][1] * mcheck[2][1] / mcheck[2][0];
        euler_convention = "ZYZ";
    } else if (rotation_type === 2) {
        component1 = arel1[2][0] + arel1[1][0] * mcheck[1][0] / mcheck[2][0];
        component2 = mcheck[2][0] + mcheck[1][0] * mcheck[1][0] / mcheck[2][0];
        component3 = arel1[2][0] - arel1[1][0] * mcheck[2][0] / mcheck[1][0];
        component4 = mcheck[1][0] + mcheck[2][0] * mcheck[2][0] / mcheck[1][0];
        euler_convention = "ZXZ";
    }

    let symrotang_check = Math.atan2(component3 / component4, component1 / component2);
    let symrot_check = mjs.matrix(euler2rot([0, 0, symrotang_check], euler_convention));
    mcheck = mjs.multiply(mjs.multiply(symrot_check, mcheck), mjs.inv(symrot_check));

    return [euler_angles, mcheck];
}


/**
 * Lexicographically sorts the rows of an NxM array based on their elements.
 * 
 * @param {Array<Array<number>>} array - The NxM array to sort.
 * @param {number} tolerance - The tolerance value for comparison.
 * @returns {Array<Array<number>>} - The sorted NxM array.
 */
function lexSortRows(array, tolerance) {
    if (!Array.isArray(array) || array.length === 0 || !Array.isArray(array[0])) {
        throw new Error('Input must be a non-empty NxM array');
    }
    const sortFunction = (a, b) => {
        for (let i = 0; i < a.length; i++) {
            const diff = a[i] - b[i];
            if (Math.abs(diff) > tolerance) {
                return diff;
            }
        }
        return 0;
    };

    return array.map(row => [...row]).sort(sortFunction);
}


// Helper function to compare two arrays of arrays that may be in different order
// i.e. the rows can be swapped, but not the elements in each row
export const deepAlmostEqualUnordered = (arr1, arr2, tolerance = 1e-3) => {
    if (arr1.length !== arr2.length) return false;

    const sortedArr1 = lexSortRows(arr1, tolerance);
    const sortedArr2 = lexSortRows(arr2, tolerance);
    for (let i = 0; i < sortedArr1.length; i++) {
        for (let j = 0; j < sortedArr1[i].length; j++) {
            if (Math.abs(sortedArr1[i][j] - sortedArr2[i][j]) > tolerance) {
                return false;
            }
        }
    }

    return true;
};



export {
    supercellGrid, supercellIndex, cellMatrix3, addStaticVar, shiftCpkColor, hashCode, floatEqual, arraysAlmostEqual,
    tensorDataToMatrix3, matrix3ToTensorData, string2vector, rotate_matrix, euler2rot, tryallanglestest
}

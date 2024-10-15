'use strict';


import * as chai from 'chai';
import chaiAlmost from 'chai-almost'

import * as mjs from 'mathjs'

import {
    supercellGrid,
    arraysAlmostEqual,
    rotate_matrix
} from '../lib/utils.js'

chai.use(chaiAlmost(1e-3));

const expect = chai.expect;

const PI = mjs.pi;


describe('utils', function() {

    it('supercellGrid', function() {
        let grid = supercellGrid([2, 2, 2]);
        expect(grid).to.deep.equal([
            [0, 0, 0],
            [0, 0, 1],
            [0, 1, 0],
            [0, 1, 1],
            [1, 0, 0],
            [1, 0, 1],
            [1, 1, 0],
            [1, 1, 1],
        ]);
    });


    it('arraysAlmostEqual', function() {
        expect(arraysAlmostEqual([1, 2, 3], [1, 2, 3])).to.be.true;
        expect(arraysAlmostEqual([1, 2, 3], [1, 2, 4])).to.be.false;
        expect(arraysAlmostEqual([1, 2, 3], [1, 2])).to.be.false;
    });

    it('arraysAlmostEqual with tolerance', function() {
        expect(arraysAlmostEqual([1, 2, 3], [1, 2, 3.001], 0.01)).to.be.true;
        expect(arraysAlmostEqual([1, 2, 3], [1, 2, 3.001], 0.0001)).to.be.false;
        const A = [
            [ 1, 6.12323399573676e-17, 8.572527594031472e-16 ],
            [ 6.12323399573676e-17, 2, 4.898587196589412e-16 ],
            [ 8.572527594031472e-16, 4.898587196589412e-16, -6 ]
            ];
        const B = [
            [ 1, 0, 0 ],
            [ 0, 2, 0 ],
            [ 0, 0, -6 ]
            ];
        expect(arraysAlmostEqual(A, B, 1e-12)).to.be.true;
        // expect(arraysAlmostEqual(A, B, 1e-17)).to.be.false;
    });


});


describe('rotate_matrix', function() {
    const M = mjs.diag([1, 1, 1]);
    const N = [
        [1,0.25,0.1],
        [0.5,2,0],
        [0.5,0,3]
    ]; // more general matrix
    it('should rotate a matrix by a specific angle around a specific axis', function() {
        expect(arraysAlmostEqual(rotate_matrix(M, 90, 'x'), [[1, 0, 0], [0, 0, 1], [0, -1, 0]], 1e-12)).to.be.true;
        expect(arraysAlmostEqual(rotate_matrix(M, 90, 'z'), [[0, 1, 0], [-1, 0, 0], [0, 0, 1]], 1e-12)).to.be.true;
        expect(arraysAlmostEqual(rotate_matrix(M, 90, '-z'), [[0, -1, 0], [1, 0, 0], [0, 0, 1]], 1e-12)).to.be.true;
        expect(arraysAlmostEqual(rotate_matrix(M, -90, 'z'), [[0, -1, 0], [1, 0, 0], [0, 0, 1]], 1e-12)).to.be.true;

        // more general matrix
        expect(arraysAlmostEqual(rotate_matrix(N, 90, 'z'), [
            [-0.25, 1, 0.1],
            [-2, 0.5, 0],
            [0, 0.5, 3]
        ], 1e-12)).to.be.true;
    });
    
    it('should rotate a matrix so that one vector maps onto another', function() {
        const a = [0, 0, 1]; // this one
        const v = [0, 1, 0]; // should become this one
        const result = rotate_matrix(M, a, v);
        expect(arraysAlmostEqual(result, [[1, 0, 0], [0, 0, -1], [0, 1, 0]], 1e-12)).to.be.true;
        expect(arraysAlmostEqual(rotate_matrix(M, 'x', 'y'), [[0, 1, 0], [-1, 0, 0], [0, 0, 1]], 1e-12)).to.be.true;
        expect(arraysAlmostEqual(rotate_matrix(M, '-x', 'y'), [[0, -1, 0], [1, 0, 0], [0, 0, 1]], 1e-12)).to.be.true;
        expect(arraysAlmostEqual(rotate_matrix(M, 'x', '-y'), [[0, -1, 0], [1, 0, 0], [0, 0, 1]], 1e-12)).to.be.true;
    });

    it('should throw an error when rotating a matrix with a zero vector', function() {
        const a = 90;
        const v = [0,0,0];
        expect(() => rotate_matrix(M, a, v)).to.throw(Error, 'Cannot rotate: norm(v) == 0');
    });

    it('should throw an error when rotating a matrix with a zero angle', function() {
        const a = [0,0,0];
        const v = [0, 1, 0];
        expect(() => rotate_matrix(M, a, v)).to.throw(Error, 'Cannot rotate: norm(v) == 0');
    });

    it('should throw an error when rotating a matrix with a non-number angle', function() {
        const a = 'not a number';
        expect(() => rotate_matrix(M, a)).to.throw(Error);
    });

    it('should throw an error when rotating a matrix with a non-number vector', function() {
        const a = 90;
        const v = 'not a number';
        expect(() => rotate_matrix(M, a, v)).to.throw(Error);
    });
});
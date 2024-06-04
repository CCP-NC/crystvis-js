'use strict';


import * as chai from 'chai';
import chaiAlmost from 'chai-almost'

import * as mjs from 'mathjs'

import {
    supercellGrid,
    arraysAlmostEqual,
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
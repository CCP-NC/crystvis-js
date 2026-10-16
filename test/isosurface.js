'use strict';

import * as chai from 'chai';
import { IsosurfaceMesh } from '../lib/primitives/isosurface.js';

const expect = chai.expect;

describe('IsosurfaceMesh', function () {
    it('builds a mesh from a scalar field', function () {
        const n = 12;
        const field = [];
        for (let x = 0; x < n; ++x) {
            field.push([]);
            for (let y = 0; y < n; ++y) {
                field[x].push([]);
                for (let z = 0; z < n; ++z) {
                    field[x][y].push(Math.hypot(x - n / 2, y - n / 2, z - n / 2));
                }
            }
        }
        const cell = [[5, 0, 0], [0, 5, 0], [0, 0, 5]];
        const iso = new IsosurfaceMesh(field, 3, cell);
        expect(iso.geometry.getAttribute('position').count).to.be.above(0);
    });
});

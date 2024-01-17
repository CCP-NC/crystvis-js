'use strict';

import * as chai from 'chai';
import chaiAlmost from 'chai-almost'

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url';

import { Loader } from '../lib/loader.js'

const expect = chai.expect
const __dirname = path.dirname(fileURLToPath(import.meta.url));


chai.use(chaiAlmost(1e-3));

describe('#loading', function() {
    it('should load properly an XYZ file', function() {

        var loader = new Loader();

        var xyz = fs.readFileSync(path.join(__dirname, 'data', 'pyridine.xyz'), "utf8");
        var a = loader.load(xyz, 'xyz')['xyz'];

        expect(a.get_chemical_symbols()).to.deep.equal(['C', 'C', 'C', 'N', 'C', 'C',
            'H', 'H', 'H', 'H', 'H'
        ]);
    });
    it('should load properly an extended XYZ file', function() {

        var loader = new Loader();

        var xyz = fs.readFileSync(path.join(__dirname, 'data', 'si8.xyz'), "utf8");
        var a = loader.load(xyz, 'xyz')['xyz'];

        expect(a.get_cell()).to.deep.almost.equal([
            [5.44, 0, 0],
            [0, 5.44, 0],
            [0, 0, 5.44]
        ]);
        expect(a.get_array('spin')).to.deep.equal([1, 0, 0, 0, 0, 0, 0, 0]);
    });
    it('should load properly a CIF file', function() {

        var loader = new Loader();

        var cif = fs.readFileSync(path.join(__dirname, 'data', 'org.cif'), "utf8");
        var a = loader.load(cif)['1501936'];


        chai.expect(a.get_cell()).to.deep.almost.equal([
            [8.2302, 0.0, 0.0],
            [1.7507207912272031, 8.096583378263006, 0.0],
            [1.7848106706548383, 1.959874486240255, 12.914460443940394]
        ]);
    });
    it ('should load a noisy .xyz file', function() {

        var loader = new Loader();

        var xyz = fs.readFileSync(path.join(__dirname, 'data', 'si8_noisy.xyz'), "utf8");
        var a = loader.load(xyz, 'xyz')['xyz'];

        expect(a.get_cell()).to.deep.almost.equal([
            [5.475, 0, 0],
            [0, 5.475, 0],
            [0, 0, 5.475]
        ]);
    });

    it('should load properly a Magres file', function() {

        var loader = new Loader();

        var magres = fs.readFileSync(path.join(__dirname, 'data', 'ethanol.magres'), "utf8");
        var a = loader.load(magres, 'magres')['magres'];

        expect(loader.status).to.equal(Loader.STATUS_SUCCESS);
        expect(a.length()).to.equal(9);
        // Parsing positions
        expect(a.get_positions()[0]).to.deep.equal([2.129659, 2.823711, 2.349943]);
        // Susceptibility
        expect(a.info.sus.data).to.deep.equal([[1,0,0],[0,1,0],[0,0,1]]);
        // Shielding
        expect(a.get_array('ms')[4].data).to.deep.equal([
            [25.946849893, -2.77588906551, 3.75442739434],
            [-1.77463107727, 29.7225814726, -0.398037457666],
            [3.04599241075, -1.46601607492, 26.5018075671]
        ]);
        // Version
        expect(a.info['magres-version']).to.equal('1.0');

        // Test for failure
        loader.load('Something', 'magres');
        expect(loader.error_message).to.equal('Invalid Magres file format: no version line');

        loader.load('#$magres-abinitio-v1.0\n[block]\n[another]', 'magres');
        expect(loader.error_message).to.equal('Invalid Magres file format: block opened without closing');

    });
    it('should load properly a CELL file', function() {

        var loader = new Loader();

        var cell = fs.readFileSync(path.join(__dirname, 'data', 'ethanol.cell'), "utf8");
        var a = loader.load(cell, 'cell')['cell'];

        expect(a.get_cell()).to.almost.deep.equal([[6,0,0],[0,6,0],[0,0,6]]);
        expect(a.get_chemical_symbols()).to.deep.equal(['H', 'H', 'H', 'H', 'H', 'H', 'C', 'C', 'O']);
        expect(a.get_positions()[0]).to.almost.deep.equal([2.129659, 2.823711, 2.349943]);
        
        // Test an example with ABC lattice and FRAC positions
        cell = fs.readFileSync(path.join(__dirname, 'data', 'frac.cell'), "utf8");
        a = loader.load(cell, 'cell')['cell'];

        expect(a.get_cell()).to.almost.deep.equal([[10.0, 0, 0], [10.0, 10.0, 0], [0, 0, 10.0]]);
        expect(a.get_positions()[0]).to.almost.deep.equal([10.0, 5.0, 5.0]);


        // Test an example with ABC lattice and ABS positions but with bohr units
        cell = fs.readFileSync(path.join(__dirname, 'data', 'bohr.cell'), "utf8");
        a = loader.load(cell, 'cell')['cell'];

        expect(a.get_cell()).to.almost.deep.equal([[3.7042404756, 0, 0], [0, 3.7042404756, 0], [0, 0, 3.7042404756]]);
        expect(a.get_positions()[1]).to.almost.deep.equal([1.8521202378, 0.0, 0.0]);
    });
});
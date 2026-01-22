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
        
        // Check that positions were loaded correctly
        expect(a.length()).to.equal(11);
        expect(a.get_positions()[0]).to.deep.almost.equal([-0.180226841, 0.360945118, -1.120304970]);
        
        // Check cell
        expect(a.get_cell()).to.deep.almost.equal([
            [10, 0, 0],
            [0, 10, 0],
            [0, 0, 10]
        ]);
        
        // Check that info contains the label
        expect(a.info.Label).to.equal('Pyridine molecule (source: Wikipedia)');
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
        expect(a.length()).to.equal(8);
        expect(a.get_chemical_symbols()[0]).to.equal('Si');
    });

    it('should load all frames from a multi-frame extended XYZ file and be robust to blank lines', function() {
        var loader = new Loader();
        var xyz = fs.readFileSync(path.join(__dirname, 'data', 'ethanol_with_tensors.xyz'), "utf8");

        // Frame 0 (first)
        var a0 = loader.load(xyz, 'xyz', null, { index: 0 })['xyz'];
        expect(a0.length()).to.equal(9);
        expect(a0.get_chemical_symbols()[0]).to.equal('C');
        expect(a0.get_positions()[0]).to.deep.almost.equal([0.05539939, -0.60057807, 0.62649405]);
        
        // Check that ms tensors were loaded as TensorData objects
        expect(a0.get_array('ms')).to.have.lengthOf(9);
        expect(a0.get_array('ms')[0]).to.have.property('data');
        expect(a0.get_array('ms')[0].data).to.deep.almost.equal([
            [125.81813960, -9.69204056, 1.47151834],
            [-9.69204056, 152.57296730, -15.37444798],
            [1.47151834, -15.37444798, 153.40518054]
        ]);

        // Frame 1 (second)
        var a1 = loader.load(xyz, 'xyz', null, { index: 1 })['xyz'];
        expect(a1.length()).to.equal(9);
        expect(a1.get_positions()[0]).to.deep.almost.equal([-0.40320021, -0.45122528, 0.73024166]);
        expect(a1.get_array('ms')[0].data).to.deep.almost.equal([
            [132.90497460, 3.59552794, -12.43391876],
            [3.59552794, 127.77706275, -12.28247854],
            [-12.43391876, -12.28247854, 148.26339821]
        ]);

        // Frame 2 (third)
        var a2 = loader.load(xyz, 'xyz', null, { index: 2 })['xyz'];
        expect(a2.length()).to.equal(9);
        expect(a2.get_positions()[0]).to.deep.almost.equal([-0.69807410, -0.44723904, 0.24317208]);
        expect(a2.get_array('ms')[0].data).to.deep.almost.equal([
            [152.92455307, 16.26391385, -4.26821306],
            [16.26391385, 125.77540629, -16.76320152],
            [-4.26821306, -16.76320152, 130.73689699]
        ]);
        
        // Check a different atom in frame 2
        expect(a2.get_array('ms')[8].data).to.deep.almost.equal([
            [15.18096611, -3.57189977, -7.34818913],
            [-3.57189977, 25.05233266, -0.90280873],
            [-7.34818913, -0.90280873, 24.27668518]
        ]);

        // Default (should be last frame)
        var a_last = loader.load(xyz, 'xyz')['xyz'];
        expect(a_last.get_array('ms')[0].data).to.deep.almost.equal([
            [152.92455307, 16.26391385, -4.26821306],
            [16.26391385, 125.77540629, -16.76320152],
            [-4.26821306, -16.76320152, 130.73689699]
        ]);

        // Robustness: insert blank lines between frames and test again
        // add blank line before each frame (match only counts at start of line)
        var xyz_blank = xyz.replace(/^9\n/gm, '\n9\n');
        var a_blank = loader.load(xyz_blank, 'xyz', null, { index: 1 })['xyz'];
        expect(a_blank.get_array('ms')[0].data).to.deep.almost.equal([
            [132.90497460, 3.59552794, -12.43391876],
            [3.59552794, 127.77706275, -12.28247854],
            [-12.43391876, -12.28247854, 148.26339821]
        ]);
    });
    
    it('should handle negative frame indices correctly', function() {
        var loader = new Loader();
        var xyz = fs.readFileSync(path.join(__dirname, 'data', 'ethanol_with_tensors.xyz'), "utf8");
        
        // -1 should be last frame (frame 2)
        var a_neg1 = loader.load(xyz, 'xyz', null, { index: -1 })['xyz'];
        expect(a_neg1.get_array('ms')[0].data[0][0]).to.almost.equal(152.92455307);
        
        // -2 should be second-to-last frame (frame 1)
        var a_neg2 = loader.load(xyz, 'xyz', null, { index: -2 })['xyz'];
        expect(a_neg2.get_array('ms')[0].data[0][0]).to.almost.equal(132.90497460);
        
        // -3 should be first frame (frame 0)
        var a_neg3 = loader.load(xyz, 'xyz', null, { index: -3 })['xyz'];
        expect(a_neg3.get_array('ms')[0].data[0][0]).to.almost.equal(125.81813960);
    });
    
    it('should load properly a simple XYZ file with multiple atoms', function() {
        var loader = new Loader();
        var xyz = fs.readFileSync(path.join(__dirname, 'data', 'H2O.xyz'), "utf8");
        var a = loader.load(xyz, 'xyz')['xyz'];
        
        expect(a.length()).to.equal(6);
        expect(a.get_chemical_symbols()).to.deep.equal(['O', 'H', 'H', 'O', 'H', 'H']);
        expect(a.get_positions()[0]).to.deep.almost.equal([0.0, 0.0, 0.11926200]);
        expect(a.get_cell()).to.deep.almost.equal([
            [10, 0, 0],
            [0, 10, 0],
            [0, 0, 10]
        ]);
    });
    
    it('should load properly a file with periodic boundary conditions across cell', function() {
        var loader = new Loader();
        var xyz = fs.readFileSync(path.join(__dirname, 'data', 'H2_bound.xyz'), "utf8");
        var a = loader.load(xyz, 'xyz')['xyz'];
        
        expect(a.length()).to.equal(2);
        expect(a.get_chemical_symbols()).to.deep.equal(['H', 'H']);
        expect(a.get_positions()[0]).to.deep.almost.equal([0.2, 0.2, 0.2]);
        expect(a.get_positions()[1]).to.deep.almost.equal([9.8, 9.8, 9.8]);
    });
    
    it('should load a noisy .xyz file', function() {

        var loader = new Loader();

        var xyz = fs.readFileSync(path.join(__dirname, 'data', 'si8_noisy.xyz'), "utf8");
        var a = loader.load(xyz, 'xyz')['xyz'];

        expect(a.get_cell()).to.deep.almost.equal([
            [5.475, 0, 0],
            [0, 5.475, 0],
            [0, 0, 5.475]
        ]);
        
        // Check that it loaded the right number of atoms
        expect(a.length()).to.equal(8);
        
        // Check that initial_magmoms were loaded (all zeros)
        expect(a.get_array('initial_magmoms')).to.deep.almost.equal([0, 0, 0, 0, 0, 0, 0, 0]);
        
        // Check that castep_labels were loaded (all "NULL")
        expect(a.get_array('castep_labels')).to.deep.equal(['NULL', 'NULL', 'NULL', 'NULL', 'NULL', 'NULL', 'NULL', 'NULL']);
    });
    
    it('should throw an error for files without a lattice', function() {
        var loader = new Loader();
        
        // Create a plain XYZ file without Extended XYZ format
        var plain_xyz = `3
water molecule
O 0.0 0.0 0.0
H 1.0 0.0 0.0
H 0.0 1.0 0.0`;
        
        expect(() => loader.load(plain_xyz, 'xyz')).to.throw('No unit cell (Lattice property) found');
    });
    
    it('should throw an error for invalid frame indices', function() {
        var loader = new Loader();
        var xyz = fs.readFileSync(path.join(__dirname, 'data', 'ethanol_with_tensors.xyz'), "utf8");
        
        // Frame index too high
        expect(() => loader.load(xyz, 'xyz', null, { index: 10 })).to.throw('Frame index out of range');
        
        // Frame index too low (negative)
        expect(() => loader.load(xyz, 'xyz', null, { index: -10 })).to.throw('Frame index out of range');
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
'use strict';

/** 
 * @fileoverview Class for loading different types of input files
 * @module 
 */

import * as CIF from './formats/cif.js';
import * as XYZ from './formats/xyz.js';
import * as Magres from './formats/magres.js';
import * as CELL from './formats/cell.js';

import { addStaticVar } from './utils.js';

/**
 * Loader - Object used to load various file types into Atoms objects and
 * store any status and error messages resulting from failure.
 */
class Loader {

    constructor() {
        this._status = Loader.STATUS_UNUSED;
        this._error = '';
    }

    get status() {
        return this._status;
    }

    get error_message() {
        return this._error;
    }

    /** Load file from its contents and format 
     *
     * @param  {String} contents    File contents
     * @param  {String} format      File extension
     * @param  {String} filename    Name of the file. If provided, this will be
     *                              added as a prefix to all the names in the dictionary
     *
     * @return {Object}             Dictionary of parsed structure(s)
     */
    load(contents, format='cif', filename=null) {

        const parsers = {
            cif: CIF,
            xyz: XYZ,
            magres: Magres,
            cell: CELL
        };

        format = format.toLowerCase();

        if (!(format in parsers)) {
            throw Error('Invalid file format');
        }

        this._error = '';

        let structs;

        try {
            if (filename)
                structs = parsers[format].load(contents, filename);
            else 
                structs = parsers[format].load(contents);
        } catch (err) {
            this._status = Loader.STATUS_ERROR;
            this._error = err.message || err;
            return;
        }

        this._status = Loader.STATUS_SUCCESS;

        return structs;
    }
}

// Define static properties old style, for better compatibility
addStaticVar(Loader, 'STATUS_UNUSED', -1);
addStaticVar(Loader, 'STATUS_SUCCESS', 0);
addStaticVar(Loader, 'STATUS_ERROR', 1);


export {
    Loader
}
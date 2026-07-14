'use strict';

/**
 * @fileoverview Function for loading Magres files in JSON format
 * @module
 */

import Ajv from 'ajv';
import { PeriodicTable } from 'mendeleev';
import {
    Atoms
} from '@ccp-nc/crystcif-parse';
import {
    TensorData
} from '../tensor.js';
import {
    MagresUnits
} from './magres.js';
import schema from '../../schemas/magres.json' with { type: 'json' };

const validateSchema = new Ajv({ allErrors: true, strict: false }).compile(schema);
const properties = {
    ms: { tensor: 'sigma', references: ['atom'] },
    efg: { tensor: 'V', references: ['atom'] },
    isc: { tensor: 'K', references: ['atom1', 'atom2'] },
    sus: { tensor: null, references: [] },
    hf: { tensor: 'A', references: ['atom'] }
};

function fail(path, message) {
    throw new Error('Invalid magres-json at ' + path + ': ' + message);
}

function propertyType(tag) {
    return Object.keys(properties).find(type => tag === type || tag.startsWith(type + '_'));
}

function unitMap(units, name) {
    const result = {};
    units.forEach(([tag, unit], index) => {
        if (result[tag] !== undefined) {
            fail('/' + name.replace('.', '/') + '/' + index, 'duplicates unit for ' + tag);
        }
        result[tag] = unit;
    });
    return result;
}

function validate(data) {
    if (!validateSchema(data)) {
        const error = validateSchema.errors[0];
        fail(error.instancePath || '/', error.message);
    }

    const atomUnits = unitMap(data.atoms.units, 'atoms.units');
    for (const tag of ['lattice', 'atom']) {
        const unit = atomUnits[tag];
        if (!unit) {
            fail('/atoms/units', 'missing unit for ' + tag);
        }
        if (MagresUnits.length[unit] === undefined) {
            fail('/atoms/units', 'unknown unit ' + unit + ' for ' + tag);
        }
    }

    const atomReferences = new Map();
    data.atoms.atom.forEach((atom, index) => {
        const [element, ...suffix] = atom.species.split(':');
        if (!element || suffix.some(value => !value) || !PeriodicTable.getElement(element)) {
            fail('/atoms/atom/' + index + '/species', 'must begin with a valid element symbol');
        }
        const reference = atom.label + '\u0000' + atom.index;
        if (atomReferences.has(reference)) {
            fail('/atoms/atom/' + index, 'duplicate atom reference (' + atom.label + ', ' + atom.index + ')');
        }
        atomReferences.set(reference, index);
    });

    if (!data.magres) {
        return atomReferences;
    }

    const magresUnits = unitMap(data.magres.units || [], 'magres.units');
    for (const [tag, entries] of Object.entries(data.magres)) {
        const type = propertyType(tag);
        if (!type) {
            continue;
        }
        const definition = properties[type];
        const unit = magresUnits[tag];
        if (!unit) {
            fail('/magres/units', 'missing unit for ' + tag);
        }
        if (MagresUnits[type][unit] === undefined) {
            fail('/magres/units', 'unknown unit ' + unit + ' for ' + tag);
        }

        const assignments = new Set();
        const records = type === 'sus' ? [entries] : entries;
        records.forEach((record, index) => {
            const path = '/magres/' + tag + (type === 'sus' ? '' : '/' + index);
            const references = definition.references.map(key => {
                const value = record[key];
                const reference = value.label + '\u0000' + value.index;
                if (!atomReferences.has(reference)) {
                    fail(path + '/' + key, 'does not reference an atom in /atoms/atom');
                }
                return reference;
            });
            const assignment = type === 'isc' ? references.slice().sort().join('\u0000') : references.join('\u0000');
            if (assignments.has(assignment)) {
                fail(path, 'duplicates a tensor assignment');
            }
            assignments.add(assignment);
        });
    }
    return atomReferences;
}

/**
 * Load a Magres file from its JSON representation.
 *
 * @param  {String|Object} contents  JSON string or parsed object
 * @param  {String}        filename  Name to use for the returned structure
 * @return {Object}                  Dictionary of parsed structure(s)
 */
function load(contents, filename='magres-json') {
    let data;
    try {
        data = typeof contents === 'string' ? JSON.parse(contents) : contents;
    } catch (error) {
        fail('/', 'invalid JSON: ' + error.message);
    }

    const atomReferences = validate(data);
    const cell = data.atoms.lattice[0];
    const elems = [];
    const pos = [];
    const labels = [];
    const mlabels = [];

    for (const atom of data.atoms.atom) {
        elems.push(atom.species.split(':')[0]);
        pos.push(atom.position);
        labels.push(atom.label);
        mlabels.push([atom.label, atom.index]);
    }

    const atoms = new Atoms(elems, pos, cell, {
        'magres-version': data.version,
        'magres-blocks': {
            atoms: data.atoms,
            magres: data.magres,
            calculation: data.calculation
        }
    });
    atoms.set_array('labels', labels);
    atoms.set_array('magres-labels', mlabels);

    const N = elems.length;
    if (data.magres) {
        for (const [tag, entries] of Object.entries(data.magres)) {
            const type = propertyType(tag);
            if (!type) {
                continue;
            }
            const definition = properties[type];
            if (type === 'sus') {
                atoms.info[tag] = new TensorData(entries);
            } else if (type === 'isc') {
                const tagData = Array.from({ length: N }, () => new Array(N));
                entries.forEach(entry => {
                    const i1 = atomReferences.get(entry.atom1.label + '\u0000' + entry.atom1.index);
                    const i2 = atomReferences.get(entry.atom2.label + '\u0000' + entry.atom2.index);
                    const tensor = new TensorData(entry[definition.tensor]);
                    tagData[i1][i2] = tensor;
                    tagData[i2][i1] = tensor;
                });
                atoms.set_array(tag, tagData);
            } else {
                const tagData = new Array(N);
                entries.forEach(entry => {
                    const index = atomReferences.get(entry.atom.label + '\u0000' + entry.atom.index);
                    tagData[index] = new TensorData(entry[definition.tensor]);
                });
                atoms.set_array(tag, tagData);
            }
        }
        if (data.magres.gyromagnetic_ratios) {
            atoms.info['hf-gyromagnetic-ratios'] = data.magres.gyromagnetic_ratios;
        }
    }

    return { [filename]: atoms };
}

export {
    load
};

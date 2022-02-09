'use strict';

/** 
 * @fileoverview Class holding "model views", subsets of atoms in a Model used
 * for selection or to perform operations in block
 * @module 
 */

import _ from 'lodash';

/** A 'view' representing a subset of atom images of a model, used for selection and further manipulations */
class ModelView {

    /**
     * @param  {Model}  model   Model to use for the view
     * @param  {int[]}  indices Indices of the atom images to include in the view
     */
    constructor(model, indices) {

        this._model = model;
        this._indices = indices;
        this._images = _.map(indices, function(i) {
            return model._atom_images[i];
        });

        this._bonds = {};
        for (var i = 0; i < this._images.length; ++i) {
            var img = this._images[i];
            var bonds = img.bonds;
            for (var j = 0; j < bonds.length; ++j) {
                var b = bonds[j];
                this._bonds[b.key] = b;
            }
        }

        this._bonds = Object.values(this._bonds);
    }

    /**
     * Model used by this view
     * @readonly
     * @type {Model}
     */
    get model() {
        return this._model;
    }

    /**
     * Indices of the atom images in this view
     * @readonly
     * @type {int[]}
     */
    get indices() {
        return Array.from(this._indices);
    }

    /**
     * Atom images in this view
     * @readonly
     * @type {AtomImage[]}
     */
    get atoms() {
        return Array.from(this._images);
    }

    /**
     * Number of atom images in this view
     * @readonly
     * @type {int}
     */
    get length() {
        return this._indices.length;
    }

    // Operations on the selected atoms
    // Visibility
    
    /**
     * Make all atoms in the view visible. Can be chained
     * @return {ModelView}
     */
    show() {
        this._model._setAtomsProperty(this._images, 'visible', true);
        return this;
    }

    /**
     * Make all atoms in the view invisible. Can be chained
     * @return {ModelView}
     */
    hide() {
        this._model._setAtomsProperty(this._images, 'visible', false);
        return this;
    }

    /**
     * Run a function on each AtomImage, returning an Array of the results.
     * 
     * @param  {Function}   func    Function to run, should take AtomImage and
     *                              index as arguments
     *                              
     * @return {Array}              Return values
     */
    map(func) {
        var returns = [];
        for (var i = 0; i < this.length; ++i) {
            returns.push(func(this._images[i], i));
        }
        return returns;
    }

    /**
     * Perform a further search within the atoms included in this ModelView.
     * 
     * @param  {Array}   query    Query for the search, formatted as for 
     *                            the Model.find function.
     *                              
     * @return {ModelView}        Result of the query
     */
    find(query) {
        var found = this._model._qparse.parse(query);
        return new ModelView(this._model,
            _.intersectionWith(this._indices, found));
    }

    // Logical operations with another ModelView
    /**
     * Intersection with another ModelView
     * @param  {ModelView} mview    Other view
     * @return {ModelView}          Result
     */
    and(mview) {
        if (this._model != mview._model)
            throw 'The two ModelViews do not refer to the same Model';
        return new ModelView(this._model,
            _.intersectionWith(this._indices, mview._indices));
    }

    /**
     * Union with another ModelView
     * @param  {ModelView} mview    Other view
     * @return {ModelView}          Result
     */
    or(mview) {
        if (this._model != mview._model)
            throw 'The two ModelViews do not refer to the same Model';
        return new ModelView(this._model,
            _.unionWith(this._indices, mview._indices));
    }

    /**
     * Exclusive OR with another ModelView
     * @param  {ModelView} mview    Other view
     * @return {ModelView}          Result
     */
    xor(mview) {
        if (this._model != mview._model)
            throw 'The two ModelViews do not refer to the same Model';
        return new ModelView(this._model,
            _.xorWith(this._indices, mview._indices));
    }

    /**
     * Complement to this ModelView
     * @return {ModelView}          Result
     */
    not() {
        var indices = _.xorWith(this._indices, _.range(this._model._atom_images.length));
        return new ModelView(this._model, indices);
    }

    /**
     * Internal function used to turn a single value, array of values, or
     * function into an array of values
     * @private
     */
    _standardValueArray(value) {

        if (_.isFunction(value)) {
            value = this.map(value);
        } else if (!(value instanceof Array)) {
            value = Array(this.length).fill(value);
        }

        return Array.from(value);
    }

    /**
     * Set some property of the atoms within the ModelView. 
     *
     * @param {String}              name    Name of the property to set
     * @param {int|Array|function}  value   Value to set for the atoms. It can
     *                                      be either:
     *                                      
     *                                      1. a single value for all of them
     *                                      2. an Array of values as long as
     *                                      the ModelView
     *                                      3. a function that accepts an 
     *                                      AtomImage and an index and returns
     *                                      a value
     *
     *                                      If left empty, the property is 
     *                                      restored to its default value.
     */
    setProperty(name, value=null) {

        if (name[0] == '_') {
            // Assignment of hidden properties not supported!
            throw 'Can not assign a value to hidden properties';
        }

        value = this._standardValueArray(value);

        for (var i = 0; i < this.length; ++i) {
            var v = value[i];
            var aimg = this._images[i];
            aimg[name] = v;
        }

        return this;
    }

    /**
     * Add labels to the atom images in this ModelView
     * 
     * @param {String | String[] | Function}    text    Text of the labels,
     *                                                  as single value, array,
     *                                                  or function returning a
     *                                                  string for each atom image.
     * @param {String | String[] | Function}    name    Name of the label
     * @param {Object | Object[] | Function}    args    Arguments for creating the label
     */
    addLabels(text, name = 'label', args = {}) {

        // Defaults
        if (!text) {
            text = function(a) {
                return a.element;
            }
        }

        text = this._standardValueArray(text);
        name = this._standardValueArray(name);
        args = this._standardValueArray(args);

        for (var i = 0; i < this.length; ++i) {
            var aimg = this._images[i];
            aimg.addLabel(String(text[i]), name[i], args[i]);
        }

        return this;
    }

    /**
     * Remove labels from the atom images in this ModelView
     * 
     * @param {String | String[] | Function}    name    Name of the labels to remove
     */
    removeLabels(name = 'label') {

        name = this._standardValueArray(name);

        for (var i = 0; i < this.length; ++i) {
            var aimg = this._images[i];
            aimg.removeLabel(name[i]);
        }

        return this;
    }

    /**
     * Get or set labels' properties for the atom images in this ModelView
     * 
     * @param {String | String[] | Function}    name        Name of the labels
     * @param {String | String[] | Function}    property    Property to get or set
     * @param {Any | Any[] | Function}          value       If not provided, get. If provided,
     *                                                      set this value
     */
    labelProperties(name = 'label', property = 'color', value = null) {

        name = this._standardValueArray(name);
        property = this._standardValueArray(property);

        var ans = null;
        if (value !== null) {
            value = this._standardValueArray(value);
            ans = [];
        }

        for (var i = 0; i < this.length; ++i) {
            var aimg = this._images[i];
            if (value !== null) {
                aimg.labelProperty(name[i], property[i], value[i]);
            } else {
                ans.push(aimg.labelProperty(name[i], property[i]));
            }
        }

        if (value === null)
            return ans;
        else
            return this;
    }

    /**
     * Add ellipsoids to the atom images in this ModelView
     * 
     * @param {Object | Object[] | Function}    data    Data to use for the ellipsoid
     *                                                  (see AtomImage.addEllipsoid for details)
     * @param {String | String[] | Function}    name    Name of the ellipsoids
     * @param {Object | Object[] | Function}    args    Arguments for creating the ellipsoids
     */
    addEllipsoids(data, name = 'ellipsoid', args = {}) {

        data = this._standardValueArray(data);
        name = this._standardValueArray(name);
        args = this._standardValueArray(args);

        for (var i = 0; i < this.length; ++i) {
            var aimg = this._images[i];
            aimg.addEllipsoid(data[i], name[i], args[i]);
        }

        return this;
    }

    /**
     * Remove ellipsoids from the atom images in this ModelView
     * 
     * @param {String | String[] | Function}    name    Name of the ellipsoids to remove
     */
    removeEllipsoids(name = 'ellipsoid') {

        name = this._standardValueArray(name);

        for (var i = 0; i < this.length; ++i) {
            var aimg = this._images[i];
            aimg.removeEllipsoid(name[i]);
        }

        return this;
    }

    /**
     * Get or set ellipsoids' properties for the atom images in this ModelView
     * 
     * @param {String | String[] | Function}    name        Name of the ellipsoids
     * @param {String | String[] | Function}    property    Property to get or set
     * @param {Any | Any[] | Function}          value       If not provided, get. If provided,
     *                                                      set this value
     */
    ellipsoidProperties(name = 'ellipsoid', property = 'color', value = null) {

        name = this._standardValueArray(name);
        property = this._standardValueArray(property);

        var ans = null;
        if (value !== null) {
            value = this._standardValueArray(value);
            ans = [];
        }

        for (var i = 0; i < this.length; ++i) {
            var aimg = this._images[i];
            if (value !== null) {
                aimg.ellipsoidProperty(name[i], property[i], value[i]);
            } else {
                ans.push(aimg.ellipsoidProperty(name[i], property[i]));
            }
        }

        if (value === null)
            return ans;
        else
            return this;
    }

}

export {
    ModelView
}
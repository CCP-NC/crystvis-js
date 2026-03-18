'use strict';

/**
 * @fileoverview Class constituting the main object that plots crystals in the webpage
 * @module
 */

import * as _ from 'lodash';

import {
    Renderer as Renderer
} from './render.js';
// themes
import {themes} from './render.js';
import {
    Loader as Loader
} from './loader.js';
import {
    Model as Model
} from './model.js';
import {
    ModelView as ModelView
} from './modelview.js';
import {
    AtomMesh
} from './primitives/index.js';
import {
    addStaticVar
} from './utils.js';


const model_parameter_defaults = {
    supercell: [1, 1, 1],
    molecularCrystal: false
};

/** An object providing a full interface to a renderer for crystallographic models */
class CrystVis {

    /**
     * An object providing a full interface to a renderer for crystallographic 
     * models
     * @class
     * @param {string}  element     CSS-style identifier for the HTML element to 
     *                              put the renderer in
     * @param {int}     width       Window width
     * @param {int}     height      Window height. If both this and width are
     *                              set to 0, the window fits its context and
     *                              automatically resizes with it
     * @param {Object}  rendererOptions     Options for the renderer
     */
    constructor(element, width = 0, height = 0, rendererOptions = {}) {

        // Create a renderer
        this._renderer = new Renderer(element, width, height, rendererOptions);
        this._loader = new Loader();

        this._models = {};

        this._current_model = null;
        this._current_mname = null;
        this._displayed = null;
        this._selected = null;
        this._notifications = [];

        // Handling events
        this._atom_click_events = {};
        this._atom_click_events[CrystVis.LEFT_CLICK] = this._defaultAtomLeftClick.bind(this);
        this._atom_click_events[CrystVis.LEFT_CLICK + CrystVis.SHIFT_BUTTON] = this._defaultAtomShiftLeftClick.bind(this);
        this._atom_click_events[CrystVis.LEFT_CLICK + CrystVis.CTRL_BUTTON] = this._defaultAtomCtrlLeftClick.bind(this);

        this._atom_click_defaults = _.cloneDeep(this._atom_click_events);

        this._atom_box_event = this._defaultAtomBox.bind(this);

        this._renderer.addClickListener(this._handleAtomClick.bind(this),
            this._renderer._groups.model, AtomMesh);
        this._renderer.addSelBoxListener(this._handleAtomBox.bind(this),
            this._renderer._groups.model, AtomMesh);

        // Additional options
        // Hidden (need dedicated setters)
        this._hsel = false; // If true, highlight the selected atoms

        // Vanilla (no get/set needed)
        this.cifsymtol = 1e-2; // Parameter controlling the tolerance to symmetry when loading CIF files

        // Disposal state
        this._isDisposed = false;

        // Model source / parameter / metadata stores (keyed by model name)
        this._model_sources = {};     // { text, extension }
        this._model_parameters = {};  // parameters passed to loadModels / reloadModel
        this._model_meta = {};        // { prefix, originalName }

        // Lifecycle / camera-change callbacks
        this._model_list_change_cbs = [];
        this._display_change_cbs    = [];
        this._camera_change_cbs     = [];

        // Subscribe to camera changes from the renderer
        this._camera_unsub = this._renderer.onCameraChange((state) => {
            this._camera_change_cbs.forEach(cb => cb(state));
        });

    }

    /**
     * Whether this instance has been disposed.
     * Once true, most methods will throw rather than silently fail.
     * @readonly
     * @type {boolean}
     */
    get isDisposed() {
        return this._isDisposed;
    }

    /**
     * List of loaded models
     * @readonly
     * @type {Array}
     */
    get modelList() {
        return Object.keys(this._models);
    }

    /**
     * Currently loaded model
     * @readonly
     * @type {Model}
     */
    get model() {
        return this._current_model;
    }

    /**
     * Name of the currently loaded model
     * @readonly
     * @type {String}
     */
    get modelName() {
        return this._current_mname;
    }

    /**
     * Displayed atoms
     * @type {ModelView}
     */
    get displayed() {
        return this._displayed;
    }

    set displayed(d) {
        if (!(d instanceof ModelView)) {
            throw new Error('.displayed must be set with a ModelView');
        }
        this._displayed.hide();
        this._displayed = d;
        this._displayed.show();
    }

    /**
     * Selected atoms
     * @type {ModelView}
     */
    get selected() {
        return this._selected;
    }

    set selected(s) {
        if (!(s instanceof ModelView)) {
            throw new Error('.selected must be set with a ModelView');
        }
        this._selected.setProperty('highlighted', false);
        this._selected = s;
        this._selected.setProperty('highlighted', this._hsel);
    }

    /** Whether the selected atoms should be highlighted with auras
     *  @type {bool} 
     */
    get highlightSelected() {
        return this._hsel;
    }

    set highlightSelected(hs) {
        this._hsel = hs;
        if (this._selected) {
            this._selected.setProperty('highlighted', this._hsel);
        }
    }

    get notifications() {
        return this._notifications;
    }

    set notifications(n) {
        this._notifications = n;
    }


    /** Theme
     * @type {object}
     */
    get theme() {
        return this._renderer.theme;
    }

    set theme(t) {
        // if t is a string, try to find the corresponding theme
        // from the list of themes
        if (typeof t === 'string') {
            if (themes[t]) {
                t = themes[t];
            } else {
                throw new Error('Theme ' + t + ' not found');
            }
        }
        this._renderer.theme = t;
    }

    // ─── Individual appearance properties ────────────────────────────────────────
    // Convenience API that lets callers change one visual property at a time
    // without having to construct a full theme object.

    /**
     * Background colour of the scene.
     * Accepts any value supported by THREE.Color (hex integer, CSS string, …).
     * @type {number|string}
     */
    get background() { return this._renderer.background; }
    set background(c) { this._renderer.background = c; }

    /**
     * Colour of the aura rendered around highlighted atoms.
     * Stored inside the active theme; use `vis.highlightSelected = true` to
     * make highlighted atoms display the aura.
     * @type {number|string}
     */
    get highlightColor() { return this._renderer.highlightColor; }
    set highlightColor(c) { this._renderer.highlightColor = c; }

    /**
     * Default colour used for atom text labels created by `view.addLabels()`.
     * @type {number|string}
     */
    get labelColor() { return this._renderer.labelColor; }
    set labelColor(c) { this._renderer.labelColor = c; }

    /**
     * Colour of the unit-cell wireframe box.
     * Changes take effect the next time a model is displayed; call
     * `reloadModel()` to apply retroactively to the current model.
     * @type {number|string}
     */
    get cellLineColor() { return this._renderer.cellLineColor; }
    set cellLineColor(c) { this._renderer.cellLineColor = c; }

    /**
     * Background colour of the drag-selection box overlay.
     * @type {number|string}
     */
    get selboxBkgColor() { return this._renderer.selbox_bkg_color; }
    set selboxBkgColor(c) { this._renderer.selbox_bkg_color = c; }

    /**
     * Border colour of the drag-selection box overlay.
     * @type {number|string}
     */
    get selboxBorderColor() { return this._renderer.selbox_border_color; }
    set selboxBorderColor(c) { this._renderer.selbox_border_color = c; }

    /**
     * Opacity of the drag-selection box overlay (0–1).
     * @type {number}
     */
    get selboxOpacity() { return this._renderer.selbox_opacity; }
    set selboxOpacity(o) { this._renderer.selbox_opacity = o; }

    // ─── Lighting API ─────────────────────────────────────────────────────────────

    /**
     * Set the intensity of the ambient (scene-wide) light.
     *
     * @param {number} intensity  Intensity value (default scene value is 0.3)
     */
    setAmbientLight(intensity) {
        this._renderer.setAmbientLight(intensity);
    }

    /**
     * Set the intensity and/or direction of the primary directional light.
     * Pass `null` for any direction component to leave that component unchanged.
     *
     * The secondary fill light is always kept at
     * `SECONDARY_LIGHT_INTENSITY_RATIO × intensity` pointing in the opposite
     * direction.
     *
     * @param {number}      intensity   Intensity value (default scene value is 0.6)
     * @param {number|null} px          Direction X component (null = unchanged)
     * @param {number|null} py          Direction Y component (null = unchanged)
     * @param {number|null} pz          Direction Z component (null = unchanged)
     */
    setDirectionalLight(intensity, px = null, py = null, pz = null) {
        this._renderer.setDirectionalLight(intensity, px, py, pz);
    }

    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Set a callback function for an event where a user clicks on an atom. The
     * function should take as arguments the atom image for the clicked atom and
     * the event object:
     *
     * function callback(atom, event) {
     *     ...
     * }
     *
     * @param  {Function}   callback    Callback function for the event. Passing "null" restores default behaviour
     * @param  {int}        modifiers   Click event. Use the following flags to define it:
     *
     * * CrystVis.LEFT_CLICK
     * * CrystVis.RIGHT_CLICK
     * * CrystVis.MIDDLE_CLICK
     * * CrystVis.CTRL_BUTTON
     * * CrystVis.ALT_BUTTON
     * * CrystVis.SHIFT_BUTTON
     * * CrystVis.CMD_BUTTON
     *
     * For example, CrystVis.LEFT_CLICK + CrystVis.SHIFT_BUTTON
     * defines the event for a click while the Shift key is pressed.
     *                                            
     */
    onAtomClick(callback = null, modifiers = CrystVis.LEFT_CLICK) {

        // Check that event makes sense
        var lc = modifiers & CrystVis.LEFT_CLICK;
        var mc = modifiers & CrystVis.MIDDLE_CLICK;
        var rc = modifiers & CrystVis.RIGHT_CLICK;

        if (lc + mc + rc == 0) {
            throw 'Can not set event without any click type';
        }
        if ((lc && mc) || (lc && rc) || (mc && rc)) {
            throw 'Can not set event with two or more click types';
        }

        if (callback)
            this._atom_click_events[modifiers] = callback.bind(this);
        else
            this._atom_click_events[modifiers] = this._atom_click_defaults[modifiers];
    }

    /**
     * Set a callback function for an event where a user drags a box around multiple atoms. 
     * The function should take as arguments a ModelView including the atoms in the box:
     *
     * function callback(view) {
     *     ...
     * }
     * 
     * @param  {Function} callback Callback function for the event. Passing "null" restores default behaviour
     */
    onAtomBox(callback = null) {
        if (callback)
            this._atom_box_event = callback;
        else
            this._atom_box_event = this._defaultAtomBox.bind(this);
    }

    // ─── Private event emitters ─────────────────────────────────────────────────

    _emitModelListChange() {
        const names = Object.keys(this._models);
        this._model_list_change_cbs.forEach(cb => cb(names));
    }

    _emitDisplayChange() {
        this._display_change_cbs.forEach(cb => cb(this._current_mname));
    }

    // ─── Camera state API ────────────────────────────────────────────────────────

    /**
     * Return a plain serialisable snapshot of the current camera state.
     *
     * @return {{ position: {x,y,z}, target: {x,y,z}, zoom: number }}
     */
    getCameraState() {
        return this._renderer.getCameraState();
    }

    /**
     * Restore a camera snapshot produced by {@link CrystVis#getCameraState}.
     * Safe to call after `displayModel()`.
     *
     * @param {{ position?: {x,y,z}, target?: {x,y,z}, zoom?: number }} state
     */
    setCameraState(state) {
        this._renderer.setCameraState(state);
    }

    /**
     * Subscribe to camera-change events (rotate, pan, zoom).
     * The callback receives a snapshot identical to {@link CrystVis#getCameraState}.
     *
     * @param  {Function} callback  `callback(cameraState)`
     * @return {Function}           Unsubscribe function
     */
    onCameraChange(callback) {
        this._camera_change_cbs.push(callback);
        return () => {
            this._camera_change_cbs = this._camera_change_cbs.filter(cb => cb !== callback);
        };
    }

    // ─── Lifecycle event APIs ────────────────────────────────────────────────────

    /**
     * Subscribe to model-list change events (model added or deleted).
     * The callback receives the new list of model names.
     *
     * @param  {Function} callback  `callback(modelNames: string[])`
     * @return {Function}           Unsubscribe function
     */
    onModelListChange(callback) {
        this._model_list_change_cbs.push(callback);
        return () => {
            this._model_list_change_cbs = this._model_list_change_cbs.filter(cb => cb !== callback);
        };
    }

    /**
     * Subscribe to display-change events fired whenever `displayModel()` completes.
     * The callback receives the name of the newly displayed model (or `null` when cleared).
     *
     * @param  {Function} callback  `callback(modelName: string|null)`
     * @return {Function}           Unsubscribe function
     */
    onDisplayChange(callback) {
        this._display_change_cbs.push(callback);
        return () => {
            this._display_change_cbs = this._display_change_cbs.filter(cb => cb !== callback);
        };
    }

    // ─── Model source / parameter / metadata APIs ────────────────────────────────

    /**
     * Return the raw file text and format extension originally passed to
     * `loadModels()` for the named model.
     *
     * @param  {String} name  Model name
     * @return {{ text: string, extension: string }|null}
     */
    getModelSource(name) {
        const src = this._model_sources[name];
        return src ? { ...src } : null;
    }

    /**
     * Return the loading parameters that were used when the named model was
     * last loaded / reloaded (a clone of the merged parameter object).
     *
     * @param  {String} name  Model name
     * @return {Object|null}
     */
    getModelParameters(name) {
        const p = this._model_parameters[name];
        return p ? JSON.parse(JSON.stringify(p)) : null;
    }

    /**
     * Return metadata stored alongside the named model:
     * `{ prefix, originalName }`.
     *
     * @param  {String} name  Model name
     * @return {{ prefix: string, originalName: string }|null}
     */
    getModelMeta(name) {
        const m = this._model_meta[name];
        return m ? { ...m } : null;
    }

    // ─── Atomic unload ───────────────────────────────────────────────────────────

    /**
     * Remove *all* loaded models and reset the view in a single atomic operation
     * (only one render pass after everything is cleared, unlike calling
     * `deleteModel()` in a loop).
     */
    unloadAll() {
        if (this._isDisposed) {
            throw new Error('CrystVis: cannot call unloadAll() on a disposed instance');
        }

        // Clear the displayed model (handles renderer.clear(), selection reset, etc.)
        // displayModel() with no args also emits _emitDisplayChange()
        this.displayModel();

        this._models           = {};
        this._model_sources    = {};
        this._model_parameters = {};
        this._model_meta       = {};

        this._emitModelListChange();
    }

    // ─── Internal atom-click/box defaults ────────────────────────────────────────

    _defaultAtomLeftClick(atom, event) {
        var i = atom.imgIndex;
        this.selected = new ModelView(this._current_model, [i]);
    }
    _defaultAtomShiftLeftClick(atom, event) {
        var i = atom.imgIndex;
        this.selected = this.selected.or(new ModelView(this._current_model, [i]));
    }
    _defaultAtomCtrlLeftClick(atom, event) {
        var i = atom.imgIndex;
        this.selected = this.selected.xor(new ModelView(this._current_model, [i]));
    }

    _defaultAtomBox(view) {
        this.selected = this.selected.xor(view);
        console.log(view);
    }

    // Callback for when atoms are clicked
    _handleAtomClick(alist, event) {

        if (alist.length == 0) {
            return;
        }

        let clicked = alist[0].image;

        let modifiers = [CrystVis.LEFT_CLICK, CrystVis.MIDDLE_CLICK, CrystVis.RIGHT_CLICK][event.button];

        modifiers += event.shiftKey * CrystVis.SHIFT_BUTTON;
        modifiers += (event.ctrlKey || event.metaKey) * CrystVis.CTRL_BUTTON;
        modifiers += event.altKey * CrystVis.ALT_BUTTON;

        var callback = this._atom_click_events[modifiers];

        if (callback)
            callback(clicked, event);

    }

    // Callback for a whole box dragged over atoms
    _handleAtomBox(alist) {

        var indices = alist.map(function(a) {
            return a.image.imgIndex;
        });

        var callback = this._atom_box_event;

        if (callback)
            callback(new ModelView(this._current_model, indices));
    }

    /**
     * Center the camera on a given point
     * 
     * @param  {float[]}  center Point in model space that the orbiting camera
     *                           should be centred on and look at
     * @param  {float[]}  shift  Shift (in units of width/height of the canvas) with
     *                           which the center of the camera should be rendered with
     *                           respect to the center of the canvas
     */
    /**
     * Release all resources held by this instance: cancels the animation loop,
     * removes all canvas event listeners, disposes OrbitControls and the
     * THREE.WebGLRenderer, and nulls internal references.  After calling this
     * method the instance must not be used again.
     */
    dispose() {
        if (this._isDisposed) {
            return;
        }
        this._isDisposed = true;

        // Unsubscribe camera-change listener before tearing down the renderer
        if (this._camera_unsub) {
            this._camera_unsub();
            this._camera_unsub = null;
        }

        // Tear down the renderer (animation loop, orbit controls, WebGL context)
        if (this._renderer) {
            this._renderer.dispose();
            this._renderer = null;
        }

        // Drop model and view references
        this._current_model = null;
        this._current_mname = null;
        this._displayed = null;
        this._selected = null;
        this._models = {};
        this._model_sources = {};
        this._model_parameters = {};
        this._model_meta = {};

        // Drop event callbacks
        this._atom_click_events = {};
        this._atom_click_defaults = {};
        this._atom_box_event = null;
        this._notifications = [];
        this._model_list_change_cbs = [];
        this._display_change_cbs    = [];
        this._camera_change_cbs     = [];
    }

    centerCamera(center = [0, 0, 0], shift = [0, 0]) {
        const renderer = this._renderer;

        renderer.resetOrbitCenter(center[0], center[1], center[2]);
        renderer.resetCameraCenter(shift[0], shift[1]);
    }

    /**
     * Load one or more atomic models from a file's contents
     * 
     * @param  {String} contents    The contents of the structure file
     * @param  {String} format      The file's format (cif, xyz, etc.). Default is cif.
     * @param  {String} prefix      Prefix to use when naming the models. Default is empty.
     * @param  {Object} parameters  Loading parameters:
     * 
     *  - `supercell`: supercell size (only used if the structure is periodic)
     *  - `molecularCrystal`: if true, try to make the model load completing molecules across periodic boundaries
     *  - `useNMRActiveIsotopes`: if true, all isotopes are set by default to the most common one with non-zero spin
     *  - `vdwScaling`: scale van der Waals radii by a constant factor
     *  - `vdwElementScaling`: table of per-element factors to scale VdW radii by
     *                                          
     * @return {Object}             Status map of the models we tried to load. Keys are the model names (strings that can be
     *                              passed directly to `displayModel()`). Values are `0` for a successful load, or an error
     *                              message string if loading failed. Example: to display the first loaded model, use
     *                              `visualizer.displayModel(Object.keys(loaded)[0])` and check
     *                              `loaded[modelName] !== 0` to detect errors.
     */
    loadModels(contents, format = 'cif', prefix = null, parameters = {}) {
        if (this._isDisposed) {
            throw new Error('CrystVis: cannot call loadModels() on a disposed instance');
        }
        // clear existing notifications
        this.clearNotifications();

        parameters = _.merge(model_parameter_defaults, parameters);

        // By default, it's cif
        format = format.toLowerCase();

        // By default, same as the format
        prefix = prefix || format;

        var structs = this._loader.load(contents, format, prefix);

        var status = {};

        if (this._loader.status == Loader.STATUS_ERROR) {
            status[prefix] = this._loader.error_message;
            // display error notification to user
            this.addNotification('Error loading model: '+ prefix);
            this.addNotification(this._loader.error_message);            
            return status;
        }

        // Now make unique names
        for (var n in structs) {
            var iter = 0;
            var coll = true;
            var nn = n;
            while (coll) {
                nn = n + (iter > 0 ? '_' + iter : '');
                coll = nn in this._models;
                iter++;
            }
            var s = structs[n];
            if (!s) {
                status[nn] = 'Model could not load properly';
                this.addNotification('Model '+ nn + ' could not load properly');
                continue;
            }
            this._models[nn] = new Model(s, parameters);
            this._model_sources[nn]     = { text: contents, extension: format };
            this._model_parameters[nn]  = JSON.parse(JSON.stringify(parameters));
            this._model_meta[nn]        = { prefix: prefix, originalName: n };
            status[nn] = 0; // Success
        }

        this._emitModelListChange();
        return status;
    }

    /**
     * Reload a model, possibly with new parameters
     * 
     * @param  {String} name       Name of the model to reload.
     * @param  {Object} parameters Loading parameters as in .loadModels()
     */
    reloadModel(name, parameters = {}) {
        if (this._isDisposed) {
            throw new Error('CrystVis: cannot call reloadModel() on a disposed instance');
        }
        // clear existing notifications from scene
        this.clearNotifications();

        if (!(name in this._models)) {
            throw 'The requested model does not exist';
        }

        var current = (this._current_mname == name);
        if (current) {
            // Hide the model to reload it later
            this.displayModel();
        }

        var s = this._models[name]._atoms_base;
        parameters = _.merge(model_parameter_defaults, parameters);

        this._models[name] = new Model(s, parameters);
        this._model_parameters[name] = JSON.parse(JSON.stringify(parameters));

        if (current) {
            this.displayModel(name);
        }
    }

    /**
     * Render a model
     * 
     * @param  {String} name    Name of the model to display. If empty, just
     *                          clear the renderer window.
     */
    displayModel(name = null) {
        if (this._isDisposed) {
            throw new Error('CrystVis: cannot call displayModel() on a disposed instance');
        }

        if (this._current_model) {
            // clear notifications from previous model
            this.clearNotifications();
            this.selected = this._current_model.view([]);
            this._current_model.renderer = null;
            this._current_model = null;
            this._current_mname = null;
        }
        this._renderer.clear();

        if (!name) {
            // If called with nothing, just quit here
            this._emitDisplayChange();
            return;
        }

        // if the model isn't in this._models
        if (!(name in this._models) && Object.keys(this._models).length > 0) {
            // in case the model does not exist, reset the orbit
            this._renderer.resetOrbitCenter(5,5,5);
            this.addNotification('The requested model does not exist.')
            throw 'The requested model does not exist.';
        }

        var m = this._models[name];
        m.renderer = this._renderer;

        this._current_model = m;
        this._current_mname = name;

        this._displayed = m.find({
            'cell': [
                [0, 0, 0]
            ]
        });
        this._selected = new ModelView(m, []); // Empty

        // Set the camera in a way that will center the model
        var c = m.fracToAbs([0.5, 0.5, 0.5]);
        this._renderer.resetOrbitCenter(c[0], c[1], c[2]);

        this._displayed.show();
        this._emitDisplayChange();
    }

    /**
     * Erase a model from the recorded ones
     * 
     * @param  {String} name    Name of the model to delete
     */
    deleteModel(name) {

        if (!(name in this._models)) {
            throw 'The requested model does not exist!';
        }

        if (this._current_mname == name) {
            this.displayModel();
        }

        delete this._models[name];
        delete this._model_sources[name];
        delete this._model_parameters[name];
        delete this._model_meta[name];
        this._emitModelListChange();
    }

    /**
     * Add a primitive shape to the drawing
     * 
     * @param {THREE.Object3D} p    Primitive to add 
     */
    addPrimitive(p) {
        this._renderer.add(p);
    }

    /**
     * Remove a primitive shape from the drawing
     * 
     * @param {THREE.Object3D} p    Primitive to remove
     */
    removePrimitive(p) {
        this._renderer.remove(p);
    }

    /**
     * Add a notification to the list of notifications to be displayed
     */
    addNotification(n) {
        this._notifications.push(n);
        this.addNotifications();
    }

    /**
     * Adds all notifications to the drawing
     * 
     */
    addNotifications() {
        // remove displayed notifications 
        // (doesn't remove them from this._notifications)
        this._renderer.clearNotifications();
        // add full list of notifications
        this._renderer.addNotifications(this._notifications);
    }

    /**
     * Removes notifications from the drawing
     */
    clearNotifications() {
        this._notifications = [];
        this._renderer.clearNotifications();
    }
    
    /**
     * Recover a data URL of a PNG screenshot of the current scene
     * 
     * @return {String} A data URL of the PNG screenshot
     */
    getScreenshotData(transparent = true, scale_pixels = 3) {
        
        var renderer = this._renderer;
        // save current alpha and antialias settings
        var old_alpha = renderer._r.getClearAlpha();
        var old_PixelRatio = renderer._r.getPixelRatio();

        // set new alpha and antialias settings
        renderer._r.setClearAlpha(transparent ? 0 : 1);
        renderer._r.setPixelRatio(scale_pixels);

        // Force a render
        this._renderer._render();
        // Grab the data from the canvas
        var data = renderer._r.domElement.toDataURL();

        // restore old alpha and antialias settings
        renderer._r.setClearAlpha(old_alpha);
        renderer._r.setPixelRatio(old_PixelRatio);

        return data;
    }
}

addStaticVar(CrystVis, 'LEFT_CLICK', 1);
addStaticVar(CrystVis, 'MIDDLE_CLICK', 2);
addStaticVar(CrystVis, 'RIGHT_CLICK', 4);
addStaticVar(CrystVis, 'ALT_BUTTON', 8);
addStaticVar(CrystVis, 'CTRL_BUTTON', 16);
addStaticVar(CrystVis, 'CMD_BUTTON', 16); // Alias for Mac users
addStaticVar(CrystVis, 'SHIFT_BUTTON', 32);

export {
    CrystVis
}
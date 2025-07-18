'use strict';

/** 
 * @fileoverview Classes and methods for rendering using THREE.js
 * @module
 */

// NPM imports
import $ from 'jquery';
import _ from 'lodash';
import * as THREE from 'three';

// Internal imports
import {
    OrbitControls
} from './orbit.js';
import {
    SelectionBox,
    SelectionHelper
} from './selbox.js';

import * as Primitives from './primitives/index.js';

import {
    TextSprite
} from './primitives/index.js';

// Ratio of secondary directional light intensity to primary
const SECONDARY_LIGHT_INTENSITY_RATIO = 0.4;

// themes:
const themes = {
    dark: {
        background: 0x000000,
        foreground: 0xffffff,
        highlight: 0x00ff00,
        cell_line_color: 0xffffff,
        label_color: 0xffffff,

    },
    light: {
        background: 0xffffff,
        foreground: 0x000000,
        highlight: 0x00ff00,
        cell_line_color: 0x000000,
        label_color: 0x000000,
    }
}


class Renderer {

    /** 
     * An object representing the THREE.js graphical renderer for atomic models 
     * @class
     * @param {string}  target          CSS selector for the target HTML element in which to put the renderer
     * @param {int}     width           Desired width for the renderer
     * @param {int}     height          Desired height for the renderer. If both this and width are zero, automatically
     *                                  resizes with the container
     * @param {object}  options         Optional parameters for the WebGLRenderer
     */
    constructor(target, width, height, options = {}) {

        // Grab the target element
        this._div = $(target);
        this._autoResize = (width == 0) && (height == 0);

        this._w = width;
        this._h = height;
        this._updateSize();

        // combine options with defaults
        this._options = Object.assign({
            antialias: true,
            alpha: true,
        }, options);
        
        // Renderer
        this._r = new THREE.WebGLRenderer(this._options);
        this._r.autoClear = true;
        this._r.setPixelRatio(window.devicePixelRatio);
        this._r.setSize(this._w, this._h);
        this._div.append(this._r.domElement);

        // Scene
        this._s = new THREE.Scene();

        // Camera
        var ratio = this._w * 1.0 / this._h;
        this._depth = 1000; // For now we use a constant
        this._c = new THREE.OrthographicCamera(-20, 20,
            20 / ratio, -20 / ratio,
            0.1, 2 * this._depth);
        this._s.add(this._c);

        // Lights
        this._l = {}
        // Increase ambient light intensity to mimic older Three.js behavior
        this._l._amb = new THREE.AmbientLight(0xffffff, 0.3);
        this._l._amb.name = 'ambLight';
        // Add more intensity to directional light for better highlights
        this._l._dir = new THREE.DirectionalLight(0xffffff, 0.6);
        this._l._dir.position.set(0, 1, -1);
        this._l._dir.name = 'dirLight';
        // Add a second directional light from opposite direction for better illumination
        this._l._dir2 = new THREE.DirectionalLight(0xffffff, 0.3);
        this._l._dir2.position.set(0, -1, 1);
        this._l._dir2.name = 'dirLight2';
        this._s.add(this._l._amb); // Added to scene
        this._c.add(this._l._dir); // Added to camera (rotates with it)
        this._c.add(this._l._dir2); // Added to camera (rotates with it)

        // Controls
        this._oc = new OrbitControls(this._c, this._r.domElement);
        this.resetOrbitCenter(0, 0, 0);

        // Raycast for clicks
        this._rcastlist = [];
        this._r.domElement.addEventListener('pointerdown', this._raycastClick.bind(this));

        // Groups
        this._groups = {
            model: new THREE.Group(),
            primitives: new THREE.Group(),
            notifications: new THREE.Group(),
        };

        this._s.add(this._groups.model);
        this._s.add(this._groups.primitives);
        this._s.add(this._groups.notifications);

        // Selection box (multiple raycast)
        this._sboxlist = [];
        this._sbox = new SelectionBox(this._c, this._s);
        this._sboxhelp = new SelectionHelper(this._sbox, this, 'crystvis-selbox-helper');
        this._sboxhelp.selectOverCallback = this._selectBoxEnd.bind(this);

        // Color scheme
        this.theme = themes.dark;
        this._cell_x_color = 0xff0000;
        this._cell_y_color = 0x00ff00;
        this._cell_z_color = 0x0000ff;

        this.selbox_bkg_color = 0x1111aa;
        this.selbox_border_color = 0x5555dd;
        this.selbox_opacity = 0.5;

        // Set up the animation
        this._animate();

        // Resizing in case it's required
        if (this._autoResize) {
            this._resizeObs = new ResizeObserver(this._resize.bind(this)
                );
            this._resizeObs.observe(this._div[0]);
        }

    }

    _render() {
        this._r.render(this._s, this._c);
    }

    _animate() {
        requestAnimationFrame(this._animate.bind(this));
        this._render();
    }

    _updateSize() {
        this._w = this._w || this._div.innerWidth();
        this._h = this._h || this._div.innerHeight();
        this._offset = this._div.offset();
    }

    _resize() {
        // Resize event handler
        this._w = 0;
        this._h = 0;
        this._updateSize()
        this._r.setSize(this._w, this._h);

        var ratio = this._w * 1.0 / this._h;
        this._c.top = 20/ratio;
        this._c.bottom = -20/ratio;
        this._c.updateProjectionMatrix();
    }

    _raycastClick(e) {

        // We create a 2D vector
        var vector = this.documentToWorld(e.clientX, e.clientY);

        // We create a raycaster, which is some kind of laser going through your scene
        var raycaster = new THREE.Raycaster();
        // We apply two parameters to the 'laser', its origin (where the user clicked) 
        // and the direction (what the camera 'sees')
        raycaster.setFromCamera(vector, this._c);

        // We get all the objects the 'laser' find on its way (it returns an array containing the objects)
        for (var i = 0; i < this._rcastlist.length; ++i) {

            var func = this._rcastlist[i][0];
            var targ = this._rcastlist[i][1];
            var filter = this._rcastlist[i][2];

            targ = targ || this._s;
            var intersects = raycaster.intersectObjects(targ.children);

            var objects = [];
            for (var j = 0; j < intersects.length; ++j) {
                var o = intersects[j].object;
                if (!filter || intersects[j].object instanceof filter) {
                    objects.push(o);
                }
            }

            func(objects, e);

        }
    }

    _selectBoxEnd(p1, p2) {
        for (var i = 0; i < this._sboxlist.length; ++i) {
            var func = this._sboxlist[i][0];
            var targ = this._sboxlist[i][1];
            var filter = this._sboxlist[i][2];

            var selected = this._sbox.select(p1, p2, targ);

            selected = _.filter(selected, function(o) {
                return (!filter || o instanceof filter)
            });

            func(selected);
        }
    }

    /**
     * Draw list of notifications
     * @param {Array} messages - List of (strings) messages to display
     * @param {Object} parameters - Parameters for the messages
     * 
    */
    addNotifications(messages, parameters={}) {
        // TODO: adjust position of messages when camera is rotated
        // currently this is only correct when camera is looking down the z-axis
        //top of message should be the bottom left corner of the canvas
        var position = [this._c.left, this._c.bottom, this._c.near];
        // calculate height of messages
        const messages_height = 0.05 * messages.length;
        // todo: this should really be the x projection of the unit cell
        // rather than the length of the 0th unit cell vector
        // but it works for now...
        const xshift = this.getOrbitCenter().x * 2;
        const yshift = 0.05 * messages_height + this.getOrbitCenter().y + 0.5;
        const defaults = {
            position: position,
            height: messages_height,
            color: this.theme.label_color,
            faceCamera: true,
            fixScale: true,
            shift: [xshift,yshift,0.0],
            onOverlay: true,
        };

        parameters = _.merge(defaults, parameters);

        // add text sprite to scene
        // Create a TextSprite to hold the message
        var messageSprite = new TextSprite(messages.join('\n'), parameters);

        this._groups.notifications.add(messageSprite);
    }

    /**
     * Remove all notifications from the scene
    */
    clearNotifications() {
        this._groups.notifications.remove(...this._groups.notifications.children);
    }


    add(object, group = 'primitives') {
        if (!(this._groups[group].children.includes(object)))
            this._groups[group].add(object);
    }

    remove(object, group = 'primitives') {
        this._groups[group].remove(object);
    }

    /**
     * Add a listener for click events on a given group
     * 
     * @param {Function}    listener        Listener function. Will receive a list of objects, sorted by distance.
     * @param {THREE.Group} group           Group on which to detect clicks
     * @param {Function}    filtertype      If present, only pass objects of this class
     * 
     * @returns {Array}                     Reference to the created listener
     */
    addClickListener(listener, group, filtertype = null) {
        var cl = [listener, group, filtertype];
        this._rcastlist.push(cl);
        return cl;
    }

    /**
     * Remove a listener
     * @param {Array} cl                Reference to the listener to remove (as returned by addClickListener) 
     */
    removeClickListener(cl) {
        _.pull(this._rcastlist, cl);
    }

    /**
     * Add a listener for selection box events
     * 
     * @param {Function} listener           Listener function
     * @param {THREE.Group} group           Group on which to detect clicks
     * @param {Function}    filtertype      If present, only pass objects of this class
     *
     * @returns {Array}                     Reference to the created listener
     */
    addSelBoxListener(listener, group, filtertype = null) {
        var sbl = [listener, group, filtertype];
        this._sboxlist.push(sbl);
        return sbl;
    }

    /**
     * Remove a selection box listener
     * @param  {Array} sbl              Reference to the listener to remove (as returned by addSelBoxListener) 
     */
    removeSelBoxListener(sbl) {
        _.pull(this._sboxlist, sbl);
    }

    /**
     * Set properties of ambient light
     * 
     * @param {float} intensity     Intensity
     */
    setAmbientLight(intensity) {
        this._l._amb.intensity = intensity;
    }

    /**
     * Set properties of directional light
     * 
     * @param {float} intensity     Intensity
     * @param {float} px            Direction, x
     * @param {float} py            Direction, y
     * @param {float} pz            Direction, z
     */
    setDirectionalLight(intensity, px, py, pz) {
        px = px === null ? this._l._dir.position.x : px;
        py = py === null ? this._l._dir.position.y : py;
        pz = pz === null ? this._l._dir.position.z : pz;
        this._l._dir.intensity = intensity;
        this._l._dir.position.set(px, py, pz);
        
        // Automatically update the second light to maintain opposite direction
        if (this._l._dir2) {
            this._l._dir2.intensity = intensity * SECONDARY_LIGHT_INTENSITY_RATIO;
            this._l._dir2.position.set(-px, -py, -pz);
        }
    }

    /**
     * Reset the camera's view so its central axis is rendered
     * with an offset from the center of the canvas
     * 
     * @param  {float} fx   Horizontal offset in the canvas (in fraction of its width, -0.5 to 0.5)
     * @param  {float} fy   Vertical offset in the canvas (in fraction of its height, -0.5 to 0.5)
     */
    resetCameraCenter(fx=0, fy=0) {
        this._c.setViewOffset(this._w, this._h, -fx*this._w, -fy*this._h, 
                              this._w, this._h);
    }

    /**
     * Reset the camera so it orbits around a given point
     * 
     * @param  {float} x            X coordinate of the point
     * @param  {float} y            Y coordinate of the point
     * @param  {float} z            Z coordinate of the point
     */
    resetOrbitCenter(x=0, y=0, z=0) {
        this._oc.reset();

        var p = new THREE.Vector3(x, y, z);

        // difference between the oc target and the camera position
        var d = new THREE.Vector3();
        d.subVectors(this._c.position, this._oc.target);

        // if d is small, return (no need to move the camera)
        if (d.length() < 0.001) {
            d = new THREE.Vector3(0, 0, 1);

            this._oc.target= d;
            this._oc.update();
        }
        if (p.distanceTo(this._oc.target) > 0.001) {
            this._c.position.set(x, y, this._depth + 0.1);
            // this._oc.lookAlong(d);
            this._oc.target= p;
            this._oc.update();
        }
    }

    getOrbitCenter() {
        return this._oc.target;
    }


    /**
     * Remove all currently rendered objects.
     */
    clear(model = true, primitives = true) {
        if (model)
            this._groups.model.clear();
        if (primitives)
            this._groups.primitives.clear();
        // Reset camera position
        this._oc.reset();
    }

    /**
     * Convert coordinates in the dom element frame to coordinates in the world frame
     */
    documentToWorld(x, y) {
        // We create a 2D vector
        var vector = new THREE.Vector2();
        // We set its position where the user clicked and we convert it to a number between -1 & 1
        vector.set(
            2 * ((x - this._offset.left) / this._w) - 1,
            1 - 2 * ((y - this._offset.top) / this._h)
        );

        return vector;
    }

    // Style
    get selbox_bkg_color() {
        return this._selbox_bkg_color;
    }

    set selbox_bkg_color(c) {
        c = new THREE.Color(c).getStyle();
        this._selbox_bkg_color = c;
        this._sboxhelp.element.css({
            'background-color': c
        });
    }

    get selbox_border_color() {
        return this._selbox_border_color;
    }

    set selbox_border_color(c) {
        c = new THREE.Color(c).getStyle();
        this._selbox_border_color = c;
        this._sboxhelp.element.css({
            'border-color': c
        });
    }

    get selbox_opacity() {
        return this._selbox_opacity;
    }

    set selbox_opacity(o) {
        this._selbox_opacity = o;
        this._sboxhelp.element.css({
            'opacity': o
        });
    }

    // themes
    get theme() {
        return this._theme;
    }

    set theme(t) {
        this._theme = t;
        // background color
        this._r.setClearColor(t.background, 1);
        // Cell color scheme
        this._r._cell_line_color = t.cell_line_color;
        // labels
        this._label_color = t.label_color;

        


    }

    // This convenient wrapper is useful to keep the Primitives out of the Model's logic.
    // This way, we don't suffer problems when testing purely mathematical/logical stuff
    // by command line with mocha. Primitives are messy and don't build well for CLI with
    // esbuild, for some reason.
    get Primitives() {
        return Primitives;
    }

}

/**
 * Add a vector field representation to the model
 * 
 * @param {Array} points            List of origins for the vectors
 * @param {Array} vectors           Vectors to plot
 * @param {*} colors                Colors for each vector. Can be a single color, an array of colors, or a function that takes 
 *                                  origin, vector, and index, and returns a color.
 * @param {float} scale             Scaling factor
 * 
 * @returns {THREE.Group}           Rendered object
 */

/*
_addVectorField: function(points, vectors, colors, scale) {

    var N = points.length;
    if (vectors.length != N)
        throw 'Points and vectors arrays not matching for vector field';

    // We always reduce colors to a function with signature (p, v, i) but
    // it can also be an array or a single scalar.
    colors = colors || 0xffffff;
    switch (typeof colors) {
        case 'function':
            break;
        case 'object':
            if (colors.length != N)
                throw 'Colors array not matching for vector field';
            var colors_arr = colors.slice();
            colors = function(p, v, i) {
                return colors_arr[i];
            }
            break;
        default:
            var colors_val = colors;
            colors = function(p, v, i) {
                return colors_val;
            }
    }
    scale = scale || 1;

    var vfield = new THREE.Group();

    for (var i = 0; i < N; ++i) {
        var p = points[i];
        var v = vectors[i];
        var c = colors(p, v, i);
        var l = v.length();
        v.normalize();
        var arr = new THREE.ArrowHelper(v, p, l, c, 0.2 * l, 0.1 * l);
        vfield.add(arr);
    }

    this._g._plots.add(vfield);

    return vfield;
},

*/


export {
    Renderer,
    themes
};
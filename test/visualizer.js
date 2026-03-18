'use strict';

/**
 * Tests for CrystVis.dispose() and the isDisposed guard.
 *
 * These tests run in Node.js (no DOM / WebGL) by constructing a CrystVis
 * instance via Object.create so we can supply lightweight mock objects in
 * place of the real THREE.WebGLRenderer and OrbitControls.
 */

import * as chai from 'chai';
import { CrystVis } from '../lib/visualizer.js';

const expect = chai.expect;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the bare minimum mock Renderer that dispose() expects to find on
 * this._renderer.  Each call-count field starts at 0 so tests can assert
 * that the matching method was called exactly once.
 */
function makeMockRenderer() {
    const renderer = {
        _disposed: false,
        _disposeCalls: 0,
        _setCameraStateCalls: [],
        _cameraChangeHandlers: [],
        _cameraState: { position: { x: 0, y: 0, z: 10 }, target: { x: 0, y: 0, z: 0 }, zoom: 1 },

        // ── Appearance state ─────────────────────────────────────────────────
        theme: {
            background: 0x000000,
            foreground: 0xffffff,
            highlight: 0x00ff00,
            cell_line_color: 0xffffff,
            label_color: 0xffffff,
        },
        background:      0x000000,
        highlightColor:  0x00ff00,
        labelColor:      0xffffff,
        cellLineColor:   0xffffff,
        selbox_bkg_color:    0x1111aa,
        selbox_border_color: 0x5555dd,
        selbox_opacity:      0.5,

        // ── Lighting call-tracking ────────────────────────────────────────────
        _ambientLightCalls:     [],
        _directionalLightCalls: [],
        setAmbientLight(intensity) {
            this._ambientLightCalls.push(intensity);
        },
        setDirectionalLight(intensity, px, py, pz) {
            this._directionalLightCalls.push({ intensity, px, py, pz });
        },

        // ── Other methods ─────────────────────────────────────────────────────
        dispose() {
            this._disposed = true;
            this._disposeCalls++;
        },
        clear() {},
        addNotifications() {},
        clearNotifications() {},
        resetOrbitCenter() {},
        add() {},
        remove() {},
        getCameraState() {
            return Object.assign({}, this._cameraState,
                { position: Object.assign({}, this._cameraState.position),
                  target:   Object.assign({}, this._cameraState.target) });
        },
        setCameraState(state) {
            this._setCameraStateCalls.push(state);
            if (state) Object.assign(this._cameraState, state);
        },
        onCameraChange(cb) {
            this._cameraChangeHandlers.push(cb);
            return () => {
                this._cameraChangeHandlers =
                    this._cameraChangeHandlers.filter(h => h !== cb);
            };
        },
        /** Trigger all registered camera-change handlers (test helper). */
        _fireCameraChange() {
            const state = this.getCameraState();
            this._cameraChangeHandlers.forEach(h => h(state));
        },
    };
    return renderer;
}

/**
 * Return a CrystVis instance whose constructor has been bypassed so that
 * no DOM element or WebGL context is needed.  The internal _renderer is
 * replaced with the supplied mock (or a fresh mock if none is given).
 */
function makeMockVis(mockRenderer) {
    const r = mockRenderer || makeMockRenderer();

    // Bypass the real constructor to avoid DOM / WebGL requirements
    const vis = Object.create(CrystVis.prototype);

    vis._isDisposed = false;
    vis._renderer = r;
    vis._loader = { load() { return {}; } };
    vis._models = {};
    vis._current_model = null;
    vis._current_mname = null;
    vis._displayed = null;
    vis._selected = null;
    vis._notifications = [];
    vis._atom_click_events = {};
    vis._atom_click_defaults = {};
    vis._atom_box_event = null;
    vis._hsel = false;
    vis.cifsymtol = 1e-2;

    // New state added by this batch of features
    vis._model_sources    = {};
    vis._model_parameters = {};
    vis._model_meta       = {};
    vis._model_list_change_cbs = [];
    vis._display_change_cbs    = [];
    vis._camera_change_cbs     = [];
    // Wire the renderer's camera-change signal to the vis callback array,
    // mirroring what the real constructor does.
    vis._camera_unsub = r.onCameraChange((state) => {
        vis._camera_change_cbs.forEach(cb => cb(state));
    });

    return { vis, renderer: r };
}

// ---------------------------------------------------------------------------
// Tests: dispose()
// ---------------------------------------------------------------------------

describe('CrystVis#dispose', function () {

    it('should set isDisposed to true', function () {
        const { vis } = makeMockVis();
        expect(vis.isDisposed).to.be.false;
        vis.dispose();
        expect(vis.isDisposed).to.be.true;
    });

    it('should call renderer.dispose() exactly once', function () {
        const { vis, renderer } = makeMockVis();
        vis.dispose();
        expect(renderer._disposeCalls).to.equal(1);
    });

    it('should null the internal _renderer reference', function () {
        const { vis } = makeMockVis();
        vis.dispose();
        expect(vis._renderer).to.be.null;
    });

    it('should null _current_model and _current_mname', function () {
        const { vis } = makeMockVis();
        vis._current_mname = 'test';
        vis.dispose();
        expect(vis._current_model).to.be.null;
        expect(vis._current_mname).to.be.null;
    });

    it('should clear the _models map', function () {
        const { vis } = makeMockVis();
        vis._models = { a: {}, b: {} };
        vis.dispose();
        expect(Object.keys(vis._models)).to.have.length(0);
    });

    it('should clear model source / parameter / meta stores', function () {
        const { vis } = makeMockVis();
        vis._model_sources    = { a: { text: 'x', extension: 'cif' } };
        vis._model_parameters = { a: { supercell: [1,1,1] } };
        vis._model_meta       = { a: { prefix: 'cif', originalName: 'a' } };
        vis.dispose();
        expect(Object.keys(vis._model_sources)).to.have.length(0);
        expect(Object.keys(vis._model_parameters)).to.have.length(0);
        expect(Object.keys(vis._model_meta)).to.have.length(0);
    });

    it('should clear lifecycle and camera-change callback arrays', function () {
        const { vis } = makeMockVis();
        vis._model_list_change_cbs.push(() => {});
        vis._display_change_cbs.push(() => {});
        vis._camera_change_cbs.push(() => {});
        vis.dispose();
        expect(vis._model_list_change_cbs).to.have.length(0);
        expect(vis._display_change_cbs).to.have.length(0);
        expect(vis._camera_change_cbs).to.have.length(0);
    });

    it('should unsubscribe from renderer camera-change on dispose', function () {
        const { vis, renderer } = makeMockVis();
        // One handler was registered by makeMockVis wiring
        expect(renderer._cameraChangeHandlers).to.have.length(1);
        vis.dispose();
        expect(renderer._cameraChangeHandlers).to.have.length(0);
    });

    it('should clear atom event callbacks', function () {
        const { vis } = makeMockVis();
        vis._atom_click_events = { 1: () => {} };
        vis._atom_box_event = () => {};
        vis.dispose();
        expect(Object.keys(vis._atom_click_events)).to.have.length(0);
        expect(vis._atom_box_event).to.be.null;
    });

    it('should be idempotent: calling dispose() twice is harmless', function () {
        const { vis, renderer } = makeMockVis();
        vis.dispose();
        vis.dispose();
        // renderer.dispose() should only have been called the first time
        expect(renderer._disposeCalls).to.equal(1);
    });

});

// ---------------------------------------------------------------------------
// Tests: isDisposed guard
// ---------------------------------------------------------------------------

describe('CrystVis#isDisposed guard', function () {

    it('loadModels() should throw after disposal', function () {
        const { vis } = makeMockVis();
        vis.dispose();
        expect(() => vis.loadModels('data', 'xyz')).to.throw(
            /cannot call loadModels\(\) on a disposed instance/
        );
    });

    it('displayModel() should throw after disposal', function () {
        const { vis } = makeMockVis();
        vis.dispose();
        expect(() => vis.displayModel('mymodel')).to.throw(
            /cannot call displayModel\(\) on a disposed instance/
        );
    });

    it('reloadModel() should throw after disposal', function () {
        const { vis } = makeMockVis();
        vis.dispose();
        expect(() => vis.reloadModel('mymodel')).to.throw(
            /cannot call reloadModel\(\) on a disposed instance/
        );
    });

    it('unloadAll() should throw after disposal', function () {
        const { vis } = makeMockVis();
        vis.dispose();
        expect(() => vis.unloadAll()).to.throw(
            /cannot call unloadAll\(\) on a disposed instance/
        );
    });

    it('isDisposed getter returns false before disposal', function () {
        const { vis } = makeMockVis();
        expect(vis.isDisposed).to.be.false;
    });

    it('isDisposed getter returns true after disposal', function () {
        const { vis } = makeMockVis();
        vis.dispose();
        expect(vis.isDisposed).to.be.true;
    });

});

// ---------------------------------------------------------------------------
// Tests: camera state (§1)
// ---------------------------------------------------------------------------

describe('CrystVis#getCameraState / setCameraState', function () {

    it('getCameraState() delegates to the renderer', function () {
        const { vis, renderer } = makeMockVis();
        const state = vis.getCameraState();
        expect(state).to.deep.equal(renderer._cameraState);
    });

    it('getCameraState() returns a snapshot (not the live object)', function () {
        const { vis, renderer } = makeMockVis();
        const state = vis.getCameraState();
        // Mutate the returned snapshot – the renderer's state must not change
        state.zoom = 999;
        expect(renderer._cameraState.zoom).to.not.equal(999);
    });

    it('setCameraState() delegates to the renderer', function () {
        const { vis, renderer } = makeMockVis();
        const newState = { position: { x: 1, y: 2, z: 3 }, target: { x: 0, y: 0, z: 0 }, zoom: 2 };
        vis.setCameraState(newState);
        expect(renderer._setCameraStateCalls).to.have.length(1);
        expect(renderer._setCameraStateCalls[0]).to.equal(newState);
    });

});

describe('CrystVis#onCameraChange', function () {

    it('registers a callback that fires when the renderer emits a camera change', function () {
        const { vis, renderer } = makeMockVis();
        const received = [];
        vis.onCameraChange(state => received.push(state));
        renderer._fireCameraChange();
        expect(received).to.have.length(1);
        expect(received[0]).to.have.keys(['position', 'target', 'zoom']);
    });

    it('supports multiple subscribers', function () {
        const { vis, renderer } = makeMockVis();
        let countA = 0, countB = 0;
        vis.onCameraChange(() => countA++);
        vis.onCameraChange(() => countB++);
        renderer._fireCameraChange();
        expect(countA).to.equal(1);
        expect(countB).to.equal(1);
    });

    it('returned unsubscribe function stops future callbacks', function () {
        const { vis, renderer } = makeMockVis();
        const received = [];
        const unsub = vis.onCameraChange(state => received.push(state));
        renderer._fireCameraChange(); // fires once
        unsub();
        renderer._fireCameraChange(); // should NOT reach the callback
        expect(received).to.have.length(1);
    });

});

// ---------------------------------------------------------------------------
// Tests: model source / parameters / metadata (§2, §3)
// ---------------------------------------------------------------------------

describe('CrystVis#getModelSource / getModelParameters / getModelMeta', function () {

    it('getModelSource() returns null for unknown model', function () {
        const { vis } = makeMockVis();
        expect(vis.getModelSource('missing')).to.be.null;
    });

    it('getModelSource() returns a cloned copy of stored source', function () {
        const { vis } = makeMockVis();
        vis._model_sources['m'] = { text: 'data...', extension: 'cif' };
        const src = vis.getModelSource('m');
        expect(src).to.deep.equal({ text: 'data...', extension: 'cif' });
        // Mutating the returned copy must not affect the store
        src.text = 'modified';
        expect(vis._model_sources['m'].text).to.equal('data...');
    });

    it('getModelParameters() returns null for unknown model', function () {
        const { vis } = makeMockVis();
        expect(vis.getModelParameters('missing')).to.be.null;
    });

    it('getModelParameters() returns a cloned copy of stored parameters', function () {
        const { vis } = makeMockVis();
        vis._model_parameters['m'] = { supercell: [2, 2, 1], molecularCrystal: true };
        const params = vis.getModelParameters('m');
        expect(params).to.deep.equal({ supercell: [2, 2, 1], molecularCrystal: true });
        params.supercell[0] = 99;
        expect(vis._model_parameters['m'].supercell[0]).to.equal(2);
    });

    it('getModelMeta() returns null for unknown model', function () {
        const { vis } = makeMockVis();
        expect(vis.getModelMeta('missing')).to.be.null;
    });

    it('getModelMeta() returns a cloned copy of stored metadata', function () {
        const { vis } = makeMockVis();
        vis._model_meta['m'] = { prefix: 'cif', originalName: 'struct' };
        const meta = vis.getModelMeta('m');
        expect(meta).to.deep.equal({ prefix: 'cif', originalName: 'struct' });
        meta.prefix = 'changed';
        expect(vis._model_meta['m'].prefix).to.equal('cif');
    });

});

// ---------------------------------------------------------------------------
// Tests: lifecycle events (§4)
// ---------------------------------------------------------------------------

describe('CrystVis#onModelListChange', function () {

    it('fires with the current model-name list', function () {
        const { vis } = makeMockVis();
        vis._models = { a: {}, b: {} };
        const received = [];
        vis.onModelListChange(names => received.push(names));
        vis._emitModelListChange();
        expect(received).to.have.length(1);
        expect(received[0].sort()).to.deep.equal(['a', 'b']);
    });

    it('fires when deleteModel is called', function () {
        const { vis } = makeMockVis();
        // Inject a stub model that deleteModel won't choke on
        vis._models = { m: {} };
        // displayModel() (called inside deleteModel when current) calls renderer.clear()
        // and _emitDisplayChange – fine with our mock
        const received = [];
        vis.onModelListChange(names => received.push(names.slice()));
        vis.deleteModel('m');
        expect(received).to.have.length(1);
        expect(received[0]).to.deep.equal([]);
    });

    it('returned unsubscribe function prevents future callbacks', function () {
        const { vis } = makeMockVis();
        vis._models = { a: {} };
        const received = [];
        const unsub = vis.onModelListChange(names => received.push(names));
        vis._emitModelListChange();
        unsub();
        vis._emitModelListChange();
        expect(received).to.have.length(1);
    });

});

describe('CrystVis#onDisplayChange', function () {

    it('fires with null when displayModel() is called with no args', function () {
        const { vis } = makeMockVis();
        const received = [];
        vis.onDisplayChange(name => received.push(name));
        vis.displayModel(); // clear
        expect(received).to.have.length(1);
        expect(received[0]).to.be.null;
    });

    it('returned unsubscribe function prevents future callbacks', function () {
        const { vis } = makeMockVis();
        const received = [];
        const unsub = vis.onDisplayChange(name => received.push(name));
        vis.displayModel();
        unsub();
        vis.displayModel();
        expect(received).to.have.length(1);
    });

});

// ---------------------------------------------------------------------------
// Tests: unloadAll (§5)
// ---------------------------------------------------------------------------

describe('CrystVis#unloadAll', function () {

    it('clears all model stores', function () {
        const { vis } = makeMockVis();
        vis._models           = { a: {}, b: {} };
        vis._model_sources    = { a: { text: 'x', extension: 'cif' }, b: { text: 'y', extension: 'xyz' } };
        vis._model_parameters = { a: {}, b: {} };
        vis._model_meta       = { a: {}, b: {} };

        vis.unloadAll();

        expect(Object.keys(vis._models)).to.have.length(0);
        expect(Object.keys(vis._model_sources)).to.have.length(0);
        expect(Object.keys(vis._model_parameters)).to.have.length(0);
        expect(Object.keys(vis._model_meta)).to.have.length(0);
    });

    it('emits onModelListChange with an empty list', function () {
        const { vis } = makeMockVis();
        vis._models = { a: {} };
        const received = [];
        vis.onModelListChange(names => received.push(names.slice()));
        vis.unloadAll();
        expect(received).to.have.length(1);
        expect(received[0]).to.deep.equal([]);
    });

    it('emits onDisplayChange with null', function () {
        const { vis } = makeMockVis();
        vis._models = { a: {} };
        const received = [];
        vis.onDisplayChange(name => received.push(name));
        vis.unloadAll();
        expect(received).to.have.length(1);
        expect(received[0]).to.be.null;
    });

    it('throws after disposal', function () {
        const { vis } = makeMockVis();
        vis.dispose();
        expect(() => vis.unloadAll()).to.throw(/cannot call unloadAll\(\) on a disposed instance/);
    });

});
// ---------------------------------------------------------------------------
// Tests: appearance API (§6)
// ---------------------------------------------------------------------------

describe('CrystVis appearance API — theme shortcuts', function () {

    it('background getter reads from the renderer', function () {
        const { vis, renderer } = makeMockVis();
        renderer.background = 0xff0000;
        expect(vis.background).to.equal(0xff0000);
    });

    it('background setter writes to the renderer', function () {
        const { vis, renderer } = makeMockVis();
        vis.background = 0x123456;
        expect(renderer.background).to.equal(0x123456);
    });

    it('highlightColor getter reads from the renderer', function () {
        const { vis, renderer } = makeMockVis();
        renderer.highlightColor = 0xaabbcc;
        expect(vis.highlightColor).to.equal(0xaabbcc);
    });

    it('highlightColor setter writes to the renderer', function () {
        const { vis, renderer } = makeMockVis();
        vis.highlightColor = 0xddeeff;
        expect(renderer.highlightColor).to.equal(0xddeeff);
    });

    it('labelColor getter reads from the renderer', function () {
        const { vis, renderer } = makeMockVis();
        renderer.labelColor = 0x111111;
        expect(vis.labelColor).to.equal(0x111111);
    });

    it('labelColor setter writes to the renderer', function () {
        const { vis, renderer } = makeMockVis();
        vis.labelColor = 0x222222;
        expect(renderer.labelColor).to.equal(0x222222);
    });

    it('cellLineColor getter reads from the renderer', function () {
        const { vis, renderer } = makeMockVis();
        renderer.cellLineColor = 0x333333;
        expect(vis.cellLineColor).to.equal(0x333333);
    });

    it('cellLineColor setter writes to the renderer', function () {
        const { vis, renderer } = makeMockVis();
        vis.cellLineColor = 0x444444;
        expect(renderer.cellLineColor).to.equal(0x444444);
    });

    it('theme setter with string "dark" delegates to the renderer', function () {
        const { vis, renderer } = makeMockVis();
        vis.theme = 'dark';
        expect(renderer.theme).to.have.property('background');
        expect(renderer.theme.background).to.equal(0x000000);
    });

    it('theme setter with string "light" delegates to the renderer', function () {
        const { vis, renderer } = makeMockVis();
        vis.theme = 'light';
        expect(renderer.theme).to.have.property('background');
        expect(renderer.theme.background).to.equal(0xffffff);
    });

    it('theme setter with unknown string throws', function () {
        const { vis } = makeMockVis();
        expect(() => vis.theme = 'notheme').to.throw(/Theme notheme not found/);
    });

    it('theme getter reads from the renderer', function () {
        const { vis, renderer } = makeMockVis();
        const t = { background: 0xabcdef, foreground: 0x000000, highlight: 0xff00ff,
                    cell_line_color: 0x888888, label_color: 0xcccccc };
        renderer.theme = t;
        expect(vis.theme).to.equal(t);
    });

});

describe('CrystVis appearance API — selection box style', function () {

    it('selboxBkgColor getter reads from the renderer', function () {
        const { vis, renderer } = makeMockVis();
        renderer.selbox_bkg_color = 0xaaaaff;
        expect(vis.selboxBkgColor).to.equal(0xaaaaff);
    });

    it('selboxBkgColor setter writes to the renderer', function () {
        const { vis, renderer } = makeMockVis();
        vis.selboxBkgColor = 0xbbbbff;
        expect(renderer.selbox_bkg_color).to.equal(0xbbbbff);
    });

    it('selboxBorderColor getter reads from the renderer', function () {
        const { vis, renderer } = makeMockVis();
        renderer.selbox_border_color = 0xccccff;
        expect(vis.selboxBorderColor).to.equal(0xccccff);
    });

    it('selboxBorderColor setter writes to the renderer', function () {
        const { vis, renderer } = makeMockVis();
        vis.selboxBorderColor = 0xddddff;
        expect(renderer.selbox_border_color).to.equal(0xddddff);
    });

    it('selboxOpacity getter reads from the renderer', function () {
        const { vis, renderer } = makeMockVis();
        renderer.selbox_opacity = 0.3;
        expect(vis.selboxOpacity).to.equal(0.3);
    });

    it('selboxOpacity setter writes to the renderer', function () {
        const { vis, renderer } = makeMockVis();
        vis.selboxOpacity = 0.75;
        expect(renderer.selbox_opacity).to.equal(0.75);
    });

});

describe('CrystVis appearance API — lighting', function () {

    it('setAmbientLight() calls the renderer method with the given intensity', function () {
        const { vis, renderer } = makeMockVis();
        vis.setAmbientLight(0.8);
        expect(renderer._ambientLightCalls).to.deep.equal([0.8]);
    });

    it('setAmbientLight() can be called multiple times and all calls are recorded', function () {
        const { vis, renderer } = makeMockVis();
        vis.setAmbientLight(0.1);
        vis.setAmbientLight(0.5);
        expect(renderer._ambientLightCalls).to.deep.equal([0.1, 0.5]);
    });

    it('setDirectionalLight() calls the renderer method with all four arguments', function () {
        const { vis, renderer } = makeMockVis();
        vis.setDirectionalLight(0.6, 1, -1, 0);
        expect(renderer._directionalLightCalls).to.have.length(1);
        expect(renderer._directionalLightCalls[0]).to.deep.equal({ intensity: 0.6, px: 1, py: -1, pz: 0 });
    });

    it('setDirectionalLight() passes null for omitted direction components', function () {
        const { vis, renderer } = makeMockVis();
        vis.setDirectionalLight(0.4);
        const call = renderer._directionalLightCalls[0];
        expect(call.intensity).to.equal(0.4);
        expect(call.px).to.be.null;
        expect(call.py).to.be.null;
        expect(call.pz).to.be.null;
    });

    it('setDirectionalLight() supports partial direction updates (only pz)', function () {
        const { vis, renderer } = makeMockVis();
        vis.setDirectionalLight(0.6, null, null, -1);
        const call = renderer._directionalLightCalls[0];
        expect(call.px).to.be.null;
        expect(call.py).to.be.null;
        expect(call.pz).to.equal(-1);
    });

});
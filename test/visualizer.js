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

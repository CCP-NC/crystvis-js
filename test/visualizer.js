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

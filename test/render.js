'use strict';

import * as chai from 'chai';
import { Renderer } from '../lib/render.js';

const expect = chai.expect;

function dispatchPointerEvent(target, type, x, y, { isPrimary = true } = {}) {
    const event = new window.MouseEvent(type, {
        bubbles: true,
        clientX: x,
        clientY: y,
    });
    Object.defineProperty(event, 'isPrimary', { value: isPrimary });
    target.dispatchEvent(event);
}

describe('Renderer click drag guard', function () {
    let renderer;
    let originalAnimate;

    before(function () {
        originalAnimate = Renderer.prototype._animate;
        Renderer.prototype._animate = function () {};
    });

    after(function () {
        Renderer.prototype._animate = originalAnimate;
    });

    beforeEach(function () {
        const host = document.getElementById('crystvis');
        host.innerHTML = '';
        renderer = new Renderer('#crystvis', 320, 240);
        renderer._r.dispose = () => {};
    });

    afterEach(function () {
        if (renderer && renderer._r) {
            renderer.dispose();
        }
        renderer = null;
        const host = document.getElementById('crystvis');
        host.innerHTML = '';
    });

    it('should raycast on pointerup when the pointer stays within the drag threshold', function () {
        let raycastCalls = 0;
        renderer._raycastClick = () => {
            raycastCalls++;
        };

        dispatchPointerEvent(renderer._r.domElement, 'pointerdown', 100, 100);
        dispatchPointerEvent(renderer._r.domElement, 'pointerup', 103, 104);

        expect(raycastCalls).to.equal(1);
    });

    it('should not raycast on pointerup after a drag larger than the threshold', function () {
        let raycastCalls = 0;
        renderer._raycastClick = () => {
            raycastCalls++;
        };

        dispatchPointerEvent(renderer._r.domElement, 'pointerdown', 100, 100);
        dispatchPointerEvent(renderer._r.domElement, 'pointerup', 110, 100);

        expect(raycastCalls).to.equal(0);
    });

    it('should remove pointer listeners during dispose', function () {
        let raycastCalls = 0;
        const canvas = renderer._r.domElement;
        renderer._raycastClick = () => {
            raycastCalls++;
        };

        renderer.dispose();
        renderer = null;

        dispatchPointerEvent(canvas, 'pointerdown', 100, 100);
        dispatchPointerEvent(canvas, 'pointerup', 100, 100);

        expect(raycastCalls).to.equal(0);
    });

    it('should ignore non-primary pointer events', function () {
        let raycastCalls = 0;
        renderer._raycastClick = () => {
            raycastCalls++;
        };

        dispatchPointerEvent(renderer._r.domElement, 'pointerdown', 100, 100, { isPrimary: false });
        dispatchPointerEvent(renderer._r.domElement, 'pointerup', 100, 100, { isPrimary: false });

        expect(raycastCalls).to.equal(0);
    });

    it('should not raycast after pointercancel', function () {
        let raycastCalls = 0;
        renderer._raycastClick = () => {
            raycastCalls++;
        };

        dispatchPointerEvent(renderer._r.domElement, 'pointerdown', 100, 100);
        dispatchPointerEvent(renderer._r.domElement, 'pointercancel', 100, 100);
        dispatchPointerEvent(renderer._r.domElement, 'pointerup', 100, 100);

        expect(raycastCalls).to.equal(0);
    });

    it('should set an accessible role and label on the canvas', function () {
        const canvas = renderer._r.domElement;
        expect(canvas.getAttribute('role')).to.equal('img');
        expect(canvas.getAttribute('aria-label')).to.equal('Crystal structure viewer');
    });

    it('should construct and dispose without window.matchMedia', function () {
        expect(window.matchMedia).to.be.undefined;
        expect(renderer._dprUnwatch).to.not.be.ok;
        expect(() => renderer.dispose()).to.not.throw();
        renderer = null;
    });

    it('should update the pixel ratio when the media query fires and unregister on dispose', function () {
        const listeners = [];
        const queries = [];
        window.matchMedia = (q) => {
            queries.push(q);
            const mq = {
                addEventListener: (_, cb) => listeners.push(cb),
                removeEventListener: (_, cb) => listeners.splice(listeners.indexOf(cb), 1),
            };
            return mq;
        };
        try {
            const host = document.getElementById('crystvis');
            host.innerHTML = '';
            const r = new Renderer('#crystvis', 320, 240);
            r._r.dispose = () => {};
            expect(listeners).to.have.length(1);

            const ratios = [];
            r._r.setPixelRatio = (v) => ratios.push(v);
            window.devicePixelRatio = 2;
            listeners[0]();
            expect(ratios).to.deep.equal([2]);
            expect(queries[queries.length - 1]).to.equal('(resolution: 2dppx)');
            expect(listeners).to.have.length(1);

            r.dispose();
            expect(listeners).to.have.length(0);
        } finally {
            delete window.matchMedia;
            window.devicePixelRatio = 1;
        }
    });

    it('should convert document coordinates using the canvas bounding rect', function () {
        renderer._r.domElement.getBoundingClientRect = () => ({
            left: 40,
            top: 20,
            width: 200,
            height: 100,
        });

        const vector = renderer.documentToWorld(140, 70);

        expect(vector.x).to.equal(0);
        expect(vector.y).to.equal(0);
    });

    it('should reuse the shared NDC vector', function () {
        renderer._r.domElement.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            width: 320,
            height: 240,
        });

        const first = renderer.documentToWorld(160, 120);
        const second = renderer.documentToWorld(80, 60);

        expect(second).to.equal(first);
        expect(second.x).to.equal(-0.5);
        expect(second.y).to.equal(0.5);
    });

    it('should reuse the shared raycaster instance', function () {
        let setFromCameraCalls = 0;
        const sharedRaycaster = {
            setFromCamera(vector, camera) {
                setFromCameraCalls++;
                expect(camera).to.equal(renderer._c);
                expect(vector.x).to.equal(0);
                expect(vector.y).to.equal(0);
            },
            intersectObjects() {
                return [];
            },
        };

        renderer._r.domElement.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            width: 320,
            height: 240,
        });
        renderer._raycaster = sharedRaycaster;

        renderer._raycastClick({ clientX: 160, clientY: 120 });

        expect(setFromCameraCalls).to.equal(1);
    });
});

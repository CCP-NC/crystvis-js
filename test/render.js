'use strict';

import * as chai from 'chai';
import { Renderer } from '../lib/render.js';

const expect = chai.expect;

function dispatchPointerEvent(target, type, x, y) {
    const event = new window.MouseEvent(type, {
        bubbles: true,
        clientX: x,
        clientY: y,
    });
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
});

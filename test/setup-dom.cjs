/**
 * test/setup-dom.cjs
 *
 * Mocha --require hook (CommonJS) that installs a minimal jsdom window as
 * global so that DOM-dependent ES modules (THREE.js texture loader, jQuery,
 * etc.) can be imported in the Node.js test environment without crashing.
 */

'use strict';

const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="crystvis"></div></body></html>', {
    pretendToBeVisual: true,
    resources: 'usable',
});

// Helper: set a global, falling back to Object.defineProperty for read-only
// properties (e.g. navigator in Node.js 23+).
function setGlobal(name, value) {
    try {
        global[name] = value;
    } catch (_) {
        Object.defineProperty(global, name, { value, writable: true, configurable: true });
    }
}

// Expose browser globals expected by THREE.js, jQuery, etc.
setGlobal('window',            dom.window);
setGlobal('document',          dom.window.document);
setGlobal('navigator',         dom.window.navigator);
setGlobal('HTMLElement',       dom.window.HTMLElement);
setGlobal('HTMLCanvasElement', dom.window.HTMLCanvasElement);
setGlobal('Image',             dom.window.Image);
setGlobal('ImageData',         dom.window.ImageData);
setGlobal('XMLHttpRequest',    dom.window.XMLHttpRequest);
setGlobal('requestAnimationFrame',  (cb) => setTimeout(cb, 16));
setGlobal('cancelAnimationFrame',   (id) => clearTimeout(id));
setGlobal('ResizeObserver', class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
});

// Stub WebGL context so THREE.WebGLRenderer does not crash on getContext()
const canvasProto = dom.window.HTMLCanvasElement.prototype;
const _origGetContext = canvasProto.getContext;
canvasProto.getContext = function (type, ...args) {
    if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') {
        // Return a minimal WebGL stub that THREE can interrogate without causing
        // errors.  Only the methods referenced during renderer initialisation
        // need to be present.
        return {
            canvas: this,
            drawingBufferWidth: 300,
            drawingBufferHeight: 150,
            getExtension: () => null,
            getParameter: () => null,
            getShaderPrecisionFormat: () => ({ rangeMin: 127, rangeMax: 127, precision: 23 }),
            createTexture: () => ({}),
            bindTexture: () => {},
            texParameteri: () => {},
            pixelStorei: () => {},
            enable: () => {},
            disable: () => {},
            blendEquation: () => {},
            blendFunc: () => {},
            depthFunc: () => {},
            depthMask: () => {},
            colorMask: () => {},
            clearColor: () => {},
            clearDepth: () => {},
            clearStencil: () => {},
            scissor: () => {},
            viewport: () => {},
            clear: () => {},
            useProgram: () => {},
            frontFace: () => {},
            cullFace: () => {},
            createBuffer: () => ({}),
            bindBuffer: () => {},
            bufferData: () => {},
            createFramebuffer: () => ({}),
            bindFramebuffer: () => {},
            createRenderbuffer: () => ({}),
            bindRenderbuffer: () => {},
            renderbufferStorage: () => {},
            framebufferRenderbuffer: () => {},
            framebufferTexture2D: () => {},
            createProgram: () => ({}),
            createShader: () => ({}),
            shaderSource: () => {},
            compileShader: () => {},
            attachShader: () => {},
            linkProgram: () => {},
            getProgramParameter: (p, pname) => {
                // LINK_STATUS
                if (pname === 35714) return true;
                return null;
            },
            getShaderParameter: () => true,
            getUniformLocation: () => ({}),
            getAttribLocation: () => 0,
            uniform1i: () => {},
            uniform1f: () => {},
            uniform2f: () => {},
            uniform3f: () => {},
            uniform4f: () => {},
            uniformMatrix3fv: () => {},
            uniformMatrix4fv: () => {},
            vertexAttribPointer: () => {},
            enableVertexAttribArray: () => {},
            disableVertexAttribArray: () => {},
            drawArrays: () => {},
            drawElements: () => {},
            deleteBuffer: () => {},
            deleteTexture: () => {},
            deleteProgram: () => {},
            deleteShader: () => {},
            deleteFramebuffer: () => {},
            deleteRenderbuffer: () => {},
            isContextLost: () => false,
            getError: () => 0,
            // WebGL2 extras
            createVertexArray: () => ({}),
            bindVertexArray: () => {},
            deleteVertexArray: () => {},
            texImage2D: () => {},
            texImage3D: () => {},
            texStorage2D: () => {},
            texStorage3D: () => {},
            blitFramebuffer: () => {},
            readBuffer: () => {},
            drawBuffers: () => {},
            renderbufferStorageMultisample: () => {},
            createSampler: () => ({}),
            deleteSampler: () => {},
            bindSampler: () => {},
            samplerParameteri: () => {},
            samplerParameterf: () => {},
        };
    }
    if (_origGetContext) {
        return _origGetContext.call(this, type, ...args);
    }
    return null;
};

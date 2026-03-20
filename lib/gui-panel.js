'use strict';

/**
 * @fileoverview  Optional lil-gui control panel for a CrystVis instance.
 *
 * Usage (vanilla JS)
 * ------------------
 *   import { createGUIPanel } from '@ccp-nc/crystvis-js';
 *
 *   const vis = new CrystVis('#container', 0, 0);
 *   const gui = createGUIPanel(vis);        // panel shown by default
 *   gui.hide();                             // programmatically hide
 *   gui.show();                             // or show again
 *   document.getElementById('btn').onclick = () => gui.show(!gui._hidden);
 *
 * Usage (React, e.g. MagresView 2)
 * ---------------------------------
 *   // In a component that owns the CrystVis instance:
 *   const guiRef = useRef(null);
 *
 *   // After viewer is initialised:
 *   guiRef.current = createGUIPanel(viewer);
 *   guiRef.current.hide();   // hidden by default; user reveals via a button
 *
 *   // Toggle button handler:
 *   function togglePanel() {
 *       const gui = guiRef.current;
 *       if (!gui) return;
 *       gui._hidden ? gui.show() : gui.hide();
 *   }
 *
 *   // Cleanup:
 *   return () => { guiRef.current?.destroy(); };
 *
 * Sections
 * --------
 *   Scene          – theme preset, background colour
 *   Lighting       – ambient + directional intensity, light direction (XYZ)
 *   Labels         – label colour
 *   Selection highlight – aura fill/border, fraction, opacity
 *   Unit cell      – box colour, a/b/c-axis colours
 *   Structure      – supercell, molecular-crystal mode, VdW scale  (→ Reload)
 *   Displayed atoms – display-mode preset, atom sphere scale/opacity
 *   Bonds          – radius, opacity, show/hide
 */

import GUI from 'lil-gui';

// ── Colour helpers ─────────────────────────────────────────────────────────────

/**
 * Convert a Three.js / crystvis-js hex integer (e.g. 0xffffff) to a CSS
 * colour string (e.g. '#ffffff') that lil-gui colour pickers expect.
 * Falls back to white for null / undefined.
 * @param {number|null} h
 * @returns {string}
 */
function hexToCss(h) {
    if (h == null) return '#ffffff';
    return '#' + Math.floor(h).toString(16).padStart(6, '0');
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Create and attach a lil-gui panel that controls the given CrystVis instance.
 * The returned GUI is shown immediately; call `gui.hide()` to start hidden.
 *
 * @param {import('./visualizer.js').CrystVis} vis
 * @returns {GUI}  The lil-gui root; call `gui.destroy()` to remove the panel.
 */
export function createGUIPanel(vis) {

    const gui = new GUI({ title: 'CrystVis Controls', width: 290 });

    const app = vis.appearance;

    // ── Mutable state object that lil-gui binds to ─────────────────────────────

    const state = {

        // ── Scene ──────────────────────────────────────────────────────────────
        theme:      'dark',
        background: hexToCss(app.background),

        // ── Lighting ───────────────────────────────────────────────────────────
        ambient:     app.lighting.ambient     ?? 0.3,
        directional: app.lighting.directional ?? 0.6,
        lightX:  0.0,
        lightY:  1.0,
        lightZ: -1.0,

        // ── Labels ─────────────────────────────────────────────────────────────
        labelColor: hexToCss(app.label.color),

        // ── Selection highlight / aura ─────────────────────────────────────────
        highlightColor:          hexToCss(app.highlight.color),
        highlightBorder:         hexToCss(app.highlight.borderColor),
        highlightBorderFraction: app.highlight.borderFraction ?? 0.3,
        highlightOpacity:        app.highlight.opacity        ?? 0.5,

        // ── Unit cell ──────────────────────────────────────────────────────────
        cellLineColor: hexToCss(app.cell.lineColor),
        cellAxisX:     hexToCss(app.cell.axisX),
        cellAxisY:     hexToCss(app.cell.axisY),
        cellAxisZ:     hexToCss(app.cell.axisZ),

        // ── Structure (needs reload) ────────────────────────────────────────────
        supercellX:      1,
        supercellY:      1,
        supercellZ:      1,
        molecularCrystal: false,
        vdwScaling:       1.0,
        applyStructure:   () => _applyStructure(),

        // ── Displayed atoms ────────────────────────────────────────────────────
        displayMode:    'Unit cell',
        globalScale:    1.0,
        atomOpacity:    1.0,

        // ── Bonds ──────────────────────────────────────────────────────────────
        bondRadius:  0.2,
        bondOpacity: 1.0,
        showBonds:   true,
    };

    // ── Private helpers ────────────────────────────────────────────────────────

    /** Run `fn(displayed)` only when a model is visible. */
    function withDisplayed(fn) {
        if (vis.displayed) fn(vis.displayed);
    }

    /** Return all bond images for the current model (empty array if none). */
    function allBonds() {
        return (vis.model && vis.model._bond_images) ? vis.model._bond_images : [];
    }

    /**
     * Set atom sphere opacity WITHOUT propagating to bond opacity.
     * The public atom.opacity setter always updates connected bond meshes, so
     * we reach into the mesh directly here.
     */
    function setAtomSphereOpacity(v) {
        withDisplayed(d => {
            d.atoms.forEach(a => {
                // Use the public getter (a.mesh) not the raw field (a._mesh):
                // meshes are allocated lazily, so a._mesh may still be null
                // even after the atom is visible.
                const mesh = a.mesh;
                if (mesh) mesh.atom_opacity = v;
            });
        });
    }

    /** Apply bond opacity to all bond halves in the current model. */
    function setBondOpacity(v) {
        allBonds().forEach(b => {
            b.opacity1 = v;
            b.opacity2 = v;
        });
    }

    // ── Display mode controller ref (so _applyStructure can update it) ─────────
    let displayModeCtrl = null;

    /** Apply the selected display-mode preset. */
    function _applyDisplayMode() {
        if (!vis.model) return;
        const mode = state.displayMode;
        if (mode === 'Unit cell') {
            vis.displayed = vis.model.find({ cell: [[0, 0, 0]] });
        } else if (mode === 'All atoms') {
            vis.displayed = vis.model.find({ all: [] });
        } else if (mode === '5 Å sphere') {
            vis.displayed = vis.model.find({ sphere: [[0, 0, 0], 5.0] });
        }
    }

    /**
     * Reload the current model with the supercell / molecularCrystal / vdwScaling
     * values from the GUI state, then re-apply the display mode.
     */
    function _applyStructure() {
        if (!vis.modelName) return;

        vis.reloadModel(vis.modelName, {
            supercell:        [state.supercellX, state.supercellY, state.supercellZ],
            molecularCrystal: state.molecularCrystal,
            vdwScaling:       state.vdwScaling,
        });

        // A supercell larger than 1×1×1 means show all images, not just cell origin.
        if (state.supercellX > 1 || state.supercellY > 1 || state.supercellZ > 1) {
            state.displayMode = 'All atoms';
            if (displayModeCtrl) displayModeCtrl.updateDisplay();
        }

        _applyDisplayMode();

        // Bond settings must be re-applied because reloadModel creates new bond images.
        allBonds().forEach(b => { b.radius = state.bondRadius; });
        allBonds().forEach(b => { b.opacity1 = state.bondOpacity; b.opacity2 = state.bondOpacity; });
        if (!state.showBonds) allBonds().forEach(b => { b.visible = false; });

        // Re-apply atom sphere opacity
        setAtomSphereOpacity(state.atomOpacity);
    }

    // ── Section 1 – Scene ──────────────────────────────────────────────────────

    const sceneFolder = gui.addFolder('Scene');

    sceneFolder
        .add(state, 'theme', ['dark', 'light'])
        .name('Theme')
        .onChange(v => { app.theme = v; });

    sceneFolder
        .addColor(state, 'background')
        .name('Background colour')
        .onChange(v => { app.background = v; });

    // ── Section 2 – Lighting ───────────────────────────────────────────────────

    const lightFolder = gui.addFolder('Lighting');

    lightFolder
        .add(state, 'ambient', 0, 2, 0.01)
        .name('Ambient intensity')
        .onChange(v => { app.lighting.ambient = v; });

    lightFolder
        .add(state, 'directional', 0, 2, 0.01)
        .name('Directional intensity')
        .onChange(() => {
            app.lighting.setDirectional(
                state.directional, state.lightX, state.lightY, state.lightZ);
        });

    const lightDirFolder = lightFolder.addFolder('Light direction');
    // lightX/Y/Z are unit direction components; the renderer scales them by
    // LIGHT_DIR_SCALE (2000) relative to camera depth so changes are visible.
    const _updateDir = () => app.lighting.setDirectional(
        state.directional, state.lightX, state.lightY, state.lightZ);

    lightDirFolder.add(state, 'lightX', -1, 1, 0.05).name('X').onChange(_updateDir);
    lightDirFolder.add(state, 'lightY', -1, 1, 0.05).name('Y').onChange(_updateDir);
    lightDirFolder.add(state, 'lightZ', -1, 1, 0.05).name('Z').onChange(_updateDir);
    lightDirFolder.close();

    // ── Section 3 – Labels ────────────────────────────────────────────────────

    const labelFolder = gui.addFolder('Labels');

    labelFolder
        .addColor(state, 'labelColor')
        .name('Label colour')
        .onChange(v => { app.label.color = v; });

    labelFolder.close();

    // ── Section 4 – Selection highlight ───────────────────────────────────────

    const hlFolder = gui.addFolder('Selection highlight');

    hlFolder
        .addColor(state, 'highlightColor')
        .name('Fill colour')
        .onChange(v => { app.highlight.color = v; });

    hlFolder
        .addColor(state, 'highlightBorder')
        .name('Border colour')
        .onChange(v => { app.highlight.borderColor = v; });

    hlFolder
        .add(state, 'highlightBorderFraction', 0, 1, 0.01)
        .name('Border fraction')
        .onChange(v => { app.highlight.borderFraction = v; });

    hlFolder
        .add(state, 'highlightOpacity', 0, 1, 0.01)
        .name('Opacity')
        .onChange(v => { app.highlight.opacity = v; });

    hlFolder.close();

    // ── Section 5 – Unit cell ──────────────────────────────────────────────────

    const cellFolder = gui.addFolder('Unit cell appearance');

    cellFolder
        .addColor(state, 'cellLineColor')
        .name('Box colour')
        .onChange(v => { app.cell.lineColor = v; });

    cellFolder
        .addColor(state, 'cellAxisX')
        .name('a-axis colour')
        .onChange(v => { app.cell.axisX = v; });

    cellFolder
        .addColor(state, 'cellAxisY')
        .name('b-axis colour')
        .onChange(v => { app.cell.axisY = v; });

    cellFolder
        .addColor(state, 'cellAxisZ')
        .name('c-axis colour')
        .onChange(v => { app.cell.axisZ = v; });

    cellFolder.close();

    // ── Section 6 – Structure (requires reload) ────────────────────────────────

    const structFolder = gui.addFolder('Structure  ⚠ requires reload');

    structFolder.add(state, 'supercellX', 1, 5, 1).name('Supercell a');
    structFolder.add(state, 'supercellY', 1, 5, 1).name('Supercell b');
    structFolder.add(state, 'supercellZ', 1, 5, 1).name('Supercell c');
    structFolder.add(state, 'molecularCrystal').name('Molecular crystal');
    structFolder.add(state, 'vdwScaling', 0.2, 3.0, 0.05).name('VdW radius scale');
    structFolder.add(state, 'applyStructure').name('→  Apply & Reload');

    // ── Section 7 – Displayed atoms ───────────────────────────────────────────

    const displayFolder = gui.addFolder('Displayed atoms');

    displayModeCtrl = displayFolder
        .add(state, 'displayMode', ['Unit cell', 'All atoms', '5 Å sphere'])
        .name('Show')
        .onChange(() => _applyDisplayMode());

    displayFolder
        .add(state, 'globalScale', 0.1, 3.0, 0.05)
        .name('Atom scale')
        .onChange(v => withDisplayed(d => d.setProperty('scale', v)));

    displayFolder
        .add(state, 'atomOpacity', 0.0, 1.0, 0.01)
        .name('Atom sphere opacity')
        // Bypasses atom.opacity setter so that bond opacity is NOT affected.
        .onChange(v => setAtomSphereOpacity(v));

    // ── Section 8 – Bonds ─────────────────────────────────────────────────────

    const bondFolder = gui.addFolder('Bonds');

    bondFolder
        .add(state, 'bondRadius', 0.02, 0.5, 0.01)
        .name('Bond radius (Å)')
        .onChange(v => allBonds().forEach(b => { b.radius = v; }));

    bondFolder
        .add(state, 'bondOpacity', 0.0, 1.0, 0.01)
        .name('Bond opacity')
        .onChange(v => setBondOpacity(v));

    bondFolder
        .add(state, 'showBonds')
        .name('Show bonds')
        .onChange(v => allBonds().forEach(b => { b.visible = v; }));

    // ── Sync from model when a new model is displayed ──────────────────────────

    vis.onDisplayChange((name) => {
        if (!name) return;

        const params = vis.getModelParameters(name);
        if (params) {
            const sc = params.supercell || [1, 1, 1];
            state.supercellX       = sc[0];
            state.supercellY       = sc[1];
            state.supercellZ       = sc[2];
            state.molecularCrystal = params.molecularCrystal || false;
            state.vdwScaling       = params.vdwScaling       || 1.0;
        }

        // Reset per-session atom/bond values
        state.globalScale   = 1.0;
        state.atomOpacity   = 1.0;
        state.bondRadius    = 0.2;
        state.bondOpacity   = 1.0;
        state.showBonds     = true;

        gui.controllersRecursive().forEach(c => c.updateDisplay());
    });

    return gui;
}

'use strict';

/**
 * EulerDisks visualizes the relationship between two sets of principal axes (e.g., tensors) as disks and axes in 3D.
 * It supports showing all 16 equivalent ZYZ Euler angle configurations and visualizing
 * the line of nodes and rotation arcs. Designed for crystallographic and tensor visualization.
 *
 * Usage:
 *   const disks = new EulerDisks({ ...params });
 *   disks.setTensors(tensorA, tensorB);
 *   scene.add(disks);
 *
 * Parameters:
 *   - radius, thickness, color1, color2, opacity, scalingFactor, etc.
 *   - refConfig: [i, j] where i,j are integers 0-3 for specific configuration
 */

import _ from 'lodash';
import * as THREE from 'three';
import { AxesMesh } from './cell.js';
import { TextSprite } from './sprites.js';
import { RelativeTensorOrientation } from '../relative-orientation.js';

const LABEL_HEIGHT = 0.025;

class EulerDisks extends THREE.Group {

    constructor(parameters) {
        super();

        const defaults = {
            radius: 4.0,
            thickness: 0.2,
            center: [0, 0, 0],
            color1: 0xff0000,
            color2: 0x00ff00,
            opacity: 0.75,
            innerRadiusScale: 0.6,
            showCircles: true,
            showAxes: true,
            scalingFactor: 5.0,
            refConfig: null,
            // Parameters for tensor calculations
            convention: 'zyz',
            eulerActive: true,
            tolerance: 1e-6
        };
        
        this.parameters = _.merge({}, defaults, parameters);
        this.radius = this.parameters.radius;
        this.thickness = this.parameters.thickness;
        this.scalingFactor = this.parameters.scalingFactor;
        this.innerRadiusScale = this.parameters.innerRadiusScale;
        
        // Initialize storage
        this.orientation = null;
        this.configurationId = null;
        
        this.currentAxes = null;
        this.lineOfNodes = null;
        
        // Create visual elements
        this._createDisks();
        this._createAxes();
        this._createArcs();
        this._createLineOfNodesVis();
        this._createFreeRotationRings();
    }

    /**
     * Dispose of all geometries, materials, and child objects to prevent memory leaks.
     */
    dispose() {
        // Dispose disks
        if (this.disk1) {
            if (this.disk1.geometry) this.disk1.geometry.dispose();
            if (this.disk1.material) this.disk1.material.dispose();
        }
        if (this.disk1Rim) {
            if (this.disk1Rim.geometry) this.disk1Rim.geometry.dispose();
            if (this.disk1Rim.material) this.disk1Rim.material.dispose();
        }
        if (this.disk2) {
            if (this.disk2.geometry) this.disk2.geometry.dispose();
            if (this.disk2.material) this.disk2.material.dispose();
        }
        if (this.disk2Rim) {
            if (this.disk2Rim.geometry) this.disk2Rim.geometry.dispose();
            if (this.disk2Rim.material) this.disk2Rim.material.dispose();
        }
        // Dispose axes
        if (this.axes1) {
            this.axes1.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
        }
        if (this.axes2) {
            this.axes2.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) {
                        obj.material.forEach(m => m.dispose());
                    } else {
                        obj.material.dispose();
                    }
                }
            });
        }
        // Dispose arcs and line of nodes
        [this.alphaArc, this.betaArc, this.gammaArc].forEach(arcGroup => {
            if (arcGroup) {
                arcGroup.traverse(obj => {
                    if (obj.geometry) obj.geometry.dispose();
                    if (obj.material) obj.material.dispose();
                });
            }
        });
        // Dispose free-rotation rings
        [this.freeRing1, this.freeRing2].forEach(ring => {
            if (ring) {
                if (ring.geometry) ring.geometry.dispose();
                if (ring.material) ring.material.dispose();
            }
        });
        // Remove from parent
        if (this.parent) this.parent.remove(this);
    }

    /** Set the framework-independent orientation result to render. */
    setOrientation(orientation, configurationId = null) {
        if (!(orientation instanceof RelativeTensorOrientation)) {
            throw new Error('orientation must be a RelativeTensorOrientation');
        }
        this.orientation = orientation;
        this.currentAxes = {
            A: { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() },
            B: { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() }
        };
        if (orientation.orientationClass === 'continuous') {
            this._renderStatic();
            return [];
        }
        if (orientation.orientationClass !== 'discrete') {
            throw new Error(`Cannot render a ${orientation.orientationClass} orientation as Euler disks.`);
        }
        this.setConfiguration(configurationId ?? orientation.configurations[0].id);
        return this.getAllEquivalentEulerArrays();
    }

    /**
     * Render the two PAS frames statically for a continuous (axial) orientation.
     * The Euler angle arcs and line of nodes are undefined here, so they are hidden.
     * ponytail: assumes a fresh EulerDisks per orientation (MagresView recreates on
     * rebuild), so hidden arcs are not re-shown for a later discrete orientation.
     */
    _renderStatic() {
        this.configurationId = null;
        this._setFrame(this.disk1Group, this.orientation.sourceFrame);
        this._setFrame(this.disk2Group, this.orientation.targetFrame);
        this._updateCurrentAxes();
        this._updateAxesVisualization();
        this.lineOfNodesVis.visible = false;
        [this.alphaArc, this.betaArc, this.gammaArc,
            this.alphaLabel, this.betaLabel, this.gammaLabel].forEach(o => { o.visible = false; });
        // Make the free rotation of any axial PAS explicit (reference gauge).
        const free = this.orientation.freeRotation || {};
        this._updateFreeRotationRing(this.freeRing1, free.source);
        this._updateFreeRotationRing(this.freeRing2, free.target);
    }

    setConfiguration(configurationId) {
        const configuration = this.orientation?.configuration(configurationId);
        if (!configuration) throw new Error(`Unknown Euler configuration: ${configurationId}`);
        this.configurationId = configurationId;
        this._setFrame(this.disk1Group, configuration.source.frame);
        this._setFrame(this.disk2Group, configuration.target.frame);
        this._updateVisuals();
    }

    animateToConfiguration(configurationId, duration = 300) {
        const target = this.orientation?.configuration(configurationId);
        if (!target) throw new Error(`Unknown Euler configuration: ${configurationId}`);
        const source1 = this.disk1Group.quaternion.clone();
        const source2 = this.disk2Group.quaternion.clone();
        const target1 = new THREE.Quaternion().setFromRotationMatrix(this._frameMatrix(target.source.frame));
        const target2 = new THREE.Quaternion().setFromRotationMatrix(this._frameMatrix(target.target.frame));
        // Adopt the destination config now so any redraw uses the right angles.
        this.configurationId = configurationId;
        // Supersede any animation already in flight (rapid cycling): a stale loop
        // must not run its final setConfiguration and clobber the current one.
        this._animationToken = (this._animationToken || 0) + 1;
        const token = this._animationToken;
        // Arcs are only meaningful at rest; hide them while the disks move.
        [this.alphaArc, this.betaArc, this.gammaArc, this.alphaLabel,
            this.betaLabel, this.gammaLabel, this.lineOfNodesVis].forEach(o => { if (o) o.visible = false; });
        const started = performance.now();
        const animate = now => {
            if (token !== this._animationToken) return; // superseded by a newer call
            const progress = Math.min(1, (now - started) / duration);
            this.disk1Group.quaternion.copy(source1).slerp(target1, progress);
            this.disk2Group.quaternion.copy(source2).slerp(target2, progress);
            this._updateCurrentAxes();
            this._updateAxesVisualization();
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Snap to the exact frames and redraw the arcs consistently.
                this.setConfiguration(configurationId);
            }
        };
        requestAnimationFrame(animate);
    }

    /**
     * Get current Euler angles as array [alpha, beta, gamma]
     */
    getCurrentEulerAnglesArray() {
        const angles = this._getCurrentEulerAngles();
        if (!angles) return null;
        
        return [angles.alpha, angles.beta, angles.gamma];
    }

    /**
     * Get all equivalent angle arrays
     */
    getAllEquivalentEulerArrays() {
        return this.orientation?.configurations.map(configuration => configuration.euler) ?? [];
    }

    // ========== PRIVATE METHODS ==========

    _createDisks() {
        const ringGeometry = new THREE.RingGeometry(
            this.radius * this.innerRadiusScale,
            this.radius,
            64
        );
        
        // Determine if we need transparent handling
        const isTransparent = this.parameters.opacity < 0.8;
        
        // First disk - with proper depth handling
        const disk1Material = new THREE.MeshPhongMaterial({
            color: this.parameters.color1,
            side: THREE.DoubleSide,
            transparent: isTransparent,
            opacity: this.parameters.opacity,
            // depthWrite: !isTransparent, // Enable depth writing for opaque objects
            // depthTest: true,
            alphaTest: isTransparent ? 0.01 : 0, // Helps with transparency sorting
        });
        this.disk1 = new THREE.Mesh(ringGeometry, disk1Material);
        
        // Add rim for disk1 for better definition
        const rimGeometry1 = new THREE.RingGeometry(this.radius - 0.05, this.radius, 64);
        const rimMaterial1 = new THREE.MeshBasicMaterial({
            color: this.parameters.color1,
            transparent: isTransparent,
            opacity: Math.min(0.9, this.parameters.opacity + 0.1),
            side: THREE.DoubleSide,
            depthWrite: !isTransparent,
            depthTest: true
        });
        this.disk1Rim = new THREE.Mesh(rimGeometry1, rimMaterial1);
        
        // Second disk - with proper depth handling and slight offset to reduce z-fighting
        const disk2Material = new THREE.MeshPhongMaterial({
            color: this.parameters.color2,
            side: THREE.DoubleSide,
            transparent: isTransparent,
            opacity: this.parameters.opacity,
            // depthWrite: !isTransparent,
            // depthTest: true,
            alphaTest: isTransparent ? 0.01 : 0,
        });
        this.disk2 = new THREE.Mesh(ringGeometry, disk2Material);
        
        // Slightly offset second disk to prevent exact z-fighting
        this.disk2.position.z = 0.001;
        
        // Add rim for disk2
        const rimGeometry2 = new THREE.RingGeometry(this.radius - 0.05, this.radius, 64);
        const rimMaterial2 = new THREE.MeshBasicMaterial({
            color: this.parameters.color2,
            transparent: isTransparent,
            opacity: Math.min(0.9, this.parameters.opacity + 0.1),
            side: THREE.DoubleSide,
            depthWrite: !isTransparent,
            depthTest: true
        });
        this.disk2Rim = new THREE.Mesh(rimGeometry2, rimMaterial2);
        
        // Create groups for each disk
        this.disk1Group = new THREE.Group();
        this.disk2Group = new THREE.Group();
        
        this.disk1Group.add(this.disk1);
        this.disk1Group.add(this.disk1Rim);
        this.disk2Group.add(this.disk2);
        this.disk2Group.add(this.disk2Rim);
        
        // Set rendering order to ensure proper layering
        // Higher renderOrder values render on top
        this.disk1Group.renderOrder = 1;
        this.disk2Group.renderOrder = 2;
        
        this.add(this.disk1Group);
        this.add(this.disk2Group);
    }

    _setFrame(group, frame) {
        group.quaternion.setFromRotationMatrix(this._frameMatrix(frame));
        group.updateMatrixWorld(true);
    }

    _frameMatrix(frame) {
        const x = new THREE.Vector3(frame[0][0], frame[1][0], frame[2][0]);
        const y = new THREE.Vector3(frame[0][1], frame[1][1], frame[2][1]);
        const z = new THREE.Vector3(frame[0][2], frame[1][2], frame[2][2]);
        return new THREE.Matrix4().makeBasis(x, y, z);
    }

    _createAxes() {
        const axisLength = this.radius * this.scalingFactor;
        const zFactor = 1.5;
        
        const cell1 = [[axisLength, 0, 0], [0, axisLength, 0], [0, 0, axisLength * zFactor]];
        this.axes1 = new AxesMesh(cell1, {
            linewidth: 3.0,  // Thicker lines
            labels: ["x_A", "y_A", "z_A"],
            xColor: this.parameters.color1,
            yColor: this.parameters.color1,
            zColor: this.parameters.color1,
            bothWays: false,  // Only show positive direction for clarity
            opacity: 0.8  // Semi-transparent
        });

        const cell2 = [[axisLength, 0, 0], [0, axisLength, 0], [0, 0, axisLength * zFactor]];
        this.axes2 = new AxesMesh(cell2, {
            linewidth: 3.0,
            labels: ["x_B", "y_B", "z_B"],
            xColor: this.parameters.color2,
            yColor: this.parameters.color2,
            zColor: this.parameters.color2,
            bothWays: false,
            opacity: 0.8
        });

        // Make Z-axes more prominent (they're most important for Euler angles)
        this.axes1.traverse(child => {
            if (child.name && child.name.includes('z')) {
                child.material.linewidth = 5.0;
            }
        });
        
        this.axes2.traverse(child => {
            if (child.name && child.name.includes('z')) {
                child.material.linewidth = 5.0;
            }
        });

        this.add(this.axes1);
        this.add(this.axes2);
    }

    _createLineOfNodesVis() {
        const lineOfNodesDir = new THREE.Vector3(0, 1, 0);
        const lineOfNodesOrigin = new THREE.Vector3(0, 0, 0);
        const lineOfNodesLength = 1.5 * this.scalingFactor;

        // Main line of nodes arrow
        this.lineOfNodesVis = new THREE.ArrowHelper(
            lineOfNodesDir,
            lineOfNodesOrigin,
            lineOfNodesLength,
            0x888888,  // Darker gray
            lineOfNodesLength * 0.1,  // Head length
            lineOfNodesLength * 0.05   // Head width
        );

        this.add(this.lineOfNodesVis);
    }

    /**
     * Rings that make the "reference gauge" explicit for an axially symmetric
     * (degenerate) PAS: rotation about the unique axis is physically free, so the
     * displayed transverse axes are arbitrary. Each ring is a child of its disk
     * group, so it inherits the frame orientation; it encircles the unique axis
     * to signal the free rotation. Hidden except in the continuous static render.
     */
    _createFreeRotationRings() {
        const makeRing = (color) => {
            const geometry = new THREE.TorusGeometry(this.radius * 0.78, this.radius * 0.02, 12, 64);
            const material = new THREE.MeshBasicMaterial({
                color, transparent: true, opacity: 0.85, depthTest: false
            });
            const ring = new THREE.Mesh(geometry, material);
            ring.renderOrder = 10000;
            ring.visible = false;
            return ring;
        };
        this.freeRing1 = makeRing(this.parameters.color1);
        this.freeRing2 = makeRing(this.parameters.color2);
        this.disk1Group.add(this.freeRing1);
        this.disk2Group.add(this.freeRing2);
    }

    /**
     * Orient and show a free-rotation ring so it encircles the unique axis of an
     * axial PAS (in the disk group's local frame), or hide it when the tensor is
     * not axial. `symmetry` is orientation.freeRotation.source/target or null.
     */
    _updateFreeRotationRing(ring, symmetry) {
        if (!ring) return;
        if (!symmetry || symmetry.class !== 'axial') {
            ring.visible = false;
            return;
        }
        // The torus encircles local z by default. symmetry.uniqueAxis is 0 (local
        // x) or 2 (local z); for the x case tilt the ring 90° about y.
        ring.rotation.set(0, 0, 0);
        if (symmetry.uniqueAxis === 0) ring.rotation.y = Math.PI / 2;
        ring.visible = true;
    }

    _createArcs() {
        this.arcs = new THREE.Group();
        
        // // Create thicker, more visible arc materials
        // const alphaMaterial = new THREE.MeshBasicMaterial({ 
        //     color: 0xe74c3c,
        //     transparent: true,
        //     opacity: 0.8
        // });
        // const betaMaterial = new THREE.MeshBasicMaterial({ 
        //     color: 0x2ecc71,
        //     transparent: true,
        //     opacity: 0.8
        // });
        // const gammaMaterial = new THREE.MeshBasicMaterial({ 
        //     color: 0x3498db,
        //     transparent: true,
        //     opacity: 0.8
        // });
        
        // Create tube geometries for thicker arcs
        this.alphaArc = new THREE.Group();
        this.betaArc = new THREE.Group();
        this.gammaArc = new THREE.Group();
        
        this.arcs.add(this.alphaArc);
        this.arcs.add(this.betaArc);
        this.arcs.add(this.gammaArc);

        // Add labels with better visibility
        const labelParams = {
            faceCamera: true,
            fixScale: true,
            shift: [0.0, 0, 0.5],
            height: LABEL_HEIGHT * 1.5,  // Larger labels
            onOverlay: true
        };
        
        this.alphaLabel = new TextSprite("α", { 
            ...labelParams, 
            color: 0xe74c3c,
            backgroundColor: 0x000000,
            backgroundOpacity: 0.7
        });
        this.betaLabel = new TextSprite("β", { 
            ...labelParams, 
            color: 0x2ecc71,
            backgroundColor: 0x000000,
            backgroundOpacity: 0.7
        });
        this.gammaLabel = new TextSprite("γ", { 
            ...labelParams, 
            color: 0x3498db,
            backgroundColor: 0x000000,
            backgroundOpacity: 0.7
        });

        this.arcs.add(this.alphaLabel);
        this.arcs.add(this.betaLabel);
        this.arcs.add(this.gammaLabel);

        this.add(this.arcs);
    }

    _updateVisuals() {
        this._updateCurrentAxes();
        this._updateArcs();
        this._updateAxesVisualization();
    }

    // Show the free-rotation ring on an axial side (unique axis on Z in the
    // discrete path, so no tilt), or hide it. `gauge` is configuration.gauge.
    _updateGaugeRings(gauge) {
        if (this.freeRing1) {
            this.freeRing1.rotation.set(0, 0, 0);
            this.freeRing1.visible = !!(gauge && gauge.axialSource);
        }
        if (this.freeRing2) {
            this.freeRing2.rotation.set(0, 0, 0);
            this.freeRing2.visible = !!(gauge && gauge.axialTarget);
        }
    }

    // Rotate a vector about an axis by an angle (radians), returning a unit vector.
    _rotateVec(vec, axis, angle) {
        const q = new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), angle);
        return vec.clone().normalize().applyQuaternion(q);
    }

    _updateCurrentAxes() {
        if (!this.currentAxes) return;
        
        // Update current axes based on disk orientations
        this.currentAxes.A.x.set(1, 0, 0).applyQuaternion(this.disk1Group.quaternion);
        this.currentAxes.A.y.set(0, 1, 0).applyQuaternion(this.disk1Group.quaternion);
        this.currentAxes.A.z.set(0, 0, 1).applyQuaternion(this.disk1Group.quaternion);

        this.currentAxes.B.x.set(1, 0, 0).applyQuaternion(this.disk2Group.quaternion);
        this.currentAxes.B.y.set(0, 1, 0).applyQuaternion(this.disk2Group.quaternion);
        this.currentAxes.B.z.set(0, 0, 1).applyQuaternion(this.disk2Group.quaternion);
        
        // Force matrix updates
        this.disk1Group.updateMatrixWorld(true);
        this.disk2Group.updateMatrixWorld(true);
    }

    _updateArcs() {
        const arcs = [this.alphaArc, this.betaArc, this.gammaArc];
        const labels = [this.alphaLabel, this.betaLabel, this.gammaLabel];
        const configuration = this.orientation?.configuration(this.configurationId);

        const gauge = configuration ? configuration.gauge : null;
        // Free-rotation ring flags an axial side's gauged angle in every state.
        this._updateGaugeRings(gauge);

        // No arcs for a missing/singular configuration: at β≈0/180 the line of
        // nodes and the separate α/γ rotations are undefined.
        if (!this.orientation || !this.currentAxes || !configuration || configuration.singular.isSingular) {
            [...arcs, ...labels].forEach(o => { o.visible = false; });
            if (this.lineOfNodesVis) this.lineOfNodesVis.visible = false;
            this.lineOfNodes = null;
            return;
        }
        [...arcs, ...labels].forEach(o => { o.visible = true; });

        const angles = this._getCurrentEulerAngles();
        const arcRadius = this.radius * 0.7;
        const sequence = this.orientation.specification.sequence;
        const active = this.orientation.specification.active;

        // Active angles describe the source→target rotation (α about z_A first,
        // γ about z_B last). Passive angles describe the same orientation as the
        // inverse (target→source), so the first/last roles swap: α is about z_B
        // and γ about z_A. Drawing with the matching roles keeps the arcs landing
        // exactly on the displayed axes for both conventions.
        const A = this.currentAxes.A, B = this.currentAxes.B;
        const zFirst = (active ? A.z : B.z).clone();
        const zLast = (active ? B.z : A.z).clone();
        const refFirst = (sequence === 'zxz' ? (active ? A.x : B.x) : (active ? A.y : B.y)).clone();
        const refLast = (sequence === 'zxz' ? (active ? B.x : A.x) : (active ? B.y : A.y)).clone();

        // Line of nodes = axis of the second rotation = Rz_first(alpha)·refFirst.
        // When alpha is a free gauge fixed to 0, refFirst is arbitrary, so use the
        // true line of nodes (zFirst × zLast) so the beta arc still spans the axes.
        const node = (gauge && gauge.zeroed && gauge.zeroed.alpha)
            ? new THREE.Vector3().crossVectors(zFirst, zLast).normalize()
            : this._rotateVec(refFirst, zFirst, angles.alpha);
        this.lineOfNodes = node.clone();
        if (this.lineOfNodesVis) {
            this.lineOfNodesVis.visible = true;
            this.lineOfNodesVis.setDirection(node);
            this.lineOfNodesVis.setLength(this.radius * 1.5);
        }

        // α: about zFirst, from refFirst to the node.
        // β: about the node, from zFirst to zLast.
        // γ: about zLast, from the node to refLast.
        const alphaPoints = this._createArcPoints(zFirst, angles.alpha, refFirst, arcRadius);
        const betaPoints = this._createArcPoints(node, angles.beta, zFirst, arcRadius);
        const gammaPoints = this._createArcPoints(zLast, angles.gamma, node, arcRadius);

        this._updateArcGeometry(this.alphaArc, alphaPoints, 0xe74c3c);
        this._updateArcGeometry(this.betaArc, betaPoints, 0x2ecc71);
        this._updateArcGeometry(this.gammaArc, gammaPoints, 0x3498db);

        this._updateArcLabels(angles, alphaPoints, betaPoints, gammaPoints);

        // A gauged (zeroed) angle is a free axial rotation, not a real arc: hide
        // it; the free-rotation ring communicates the freedom instead.
        if (gauge && gauge.zeroed) {
            if (gauge.zeroed.alpha) { this.alphaArc.visible = false; this.alphaLabel.visible = false; }
            if (gauge.zeroed.gamma) { this.gammaArc.visible = false; this.gammaLabel.visible = false; }
        }
    }

    _createArcPoints(axis, angle, startVec, radius, steps = 64) {
        const points = [];
        const normalizedStartVec = startVec.clone().normalize();
        const sign = Math.sign(angle);
        const absAngle = Math.abs(angle);

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const quat = new THREE.Quaternion()
                .setFromAxisAngle(axis, sign * t * absAngle);
            const point = normalizedStartVec.clone()
                .applyQuaternion(quat)
                .multiplyScalar(radius);
            points.push(point);
        }
        return points;
    }

    _updateArcGeometry(arcGroup, points, color) {
        // Clear previous geometry
        arcGroup.children.forEach(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
        arcGroup.clear();

        if (points.length < 2) return;

        // Thick tube, drawn on top of the disks/axes so the arcs stay prominent.
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeRadius = Math.max(0.08, this.radius * 0.04);
        const tubeGeometry = new THREE.TubeGeometry(curve, points.length - 1, tubeRadius, 12, false);
        const tubeMaterial = new THREE.MeshBasicMaterial({
            color: color,
            depthTest: false,
            transparent: false
        });

        const tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
        tubeMesh.renderOrder = 10000;
        arcGroup.add(tubeMesh);
    }

    _updateArcLabels(angles, alphaPoints, betaPoints, gammaPoints) {
        this.alphaLabel.text = `α = ${this._formatAngleDegrees(angles.alpha)}`;
        this.betaLabel.text = `β = ${this._formatAngleDegrees(angles.beta)}`;
        this.gammaLabel.text = `γ = ${this._formatAngleDegrees(angles.gamma)}`;

        if (alphaPoints.length > 0) {
            this.alphaLabel.position.copy(alphaPoints[Math.floor(alphaPoints.length / 2)]);
        }
        if (betaPoints.length > 0) {
            this.betaLabel.position.copy(betaPoints[Math.floor(betaPoints.length / 2)]);
        }
        if (gammaPoints.length > 0) {
            this.gammaLabel.position.copy(gammaPoints[Math.floor(gammaPoints.length / 2)]);
        }
    }

    _updateAxesVisualization() {
        if (!this.axes1 || !this.axes2) return;
        
        // Update axes to match disk orientations
        this.axes1.position.copy(this.disk1Group.position);
        this.axes2.position.copy(this.disk2Group.position);
        
        this.axes1.setRotationFromQuaternion(this.disk1Group.quaternion);
        this.axes2.setRotationFromQuaternion(this.disk2Group.quaternion);
        
        this.axes1.updateMatrixWorld(true);
        this.axes2.updateMatrixWorld(true);
    }

    /**
     * Get current Euler angles for the active configuration
     */
    _getCurrentEulerAngles() {
        const configuration = this.orientation?.configuration(this.configurationId);
        if (!configuration) return null;
        const [alpha, beta, gamma] = configuration.euler;
        return { alpha, beta, gamma };
    }

    _formatAngleDegrees(angleRadians, precision = 1) {
        const degrees = angleRadians * 180 / Math.PI;
        return degrees.toFixed(precision) + '°';
    }
}

// Static constants
EulerDisks.DITHER = 'dither';
EulerDisks.TRANSPARENT = 'transparent';

export { EulerDisks };
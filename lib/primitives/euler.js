'use strict';

/**
 * EulerDisks visualizes the relationship between two sets of principal axes (e.g., tensors) as disks and axes in 3D.
 * It supports showing all 16 equivalent ZYZ Euler angle configurations, animating between configurations, and visualizing
 * the line of nodes and rotation arcs. Designed for crystallographic and tensor visualization.
 *
 * Usage:
 *   const disks = new EulerDisks({ ...params });
 *   disks.setTensors(tensorA, tensorB);
 *   scene.add(disks);
 *
 * Parameters:
 *   - radius, thickness, color1, color2, opacity, scalingFactor, etc.
 *   - debug: boolean (optional) - enables debug logging
 *   - refConfig: [i, j] where i,j are integers 0-3 for specific configuration
 */

import _ from 'lodash';
import * as THREE from 'three';
import { AxesMesh } from './cell.js';
import { TextSprite } from './sprites.js';

import { DitherMaterial } from './dither.js';
import { TensorData } from '../tensor.js';

const LABEL_HEIGHT = 0.025;
const AXES_SCALE = 1.5;

const pi = Math.PI;
const twoPi = 2 * Math.PI;

class EulerDisks extends THREE.Group {

    /**
     * Dispose of all geometries, materials, and child objects to prevent memory leaks.
     */
    dispose() {
        // Dispose disks
        if (this.disk1) {
            if (this.disk1.geometry) this.disk1.geometry.dispose();
            if (this.disk1.material) this.disk1.material.dispose();
        }
        if (this.disk2) {
            if (this.disk2.geometry) this.disk2.geometry.dispose();
            if (this.disk2.material) this.disk2.material.dispose();
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
        // Dispose arcs
        if (this.alphaArc && this.alphaArc.geometry) this.alphaArc.geometry.dispose();
        if (this.betaArc && this.betaArc.geometry) this.betaArc.geometry.dispose();
        if (this.gammaArc && this.gammaArc.geometry) this.gammaArc.geometry.dispose();
        // Remove from parent
        if (this.parent) this.parent.remove(this);
    }

    constructor(parameters) {
        super();

        const defaults = {
            radius: 4.0,
            thickness: 0.1,
            center: [0, 0, 0],
            color1: 0xff0000,
            color2: 0x00ff00,
            opacity: 0.75,
            opacityMode: EulerDisks.DITHER,
            innerRadiusScale: 0.75,
            showCircles: true,
            showAxes: true,
            scalingFactor: 5.0,
            passive: false,
            refConfig: null,
            debug: true,
            // Parameters for tensor calculations - should match your downstream app
            convention: 'zyz',
            eulerActive: true, // Default to active (true) to match typical usage
            tolerance: 1e-6
        };
        
        parameters = _.merge({}, defaults, parameters);
        this.parameters = parameters;
        this.debug = parameters.debug;

        this.radius = parameters.radius;
        this.thickness = parameters.thickness;
        this.scalingFactor = parameters.scalingFactor;
        this.innerRadiusScale = parameters.innerRadiusScale;
        
        // Initialize storage for tensors and equivalent angles
        this.tensor1 = null;
        this.tensor2 = null;
        this.equivalentAngles = null;
        
        // Initialize current configuration - validate refConfig
        this.currentConfig = this.validateRefConfig(parameters.refConfig) ? 
            parameters.refConfig.slice() : [0, 0];
        
        // Initialize reference rotations
        this._referenceDisk1Rotation = null;
        this._referenceDisk2Rotation = null;
        
        // Initialize current axes storage
        this.currentAxes = null;
        this.lineOfNodes = null;
        
        // Create the visual elements
        this.createDisks();
        this.createAxes();
        this.createArcs();
        this.createLineOfNodesVis();
    }

    /**
     * Validate reference configuration format
     */
    validateRefConfig(refConfig) {
        return Array.isArray(refConfig) && 
               refConfig.length === 2 &&
               Number.isInteger(refConfig[0]) && 
               Number.isInteger(refConfig[1]) &&
               refConfig[0] >= 0 && refConfig[0] <= 3 &&
               refConfig[1] >= 0 && refConfig[1] <= 3;
    }

    getConfigurationIndex() {
        return this.currentConfig[0] * 4 + this.currentConfig[1];
    }

    setConfigurationIndex(index) {
        const i = Math.floor(index / 4);
        const j = index % 4;
        this.setConfiguration(i, j);
    }
    getAllEquivalentAngles() {
        return this.equivalentAngles.map(set => ({
            config: set.configIndex,
            index: set.linearIndex,
            angles: [...set.rawAngles]
        }));
    }

    synchronizeWithDownstreamApp(selectedIndex) {
    if (selectedIndex >= 0 && selectedIndex < 16) {
        this.setConfigurationIndex(selectedIndex);
        return this.getCurrentEulerAnglesArray();
    }
    return null;
}

    createDisks() {
        const ringGeometry = new THREE.RingGeometry(
            this.radius * this.innerRadiusScale,
            this.radius,
            64
        );
        
        // First disk
        const disk1Material = new THREE.MeshPhongMaterial({
            color: this.parameters.color1,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: this.parameters.opacity
        });
        this.disk1 = new THREE.Mesh(ringGeometry, disk1Material);
        
        // Second disk
        const disk2Material = new THREE.MeshPhongMaterial({
            color: this.parameters.color2,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: this.parameters.opacity
        });
        this.disk2 = new THREE.Mesh(ringGeometry, disk2Material);
        
        // Create groups for each disk
        this.disk1Group = new THREE.Group();
        this.disk2Group = new THREE.Group();
        
        this.disk1Group.add(this.disk1);
        this.disk2Group.add(this.disk2);
        
        this.add(this.disk1Group);
        this.add(this.disk2Group);
    }

    setTensors(tensor1, tensor2) {
        if (!this.isValidTensor(tensor1) || !this.isValidTensor(tensor2)) {
            throw new Error('Input tensors must be of type TensorData');
        }
        
        this.tensor1 = tensor1;
        this.tensor2 = tensor2;

        // Initialize current axes storage
        this.currentAxes = {
            A: { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() },
            B: { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() }
        };

        // Align disks to eigenvectors (reference orientation)
        this.alignDiskToEigenvectors(this.disk1Group, this.tensor1.eigenvectors);
        this.alignDiskToEigenvectors(this.disk2Group, this.tensor2.eigenvectors);

        // Store reference orientations
        this._referenceDisk1Rotation = this.disk1Group.quaternion.clone();
        this._referenceDisk2Rotation = this.disk2Group.quaternion.clone();

        // Get all equivalent angles from tensors AFTER setting reference orientations
        this.calculateEquivalentAngles();

        // Defer configuration setup to next tick
        this.setConfiguration(this.currentConfig[0], this.currentConfig[1]);
        if (this.debug) {
            console.log(`Configuration [${this.currentConfig[0]}, ${this.currentConfig[1]}] applied`);
        }

        return this.getAllEquivalentAngles();
    }

    /**
     * Calculate all equivalent angles from tensors once and cache them
     * Uses the same parameters as the downstream application
     */
    calculateEquivalentAngles() {
        try {
            // Use the same parameters as your downstream app
            const convention = this.parameters.convention || 'zyz';
            const active = this.parameters.eulerActive !== undefined ? this.parameters.eulerActive : true; // Default to active (true)
            const tolerance = this.parameters.tolerance || 1e-6;
            
            if (this.debug) {
                console.log(`Calculating equivalent angles with: convention='${convention}', active=${active}, tolerance=${tolerance}`);
            }
            
            const rawAngles = this.tensor1.equivalentEulerTo(
                this.tensor2, convention, active, tolerance, false
            );
            
            this.equivalentAngles = [];
            
            for (let i = 0; i < Math.min(16, rawAngles.length); i++) {
                const [alpha, beta, gamma] = rawAngles[i];
                const disk1Index = Math.floor(i / 4);
                const disk2Index = i % 4;
                
                this.equivalentAngles.push({
                    configIndex: [disk1Index, disk2Index],
                    linearIndex: i,
                    angles: {
                        alpha: alpha, // Don't normalize - keep original values
                        beta: beta,
                        gamma: gamma
                    },
                    rawAngles: [alpha, beta, gamma] // Store raw values for comparison
                });
            }

            if (this.debug) {
                console.log(`Calculated ${this.equivalentAngles.length} equivalent angle sets using convention '${convention}', active=${active}`);
                console.log('All equivalent angles (degrees):', 
                    this.equivalentAngles.map((set, idx) => ({
                        index: idx,
                        config: set.configIndex,
                        angles: [
                            set.angles.alpha * 180 / Math.PI,
                            set.angles.beta * 180 / Math.PI, 
                            set.angles.gamma * 180 / Math.PI
                        ]
                    }))
                );
                
                // Log the specific reference config angles
                const refLinearIndex = this.currentConfig[0] * 4 + this.currentConfig[1];
                const refAngles = this.equivalentAngles[refLinearIndex];
                if (refAngles) {
                    console.log(`Reference config [${this.currentConfig[0]}, ${this.currentConfig[1]}] (linear index ${refLinearIndex}) angles:`, 
                        refAngles.rawAngles.map(a => a * 180 / Math.PI));
                }
            }
            
        } catch (error) {
            console.error("Error calculating equivalent angles:", error);
            this.equivalentAngles = [];
        }
    }

    /**
     * Get configuration rotations that match tensor calculations
     */
    getConfigurationRotation(configIndex) {
        const rotations = [
            new THREE.Quaternion(), // 0: Identity
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), Math.PI), // 1: X flip
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI), // 2: Y flip
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1).normalize(), Math.PI) // 3: Z flip
        ];
        
        return rotations[configIndex] || new THREE.Quaternion();
    }

    setConfiguration(i, j) {
        if (!this._referenceDisk1Rotation || !this._referenceDisk2Rotation) return;

        // Validate indices
        if (i < 0 || i > 3 || j < 0 || j > 3) return;

        // Get rotations in LOCAL principal axes frame
        const configRot1 = this.getConfigurationRotation(i);
        const configRot2 = this.getConfigurationRotation(j);

        // Apply in local frame: reference * localRotation
        this.disk1Group.quaternion.copy(this._referenceDisk1Rotation)
            .multiply(configRot1);
        this.disk2Group.quaternion.copy(this._referenceDisk2Rotation)
            .multiply(configRot2);

        this.currentConfig = [i, j];
        
        // Force updates
        this.disk1Group.updateMatrixWorld(true);
        this.disk2Group.updateMatrixWorld(true);
        
        // Update visualizations
        this.updateVisuals();
    }

    alignDiskToEigenvectors(diskGroup, eigenvectors) {
        // Create orthonormal basis from eigenvectors
        const basis = [
            new THREE.Vector3(eigenvectors[0][0], eigenvectors[1][0], eigenvectors[2][0]).normalize(),
            new THREE.Vector3(eigenvectors[0][1], eigenvectors[1][1], eigenvectors[2][1]).normalize(),
            new THREE.Vector3(eigenvectors[0][2], eigenvectors[1][2], eigenvectors[2][2]).normalize()
        ];
        
        // Ensure right-handed coordinate system
        const cross = new THREE.Vector3().crossVectors(basis[0], basis[1]);
        if (cross.dot(basis[2]) < 0) {
            basis[2].negate();
        }
        
        // Create and apply rotation matrix
        const rotMatrix = new THREE.Matrix4().makeBasis(basis[0], basis[1], basis[2]);
        const quaternion = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);
        diskGroup.setRotationFromQuaternion(quaternion);
    }

    createAxes() {
        const axisLength = this.radius * this.scalingFactor;
        const zFactor = 1.5;
        
        const cell1 = [[axisLength, 0, 0], [0, axisLength, 0], [0, 0, axisLength * zFactor]];
        this.axes1 = new AxesMesh(cell1, {
            linewidth: 2.0,
            labels: ["x_A", "y_A", "z_A"],
            xColor: this.parameters.color1,
            yColor: this.parameters.color1,
            zColor: this.parameters.color1,
            bothWays: true,
        });

        const cell2 = [[axisLength, 0, 0], [0, axisLength, 0], [0, 0, axisLength * zFactor]];
        this.axes2 = new AxesMesh(cell2, {
            linewidth: 2.0,
            labels: ["x_B", "y_B", "z_B"],
            xColor: this.parameters.color2,
            yColor: this.parameters.color2,
            zColor: this.parameters.color2,
            bothWays: true,
        });

        this.add(this.axes1);
        this.add(this.axes2);
    }

    createLineOfNodesVis() {
        const lineOfNodesDir = new THREE.Vector3(0, 1, 0);
        const lineOfNodesOrigin = new THREE.Vector3(0, 0, 0);
        const lineOfNodesLength = AXES_SCALE * this.scalingFactor;

        this.lineOfNodesVis = new THREE.ArrowHelper(
            lineOfNodesDir,
            lineOfNodesOrigin,
            lineOfNodesLength,
            0xD3D3D3
        );

        this.add(this.lineOfNodesVis);
    }

    createArcs() {
        this.arcs = new THREE.Group();
        
        // Create materials for arcs
        const alphaMaterial = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 4 });
        const betaMaterial = new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 4 });
        const gammaMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 4 });
        
        // Initialize arcs
        this.alphaArc = new THREE.Line(new THREE.BufferGeometry(), alphaMaterial);
        this.betaArc = new THREE.Line(new THREE.BufferGeometry(), betaMaterial);
        this.gammaArc = new THREE.Line(new THREE.BufferGeometry(), gammaMaterial);
        
        this.arcs.add(this.alphaArc);
        this.arcs.add(this.betaArc);
        this.arcs.add(this.gammaArc);

        // Add labels
        const labelParams = {
            faceCamera: true,
            fixScale: true,
            shift: [0.0, 0, 0.5],
            height: LABEL_HEIGHT,
            onOverlay: true
        };
        
        this.alphaLabel = new TextSprite("α", { ...labelParams, color: 0xffff00 });
        this.betaLabel = new TextSprite("β", { ...labelParams, color: 0xff00ff });
        this.gammaLabel = new TextSprite("γ", { ...labelParams, color: 0x00ffff });

        this.arcs.add(this.alphaLabel);
        this.arcs.add(this.betaLabel);
        this.arcs.add(this.gammaLabel);

        this.add(this.arcs);
    }

    updateVisuals() {
        this.updateCurrentAxes();
        this.updateLineOfNodes();
        this.updateArcs();
        this.updateAxesVisualization();
    }

    updateCurrentAxes() {
        if (!this.currentAxes) return;
        
        // Update current axes based on disk orientations
        this.currentAxes.A.x.set(1, 0, 0).applyQuaternion(this.disk1Group.quaternion);
        this.currentAxes.A.y.set(0, 1, 0).applyQuaternion(this.disk1Group.quaternion);
        this.currentAxes.A.z.set(0, 0, 1).applyQuaternion(this.disk1Group.quaternion);

        this.currentAxes.B.x.set(1, 0, 0).applyQuaternion(this.disk2Group.quaternion);
        this.currentAxes.B.y.set(0, 1, 0).applyQuaternion(this.disk2Group.quaternion);
        this.currentAxes.B.z.set(0, 0, 1).applyQuaternion(this.disk2Group.quaternion);
    }

    updateLineOfNodes() {
        if (!this.currentAxes) return;
        
        const z_A = this.currentAxes.A.z;
        const z_B = this.currentAxes.B.z;

        // Calculate line of nodes as cross product of z-axes
        this.lineOfNodes = new THREE.Vector3().crossVectors(z_A, z_B);

        // Handle near-parallel case
        if (this.lineOfNodes.length() < 0.001) {
            this.lineOfNodes.copy(this.currentAxes.A.y);
        }
        
        this.lineOfNodes.normalize();
        
        // Update visualization
        if (this.lineOfNodesVis) {
            this.lineOfNodesVis.setDirection(this.lineOfNodes);
            this.lineOfNodesVis.setLength(this.radius * 1.5);
        }
    }

    updateArcs() {
        if (!this.equivalentAngles || !this.currentAxes || !this.lineOfNodes) {
            return;
        }

        // Get angles for current configuration directly from tensor calculations
        const angles = this.getCurrentEulerAngles();
        if (!angles) {
            console.warn("Could not get current Euler angles");
            return;
        }

        if (this.debug) {
            console.log(`Updating arcs with angles: α=${this.formatAngleDegrees(angles.alpha)}, β=${this.formatAngleDegrees(angles.beta)}, γ=${this.formatAngleDegrees(angles.gamma)}`);
        }

        const arcRadius = this.radius * 0.6;
        
        // Get current axes
        const z_A = this.currentAxes.A.z.clone();
        const z_B = this.currentAxes.B.z.clone();
        const y_A = this.currentAxes.A.y.clone();
        const lineOfNodesVector = this.lineOfNodes.clone();
        
        // Create arc geometries
        const alphaPoints = this.createArcPoints(z_A, angles.alpha, y_A, arcRadius);
        const betaPoints = this.createArcPoints(lineOfNodesVector, angles.beta, z_B, arcRadius);
        const gammaPoints = this.createArcPoints(z_B, angles.gamma, lineOfNodesVector, arcRadius);
        
        // Update arc geometries
        this.updateArcGeometry(this.alphaArc, alphaPoints);
        this.updateArcGeometry(this.betaArc, betaPoints);
        this.updateArcGeometry(this.gammaArc, gammaPoints);
        
        // Update labels
        this.updateArcLabels(angles, alphaPoints, betaPoints, gammaPoints);
    }

    createArcPoints(axis, angle, startVec, radius, steps = 32) {
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

    updateArcGeometry(arc, points) {
        if (arc.geometry) arc.geometry.dispose();
        arc.geometry = new THREE.BufferGeometry().setFromPoints(points);
    }

    updateArcLabels(angles, alphaPoints, betaPoints, gammaPoints) {
        this.alphaLabel.text = `α = ${this.formatAngleDegrees(angles.alpha)}`;
        this.betaLabel.text = `β = ${this.formatAngleDegrees(angles.beta)}`;
        this.gammaLabel.text = `γ = ${this.formatAngleDegrees(angles.gamma)}`;

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

    updateAxesVisualization() {
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
     * Returns the same format as MV2 expects
     */
    getCurrentEulerAngles() {
        if (!this.equivalentAngles || this.equivalentAngles.length === 0) {
            if (this.debug) {
                console.warn("No equivalent angles available.");
            }
            return null;
        }

        const linearIndex = this.currentConfig[0] * 4 + this.currentConfig[1];
        
        // Use direct array indexing instead of find()
        if (linearIndex < this.equivalentAngles.length) {
            const angleSet = this.equivalentAngles[linearIndex];
            if (this.debug) {
                console.log(`Getting angles for config [${this.currentConfig[0]}, ${this.currentConfig[1]}] (linear ${linearIndex}):`, 
                    angleSet.rawAngles.map(a => a * 180 / Math.PI));
            }
            return angleSet.angles;
        }

        // Improved error logging
        console.error(`No angle set found for configuration [${this.currentConfig[0]}, ${this.currentConfig[1]}] (linear index ${linearIndex})`);
        console.log('Available angle sets:', this.equivalentAngles.map((set, idx) => 
            `[${set.configIndex[0]}, ${set.configIndex[1]}] (linear ${idx}): ${set.rawAngles.map(a => (a*180/Math.PI).toFixed(1)).join(', ')}�`
        ));
        return null;
    }

    /**
     * Get current Euler angles as array [alpha, beta, gamma] to match downstream usage
     */
    getCurrentEulerAnglesArray() {
        const angles = this.getCurrentEulerAngles();
        if (!angles) return null;
        
        return [angles.alpha, angles.beta, angles.gamma];
    }

    /**
     * Get all equivalent angle arrays (matching your downstream all_equivalent_eulers format)
     */
    getAllEquivalentEulerArrays() {
        if (!this.equivalentAngles) return [];
        
        return this.equivalentAngles
            .sort((a, b) => a.linearIndex - b.linearIndex)
            .map(set => [set.angles.alpha, set.angles.beta, set.angles.gamma]);
    }

    /**
     * Get all available configurations with their angles
     */
    getAllConfigurations() {
        return this.equivalentAngles || [];
    }

    /**
     * Set configuration by linear index (0-15)
     */
    setConfigurationByIndex(index) {
        if (index < 0 || index >= 16) {
            console.error(`Configuration index ${index} out of range (0-15)`);
            return;
        }
        
        const disk1Index = Math.floor(index / 4);
        const disk2Index = index % 4;
        this.setConfiguration(disk1Index, disk2Index);
    }

    /**
     * Get the current configuration as a linear index (0-15)
     */
    getCurrentConfigurationIndex() {
        return this.currentConfig[0] * 4 + this.currentConfig[1];
    }

    /**
     * Cycle through all 16 equivalent configurations
     */
    cycleThroughConfigurations() {
        const currentIndex = this.getCurrentConfigurationIndex();
        const nextIndex = (currentIndex + 1) % 16;
        this.setConfigurationByIndex(nextIndex);
    }

    /**
     * Apply a specific reference configuration
     */
    applyReferenceConfiguration(refConfig) {
        if (!this.validateRefConfig(refConfig)) {
            console.error('Invalid reference configuration. Expected [i,j] where i,j are integers between 0 and 3.');
            return;
        }
        
        this.setConfiguration(refConfig[0], refConfig[1]);
        
        if (this.debug) {
            console.log(`Applied reference configuration [${refConfig[0]}, ${refConfig[1]}]`);
        }
    }

    // Utility methods
    isValidTensor(tensor) {
        return tensor instanceof TensorData;
    }

    normalizeAngle(angle) {
        while (angle > twoPi) angle -= twoPi;
        while (angle < 0) angle += twoPi;
        return angle;
    }

    formatAngleDegrees(angleRadians, precision = 3) {
        // Don't normalize - display the raw angle value
        const degrees = angleRadians * 180 / Math.PI;
        return degrees.toFixed(precision) + '°';
    }

    /**
     * Validate that the visualization angles match the expected reference angles
     * Call this with your external calculation results for comparison
     */
    validateAgainstReference(externalAngles, refConfigIndex) {
        const currentAngles = this.getCurrentEulerAngles();
        const linearIndex = this.currentConfig[0] * 4 + this.currentConfig[1];
        
        console.log('=== ANGLE VALIDATION ===');
        console.log(`Current config: [${this.currentConfig[0]}, ${this.currentConfig[1]}] (linear index: ${linearIndex})`);
        console.log(`Expected config index: ${refConfigIndex}`);
        
        if (currentAngles && externalAngles) {
            const currentDegrees = [
                currentAngles.alpha * 180 / Math.PI,
                currentAngles.beta * 180 / Math.PI,
                currentAngles.gamma * 180 / Math.PI
            ];
            
            const externalDegrees = externalAngles.map(a => a * 180 / Math.PI);
            
            console.log('Visualization angles (degrees):', currentDegrees);
            console.log('Expected angles (degrees):', externalDegrees);
            
            const differences = currentDegrees.map((curr, i) => Math.abs(curr - externalDegrees[i]));
            console.log('Differences (degrees):', differences);
            
            const tolerance = 0.1; // degrees
            const match = differences.every(diff => diff < tolerance);
            console.log(`Angles match within ${tolerance}°:`, match);
            
            return match;
        } else {
            console.log('Could not compare - missing angle data');
            return false;
        }
    }
}

// Static constants
EulerDisks.DITHER = 'dither';
EulerDisks.TRANSPARENT = 'transparent';

export { EulerDisks };
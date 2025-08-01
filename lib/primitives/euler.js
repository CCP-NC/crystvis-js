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
import { TensorData } from '../tensor.js';

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
        this.tensor1 = null;
        this.tensor2 = null;
        this.equivalentAngles = null;
        
        // Initialize current configuration
        this.currentConfig = this._validateRefConfig(this.parameters.refConfig) ? 
            this.parameters.refConfig.slice() : [0, 0];
        
        // Initialize reference rotations and axes storage
        this._referenceDisk1Rotation = null;
        this._referenceDisk2Rotation = null;
        this.currentAxes = null;
        this.lineOfNodes = null;
        
        // Create visual elements
        this._createDisks();
        this._createAxes();
        this._createArcs();
        this._createLineOfNodesVis();
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
        // Remove from parent
        if (this.parent) this.parent.remove(this);
    }

    /**
     * Set tensors and calculate equivalent angles
     */
    setTensors(tensor1, tensor2) {
        if (!this._isValidTensor(tensor1) || !this._isValidTensor(tensor2)) {
            throw new Error('Input tensors must be of type TensorData');
        }
        
        this.tensor1 = tensor1;
        this.tensor2 = tensor2;

        // Initialize current axes storage
        this.currentAxes = {
            A: { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() },
            B: { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() }
        };

        // Calculate all equivalent angles first to get target angles
        this._calculateEquivalentAngles();
        
        // Find optimal alignment for disks to match [0,0] config with first equivalent angle set
        this._findOptimalDiskAlignment();

        // Store reference orientations
        this._referenceDisk1Rotation = this.disk1Group.quaternion.clone();
        this._referenceDisk2Rotation = this.disk2Group.quaternion.clone();

        // Apply current configuration
        this._setConfiguration(this.currentConfig[0], this.currentConfig[1]);

        return this.getAllEquivalentEulerArrays();
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
        if (!this.equivalentAngles) return [];
        
        return this.equivalentAngles
            .sort((a, b) => a.linearIndex - b.linearIndex)
            .map(set => [set.angles.alpha, set.angles.beta, set.angles.gamma]);
    }

    // ========== PRIVATE METHODS ==========

    /**
     * Validate reference configuration format
     */
    _validateRefConfig(refConfig) {
        return Array.isArray(refConfig) && 
               refConfig.length === 2 &&
               Number.isInteger(refConfig[0]) && 
               Number.isInteger(refConfig[1]) &&
               refConfig[0] >= 0 && refConfig[0] <= 3 &&
               refConfig[1] >= 0 && refConfig[1] <= 3;
    }

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

    _setConfiguration(i, j) {
        if (!this._referenceDisk1Rotation || !this._referenceDisk2Rotation) return;

        // Validate indices
        if (i < 0 || i > 3 || j < 0 || j > 3) return;

        // Get rotations in LOCAL principal axes frame
        const configRot1 = this._getConfigurationRotation(i);
        const configRot2 = this._getConfigurationRotation(j);

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
        this._updateVisuals();
    }

    _getConfigurationRotation(configIndex) {
        const rotations = [
            new THREE.Quaternion(), // 0: Identity
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), Math.PI), // 1: X flip
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), Math.PI), // 2: Y flip
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1), Math.PI) // 3: Z flip
        ];
        
        return rotations[configIndex] || new THREE.Quaternion();
    }

    _calculateEquivalentAngles() {
        try {
            const convention = this.parameters.convention || 'zyz';
            const active = this.parameters.eulerActive !== undefined ? this.parameters.eulerActive : true;
            const tolerance = this.parameters.tolerance || 1e-6;
            
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
                        alpha: alpha,
                        beta: beta,
                        gamma: gamma
                    },
                    rawAngles: [alpha, beta, gamma]
                });
            }
            
        } catch (error) {
            console.error("Error calculating equivalent angles:", error);
            this.equivalentAngles = [];
        }
    }

    _alignDiskToEigenvectors(diskGroup, eigenvectors, flipX = false, flipY = false) {
        // Create orthonormal basis from eigenvectors
        const basis = [
            new THREE.Vector3(eigenvectors[0][0], eigenvectors[1][0], eigenvectors[2][0]).normalize(),
            new THREE.Vector3(eigenvectors[0][1], eigenvectors[1][1], eigenvectors[2][1]).normalize(),
            new THREE.Vector3(eigenvectors[0][2], eigenvectors[1][2], eigenvectors[2][2]).normalize()
        ];
        
        // Apply optional axis flips to explore all 4 configurations
        if (flipX) basis[0].negate();
        if (flipY) basis[1].negate();
        
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

    _findOptimalDiskAlignment() {
        if (!this.equivalentAngles || this.equivalentAngles.length === 0) {
            // Fallback to basic alignment if no equivalent angles available
            this._alignDiskToEigenvectors(this.disk1Group, this.tensor1.eigenvectors);
            this._alignDiskToEigenvectors(this.disk2Group, this.tensor2.eigenvectors);
            return;
        }

        // Get target angles for [0,0] configuration (first equivalent angle set)
        const targetAngles = this.equivalentAngles[0].rawAngles; // [alpha, beta, gamma]
        
        let bestError = Infinity;
        let bestFlips = { flipX1: false, flipY1: false, flipX2: false, flipY2: false };
        
        // Try all 16 combinations of axis flips (4 for each disk)
        for (let flipX1 = 0; flipX1 < 2; flipX1++) {
            for (let flipY1 = 0; flipY1 < 2; flipY1++) {
                for (let flipX2 = 0; flipX2 < 2; flipX2++) {
                    for (let flipY2 = 0; flipY2 < 2; flipY2++) {
                        // Apply alignment with current flip configuration
                        this._alignDiskToEigenvectors(this.disk1Group, this.tensor1.eigenvectors, flipX1, flipY1);
                        this._alignDiskToEigenvectors(this.disk2Group, this.tensor2.eigenvectors, flipX2, flipY2);
                        
                        // Update current axes for this configuration
                        this._updateCurrentAxes();
                        
                        // Calculate visual Euler angles for this alignment
                        const visualAngles = this._calculateVisualEulerAngles();
                        
                        if (visualAngles) {
                            // Calculate error between visual and target angles
                            const error = this._calculateAngleError(visualAngles, targetAngles);
                            
                            if (error < bestError) {
                                bestError = error;
                                bestFlips = { 
                                    flipX1: flipX1 === 1, 
                                    flipY1: flipY1 === 1, 
                                    flipX2: flipX2 === 1, 
                                    flipY2: flipY2 === 1 
                                };
                            }
                        }
                    }
                }
            }
        }
        
        // Apply the best alignment found
        this._alignDiskToEigenvectors(this.disk1Group, this.tensor1.eigenvectors, bestFlips.flipX1, bestFlips.flipY1);
        this._alignDiskToEigenvectors(this.disk2Group, this.tensor2.eigenvectors, bestFlips.flipX2, bestFlips.flipY2);
        
        console.log(`Optimal disk alignment found with error: ${bestError.toFixed(6)} rad, flips:`, bestFlips);
    }

    _calculateVisualEulerAngles() {
        if (!this.currentAxes) return null;
        
        // Get current axes vectors
        const z_A = this.currentAxes.A.z;
        const z_B = this.currentAxes.B.z;
        const y_A = this.currentAxes.A.y;
        
        // Calculate line of nodes
        const lineOfNodes = new THREE.Vector3().crossVectors(z_A, z_B);
        
        // Handle near-parallel case
        if (lineOfNodes.length() < 0.001) {
            lineOfNodes.copy(y_A);
        }
        lineOfNodes.normalize();
        
        // Calculate Euler angles following ZYZ convention
        // Alpha: rotation around z_A from y_A to line of nodes
        const alpha = this._calculateRotationAngle(z_A, y_A, lineOfNodes);
        
        // Beta: angle between z_A and z_B
        const beta = Math.acos(Math.max(-1, Math.min(1, z_A.dot(z_B))));
        
        // Gamma: rotation around z_B from line of nodes to final position
        // For ZYZ convention, we need to find the projection
        const gamma = this._calculateRotationAngle(z_B, lineOfNodes, this.currentAxes.B.y);
        
        return [alpha, beta, gamma];
    }

    _calculateRotationAngle(axis, from, to) {
        // Calculate signed angle between two vectors around an axis
        const fromNorm = from.clone().normalize();
        const toNorm = to.clone().normalize();
        
        // Project vectors onto plane perpendicular to axis
        const fromProj = fromNorm.clone().sub(axis.clone().multiplyScalar(fromNorm.dot(axis))).normalize();
        const toProj = toNorm.clone().sub(axis.clone().multiplyScalar(toNorm.dot(axis))).normalize();
        
        // Calculate angle
        const cosAngle = Math.max(-1, Math.min(1, fromProj.dot(toProj)));
        const angle = Math.acos(cosAngle);
        
        // Determine sign using cross product
        const cross = new THREE.Vector3().crossVectors(fromProj, toProj);
        const sign = Math.sign(cross.dot(axis));
        
        return sign * angle;
    }

    _calculateAngleError(visualAngles, targetAngles) {
        // Calculate RMS error between visual and target angles
        // Handle angle wrapping (2π periodicity)
        let totalError = 0;
        
        for (let i = 0; i < 3; i++) {
            let diff = visualAngles[i] - targetAngles[i];
            
            // Normalize angle difference to [-π, π]
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            
            totalError += diff * diff;
        }
        
        return Math.sqrt(totalError / 3);
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
        this._updateLineOfNodes();
        this._updateArcs();
        this._updateAxesVisualization();
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

    _updateLineOfNodes() {
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

    _updateArcs() {
        if (!this.equivalentAngles || !this.currentAxes || !this.lineOfNodes) {
            return;
        }

        // Get angles for current configuration
        const angles = this._getCurrentEulerAngles();
        if (!angles) {
            console.warn("Could not get current Euler angles");
            return;
        }

        const arcRadius = this.radius * 0.6;
        
        // Get current axes
        const z_A = this.currentAxes.A.z.clone();
        const z_B = this.currentAxes.B.z.clone();
        const y_A = this.currentAxes.A.y.clone();
        const lineOfNodesVector = this.lineOfNodes.clone();
        
        // Create arc geometries
        const alphaPoints = this._createArcPoints(z_A, angles.alpha, y_A, arcRadius);
        const betaPoints = this._createArcPoints(lineOfNodesVector, angles.beta, z_A, arcRadius);
        const gammaPoints = this._createArcPoints(z_B, angles.gamma, lineOfNodesVector, arcRadius);
        
        // Update arc geometries with colors
        this._updateArcGeometry(this.alphaArc, alphaPoints, 0xe74c3c);
        this._updateArcGeometry(this.betaArc, betaPoints, 0x2ecc71);
        this._updateArcGeometry(this.gammaArc, gammaPoints, 0x3498db);
        
        // Update labels
        this._updateArcLabels(angles, alphaPoints, betaPoints, gammaPoints);
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

        // Create tube geometry for thicker arcs
        const curve = new THREE.CatmullRomCurve3(points);
        const tubeGeometry = new THREE.TubeGeometry(curve, points.length - 1, 0.05, 8, false);
        const tubeMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9
        });
        
        const tubeMesh = new THREE.Mesh(tubeGeometry, tubeMaterial);
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
        if (!this.equivalentAngles || this.equivalentAngles.length === 0) {
            return null;
        }

        const linearIndex = this.currentConfig[0] * 4 + this.currentConfig[1];
        
        if (linearIndex < this.equivalentAngles.length) {
            const angleSet = this.equivalentAngles[linearIndex];
            return angleSet.angles;
        }

        console.error(`No angle set found for configuration [${this.currentConfig[0]}, ${this.currentConfig[1]}]`);
        return null;
    }

    _isValidTensor(tensor) {
        return tensor instanceof TensorData;
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
'use strict';

// TODO: support for passive vs active rotations
// TODO: support for reference configurations
// TODO: Add a method to animate the rotation of the disks

import _, { defaults } from 'lodash';
import * as mjs from 'mathjs';
import * as THREE from 'three';
import { AxesMesh } from './cell.js';
import { TextSprite } from './sprites.js';

import { DitherMaterial } from './dither.js';
import { Euler } from 'three';
import { TensorData } from '../tensor.js';

const LABEL_HEIGHT = 0.025; // For now fixed, just a value that works
const AXES_SCALE = 1.3333; // 1.3333

const pi = Math.PI;
const twoPi = 2 * Math.PI;


class EulerDisks extends THREE.Group {
    constructor(parameters) {
        super();

        const defaults = {
            radius: 4.0,
            thickness: 0.1, // of the axes
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
            refEuler: null,
            refConfig: null,

        };
        parameters = _.merge(defaults, parameters);
        this.parameters = parameters;

        
        this.radius = parameters.radius;
        this.thickness = parameters.thickness;
        this.scalingFactor = parameters.scalingFactor;
        this.innerRadiusScale = parameters.innerRadiusScale;
        
        // Create the visual elements
        this.createDisks();
        this.createAxes();
        this.createArcs();
        this.createLineOfNodesVis();
    }
    
    createDisks() {
        // Create ring geometry for disks
        const ringGeometry = new THREE.RingGeometry(
            this.radius * this.innerRadiusScale,  // inner radius
            this.radius,        // outer radius
            64                  // segments
        );
        
        // First disk (blue)
        const disk1Material = new THREE.MeshPhongMaterial({
            color: this.parameters.color1,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: this.parameters.opacity
        });
        this.disk1 = new THREE.Mesh(ringGeometry, disk1Material);
        
        // Second disk (red)
        const disk2Material = new THREE.MeshPhongMaterial({
            color: this.parameters.color2,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: this.parameters.opacity
        });
        this.disk2 = new THREE.Mesh(ringGeometry, disk2Material);
        
        // Create groups for each disk and its axes
        this.disk1Group = new THREE.Group();
        this.disk2Group = new THREE.Group();
        
        this.disk1Group.add(this.disk1);
        this.disk2Group.add(this.disk2);
        
        this.add(this.disk1Group);
        this.add(this.disk2Group);
    }
    
    createAxes() {
        const axisLength = this.radius * this.scalingFactor;
        const zFactor = 1.5; // make the z-axis a bit longer
        const cell1 = [[axisLength, 0, 0], [0, axisLength, 0], [0, 0, axisLength * zFactor]];
        let axes1 = new AxesMesh(cell1, {
            linewidth: 2.0, // doens't work on most platforms -- known issue with three.js 
            labels: ["x_A", "y_A", "z_A"],
            xColor: this.color1,
            yColor: this.color1,
            zColor: this.color1,
            bothWays: true,
        });

        const cell2 = [[axisLength, 0, 0], [0, axisLength, 0], [0, 0, axisLength * zFactor]];
        let axes2 = new AxesMesh(cell2, {
            linewidth: 2.0, // doens't work on most platforms -- known issue with three.js
            labels: ["x_B", "y_B", "z_B"],
            xColor: this.color2,
            yColor: this.color2,
            zColor: this.color2,
            bothWays: true,
        });

        this.axes1 = axes1;
        this.axes2 = axes2;

        this.add(axes1);
        this.add(axes2);
    }

    createLineOfNodesVis() {
        // Use ArrowHelper instead
        const lineOfNodesDir = new THREE.Vector3(0, 1, 0);
        const lineOfNodesOrigin = new THREE.Vector3(0, 0, 0);
        const lineOfNodesLength = AXES_SCALE * this.scalingFactor;

        this.lineOfNodesVis = new THREE.ArrowHelper(
            lineOfNodesDir,
            lineOfNodesOrigin,
            lineOfNodesLength,
            0xD3D3D3, // color (light gray)
        );

        this.add(this.lineOfNodesVis);
    }
    
    setTensors(tensor1, tensor2) {
        if (!this.isValidTensor(tensor1) || !this.isValidTensor(tensor2)) {
            throw new Error('Input tensors must be of type TensorData');
        }
        this.tensor1 = tensor1;
        this.tensor2 = tensor2;

        // Keep copy of the normal vectors
        // this.z_A = new THREE.Vector3(...mjs.transpose(this.tensor1.eigenvectors)[2]);
        // this.z_B = new THREE.Vector3(...mjs.transpose(this.tensor2.eigenvectors)[2]);

        console.log(this.tensor1.equivalentEulerTo(this.tensor2, 'zyz', true, 1e-6, true));
        
        // Align disks with their respective eigenvectors
        this.alignDiskToEigenvectors(this.disk1Group, this.tensor1.eigenvectors);
        this.alignDiskToEigenvectors(this.disk2Group, this.tensor2.eigenvectors);


        
        // orient the line of nodes along the cross product of the z axes
        // NB This should happen _before_ updating the rotation arcs
        this.alignLineOfNodes();
        // console.log(this.z_A, this.z_B, this.lineOfNodes);

        // Update rotation arcs
        this.updateArcs();

        // Update the axes
        this.updateAxes();
    }
    
    isValidTensor(tensor) {
        // must be of type TensorData
        return tensor instanceof TensorData;
    }
    
    alignDiskToEigenvectors(diskGroup, eigenvectors) {
        // Create rotation matrix from eigenvectors
        const matrix = new THREE.Matrix4();
        const elements = [];

        // TODO check if eigenvectors is already transposed (I think it is)
        
        // append zero to make it 4x4
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                elements.push(eigenvectors[j][i]);
            }
            elements.push(0);
        }
        elements.push(0, 0, 0, 1);
        
        matrix.fromArray(elements);
        
        // Apply rotation to disk group
        diskGroup.setRotationFromMatrix(matrix);

    }

    alignLineOfNodes() {
        // orient the line of nodes along the cross product of the z axes
        // it should be the intersection of the two planes
        // calculate line of nodes as cross product of disks' normal vectors
        // if z_A and z_B are parallel, the line of nodes is undefined
        // in this case, we will just set it to the y-axis of disk A
        let z_A = new THREE.Vector3(...mjs.transpose(this.tensor1.eigenvectors)[2]);
        let z_B = new THREE.Vector3(...mjs.transpose(this.tensor2.eigenvectors)[2]);
        let y_A = new THREE.Vector3(...mjs.transpose(this.tensor1.eigenvectors)[1]);
        // let y_B = new THREE.Vector3(...mjs.transpose(this.tensor2.eigenvectors)[1]);
        
        // To test if they are parallel, we will check if the cross product is zero
        const EPS = 1e-6;
        this.lineOfNodes = new THREE.Vector3().crossVectors(z_A, z_B);
        if (this.lineOfNodes.lengthSq() < EPS) {
            console.log('Parallel eigenvectors, setting line of nodes to y-axis');
            this.lineOfNodes = y_A;
        }
        this.lineOfNodes.normalize();

        // Update the line of nodes visualization
        this.lineOfNodesVis.setDirection(this.lineOfNodes);
    }



    


    createArcs() {
        this.arcs = new THREE.Group();
        
        // Create materials for arcs with different colors
        const alphaMaterial = new THREE.LineBasicMaterial({ 
            color: 0xffff00,
            linewidth: 2
        });
        const betaMaterial = new THREE.LineBasicMaterial({ 
            color: 0xff00ff,
            linewidth: 2
        });
        const gammaMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00ffff,
            linewidth: 2
        });
        
        this.alphaArc = new THREE.Line(new THREE.BufferGeometry(), alphaMaterial);
        this.betaArc = new THREE.Line(new THREE.BufferGeometry(), betaMaterial);
        this.gammaArc = new THREE.Line(new THREE.BufferGeometry(), gammaMaterial);
        
        this.arcs.add(this.alphaArc);
        this.arcs.add(this.betaArc);
        this.arcs.add(this.gammaArc);

        // Add arrows at midpoints
        // this.addArrowToArc(this.alphaArc, 0xffff00);
        // this.addArrowToArc(this.betaArc, 0xff00ff);
        // this.addArrowToArc(this.gammaArc, 0x00ffff);
        
        // add label
        let labelParams = {
            faceCamera: true,
            fixScale: true,
            shift: [0.0, 0, 0.5], // This just works well
            height: LABEL_HEIGHT,
            onOverlay: true // Force rendering on top
        };
        labelParams.color = 0xffff00;
        this.alphaLabel = new TextSprite("α", labelParams);
        labelParams.color = 0xff00ff;
        this.betaLabel = new TextSprite("β", labelParams);
        labelParams.color = 0x00ffff;
        this.gammaLabel = new TextSprite("γ", labelParams);

        this.arcs.add(this.alphaLabel);
        this.arcs.add(this.betaLabel);
        this.arcs.add(this.gammaLabel);


        this.add(this.arcs);
    }

    updateAxes() {
        // Update the axes to match the current orientation
        // Get rotation matrices from both disk groups
        const q1 = new THREE.Quaternion();
        const q2 = new THREE.Quaternion();
        this.disk1Group.getWorldQuaternion(q1);
        this.disk2Group.getWorldQuaternion(q2);

        const mat1 = new THREE.Matrix4().makeRotationFromQuaternion(q1);
        const mat2 = new THREE.Matrix4().makeRotationFromQuaternion(q2);

        // Update the axes to match the current orientation
        this.axes1.setRotationFromMatrix(mat1);
        this.axes2.setRotationFromMatrix(mat2);

    }




    updateArcs() {
        console.log('Updating arcs...');
        // Get rotation matrices from both disk groups
        const q1 = new THREE.Quaternion();
        const q2 = new THREE.Quaternion();
        this.disk1Group.getWorldQuaternion(q1);
        this.disk2Group.getWorldQuaternion(q2);

        const mat1 = new THREE.Matrix4().makeRotationFromQuaternion(q1);
        const mat2 = new THREE.Matrix4().makeRotationFromQuaternion(q2);

        // mat1^-1 * mat2
        // const relativeRotation = new THREE.Matrix4().getInverse(mat1).multiply(mat2);
        const mat1Inv = new THREE.Matrix4().copy(mat1).invert();
        const relativeRotation = mat1Inv.multiply(mat2);

        // Extract ZYZ Euler angles
        const euler = this.rotationMatrixToEulerAngles(relativeRotation);
        // convert to regular array in degrees
        // const angles = {alpha: euler.x,
        //                 beta: euler.y,
        //                 gamma: euler.z};
        // console.log("Euler angles alpha: ", euler.x * 180 / pi);
        // console.log("Euler angles beta: ", euler.y * 180 / pi);
        // console.log("Euler angles gamma: ", euler.z * 180 / pi);
            

        // Use in-built tensor method to get the angles
        const rawAngles = this.tensor1.eulerTo(this.tensor2, 'zyz', true, 1e-6, false);
        const angles = {alpha: rawAngles[0],
                        beta: rawAngles[1],
                        gamma: rawAngles[2]};
        // Create arc points
        const arcRadius = this.radius * 0.6;
        
        // Helper function to create arc points
        const createArcPoints = (axis, angle, startVec, steps = 32) => {
            const points = [];
            const quaternion = new THREE.Quaternion();
            quaternion.setFromAxisAngle(axis, angle);
            
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const quat = new THREE.Quaternion().slerp(quaternion, t);
                const point = startVec.clone()
                    .applyQuaternion(quat)
                    .multiplyScalar(arcRadius);
                points.push(point);
            }
            return points;
        };

        // Update alpha arc (first Z rotation)
        // This should be equivalent to an arc from disk1.y to the line of nodes
        const alphaStart = new THREE.Vector3(0, 1, 0).applyMatrix4(this.disk1Group.matrixWorld);
        const alphaPoints = createArcPoints(
            new THREE.Vector3(0, 0, 1).applyMatrix4(this.disk1Group.matrixWorld),
            angles.gamma,
            alphaStart
        );
        this.alphaArc.geometry.dispose();
        this.alphaArc.geometry = new THREE.BufferGeometry().setFromPoints(alphaPoints);

        // // Update beta arc (X rotation)
        // const betaStart = alphaStart.clone().applyAxisAngle(new THREE.Vector3(0, 0, 1), angles.alpha);
        // const betaPoints = createArcPoints(
        //     new THREE.Vector3(1, 0, 0),
        //     angles.beta,
        //     betaStart
        // );
        // this.betaArc.geometry.dispose();
        // this.betaArc.geometry = new THREE.BufferGeometry().setFromPoints(betaPoints);
        
        // beta arc: rotate z_A about the line of nodes to z_B
        let z_A = new THREE.Vector3(0,0,1).applyMatrix4(this.disk1Group.matrixWorld);
        let z_B = new THREE.Vector3(0,0,1).applyMatrix4(this.disk2Group.matrixWorld);
        const axis = this.lineOfNodes.clone().normalize();
        const angle = z_A.angleTo(z_B); // Should match angles.beta
        const betaSteps = 32;
        const betaPoints = [];
        for (let i = 0; i <= betaSteps; i++) {
            const t = i / betaSteps;
            const quat = new THREE.Quaternion().setFromAxisAngle(axis, t * angle);
            const point = z_A.clone().applyQuaternion(quat).normalize().multiplyScalar(arcRadius);
            betaPoints.push(point);
        }
        // If the last point is not close to z_B, reverse the angle direction
        if (betaPoints[betaSteps].distanceTo(z_B.clone().normalize().multiplyScalar(arcRadius)) > 1e-3) {
            betaPoints.length = 0;
            for (let i = 0; i <= betaSteps; i++) {
                const t = i / betaSteps;
                const quat = new THREE.Quaternion().setFromAxisAngle(axis, -t * angle);
                const point = z_A.clone().applyQuaternion(quat).normalize().multiplyScalar(arcRadius);
                betaPoints.push(point);
            }
        }
        this.betaArc.geometry.dispose();
        this.betaArc.geometry = new THREE.BufferGeometry().setFromPoints(betaPoints);

        // Update gamma arc (final Z rotation)
        // const gammaStart = betaStart.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angles.beta);
        const gammaPoints = createArcPoints(
            new THREE.Vector3(0, 0, 1).applyMatrix4(this.disk2Group.matrixWorld), // or disk 1?
            -angles.alpha,
            this.lineOfNodes
        );
        this.gammaArc.geometry.dispose();
        this.gammaArc.geometry = new THREE.BufferGeometry().setFromPoints(gammaPoints);

        // Update arrow positions
        // this.addArrowToArc(this.alphaArc, 0xffff00);
        // this.addArrowToArc(this.betaArc, 0xff00ff);
        // this.addArrowToArc(this.gammaArc, 0x00ffff);

        // Update the label text
        this.alphaLabel.text = `α = ${(angles.alpha * 180 / pi).toFixed(2)}°`;
        this.betaLabel.text  = `β = ${(angles.beta * 180 / pi).toFixed(2)}°`;
        this.gammaLabel.text = `γ = ${(angles.gamma * 180 / pi).toFixed(2)}°`;

        // Update label positions
        this.alphaLabel.position.copy(alphaPoints[Math.floor(alphaPoints.length / 2)]);
        this.betaLabel.position.copy(betaPoints[Math.floor(betaPoints.length / 2)]);
        this.gammaLabel.position.copy(gammaPoints[Math.floor(gammaPoints.length / 2)]);
    }


    rotationMatrixToEulerAngles(matrix) {
        // first to quaternion
        const quaternion = new THREE.Quaternion();
        quaternion.setFromRotationMatrix(matrix);

        // then to euler using custom function
        return quaternionToZYZEuler(quaternion);
    }


    extractZXZEulerAngles(matrix) {
        const elements = matrix.elements;
        let alpha, beta, gamma;
        
        if (Math.abs(elements[2]) < 0.99999) {
            beta = Math.acos(elements[2]);
            alpha = Math.atan2(elements[6], -elements[10]);
            gamma = Math.atan2(elements[1], elements[0]);
        } else {
            // Handle gimbal lock
            gamma = 0;
            if (elements[2] > 0) {
                beta = 0;
                alpha = Math.atan2(-elements[3], elements[4]);
            } else {
                beta = Math.PI;
                alpha = Math.atan2(elements[3], -elements[4]);
            }
        }
        
        return { alpha, beta, gamma };
    }

    generateEquivalentRotations() {
        // Get current orientations
        const disk1Rotation = quaternionToZYZEuler(
            this.disk1Group.quaternion
        );
        const disk2Rotation = quaternionToZYZEuler(
            this.disk2Group.quaternion
        );
        
        const equivalentRotations = [];
        const PI = Math.PI;
        
        // Generate all combinations of PI rotations about principal axes
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 2; j++) {
                for (let k = 0; k < 2; k++) {
                    // Rotations for disk 1
                    const rot1 = disk1Rotation.clone();
                    if (i) rot1.x += PI;
                    if (j) rot1.y += PI;
                    if (k) rot1.z += PI;
                    
                    for (let l = 0; l < 2; l++) {
                        for (let m = 0; m < 2; m++) {
                            for (let n = 0; n < 2; n++) {
                                // Rotations for disk 2
                                const rot2 = disk2Rotation.clone();
                                if (l) rot2.x += PI;
                                if (m) rot2.y += PI;
                                if (n) rot2.z += PI;
                                
                                equivalentRotations.push({
                                    disk1: rot1.clone(),
                                    disk2: rot2.clone()
                                });
                            }
                        }
                    }
                }
            }
        }
        
        return equivalentRotations;
    }

    applyEquivalentRotation(rotation) {
        // Apply new rotations to disk groups
        this.disk1Group.setRotationFromEuler(rotation.disk1);
        this.disk2Group.setRotationFromEuler(rotation.disk2);
        
        // Update arcs for new orientation
        this.updateArcs();
    }

    animateEulerRotations(angles) {
        const duration = 2; // Duration of the animation in seconds
        const initialAngles = { alpha: 0, beta: 0, gamma: 0 };
        const finalAngles = angles;
        const clock = new THREE.Clock();

        const animate = () => {
            const elapsedTime = clock.getElapsedTime();
            const t = Math.min(elapsedTime / duration, 1); // Normalize time to [0, 1]

            // Interpolate between initial and final angles
            const currentAngles = {
                alpha: THREE.MathUtils.lerp(initialAngles.alpha, finalAngles.alpha, t),
                beta: THREE.MathUtils.lerp(initialAngles.beta, finalAngles.beta, t),
                gamma: THREE.MathUtils.lerp(initialAngles.gamma, finalAngles.gamma, t)
            };

            // Update the arcs
            this.updateArcs(currentAngles);

            // Update the label text
            this.alphaLabel.text = `α = ${(currentAngles.alpha * 180 / Math.PI).toFixed(1)}°`;
            this.betaLabel.text  = `β = ${(currentAngles.beta * 180 / Math.PI).toFixed(1)}°`;
            this.gammaLabel.text = `γ = ${(currentAngles.gamma * 180 / Math.PI).toFixed(1)}°`;

            if (t < 1) {
                requestAnimationFrame(animate);
            }
        };

        animate();
    }
}


function quaternionToZYZEuler(quaternion) {
    const q = quaternion;
    const sqw = q.w * q.w;
    const sqx = q.x * q.x;
    const sqy = q.y * q.y;
    const sqz = q.z * q.z;

    const unit = sqx + sqy + sqz + sqw; // Normalized quaternion is assumed to be 1, otherwise it is unit length
    const test = q.x * q.y + q.z * q.w;

    let alpha, beta, gamma;

    if (test > 0.499 * unit) { // singularity at north pole
        alpha = 2 * Math.atan2(q.x, q.w);
        beta = Math.PI / 2;
        gamma = 0;
    } else if (test < -0.499 * unit) { // singularity at south pole
        alpha = -2 * Math.atan2(q.x, q.w);
        beta = -Math.PI / 2;
        gamma = 0;
    } else {
        const sqxMinusSqy = sqx - sqy;
        alpha = Math.atan2(2 * q.y * q.w - 2 * q.x * q.z, sqxMinusSqy + sqw - sqz);
        beta = Math.asin(2 * test / unit);
        gamma = Math.atan2(2 * q.x * q.w - 2 * q.y * q.z, -sqxMinusSqy + sqw - sqz);
    }

    return new THREE.Euler(alpha, beta, gamma, 'ZYZ');
}

export { EulerDisks };
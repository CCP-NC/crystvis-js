'use strict';

// create an object composed of two intersecting cirlces
// and a cylinder showing their intersection

// we need similar class to add local axes to each atom with a fixed scale
// and fixed colors for each axis

import _ from 'lodash';
import * as mjs from 'mathjs';
import * as THREE from 'three';
import { AxesMesh } from './cell.js';
import { TextSprite } from './sprites.js';

import { DitherMaterial } from './dither.js';
import { Euler } from 'three';
import { TensorData } from '../tensor.js';

const LABEL_HEIGHT = 0.05; // For now fixed, just a value that works
const AXES_SCALE = 1.3333; // 1.3333

const pi = Math.PI;
const twoPi = 2 * Math.PI;

// one EulerDisk is a circle axes
class EulerDisk extends THREE.Group {

    constructor(parameters = {}) {
        super();
        const defaults = {
            center: [0, 0, 0],
            tensorData: new TensorData(
                [[1,0,0], [0,1,0],[0,0,1]]),
            color: 0xff0000,
            opacity: 0.2,
            opacityMode: EulerDisk.PHONG,
            showCircles: true,
            showAxes: true,
            labels: ['x', 'y', 'z'],
            // scalingFactor: 5.0
        };

        parameters = _.merge(defaults, parameters);

        if (parameters.showCircles) {
            // create a circle
            let circle = new THREE.CircleGeometry(1, 32);
            let material = new THREE.MeshBasicMaterial({
                color: parameters.color,
                transparent: true,
                opacity: parameters.opacity,
                side: 2
            });
            let circleMesh = new THREE.Mesh(circle, material);
            this.add(circleMesh);
        }

        if (parameters.showAxes) {
            // create axes
            const cell = [[AXES_SCALE, 0, 0], [0, AXES_SCALE, 0], [0, 0, AXES_SCALE]];
            let axes = new AxesMesh(cell, {
                linewidth: 2.0, // doens't work on most platforms -- known issue with three.js 
                labels: parameters.labels,
                xColor: parameters.color,
                yColor: parameters.color,
                zColor: parameters.color,
            });

            this.add(axes);
        }
        // set position
        this.position.set(parameters.center[0], parameters.center[1], parameters.center[2]);

        // set scaling
        this.scalingFactor = parameters.scalingFactor;

        const original_eigenvectors = parameters.tensorData.eigenvectors;
        this.eigenvectors = parameters.tensorData.eigenvectors;
        // make an immutable copy of eigenvectors
        this.original_eigenvectors = JSON.parse(JSON.stringify(original_eigenvectors));
        this.tensor = parameters.tensorData


    }

    get eigenvectors() {
        // 
        // // or get them from the local axes
        // // Create unit vectors for x, y, and z axes
        // const xAxis = new THREE.Vector3(1, 0, 0);
        // const yAxis = new THREE.Vector3(0, 1, 0);
        // const zAxis = new THREE.Vector3(0, 0, 1);
        
        // // Get the local transformation matrix of the object
        // const localMatrix = this.matrix.clone(); // Use .matrix if you want the local matrix excluding world transformations
        
        // // Apply the local matrix to the unit vectors to get the local basis vectors
        // xAxis.applyMatrix4(localMatrix).normalize();
        // yAxis.applyMatrix4(localMatrix).normalize();
        // zAxis.applyMatrix4(localMatrix).normalize();
        
        // console.log("🚀 ~ file: euler.js:271 ~ EulerDisks ~ get eigenvectors ~ xAxis", xAxis)
        // console.log("🚀 ~ file: euler.js:271 ~ EulerDisks ~ get eigenvectors ~ yAxis", yAxis)
        // console.log("🚀 ~ file: euler.js:271 ~ EulerDisks ~ get eigenvectors ~ zAxis", zAxis)
        
        // // convert to 2D array
        // let m3elements = [
        //     [xAxis.x, xAxis.y, xAxis.z],
        //     [yAxis.x, yAxis.y, yAxis.z],
        //     [zAxis.x, zAxis.y, zAxis.z]
        // ];
        // return m3elements;
        
        return mjs.transpose(JSON.parse(JSON.stringify(this._eigenvectors)));
    }

    set eigenvectors(v) {

        var basis = _.map(_.range(3), (i) => {
            return new THREE.Vector3(v[0][i],
                v[1][i],
                v[2][i]).normalize();
            });
        var rotm = new THREE.Matrix4();
        rotm.makeBasis(basis[0], basis[1], basis[2]);
        this.setRotationFromMatrix(rotm);
        // update eigenvectors from rotated basis
        // The following does not work
        // let m = this.matrixWorld.clone();
        // let m3 = new THREE.Matrix3().setFromMatrix4(m);
        // let m3elements = [
        //         [m3.elements[0], m3.elements[1], m3.elements[2]],
        //         [m3.elements[3], m3.elements[4], m3.elements[5]],
        //     [m3.elements[6], m3.elements[7], m3.elements[8]]
        // ];
        // this._eigenvectors = m3elements;
        this._eigenvectors = v
    }

    get color() {
        return this.material.color;
    }

    set color(c) {
        // Change all colors
        c = new THREE.Color(c);
        this.material.color = c;
        for (let i = 0; i < this.children.length; ++i) {
            this.children[i].material.color = c;
        }
    }

    get opacity() {
        return this.material.opacity;
    }

    set opacity(o) {
        this.material.opacity = o;
    }

    get scalingFactor() {
        return this._scalefactor;
    }

    set scalingFactor(s) {
        this._scalefactor = s;
        this.scale.fromArray([s, s, s]);
        // set axes scale
        let ax_s = s * AXES_SCALE;
        this.children[1].scale.fromArray([ax_s, ax_s, ax_s]);
    }

    // Rotate the disk by an angle about a given axis
    // axis should be a THREE.Vector3 or array of length 3
    // angle should be in radians
    rotateByAngle(axis, angle) {
        // if axis is not a vector, make it one
        if (axis.x === undefined) {
            axis = new THREE.Vector3(axis[0], axis[1], axis[2]);
        }
        // rotate by angle about axis
        let R = new THREE.Matrix4();
        R.makeRotationAxis(axis, angle);

        let R3 = new THREE.Matrix3().setFromMatrix4(R); // Create a 3x3 matrix from R
        let R3elements2D = [
            [R3.elements[0], R3.elements[1], R3.elements[2]],
            [R3.elements[3], R3.elements[4], R3.elements[5]],
            [R3.elements[6], R3.elements[7], R3.elements[8]]
        ];

        this.applyMatrix4(R);
        // apply R to eigenvectors also
        this.eigenvectors = mjs.multiply(R3elements2D, mjs.transpose(this.eigenvectors));
    }


}

class EulerDisks extends THREE.Group {

    constructor(parameters = {}) {

        super();

        const defaults = {
            center: [0, 0, 0],
            angles: null,
            color1: 0xff0000,
            color2: 0x00ff00,
            opacity: 0.2,
            opacityMode: EulerDisks.DITHER,
            showCircles: true,
            showAxes: true,
            scalingFactor: 5.0,
            passive: false,
            refEuler: null,
            refConfig: null,
        };
        // angle arcs
        this.angleArcs = [];

        parameters = _.merge(defaults, parameters);

        // If reConfig and refEuler are both provided, use refEuler only 
        // and issue a warning
        if (parameters.refConfig && parameters.refEuler) {
            console.warn("Both refConfig and refEuler provided. Using refEuler only.");
            parameters.refConfig = null;
        }

        // TODO sort out disk1 vs disk2 - which comes first?
        let { disk1, disk2 } = this.drawDisks(parameters);

        // Standardise the orientations of the disks
        if (parameters.refEuler){
            this.standardiseTensorOrientations(parameters.refEuler, 'zyz', true);
        } else if (parameters.refConfig) {
                this.getEquivalentDisks(parameters.refConfig);
        } else {
                this.standardiseTensorOrientations(this.equivEulers[0], 'zyz', true);
        }

        const vectorResults = calculateVectors(disk1.eigenvectors, disk2.eigenvectors, parameters.passive, parameters.scalingFactor);


        let { line_of_nodes, y_B, y_A, z_A, z_B } = vectorResults;

        // Draw the line of nodes and angle arcs
        this.drawLineOfNodes(line_of_nodes, parameters.center, parameters.scalingFactor);
        // draw angle arcs
        // note to get the same order as tensorView for matlab, I need to swap 
        // alpha and gamma
        this.drawArcs(line_of_nodes, y_B, parameters, y_A, z_A, z_B);
    }

    drawLineOfNodes(line_of_nodes, center, scalingFactor, color=0x888888) {
        let arrow = new THREE.ArrowHelper(
            line_of_nodes,
            new THREE.Vector3(
                center[0],
                center[1],
                center[2]
            ),
            scalingFactor * AXES_SCALE,
            color);
        this.add(arrow);
        this.lineofNodesArrow = arrow;
    }

    drawArcs(line_of_nodes, y_B, parameters, y_A, z_A, z_B) {
        // TODO: I've swapped alpha and gamma to match the results from Soprano
        const betaArc = this.addArc(z_A, z_B, parameters.center, 0x286639, 'β', true, this.scalingFactor);
        const alphaArc = this.addArc(y_B, line_of_nodes, parameters.center, 0xDB4D29, 'α', false, this.scalingFactor);
        const gammaArc = this.addArc(line_of_nodes, y_A, parameters.center, 0x674AA3, 'γ', false, this.scalingFactor);
        // let gammaArc;
        console.log("🚀 ~ file: euler.js:271 ~ EulerDisks ~ constructor ~ alphaArc.arcDirection", alphaArc.arcDirection);
        console.log("🚀 ~ file: euler.js:271 ~ EulerDisks ~ constructor ~ betaArc.arcDirection", betaArc.arcDirection);
        console.log("🚀 ~ file: euler.js:271 ~ EulerDisks ~ constructor ~ gammaArc.arcDirection", gammaArc.arcDirection);
    }

    drawDisks(parameters) {
        var material;

        var c = new THREE.Color(parameters.color);

        switch (parameters.opacityMode) {
            case EulerDisks.DITHER:
                material = new DitherMaterial({
                    color: c,
                    opacity: parameters.opacity,
                    shiftSeed: parameters.ditherSeed
                });
                break;
            case EulerDisks.PHONG:
                material = new THREE.MeshPhongMaterial({
                    transparent: true,
                    opacity: parameters.opacity,
                    color: c
                });
                break;
            case EulerDisks.LAMBERT:
                material = new THREE.MeshLambertMaterial({
                    transparent: true,
                    opacity: parameters.opacity,
                    color: c
                });
                break;
            case EulerDisks.BASIC:
                material = new THREE.MeshBasicMaterial({
                    transparent: true,
                    opacity: parameters.opacity,
                    color: c
                });
                break;
            default:
                material = new THREE.MeshBasicMaterial({
                    transparent: true,
                    opacity: parameters.opacity,
                    color: c
                });
                break;
        }

        let TA = parameters.dataA;
        let TB = parameters.dataB;


        // calculate equivalent Euler angles between disk1.tensor and disk2.tensor
        const equivEulers = TA.equivalentEulerTo(TB)
        // log 16x3 array in degrees
        console.log(equivEulers.map(row => row.map(angle => angle * (180 / Math.PI))));

        // First EulerDisk
        let disk1 = new EulerDisk({
            center: parameters.center,
            tensorData: TA,
            color: parameters.color1,
            opacity: parameters.opacity,
            opacityMode: parameters.opacityMode,
            showCircles: parameters.showCircles,
            showAxes: parameters.showAxes,
            scalingFactor: parameters.scalingFactor, // + 0.05 * parameters.scalingFactor,
            labels: ["x_A", "y_A", "z_A"]
        });
        
        // Second EulerDisk
        let disk2 = new EulerDisk({
            center: parameters.center,
            tensorData: TB,
            color: parameters.color2,
            opacity: parameters.opacity,
            opacityMode: parameters.opacityMode,
            showCircles: parameters.showCircles,
            showAxes: parameters.showAxes,
            scalingFactor: parameters.scalingFactor, // - 0.05 * parameters.scalingFactor,
            labels: ["x_B", "y_B", "z_B"]
        });

        this.disk1 = disk1;
        this.disk2 = disk2;
        
        // // Before adding the disk, let's figure out how to align the disk axes to obtain the first angle set of equivEulers
        // this.standardiseTensorOrientations(equivEulers[0], 'zyz', true);
        this.equivEulers = equivEulers;
        
        this.add(disk1);
        this.add(disk2);

        
        return { disk1, disk2 };
    }



    getEquivalentDisks(configuration) {
        // configuration is a 2-element array of integers between 0 and 3
        // 0 means no rotation
        // 1 means rotate by pi about x
        // 2 means rotate by pi about y
        // 3 means rotate by pi about z
        // So [1,2] means rotate disk1 by pi about x and disk2 by pi about y etc.


        // Rrel = R_A ^-1 R_B
        // # Equivalent to these 15:
        // Rrel * R_x(pi)
        // Rrel * R_y(pi)
        // Rrel * R_z(pi)
        
        // R_x(pi) * Rrel
        // R_y(pi) * Rrel
        // R_z(pi) * Rrel
        
        // R_x(pi) * Rrel * R_x(pi)
        // R_x(pi) * Rrel * R_y(pi)
        // R_x(pi) * Rrel * R_z(pi)
        
        // R_y(pi) * Rrel * R_y(pi)
        // R_y(pi) * Rrel * R_x(pi)
        // R_y(pi) * Rrel * R_z(pi)
        
        // R_z(pi) * Rrel * R_z(pi)
        // R_z(pi) * Rrel * R_x(pi)
        // R_z(pi) * Rrel * R_y(pi)
    
        // get equivalent disk1
        if (configuration[0] == 0) {
            // do nothing
        }
        else {
            // get axis:
            // TODO: why does using disk2's eigenvectors give us the right answer in some cases?!
            let axis = new THREE.Vector3(...mjs.transpose(this.disk1.original_eigenvectors)[configuration[0] - 1]);
            // rotate by pi about axis
            this.disk1.rotateByAngle(axis, Math.PI);
        }
        // get equivalent disk2
        if (configuration[1] == 0) {
            // do nothing
        }
        else {
            // get axis:
            let axis = new THREE.Vector3(...mjs.transpose(this.disk2.original_eigenvectors)[configuration[1] - 1]);
            // rotate by pi about axis
            this.disk2.rotateByAngle(axis, Math.PI);
        }

    }


    /**
     * Re-orients EulerDisk objects such that their relative Euler angles fall within conventional range.
     * @param {Array} refEulers - The reference Euler angles to match (array of 3 numbers).
     * @param {string} convention - The Euler angle convention to use (zyz or zxz).
     * @param {boolean} active - Whether to use active or passive transformation.
     * @returns {Object} - The re-oriented tensors A and B.
     */
    standardiseTensorOrientations(refEulers, convention, active) {
        // First get reference eulr angles, following TensorView for Matlab conventions
        // function to get tensorData from eigenvectors
        let evecsA = this.disk1.eigenvectors;
        let evecsB = this.disk2.eigenvectors;
        let eulers = threejs_euler_between(evecsA,evecsB, convention, active);
        console.log("🚀 ~ standardiseTensorOrientations ~ refEulers:", refEulers.map(angle => angle * (180 / Math.PI)));
        
        // Loop over configs [0,0] to [3,3] and break when we find a match
        // Use this.getEquivalentDisks to rotate disks by pi about x, y, or z
        outerLoop: for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                this.getEquivalentDisks([i, j]);
                evecsA = this.disk1.eigenvectors;
                evecsB = this.disk2.eigenvectors;
                eulers = threejs_euler_between(evecsA, evecsB, convention, active);
                console.log("🚀 ~ standardiseTensorOrientations ~ eulers:", i, j, eulers.map(angle => angle * (180 / Math.PI)));
                if (eulers.length === refEulers.length && eulers.every((val, idx) => 
                    Math.abs(val - refEulers[idx]) <= 1e-2)) {
                    console.log("🚀 ~ standardiseTensorOrientations ~ Found a match at: ", [i, j]);
                    break outerLoop;
                }
            }
        }

        // // to match the other
        // if (eulers[0] != refEulers[0]) {
        //     // rotate A by eulers[0] about the x-axis
        //     A = A.rotateByAngleAxis(Math.PI, [1, 0, 0]);
        // }
        // eulers = threejs_euler_between(A, B, convention, active)
        // console.log("🚀 ~ standardiseTensorOrientations ~ eulers:", eulers.map(angle => angle * (180 / Math.PI)))
    }

    addArc(v1, v2, center, color, label, wrapToPi = false, scalingFactor = 1.0) {
        // if v1 is not a vector, make it one
        if (v1.x === undefined) {
            v1 = new THREE.Vector3(v1[0], v1[1], v1[2]);
        }
        // if v2 is not a vector, make it one
        if (v2.x === undefined) {
            v2 = new THREE.Vector3(v2[0], v2[1], v2[2]);
        }

        const length = 4.0 * scalingFactor;


        

        // Use z_A cross z_B as the reference normal
        let z_A = new THREE.Vector3(...this.disk1.eigenvectors[2]);
        let z_B = new THREE.Vector3(...this.disk2.eigenvectors[2]);

        
        // const planeNormal = new THREE.Vector3(0, 0, 1);  // Normal to the plane of rotation
        const planeNormal = new THREE.Vector3().crossVectors(z_A, z_B).normalize();
        const arcData = createArcBetweenVectors(v1, v2, center, length, 16, planeNormal, wrapToPi);
        
        // Create the tube geometry
        const geometry = new THREE.TubeGeometry(
            arcData.curve,
            64,  // tubular segments
            0.05, // radius
            8,    // radial segments
            false // closed
        );
        
        // Add arrow at midpoint
        const arrow = new THREE.ArrowHelper(
            arcData.tangent,
            arcData.midPoint,
            0.5,
            color,
            0.4,
            0.4
        );
        
        // Create materials and mesh
        const material = new THREE.MeshBasicMaterial({ color: color });
        const arc = new THREE.Mesh(geometry, material);
        
        // Create group for arc and arrow
        const group = new THREE.Group();
        group.add(arc);
        group.add(arrow);


        // add label
        if (label) {
            let labelPos = arcData.midPoint.clone();
            labelPos.setLength(length * 1.5);
            let labelparams = {
                faceCamera: true,
                fixScale: true,
                shift: [0.0, 0, 0.3], // This just works well
                height: LABEL_HEIGHT,
                color: color,
                position: labelPos,
            };
            let labelsprite = new TextSprite(label + ' = ' + (arcData.angleDegrees).toFixed(2) + '°', labelparams);
            group.add(labelsprite);

        }
        this.add(group);
        this.angleArcs.push(group);

        return arcData;
    }

    get scale() {
        return this.disk1.scale;
    }

    set scale(s) {
        this.disk1.scale = s;
        this.disk2.scale = s;
        // set lineofNodesArrow scale
        let ax_s = s * 1.3333;
        this.lineofNodesArrow.scale.fromArray([ax_s, ax_s, ax_s]);
        // set angleArcs scale
        for (let i = 0; i < this.angleArcs.length; i++) {
            this.angleArcs[i].scale.fromArray([s, s, s]);
        }


    }

}

/**
 * Creates an arc between two vectors.
 *
 * @param {THREE.Vector3} v1 - The starting vector.
 * @param {THREE.Vector3} v2 - The ending vector.
 * @param {Array<number>} center - The center of the arc as an array [x, y, z].
 * @param {number} [radius=1] - The radius of the arc.
 * @param {number} [segments=32] - The number of segments to divide the arc into.
 * @param {THREE.Vector3} [referenceNormal=null] - A reference normal vector to determine the arc direction.
 * @param {boolean} [wrapToPi=false] - Whether to wrap the angle to π.
 * @returns {Object} An object containing the following properties:
 *   - {THREE.CatmullRomCurve3} curve - The curve representing the arc.
 *   - {number} angle - The final angle of the arc in radians.
 *   - {number} angleDegrees - The final angle of the arc in degrees.
 *   - {THREE.Vector3} midPoint - The midpoint of the arc.
 *   - {THREE.Vector3} tangent - The tangent at the midpoint of the arc.
 *   - {number} arcDirection - The direction of the arc (-1 or 1).
 */
function createArcBetweenVectors(v1, v2, center, radius = 1, segments = 32, referenceNormal = null, wrapToPi = false) {
    // Normalize the vectors
    const start = v1.clone().normalize();
    const end = v2.clone().normalize();
    
    // Get the raw angle between vectors (0 to 2π)
    const rawAngle = getAngle(start,end);
    console.log('rawAngle', rawAngle * 180 / Math.PI);
    
    // Get the axis of rotation (perpendicular to both vectors)
    let axis = new THREE.Vector3().crossVectors(start, end).normalize();
    
    // If vectors are parallel, choose an arbitrary perpendicular axis
    if (axis.lengthSq() === 0) {
        axis.set(start.y, -start.x, 0).normalize();
    }
    
    // Calculate the angle based on wrapping preference
    let finalAngle = rawAngle;
    const crossProduct = new THREE.Vector3().crossVectors(start, end);
    const referenceVector = referenceNormal || new THREE.Vector3(0, 1, 0);
    const arcDirection = crossProduct.dot(referenceVector) < 0 ? -1 : 1;
    const isNegativeRotation = arcDirection < 0;

    if (wrapToPi) {
        // For angles that should be between 0 and π
        finalAngle = rawAngle % (twoPi);
        if (isNegativeRotation) {
            console.log("fffffffff beta < 0", finalAngle * 180 / pi);
        }
    }
    // Create points for the arc
    const points = [];
    for (let i = 0; i <= segments; i++) {
        const t = arcDirection * i / segments;

        
        // Create quaternion for rotation
        const quaternion = new THREE.Quaternion();
        // For π-wrapped angles, always use the shortest path
        // For 2π angles, use the direction determined by the cross product
        const rotationAngle = wrapToPi ? arcDirection*rawAngle : (isNegativeRotation ? -rawAngle : rawAngle);
        quaternion.setFromAxisAngle(axis, rotationAngle * t);
        
        // Rotate the start vector
        const point = start.clone();
        point.applyQuaternion(quaternion);
        
        // Scale to radius and add center offset
        point.multiplyScalar(radius);
        point.add(new THREE.Vector3(center[0], center[1], center[2]));
        
        points.push(point);
    }
    
    // Create curve from points
    const curve = new THREE.CatmullRomCurve3(points);
    
    return {
        curve,
        angle: finalAngle,
        angleDegrees: (finalAngle * 180) / Math.PI,  // convenience conversion to degrees
        midPoint: curve.getPointAt(0.5),
        tangent: curve.getTangentAt(0.5),
        arcDirection,
    };
}



/**
 * This function calculates the Euler angles between two arrays of eigenvectors (each 3x3 floats) in the same way that 
 * is done through the EulerDisks visualisation. i.e., by calculating a line of nodes and using three.js angleTo methods.
 * TODO: add in support for changing between active and passive!
 * @param {number[][]} A - The first array of eigenvectors.
 * @param {number[][]} B - The second array of eigenvectors.
 * @param {string} convention - The Euler angle convention to use.
 * @param {boolean} active - Whether to use active or passive transformation.
 * @returns {number[]} - An array of Euler angles in radians.
 */
function threejs_euler_between(A, B, convention, active, wrap=true) {
    let results = calculateVectors(A, B, !active);
    let alpha = results.alpha;
    let beta = results.beta;
    let gamma = results.gamma;
    return [alpha, beta, gamma];
}

function getAngle(v1, v2) {
    const rawAngle = v1.angleTo(v2);

    // Get the axis of rotation (perpendicular to both vectors)
    const axis = new THREE.Vector3().crossVectors(v1, v2).normalize();

    // If vectors are parallel, choose an arbitrary perpendicular axis
    if (axis.lengthSq() === 0) {
        axis.set(v1.y, -v1.x, 0).normalize();
    }

    // Calculate the full angle between 0 and 2π
    let angle;
    if (v1.clone().cross(v2).z < 0) {
        angle = 2 * Math.PI - rawAngle;
    } else {
        angle = rawAngle;
    }
    return angle;
}

function calculateVectors(evecs1, evecs2, passive, scalingFactor=1.0, eps=1e-6) {
    let x_A = new THREE.Vector3(...evecs1[0]);
    let y_A = new THREE.Vector3(...evecs1[1]);
    let z_A = new THREE.Vector3(...evecs1[2]);
    let x_B = new THREE.Vector3(...evecs2[0]);
    let y_B = new THREE.Vector3(...evecs2[1]);
    let z_B = new THREE.Vector3(...evecs2[2]);

    // update beta
    let beta = getAngle(z_B, z_A);
    
    // calculate line of nodes as cross product of disks' normal vectors
    let line_of_nodes = new THREE.Vector3().crossVectors(z_B, z_A);
    line_of_nodes.normalize();  
    
    // Check for Gimbal lock (i.e. if beta is 0 or π)
    const tolerance = 1e-6;
    if (Math.abs(beta) < tolerance || Math.abs(beta - pi) < tolerance) {
        console.warn("gimbal lock detected!");
        if (passive) {
            line_of_nodes = y_B;
        } else {
            line_of_nodes = y_A;
        }
    }
    // get alpha and gamma
    let alpha = getAngle(y_B, line_of_nodes);
    let gamma = getAngle(y_A, line_of_nodes);
    
    

    // if beta > pi, we reverse the line of nodes
    if (beta > Math.PI) {
        // line_of_nodes = line_of_nodes.negate();
        beta = 2 * Math.PI - beta;
        // alpha = getAngle(line_of_nodes, y_B);
        // gamma = getAngle(line_of_nodes, y_A);
    }

    
    console.log("🚀 alpha 1:", alpha * 180 / Math.PI);
    console.log("🚀 beta 1:", beta * 180 / Math.PI);
    console.log("🚀 gamma 1:", gamma * 180 / Math.PI);

    // This should be done for the first one. 

    // // What we really need is the logic for the equivalent angles...
    // if (passive) {
    //     if (beta > pi) {
    //         beta = 2 * pi - beta; // same as swapping z_A and z_B the beta calculation
    //         gamma = gamma - pi; // same as swapping line_of_nodes and y_A in the gamma calculation
    //         gamma  = mjs.mod(gamma, 2 * pi);

    //     }

    //     if (beta >= pi / 2 - eps) {
    //         alpha = pi - alpha;
    //         alpha  = mjs.mod(alpha, 2 * pi);
    //         beta = pi - beta;
    //         beta = mjs.mod(beta, 2 * pi);
    //         gamma = pi + gamma;
    //         gamma = mjs.mod(gamma, 2 * pi);
    //     }

    //     if (alpha >= pi - eps) {
    //         alpha = alpha - pi;
    //     }
    // } else {
    //     if (beta > pi) {
    //         beta = 2 * pi - beta;
    //         alpha = alpha - pi;
    //         alpha  = mjs.mod(alpha, 2 * pi);
    //     }

    //     if (beta >= pi / 2 - eps) {
    //         alpha = alpha + pi;
    //         alpha  = mjs.mod(alpha, 2 * pi);
    //         beta = pi - beta;
    //         beta = mjs.mod(beta, 2 * pi);
    //         gamma = pi - gamma;
    //         gamma = mjs.mod(gamma, 2 * pi);
    //     }

    //     if (gamma >= pi - eps) {
    //         gamma = gamma - pi;
    //     }
    // }

    // Scale vectors by scaling factor
    // x_A.setLength(scalingFactor);
    // y_A.setLength(scalingFactor);
    // z_A.setLength(scalingFactor);
    // x_B.setLength(scalingFactor);
    // y_B.setLength(scalingFactor);
    // z_B.setLength(scalingFactor);
    // line_of_nodes.setLength(scalingFactor);


    return {
        x_A,
        y_A,
        z_A,
        x_B,
        y_B,
        z_B,
        alpha,
        beta,
        gamma,
        line_of_nodes
    };
}



export {
    EulerDisks,
    EulerDisk,
    createArcBetweenVectors
}


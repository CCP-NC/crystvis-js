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

const LABEL_HEIGHT = 0.05; // For now fixed, just a value that works
const AXES_SCALE = 1.75; // 1.3333


// one EulerDisk is a circle axes
class EulerDisk extends THREE.Group {

    constructor(parameters = {}) {
        super();
        const defaults = {
            center: [0, 0, 0],
            eigenvectors: [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ],
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
        this.eigenvectors = parameters.eigenvectors;


    }

    get eigenvectors() {
        return JSON.parse(JSON.stringify(this._eigenvectors));
    }

    set eigenvectors(v) {
        this._eigenvectors = v;

        var basis = _.map(_.range(3), (i) => {
            return new THREE.Vector3(v[0][i],
                v[1][i],
                v[2][i]).normalize();
        });
        var rotm = new THREE.Matrix4();
        rotm.makeBasis(basis[0], basis[1], basis[2]);
        this.setRotationFromMatrix(rotm);
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


}

class EulerDisks extends THREE.Group {

    constructor(parameters = {}) {

        super();

        const defaults = {
            center: [0, 0, 0],
            eigenvectors1: [
                [1, 0, 0],
                [0, 1, 0],
                [0, 0, 1]
            ],
            // perp to eigenvectors1
            eigenvectors2: [
                [0, 1, 0],
                [-1, 0, 0],
                [0, 0, 1]
            ],
            angles: null,
            color1: 0xff0000,
            color2: 0x00ff00,
            opacity: 0.2,
            opacityMode: EulerDisks.DITHER,
            showCircles: true,
            showAxes: true,
            scalingFactor: 5.0,
            passive: false,
        };
        // angle arcs
        this.angleArcs = [];

        parameters = _.merge(defaults, parameters);

        var { disk1, disk2 } = this.drawDisks(parameters);

        // Set up some three vectors for all the axes
        // should these be transposed?
        let x_A = new THREE.Vector3(...mjs.transpose(disk1.eigenvectors)[0]);
        let y_A = new THREE.Vector3(...mjs.transpose(disk1.eigenvectors)[1]);
        let z_A = new THREE.Vector3(...mjs.transpose(disk1.eigenvectors)[2]);

        let x_B = new THREE.Vector3(...mjs.transpose(disk2.eigenvectors)[0]);
        let y_B = new THREE.Vector3(...mjs.transpose(disk2.eigenvectors)[1]);
        let z_B = new THREE.Vector3(...mjs.transpose(disk2.eigenvectors)[2]);
        
        let beta = z_A.angleTo(z_B) // in radians
        let beta2 = ((z_A.clone().cross(z_B).y < 0 ? -1 : 1) * Math.acos(z_A.dot(z_B)));
        console.log("🚀 ~ file: euler.js:271 ~ EulerDisks ~ constructor ~ beta:", beta * 180 / Math.PI)
        console.log("🚀 ~ file: euler.js:271 ~ EulerDisks ~ constructor ~ beta2:", beta2 * 180 / Math.PI)

        // handle edge cases:
        // if beta > pi/2 or beta < 0, we need to rotate one of the disks by pi about the line of nodes
        if (beta2 > Math.PI / 2 || beta2 < 0) {
            console.log("🚀 ~ file: euler.js:271 ~ EulerDisks. Correcting for beta outside 0 -90 deg")
            // rotate disk2 by pi about y_B
            let R = new THREE.Matrix4();
            R.makeRotationAxis(y_B, Math.PI);

            let R3 = new THREE.Matrix3().setFromMatrix4(R); // Create a 3x3 matrix from R
            let R3elements2D = [
                [R3.elements[0], R3.elements[1], R3.elements[2]],
                [R3.elements[3], R3.elements[4], R3.elements[5]],
                [R3.elements[6], R3.elements[7], R3.elements[8]]
            ];
            
            
            disk2.applyMatrix4(R);
            
            // apply R to eigenvectors also
            disk2.eigenvectors = mjs.multiply(R3elements2D, disk2.eigenvectors);
            // update x_B, y_B, z_B
            x_B = new THREE.Vector3(...mjs.transpose(disk2.eigenvectors)[0]);
            y_B = new THREE.Vector3(...mjs.transpose(disk2.eigenvectors)[1]);
            z_B = new THREE.Vector3(...mjs.transpose(disk2.eigenvectors)[2]);
            // update beta
            beta = z_A.angleTo(z_B);

            // // update beta
            // beta = z_A.angleTo(z_B);
            console.log("🚀 ~ file: euler.js:271 ~ EulerDisks ~ constructor ~ beta", beta)
        }

        // calculate line of nodes as cross product of disks' normal vectors
        // These are guaranteed to be the 'z' vectors of each disk
        let line_of_nodes = new THREE.Vector3();
        // if n1 and n2 are parallel (gimbal lock), then we can't use cross product
        const tolerance = 1e-10; // or any small value that suits your needs
        if (Math.abs(beta) < tolerance) {
            console.warn("gimbal lock detected!");
            if (this.passive) {
                // set line_of_nodes to y_B
                // todo check should this be y_A?
                line_of_nodes = y_B;
            }
            else {
                line_of_nodes = y_A;
            }
        } else {
            if (this.passive) {
                line_of_nodes.crossVectors(z_B, z_A);
            }
            else {
                line_of_nodes.crossVectors(z_A, z_B);
            }
        }
        line_of_nodes.normalize();
        // get alpha and gamma
        let alpha = line_of_nodes.angleTo(y_B);
        let gamma = y_A.angleTo(line_of_nodes);
        let alpha2 = ((line_of_nodes.clone().cross(y_B).y < 0 ? -1 : 1) * Math.acos(line_of_nodes.dot(y_B)));
        let gamma2 = ((y_A.clone().cross(line_of_nodes).y < 0 ? -1 : 1) * Math.acos(y_A.dot(line_of_nodes)));
        console.log("🚀 ~ file: euler.js:271 ~ EulerDisks ~ constructor ~ alpha:", alpha * 180 / Math.PI)
        console.log("🚀 ~ file: euler.js:271 ~ EulerDisks ~ constructor ~ alpha2:", alpha2 * 180 / Math.PI)
        console.log("🚀 ~ file: euler.js:271 ~ EulerDisks ~ constructor ~ gamma:", gamma * 180 / Math.PI)
        console.log("🚀 ~ file: euler.js:271 ~ EulerDisks ~ constructor ~ gamma2:", gamma2 * 180 / Math.PI)

        // if gamma is < 0 or > 180, we need to rotate disk2 by pi about z_B
        if ( gamma2 > Math.PI) {
            
            console.log("🚀 ~ file: euler.js:271 ~ EulerDisks. Correcting for gamma outside 0 -180 deg")
            // rotate disk2 by pi about z_B
            let R = new THREE.Matrix4();
            R.makeRotationAxis(z_B, Math.PI);
            
            let R3 = new THREE.Matrix3().setFromMatrix4(R); // Create a 3x3 matrix from R
            let R3elements2D = [
                [R3.elements[0], R3.elements[1], R3.elements[2]],
                [R3.elements[3], R3.elements[4], R3.elements[5]],
                [R3.elements[6], R3.elements[7], R3.elements[8]]
            ];

            disk2.applyMatrix4(R);
            // apply R to eigenvectors also
            disk2.eigenvectors = mjs.multiply(R3elements2D, disk2.eigenvectors);
            // update x_B, y_B, z_B
            x_B = new THREE.Vector3(...mjs.transpose(disk2.eigenvectors)[0]);
            y_B = new THREE.Vector3(...mjs.transpose(disk2.eigenvectors)[1]);
            z_B = new THREE.Vector3(...mjs.transpose(disk2.eigenvectors)[2]);
            // update gamma
            gamma = y_A.angleTo(line_of_nodes);
            console.log("🚀 ~ file: euler.js:271 ~ EulerDisks ~ constructor ~ gamma", gamma)
        }




        // draw line of nodes as grey arrow
        let arrow = new THREE.ArrowHelper(
            line_of_nodes,
            new THREE.Vector3(
                parameters.center[0],
                parameters.center[1],
                parameters.center[2]
            ),
            parameters.scalingFactor * AXES_SCALE,
            0x888888);
        this.add(arrow);
        this.lineofNodesArrow = arrow;

        // draw angle arcs
        // note to get the same order as tensorView for matlab, I need to swap 
        // alpha and gamma
        this.addArc(line_of_nodes, y_B, parameters.center, 0xDB4D29, 'α', false);
        this.addArc(y_A, line_of_nodes, parameters.center, 0x674AA3, 'γ', false);


        // if beta is negative, we need to flip the sign of z_B? No this is handled above
        console.log("🚀 ~ file: euler.js:271 ~ EulerDisks ~ constructor ~ beta", beta)
        // if (beta < 0) {
        //     this.addArc(z_B, z_A, parameters.center, 0x286639, 'β', false);
        // } else {
        //     this.addArc(z_A, z_B, parameters.center, 0x286639, 'β', false);
        // }
        this.addArc(z_A, z_B, parameters.center, 0x286639, 'β', false);



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

        // First EulerDisk
        var disk1 = new EulerDisk({
            center: parameters.center,
            eigenvectors: parameters.eigenvectors1,
            color: parameters.color1,
            opacity: parameters.opacity,
            opacityMode: parameters.opacityMode,
            showCircles: parameters.showCircles,
            showAxes: parameters.showAxes,
            scalingFactor: parameters.scalingFactor, // + 0.05 * parameters.scalingFactor,
            labels: ["x_A", "y_A", "z_A"]
        });
        this.add(disk1);

        // Second EulerDisk
        var disk2 = new EulerDisk({
            center: parameters.center,
            eigenvectors: parameters.eigenvectors2,
            color: parameters.color2,
            opacity: parameters.opacity,
            opacityMode: parameters.opacityMode,
            showCircles: parameters.showCircles,
            showAxes: parameters.showAxes,
            scalingFactor: parameters.scalingFactor, // - 0.05 * parameters.scalingFactor,
            labels: ["x_B", "y_B", "z_B"]
        });
        this.add(disk2);

        this.disk1 = disk1;
        this.disk2 = disk2;
        return { disk1, disk2 };
    }

    addArc(v1, v2, center, color, label, wrap = true) {
        // if v1 is not a vector, make it one
        if (v1.x === undefined) {
            v1 = new THREE.Vector3(v1[0], v1[1], v1[2]);
        }
        // if v2 is not a vector, make it one
        if (v2.x === undefined) {
            v2 = new THREE.Vector3(v2[0], v2[1], v2[2]);
        }


        // Angles
        let angle = v1.angleTo(v2) * 180 / Math.PI;
        console.log("angle v1 to v2: ", angle);
        // let's also try to get the angle between the two vectors from the cross product
        // since I think angleTo() always returns the smallest angle
        let angle2 = ((v1.clone().cross(v2).y < 0 ? -1 : 1) * Math.acos(v1.dot(v2)) * 180 / Math.PI);
        console.log("🚀 ~ file: euler.js:334 ~ EulerDisks ~ addArc ~ angle2:", angle2)
        const sign = Math.sign(angle);
        if (angle2 < 0 && wrap) {
            angle2 += 360;
            angle = angle2;
        }

        let start = new THREE.Vector3(
            center[0] + v1.x,
            center[1] + v1.y,
            center[2] + v1.z);

        let end = new THREE.Vector3(
            center[0] + v2.x,
            center[1] + v2.y,
            center[2] + v2.z);
        let midpoint = new THREE.Vector3(
            center[0] + sign * (v1.x + v2.x) / 2,
            center[1] + sign * (v1.y + v2.y) / 2,
            center[2] + sign * (v1.z + v2.z) / 2);


        // set lengths of control points
        let length = 4.0;
        // console.log(length);
        start.setLength(length * 1.0);
        midpoint.setLength(length * 1.5);
        end.setLength(length * 1.0);



        // draw curve
        let curve = new THREE.QuadraticBezierCurve3(start, midpoint, end);
        // let curve = createArcBetweenVectors(v1, v2, 3, 50)
        
        let geometry = new THREE.TubeGeometry(curve, 64, 0.05, 12, false);
        // add arrow to middle of arc
        let arrow = new THREE.ArrowHelper(
            curve.getTangentAt(0.5),
            curve.getPointAt(0.5),
            0.5,
            color,
            0.4,
            0.4
        );
        this.add(arrow);
        let material = new THREE.MeshBasicMaterial({ color: color });
        let arc = new THREE.Mesh(geometry, material);

        // make three group for arc and label
        let group = new THREE.Group();
        group.add(arc);


        // add label
        if (label) {
            let labelPos = midpoint.clone();
            labelPos.setLength(length * 1.5);
            let labelparams = {
                faceCamera: true,
                fixScale: true,
                shift: [0.0, 0, 0.3], // This just works well
                height: LABEL_HEIGHT,
                color: color,
                position: labelPos,
            };
            let labelsprite = new TextSprite(label + ' = ' + angle.toFixed(2) + '°', labelparams);
            group.add(labelsprite);

        }
        this.add(group);
        this.angleArcs.push(group);
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

// Function to rotate a disk by an angle about a given axis

// Function to create a cubic Bezier curve for an arc between two vectors
function createArcBetweenVectors(startVector, endVector, radius, segments = 50) {
    const startPoint = startVector.clone();
    const endPoint = endVector.clone();
    
    const center = new THREE.Vector3().addVectors(startVector, endVector).multiplyScalar(0.5);
    
    const normal = new THREE.Vector3().subVectors(startVector, endVector).normalize();
    const angle = startVector.angleTo(endVector);
    
    const binormal = new THREE.Vector3().crossVectors(normal, startVector).normalize();

    const points = [];
    
    for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const theta = angle * t;
        const x = radius * Math.cos(theta);
        const y = radius * Math.sin(theta);

        const pointOnCircle = new THREE.Vector3(x, y, 0);
        const rotatedPoint = new THREE.Vector3().addVectors(
            center.clone().add(pointOnCircle.clone().applyAxisAngle(normal, theta)),
            pointOnCircle.clone().applyAxisAngle(binormal, Math.PI / 2)
        );

        points.push(rotatedPoint);
    }

    return new THREE.CatmullRomCurve3(points);
}

export {
    EulerDisks
}


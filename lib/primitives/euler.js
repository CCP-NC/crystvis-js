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
const AXES_SCALE = 1.3333; //


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
            const cell = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
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
            scalingFactor: parameters.scalingFactor + 0.05 * parameters.scalingFactor,
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
            scalingFactor: parameters.scalingFactor - 0.05 * parameters.scalingFactor,
            labels: ["x_B", "y_B", "z_B"]
        });
        this.add(disk2);

        this.disk1 = disk1;
        this.disk2 = disk2;

        console.log(parameters)
        console.log(disk1)
        console.log(disk2)

        // calculate line of nodes as cross product of disks' normal vectors
        let n1 = new THREE.Vector3(disk1.eigenvectors[0][2], disk1.eigenvectors[1][2], disk1.eigenvectors[2][2]);
        let n2 = new THREE.Vector3(disk2.eigenvectors[0][2], disk2.eigenvectors[1][2], disk2.eigenvectors[2][2]);
        let axis = new THREE.Vector3();
        if (this.passive) {
            axis.crossVectors(n2, n1);
        }
        else {
            axis.crossVectors(n1, n2);
        }
        axis.normalize();
        // draw line of nodes as grey arrow
        let arrow = new THREE.ArrowHelper(
            axis,
            new THREE.Vector3(
                parameters.center[0],
                parameters.center[1],
                parameters.center[2]
            ),
            parameters.scalingFactor * AXES_SCALE,
            0x888888);
        this.add(arrow);
        this.commonAxis = arrow;

        // get eigenvectors as THREE.Vector3
        // TODO: I'm sure there's a neat way to do this with map() or something
        // Eigenvectors of the first disk
        let eig1_1 = new THREE.Vector3(disk1.eigenvectors[0][1], disk1.eigenvectors[1][1], disk1.eigenvectors[2][1]);
        let eig1_2 = new THREE.Vector3(disk1.eigenvectors[0][2], disk1.eigenvectors[1][2], disk1.eigenvectors[2][2]);
        // Eigenvectors of the second disk
        let eig2_1 = new THREE.Vector3(disk2.eigenvectors[0][1], disk2.eigenvectors[1][1], disk2.eigenvectors[2][1]);
        let eig2_2 = new THREE.Vector3(disk2.eigenvectors[0][2], disk2.eigenvectors[1][2], disk2.eigenvectors[2][2]);



        // add curved line connecting commonAxis and eigenvector 1 of disk 1
        // note swapped α and γ wrt easyspin website. I think this is correct
        // this.addArc(axis,   eig2_1, parameters.center, 0xe377c2, 'α');
        // this.addArc(eig2_2, eig1_2, parameters.center, 0x8c564b, 'β');
        // // sometime we need to flip the sign of eig1_1 to get the correct angle (correct wrt TensorView/Soprano...)
        // // i.e. eig1_1.multiplyScalar(-1)
        // this.addArc(eig1_1,   axis, parameters.center, 0x17becf, 'γ');
        // TODO: check if sign is correct!

        this.addArc(eig2_1, axis, parameters.center, 0xe377c2, 'α', true);
        this.addArc(eig1_2, eig2_2, parameters.center, 0x8c564b, 'β', false);
        // sometime we need to flip the sign of eig1_1 to get the correct angle (correct wrt TensorView/Soprano...)
        // i.e. eig1_1.multiplyScalar(-1)
        this.addArc(axis, eig1_1, parameters.center, 0x17becf, 'γ', true);


    }

    addArc(v1, v2, center, color, label, wrap = true) {
        // if v1 is not a vector, make it one
        if (v1.x === undefined) {
            // convert to THREE.Vector3
            let v1v = new THREE.Vector3(v1[0], v1[1], v1[2]);
            v1 = v1v;
        }
        // if v2 is not a vector, make it one
        if (v2.x === undefined) {
            // convert to THREE.Vector3
            let v2v = new THREE.Vector3(v2[0], v2[1], v2[2]);
            v2 = v2v;
        }


        // Angles
        let angle = v1.angleTo(v2) * 180 / Math.PI;
        console.log("angle v1 to v2: ", angle);
        // let's also try to get the angle between the two vectors from the cross product
        // since I think angleTo() always returns the smallest angle
        let angle2 = ((v1.clone().cross(v2).y < 0 ? -1 : 1) * Math.acos(v1.dot(v2)) * 180 / Math.PI);
        console.log("🚀 ~ file: euler.js:334 ~ EulerDisks ~ addArc ~ angle2:", angle2)
        const sign = Math.sign(angle2);
        if (angle2 < 0 && wrap) {
            angle2 += 360;
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
        let length = 2.0;
        // console.log(length);
        start.setLength(length * 1.0);
        midpoint.setLength(length * 1.5);
        end.setLength(length * 1.0);



        // draw curve
        let curve = new THREE.QuadraticBezierCurve3(start, midpoint, end);
        let geometry = new THREE.TubeGeometry(curve, 64, 0.025, 8, false);
        // add arrow to end of curve (TEMP HACK)
        let arrow = new THREE.ArrowHelper(
            v2,
            end,
            0.5,
            color,
            0.2,
            0.2
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
            let labelsprite = new TextSprite(label + ' = ' + angle2.toFixed(0) + '°', labelparams);
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
        // set commonAxis scale
        let ax_s = s * 1.3333;
        this.commonAxis.scale.fromArray([ax_s, ax_s, ax_s]);
        // set angleArcs scale
        for (let i = 0; i < this.angleArcs.length; i++) {
            this.angleArcs[i].scale.fromArray([s, s, s]);
        }


    }

}

export {
    EulerDisks
}


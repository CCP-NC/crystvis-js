# crystvis-js

A [Three.js](https://threejs.org/) based crystallographic visualisation tool. It reads multiple file formats and renders them with WebGL to a `canvas` element, allowing the user to interact with them. 

> **Note:** Version 0.6.0 includes a major update from Three.js 0.137 to 0.178. See [Three.js Migration Notes](docs-tutorials/ThreejsMigration.md) and [CHANGELOG](CHANGELOG.md) for details.

A few of the key functionality:

* visualize popular file formats as ball-and-stick structures, easily embedded within a webpage, with orbit mouse control for rotation and zooming;
* interactive visualisation responsive to user clicks via customizable callbacks;
* high definition text labels;
* advanced searching and selection functions to interact with specific subset of atoms (select by proximity, bonding, species and more);
* smart visualisation of molecular crystal: reconstruct full molecules across the periodic boundary;
* compute and display isosurfaces from volumetric data;
* visualize tensor data as ellipsoids centred on atoms.

### Supported formats 

The currently supported file formats are the following:

* **CIF**, using [crystcif-parse](https://github.com/CCP-NC/crystcif-parse);
* **XYZ**, specifically the Extended XYZ such as the one written by the [Atomic Simulation Environment](https://wiki.fysik.dtu.dk/ase/);
* **CELL**, input file supported by the DFT package [CASTEP](http://www.castep.org/);
* **Magres**, output file format for simulated NMR parameters used by CASTEP and Quantum Espresso and developed by the [CCP for NMR Crystallography](https://www.ccpnc.ac.uk/).

### Getting started 

In order to install `crystvis-js`, simply use the Node Package Manager:

```bash
npm install crystvis-js --save
```

You can then create a visualizer for your webpage by simply importing and instantiating it:

```js
import CrystVis from 'crystvis-js';

const visualizer = CrystVis('#target-id', 800, 600)
```

will create an 800x600 canvas with the visualizer inside the element specified by the given selector. To load a model, simply load the contents of your file as a text string and then pass them to the visualizer's `loadModels` method:

```js
var loaded = visualizer.loadModels(contents);
console.log('Models loaded: ', loaded);
visualizer.displayModel(loaded[0])
```

### Preparing for development

If you want to develop for crystvis-js, you should follow these steps:

* fork the repository
* clone the forked repository locally to your system
* install all the required packages, *including the development dependencies*, with `npm install --production=false`

You're then ready to develop. In particular you can use:

* `npm test` to run with Mocha the suite of tests found in `./test`
* `npm start` to start a server that includes the in-browser tests from `./test/test-html` as well as the demo from `./demo`
* `npm run docs` to compile the documents
* `npm run deploy-docs` to compile the documents and then deploy them to the `gh-pages` branch of your repository

#### Fonts and shaders

Some additional steps are necessary when dealing with fonts and shaders. You generally shouldn't worry about these when working 
with most of the code, but in some special cases it might be necessary to do this.

Fonts in crystvis-js need to be translated to a bitmap format to be usable. In other words, a regular font format (like a TTF file)
must be rendered into a bitmap texture and a table of coordinates designating each letter to then be used in graphical rendering. This operation
relies on the library `msdf-bmfont-xml` and is executed by running the command `npm run build-fonts`. The original fonts are found in
the `./fonts` folder, and they get rendered to `./lib/assets/fonts`. This command needs only to be rerun *if the TTF files change*.

Shaders are provided as `.frag` and `.vert` files. Both shaders and font textures need to baked directly into the JavaScript files in order to be 
included in the final build. Since ESBuild (the package used to build crystvis-js) has a hard time dealing with them in the final pass, they get
pre-baked with an additional step that only needs to be repeated whenever either of them changes. This consists of taking "template" JS files (for
shaders it's `./lib/shaders/index.in.js`, for fonts `./lib/assets/fonts/bmpfonts.in.js`) and rebuilding them into final files with the 
assets imported in data URL form. The script to do this is `npm run build-resources`. This command only needs to be rerun *if the fonts were rebuilt, if the shader
code was edited, or if any of the two template files was changed*.
import CrystVis from '@ccp-nc/crystvis-js';

export default async function (vis, console) {
    const cif = await fetch('data/CHA.cif').then((r) => r.text());
    vis.loadModels(cif, 'cif', 'cha');
    vis.displayModel('cha_CHA');
    vis.highlightSelected = true;

    vis.onAtomClick((atom) => {
        const [x, y, z] = atom.xyz.map((v) => v.toFixed(2));
        console.log(atom.crystLabel, atom.element, `(${x}, ${y}, ${z}) Å`);
        vis.selected = vis.model.view([atom.imgIndex]);
    }, CrystVis.LEFT_CLICK);

    vis.onAtomClick((atom) => {
        console.log(atom.crystLabel, 'is bonded to', atom.bondedAtoms.map((a) => a.crystLabel).join(', '));
    }, CrystVis.RIGHT_CLICK);
}

export default async function (vis, console) {
    const cif = await fetch('data/CHA.cif').then((r) => r.text());
    vis.loadModels(cif, 'cif', 'cha');
    vis.displayModel('cha_CHA');
    vis.highlightSelected = true;

    const centre = vis.model.fracToAbs([0.5, 0.5, 0.5]);
    const distance = (a) => Math.hypot(...a.xyz.map((v, i) => v - centre[i]));
    const si = vis.displayed.find({ elements: 'Si' }).atoms.reduce((a, b) => (distance(a) < distance(b) ? a : b));

    vis.selected = vis.model.find({ elements: 'O', sphere: [si, 3.5] });

    console.log(vis.selected.length, 'O atoms within 3.5 Å of', si.crystLabel);
    console.log(vis.selected.unique_labels_multiplicity);
}

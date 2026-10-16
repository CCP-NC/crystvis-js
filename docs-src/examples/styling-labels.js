export default async function (vis, console) {
    const cif = await fetch('data/org.cif').then((r) => r.text());
    vis.loadModels(cif, 'cif', 'org', { molecularCrystal: true });
    vis.displayModel('org_1501936');

    vis.displayed = vis.model.find({ molecule: [vis.displayed.atoms[0]] });
    vis.model.box.visible = false;
    vis.fitCamera();

    const heavy = vis.displayed.find({ elements: ['C', 'O'] });
    heavy.addLabels((a) => a.crystLabel, 'site', { height: 0.03, shift: [0.2, 0.2, 0], onOverlay: true });

    console.log(heavy.length, 'labelled atoms in one molecule');
}

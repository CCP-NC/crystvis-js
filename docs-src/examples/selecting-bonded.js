export default async function (vis, console) {
    const cif = await fetch('data/org.cif').then((r) => r.text());
    vis.loadModels(cif, 'cif', 'org', { molecularCrystal: true });
    vis.displayModel('org_1501936');
    const model = vis.model;

    const atom = model.find({ elements: 'C' }).atoms[0];
    const oneBond = model.find({ bonded: [atom, 1, true] });
    const twoBonds = model.find({ bonded: [atom, 2, true] });

    oneBond.setProperty('color', 0xff8800);
    twoBonds.setProperty('color', 0x3ddc84);

    const molecule = model.find({ molecule: [atom] });
    vis.displayed = molecule;
    model.box.visible = false;

    vis.fitCamera();

    console.log(oneBond.length, 'atoms one bond from', atom.crystLabel);
    console.log(twoBonds.length, 'atoms exactly two bonds away');
}

export default async function (vis, console) {
    const cif = await fetch('data/CHA.cif').then((r) => r.text());
    vis.loadModels(cif, 'cif', 'cha');
    vis.displayModel('cha_CHA');
    const model = vis.model;

    const oxygens = model.find({ $and: [{ elements: 'O' }, { cell: [[0, 0, 0]] }] });
    const nearOrigin = model.find({ sphere: [[0, 0, 0], 3] });
    const far = oxygens.remove(nearOrigin);

    far.setProperty('color', 0xff8800);
    console.log(far.length, 'of', oxygens.length, 'O atoms in the [0,0,0] cell are more than 3 Å from the origin');
}

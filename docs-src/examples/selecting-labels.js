export default async function (vis, console) {
    const cif = await fetch('data/CHA.cif').then((r) => r.text());
    vis.loadModels(cif, 'cif', 'cha');
    vis.displayModel('cha_CHA');
    const model = vis.model;

    console.log(model.find({ elements: 'O' }).unique_labels_multiplicity);

    const sites = model.find({ labels: ['O1', 'O3'] });
    sites.setProperty('color', 0xff8800);
    console.log(sites.length, 'atoms on sites O1 and O3');
}

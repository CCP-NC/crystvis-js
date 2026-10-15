export default async function (vis, console) {
    const cif = await fetch('data/CHA.cif').then((r) => r.text());
    vis.loadModels(cif, 'cif', 'cha', {supercell: [2, 2, 1]});
    vis.displayModel('cha_CHA');
    vis.displayed = vis.model.find({all: []});
    vis.fitCamera();
}

export default async function (vis, console) {
    const cif = await fetch('data/CHA.cif').then((r) => r.text());
    vis.loadModels(cif, 'cif', 'cha');
    vis.displayModel('cha_CHA');

    vis.displayed.find({ elements: 'O' }).setProperty('scale', 0.6);
    vis.displayed.find({ elements: 'Si' }).setProperty('color', '#8fdb95');
    vis.displayed.find({ elements: 'O' }).setProperty('opacity', 0.5);

    console.log(vis.displayed.find({ elements: 'Si' }).length, 'Si and',
        vis.displayed.find({ elements: 'O' }).length, 'O atoms in the cell');
}

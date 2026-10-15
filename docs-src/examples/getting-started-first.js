export default async function (vis, console) {
    const cif = await fetch('data/CHA.cif').then((r) => r.text());
    const status = vis.loadModels(cif, 'cif', 'cha');
    console.log('Loaded models:', Object.keys(status));
    vis.displayModel('cha_CHA');
    console.log(vis.model.length, 'atoms in the unit cell');
    console.log('Elements:', [...new Set(vis.model.symbols)].join(', '));
}

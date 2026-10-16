export default async function (vis, console) {
    const magres = await fetch('data/ethanol.magres').then((r) => r.text());
    vis.loadModels(magres, 'magres', 'ethanol');
    vis.displayModel('ethanol');

    const hydrogens = vis.model.find({elements: 'H'});
    hydrogens.addEllipsoids((atom) => atom.getArrayValue('ms'), 'ms', {
        scalingFactor: 0.075,
        opacity: 0.5,
        color: 0x3498db,
    });
    console.log('Shielding ellipsoids on', hydrogens.length, 'H atoms');
}

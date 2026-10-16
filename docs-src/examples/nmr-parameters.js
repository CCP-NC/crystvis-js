export default async function (vis, console) {
    const magres = await fetch('data/ethanol.magres').then((r) => r.text());
    vis.loadModels(magres, 'magres', 'ethanol');
    vis.displayModel('ethanol');

    vis.model.all.addLabels((atom) => `${atom.getArrayValue('ms').isotropy.toFixed(1)} ppm`, 'ms');

    for (const atom of vis.model.all.uniqueSites().atoms) {
        const ms = atom.getArrayValue('ms');
        console.log(
            atom.crystLabel.padEnd(5),
            'iso', ms.isotropy.toFixed(2).padStart(7),
            'aniso', ms.anisotropy.toFixed(2).padStart(7),
            'asym', ms.asymmetry.toFixed(2)
        );
    }
}

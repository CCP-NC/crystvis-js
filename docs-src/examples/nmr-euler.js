export default async function (vis, console) {
    const magres = await fetch('data/ethanol.magres').then((r) => r.text());
    vis.loadModels(magres, 'magres', 'ethanol');
    vis.displayModel('ethanol');

    const c1 = vis.model.find({elements: 'C'}).atoms[0];
    const orientation = c1.getArrayValue('ms').relativeOrientationTo(c1.getArrayValue('efg'), {
        sourceConvention: 'haeberlen',
        targetConvention: 'nqr',
    });
    const canonical = orientation.canonicalConfigurations;
    c1.addEulerDisks(orientation, 'relative', {
        radius: 2.5, scalingFactor: 2.5, configurationId: canonical[0].id,
    });

    console.log(orientation.orientationClass, canonical.length, 'canonical configurations');
    for (const c of canonical) {
        console.log(c.id, c.euler.map((a) => (a * 180 / Math.PI).toFixed(1)).join(' '));
    }

    let next = 0;
    vis.onAtomClick((atom) => {
        if (!atom.equals(c1)) return;
        next = (next + 1) % canonical.length;
        c1.getEulerDisks('relative').animateToConfiguration(canonical[next].id);
        console.log('Animating to', canonical[next].id);
    });
}

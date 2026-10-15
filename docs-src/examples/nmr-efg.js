export default async function (vis, console) {
    const magres = await fetch('data/ethanol.magres').then((r) => r.text());
    vis.loadModels(magres, 'magres', 'ethanol');
    vis.displayModel('ethanol');

    // The EFG magnitudes differ between C and O, so each element gets its own scale
    vis.model.find({elements: 'C'}).addEllipsoids((atom) => atom.getArrayValue('efg'), 'efg', {
        scalingFactor: 4.0,
        color: 0x2ecc71,
    });
    vis.model.find({elements: 'O'}).addEllipsoids((atom) => atom.getArrayValue('efg'), 'efg', {
        scalingFactor: 1.5,
        color: 0xf39c12,
    });

    // Q is in millibarn. The default O isotope is O-16, which has no quadrupole moment, so select O-17 first.
    const o = vis.model.find({elements: 'O'}).atoms[0];
    o.isotope = 17;
    const cq = o.getArrayValue('efg').efgAtomicToHz(o.isotopeData.Q);
    console.log('O-17 C_Q =', (cq.haeberlen_eigenvalues[2] / 1e6).toFixed(2), 'MHz');
}

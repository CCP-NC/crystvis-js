export default async function (vis, console) {
    const cif = await fetch('data/CHA.cif').then((r) => r.text());
    vis.loadModels(cif, 'cif', 'cha');
    vis.displayModel('cha_CHA');

    const dist = (p, q) => Math.hypot(...p.map((v, i) => v - q[i]));
    const byDist = (ref) => (p, q) => dist(p.xyz, ref) - dist(q.xyz, ref);

    const sis = vis.displayed.find({ elements: 'Si' }).atoms;
    const si = sis.sort(byDist(vis.model.fracToAbs([0.5, 0.5, 0.5])))[0];
    const o = si.bondedAtoms.filter((b) => b.element === 'O').sort(byDist(si.xyz))[0];
    const other = sis
        .filter((a) => a !== si && !a.bondedAtoms.some((b) => si.bondedAtoms.includes(b)))
        .sort(byDist(si.xyz))[0];

    vis.model.addLink(si, o, 'si-o', `${dist(si.xyz, o.xyz).toFixed(2)} Å`, { dashed: true });
    vis.model.addLink(si, other, 'si-si', `${dist(si.xyz, other.xyz).toFixed(2)} Å`, { color: 0x8fdb95 });
    vis.model.addSphere(si, 3.0, 'shell', { color: 0x66ccff, opacity: 0.15 });

    console.log('Si-O', dist(si.xyz, o.xyz).toFixed(3), 'Å; Si-Si', dist(si.xyz, other.xyz).toFixed(3), 'Å');
}

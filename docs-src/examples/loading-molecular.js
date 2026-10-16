export default async function (vis, console) {
    const cif = await fetch('data/org.cif').then((r) => r.text());
    vis.loadModels(cif, 'cif', 'org', { molecularCrystal: true });
    vis.displayModel('org_1501936');
    const atoms = vis.displayed.atoms;
    const molecules = new Set(atoms.map((a) => a.moleculeIndex));
    const bonds = atoms.reduce((n, a) => n + a.bonds.length, 0) / 2;
    console.log(atoms.length, 'atoms in the unit cell');
    console.log(molecules.size, 'molecules');
    console.log(bonds, 'bonds in the unit cell');
}

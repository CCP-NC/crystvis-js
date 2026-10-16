export default async function (vis, console) {
    const cif = await fetch('data/calcite.cif').then((r) => r.text());
    vis.loadModels(cif, 'cif', 'tight');
    vis.loadModels(cif, 'cif', 'loose', { vdwScaling: 1.3 });
    const countBonds = () => vis.model.atoms.reduce((n, a) => n + a.bonds.length, 0) / 2;
    vis.displayModel('tight_global');
    const tight = countBonds();
    vis.displayModel('loose_global');
    console.log(tight, 'bonds at vdwScaling 1.0');
    console.log(countBonds(), 'bonds at vdwScaling 1.3');
}

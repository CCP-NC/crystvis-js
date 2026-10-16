export default async function (vis, console) {
    const cif = await fetch('data/calcite.cif').then((r) => r.text());
    vis.loadModels(cif, 'cif', 'calcite', { supercell: [2, 2, 2] });
    vis.displayModel('calcite_global');
    vis.displayed = vis.model.find({ all: [] });
    vis.fitCamera();
    console.log(vis.model.length, 'atoms in the unit cell');
    console.log(vis.model.atoms.length, 'atoms in the 2x2x2 supercell');
}

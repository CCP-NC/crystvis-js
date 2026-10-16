export default async function (vis, console) {
    vis.theme = 'light';

    const cif = await fetch('data/CHA.cif').then((r) => r.text());
    vis.loadModels(cif, 'cif', 'cha');
    vis.displayModel('cha_CHA');

    vis.model.box.color = 0x2d47c9;
    vis.displayed.find({ labels: ['T1', 'O1'] }).uniqueSites().addLabels((a) => a.crystLabel, 'site');
    vis.addNotification('Light theme, cobalt cell box');
}

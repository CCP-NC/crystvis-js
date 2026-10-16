export default async function (vis, console) {
    const cha = await fetch('data/CHA.cif').then((r) => r.text());
    const ethanol = await fetch('data/ethanol.magres').then((r) => r.text());
    vis.loadModels(cha, 'cif', 'cha');
    vis.loadModels(ethanol, 'magres', 'ethanol');
    const stop = vis.onDisplayChange((name) => console.log('displayed:', name));
    vis.displayModel('cha_CHA');
    vis.displayModel('ethanol');
    console.log('loaded:', vis.modelList.join(', '));
    stop();
}

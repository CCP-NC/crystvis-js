export default async function (vis, console) {
    const cif = await fetch('data/CHA.cif').then((r) => r.text());
    vis.loadModels(cif, 'cif', 'cha');
    vis.displayModel('cha_CHA');

    // Blue at z = 0, red at z = 1
    const ramp = (t) => {
        const r = Math.round(255 * Math.min(1, Math.max(0, t)));
        return (r << 16) | (255 - r);
    };

    vis.displayed.setProperty('color', (a) => ramp(a.fxyz[2]));
    console.log('Coloured', vis.displayed.length, 'atoms by fractional z');
}

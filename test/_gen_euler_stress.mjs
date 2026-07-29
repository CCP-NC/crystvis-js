'use strict';
// Generator for Euler-vis stress-test magres files.
// Builds tensors from KNOWN principal-axis frames and rotations, then runs each
// through crystvis (the same code the app uses) to capture the exact expected
// angle tables. Writes .magres files + a README into MagresView's examples dir.

import * as fs from 'fs';
import * as path from 'path';
import * as mjs from 'mathjs';
import { TensorData } from '../lib/tensor.js';

const OUT = '/Users/jks/coding/magresview-2/examples/euler-stress-tests';
fs.mkdirSync(OUT, { recursive: true });

const D2R = Math.PI / 180;
const rz = a => [[Math.cos(a), -Math.sin(a), 0], [Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
const ry = b => [[Math.cos(b), 0, Math.sin(b)], [0, 1, 0], [-Math.sin(b), 0, Math.cos(b)]];
// Intrinsic active z-y-z rotation from Euler angles in degrees.
const R = (a, b, g) => mjs.multiply(mjs.multiply(rz(a * D2R), ry(b * D2R)), rz(g * D2R));
// Symmetric tensor with principal values `vals` (order xx,yy,zz) in frame F (axes = columns).
const tensor = (F, vals) => mjs.multiply(mjs.multiply(F, mjs.diag(vals)), mjs.transpose(F));
const I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

// Principal values chosen so the Haeberlen frame equals the construction frame:
// deviations satisfy |zz-iso| >= |xx-iso| >= |yy-iso|, so axes stay (x,y,z).
const MS_TRIAX = [32, 31, 27];    // iso 30 ppm, dev (2, 1, -3)
const EFG_TRIAX = [2, 1, -3];     // au, traceless, dev (2, 1, -3)
const MS_AXIAL = [31, 31, 28];    // iso 30, dev (1, 1, -2) -> axial, unique z
const MS_ISO = [30, 30, 30];      // isotropic -> spherical

function fmtMat(M) {
    const a = M.toArray ? M.toArray() : M;
    return a.flat().map(x => x.toFixed(10)).join(' ');
}

function magres({ cell, atoms, tensors }) {
    let s = '#$magres-abinitio-v1.0\n';
    s += '# Euler-vis stress test (generated). See README.md for expected angles.\n';
    s += '[atoms]\n  units lattice Angstrom\n  units atom Angstrom\n';
    s += `  lattice ${cell.flat().join(' ')}\n  symmetry P1\n`;
    for (const at of atoms)
        s += `atom ${at.sp} ${at.label} ${at.i} ${at.pos.join(' ')}\n`;
    s += '[/atoms]\n[magres]\n  units ms ppm\n  units efg au\n';
    for (const t of tensors)
        s += `  ${t.kind} ${t.sp} ${t.i} ${fmtMat(t.M)}\n`;
    s += '[/magres]\n';
    return s;
}

const cubic = [[10, 0, 0], [0, 10, 0], [0, 0, 10]];
const spec = { sourceConvention: 'haeberlen', targetConvention: 'haeberlen', sequence: 'zyz', active: true };

// Compute the expected table (default app settings) for an MS/EFG pair.
function table(msM, efgM, s = spec) {
    const o = new TensorData(msM).relativeOrientationTo(new TensorData(efgM), s);
    return o;
}

function fmtDeg(x) { return (x * 180 / Math.PI); }

function tableText(o) {
    if (o.orientationClass !== 'discrete')
        return `  orientation class: ${o.orientationClass} (no discrete Euler set)\n`;
    let t = '  #   source-flip   target-flip     alpha      beta     gamma   singular\n';
    o.configurations.forEach((c, i) => {
        const [a, b, g] = c.euler.map(fmtDeg);
        const [sf, tf] = c.id.replace('source:', '').replace('target:', '').split('|');
        t += `  ${String(i + 1).padStart(2)}  ${sf.padEnd(12)} ${tf.padEnd(12)} ` +
            `${a.toFixed(2).padStart(8)} ${b.toFixed(2).padStart(8)} ${g.toFixed(2).padStart(8)}` +
            `   ${c.singular.isSingular ? 'yes' : ''}\n`;
    });
    // canonical (beta<=90) representative
    const rep = o.configurations
        .map((c, i) => ({ i, b: c.euler[1], euler: c.euler.map(fmtDeg) }))
        .filter(c => c.b <= Math.PI / 2 + 1e-9)
        .sort((p, q) => p.euler[0] - q.euler[0])[0];
    if (rep) t += `  canonical representative (row ${rep.i + 1}): ` +
        `alpha=${rep.euler[0].toFixed(2)} beta=${rep.euler[1].toFixed(2)} gamma=${rep.euler[2].toFixed(2)}\n`;
    return t;
}

const cases = [];

// ── Case 1: cubic single atom, MS vs EFG rotated by known (30, 45, 60) ────────
{
    const KNOWN = [30, 45, 60];
    const msM = tensor(I3, MS_TRIAX);
    const efgM = tensor(R(...KNOWN), EFG_TRIAX);
    const file = '01_cubic_single_ms_efg_known.magres';
    fs.writeFileSync(path.join(OUT, file), magres({
        cell: cubic,
        atoms: [{ sp: 'Al', label: 'Al', i: 1, pos: [5, 5, 5] }],
        tensors: [{ kind: 'ms', sp: 'Al', i: 1, M: msM }, { kind: 'efg', sp: 'Al', i: 1, M: efgM }]
    }));
    cases.push({
        file, title: 'Cubic single atom — MS vs EFG, known relative rotation',
        how: `Pick the Al atom for both A and B (left- then right-click the same atom). Set A tensor = Shielding, B tensor = EFG. Defaults (Haeberlen, ZYZ, Active).`,
        note: `Built so the MS Haeberlen frame is the lab frame and the EFG frame is R_zyz(alpha=30, beta=45, gamma=60) applied to it. The (30, 45, 60) triple must appear as one of the 16 rows; other rows are its axis-flip equivalents.`,
        o: table(msM, efgM)
    });
}

// ── Case 2: axial MS -> continuous (free-rotation ring) ───────────────────────
{
    const msM = tensor(I3, MS_AXIAL);
    const efgM = tensor(R(20, 55, 70), EFG_TRIAX);
    const file = '02_axial_ms_discrete.magres';
    fs.writeFileSync(path.join(OUT, file), magres({
        cell: cubic,
        atoms: [{ sp: 'Al', label: 'Al', i: 1, pos: [5, 5, 5] }],
        tensors: [{ kind: 'ms', sp: 'Al', i: 1, M: msM }, { kind: 'efg', sp: 'Al', i: 1, M: efgM }]
    }));
    cases.push({
        file, title: 'Axial MS — discrete gauged orientation (reference gauge)',
        how: `Same atom for A and B; A = Shielding (axial, Haeberlen), B = EFG.`,
        note: `The MS tensor is axially symmetric (unique axis on z under Haeberlen). The rotation about that axis is a free gauge, so alpha is fixed to 0 and the orientation is DISCRETE (8 configs); beta is the angle of the MS unique axis from the EFG z. A free-rotation ring marks the gauged axis. (Selecting Increasing/Decreasing ordering here would place the unique axis on X and fall back to a warning.)`,
        o: table(msM, efgM)
    });
}

// ── Case 3: isotropic MS -> indeterminate ─────────────────────────────────────
{
    const msM = tensor(I3, MS_ISO);
    const efgM = tensor(R(10, 40, 25), EFG_TRIAX);
    const file = '03_isotropic_ms_indeterminate.magres';
    fs.writeFileSync(path.join(OUT, file), magres({
        cell: cubic,
        atoms: [{ sp: 'Al', label: 'Al', i: 1, pos: [5, 5, 5] }],
        tensors: [{ kind: 'ms', sp: 'Al', i: 1, M: msM }, { kind: 'efg', sp: 'Al', i: 1, M: efgM }]
    }));
    cases.push({
        file, title: 'Isotropic MS — indeterminate orientation',
        how: `Same atom for A and B; A = Shielding (isotropic), B = EFG.`,
        note: `The MS tensor is isotropic (spherical): the relative orientation is undefined. Expect the "isotropic — undefined" message and no disks.`,
        o: table(msM, efgM)
    });
}

// ── Case 4: parallel z axes -> singular (beta = 0) ────────────────────────────
{
    const msM = tensor(I3, MS_TRIAX);
    // Pure twist about z: z axes stay parallel, so beta = 0 (singular).
    const efgM = tensor(R(0, 0, 50), EFG_TRIAX);
    const file = '04_singular_beta0.magres';
    fs.writeFileSync(path.join(OUT, file), magres({
        cell: cubic,
        atoms: [{ sp: 'Al', label: 'Al', i: 1, pos: [5, 5, 5] }],
        tensors: [{ kind: 'ms', sp: 'Al', i: 1, M: msM }, { kind: 'efg', sp: 'Al', i: 1, M: efgM }]
    }));
    cases.push({
        file, title: 'Parallel z axes — singular display (beta = 0)',
        how: `Same atom for A and B; A = Shielding, B = EFG.`,
        note: `MS and EFG z principal axes are parallel, so beta = 0/180 and the line of nodes is undefined: only the combined twist (alpha+gamma) is physical. Rows are marked singular ('*'); arcs are hidden.`,
        o: table(msM, efgM)
    });
}

// ── Case 5: two atoms, bond along c; MS tilt vs internuclear (dipolar) axis ────
{
    // Orthorhombic cell, c along z; the A->B vector is along c (the dipolar axis).
    const cell = [[5, 0, 0], [0, 6, 0], [0, 0, 8]];
    // Atom A (Al): MS tilted by a known angle relative to the c/bond axis.
    const KNOWN_A = [0, 35, 0];    // MS z is 35 deg from c (the "dipolar-MS beta")
    const msA = tensor(R(...KNOWN_A), MS_TRIAX);
    // Atom B (O): EFG with its own distinct known orientation (genuine cross-atom).
    const KNOWN_B = [60, 70, 20];
    const efgB = tensor(R(...KNOWN_B), EFG_TRIAX);
    // Give both atoms both tensors so any A/B tensor combo is selectable.
    const efgA = tensor(R(15, 25, 40), EFG_TRIAX);
    const msB = tensor(R(70, 80, 10), MS_TRIAX);
    const file = '05_two_atom_bond_along_c.magres';
    fs.writeFileSync(path.join(OUT, file), magres({
        cell,
        atoms: [
            { sp: 'Al', label: 'Al', i: 1, pos: [0, 0, 0] },
            { sp: 'O', label: 'O', i: 1, pos: [0, 0, 2.4] }   // 2.4 Angstrom along c
        ],
        tensors: [
            { kind: 'ms', sp: 'Al', i: 1, M: msA }, { kind: 'efg', sp: 'Al', i: 1, M: efgA },
            { kind: 'ms', sp: 'O', i: 1, M: msB }, { kind: 'efg', sp: 'O', i: 1, M: efgB }
        ]
    }));
    cases.push({
        file, title: 'Two atoms, bond along c — MS vs internuclear (dipolar) axis, and cross-atom',
        how: `(a) MS-vs-dipolar: A = Al (Shielding), B = O, B tensor = Dipolar (A->B); the dipolar tensor is axial about the Al->O bond (unique axis on Z), so this pair is DISCRETE with gamma gauged to 0 and beta = the angle of the Al MS z-axis from the bond (~35 deg). ` +
            `(a') The same angle also appears against the Crystal frame (c along the bond): A = Al (Shielding), B = Al, B tensor = Crystal frame. ` +
            `(b) Cross-atom: A = Al (Shielding), B = O (EFG).`,
        note: `Cell c-axis is along the Al->O bond. Al MS was tilted 35 deg from c, so the MS-vs-bond beta is ~35 deg (the dipolar-MS angle). The dipolar tensor is axial with its unique axis on the bond (Z), so the MS-vs-Dipolar pair is DISCRETE with gamma gauged to 0 and beta ~35 deg; the crystal-frame table (a') reads the same 35 deg. O's EFG has its own known orientation R_zyz(60, 70, 20) for a genuine cross-atom test.`,
        extra: (() => {
            // Crystal-frame tensor as the app builds it (x||a, z||c*, y=z x x); here axis-aligned.
            const cryst = tensor(I3, [1, 2, 3]);
            // Dipolar tensor along the Al->O bond (c/z): axial, unique axis z.
            const dip = tensor(I3, [-1, -1, 2]);
            let t = 'Table (a) Al Shielding vs Dipolar (A->B):\n' + tableText(table(msA, dip));
            t += "\nTable (a') Al Shielding vs Crystal frame (discrete, same ~35 deg):\n" + tableText(table(msA, cryst));
            t += '\nTable (b) Al Shielding vs O EFG:\n' + tableText(table(msA, efgB));
            return t;
        })()
    });
}

// ── README ────────────────────────────────────────────────────────────────────
let readme = `# Euler-angle visualisation — stress-test magres files

Generated by \`crystvis-js/test/_gen_euler_stress.mjs\`. Each tensor is built from a
known principal-axis frame and rotation, then run through crystvis to record the
exact expected angle table (default app settings: **Haeberlen** ordering, **ZYZ**
sequence, **Active** sense). Angles are in degrees.

To use: load a file in MagresView, open the **Euler angles** sidebar, then
**left-click** an atom to set A and **right-click** to set B, and choose the
tensor for each side. The highlighted table row always equals the drawn geometry.

`;
for (const c of cases) {
    readme += `\n## ${c.file}\n\n**${c.title}**\n\n_How to view:_ ${c.how}\n\n_Construction:_ ${c.note}\n\n`;
    if (c.extra) readme += '```\n' + c.extra + '```\n';
    else readme += '```\n' + tableText(c.o) + '```\n';
}
fs.writeFileSync(path.join(OUT, 'README.md'), readme);

console.log('Wrote', cases.length, 'magres files + README to', OUT);
for (const c of cases) console.log(' -', c.file, '=>', c.o ? c.o.orientationClass : 'multi-table');

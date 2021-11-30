import json
from periodictable import elements
from soprano.data.nmr import _nmr_data

element_data = {};

for el in elements:
    sym = el.symbol
    Z = el.number

    if sym == 'n':
        # No use for neutrons; instead we use Muonium
        sym = 'Mu'

    data = {
        'symbol': sym,
        'Z': Z,
        'isotopes': {}
    }

    # Most abundant isotopes?
    most_iso = None
    most_iso_ab = 0

    most_NMR_iso = None
    most_NMR_iso_ab = 0

    most_Q_iso = None
    most_Q_iso_ab = 0

    nmr = _nmr_data.get(sym, {})

    for iso in el:

        mass = iso.mass
        if sym == 'Mu':
            mass = 0.113428913072988
        A = iso.isotope
        ab = iso.abundance

        if ab == 0:  # Does not exist in nature, irrelevant
            continue

        iso_nmr = nmr.get(str(A), {})
        spin = iso_nmr.get('I', None)
        gamma = iso_nmr.get('gamma', None)
        Q = iso_nmr.get('Q', None)

        # We completely skip including anything that has no spin data, and
        # is LESS abundant than any NMR-active isotope
        
        if spin is None:
            if ab < min(most_NMR_iso_ab, most_Q_iso_ab):
                continue
            else:
                spin = 0 # A safe assumption

        if ab > most_iso_ab:
            most_iso = A
            most_iso_ab = ab

        if ab > most_NMR_iso_ab and spin:
            most_NMR_iso = A
            most_NMR_iso_ab = ab

        if ab > most_Q_iso_ab and Q:
            most_Q_iso = A
            most_Q_iso_ab = ab

        data['isotopes'][A] = {
            'A': A,
            'mass': mass,
            'abundance': ab,
            'spin': spin,
            'gamma': gamma,
            'Q': Q
        }

    if most_iso is None:
        # No useful information...
        continue

    data['maxiso'] = str(most_iso) if most_iso else None
    data['maxiso_NMR'] = str(most_NMR_iso) if most_NMR_iso else None
    data['maxiso_Q'] = str(most_Q_iso) if most_Q_iso else None

    element_data[sym] = data

jsonstr = json.dumps(element_data, indent=2)

template = """const nmrData = {0};

export default nmrData;
"""

print(template.format(jsonstr))
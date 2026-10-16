'use strict';

import * as chai from 'chai';
import { OpenSans } from '../lib/assets/fonts/index.js';

const expect = chai.expect;

describe('Bitmap fonts', function() {

    it('parses the inline OpenSans font synchronously', function() {
        expect(OpenSans.font).to.not.equal(null);
        expect(OpenSans.ready).to.equal(true);
    });

    it('includes the literal % glyph', function() {
        const ids = OpenSans.font.chars.map((c) => c.id);
        expect(ids).to.include(37);
    });
});

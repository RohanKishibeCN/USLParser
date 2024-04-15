'use strict';

if (typeof window === 'undefined') {
    var usl = require('../../lib/usl.js');
    var chai = require('chai');
    var q = require('q');
    var chaiAsPromised = require('chai-as-promised');

    chai.should();
    chai.use(chaiAsPromised);
} else {
    var usl = USL.Parser;
    chai.should();
}

describe('Parser', function() {
    describe('Include', function() {
        it('should succeed on including local files', function(done) {
            usl.loadFile('test/usl-files/local.yml').should.eventually.deep.equal({
                title: 'MyApi',
                documentation: [
                    { title: 'Getting Started', content: '# Getting Started\n\nThis is a getting started guide.' }
                ]
            }).and.notify(done);
        });

        it('should succeed with windows file systems', function (done) {
            var expectedPath = 'C:\\Users\\test\\example.usl';

            var document = [
                '#%USL 0.1',
                'title: Example API'
            ].join('\n');

            var reader = new usl.FileReader(function (path) {
              path.should.equal(expectedPath);

              return q(document);
            });

            usl.loadFile(expectedPath, { reader: reader }).should.eventually.deep.equal({
                title: 'Example API'
            }).and.notify(done);
        });
    });
});

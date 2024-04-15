/* global USL, describe, it */

'use strict';

if (typeof window === 'undefined') {
  var usl           = require('../../lib/usl.js');
  var chai           = require('chai');
  var chaiAsPromised = require('chai-as-promised');

  chai.should();
  chai.use(chaiAsPromised);
} else {
  var usl           = USL.Parser;

  chai.should();
}

describe('Schemas', function () {
  it('should replace the value of a schema by default', function (done) {
    var expected = {
      title: 'Example',
      schemas: [{
        foo: 'some value here\n'
      }],
      resources: [{
        relativeUri: '/foo',
        methods: [{
          body: {
            'application/json': {
              schema: 'some value here\n'
            }
          },
          method: 'post'
        }],
        relativeUriPathSegments: [
          'foo'
        ]
      }]
    }
    usl.load([
      '#%USL 0.1',
      '---',
      'title: Example',
      'schemas:',
      '   - foo: |',
      '       some value here',
      '/foo:',
      '  post:',
      '    body:',
      '      application/json:',
      '        schema: foo'
    ].join('\n')).should.become(expected).and.notify(done);
  });

  it('should replace the value of a schema by default when feature flag is enabled', function (done) {
    var expected = {
      title: 'Example',
      schemas: [{
        foo: 'some value here\n'
      }],
      resources: [{
        relativeUri: '/foo',
        methods: [{
          body: {
            'application/json': {
              schema: 'some value here\n'
            }
          },
          method: 'post'
        }],
        relativeUriPathSegments: [
          'foo'
        ]
      }]
    }
    usl.load([
      '#%USL 0.1',
      '---',
      'title: Example',
      'schemas:',
      '   - foo: |',
      '       some value here',
      '/foo:',
      '  post:',
      '    body:',
      '      application/json:',
      '        schema: foo'
    ].join('\n'), 'api.usl', {applySchemas: true}).should.become(expected).and.notify(done);
  });

  it('should not replace the value of a schema by default when feature flag is disabled', function (done) {
    var expected = {
      title: 'Example',
      schemas: [{
        foo: 'some value here\n'
      }],
      resources: [{
        relativeUri: '/foo',
        methods: [{
          body: {
            'application/json': {
              schema: 'foo'
            }
          },
          method: 'post'
        }],
        relativeUriPathSegments: [
          'foo'
        ]
      }]
    }
    usl.load([
      '#%USL 0.1',
      '---',
      'title: Example',
      'schemas:',
      '   - foo: |',
      '       some value here',
      '/foo:',
      '  post:',
      '    body:',
      '      application/json:',
      '        schema: foo'
    ].join('\n'), 'api.usl', {applySchemas: false}).should.become(expected).and.notify(done);
  });
});

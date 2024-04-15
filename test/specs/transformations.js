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

describe('Transformations', function () {
  function getUSL() {
    return [
      '#%USL 0.1',
      '---',
      'title: My API'
    ].concat(Array.prototype.slice.call(arguments, 0)).join('\n');
  }

  describe('named parameters', function () {
    describe('required by default', function () {
      it('for base uri parameters at root level', function (done) {
        usl.load(getUSL(
          'baseUri: http://base.uri/{baseUriParameter1}'
        ))
          .should.eventually.have.deep.property('baseUriParameters.baseUriParameter1.required', true)
          .and.notify(done)
        ;
      });

      it('for uri parameters at resource level', function (done) {
        usl.load(getUSL(
          '/{uriParameter1}:'
        ))
          .should.eventually.have.deep.property('resources[0].uriParameters.uriParameter1.required', true)
          .and.notify(done)
        ;
      });
    });

    describe('NOT required by default', function () {
      it('for request headers', function (done) {
        usl.load(getUSL(
          '/:',
          '  get:',
          '    headers:',
          '      header1: {}'
        ))
          .should.eventually.have.deep.property('resources[0].methods[0].headers.header1')
          .that.not.have.property('required')
          .and.notify(done)
        ;
      });

      it('for response headers', function (done) {
        usl.load(getUSL(
          '/:',
          '  get:',
          '    responses:',
          '      200:',
          '        headers:',
          '          header1:'
        ))
          .should.eventually.have.deep.property('resources[0].methods[0].responses.200.headers.header1')
          .that.not.have.property('required')
          .and.notify(done)
        ;
      });

      it('for queryParameters', function (done) {
        usl.load(getUSL(
          '/:',
          '  get:',
          '    queryParameters:',
          '      queryParameter1:'
        ))
          .should.eventually.have.deep.property('resources[0].methods[0].queryParameters.queryParameter1')
          .that.not.have.property('required')
          .and.notify(done)
        ;
      });

      it('for formParameters', function (done) {
        usl.load(getUSL(
          '/:',
          '  post:',
          '    body:',
          '      application/x-www-form-urlencoded:',
          '        formParameters:',
          '          formParameter1:'
        ))
          .should.eventually.have.deep.property('resources[0].methods[0].body.application/x-www-form-urlencoded.formParameters.formParameter1')
          .that.not.have.property('required')
          .and.notify(done)
        ;
      });
    });
  });

  it('should fill empty named parameters with default values like displayName and type', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      'title: Title',
      'baseUri: http://server/api',
      '/:',
      '  get:',
      '    queryParameters:',
      '      parameter1:'
    ].join('\n');
    var expected = {
      title: 'Title',
      baseUri: 'http://server/api',
      protocols: [
        'HTTP'
      ],
      resources: [
        {
          relativeUriPathSegments: [ ],
          relativeUri: '/',
          methods: [
            {
              method: 'get',
              protocols: [
                'HTTP'
              ],
              queryParameters: {
                parameter1: {
                  displayName: 'parameter1',
                  type: 'string'
                }
              }
            }
          ]
        }
      ]
    };
    usl.load(definition).should.become(expected).and.notify(done);
  });
});

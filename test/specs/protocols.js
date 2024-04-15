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

describe('Protocols', function () {
  it('should use value from baseUri property for protocols property if not specified explicitly', function (done) {
    usl.load([
      '#%USL 0.1',
      '---',
      'title: Example',
      'baseUri: http://api.com'
    ].join('\n')).should.become({
      title: 'Example',
      baseUri: 'http://api.com',
      protocols: [
        'HTTP'
      ]
    }).and.notify(done);
  });

  it('should apply root protocols to methods', function (done) {
    usl.load([
      '#%USL 0.1',
      '---',
      'title: Example',
      'baseUri: http://api.com',
      '/:',
      '   get:'
    ].join('\n')).should.become({
      title: 'Example',
      baseUri: 'http://api.com',
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
              ]
            }
          ]
        }
      ]
    }).and.notify(done);
  });

  it('should inherit protocols from traits', function (done) {
    usl.load([
      '#%USL 0.1',
      '---',
      'title: Example',
      'baseUri: http://api.com',
      'traits:',
      '   - trait1:',
      '       protocols:',
      '           - HTTP',
      '           - HTTPS',
      '/:',
      '   get:',
      '       is:',
      '           - trait1'
    ].join('\n')).should.become({
      title: 'Example',
      baseUri: 'http://api.com',
      protocols: [
        'HTTP'
      ],
      traits: [
        {
          trait1: {
            protocols: [
              'HTTP',
              'HTTPS'
            ]
          }
        }
      ],
      resources: [
        {
          relativeUriPathSegments: [ ],
          relativeUri: '/',
          methods: [
            {
              method: 'get',
              is: [
                'trait1'
              ],
              protocols: [
                'HTTP',
                'HTTPS'
              ]
            }
          ]
        }
      ]
    }).and.notify(done);
  });

  it('should assume HTTP protocol by default if there is no protocols property and baseUri has no protocol either', function (done) {
    usl.load([
      '#%USL 0.1',
      '---',
      'title: Example',
      'baseUri: api.com'
    ].join('\n')).should.become({
      title: 'Example',
      baseUri: 'api.com',
      protocols: [
        'HTTP'
      ]
    }).and.notify(done);
  });
});

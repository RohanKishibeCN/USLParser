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
var schema = '{"$schema":"http://json-schema.org/draft-04/schema#","definitions":{"node":{"type":"object","properties":{"id":{"type":"string","format":"id"},"label":{"type":"string"},"children":{"type":"array","items":{"type":"object","required":["id","label","children"]}}}}},"type":"array"}';

describe('Schemas', function () {


  it('should dereference circular schemas with the default depth', function (done) {
    var expected = {
      "title": "Dereference Circular Test",
      "schemas": [
        {
          "circularSchema": schema
        }
      ],
      "resources": [
        {
          "relativeUri": "/inline-circular",
          "methods": [
          {
            "responses": {
              "200": {
                "body": {
                  "application/json": {
                    "schema": schema
                  }
                }
              }
            },
            "method": "get"
          }
          ],
          "relativeUriPathSegments": [ "inline-circular" ]
        }
      ]
    };

    usl.loadFile('http://localhost:9001/test/usl-files/dereference-circular.usl', {
      dereferenceSchemas: { maxDepth: 0}
    }).should.become(expected).and.notify(done);
  });
});

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

function itShouldBehaveLikeAnOptionalStructureNamedParameter(initialUsl) {
  function generateUsl(snippetUsl) {
    var indentation = '  ' + initialUsl.split('\n').slice(-1)[0].match(/^(\s*)/)[1];
    snippetUsl = snippetUsl.map(function (line) {
      return indentation + line;
    });

    return initialUsl + '\n' + snippetUsl.join('\n');
  }

  it('should fail when given a "displayName?" property', function (done) {
    var definition = generateUsl(['displayName?: Display Name']);
    usl.load(definition).should.be.rejected.and.notify(done);
  });

  it('should fail when given a "description?" property', function (done) {
    var definition = generateUsl(['description?: A description of the header']);
    usl.load(definition).should.be.rejected.and.notify(done);
  });

  it('should fail when given a "type?" property', function (done) {
    var definition = generateUsl(['type?: integer']);
    usl.load(definition).should.be.rejected.and.notify(done);
  });

  it('should succeed when given a "enum?" property', function (done) {
    var definition = generateUsl(['enum?: ["one-value", "another-value"]']);
    usl.load(definition).should.be.fulfilled.and.notify(done);
  });

  it('should fail when given a "pattern?" property', function (done) {
    var definition = generateUsl(['pattern?: ']);
    usl.load(definition).should.be.rejected.and.notify(done);
  });

  it('should fail when given a "minLength?" property', function (done) {
    var definition = generateUsl(['minLength?: 3']);
    usl.load(definition).should.be.rejected.and.notify(done);
  });

  it('should fail when given a "maxLength?" property', function (done) {
    var definition = generateUsl(['maxLength?: 16']);
    usl.load(definition).should.be.rejected.and.notify(done);
  });

  it('should fail when given a "minimum?" property', function (done) {
    var definition = generateUsl(['type: number', 'minimum?: 20']);
    usl.load(definition).should.be.rejected.and.notify(done);
  });

  it('should fail when given a "maximum?" property', function (done) {
    var definition = generateUsl(['type: number', 'maximum?: 100']);
    usl.load(definition).should.be.rejected.and.notify(done);
  });

  it('should fail when given a "example?" property', function (done) {
    var definition = generateUsl(['example?: 5']);
    usl.load(definition).should.be.rejected.and.notify(done);
  });

  it('should fail when given a "repeat?" property', function (done) {
    var definition = generateUsl(['repeat?: true']);
    usl.load(definition).should.be.rejected.and.notify(done);
  });

  it('should fail when given a "required?" property', function (done) {
    var definition = generateUsl(['required?: true']);
    usl.load(definition).should.be.rejected.and.notify(done);
  });

  it('should fail when given a "default?" property', function (done) {
    var definition = generateUsl(['default?: Untitled']);
    usl.load(definition).should.be.rejected.and.notify(done);
  });
}

describe('Resource Types Validations', function () {
  var topLevelSnippetAndResourceTypeSnippet = function (topLevelUsl, resourceTypeUsl) {
    var resourceTypeIdentation = '      ';
    resourceTypeUsl = resourceTypeUsl.map(function (line) {
      return resourceTypeIdentation + line;
    });

    return [
      '#%USL 0.1',
      '---',
      'title: Test'
//      'baseUri: http://{apiSubdomain}.api.com/{someUriParameter}'
    ]
    .concat(topLevelUsl)
    .concat([
      'resourceTypes:',
      '  - collection:'
    ])
    .concat(resourceTypeUsl)
    .join('\n');
  };

  var resourceTypeSnippet = function (resourceTypeUsl) {
    return topLevelSnippetAndResourceTypeSnippet([], resourceTypeUsl);
  };

  it('should succeed when empty');

  describe('Allowed Resource Properties', function () {
    it('should succeed when given a "displayName" property', function (done) {
      var definition = resourceTypeSnippet([ 'displayName: Display Name']);
      usl.load(definition).should.be.fulfilled.and.notify(done);
    });

    it('should succeed when given a "description" property', function (done) {
      var definition = resourceTypeSnippet([ 'description: Description text']);
      usl.load(definition).should.be.fulfilled.and.notify(done);
    });

    it('should succeed when given a "uriParameters" property (does not complain about being unused)', function (done) {
      var definition = resourceTypeSnippet([
        'uriParameters:',
        '  someUriParameter:',
        '    displayName: User ID',
        '    type: integer'
      ]);
      usl.load(definition).should.be.fulfilled.and.notify(done);
    });

    it('should succeed when given a "baseUriParameters" property', function (done) {
      var definition = topLevelSnippetAndResourceTypeSnippet([
        'baseUri: https://{apiSubdomain}.example.com/'
      ], [
        'baseUriParameters:',
        '  apiSubdomain:',
        '    enum: [ "api-content" ]'
      ]);
      usl.load(definition).should.be.fulfilled.and.notify(done);
    });

    describe('methods', function () {
      ['get', 'post', 'put', 'delete', 'head', 'patch', 'options'].forEach(function (method) {
        it('should succeed when given a "' + method + '" method property', function (done) {
          var definition = resourceTypeSnippet([
            method + ':',
            '  description: Description of what a call to method does'
          ]);
          usl.load(definition).should.be.fulfilled.and.notify(done);
        });
      });

      describe('method properties', function () {
        it('should succeed when given a "description" property', function (done) {
          var definition = resourceTypeSnippet([
            'get:',
            '  description: A description of the get, if it exists'
          ]);
          usl.load(definition).should.be.fulfilled.and.notify(done);
        });

        it('should succeed when given a "headers" property', function (done) {
          var definition = resourceTypeSnippet([
            'get:',
            '  headers:'
          ]);
          usl.load(definition).should.be.fulfilled.and.notify(done);
        });

        it.skip('should succeed when given a "protocols" property', function (done) {
          var definition = resourceTypeSnippet([
            'get:',
            '  protocols: [HTTPS]'
          ]);
          usl.load(definition).should.be.fulfilled.and.notify(done);
        });

        it('should succeed when given a "queryParameters" property', function (done) {
          var definition = resourceTypeSnippet([
            'get:',
            '  queryParameters:'
          ]);
          usl.load(definition).should.be.fulfilled.and.notify(done);
        });

        it('should succeed when given a "body" property', function (done) {
          var definition = resourceTypeSnippet([
            'get:',
            '  body:'
          ]);
          usl.load(definition).should.be.fulfilled.and.notify(done);
        });
      });
    });

    it('should succeed when given a "type" property', function (done) {
      var definition = resourceTypeSnippet([ 'type: collection']);
      usl.load(definition).should.be.fulfilled.and.notify(done);
    });

    it('should succeed when given an "is" property', function (done) {
      var definition = topLevelSnippetAndResourceTypeSnippet([
        'traits:',
        '  - secured:',
        '      description: Some description'
      ], [
        'is: [secured]'
      ]);
      usl.load(definition).should.be.fulfilled.and.notify(done);
    });
  });

  it('should fail when given a nested resource', function (done) {
    var definition = resourceTypeSnippet([
      '/resource:',
      '  get:',
      '    description: Get'
    ]);
    usl.load(definition).should.be.rejectedWith(/resource type cannot define child resources/).and.notify(done);
  });

  it('should succeed when given a usage property', function (done) {
    var definition = resourceTypeSnippet([
      'usage: This resourceType should be used for any collection of items'
    ]);
    usl.load(definition).should.be.fulfilled.and.notify(done);
  });

  it('should fail when given a usage property in a method', function (done) {
    var definition = resourceTypeSnippet([
      'post:',
      '  usage: This resourceType should be used for any collection of items'
    ]);
    usl.load(definition).should.be.rejectedWith(/property: 'usage' is invalid in a method/).and.notify(done);
  });

  describe('Optional Properties', function () {
    it('should fail when given a "displayName?" property', function (done) {
      var definition = resourceTypeSnippet([ 'displayName?: Display Name']);
      usl.load(definition).should.be.rejected.and.notify(done);
    });

    it('should succeed when given a "description?" property', function (done) {
      var definition = resourceTypeSnippet([ 'description?: Description text']);
      usl.load(definition).should.be.rejected.and.notify(done);
    });

    describe('uriParameters', function () {
      it('should succeed when given a "uriParameters?" property', function (done) {
        var definition = resourceTypeSnippet([
          'uriParameters?:',
          '  someUriParameter:',
          '    displayName: User ID',
          '    type: integer'
        ]);
        usl.load(definition).should.be.fulfilled.and.notify(done);
      });

      describe('uriParameters properties and sub-properties', function () {
        it('should succeed when given a uri parameter ending with ?', function (done) {
          var definition = resourceTypeSnippet([
            'uriParameters:',
            '  someUriParameter?:',
            '    displayName: User ID',
            '    type: integer'
          ]);
          usl.load(definition).should.be.fulfilled.and.notify(done);
        });

        itShouldBehaveLikeAnOptionalStructureNamedParameter(
          resourceTypeSnippet([
            'uriParameters:',
            '  someUriParameter:'
          ])
        );
      });
    });

    describe('baseUriParameters', function () {
      it('should fail when given a base uri parameter that is not defined', function (done) {
        var definition = topLevelSnippetAndResourceTypeSnippet([
          'baseUri: https://api.example.com/'
        ], [
          'baseUriParameters?:',
          '  nonExistingParameter:',
          '    enum: [ "api-content" ]'
        ]);
        usl.load(definition).should.be.rejectedWith(/uri parameter unused/).and.notify(done);
      });

      it('should succeed when given a "baseUriParameters?" property', function (done) {
        var definition = topLevelSnippetAndResourceTypeSnippet([
          'baseUri: https://{apiSubdomain}.example.com/'
        ], [
          'baseUriParameters?:',
          '  apiSubdomain:',
          '    enum: [ "api-content" ]'
        ]);
        usl.load(definition).should.be.fulfilled.and.notify(done);
      });

      it('should succeed when given a base uri parameter ending with ?', function (done) {
          var definition = topLevelSnippetAndResourceTypeSnippet([
            'baseUri: https://{apiSubdomain}.example.com/'
          ], [
            'baseUriParameters:',
            '  apiSubdomain?:',
            '    enum: [ "api-content" ]'
          ]);
          usl.load(definition).should.be.fulfilled.and.notify(done);
        });

      itShouldBehaveLikeAnOptionalStructureNamedParameter(
        topLevelSnippetAndResourceTypeSnippet([
          'baseUri: https://{apiSubdomain}.example.com/'
        ], [
          'baseUriParameters:',
          '  apiSubdomain:'
        ])
      );
    });

    describe('methods', function () {
      ['get?', 'post?', 'put?', 'delete?', 'head?', 'patch?', 'options?'].forEach(function (method) {
        it('should succeed when given a "' + method + '" method property', function (done) {
          var definition = resourceTypeSnippet([
            method + ':',
            '  description: Description of what a call to method does'
          ]);
          usl.load(definition).should.be.fulfilled.and.notify(done);
        });
      });

      describe('method properties', function () {
        it('should fail when given a "description?" property', function (done) {
          var definition = resourceTypeSnippet([
            'get:',
            '  description?: A description of the get, if it exists'
          ]);
          usl.load(definition).should.be.rejected.and.notify(done);
        });

        it('should succeed when given a "headers?" property', function (done) {
          var definition = resourceTypeSnippet([
            'get:',
            '  headers?:'
          ]);
          usl.load(definition).should.be.fulfilled.and.notify(done);
        });

        describe('header properties and sub-properties', function () {
          it('should succeed when given a header containing {*} and ?');

          itShouldBehaveLikeAnOptionalStructureNamedParameter(
            resourceTypeSnippet([
              'get:',
              '  headers:',
              '    some-header:'
            ])
          );
        });

        it.skip('should succeed when given a "protocols?" property', function (done) {
          var definition = resourceTypeSnippet([
            'get:',
            '  protocols?: [HTTPS]'
          ]);
          usl.load(definition).should.be.fulfilled.and.notify(done);
        });

        it('should succeed when given a "queryParameters?" property', function (done) {
          var definition = resourceTypeSnippet([
            'get:',
            '  queryParameters?:'
          ]);
          usl.load(definition).should.be.fulfilled.and.notify(done);
        });

        describe('query parameter sub-properties', function () {
          itShouldBehaveLikeAnOptionalStructureNamedParameter(
            resourceTypeSnippet([
              'get:',
              '  queryParameters:',
              '    page:'
            ])
          );
        });

        it('should succeed when given a "body?" property', function (done) {
          var definition = resourceTypeSnippet([
            'get:',
            '  body?:'
          ]);
          usl.load(definition).should.be.fulfilled.and.notify(done);
        });

        describe('body form parameters', function () {
          it('should succeed when given a "formParameters?" property', function (done) {
            var definition = resourceTypeSnippet([
              'get:',
              '  body:',
              '    application/x-www-form-urlencoded:',
              '      formParameters?:',
              '        someFormParameter:',
              '          displayName: Some form parameter'
            ]);
            usl.load(definition).should.be.fulfilled.and.notify(done);
          });

          it('should succeed when given a form parameter with a ?', function (done) {
            var definition = resourceTypeSnippet([
              'get:',
              '  body:',
              '    application/x-www-form-urlencoded:',
              '      formParameters:',
              '        someFormParameter?:',
              '          displayName: Some form parameter'
            ]);
            usl.load(definition).should.be.fulfilled.and.notify(done);
          });

          itShouldBehaveLikeAnOptionalStructureNamedParameter(
            resourceTypeSnippet([
              'get:',
              '  body:',
              '    application/x-www-form-urlencoded:',
              '      formParameters:',
              '        someFormParameter?:'
            ])
          );
        });
      });
    });

    it('should fail when given a "type?" property', function (done) {
      var definition = resourceTypeSnippet([ 'type?: collection']);
      usl.load(definition).should.be.rejectedWith(/property: 'type\?' is invalid in a resource type/).and.notify(done);
    });

    it('should fail when given an "is?" property', function (done) {
      var definition = resourceTypeSnippet([ 'is?: [secured]']);
      usl.load(definition).should.be.rejectedWith(/property: 'is\?' is invalid in a resource type/).and.notify(done);
    });

    it('should fail when given a "usage?" property', function (done) {
      var definition = resourceTypeSnippet([
        'usage?: This resourceType should be used for any collection of items'
      ]);
      usl.load(definition).should.be.rejectedWith(/property: 'usage\?' is invalid in a resource type/).and.notify(done);
    });

    it('should fail when given a nested resource that ends with ?', function (done) {
      var definition = resourceTypeSnippet([
        '/resource?:',
        '  get:',
        '    summary: Get'
      ]);
      usl.load(definition).should.be.rejectedWith(/resource type cannot define child resources/).and.notify(done);
    });
  });

  describe('Parameters', function () {
    it('should fail unless a parameter name includes at least one non-white-space character', function (done) {
      var definition = resourceTypeSnippet([
        '<< >>:'
      ]);
      // TODO Add error message
      usl.load(definition).should.be.rejected.and.notify(done);
    });

    it('should allow a parameter as a top-level key', function (done) {
      var definition = resourceTypeSnippet([
        '<<some-parameter>>:'
      ]);
      usl.load(definition).should.be.fulfilled.and.notify(done);
    });

    describe('uriParameters', function () {
      it('should allow a parameter as a key', function (done) {
        var definition = resourceTypeSnippet([
          'uriParameters:',
          '  <<some-parameter>>:'
        ]);
        usl.load(definition).should.be.fulfilled.and.notify(done);
      });

      it('should allow a parameter as a key beneath a uri parameter', function (done) {
        var definition = resourceTypeSnippet([
          'uriParameters:',
          '  someUriParameter:',
          '    <<some-parameter>>:'
        ]);
        usl.load(definition).should.be.fulfilled.and.notify(done);
      });
    });

    describe('baseUriParameters', function () {
      it('should allow a parameter as a key', function (done) {
        var definition = topLevelSnippetAndResourceTypeSnippet([
          'baseUri: https://{apiSubdomain}.example.com/'
        ], [
          'baseUriParameters:',
          '  <<some-parameter>>:'
        ]);
        usl.load(definition).should.be.fulfilled.and.notify(done);
      });

      it('should allow a parameter as a key beneath a base uri parameter', function (done) {
        var definition = topLevelSnippetAndResourceTypeSnippet([
          'baseUri: https://{apiSubdomain}.example.com/'
        ], [
          'baseUriParameters:',
          '  apiSubdomain:',
          '    <<some-parameter>>:'
        ]);
        usl.load(definition).should.be.fulfilled.and.notify(done);
      });
    });

    describe('methods', function () {
      ['get', 'post', 'put', 'delete', 'head', 'patch', 'options'].forEach(function (method) {
        it('should allow a parameter as a key beneath ' + method, function (done) {
          var definition = resourceTypeSnippet([
            method + ':',
            '  <<some-parameter>>:'
          ]);
          usl.load(definition).should.be.fulfilled.and.notify(done);
        });
      });

      it('should allow a parameter as a key beneath "get > headers"', function (done) {
        var definition = resourceTypeSnippet([
          'get:',
          '  headers:',
          '    <<some-parameter>>:'
        ]);
        usl.load(definition).should.be.fulfilled.and.notify(done);
      });

      it('should allow a parameter as a key beneath "get > headers > some-header"', function (done) {
        var definition = resourceTypeSnippet([
          'get:',
          '  headers:',
          '    some-header:',
          '      <<some-parameter>>:'
        ]);
        usl.load(definition).should.be.fulfilled.and.notify(done);
      });

      it('should allow a parameter as a key beneath "get > queryParameters"', function (done) {
        var definition = resourceTypeSnippet([
          'get:',
          '  queryParameters:',
          '    <<some-parameter>>:'
        ]);
        usl.load(definition).should.be.fulfilled.and.notify(done);
      });

      it('should allow a parameter as a key beneath "get > queryParameters > some-query-parameter"', function (done) {
        var definition = resourceTypeSnippet([
          'get:',
          '  queryParameters:',
          '    some-query-parameter:',
          '      <<some-parameter>>:'
        ]);
        usl.load(definition).should.be.fulfilled.and.notify(done);
      });

      it('should allow a parameter as a key beneath "get > body"', function (done) {
        var definition = resourceTypeSnippet([
          'get:',
          '  body:',
          '    <<some-parameter>>:'
        ]);
        usl.load(definition).should.be.fulfilled.and.notify(done);
      });
    });
  });
});

describe('Trait Validations', function () {
  var topLevelSnippetAndTraitSnippet = function (topLevelUsl, traitUsl) {
    var traitIdentation = '      ';
    traitUsl = traitUsl.map(function (line) {
      return traitIdentation + line;
    });

    return [
      '#%USL 0.1',
      '---',
      'title: Test'
    ]
    .concat(topLevelUsl)
    .concat([
      'traits:',
      '  - secured:'
    ])
    .concat(traitUsl)
    .join('\n');
  };

  var traitSnippet = function (traitUsl) {
    return topLevelSnippetAndTraitSnippet([], traitUsl);
  };

  it('should fail when given an unknown property', function (done) {
    var definition = traitSnippet([ 'unknown: Some value']);
    usl.load(definition).should.be.rejectedWith(/property: 'unknown' is invalid in a trait/).and.notify(done);
  });

  it('should fail when given an "is" property', function (done) {
    var definition = traitSnippet([ 'is: [someTrait]']);
    usl.load(definition).should.be.rejectedWith(/property: 'is' is invalid in a trait/).and.notify(done);
  });

  it('should fail when given a "type" property', function (done) {
    var definition = traitSnippet([ 'type: [someType]']);
    usl.load(definition).should.be.rejectedWith(/property: 'type' is invalid in a trait/).and.notify(done);
  });

  describe('Optional Properties', function () {
    it('should fail when given a "usage?" property', function (done) {
      var definition = traitSnippet([
        'usage?: This trait should be used for ...'
      ]);
      usl.load(definition).should.be.rejectedWith(/property: 'usage\?' is invalid in a trait/).and.notify(done);
    });

    it('should fail when given a "type?" property', function (done) {
      var definition = traitSnippet([ 'type?: collection']);
      usl.load(definition).should.be.rejectedWith(/property: 'type\?' is invalid in a trait/).and.notify(done);
    });

    it('should fail when given an "is?" property', function (done) {
      var definition = traitSnippet([ 'is?: [secured]']);
      usl.load(definition).should.be.rejectedWith(/property: 'is\?' is invalid in a trait/).and.notify(done);
    });

    describe('method properties', function () {
      it('should fail when given a "description?" property', function (done) {
        var definition = traitSnippet([
          'description?: A description of the get, if it exists'
        ]);
        usl.load(definition).should.be.rejected.and.notify(done);
      });

      it('should succeed when given a "headers?" property', function (done) {
        var definition = traitSnippet([
          'headers?:'
        ]);
        usl.load(definition).should.be.fulfilled.and.notify(done);
      });

      describe('header properties and sub-properties', function () {
        it('should succeed when given a header containing {*} and ?');

        itShouldBehaveLikeAnOptionalStructureNamedParameter(
          traitSnippet([
            'headers:',
            '  some-header:'
          ])
        );
      });

      it.skip('should succeed when given a "protocols?" property', function (done) {
        var definition = traitSnippet([
          'protocols?: [HTTPS]'
        ]);
        usl.load(definition).should.be.fulfilled.and.notify(done);
      });

      it('should succeed when given a "queryParameters?" property', function (done) {
        var definition = traitSnippet([
          'queryParameters?:'
        ]);
        usl.load(definition).should.be.fulfilled.and.notify(done);
      });

      describe('query parameter sub-properties', function () {
        itShouldBehaveLikeAnOptionalStructureNamedParameter(
          traitSnippet([
            'queryParameters:',
            '  page:'
          ])
        );
      });

      it('should succeed when given a "body?" property', function (done) {
        var definition = traitSnippet([
          'body?:'
        ]);
        usl.load(definition).should.be.fulfilled.and.notify(done);
      });

      describe('body form parameters', function () {
          it('should succeed when given a "formParameters?" property', function (done) {
            var definition = traitSnippet([
              'body:',
              '  application/x-www-form-urlencoded:',
              '    formParameters?:',
              '      someFormParameter:',
              '        displayName: Some form parameter'
            ]);
            usl.load(definition).should.be.fulfilled.and.notify(done);
          });

          it('should succeed when given a form parameter with a ?', function (done) {
            var definition = traitSnippet([
              'body:',
              '  application/x-www-form-urlencoded:',
              '    formParameters:',
              '      someFormParameter?:',
              '        displayName: Some form parameter'
            ]);
            usl.load(definition).should.be.fulfilled.and.notify(done);
          });

          itShouldBehaveLikeAnOptionalStructureNamedParameter(
            traitSnippet([
              'body:',
              '  application/x-www-form-urlencoded:',
              '    formParameters:',
              '      someFormParameter?:'
            ])
          );
        });
    });
  });

  describe('Parameters', function () {
    it('should allow a parameter as a top-level key', function (done) {
      var definition = traitSnippet([
        '<<some-parameter>>:'
      ]);
      usl.load(definition).should.be.fulfilled.and.notify(done);
    });

    it('should allow a parameter as a key beneath "headers"', function (done) {
      var definition = traitSnippet([
        'headers:',
        '  <<some-parameter>>:'
      ]);
      usl.load(definition).should.be.fulfilled.and.notify(done);
    });

    it('should allow a parameter as a key beneath "headers > some-header"', function (done) {
      var definition = traitSnippet([
        'headers:',
        '  some-header:',
        '    <<some-parameter>>:'
      ]);
      usl.load(definition).should.be.fulfilled.and.notify(done);
    });

    it('should allow a parameter as a key beneath "queryParameters"', function (done) {
      var definition = traitSnippet([
        'queryParameters:',
        '  <<some-parameter>>:'
      ]);
      usl.load(definition).should.be.fulfilled.and.notify(done);
    });

    it('should allow a parameter as a key beneath "queryParameters > some-query-parameter"', function (done) {
      var definition = traitSnippet([
        'queryParameters:',
        '  some-query-parameter:',
        '    <<some-parameter>>:'
      ]);
      usl.load(definition).should.be.fulfilled.and.notify(done);
    });

    it('should allow a parameter as a key beneath "body"', function (done) {
      var definition = traitSnippet([
        'body:',
        '  <<some-parameter>>:'
      ]);
      usl.load(definition).should.be.fulfilled.and.notify(done);
    });
  });
});

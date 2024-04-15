/* global USL, describe, it */

'use strict';

if (typeof window === 'undefined') {
  var usl           = require('../../lib/usl.js');
  var chai           = require('chai');
  var q              = require('q');
  var chaiAsPromised = require('chai-as-promised');

  chai.should();
  chai.use(chaiAsPromised);
} else {
  var usl           = USL.Parser;

  chai.should();
}

describe('Regressions', function () {

  /** to fix
  it('should fail unsupported usl version:RT-180', function (done) {
    var definition = [
      '#%USL 0.1'
    ].join('\n');

    usl.load(definition).should.be.rejectedWith(/Unsupported USL version: \'#%USL 0.1\'/).and.notify(done);
  }); **/

  it('should fail with correct error message on hex values', function (done) {
    var definition = [
      '#%USL 0.1',
      'some_key: "some value \\x0t"'
    ].join('\n');

    usl.load(definition).should.be.rejectedWith(/expected escape sequence of 2 hexadecimal numbers, but found t/).and.notify(done);
  });

  it('should fail with correct error message on hex values', function (done) {
    var definition = [
      '#%USL 0.1',
      'some_key: ? something : something'
    ].join('\n');

    usl.load(definition).should.be.rejectedWith(/mapping keys are not allowed here/).and.notify(done);
  });

  it('should fail with correct error message on hex values', function (done) {
    var definition = [
      '#%USL 0.1',
      'some_key: "',
      '...',
      '---'
    ].join('\n');

    usl.load(definition).should.be.rejectedWith(/found unexpected document separator/).and.notify(done);
  });

  it('should fail if baseUriParameter is not a map', function (done) {
    var definition = [
      '#%USL 0.1',
      'title: Test',
      'baseUri: http://www.api.com/{version}/{company}',
      'version: v1.1',
      '/jobs:',
      '  baseUriParameters:',
      '    company:',
      '      description'
    ].join('\n');

    usl.load(definition).should.be.rejectedWith(/parameter must be a map/).and.notify(done);
  });

  it('should not fail to parse an empty trait', function (done) {
    var definition = [
      '#%USL 0.1',
      'title: MyApi',
      'traits:',
      '  - emptyTrait:',
      '    otherTrait:',
      '      description: Some description',
    ].join('\n');
    usl.load(definition).should.be.rejectedWith(/invalid trait definition, it must be a map/).and.notify(done);
  });

  it('should not fail to parse an empty trait list', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      'title: Test',
      'baseUri: http://www.api.com/{version}/{company}',
      'version: v1.1',
      'traits:'
    ].join('\n');
    usl.load(definition).should.be.rejectedWith(/invalid traits definition, it must be an array/).and.notify(done);
  });

  it('should fail to parse a USL header ', function (done) {
    var noop = function () {};
    var definition = [
      '#%USL 0.1'
    ].join('\n');

    usl.load(definition).then(noop, function (error) {
      setTimeout(function () {
        error.message.should.match(/empty document/);
        done();
      }, 0);
    });
  });

  it('should not fail to parse a USL file only with headers', function (done) {
    var definition = [
      '#%USL 0.1',
      '---'
    ].join('\n');
    usl.load(definition).should.be.rejectedWith(/document must be a map/).and.notify(done);
  });

  it('should not fail to parse a USL null uriParameters. RT-178', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      'title: hola',
      'version: v0.1',
      'baseUri: http://server/api/{version}',
      'baseUriParameters:'
    ].join('\n');
    var expected = {
      title: 'hola',
      version: 'v0.1',
      baseUri: 'http://server/api/{version}',
      baseUriParameters: {
        version: {
          type: 'string',
          required: true,
          displayName: 'version',
          enum: [ 'v0.1' ]
        }
      },
      protocols: [
        'HTTP'
      ]
    };
    usl.load(definition).should.become(expected).and.notify(done);
  });

  it('should fail if baseUriParamters has a version parameter. RT-199', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      'title: hola',
      'version: v0.1',
      'baseUri: http://server/api/{version}',
      'baseUriParameters:',
      ' version:'
    ].join('\n');
    usl.load(definition).should.be.rejectedWith(/version parameter not allowed here/).and.notify(done);
  });

  it('should fail if resource URI is invalid', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      'title: hola',
      'version: v0.1',
      '/resourceName{}:'
    ].join('\n');
    usl.load(definition).should.be.rejectedWith(/Resource name is invalid:/).and.notify(done);
  });

  it('should fail if resource URI is invalid', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      'title: hola',
      'version: v0.1',
      '/resourceName{}:'
    ].join('\n');
    usl.load(definition).should.be.rejectedWith(/Resource name is invalid:/).and.notify(done);
  });

  it('should reject USL with more than one YAML document', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      'title: hola',
      'version: v0.1',
      '---'
    ].join('\n');
    usl.load(definition).should.be.rejectedWith(/expected a single document in the stream but found another document/).and.notify(done);
  });

  it('should inject exception coontext into message when message is null', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      'title: hola',
      'version: v0.1',
      '...',
      'somepropertyName'
    ].join('\n');
    usl.load(definition).should.be.rejectedWith(/expected '<document start>', but found <scalar>/).and.notify(done);
  });

  it('should fail if baseUriParameters is a string - RT-274', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      'title: hola',
      'version: v0.1',
      'baseUri: http://example.com',
      'baseUriParameters:',
      '  someparam'
    ].join('\n');
    usl.load(definition).should.be.rejectedWith(/base uri parameters must be a map/).and.notify(done);
  });

  it('should fail if baseUriParameters is a string - RT-274 - with proper line numbering', function (done) {
    var noop       = function () {};
    var definition = [
      '#%USL 0.1',
      '---',
      'title: hola',
      'version: v0.1',
      'baseUri: http://example.com',
      'baseUriParameters:',
      '  someparam'
    ].join('\n');
    usl.load(definition).then(noop, function (error) {
      setTimeout(function () {
        error.message.should.be.equal('base uri parameters must be a map');
        error.problem_mark.should.exist;
        error.problem_mark.line.should.be.equal(6);
        error.problem_mark.column.should.be.equal(2);
        done();
      }, 0);
    });
  });

  it('should fail if baseUriParameters in a resource is a string - RT-274', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      'title: hola',
      'version: v0.1',
      'baseUri: http://localhost',
      '/resource:',
      '  baseUriParameters:',
      '    someparam'
    ].join('\n');
    usl.load(definition).should.be.rejectedWith(/base uri parameters must be a map/).and.notify(done);
  });

  it('should fail if baseUriParameters in a resource is a string - RT-274', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      'title: hola',
      'version: v0.1',
      'baseUri: http://localhost',
      '/resource:',
      '  uriParameters:',
      '    someparam'
    ].join('\n');
    usl.load(definition).should.be.rejectedWith(/uri parameters must be a map/).and.notify(done);
  });

  it('should report correct line (RT-244)', function (done) {
    var noop       = function () {};
    var definition = [
      '',
      ''
    ].join('\n');

    usl.load(definition).then(noop, function (error) {
      setTimeout(function () {
        error.problem_mark.should.exist;
        error.problem_mark.column.should.be.equal(0);
        error.problem_mark.line.should.be.equal(0);
        done();
      }, 0);
    });
  });

  it('should report correct line for null media type in implicit mode', function (done) {
    var noop       = function () {};
    var definition = [
      '#%USL 0.1',
      '/resource:',
      '  post:',
      '    body:',
      '      schema: someSchema'
    ].join('\n');

    usl.load(definition).then(noop, function (error) {
      setTimeout(function () {
        error.message.should.be.equal('body tries to use default Media Type, but mediaType is null');
        error.problem_mark.should.exist;
        error.problem_mark.column.should.be.equal(4);
        error.problem_mark.line.should.be.equal(3);
        done();
      }, 0);
    });
  });

  it('should report repeated URI\'s in the second uri\'s line - RT-279', function (done) {
    var noop       = function () {};
    var definition = [
      '#%USL 0.1',
      '---',
      'title: "muse:"',
      'baseUri: http://ces.com/muse',
      '/r1/r2:',
      '/r1:',
      '  /r2:'
    ].join('\n');
    usl.load(definition).then(noop, function (error) {
      setTimeout(function () {
        error.message.should.be.equal('two resources share same URI /r1/r2');
        error.problem_mark.should.exist;
        error.problem_mark.column.should.be.equal(2);
        error.problem_mark.line.should.be.equal(6);
        done();
      }, 0);
    });
  });

  it('should allow a trait parameter with an integer value - RT-279', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      'traits:',
      '  - getMethod:',
      '     description: <<description>>',
      'title: title',
      '/test:',
      ' is: [ getMethod: { description: 1 }]'
    ].join('\n');
    usl.load(definition).should.be.fulfilled.and.notify(done);
  });

  it('should allow a resource type parameter with an integer value - RT-279', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      'resourceTypes:',
      '  - someType:',
      '     description: <<description>>',
      'title: title',
      '/test:',
      ' type: { someType: { description: 1 }}'
    ].join('\n');
    usl.load(definition).should.be.fulfilled.and.notify(done);
  });

  it('should apply a resourceType that inherits from another type that uses parameters', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      'title: My API',
      'resourceTypes:',
      '  - base:',
      '      get:',
      '         description: <<description>>',
      '  - collection:',
      '      type: { base: { description: hola } }',
      '      get:',
      '  - typedCollection:',
      '      type: collection',
      '      get:',
      '         description: <<description>>',
      '/presentations:',
      '  type: { typedCollection: { description: description } }'
    ].join('\n');

    var expected = {
      'title': 'My API',
      'resourceTypes': [
        {
          'base': {
            'get': {
              'description': '<<description>>'
            }
          }
        },
        {
          'collection': {
            'type': {
              'base': {
                'description': 'hola'
              }
            },
            'get': null
          }
        },
        {
          'typedCollection': {
            'type': 'collection',
            'get': {
              'description': '<<description>>'
            }
          }
        }
      ],
      'resources': [
        {
          'type': {
            'typedCollection': {
              'description': 'description'
            }
          },
          'relativeUri': '/presentations',
          'methods': [
            {
              'method': 'get',
              'description': 'description'
            }
          ],
          relativeUriPathSegments: [ 'presentations' ]
        }
      ]
    };
    usl.load(definition).should.become(expected).and.notify(done);
  });

  it('should report correct line for resourceType not map error - RT-283', function (done) {
    var noop       = function () {};
    var definition = [
      '#%USL 0.1',
      '---',
      'title: "muse:"',
      'resourceTypes:',
      '  - type1: {}',
      '    type:'
    ].join('\n');
    usl.load(definition).then(noop, function (error) {
      setTimeout(function () {
        error.message.should.be.equal('invalid resourceType definition, it must be a map');
        error.problem_mark.should.exist;
        error.problem_mark.column.should.be.equal(9);
        error.problem_mark.line.should.be.equal(5);
        done();
      }, 0);
    });
  });

  it('should report correct line for resourceType circular reference - RT-257', function (done) {
    var noop       = function () {};
    var definition = [
      '#%USL 0.1',
      '---',
      'title: "muse:"',
      'resourceTypes:',
      '  - rt1:',
      '      type: rt2',
      '  - rt2:',
      '      type: rt1',
      '/resource:',
      '  type: rt1'
    ].join('\n');
    usl.load(definition).then(noop, function (error) {
      setTimeout(function () {
        error.message.should.be.equal('circular reference of "rt1" has been detected: rt1 -> rt2 -> rt1');
        error.problem_mark.should.exist;
        error.problem_mark.column.should.be.equal(4);
        error.problem_mark.line.should.be.equal(6);
        done();
      }, 0);
    });
  });

  it('should apply a trait to a method that has been applied a resource type with a matching null method', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      'title: User Management',
      'traits:',
      '  - paged:',
      '      queryParameters:',
      '        start:',
      'resourceTypes:',
      '  - collection:',
      '      get:',
      '/users:',
      '  type: collection',
      '  get:',
      '    is: [ paged ]'
    ].join('\n');

    var expected = {
      'title': 'User Management',
      'traits': [
        {
          'paged': {
            'queryParameters': {
              'start': {
                'displayName': 'start',
                'type': 'string'
              }
            }
          }
        }
      ],
      'resourceTypes': [
        {
          'collection': {
            'get': null
          }
        }
      ],
      'resources': [
        {
          'type': 'collection',
          'relativeUri': '/users',
          relativeUriPathSegments: [ 'users' ],
          'methods': [
            {
              'queryParameters': {
                'start': {
                  'displayName': 'start',
                  'type': 'string'
                }
              },
              'is': [
                'paged'
              ],
              'method': 'get'
            }
          ]
        }
      ]
    };
    usl.load(definition).should.become(expected).and.notify(done);
  });

  it('should clone references instead of using reference', function (done) {
    var definition = [
      '#%USL 0.1',
      'title: My api',
      'version: v1',
      '/res1: &res1',
      '  description: this is res1 description',
      '  displayName: resource 1',
      '  get:',
      '    description: get into resource 1',
      '/res2: *res1'
    ].join('\n');

    var expected =  {
      "title": "My api",
      "version": "v1",
      "resources": [
        {
          "description": "this is res1 description",
          "displayName": "resource 1",
          "relativeUri": "/res1",
          "methods": [
            {
              "description": "get into resource 1",
              "method": "get"
            }
          ],
          "relativeUriPathSegments": [
            "res1"
          ]
        },
        {
          "description": "this is res1 description",
          "displayName": "resource 1",
          "relativeUri": "/res2",
          "methods": [
            {
              "description": "get into resource 1",
              "method": "get"
            }
          ],
          "relativeUriPathSegments": [
            "res2"
          ]
        }
      ]
    };
    usl.load(definition).should.become(expected).and.notify(done);
  });

  it('should handle a resource and sub-resource named /protocols', function (done) {
    var definition = [
      '#%USL 0.1',
      'title: My api',
      '/protocols:',
      '  /protocols:'
    ].join('\n');
    var expected = {
      title: "My api",
      resources: [
        {
          relativeUri: "/protocols",
          relativeUriPathSegments: [
            "protocols"
          ],
          resources:[
            {
              relativeUri: "/protocols",
              relativeUriPathSegments: [
                "protocols"
              ]
            }
          ]
        }
      ]
    };
    usl.load(definition).should.become(expected).and.notify(done);
  });

  it('should handle a resource and sub-resource named /type.*', function (done) {
    var definition = [
      '#%USL 0.1',
      'title: My api',
      'resourceTypes:',
      '    - ref: {}',
      '/type_:',
      '  /type_someword:',
      '    get:'
    ].join('\n');
    var expected = {
      title: "My api",
      resourceTypes: [
          {
              ref: {}
          }
      ],
      resources: [
        {
          relativeUri: "/type_",
          resources:[
            {
              relativeUri: "/type_someword",
              methods:[
                {
                  method: "get"
                }
              ],
              relativeUriPathSegments: [
                "type_someword"
              ]
            }
          ],
          relativeUriPathSegments: [
            "type_"
          ]
        }
      ]
    };
    usl.load(definition).should.become(expected).and.notify(done);
  });

  it('should not download a null named file. RT-259', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      'title: !include'
    ].join('\n');

    usl.load(definition).should.be.rejectedWith(/file name\/URL cannot be null/).and.notify(done);
  });

  it('should not download a file named with blanks. RT-259', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      'title: !include             '
    ].join('\n');

    usl.load(definition).should.be.rejectedWith(/file name\/URL cannot be null/).and.notify(done);
  });

  it('should not fail with null responses', function (done) {
    var definition = [
      '#%USL 0.1',
      'title: GitHub API',
      '/res:',
      '  get:',
      '    responses:'
    ].join('\n');
    usl.load(definition).should.be.fulfilled.and.notify(done);
  });

  it('add a regression test for a complex USL file', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      '!include http://localhost:9001/test/usl-files/regression.yml'
    ].join('\n');

    usl.load(definition).should.be.fulfilled.and.notify(done);
  });

  it('add a regression test for a big USL file', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      '!include http://localhost:9001/test/usl-files/large-usl.yml'
    ].join('\n');

    usl.load(definition).should.be.fulfilled.and.notify(done);
  });

  it('add a regression test that composeFile does not fail', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      '!include http://localhost:9001/test/usl-files/large-usl.yml'
    ].join('\n');

    usl.load(definition).should.be.fulfilled.and.notify(done);
  });

  it('should handle optional parameters onto optional parameters merge correctly', function (done){
    var definition = [
      '#%USL 0.1',
      'title: Title',
      'resourceTypes:',
      '  - common:',
      '      get?:',
      '  - base:',
      '      type: common',
      '      get?:',
      '/files:',
      '  type: base',
      '  post:'
    ].join('\n');
    var expected = {
      "title":"Title",
      "resourceTypes":[
        {
          "common": {
            "get?":null
          }
        },
        {
          "base": {
            "type":"common",
            "get?":null
          }
        }
      ],
      "resources": [
       {
        "type":"base",
        "relativeUri":"/files",
        "methods": [
          {
            "method":"post"
          }
        ],
        "relativeUriPathSegments": ["files"]
      }
      ]
    };

    usl.load(definition).should.become(expected).and.notify(done);
  });

  it('should handle optional parameters onto optional parameters merge correctly', function (done){
    var definition = [
      '#%USL 0.1',
      'title: Title',
      'resourceTypes:',
      '  - common: {}',
      '  - base:',
      '      type: common',
      '      get?:',
      '/files:',
      '  type: base',
      '  post:'
    ].join('\n');
    var expected = {
      "title":"Title",
      "resourceTypes":[
        {
          "common": {}
        },
        {
          "base": {
            "type":"common",
            "get?":null
          }
        }
      ],
      "resources": [
       {
        "type":"base",
        "relativeUri":"/files",
        "methods": [
          {
            "method":"post"
          }
        ],
        "relativeUriPathSegments": ["files"]
      }
      ]
    };

    usl.load(definition).should.become(expected).and.notify(done);
  });

  it('should handle optional parameters onto optional parameters merge correctly', function (done){
    var definition = [
      '#%USL 0.1',
      'title: Title',
      'resourceTypes:',
      '  - common:',
      '      get?:',
      '  - base:',
      '      type: common',
      '/files:',
      '  type: base',
      '  post:'
    ].join('\n');
    var expected = {
      "title":"Title",
      "resourceTypes":[
        {
          "common": {
            "get?":null
          }
        },
        {
          "base": {
            "type":"common"
          }
        }
      ],
      "resources": [
       {
        "type":"base",
        "relativeUri":"/files",
        "methods": [
          {
            "method":"post"
          }
        ],
        "relativeUriPathSegments": ["files"]
      }
      ]
    };

    usl.load(definition).should.become(expected).and.notify(done);
  });

  it('should parse multiple parameters in the same line', function (done){
    var definition = [
      '#%USL 0.1',
      'title: Example',
      'resourceTypes:',
      '  - readOnlyCollectionItem:',
      '      description: Retrieve <<resourcePathName|!singularize>> where <<key>> equals **{<<key>>}**',
      '/{widgetName}:',
      '  type:',
      '    readOnlyCollectionItem:',
      '      key: widgetName'
    ].join('\n');
    var expected = {
         "title": "Example",
         "resourceTypes": [
           {
             "readOnlyCollectionItem": {
               "description": "Retrieve <<resourcePathName|!singularize>> where <<key>> equals **{<<key>>}**"
             }
           }
         ],
         "resources": [
           {
             "description": "Retrieve  where widgetName equals **{widgetName}**",
             "type": {
               "readOnlyCollectionItem": {
                 "key": "widgetName"
               }
             },
             "relativeUri": "/{widgetName}",
             "relativeUriPathSegments": [
               "{widgetName}"
             ],
             "uriParameters": {
               "widgetName": {
                 "type": "string",
                 "required": true,
                 "displayName": "widgetName"
               }
             }
           }
         ]
      };

    usl.load(definition).should.become(expected).and.notify(done);
  });

  it('should singularize words properly', function(done) {
    var definition = [
      '#%USL 0.1',
      '---',
      'title: Example',
      'mediaType: application/json',
      'resourceTypes:',
      '  - collection:',
      '      get:',
      '        responses:',
      '          200:',
      '            body:',
      '              schema: <<resourcePathName | !singularize>>',
      '/waves:',
      '  type: collection'
    ].join('\n');

    var expected = {
      title: 'Example',
      mediaType: 'application/json',
      resourceTypes: [
        {
          collection: {
            get: {
              responses: {
                200: {
                  body: {
                    schema: '<<resourcePathName | !singularize>>'
                  }
                }
              }
            }
          }
        }
      ],
      resources: [
        {
          type: 'collection',
          relativeUri: '/waves',
          methods: [
            {
              responses: {
                200: {
                  body: {
                    'application/json': {
                      schema: 'wave'
                    }
                  }
                }
              },
              method: 'get'
            }
          ],
          relativeUriPathSegments: [
            'waves'
          ]
        }
      ]
    };

    usl.load(definition).should.eventually.deep.equal(expected).and.notify(done);
  });

  it('should resolve keys in the correct order', function (done) {
    var definition = [
      '#%USL 0.1',
      '---',
      'title: Example',
      '/foo: !include foo.usl',
      '/bar: !include bar.usl',
      '/qux: !include qux.usl'
    ].join('\n');

    var ROOT_FILE = 'root.usl';

    var reader = new usl.FileReader(function (path) {
      if (path === ROOT_FILE) {
        return q(definition);
      }

      var deferred = q.defer();

      // Resolve randomly.
      setTimeout(function () {
        deferred.resolve('get:\n');
      }, Math.random() * 100);

      return deferred.promise;
    });

    return usl.loadFile(ROOT_FILE, { reader: reader })
      .then(function (result) {
        result.resources.map(function (resource) {
          return resource.relativeUri;
        }).should.deep.equal(['/foo', '/bar', '/qux']);
      })
      .should.notify(done);
  });

  it('should resolve nested includes in the correct order', function (done) {
    var files = {
      'root.usl': [
        '#%USL 0.1',
        '---',
        'title: Example',
        '/users: !include users.usl',
        '/articles: !include articles.usl'
      ].join('\n'),
      'users.usl': [
        'get: !include users-get.usl',
        'post: !include users-post.usl',
        '/{userId}: !include user.usl'
      ].join('\n'),
      'users-get.usl': [
        'responses:',
        '  200:'
      ].join('\n'),
      'users-post.usl': [
        'responses:',
        '  200:'
      ].join('\n'),
      'user.usl': [
        '/articles: !include user-articles.usl',
        '/comments: !include user-comments.usl'
      ].join('\n'),
      'user-articles.usl': [
        'get:'
      ].join('\n'),
      'user-comments.usl': [
        'get:'
      ].join('\n'),
      'articles.usl': [
        'get:'
      ].join('\n')
    };

    var reader = new usl.FileReader(function (path) {
      var deferred = q.defer();

      // Resolve randomly.
      setTimeout(function () {
        deferred.resolve(files[path]);
      }, Math.random() * 100);

      return deferred.promise;
    });

    function getResouces (resource) {
      return resource.resources.map(function (resource) {
        return resource.relativeUri;
      });
    }

    function getMethods (resource) {
      return resource.methods ? resource.methods.map(function (method) {
        return method.method;
      }) : [];
    }

    return usl.loadFile('root.usl', { reader: reader })
      .then(function (result) {
        getResouces(result).should.deep.equal(['/users', '/articles'])
        getResouces(result.resources[0]).should.deep.equal(['/{userId}'])
        getResouces(result.resources[0].resources[0]).should.deep.equal(['/articles', '/comments'])

        getMethods(result).should.deep.equal([])
        getMethods(result.resources[0]).should.deep.equal(['get', 'post'])
        getMethods(result.resources[0].resources[0]).should.deep.equal([])

      })
      .should.notify(done);
  });

  it('should accept description in responses', function (done) {
    var definition = [
      '#%USL 0.1',
      'title: Title',
      '/example:',
      '  get:',
      '    responses:',
      '      200:',
      '        body:',
      '          "*/*":',
      '            description: |',
      '              This is an example.'
    ].join('\n');

    var expected = {
      title: 'Title',
      resources: [
        {
          relativeUri: '/example',
          methods: [
            {
              method: 'get',
              responses: {
                '200': {
                  body: {
                    '*/*': {
                      description: 'This is an example.'
                    }
                  }
                }
              }
            }
          ],
          relativeUriPathSegments: ['example']
        }
      ]
    };

    usl.load(definition).should.become(expected).and.notify(done);
  });

  it('should json parse unicode encoding', function (done) {
    var definition = [
      '#%USL 0.1',
      'title: Title',
      '/:',
      '  post:',
      '    body:',
      '      application/json:',
      '        schema: |',
      '          {',
      '            "type": "string",',
      '            "pattern": "^[A-Z\u017D\\u017E]*$"',
      '          }'
    ].join('\n');

    var expected = {
      title: 'Title',
      resources: [
        {
          relativeUri: '/',
          methods: [
            {
              body: {
                'application/json': {
                  schema: '{\n  \"type\": \"string\",\n  \"pattern\": \"^[A-ZŽ\\u017E]*$\"\n}'
                }
              },
              method: 'post'
            }
          ],
          relativeUriPathSegments: []
        }
      ]
    };


    usl.load(definition).should.become(expected).and.notify(done);
  })
});

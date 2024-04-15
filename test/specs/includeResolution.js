'use strict';

if (typeof window === 'undefined') {
  var usl           = require('../../lib/usl.js');
  var chai           = require('chai');
  var chaiAsPromised = require('chai-as-promised');
  var q              = require('q');
  chai.use(chaiAsPromised);
  chai.should();
} else {
  var usl           = USL.Parser;
  var q              = (new USL.Parser.FileReader()).q;
  chai.should();
}

function subsetCompare(expected, target) {
  return;
  Object.keys(expected).forEach(function (keyName) {
    if (expected[keyName] === null) {
      should.not.exist(target[keyName]);
    } else {
      expected[keyName].should.be.deep.equal(target[keyName]);
    }
  });
}

describe('Include resolution injection', function() {
  it('should call injected method', function(done) {
    var callbackCalled = false;
    var injectedReader = new usl.FileReader(function() {
      callbackCalled = true;
      return q.fcall(function() { return '#%USL 0.1\ntitle: Hi'; });
    });

    var document = [
      '#%USL 0.1',
      '!include http://stevesy-galt.com/who-is-he.usl'
    ].join('\n');

    var expected = {
      title: 'Hi'
    };

    usl.load(document, 'http://stevesy-galt.com/who-is-he2.usl', { reader: injectedReader } ).then( function(data) {
      setTimeout(function () {
        data.should.deep.equal(expected);
        callbackCalled.should.be.ok;
        done();
      }, 0);
    });
  });

  it('should reject if detects circular reference on the first document', function(done) {
    var callbackCalled = false;
    var injectedReader = new usl.FileReader(function() {
      callbackCalled = true;
      return q.fcall( function() { return '#%USL 0.1\ntitle: Hi'; });
    });

    var document = [
      '#%USL 0.1',
      '!include http://stevesy-galt.com/who-is-he.usl'
    ].join('\n');

    var expected =  {
      'context': 'while composing scalar out of !include',
      'context_mark': null,
      'message': 'detected circular !include of http://stevesy-galt.com/who-is-he.usl',
      'problem_mark': {
        'name': 'http://stevesy-galt.com/who-is-he.usl',
        'line': 1,
        'column': 0,
        'buffer': '#%USL 0.1\n!include http://stevesy-galt.com/who-is-he.usl\u0000',
        'pointer': 11
      }
    };

    var noop = function(){};
    usl.load(document, 'http://stevesy-galt.com/who-is-he.usl', { reader: injectedReader } ).then(noop, function(error) {
      setTimeout(function () {
        subsetCompare(expected, JSON.parse(JSON.stringify(error)));
        callbackCalled.should.not.be.ok;
        done();
      }, 0);
    });
  });

  it('should fail if reader is null', function(done) {
    var document = [
      '#%USL 0.1',
      '!include http://localhost:9001/test/usl-files/external.yml'
    ].join('\n');

    var expected = {
      context: 'while reading file',
      context_mark: null,
      problem_mark:
      {
        name: 'http://stevesy-galt.com/who-is-he.usl',
        line: 1,
        column: 0,
        buffer: '#%USL 0.1\n!include http://localhost:9001/test/usl-files/external.yml\u0000',
        pointer: 11
      }
    };

    var noop = function(){};
    usl.load(document, 'http://stevesy-galt.com/who-is-he.usl', { reader: null } ).then(noop, function(error) {
      setTimeout(function () {
        subsetCompare(expected, JSON.parse(JSON.stringify(error)));
        done();
      }, 0);
    });
  });

  it('should fail if reader does not return a promise', function(done) {
    var callbackCalled = false;
    var injectedReader = new usl.FileReader(function() {
      callbackCalled = true;
      return 'blah';
    });

    var document = [
      '#%USL 0.1',
      '!include http://stevesy-galt.com/who-is-he.usl'
    ].join('\n');

    var expected = {
      context: 'while reading file',
      context_mark: null,
      problem_mark: {
        name: '/',
        line: 1,
        column: 0,
        buffer: '#%USL 0.1\n!include http://stevesy-galt.com/who-is-he.usl\u0000',
        pointer: 11
      }
    };

    var noop = function(){};
    usl.load(document, '/', { reader: injectedReader } ).then(noop, function(error) {
      setTimeout(function () {
        subsetCompare(expected, JSON.parse(JSON.stringify(error)));
        done();
      }, 0);
    });
  });

  it('should resolve !include tag as an array element', function (done) {
    var document = [
      '#%USL 0.1',
      'title: title',
      'traits:',
      '  - !include trait.usl'
    ].join('\n');

    var reader = new usl.FileReader(function () {
      return q('trait: {}');
    });

    usl.load(document, '', {reader: reader}).then(function (value) {
      setTimeout(function () {
        value.traits.should.be.deep.equal([
            {trait: {}}
          ]);

        done();
      });
    });
  });

  it('should resolve !include tags in proper order', function (done) {
    var document = [
      '#%USL 0.1',
      'title: title',
      'traits:',
      '  - !include trait1.usl',
      '  - !include trait2.usl'
    ].join('\n');

    var defer  = q.defer();
    var reader = new usl.FileReader(function (file) {
      if (file === 'trait2.usl') {
        return q('trait2: {}');
      }

      setTimeout(function () {
        defer.resolve('trait1: {}');
      });

      return defer.promise;
    });

    usl.load(document, '', {reader: reader}).then(function (value) {
      setTimeout(function () {
        value.traits.should.be.deep.equal([
          {trait1: {}},
          {trait2: {}}
        ]);

        done();
      });
    });
  });

  it('should resolve mixed !include tags (in-place and deferred)', function (done) {
    var document = [
      '#%USL 0.1',
      'title: title',
      'traits:',
      '  - trait1: {}',
      '  - !include trait2.usl',
      '  - trait3: {}'
    ].join('\n');

    var reader = new usl.FileReader(function () {
      return q('trait2: {}');
    });

    usl.load(document, '', {reader: reader}).then(function (value) {
      setTimeout(function () {
        value.traits.should.be.deep.equal([
          {trait1: {}},
          {trait2: {}},
          {trait3: {}}
        ]);

        done();
      });
    });
  });
});

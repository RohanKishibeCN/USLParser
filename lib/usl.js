(function() {
  var defaultSettings, nodes, path, refParser, util, _ref,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  this.errors = require('./errors');

  this.loader = require('./loader');

  nodes = require('./nodes');

  path = require('path');

  refParser = require('json-schema-ref-parser');

  util = require('./util');

  this.FileError = (function(_super) {
    __extends(FileError, _super);

    function FileError() {
      _ref = FileError.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    return FileError;

  })(this.errors.MarkedYAMLError);

  this.FileReader = (function() {
    function FileReader(readFileAsyncOverride) {
      this.q = require('q');
      this.url = require('url');
      if (readFileAsyncOverride) {
        this.readFileAsyncOverride = readFileAsyncOverride;
      }
    }

    /*
    Read file either locally or from the network.
    */


    FileReader.prototype.readFileAsync = function(file) {
      if (this.readFileAsyncOverride) {
        return this.readFileAsyncOverride(file);
      }
      if (/^https?/i.test(file) || (typeof window !== "undefined" && window !== null)) {
        return this.fetchFileAsync(file);
      }
      return this.fetchLocalFileAsync(file);
    };

    /*
    Read file from the disk.
    */


    FileReader.prototype.fetchLocalFileAsync = function(file) {
      var deferred,
        _this = this;
      deferred = this.q.defer();
      require('fs').readFile(file, function(err, data) {
        if (err) {
          return deferred.reject(new exports.FileError("while reading " + file, null, "cannot read " + file + " (" + err + ")", _this.start_mark));
        } else {
          return deferred.resolve(data.toString());
        }
      });
      return deferred.promise;
    };

    /*
    Read file from the network.
    */


    FileReader.prototype.fetchFileAsync = function(file) {
      if (typeof window !== "undefined" && window !== null) {
        return this.fetchFileAsyncBrowser(file);
      }
      return this.fetchFileAsyncNode(file);
    };

    FileReader.prototype.fetchFileAsyncNode = function(file) {
      var deferred;
      deferred = this.q.defer();
      require('got').get(file, {
        headers: {
          'Accept': 'application/usl+yaml, */*'
        }
      }, function(err, data, res) {
        if (err) {
          return deferred.reject(new exports.FileError("while fetching " + file, null, "cannot fetch " + file + " (" + err.message + ")", this.start_mark));
        }
        if (res.statusCode === 200 || res.statusCode === 304) {
          return deferred.resolve(data);
        }
        return deferred.reject(new exports.FileError("while fetching " + file, null, "cannot fetch " + file + " (" + res.statusCode + ")", this.start_mark));
      });
      return deferred.promise;
    };

    FileReader.prototype.fetchFileAsyncBrowser = function(file) {
      var deferred, error, xhr,
        _this = this;
      deferred = this.q.defer();
      xhr = new XMLHttpRequest();
      try {
        xhr.open('GET', file);
      } catch (_error) {
        error = _error;
        throw new exports.FileError("while fetching " + file, null, "cannot fetch " + file + " (" + error + "), check that the server is up and that CORS is enabled", this.start_mark);
      }
      xhr.setRequestHeader('Accept', 'application/usl+yaml, */*');
      xhr.onreadystatechange = function() {
        if (xhr.readyState === 4) {
          if (xhr.status === 200 || xhr.status === 304) {
            return deferred.resolve(xhr.responseText);
          } else {
            return deferred.reject(new exports.FileError("while fetching " + file, null, "cannot fetch " + file + " (" + xhr.status + ")", _this.start_mark));
          }
        }
      };
      xhr.send();
      return deferred.promise;
    };

    return FileReader;

  })();

  /*
  OO version of the parser, static functions will be removed after consumers move on to use the OO version
  OO will offer caching
  */


  this.UslParser = (function() {
    function UslParser(settings) {
      this.settings = settings != null ? settings : defaultSettings;
      this.dereferenceSchema = __bind(this.dereferenceSchema, this);
      this.dereferenceSchemas = __bind(this.dereferenceSchemas, this);
      this.q = require('q');
      this.url = require('url');
      this.nodes = require('./nodes');
      this.loadDefaultSettings(this.settings);
    }

    UslParser.prototype.loadDefaultSettings = function(settings) {
      return Object.keys(defaultSettings).forEach(function(settingName) {
        if (!(settingName in settings)) {
          return settings[settingName] = defaultSettings[settingName];
        }
      });
    };

    UslParser.prototype.loadFile = function(file, settings) {
      var error,
        _this = this;
      if (settings == null) {
        settings = this.settings;
      }
      try {
        return settings.reader.readFileAsync(file).then(function(stream) {
          return _this.load(stream, file, settings);
        });
      } catch (_error) {
        error = _error;
        return this.q.fcall(function() {
          throw new exports.FileError("while fetching " + file, null, "cannot fetch " + file + " (" + error + ")", null);
        });
      }
    };

    UslParser.prototype.composeFile = function(file, settings, parent) {
      var error,
        _this = this;
      if (settings == null) {
        settings = this.settings;
      }
      try {
        return settings.reader.readFileAsync(file).then(function(stream) {
          return _this.compose(stream, file, settings, parent);
        });
      } catch (_error) {
        error = _error;
        return this.q.fcall(function() {
          throw new exports.FileError("while fetching " + file, null, "cannot fetch " + file + " (" + error + ")", null);
        });
      }
    };

    UslParser.prototype.compose = function(stream, location, settings, parent) {
      if (settings == null) {
        settings = this.settings;
      }
      if (parent == null) {
        parent = {
          src: location
        };
      }
      settings.compose = false;
      return this.parseStream(stream, location, settings, parent);
    };

    UslParser.prototype.load = function(stream, location, settings) {
      if (settings == null) {
        settings = this.settings;
      }
      settings.compose = true;
      return this.parseStream(stream, location, settings, {
        src: location
      });
    };

    UslParser.prototype.parseStream = function(stream, location, settings, parent) {
      var loader,
        _this = this;
      if (settings == null) {
        settings = this.settings;
      }
      loader = new exports.loader.Loader(stream, location, settings, parent);
      return this.q.fcall(function() {
        return loader.getYamlRoot();
      }).then(function(partialTree) {
        var files;
        files = loader.getPendingFilesList();
        return _this.getPendingFiles(loader, partialTree, files);
      }).then(function(fullyAssembledTree) {
        if (settings.compose && settings.dereferenceSchemas) {
          return _this.dereferenceSchemas(loader, fullyAssembledTree, settings.dereferenceSchemas.maxDepth);
        } else {
          return fullyAssembledTree;
        }
      }).then(function(fullyAssembledTree) {
        loader.composeUslTree(fullyAssembledTree, settings);
        if (settings.compose) {
          if (fullyAssembledTree != null) {
            return loader.construct_document(fullyAssembledTree);
          } else {
            return null;
          }
        } else {
          return fullyAssembledTree;
        }
      });
    };

    UslParser.prototype.dereferenceSchemas = function(loader, node, maxDepth) {
      var collectNodes, definedSchemaNames, resolveSchemas, schemaNodes,
        _this = this;
      if (maxDepth == null) {
        maxDepth = 500;
      }
      schemaNodes = [];
      definedSchemaNames = [];
      node.value.forEach(function(_arg) {
        var childBody, childName;
        childName = _arg[0], childBody = _arg[1];
        if (childName.value === 'schemas' && childBody instanceof nodes.SequenceNode) {
          return childBody.value.forEach(function(mappingNode) {
            return mappingNode.value.forEach(function(_arg1) {
              var schemaBody, schemaName;
              schemaName = _arg1[0], schemaBody = _arg1[1];
              definedSchemaNames.push(schemaName.value);
              return schemaNodes.push(schemaBody);
            });
          });
        }
      });
      collectNodes = (function(node) {
        var items;
        items = [];
        if (node instanceof nodes.MappingNode) {
          return node.value.forEach(function(_arg) {
            var item, kind;
            kind = _arg[0], item = _arg[1];
            if (item instanceof nodes.FileNode) {
              return schemaNodes.push(item);
            } else if (item instanceof nodes.ScalarNode) {
              if (kind.value === 'schema' && definedSchemaNames.indexOf(item.value) === -1) {
                return schemaNodes.push(item);
              }
            } else {
              return collectNodes(item);
            }
          });
        } else if (node instanceof nodes.SequenceNode) {
          return node.value.map(collectNodes);
        }
      });
      collectNodes(node);
      resolveSchemas = schemaNodes.map(function(schemaNode) {
        var schema, uri;
        if (schemaNode instanceof nodes.FileNode) {
          uri = schemaNode.inclusionPath;
          schema = void 0;
        } else {
          uri = loader.src;
          schema = JSON.parse(schemaNode.value);
        }
        return _this.dereferenceSchema(uri, schema, maxDepth);
      });
      return this.q.all(resolveSchemas).then(function(dereferedSchemas) {
        dereferedSchemas.forEach(function(dereferedSchema, index) {
          return schemaNodes[index].value = dereferedSchema;
        });
        return node;
      });
    };

    UslParser.prototype.dereferenceSchema = function(uri, schema, maxDepth) {
      var deferred;
      deferred = this.q.defer();
      refParser.dereference(uri, schema, {}).then(function(dereferencedSchema) {
        return deferred.resolve(util.stringifyJSONCircularDepth(dereferencedSchema, maxDepth));
      })["catch"](function(err) {
        return deferred.reject(err);
      });
      return deferred.promise;
    };

    UslParser.prototype.getPendingFiles = function(loader, node, files) {
      var loadFiles,
        _this = this;
      if (!files.length) {
        return node;
      }
      loadFiles = files.map(function(fileInfo) {
        return _this.getPendingFile(loader, fileInfo);
      });
      return this.q.all(loadFiles).then(function(results) {
        var lastVisitedNode;
        lastVisitedNode = void 0;
        results.forEach(function(result, index) {
          var overwritingnode;
          overwritingnode = _this.mergePendingFile(files[index], result);
          if (overwritingnode && !lastVisitedNode) {
            return lastVisitedNode = overwritingnode;
          }
        });
        if (lastVisitedNode) {
          return lastVisitedNode;
        } else {
          return node;
        }
      });
    };

    UslParser.prototype.getPendingFile = function(loader, fileInfo) {
      var event, fileUri,
        _this = this;
      event = fileInfo.event;
      fileUri = fileInfo.targetFileUri;
      if (loader.parent && this.isInIncludeTagsStack(fileUri, loader)) {
        return this.q.reject(new exports.FileError('while composing scalar out of !include', null, "detected circular !include of " + event.value, event.start_mark));
      }
      return this.settings.reader.readFileAsync(fileUri).then(function(fileData) {
        if (fileInfo.type === 'fragment') {
          return _this.compose(fileData, fileInfo.targetFileUri, {
            validate: false,
            transform: false,
            compose: true
          }, loader);
        } else {
          return new _this.nodes.FileNode('tag:yaml.org,2002:str', fileData, event.start_mark, event.end_mark, event.style, fileInfo.targetFileUri);
        }
      })["catch"](function(error) {
        return _this.addContextToError(error, event);
      });
    };

    UslParser.prototype.mergePendingFile = function(fileInfo, value) {
      var key, node;
      node = fileInfo.parentNode;
      key = fileInfo.parentKey;
      return this.appendNewNodeToParent(node, key, value);
    };

    UslParser.prototype.addContextToError = function(error, event) {
      if (error.constructor.name === "FileError") {
        if (!error.problem_mark) {
          error.problem_mark = event.start_mark;
        }
        throw error;
      } else {
        throw new exports.FileError('while reading file', null, error, event.start_mark);
      }
    };

    UslParser.prototype.isInIncludeTagsStack = function(include, parent) {
      while (parent = parent.parent) {
        if (parent.src === include) {
          return true;
        }
      }
      return false;
    };

    UslParser.prototype.appendNewNodeToParent = function(node, key, value) {
      if (node) {
        if (util.isSequence(node)) {
          node.value[key] = value;
        } else {
          node.value.push([key, value]);
        }
        return null;
      } else {
        return value;
      }
    };

    return UslParser;

  })();

  /*
    validate controls whether the stream must be processed as a
  */


  defaultSettings = {
    validate: true,
    transform: true,
    compose: true,
    reader: new exports.FileReader(null),
    applySchemas: true,
    dereferenceSchemas: false
  };

  /*
  Parse the first USL document in a stream and produce the corresponding
  Javascript object.
  */


  this.loadFile = function(file, settings) {
    var parser;
    if (settings == null) {
      settings = defaultSettings;
    }
    parser = new exports.UslParser(settings);
    return parser.loadFile(file, settings);
  };

  /*
  Parse the first USL document in a file and produce the corresponding
  representation tree.
  */


  this.composeFile = function(file, settings, parent) {
    var parser;
    if (settings == null) {
      settings = defaultSettings;
    }
    if (parent == null) {
      parent = file;
    }
    parser = new exports.UslParser(settings);
    return parser.composeFile(file, settings, parent);
  };

  /*
  Parse the first USL document in a stream and produce the corresponding
  representation tree.
  */


  this.compose = function(stream, location, settings, parent) {
    var parser;
    if (settings == null) {
      settings = defaultSettings;
    }
    if (parent == null) {
      parent = location;
    }
    parser = new exports.UslParser(settings);
    return parser.compose(stream, location, settings, parent);
  };

  /*
  Parse the first USL document in a stream and produce the corresponding
  Javascript object.
  */


  this.load = function(stream, location, settings) {
    var parser;
    if (settings == null) {
      settings = defaultSettings;
    }
    parser = new exports.UslParser(settings);
    return parser.load(stream, location, settings, null);
  };

}).call(this);

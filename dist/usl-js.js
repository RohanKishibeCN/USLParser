(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.USL || (g.USL = {})).Parser = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function() {
  var MarkedYAMLError, events, nodes, url, usl, util, _ref,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  events = require('./events');

  MarkedYAMLError = require('./errors').MarkedYAMLError;

  nodes = require('./nodes');

  usl = require('./usl');

  util = require('./util');

  url = require('url');

  this.ComposerError = (function(_super) {
    __extends(ComposerError, _super);

    function ComposerError() {
      _ref = ComposerError.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    return ComposerError;

  })(MarkedYAMLError);

  this.Composer = (function() {
    function Composer() {
      this.composeUslTree = __bind(this.composeUslTree, this);
      this.anchors = {};
      this.filesToRead = [];
    }

    Composer.prototype.check_node = function() {
      if (this.check_event(events.StreamStartEvent)) {
        this.get_event();
      }
      return !this.check_event(events.StreamEndEvent);
    };

    /*
    Get the root node of the next document.
    */


    Composer.prototype.get_node = function() {
      if (!this.check_event(events.StreamEndEvent)) {
        return this.compose_document();
      }
    };

    Composer.prototype.getYamlRoot = function() {
      var document, event;
      this.get_event();
      document = null;
      if (!this.check_event(events.StreamEndEvent)) {
        document = this.compose_document();
      }
      if (!this.check_event(events.StreamEndEvent)) {
        event = this.get_event();
        throw new exports.ComposerError('document scan', document.start_mark, 'expected a single document in the stream but found another document', event.start_mark);
      }
      this.get_event();
      return document;
    };

    Composer.prototype.composeUslTree = function(node, settings) {
      if (settings.validate || settings.transform) {
        this.load_schemas(node);
        this.load_traits(node);
        this.load_types(node);
        this.load_security_schemes(node);
      }
      if (settings.validate) {
        this.validate_document(node);
      }
      if (settings.transform) {
        this.apply_types(node);
        this.apply_traits(node);
        if (settings.applySchemas) {
          this.apply_schemas(node);
        }
        this.apply_protocols(node);
        this.join_resources(node);
      }
      return node;
    };

    Composer.prototype.compose_document = function() {
      var node;
      this.get_event();
      node = this.compose_node();
      this.get_event();
      this.anchors = {};
      return node;
    };

    Composer.prototype.getPendingFilesList = function() {
      return this.filesToRead;
    };

    Composer.prototype.compose_node = function(parent, index) {
      var anchor, event, node;
      if (this.check_event(events.AliasEvent)) {
        event = this.get_event();
        anchor = event.anchor;
        if (!(anchor in this.anchors)) {
          throw new exports.ComposerError(null, null, "found undefined alias " + anchor, event.start_mark);
        }
        return this.anchors[anchor].clone();
      }
      event = this.peek_event();
      anchor = event.anchor;
      if (anchor !== null && anchor in this.anchors) {
        throw new exports.ComposerError("found duplicate anchor " + anchor + "; first occurence", this.anchors[anchor].start_mark, 'second occurrence', event.start_mark);
      }
      this.descend_resolver(parent, index);
      if (this.check_event(events.ScalarEvent)) {
        node = this.compose_scalar_node(anchor, parent, index);
      } else if (this.check_event(events.SequenceStartEvent)) {
        node = this.compose_sequence_node(anchor);
      } else if (this.check_event(events.MappingStartEvent)) {
        node = this.compose_mapping_node(anchor);
      }
      this.ascend_resolver();
      return node;
    };

    Composer.prototype.compose_fixed_scalar_node = function(anchor, value) {
      var event, node;
      event = this.get_event();
      node = new nodes.ScalarNode('tag:yaml.org,2002:str', value, event.start_mark, event.end_mark, event.style);
      if (anchor !== null) {
        this.anchors[anchor] = node;
      }
      return node;
    };

    Composer.prototype.compose_scalar_node = function(anchor, parent, key) {
      var event, extension, fileType, node, tag;
      event = this.get_event();
      tag = event.tag;
      node = {};
      if (tag === null || tag === '!') {
        tag = this.resolve(nodes.ScalarNode, event.value, event.implicit);
      }
      if (event.tag === '!include') {
        if (event.value.match(/^\s*$/)) {
          throw new exports.ComposerError('while composing scalar out of !include', null, "file name/URL cannot be null", event.start_mark);
        }
        extension = event.value.split('.').pop();
        if (extension === 'yaml' || extension === 'yml' || extension === 'usl') {
          fileType = 'fragment';
        } else {
          fileType = 'scalar';
        }
        this.filesToRead.push({
          type: fileType,
          parentNode: parent,
          parentKey: key,
          event: event,
          includingContext: this.src,
          targetFileUri: this.src ? url.resolve(this.src, event.value) : event.value
        });
        node = void 0;
      } else {
        node = new nodes.ScalarNode(tag, event.value, event.start_mark, event.end_mark, event.style);
      }
      if (anchor && node) {
        this.anchors[anchor] = node;
      }
      return node;
    };

    Composer.prototype.compose_sequence_node = function(anchor) {
      var end_event, index, node, start_event, tag, value;
      start_event = this.get_event();
      tag = start_event.tag;
      if (tag === null || tag === '!') {
        tag = this.resolve(nodes.SequenceNode, null, start_event.implicit);
      }
      node = new nodes.SequenceNode(tag, [], start_event.start_mark, null, start_event.flow_style);
      index = 0;
      if (anchor) {
        this.anchors[anchor] = node;
      }
      while (!this.check_event(events.SequenceEndEvent)) {
        if (value = this.compose_node(node, index)) {
          node.value[index] = value;
        }
        index++;
      }
      end_event = this.get_event();
      node.end_mark = end_event.end_mark;
      return node;
    };

    Composer.prototype.compose_mapping_node = function(anchor) {
      var end_event, item_key, item_value, node, start_event, tag;
      start_event = this.get_event();
      tag = start_event.tag;
      if (tag === null || tag === '!') {
        tag = this.resolve(nodes.MappingNode, null, start_event.implicit);
      }
      node = new nodes.MappingNode(tag, [], start_event.start_mark, null, start_event.flow_style);
      if (anchor !== null) {
        this.anchors[anchor] = node;
      }
      while (!this.check_event(events.MappingEndEvent)) {
        item_key = this.compose_node(node);
        if (!util.isScalar(item_key)) {
          throw new exports.ComposerError('while composing mapping key', null, "only scalar map keys are allowed in USL", item_key.start_mark);
        }
        if (item_value = this.compose_node(node, item_key)) {
          node.value.push([item_key, item_value]);
        }
      }
      end_event = this.get_event();
      node.end_mark = end_event.end_mark;
      return node;
    };

    return Composer;

  })();

}).call(this);

},{"./errors":3,"./events":4,"./nodes":7,"./usl":19,"./util":20,"url":121}],2:[function(require,module,exports){
(function (Buffer){
(function() {
  var MarkedYAMLError, nodes, util, _ref, _ref1,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  MarkedYAMLError = require('./errors').MarkedYAMLError;

  nodes = require('./nodes');

  util = require('./util');

  this.ConstructorError = (function(_super) {
    __extends(ConstructorError, _super);

    function ConstructorError() {
      _ref = ConstructorError.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    return ConstructorError;

  })(MarkedYAMLError);

  this.BaseConstructor = (function() {
    BaseConstructor.prototype.yaml_constructors = {};

    BaseConstructor.prototype.yaml_multi_constructors = {};

    BaseConstructor.add_constructor = function(tag, constructor) {
      if (!this.prototype.hasOwnProperty('yaml_constructors')) {
        this.prototype.yaml_constructors = util.extend({}, this.prototype.yaml_constructors);
      }
      return this.prototype.yaml_constructors[tag] = constructor;
    };

    BaseConstructor.add_multi_constructor = function(tag_prefix, multi_constructor) {
      if (!this.prototype.hasOwnProperty('yaml_multi_constructors')) {
        this.prototype.yaml_multi_constructors = util.extend({}, this.prototype.yaml_multi_constructors);
      }
      return this.prototype.yaml_multi_constructors[tag_prefix] = multi_constructor;
    };

    function BaseConstructor() {
      this.constructed_objects = {};
      this.constructing_nodes = [];
      this.deferred_constructors = [];
    }

    BaseConstructor.prototype.construct_document = function(node) {
      var data;
      this.applyAstTransformations(node);
      data = this.construct_object(node);
      while (!util.is_empty(this.deferred_constructors)) {
        this.deferred_constructors.pop()();
      }
      this.applyTransformations(data);
      return data;
    };

    BaseConstructor.prototype.defer = function(f) {
      return this.deferred_constructors.push(f);
    };

    BaseConstructor.prototype.construct_object = function(node) {
      var constructor, object, tag_prefix, tag_suffix, _ref1;
      if (node.unique_id in this.constructed_objects) {
        return this.constructed_objects[node.unique_id];
      }
      if (_ref1 = node.unique_id, __indexOf.call(this.constructing_nodes, _ref1) >= 0) {
        throw new exports.ConstructorError(null, null, 'found unconstructable recursive node', node.start_mark);
      }
      this.constructing_nodes.push(node.unique_id);
      constructor = null;
      tag_suffix = null;
      if (node.tag in this.yaml_constructors) {
        constructor = this.yaml_constructors[node.tag];
      } else {
        for (tag_prefix in this.yaml_multi_constructors) {
          if (node.tag.indexOf(tag_prefix === 0)) {
            tag_suffix = node.tag.slice(tag_prefix.length);
            constructor = this.yaml_multi_constructors[tag_prefix];
            break;
          }
        }
        if (constructor == null) {
          if (null in this.yaml_multi_constructors) {
            tag_suffix = node.tag;
            constructor = this.yaml_multi_constructors[null];
          } else if (null in this.yaml_constructors) {
            constructor = this.yaml_constructors[null];
          } else if (node instanceof nodes.ScalarNode) {
            constructor = this.construct_scalar;
          } else if (node instanceof nodes.SequenceNode) {
            constructor = this.construct_sequence;
          } else if (node instanceof nodes.MappingNode) {
            constructor = this.construct_mapping;
          }
        }
      }
      object = constructor.call(this, tag_suffix != null ? tag_suffix : node, node);
      this.constructed_objects[node.unique_id] = object;
      this.constructing_nodes.pop();
      return object;
    };

    BaseConstructor.prototype.construct_scalar = function(node) {
      if (!(node instanceof nodes.ScalarNode || node instanceof nodes.FileNode)) {
        throw new exports.ConstructorError(null, null, "expected a scalar node but found " + node.id, node.start_mark);
      }
      return node.value;
    };

    BaseConstructor.prototype.construct_sequence = function(node) {
      var child, _i, _len, _ref1, _results;
      if (!(node instanceof nodes.SequenceNode)) {
        throw new exports.ConstructorError(null, null, "expected an array node but found " + node.id, node.start_mark);
      }
      _ref1 = node.value;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        child = _ref1[_i];
        _results.push(this.construct_object(child));
      }
      return _results;
    };

    BaseConstructor.prototype.construct_mapping = function(node) {
      var key, key_item, key_item_value, key_node, mapping, value, value_node, _i, _j, _len, _len1, _ref1, _ref2, _ref3;
      if (!(node instanceof nodes.MappingNode)) {
        throw new exports.ConstructorError(null, null, "expected a map node but found " + node.id, node.start_mark);
      }
      mapping = {};
      _ref1 = node.value;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        _ref2 = _ref1[_i], key_node = _ref2[0], value_node = _ref2[1];
        key = this.construct_object(key_node);
        value = this.construct_object(value_node);
        if (typeof key === 'object' && key_node.tag === 'tag:yaml.org,2002:seq') {
          _ref3 = key_node.value;
          for (_j = 0, _len1 = _ref3.length; _j < _len1; _j++) {
            key_item = _ref3[_j];
            key_item_value = this.construct_object(key_item);
            mapping[key_item_value] = value;
          }
        } else if (typeof key === 'object') {
          throw new exports.ConstructorError('while constructing a map', node.start_mark, 'found unhashable key', key_node.start_mark);
        } else {
          mapping[key] = value;
        }
      }
      return mapping;
    };

    BaseConstructor.prototype.construct_pairs = function(node) {
      var key, key_node, pairs, value, value_node, _i, _len, _ref1, _ref2;
      if (!(node instanceof nodes.MappingNode)) {
        throw new exports.ConstructorError(null, null, "expected a map node but found " + node.id, node.start_mark);
      }
      pairs = [];
      _ref1 = node.value;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        _ref2 = _ref1[_i], key_node = _ref2[0], value_node = _ref2[1];
        key = this.construct_object(key_node);
        value = this.construct_object(value_node);
        pairs.push([key, value]);
      }
      return pairs;
    };

    return BaseConstructor;

  })();

  this.Constructor = (function(_super) {
    var BOOL_VALUES, TIMESTAMP_PARTS, TIMESTAMP_REGEX;

    __extends(Constructor, _super);

    function Constructor() {
      _ref1 = Constructor.__super__.constructor.apply(this, arguments);
      return _ref1;
    }

    BOOL_VALUES = {
      "true": true,
      "false": false
    };

    TIMESTAMP_REGEX = /^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:(?:[Tt]|[\x20\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\.([0-9]*))?(?:[\x20\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?)?$/;

    TIMESTAMP_PARTS = {
      year: 1,
      month: 2,
      day: 3,
      hour: 4,
      minute: 5,
      second: 6,
      fraction: 7,
      tz: 8,
      tz_sign: 9,
      tz_hour: 10,
      tz_minute: 11
    };

    Constructor.prototype.yaml_constructors = {};

    Constructor.prototype.yaml_multi_constructors = {};

    Constructor.prototype.construct_scalar = function(node) {
      var key_node, value_node, _i, _len, _ref2, _ref3;
      if (node instanceof nodes.MappingNode) {
        _ref2 = node.value;
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          _ref3 = _ref2[_i], key_node = _ref3[0], value_node = _ref3[1];
          if (key_node.tag === 'tag:yaml.org,2002:value') {
            return this.construct_scalar(value_node);
          }
        }
      }
      return Constructor.__super__.construct_scalar.call(this, node);
    };

    Constructor.prototype.flatten_mapping = function(node) {
      var index, key_node, merge, submerge, subnode, value, value_node, _i, _j, _len, _len1, _ref2, _ref3;
      merge = [];
      index = 0;
      while (index < node.value.length) {
        _ref2 = node.value[index], key_node = _ref2[0], value_node = _ref2[1];
        if (key_node.tag === 'tag:yaml.org,2002:merge') {
          node.value.splice(index, 1);
          if (value_node instanceof nodes.MappingNode) {
            this.flatten_mapping(value_node);
            merge = merge.concat(value_node.value);
          } else if (value_node instanceof nodes.SequenceNode) {
            submerge = [];
            _ref3 = value_node.value;
            for (_i = 0, _len = _ref3.length; _i < _len; _i++) {
              subnode = _ref3[_i];
              if (!(subnode instanceof nodes.MappingNode)) {
                throw new exports.ConstructorError('while constructing a map', node.start_mark, "expected a map for merging, but found " + subnode.id, subnode.start_mark);
              }
              this.flatten_mapping(subnode);
              submerge.push(subnode.value);
            }
            submerge.reverse();
            for (_j = 0, _len1 = submerge.length; _j < _len1; _j++) {
              value = submerge[_j];
              merge = merge.concat(value);
            }
          } else {
            throw new exports.ConstructorError('while constructing a map', node.start_mark, "expected a map or an array of maps for            merging but found " + value_node.id, value_node.start_mark);
          }
        } else if (key_node.tag === 'tag:yaml.org,2002:value') {
          key_node.tag = 'tag:yaml.org,2002:str';
          index++;
        } else {
          index++;
        }
      }
      if (merge.length) {
        return node.value = merge.concat(node.value);
      }
    };

    Constructor.prototype.construct_mapping = function(node) {
      if (node instanceof nodes.MappingNode) {
        this.flatten_mapping(node);
      }
      return Constructor.__super__.construct_mapping.call(this, node);
    };

    Constructor.prototype.construct_yaml_null = function(node) {
      this.construct_scalar(node);
      return null;
    };

    Constructor.prototype.construct_yaml_bool = function(node) {
      var value;
      value = this.construct_scalar(node);
      return BOOL_VALUES[value.toLowerCase()];
    };

    Constructor.prototype.construct_yaml_int = function(node) {
      var base, digit, digits, part, sign, value, _i, _len, _ref2;
      value = this.construct_scalar(node);
      value = value.replace(/_/g, '');
      sign = value[0] === '-' ? -1 : 1;
      if (_ref2 = value[0], __indexOf.call('+-', _ref2) >= 0) {
        value = value.slice(1);
      }
      if (value === '0') {
        return 0;
      } else if (value.indexOf('0b') === 0) {
        return sign * parseInt(value.slice(2), 2);
      } else if (value.indexOf('0x') === 0) {
        return sign * parseInt(value.slice(2), 16);
      } else if (value.indexOf('0o') === 0) {
        return sign * parseInt(value.slice(2), 8);
      } else if (value[0] === '0') {
        return sign * parseInt(value, 8);
      } else if (__indexOf.call(value, ':') >= 0) {
        digits = (function() {
          var _i, _len, _ref3, _results;
          _ref3 = value.split(/:/g);
          _results = [];
          for (_i = 0, _len = _ref3.length; _i < _len; _i++) {
            part = _ref3[_i];
            _results.push(parseInt(part));
          }
          return _results;
        })();
        digits.reverse();
        base = 1;
        value = 0;
        for (_i = 0, _len = digits.length; _i < _len; _i++) {
          digit = digits[_i];
          value += digit * base;
          base *= 60;
        }
        return sign * value;
      } else {
        return sign * parseInt(value);
      }
    };

    Constructor.prototype.construct_yaml_float = function(node) {
      var base, digit, digits, part, sign, value, _i, _len, _ref2;
      value = this.construct_scalar(node);
      value = value.replace(/_/g, '').toLowerCase();
      sign = value[0] === '-' ? -1 : 1;
      if (_ref2 = value[0], __indexOf.call('+-', _ref2) >= 0) {
        value = value.slice(1);
      }
      if (value === '.inf') {
        return sign * Infinity;
      } else if (value === '.nan') {
        return NaN;
      } else if (__indexOf.call(value, ':') >= 0) {
        digits = (function() {
          var _i, _len, _ref3, _results;
          _ref3 = value.split(/:/g);
          _results = [];
          for (_i = 0, _len = _ref3.length; _i < _len; _i++) {
            part = _ref3[_i];
            _results.push(parseFloat(part));
          }
          return _results;
        })();
        digits.reverse();
        base = 1;
        value = 0.0;
        for (_i = 0, _len = digits.length; _i < _len; _i++) {
          digit = digits[_i];
          value += digit * base;
          base *= 60;
        }
        return sign * value;
      } else {
        return sign * parseFloat(value);
      }
    };

    Constructor.prototype.construct_yaml_binary = function(node) {
      var error, value;
      value = this.construct_scalar(node);
      try {
        if (typeof window !== "undefined" && window !== null) {
          return atob(value);
        }
        return new Buffer(value, 'base64').toString('ascii');
      } catch (_error) {
        error = _error;
        throw new exports.ConstructorError(null, null, "failed to decode base64 data: " + error, node.start_mark);
      }
    };

    Constructor.prototype.construct_yaml_timestamp = function(node) {
      var date, day, fraction, hour, index, key, match, millisecond, minute, month, second, tz_hour, tz_minute, tz_sign, value, values, year;
      value = this.construct_scalar(node);
      match = node.value.match(TIMESTAMP_REGEX);
      values = {};
      for (key in TIMESTAMP_PARTS) {
        index = TIMESTAMP_PARTS[key];
        values[key] = match[index];
      }
      year = parseInt(values.year);
      month = parseInt(values.month) - 1;
      day = parseInt(values.day);
      if (!values.hour) {
        return new Date(Date.UTC(year, month, day));
      }
      hour = parseInt(values.hour);
      minute = parseInt(values.minute);
      second = parseInt(values.second);
      millisecond = 0;
      if (values.fraction) {
        fraction = values.fraction.slice(0, 6);
        while (fraction.length < 6) {
          fraction += '0';
        }
        fraction = parseInt(fraction);
        millisecond = Math.round(fraction / 1000);
      }
      if (values.tz_sign) {
        tz_sign = values.tz_sign === '-' ? 1 : -1;
        if (tz_hour = parseInt(values.tz_hour)) {
          hour += tz_sign * tz_hour;
        }
        if (tz_minute = parseInt(values.tz_minute)) {
          minute += tz_sign * tz_minute;
        }
      }
      date = new Date(Date.UTC(year, month, day, hour, minute, second, millisecond));
      return date;
    };

    Constructor.prototype.construct_yaml_pair_list = function(type, node) {
      var list,
        _this = this;
      list = [];
      if (!(node instanceof nodes.SequenceNode)) {
        throw new exports.ConstructorError("while constructing " + type, node.start_mark, "expected an array but found " + node.id, node.start_mark);
      }
      this.defer(function() {
        var key, key_node, subnode, value, value_node, _i, _len, _ref2, _ref3, _results;
        _ref2 = node.value;
        _results = [];
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          subnode = _ref2[_i];
          if (!(subnode instanceof nodes.MappingNode)) {
            throw new exports.ConstructorError("while constructing " + type, node.start_mark, "expected a map of length 1 but found " + subnode.id, subnode.start_mark);
          }
          if (subnode.value.length !== 1) {
            throw new exports.ConstructorError("while constructing " + type, node.start_mark, "expected a map of length 1 but found " + subnode.id, subnode.start_mark);
          }
          _ref3 = subnode.value[0], key_node = _ref3[0], value_node = _ref3[1];
          key = _this.construct_object(key_node);
          value = _this.construct_object(value_node);
          _results.push(list.push([key, value]));
        }
        return _results;
      });
      return list;
    };

    Constructor.prototype.construct_yaml_omap = function(node) {
      return this.construct_yaml_pair_list('an ordered map', node);
    };

    Constructor.prototype.construct_yaml_pairs = function(node) {
      return this.construct_yaml_pair_list('pairs', node);
    };

    Constructor.prototype.construct_yaml_set = function(node) {
      var data,
        _this = this;
      data = [];
      this.defer(function() {
        var item, _results;
        _results = [];
        for (item in _this.construct_mapping(node)) {
          _results.push(data.push(item));
        }
        return _results;
      });
      return data;
    };

    Constructor.prototype.construct_yaml_str = function(node) {
      return this.construct_scalar(node);
    };

    Constructor.prototype.construct_yaml_seq = function(node) {
      var data,
        _this = this;
      data = [];
      this.defer(function() {
        var item, _i, _len, _ref2, _results;
        _ref2 = _this.construct_sequence(node);
        _results = [];
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          item = _ref2[_i];
          _results.push(data.push(item));
        }
        return _results;
      });
      return data;
    };

    Constructor.prototype.construct_yaml_map = function(node) {
      var data,
        _this = this;
      data = {};
      this.defer(function() {
        var key, value, _ref2, _results;
        _ref2 = _this.construct_mapping(node);
        _results = [];
        for (key in _ref2) {
          value = _ref2[key];
          _results.push(data[key] = value);
        }
        return _results;
      });
      return data;
    };

    Constructor.prototype.construct_yaml_object = function(node, klass) {
      var data,
        _this = this;
      data = new klass;
      this.defer(function() {
        var key, value, _ref2, _results;
        _ref2 = _this.construct_mapping(node, true);
        _results = [];
        for (key in _ref2) {
          value = _ref2[key];
          _results.push(data[key] = value);
        }
        return _results;
      });
      return data;
    };

    Constructor.prototype.construct_undefined = function(node) {
      throw new exports.ConstructorError(null, null, "could not determine a constructor for the tag " + node.tag, node.start_mark);
    };

    return Constructor;

  })(this.BaseConstructor);

  this.Constructor.add_constructor('tag:yaml.org,2002:null', this.Constructor.prototype.construct_yaml_null);

  this.Constructor.add_constructor('tag:yaml.org,2002:bool', this.Constructor.prototype.construct_yaml_bool);

  this.Constructor.add_constructor('tag:yaml.org,2002:int', this.Constructor.prototype.construct_yaml_int);

  this.Constructor.add_constructor('tag:yaml.org,2002:float', this.Constructor.prototype.construct_yaml_float);

  this.Constructor.add_constructor('tag:yaml.org,2002:binary', this.Constructor.prototype.construct_yaml_binary);

  this.Constructor.add_constructor('tag:yaml.org,2002:timestamp', this.Constructor.prototype.construct_yaml_timestamp);

  this.Constructor.add_constructor('tag:yaml.org,2002:omap', this.Constructor.prototype.construct_yaml_omap);

  this.Constructor.add_constructor('tag:yaml.org,2002:pairs', this.Constructor.prototype.construct_yaml_pairs);

  this.Constructor.add_constructor('tag:yaml.org,2002:set', this.Constructor.prototype.construct_yaml_set);

  this.Constructor.add_constructor('tag:yaml.org,2002:str', this.Constructor.prototype.construct_yaml_str);

  this.Constructor.add_constructor('tag:yaml.org,2002:seq', this.Constructor.prototype.construct_yaml_seq);

  this.Constructor.add_constructor('tag:yaml.org,2002:map', this.Constructor.prototype.construct_yaml_map);

  this.Constructor.add_constructor(null, this.Constructor.prototype.construct_undefined);

  module.exports.Constructor = this.Constructor;

  module.exports.ConstructorError = this.ConstructorError;

}).call(this);

}).call(this,require("buffer").Buffer)
},{"./errors":3,"./nodes":7,"./util":20,"buffer":25}],3:[function(require,module,exports){
(function() {
  var NON_PRINTABLE, _ref,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  NON_PRINTABLE = require('./util').NON_PRINTABLE;

  this.Mark = (function() {
    function Mark(name, line, column, buffer, pointer) {
      this.name = name;
      this.line = line;
      this.column = column;
      this.buffer = buffer;
      this.pointer = pointer;
    }

    Mark.prototype.get_snippet = function(indent, max_length) {
      var break_chars, end, head, offset, start, tail, _ref, _ref1;
      if (indent == null) {
        indent = 4;
      }
      if (max_length == null) {
        max_length = 75;
      }
      if (this.buffer == null) {
        return null;
      }
      break_chars = '\x00\r\n\x85\u2028\u2029';
      offset = 0;
      head = '';
      tail = '';
      start = this.pointer;
      end = this.pointer;
      while (start > 0 && (_ref = this.buffer[start - 1], __indexOf.call(break_chars, _ref) < 0)) {
        start--;
        if (NON_PRINTABLE.test(this.buffer[start])) {
          offset--;
        }
        if (this.pointer - start > Math.ceil(max_length / 2 - 1)) {
          head = '... ';
          start += 4;
          offset += 4;
          break;
        }
      }
      while (end < this.buffer.length && (_ref1 = this.buffer[end], __indexOf.call(break_chars, _ref1) < 0)) {
        end++;
        if (end - this.pointer > Math.floor(max_length / 2 - 1)) {
          tail = ' ...';
          end -= 4;
          break;
        }
      }
      return "" + ((new Array(indent + 1)).join(' ')) + head + this.buffer.slice(start, end) + tail + "\n" + ((new Array(indent + 1 + this.pointer - start + offset)).join(' ')) + "^";
    };

    Mark.prototype.toString = function() {
      var snippet, where;
      snippet = this.get_snippet();
      where = "  in \"" + this.name + "\", line " + (this.line + 1) + ", column " + (this.column + 1);
      if (!snippet) {
        return where;
      } else {
        return "" + where + ":\n" + snippet;
      }
    };

    return Mark;

  })();

  this.YAMLError = (function(_super) {
    __extends(YAMLError, _super);

    function YAMLError() {
      YAMLError.__super__.constructor.call(this);
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, this.constructor);
      }
    }

    YAMLError.prototype.name = 'YAMLError';

    return YAMLError;

  })(Error);

  this.MarkedYAMLError = (function(_super) {
    __extends(MarkedYAMLError, _super);

    function MarkedYAMLError(context, context_mark, message, problem_mark, note) {
      this.context = context;
      this.context_mark = context_mark;
      this.message = message;
      this.problem_mark = problem_mark;
      this.note = note;
      MarkedYAMLError.__super__.constructor.call(this);
      if (!this.message) {
        this.message = this.context;
      }
      if (!this.problem_mark) {
        this.problem_mark = this.context_mark;
      }
    }

    MarkedYAMLError.prototype.toString = function() {
      var lines;
      lines = [];
      if (this.context != null) {
        lines.push(this.context);
      }
      if ((this.context_mark != null) && ((this.message == null) || (this.problem_mark == null) || this.context_mark.name !== this.problem_mark.name || this.context_mark.line !== this.problem_mark.line || this.context_mark.column !== this.problem_mark.column)) {
        lines.push(this.context_mark.toString());
      }
      if (this.message !== this.context) {
        lines.push(this.message);
      }
      if (this.problem_mark != null) {
        lines.push(this.problem_mark.toString());
      }
      if (this.note != null) {
        lines.push(this.note);
      }
      return lines.join('\n');
    };

    return MarkedYAMLError;

  })(this.YAMLError);

  /*
  The Validator throws these.
  */


  this.ValidationError = (function(_super) {
    __extends(ValidationError, _super);

    function ValidationError() {
      _ref = ValidationError.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    return ValidationError;

  })(this.MarkedYAMLError);

}).call(this);

},{"./util":20}],4:[function(require,module,exports){
(function() {
  var _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  this.Event = (function() {
    function Event(start_mark, end_mark) {
      this.start_mark = start_mark;
      this.end_mark = end_mark;
    }

    return Event;

  })();

  this.NodeEvent = (function(_super) {
    __extends(NodeEvent, _super);

    function NodeEvent(anchor, start_mark, end_mark) {
      this.anchor = anchor;
      this.start_mark = start_mark;
      this.end_mark = end_mark;
    }

    return NodeEvent;

  })(this.Event);

  this.CollectionStartEvent = (function(_super) {
    __extends(CollectionStartEvent, _super);

    function CollectionStartEvent(anchor, tag, implicit, start_mark, end_mark) {
      this.anchor = anchor;
      this.tag = tag;
      this.implicit = implicit;
      this.start_mark = start_mark;
      this.end_mark = end_mark;
    }

    return CollectionStartEvent;

  })(this.NodeEvent);

  this.CollectionEndEvent = (function(_super) {
    __extends(CollectionEndEvent, _super);

    function CollectionEndEvent() {
      _ref = CollectionEndEvent.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    return CollectionEndEvent;

  })(this.Event);

  this.StreamStartEvent = (function(_super) {
    __extends(StreamStartEvent, _super);

    function StreamStartEvent(start_mark, end_mark, explicit, version, tags) {
      this.start_mark = start_mark;
      this.end_mark = end_mark;
      this.explicit = explicit;
      this.version = version;
      this.tags = tags;
    }

    return StreamStartEvent;

  })(this.Event);

  this.StreamEndEvent = (function(_super) {
    __extends(StreamEndEvent, _super);

    function StreamEndEvent() {
      _ref1 = StreamEndEvent.__super__.constructor.apply(this, arguments);
      return _ref1;
    }

    return StreamEndEvent;

  })(this.Event);

  this.DocumentStartEvent = (function(_super) {
    __extends(DocumentStartEvent, _super);

    function DocumentStartEvent(start_mark, end_mark, explicit, version, tags) {
      this.start_mark = start_mark;
      this.end_mark = end_mark;
      this.explicit = explicit;
      this.version = version;
      this.tags = tags;
    }

    return DocumentStartEvent;

  })(this.Event);

  this.DocumentEndEvent = (function(_super) {
    __extends(DocumentEndEvent, _super);

    function DocumentEndEvent(start_mark, end_mark, explicit) {
      this.start_mark = start_mark;
      this.end_mark = end_mark;
      this.explicit = explicit;
    }

    return DocumentEndEvent;

  })(this.Event);

  this.AliasEvent = (function(_super) {
    __extends(AliasEvent, _super);

    function AliasEvent() {
      _ref2 = AliasEvent.__super__.constructor.apply(this, arguments);
      return _ref2;
    }

    return AliasEvent;

  })(this.NodeEvent);

  this.ScalarEvent = (function(_super) {
    __extends(ScalarEvent, _super);

    function ScalarEvent(anchor, tag, implicit, value, start_mark, end_mark, style) {
      this.anchor = anchor;
      this.tag = tag;
      this.implicit = implicit;
      this.value = value;
      this.start_mark = start_mark;
      this.end_mark = end_mark;
      this.style = style;
    }

    return ScalarEvent;

  })(this.NodeEvent);

  this.SequenceStartEvent = (function(_super) {
    __extends(SequenceStartEvent, _super);

    function SequenceStartEvent() {
      _ref3 = SequenceStartEvent.__super__.constructor.apply(this, arguments);
      return _ref3;
    }

    return SequenceStartEvent;

  })(this.CollectionStartEvent);

  this.SequenceEndEvent = (function(_super) {
    __extends(SequenceEndEvent, _super);

    function SequenceEndEvent() {
      _ref4 = SequenceEndEvent.__super__.constructor.apply(this, arguments);
      return _ref4;
    }

    return SequenceEndEvent;

  })(this.CollectionEndEvent);

  this.MappingStartEvent = (function(_super) {
    __extends(MappingStartEvent, _super);

    function MappingStartEvent() {
      _ref5 = MappingStartEvent.__super__.constructor.apply(this, arguments);
      return _ref5;
    }

    return MappingStartEvent;

  })(this.CollectionStartEvent);

  this.MappingEndEvent = (function(_super) {
    __extends(MappingEndEvent, _super);

    function MappingEndEvent() {
      _ref6 = MappingEndEvent.__super__.constructor.apply(this, arguments);
      return _ref6;
    }

    return MappingEndEvent;

  })(this.CollectionEndEvent);

}).call(this);

},{}],5:[function(require,module,exports){
(function() {
  var MarkedYAMLError, nodes, _ref,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  MarkedYAMLError = require('./errors').MarkedYAMLError;

  nodes = require('./nodes');

  /*
  The Traits throws these.
  */


  this.JoinError = (function(_super) {
    __extends(JoinError, _super);

    function JoinError() {
      _ref = JoinError.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    return JoinError;

  })(MarkedYAMLError);

  /*
  The Joiner class groups resources under resource property and groups methods under operations property
  */


  this.Joiner = (function() {
    function Joiner() {}

    Joiner.prototype.join_resources = function(node, call) {
      var resources, resourcesArray, resourcesName, resourcesValue,
        _this = this;
      if (call == null) {
        call = 0;
      }
      resources = [];
      if (node != null ? node.value : void 0) {
        resources = node.value.filter(function(childNode) {
          var _ref1;
          return (_ref1 = childNode[0]) != null ? _ref1.value.match(/^\//) : void 0;
        });
      }
      resourcesArray = [];
      if (resources.length > 0) {
        if (node != null ? node.value : void 0) {
          node.value = node.value.filter(function(childNode) {
            return !childNode[0].value.match(/^\//);
          });
        }
        resourcesName = new nodes.ScalarNode('tag:yaml.org,2002:str', 'resources', resources[0][0].start_mark, resources[resources.length - 1][1].end_mark);
        resources.forEach(function(resource) {
          var relativeUriName, relativeUriValue;
          relativeUriName = new nodes.ScalarNode('tag:yaml.org,2002:str', 'relativeUri', resource[0].start_mark, resource[1].end_mark);
          relativeUriValue = new nodes.ScalarNode('tag:yaml.org,2002:str', resource[0].value, resource[0].start_mark, resource[1].end_mark);
          if (resource[1].tag === "tag:yaml.org,2002:null") {
            resource[1] = new nodes.MappingNode('tag:yaml.org,2002:map', [], resource[0].start_mark, resource[1].end_mark);
          }
          resource[1].value.push([relativeUriName, relativeUriValue]);
          resourcesArray.push(resource[1]);
          _this.join_methods(resource[1]);
          return _this.join_resources(resource[1], ++call);
        });
        resourcesValue = new nodes.SequenceNode('tag:yaml.org,2002:seq', resourcesArray, resources[0][0].start_mark, resources[resources.length - 1][1].end_mark);
        return node.value.push([resourcesName, resourcesValue]);
      }
    };

    Joiner.prototype.join_methods = function(node) {
      var methods, methodsArray, methodsName, methodsValue,
        _this = this;
      methods = [];
      if (node && node.value) {
        methods = node.value.filter(function(childNode) {
          var _ref1;
          return _this.isHttpMethod((_ref1 = childNode[0]) != null ? _ref1.value : void 0);
        });
      }
      methodsArray = [];
      if (methods.length > 0) {
        node.value = node.value.filter(function(childNode) {
          return !_this.isHttpMethod(childNode[0].value);
        });
        methodsName = new nodes.ScalarNode('tag:yaml.org,2002:str', 'methods', methods[0][0].start_mark, methods[methods.length - 1][1].end_mark);
        methods.forEach(function(method) {
          var methodName, methodValue;
          methodName = new nodes.ScalarNode('tag:yaml.org,2002:str', 'method', method[0].start_mark, method[1].end_mark);
          methodValue = new nodes.ScalarNode('tag:yaml.org,2002:str', method[0].value, method[0].start_mark, method[1].end_mark);
          if (method[1].tag === 'tag:yaml.org,2002:null') {
            method[1] = new nodes.MappingNode('tag:yaml.org,2002:map', [], method[1].start_mark, method[1].end_mark);
          }
          method[1].value.push([methodName, methodValue]);
          return methodsArray.push(method[1]);
        });
        methodsValue = new nodes.SequenceNode('tag:yaml.org,2002:seq', methodsArray, methods[0][0].start_mark, methods[methods.length - 1][1].end_mark);
        return node.value.push([methodsName, methodsValue]);
      }
    };

    return Joiner;

  })();

}).call(this);

},{"./errors":3,"./nodes":7}],6:[function(require,module,exports){
(function() {
  var composer, construct, joiner, parser, protocols, reader, resolver, scanner, schemas, securitySchemes, traits, transformations, types, util, validator;

  util = require('./util');

  reader = require('./reader');

  scanner = require('./scanner');

  parser = require('./parser');

  composer = require('./composer');

  resolver = require('./resolver');

  construct = require('./construct');

  validator = require('./validator');

  joiner = require('./joiner');

  traits = require('./traits');

  types = require('./resourceTypes');

  schemas = require('./schemas');

  protocols = require('./protocols');

  securitySchemes = require('./securitySchemes');

  transformations = require('./transformations');

  this.make_loader = function(Reader, Scanner, Parser, Composer, Resolver, Validator, ResourceTypes, Traits, Schemas, Protocols, Joiner, SecuritySchemes, Constructor, Transformations) {
    if (Reader == null) {
      Reader = reader.Reader;
    }
    if (Scanner == null) {
      Scanner = scanner.Scanner;
    }
    if (Parser == null) {
      Parser = parser.Parser;
    }
    if (Composer == null) {
      Composer = composer.Composer;
    }
    if (Resolver == null) {
      Resolver = resolver.Resolver;
    }
    if (Validator == null) {
      Validator = validator.Validator;
    }
    if (ResourceTypes == null) {
      ResourceTypes = types.ResourceTypes;
    }
    if (Traits == null) {
      Traits = traits.Traits;
    }
    if (Schemas == null) {
      Schemas = schemas.Schemas;
    }
    if (Protocols == null) {
      Protocols = protocols.Protocols;
    }
    if (Joiner == null) {
      Joiner = joiner.Joiner;
    }
    if (SecuritySchemes == null) {
      SecuritySchemes = securitySchemes.SecuritySchemes;
    }
    if (Constructor == null) {
      Constructor = construct.Constructor;
    }
    if (Transformations == null) {
      Transformations = transformations.Transformations;
    }
    return (function() {
      var component, components;

      components = [Reader, Scanner, Composer, Transformations, Parser, Resolver, Validator, Traits, ResourceTypes, Schemas, Protocols, Joiner, Constructor, SecuritySchemes];

      util.extend.apply(util, [_Class.prototype].concat((function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = components.length; _i < _len; _i++) {
          component = components[_i];
          _results.push(component.prototype);
        }
        return _results;
      })()));

      function _Class(stream, location, settings, parent) {
        var _i, _len, _ref;
        this.parent = parent != null ? parent : null;
        components[0].call(this, stream, location);
        components[1].call(this, settings);
        components[2].call(this, settings);
        components[3].call(this, settings);
        _ref = components.slice(4);
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          component = _ref[_i];
          component.call(this);
        }
      }

      return _Class;

    })();
  };

  this.Loader = this.make_loader();

}).call(this);

},{"./composer":1,"./construct":2,"./joiner":5,"./parser":8,"./protocols":9,"./reader":10,"./resolver":11,"./resourceTypes":12,"./scanner":13,"./schemas":14,"./securitySchemes":15,"./traits":17,"./transformations":18,"./util":20,"./validator":21}],7:[function(require,module,exports){
(function() {
  var MarkedYAMLError, unique_id, _ref, _ref1, _ref2,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  MarkedYAMLError = require('./errors').MarkedYAMLError;

  unique_id = 0;

  this.ApplicationError = (function(_super) {
    __extends(ApplicationError, _super);

    function ApplicationError() {
      _ref = ApplicationError.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    return ApplicationError;

  })(MarkedYAMLError);

  this.Node = (function() {
    function Node(tag, value, start_mark, end_mark) {
      this.tag = tag;
      this.value = value;
      this.start_mark = start_mark;
      this.end_mark = end_mark;
      this.unique_id = "node_" + (unique_id++);
    }

    Node.prototype.clone = function() {
      var temp;
      temp = new this.constructor(this.tag, this.value, this.start_mark, this.end_mark);
      return temp;
    };

    return Node;

  })();

  this.ScalarNode = (function(_super) {
    __extends(ScalarNode, _super);

    ScalarNode.prototype.id = 'scalar';

    function ScalarNode(tag, value, start_mark, end_mark, style) {
      this.tag = tag;
      this.value = value;
      this.start_mark = start_mark;
      this.end_mark = end_mark;
      this.style = style;
      ScalarNode.__super__.constructor.apply(this, arguments);
    }

    ScalarNode.prototype.clone = function() {
      var temp;
      temp = new this.constructor(this.tag, this.value, this.start_mark, this.end_mark, this.style);
      return temp;
    };

    ScalarNode.prototype.cloneRemoveIs = function() {
      return this.clone();
    };

    ScalarNode.prototype.combine = function(node) {
      if (this.tag === 'tag:yaml.org,2002:null' && node.tag === 'tag:yaml.org,2002:map') {
        this.value = new exports.MappingNode('tag:yaml.org,2002:map', [], node.start_mark, node.end_mark);
        return this.value.combine(node);
      } else if (!(node instanceof exports.ScalarNode)) {
        throw new exports.ApplicationError('while applying node', null, 'different YAML structures', this.start_mark);
      }
      return this.value = node.value;
    };

    ScalarNode.prototype.remove_question_mark_properties = function() {};

    return ScalarNode;

  })(this.Node);

  this.FileNode = (function(_super) {
    __extends(FileNode, _super);

    FileNode.prototype.id = 'file';

    function FileNode(tag, value, start_mark, end_mark, style, inclusionPath) {
      this.tag = tag;
      this.value = value;
      this.start_mark = start_mark;
      this.end_mark = end_mark;
      this.style = style;
      this.inclusionPath = inclusionPath;
      FileNode.__super__.constructor.apply(this, arguments);
    }

    return FileNode;

  })(this.ScalarNode);

  this.CollectionNode = (function(_super) {
    __extends(CollectionNode, _super);

    function CollectionNode(tag, value, start_mark, end_mark, flow_style) {
      this.tag = tag;
      this.value = value;
      this.start_mark = start_mark;
      this.end_mark = end_mark;
      this.flow_style = flow_style;
      CollectionNode.__super__.constructor.apply(this, arguments);
    }

    return CollectionNode;

  })(this.Node);

  this.SequenceNode = (function(_super) {
    __extends(SequenceNode, _super);

    function SequenceNode() {
      _ref1 = SequenceNode.__super__.constructor.apply(this, arguments);
      return _ref1;
    }

    SequenceNode.prototype.id = 'sequence';

    SequenceNode.prototype.clone = function() {
      var item, items, temp, value, _i, _len, _ref2;
      items = [];
      _ref2 = this.value;
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        item = _ref2[_i];
        value = item.clone();
        items.push(value);
      }
      temp = new this.constructor(this.tag, items, this.start_mark, this.end_mark, this.flow_style);
      return temp;
    };

    SequenceNode.prototype.cloneRemoveIs = function() {
      return this.clone();
    };

    SequenceNode.prototype.combine = function(node) {
      var property, value, _i, _len, _ref2, _results;
      if (!(node instanceof exports.SequenceNode)) {
        throw new exports.ApplicationError('while applying node', null, 'different YAML structures', this.start_mark);
      }
      _ref2 = node.value;
      _results = [];
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        property = _ref2[_i];
        value = property.clone();
        _results.push(this.value.push(value));
      }
      return _results;
    };

    SequenceNode.prototype.remove_question_mark_properties = function() {
      var item, _i, _len, _ref2, _results;
      _ref2 = this.value;
      _results = [];
      for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
        item = _ref2[_i];
        _results.push(item.remove_question_mark_properties());
      }
      return _results;
    };

    return SequenceNode;

  })(this.CollectionNode);

  this.MappingNode = (function(_super) {
    __extends(MappingNode, _super);

    function MappingNode() {
      _ref2 = MappingNode.__super__.constructor.apply(this, arguments);
      return _ref2;
    }

    MappingNode.prototype.id = 'mapping';

    MappingNode.prototype.clone = function() {
      var name, properties, property, temp, value, _i, _len, _ref3;
      properties = [];
      _ref3 = this.value;
      for (_i = 0, _len = _ref3.length; _i < _len; _i++) {
        property = _ref3[_i];
        name = property[0].clone();
        value = property[1].clone();
        properties.push([name, value]);
      }
      temp = new this.constructor(this.tag, properties, this.start_mark, this.end_mark, this.flow_style);
      return temp;
    };

    MappingNode.prototype.cloneRemoveIs = function() {
      var name, properties, property, temp, value, _i, _len, _ref3, _ref4;
      properties = [];
      _ref3 = this.value;
      for (_i = 0, _len = _ref3.length; _i < _len; _i++) {
        property = _ref3[_i];
        name = property[0].cloneRemoveIs();
        value = property[1].cloneRemoveIs();
        if ((_ref4 = name.value) !== 'is') {
          properties.push([name, value]);
        }
      }
      temp = new this.constructor(this.tag, properties, this.start_mark, this.end_mark, this.flow_style);
      return temp;
    };

    MappingNode.prototype.cloneForTrait = function() {
      var name, properties, property, temp, value, _i, _len, _ref3, _ref4;
      properties = [];
      _ref3 = this.value;
      for (_i = 0, _len = _ref3.length; _i < _len; _i++) {
        property = _ref3[_i];
        name = property[0].clone();
        value = property[1].clone();
        if ((_ref4 = name.value) !== 'usage' && _ref4 !== 'displayName') {
          properties.push([name, value]);
        }
      }
      temp = new this.constructor(this.tag, properties, this.start_mark, this.end_mark, this.flow_style);
      return temp;
    };

    MappingNode.prototype.cloneForResourceType = function() {
      var name, properties, property, temp, value, _i, _len, _ref3, _ref4;
      properties = [];
      _ref3 = this.value;
      for (_i = 0, _len = _ref3.length; _i < _len; _i++) {
        property = _ref3[_i];
        name = property[0].cloneRemoveIs();
        value = property[1].cloneRemoveIs();
        if ((_ref4 = name.value) !== 'is' && _ref4 !== 'type' && _ref4 !== 'usage' && _ref4 !== 'displayName') {
          properties.push([name, value]);
        }
      }
      temp = new this.constructor(this.tag, properties, this.start_mark, this.end_mark, this.flow_style);
      return temp;
    };

    MappingNode.prototype.combine = function(resourceNode) {
      var name, node_has_property, nonNullNode, ownNodeProperty, ownNodePropertyName, resourceProperty, _i, _len, _ref3, _results;
      if (resourceNode.tag === 'tag:yaml.org,2002:null') {
        resourceNode = new exports.MappingNode('tag:yaml.org,2002:map', [], resourceNode.start_mark, resourceNode.end_mark);
      }
      if (!(resourceNode instanceof exports.MappingNode)) {
        throw new exports.ApplicationError('while applying node', null, 'different YAML structures', this.start_mark);
      }
      _ref3 = resourceNode.value;
      _results = [];
      for (_i = 0, _len = _ref3.length; _i < _len; _i++) {
        resourceProperty = _ref3[_i];
        name = resourceProperty[0].value;
        node_has_property = this.value.some(function(someProperty) {
          return (someProperty[0].value === name) || ((someProperty[0].value + '?') === name) || (someProperty[0].value === (name + '?'));
        });
        if (node_has_property) {
          _results.push((function() {
            var _j, _len1, _ref4, _results1;
            _ref4 = this.value;
            _results1 = [];
            for (_j = 0, _len1 = _ref4.length; _j < _len1; _j++) {
              ownNodeProperty = _ref4[_j];
              ownNodePropertyName = ownNodeProperty[0].value;
              if ((ownNodePropertyName === name) || ((ownNodePropertyName + '?') === name) || (ownNodePropertyName === (name + '?'))) {
                if ((ownNodeProperty[1].tag === 'tag:yaml.org,2002:null') && (resourceProperty[1].tag === 'tag:yaml.org,2002:map')) {
                  nonNullNode = new exports.MappingNode('tag:yaml.org,2002:map', [], ownNodeProperty[1].start_mark, ownNodeProperty[1].end_mark);
                  ownNodeProperty[1] = nonNullNode;
                }
                ownNodeProperty[1].combine(resourceProperty[1]);
                if (!((ownNodeProperty[0].value.slice(-1) === '?') && (resourceProperty[0].value.slice(-1) === '?'))) {
                  if (ownNodeProperty[0].value.slice(-1) === '?') {
                    _results1.push(ownNodeProperty[0].value = ownNodeProperty[0].value.slice(0, -1));
                  } else {
                    _results1.push(void 0);
                  }
                } else {
                  _results1.push(void 0);
                }
              } else {
                _results1.push(void 0);
              }
            }
            return _results1;
          }).call(this));
        } else {
          _results.push(this.value.push([resourceProperty[0].clone(), resourceProperty[1].clone()]));
        }
      }
      return _results;
    };

    MappingNode.prototype.remove_question_mark_properties = function() {
      var property, _i, _len, _ref3, _results;
      this.value = this.value.filter(function(property) {
        return property[0].value.slice(-1) !== '?';
      });
      _ref3 = this.value;
      _results = [];
      for (_i = 0, _len = _ref3.length; _i < _len; _i++) {
        property = _ref3[_i];
        _results.push(property[1].remove_question_mark_properties());
      }
      return _results;
    };

    return MappingNode;

  })(this.CollectionNode);

}).call(this);

},{"./errors":3}],8:[function(require,module,exports){
(function() {
  var MarkedYAMLError, events, tokens, _ref,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice;

  events = require('./events');

  MarkedYAMLError = require('./errors').MarkedYAMLError;

  tokens = require('./tokens');

  this.ParserError = (function(_super) {
    __extends(ParserError, _super);

    function ParserError() {
      _ref = ParserError.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    return ParserError;

  })(MarkedYAMLError);

  this.Parser = (function() {
    var DEFAULT_TAGS;

    DEFAULT_TAGS = {
      '!': '!',
      '!!': 'tag:yaml.org,2002:'
    };

    function Parser() {
      this.current_event = null;
      this.yaml_version = null;
      this.tag_handles = {};
      this.states = [];
      this.marks = [];
      this.state = 'parse_stream_start';
    }

    /*
    Reset the state attributes.
    */


    Parser.prototype.dispose = function() {
      this.states = [];
      return this.state = null;
    };

    /*
    Check the type of the next event.
    */


    Parser.prototype.check_event = function() {
      var choice, choices, _i, _len;
      choices = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      if (this.current_event === null) {
        if (this.state != null) {
          this.current_event = this[this.state]();
        }
      }
      if (this.current_event !== null) {
        if (choices.length === 0) {
          return true;
        }
        for (_i = 0, _len = choices.length; _i < _len; _i++) {
          choice = choices[_i];
          if (this.current_event instanceof choice) {
            return true;
          }
        }
      }
      return false;
    };

    /*
    Get the next event.
    */


    Parser.prototype.peek_event = function() {
      if (this.current_event === null && (this.state != null)) {
        this.current_event = this[this.state]();
      }
      return this.current_event;
    };

    /*
    Get the event and proceed further.
    */


    Parser.prototype.get_event = function() {
      var event;
      if (this.current_event === null && (this.state != null)) {
        this.current_event = this[this.state]();
      }
      event = this.current_event;
      this.current_event = null;
      return event;
    };

    /*
    Parse the stream start.
    */


    Parser.prototype.parse_stream_start = function() {
      var event, token;
      token = this.get_token();
      event = new events.StreamStartEvent(token.start_mark, token.end_mark);
      this.state = 'parse_implicit_document_start';
      return event;
    };

    /*
    Parse an implicit document.
    */


    Parser.prototype.parse_implicit_document_start = function() {
      var end_mark, event, start_mark, token;
      if (!this.check_token(tokens.DirectiveToken, tokens.DocumentStartToken, tokens.StreamEndToken)) {
        this.tag_handles = DEFAULT_TAGS;
        token = this.peek_token();
        start_mark = end_mark = token.start_mark;
        event = new events.DocumentStartEvent(start_mark, end_mark, false);
        this.states.push('parse_document_end');
        this.state = 'parse_block_node';
        return event;
      } else {
        return this.parse_document_start();
      }
    };

    /*
    Parse an explicit document.
    */


    Parser.prototype.parse_document_start = function() {
      var end_mark, event, start_mark, tags, token, version, _ref1;
      while (this.check_token(tokens.DocumentEndToken)) {
        this.get_token();
      }
      if (!this.check_token(tokens.StreamEndToken)) {
        start_mark = this.peek_token().start_mark;
        _ref1 = this.process_directives(), version = _ref1[0], tags = _ref1[1];
        if (!this.check_token(tokens.DocumentStartToken)) {
          throw new exports.ParserError("expected '<document start>', but found " + (this.peek_token().id), this.peek_token().start_mark);
        }
        token = this.get_token();
        end_mark = token.end_mark;
        event = new events.DocumentStartEvent(start_mark, end_mark, true, version, tags);
        this.states.push('parse_document_end');
        this.state = 'parse_document_content';
      } else {
        token = this.get_token();
        event = new events.StreamEndEvent(token.start_mark, token.end_mark);
        if (this.states.length !== 0) {
          throw new Error('assertion error, states should be empty');
        }
        if (this.marks.length !== 0) {
          throw new Error('assertion error, marks should be empty');
        }
        this.state = null;
      }
      return event;
    };

    /*
    Parse the document end.
    */


    Parser.prototype.parse_document_end = function() {
      var end_mark, event, explicit, start_mark, token;
      token = this.peek_token();
      start_mark = end_mark = token.start_mark;
      explicit = false;
      if (this.check_token(tokens.DocumentEndToken)) {
        token = this.get_token();
        end_mark = token.end_mark;
        explicit = true;
      }
      event = new events.DocumentEndEvent(start_mark, end_mark, explicit);
      this.state = 'parse_document_start';
      return event;
    };

    Parser.prototype.parse_document_content = function() {
      var event;
      if (this.check_token(tokens.DirectiveToken, tokens.DocumentStartToken, tokens.DocumentEndToken, tokens.StreamEndToken)) {
        event = this.process_empty_scalar(this.peek_token().start_mark);
        this.state = this.states.pop();
        return event;
      } else {
        return this.parse_block_node();
      }
    };

    Parser.prototype.process_directives = function() {
      var handle, major, minor, prefix, tag_handles_copy, token, value, _ref1, _ref2, _ref3;
      this.yaml_version = null;
      this.tag_handles = {};
      while (this.check_token(tokens.DirectiveToken)) {
        token = this.get_token();
        if (token.name === 'YAML') {
          if (this.yaml_version !== null) {
            throw new exports.ParserError(null, null, 'found duplicate YAML directive', token.start_mark);
          }
          _ref1 = token.value, major = _ref1[0], minor = _ref1[1];
          if (major !== 1 || minor !== 2) {
            throw new exports.ParserError(null, null, 'found incompatible YAML document (version 1.2 is required)', token.start_mark);
          }
          this.yaml_version = token.value;
        } else if (token.name === 'TAG') {
          _ref2 = token.value, handle = _ref2[0], prefix = _ref2[1];
          if (handle in this.tag_handles) {
            throw new exports.ParserError(null, null, "duplicate tag handle " + handle, token.start_mark);
          }
          this.tag_handles[handle] = prefix;
        }
      }
      tag_handles_copy = null;
      _ref3 = this.tag_handles;
      for (handle in _ref3) {
        if (!__hasProp.call(_ref3, handle)) continue;
        prefix = _ref3[handle];
        if (tag_handles_copy == null) {
          tag_handles_copy = {};
        }
        tag_handles_copy[handle] = prefix;
      }
      value = [this.yaml_version, tag_handles_copy];
      for (handle in DEFAULT_TAGS) {
        if (!__hasProp.call(DEFAULT_TAGS, handle)) continue;
        prefix = DEFAULT_TAGS[handle];
        if (!(prefix in this.tag_handles)) {
          this.tag_handles[handle] = prefix;
        }
      }
      return value;
    };

    Parser.prototype.parse_block_node = function() {
      return this.parse_node(true);
    };

    Parser.prototype.parse_flow_node = function() {
      return this.parse_node();
    };

    Parser.prototype.parse_block_node_or_indentless_sequence = function() {
      return this.parse_node(true, true);
    };

    Parser.prototype.parse_node = function(block, indentless_sequence) {
      var anchor, end_mark, event, handle, implicit, node, start_mark, suffix, tag, tag_mark, token;
      if (block == null) {
        block = false;
      }
      if (indentless_sequence == null) {
        indentless_sequence = false;
      }
      if (this.check_token(tokens.AliasToken)) {
        token = this.get_token();
        event = new events.AliasEvent(token.value, token.start_mark, token.end_mark);
        this.state = this.states.pop();
      } else {
        anchor = null;
        tag = null;
        start_mark = end_mark = tag_mark = null;
        if (this.check_token(tokens.AnchorToken)) {
          token = this.get_token();
          start_mark = token.start_mark;
          end_mark = token.end_mark;
          anchor = token.value;
          if (this.check_token(tokens.TagToken)) {
            token = this.get_token();
            tag_mark = token.start_mark;
            end_mark = token.end_mark;
            tag = token.value;
          }
        } else if (this.check_token(tokens.TagToken)) {
          token = this.get_token();
          start_mark = tag_mark = token.start_mark;
          end_mark = token.end_mark;
          tag = token.value;
          if (this.check_token(tokens.AnchorToken)) {
            token = this.get_token();
            end_mark = token.end_mark;
            anchor = token.value;
          }
        }
        if (tag !== null) {
          handle = tag[0], suffix = tag[1];
          if (handle !== null) {
            if (!(handle in this.tag_handles)) {
              throw new exports.ParserError('while parsing a node', start_mark, "found undefined tag handle " + handle, tag_mark);
            }
            tag = this.tag_handles[handle] + suffix;
          } else {
            tag = suffix;
          }
        }
        if (start_mark === null) {
          start_mark = end_mark = this.peek_token().start_mark;
        }
        event = null;
        implicit = tag === null || tag === '!';
        if (indentless_sequence && this.check_token(tokens.BlockEntryToken)) {
          end_mark = this.peek_token().end_mark;
          event = new events.SequenceStartEvent(anchor, tag, implicit, start_mark, end_mark);
          this.state = 'parse_indentless_sequence_entry';
        } else {
          if (this.check_token(tokens.ScalarToken)) {
            token = this.get_token();
            end_mark = token.end_mark;
            if ((token.plain && tag === null) || tag === '!') {
              implicit = [true, false];
            } else if (tag === null) {
              implicit = [false, true];
            } else {
              implicit = [false, false];
            }
            event = new events.ScalarEvent(anchor, tag, implicit, token.value, start_mark, end_mark, token.style);
            this.state = this.states.pop();
          } else if (this.check_token(tokens.FlowSequenceStartToken)) {
            end_mark = this.peek_token().end_mark;
            event = new events.SequenceStartEvent(anchor, tag, implicit, start_mark, end_mark, true);
            this.state = 'parse_flow_sequence_first_entry';
          } else if (this.check_token(tokens.FlowMappingStartToken)) {
            end_mark = this.peek_token().end_mark;
            event = new events.MappingStartEvent(anchor, tag, implicit, start_mark, end_mark, true);
            this.state = 'parse_flow_mapping_first_key';
          } else if (block && this.check_token(tokens.BlockSequenceStartToken)) {
            end_mark = this.peek_token().end_mark;
            event = new events.SequenceStartEvent(anchor, tag, implicit, start_mark, end_mark, false);
            this.state = 'parse_block_sequence_first_entry';
          } else if (block && this.check_token(tokens.BlockMappingStartToken)) {
            end_mark = this.peek_token().end_mark;
            event = new events.MappingStartEvent(anchor, tag, implicit, start_mark, end_mark, false);
            this.state = 'parse_block_mapping_first_key';
          } else if (anchor !== null || tag !== null) {
            event = new events.ScalarEvent(anchor, tag, [implicit, false], '', start_mark, end_mark);
            this.state = this.states.pop();
          } else {
            if (block) {
              node = 'block';
            } else {
              node = 'flow';
            }
            token = this.peek_token();
            throw new exports.ParserError("while parsing a " + node + " node", start_mark, "expected the node content, but found " + token.id, token.start_mark);
          }
        }
      }
      return event;
    };

    Parser.prototype.parse_block_sequence_first_entry = function() {
      var token;
      token = this.get_token();
      this.marks.push(token.start_mark);
      return this.parse_block_sequence_entry();
    };

    Parser.prototype.parse_block_sequence_entry = function() {
      var event, token;
      if (this.check_token(tokens.BlockEntryToken)) {
        token = this.get_token();
        if (!this.check_token(tokens.BlockEntryToken, tokens.BlockEndToken)) {
          this.states.push('parse_block_sequence_entry');
          return this.parse_block_node();
        } else {
          this.state = 'parse_block_sequence_entry';
          return this.process_empty_scalar(token.end_mark);
        }
      }
      if (!this.check_token(tokens.BlockEndToken)) {
        token = this.peek_token();
        throw new exports.ParserError('while parsing a block collection', this.marks.slice(-1)[0], "expected <block end>, but found " + token.id, token.start_mark);
      }
      token = this.get_token();
      event = new events.SequenceEndEvent(token.start_mark, token.end_mark);
      this.state = this.states.pop();
      this.marks.pop();
      return event;
    };

    Parser.prototype.parse_indentless_sequence_entry = function() {
      var event, token;
      if (this.check_token(tokens.BlockEntryToken)) {
        token = this.get_token();
        if (!this.check_token(tokens.BlockEntryToken, tokens.KeyToken, tokens.ValueToken, tokens.BlockEndToken)) {
          this.states.push('parse_indentless_sequence_entry');
          return this.parse_block_node();
        } else {
          this.state = 'parse_indentless_sequence_entry';
          return this.process_empty_scalar(token.end_mark);
        }
      }
      token = this.peek_token();
      event = new events.SequenceEndEvent(token.start_mark, token.start_mark);
      this.state = this.states.pop();
      return event;
    };

    Parser.prototype.parse_block_mapping_first_key = function() {
      var token;
      token = this.get_token();
      this.marks.push(token.start_mark);
      return this.parse_block_mapping_key();
    };

    Parser.prototype.parse_block_mapping_key = function() {
      var event, token;
      if (this.check_token(tokens.KeyToken)) {
        token = this.get_token();
        if (!this.check_token(tokens.KeyToken, tokens.ValueToken, tokens.BlockEndToken)) {
          this.states.push('parse_block_mapping_value');
          return this.parse_block_node_or_indentless_sequence();
        } else {
          this.state = 'parse_block_mapping_value';
          return this.process_empty_scalar(token.end_mark);
        }
      }
      if (!this.check_token(tokens.BlockEndToken)) {
        token = this.peek_token();
        throw new exports.ParserError('while parsing a block mapping', this.marks.slice(-1)[0], "expected <block end>, but found " + token.id, token.start_mark);
      }
      token = this.get_token();
      event = new events.MappingEndEvent(token.start_mark, token.end_mark);
      this.state = this.states.pop();
      this.marks.pop();
      return event;
    };

    Parser.prototype.parse_block_mapping_value = function() {
      var token;
      if (this.check_token(tokens.ValueToken)) {
        token = this.get_token();
        if (!this.check_token(tokens.KeyToken, tokens.ValueToken, tokens.BlockEndToken)) {
          this.states.push('parse_block_mapping_key');
          return this.parse_block_node_or_indentless_sequence();
        } else {
          this.state = 'parse_block_mapping_key';
          return this.process_empty_scalar(token.end_mark);
        }
      } else {
        this.state = 'parse_block_mapping_key';
        token = this.peek_token();
        return this.process_empty_scalar(token.start_mark);
      }
    };

    Parser.prototype.parse_flow_sequence_first_entry = function() {
      var token;
      token = this.get_token();
      this.marks.push(token.start_mark);
      return this.parse_flow_sequence_entry(true);
    };

    Parser.prototype.parse_flow_sequence_entry = function(first) {
      var event, token;
      if (first == null) {
        first = false;
      }
      if (!this.check_token(tokens.FlowSequenceEndToken)) {
        if (!first) {
          if (this.check_token(tokens.FlowEntryToken)) {
            this.get_token();
          } else {
            token = this.peek_token();
            throw new exports.ParserError('while parsing a flow sequence', this.marks.slice(-1)[0], "expected ',' or ']', but got " + token.id, token.start_mark);
          }
        }
        if (this.check_token(tokens.KeyToken)) {
          token = this.peek_token();
          event = new events.MappingStartEvent(null, null, true, token.start_mark, token.end_mark, true);
          this.state = 'parse_flow_sequence_entry_mapping_key';
          return event;
        } else if (!this.check_token(tokens.FlowSequenceEndToken)) {
          this.states.push('parse_flow_sequence_entry');
          return this.parse_flow_node();
        }
      }
      token = this.get_token();
      event = new events.SequenceEndEvent(token.start_mark, token.end_mark);
      this.state = this.states.pop();
      this.marks.pop();
      return event;
    };

    Parser.prototype.parse_flow_sequence_entry_mapping_key = function() {
      var token;
      token = this.get_token();
      if (!this.check_token(tokens.ValueToken, tokens.FlowEntryToken, tokens.FlowSequenceEndToken)) {
        this.states.push('parse_flow_sequence_entry_mapping_value');
        return this.parse_flow_node();
      } else {
        this.state = 'parse_flow_sequence_entry_mapping_value';
        return this.process_empty_scalar(token.end_mark);
      }
    };

    Parser.prototype.parse_flow_sequence_entry_mapping_value = function() {
      var token;
      if (this.check_token(tokens.ValueToken)) {
        token = this.get_token();
        if (!this.check_token(tokens.FlowEntryToken, tokens.FlowSequenceEndToken)) {
          this.states.push('parse_flow_sequence_entry_mapping_end');
          return this.parse_flow_node();
        } else {
          this.state = 'parse_flow_sequence_entry_mapping_end';
          return this.process_empty_scalar(token.end_mark);
        }
      } else {
        this.state = 'parse_flow_sequence_entry_mapping_end';
        token = this.peek_token();
        return this.process_empty_scalar(token.start_mark);
      }
    };

    Parser.prototype.parse_flow_sequence_entry_mapping_end = function() {
      var token;
      this.state = 'parse_flow_sequence_entry';
      token = this.peek_token();
      return new events.MappingEndEvent(token.start_mark, token.start_mark);
    };

    Parser.prototype.parse_flow_mapping_first_key = function() {
      var token;
      token = this.get_token();
      this.marks.push(token.start_mark);
      return this.parse_flow_mapping_key(true);
    };

    Parser.prototype.parse_flow_mapping_key = function(first) {
      var event, token;
      if (first == null) {
        first = false;
      }
      if (!this.check_token(tokens.FlowMappingEndToken)) {
        if (!first) {
          if (this.check_token(tokens.FlowEntryToken)) {
            this.get_token();
          } else {
            token = this.peek_token();
            throw new exports.ParserError('while parsing a flow mapping', this.marks.slice(-1)[0], "expected ',' or '}', but got " + token.id, token.start_mark);
          }
        }
        if (this.check_token(tokens.KeyToken)) {
          token = this.get_token();
          if (!this.check_token(tokens.ValueToken, tokens.FlowEntryToken, tokens.FlowMappingEndToken)) {
            this.states.push('parse_flow_mapping_value');
            return this.parse_flow_node();
          } else {
            this.state = 'parse_flow_mapping_value';
            return this.process_empty_scalar(token.end_mark);
          }
        } else if (!this.check_token(tokens.FlowMappingEndToken)) {
          this.states.push('parse_flow_mapping_empty_value');
          return this.parse_flow_node();
        }
      }
      token = this.get_token();
      event = new events.MappingEndEvent(token.start_mark, token.end_mark);
      this.state = this.states.pop();
      this.marks.pop();
      return event;
    };

    Parser.prototype.parse_flow_mapping_value = function() {
      var token;
      if (this.check_token(tokens.ValueToken)) {
        token = this.get_token();
        if (!this.check_token(tokens.FlowEntryToken, tokens.FlowMappingEndToken)) {
          this.states.push('parse_flow_mapping_key');
          return this.parse_flow_node();
        } else {
          this.state = 'parse_flow_mapping_key';
          return this.process_empty_scalar(token.end_mark);
        }
      } else {
        this.state = 'parse_flow_mapping_key';
        token = this.peek_token();
        return this.process_empty_scalar(token.start_mark);
      }
    };

    Parser.prototype.parse_flow_mapping_empty_value = function() {
      this.state = 'parse_flow_mapping_key';
      return this.process_empty_scalar(this.peek_token().start_mark);
    };

    Parser.prototype.process_empty_scalar = function(mark) {
      return new events.ScalarEvent(null, null, [true, false], '', mark, mark);
    };

    return Parser;

  })();

}).call(this);

},{"./errors":3,"./events":4,"./tokens":16}],9:[function(require,module,exports){
(function() {
  var MarkedYAMLError, nodes, url, util,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  url = require('url');

  MarkedYAMLError = require('./errors').MarkedYAMLError;

  nodes = require('./nodes');

  util = require('./util');

  /*
  The Protocols class deals with applying protocols to methods according to the spec
  */


  this.Protocols = (function() {
    function Protocols() {
      this.apply_protocols = __bind(this.apply_protocols, this);
    }

    Protocols.prototype.apply_protocols = function(node) {
      var protocols;
      if (protocols = this.apply_protocols_to_root(node)) {
        return this.apply_protocols_to_resources(node, protocols);
      }
    };

    Protocols.prototype.apply_protocols_to_root = function(node) {
      var baseUri, parsedBaseUri, protocol, protocols;
      if (this.has_property(node, 'protocols')) {
        return this.get_property(node, 'protocols');
      }
      if (!(baseUri = this.property_value(node, 'baseUri'))) {
        return;
      }
      parsedBaseUri = url.parse(baseUri);
      protocol = (parsedBaseUri.protocol || 'http:').slice(0, -1).toUpperCase();
      protocols = [new nodes.ScalarNode('tag:yaml.org,2002:str', 'protocols', node.start_mark, node.end_mark), new nodes.SequenceNode('tag:yaml.org,2002:seq', [new nodes.ScalarNode('tag:yaml.org,2002:str', protocol, node.start_mark, node.end_mark)], node.start_mark, node.end_mark)];
      node.value.push(protocols);
      return protocols[1];
    };

    Protocols.prototype.apply_protocols_to_resources = function(node, protocols) {
      var resource, _i, _len, _ref, _results;
      _ref = this.child_resources(node);
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        resource = _ref[_i];
        this.apply_protocols_to_resources(resource, protocols);
        _results.push(this.apply_protocols_to_methods(resource, protocols));
      }
      return _results;
    };

    Protocols.prototype.apply_protocols_to_methods = function(node, protocols) {
      var method, _i, _len, _ref, _results;
      _ref = this.child_methods(node[1]);
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        method = _ref[_i];
        if (!this.has_property(method[1], 'protocols')) {
          if (!util.isMapping(method[1])) {
            method[1] = new nodes.MappingNode('tag:yaml.org,2002:map', [], method[1].start_mark, method[1].end_mark);
          }
          _results.push(method[1].value.push([new nodes.ScalarNode('tag:yaml.org,2002:str', 'protocols', method[0].start_mark, method[0].end_mark), protocols.clone()]));
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    return Protocols;

  })();

}).call(this);

},{"./errors":3,"./nodes":7,"./util":20,"url":121}],10:[function(require,module,exports){
(function() {
  var Mark, MarkedYAMLError, NON_PRINTABLE, _ref, _ref1,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  _ref = require('./errors'), Mark = _ref.Mark, MarkedYAMLError = _ref.MarkedYAMLError;

  NON_PRINTABLE = require('./util').NON_PRINTABLE;

  this.ReaderError = (function(_super) {
    __extends(ReaderError, _super);

    function ReaderError() {
      _ref1 = ReaderError.__super__.constructor.apply(this, arguments);
      return _ref1;
    }

    return ReaderError;

  })(MarkedYAMLError);

  /*
  Reader:
    checks if characters are within the allowed range
    add '\x00' to the end
  */


  this.Reader = (function() {
    function Reader(string, src) {
      this.string = string;
      this.src = src;
      this.line = 0;
      this.column = 0;
      this.index = 0;
      this.string += '\x00';
    }

    Reader.prototype.peek = function(index) {
      if (index == null) {
        index = 0;
      }
      return this.string[this.index + index];
    };

    Reader.prototype.prefix = function(length) {
      if (length == null) {
        length = 1;
      }
      return this.string.slice(this.index, this.index + length);
    };

    Reader.prototype.forward = function(length) {
      var char, _results;
      if (length == null) {
        length = 1;
      }
      _results = [];
      while (length) {
        char = this.string[this.index];
        this.index++;
        if (__indexOf.call('\n\x85\u2082\u2029', char) >= 0 || (char === '\r' && this.string[this.index] !== '\n')) {
          this.line++;
          this.column = 0;
        } else {
          this.check_printable(char);
          this.column++;
        }
        _results.push(length--);
      }
      return _results;
    };

    Reader.prototype.create_mark = function(line, column) {
      if (line == null) {
        line = this.line;
      }
      if (column == null) {
        column = this.column;
      }
      return new Mark(this.src, line, column, this.string, this.index);
    };

    Reader.prototype.get_mark = function() {
      return this.create_mark();
    };

    Reader.prototype.check_printable = function(char) {
      if (NON_PRINTABLE.exec(char)) {
        throw new exports.ReaderError('while reading file', null, "non printable characters are not allowed column: " + (this.get_mark().column + 1), this.get_mark());
      }
    };

    return Reader;

  })();

}).call(this);

},{"./errors":3,"./util":20}],11:[function(require,module,exports){
(function() {
  var YAMLError, nodes, util, _ref, _ref1,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  nodes = require('./nodes');

  util = require('./util');

  YAMLError = require('./errors').YAMLError;

  this.ResolverError = (function(_super) {
    __extends(ResolverError, _super);

    function ResolverError() {
      _ref = ResolverError.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    return ResolverError;

  })(YAMLError);

  this.BaseResolver = (function() {
    var DEFAULT_MAPPING_TAG, DEFAULT_SCALAR_TAG, DEFAULT_SEQUENCE_TAG;

    DEFAULT_SCALAR_TAG = 'tag:yaml.org,2002:str';

    DEFAULT_SEQUENCE_TAG = 'tag:yaml.org,2002:seq';

    DEFAULT_MAPPING_TAG = 'tag:yaml.org,2002:map';

    BaseResolver.prototype.yaml_implicit_resolvers = {};

    BaseResolver.prototype.yaml_path_resolvers = {};

    BaseResolver.add_implicit_resolver = function(tag, regexp, first) {
      var char, _base, _i, _len, _results;
      if (first == null) {
        first = [null];
      }
      if (!this.prototype.hasOwnProperty('yaml_implicit_resolvers')) {
        this.prototype.yaml_implicit_resolvers = util.extend({}, this.prototype.yaml_implicit_resolvers);
      }
      _results = [];
      for (_i = 0, _len = first.length; _i < _len; _i++) {
        char = first[_i];
        _results.push(((_base = this.prototype.yaml_implicit_resolvers)[char] != null ? (_base = this.prototype.yaml_implicit_resolvers)[char] : _base[char] = []).push([tag, regexp]));
      }
      return _results;
    };

    function BaseResolver() {
      this.resolver_exact_paths = [];
      this.resolver_prefix_paths = [];
    }

    BaseResolver.prototype.descend_resolver = function(current_node, current_index) {
      var depth, exact_paths, kind, path, prefix_paths, _i, _j, _len, _len1, _ref1, _ref2, _ref3, _ref4;
      if (util.is_empty(this.yaml_path_resolvers)) {
        return;
      }
      exact_paths = {};
      prefix_paths = [];
      if (current_node) {
        depth = this.resolver_prefix_paths.length;
        _ref1 = this.resolver_prefix_paths.slice(-1)[0];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          _ref2 = _ref1[_i], path = _ref2[0], kind = _ref2[1];
          if (this.check_resolver_prefix(depth, path, kind, current_node, current_index)) {
            if (path.length > depth) {
              prefix_paths.push([path, kind]);
            } else {
              exact_paths[kind] = this.yaml_path_resolvers[path][kind];
            }
          }
        }
      } else {
        _ref3 = this.yaml_path_resolvers;
        for (_j = 0, _len1 = _ref3.length; _j < _len1; _j++) {
          _ref4 = _ref3[_j], path = _ref4[0], kind = _ref4[1];
          if (!path) {
            exact_paths[kind] = this.yaml_path_resolvers[path][kind];
          } else {
            prefix_paths.push([path, kind]);
          }
        }
      }
      this.resolver_exact_paths.push(exact_paths);
      return this.resolver_prefix_paths.push(prefix_paths);
    };

    BaseResolver.prototype.ascend_resolver = function() {
      if (util.is_empty(this.yaml_path_resolvers)) {
        return;
      }
      this.resolver_exact_paths.pop();
      return this.resolver_prefix_paths.pop();
    };

    BaseResolver.prototype.check_resolver_prefix = function(depth, path, kind, current_node, current_index) {
      var index_check, node_check, _ref1;
      _ref1 = path[depth - 1], node_check = _ref1[0], index_check = _ref1[1];
      if (typeof node_check === 'string') {
        if (current_node.tag !== node_check) {
          return;
        }
      } else if (node_check !== null) {
        if (!(current_node instanceof node_check)) {
          return;
        }
      }
      if (index_check === true && current_index !== null) {
        return;
      }
      if ((index_check === false || index_check === null) && current_index === null) {
        return;
      }
      if (typeof index_check === 'string') {
        if (!(current_index instanceof nodes.ScalarNode) && index_check === current_index.value) {
          return;
        }
      } else if (typeof index_check === 'number') {
        if (index_check !== current_index) {
          return;
        }
      }
      return true;
    };

    BaseResolver.prototype.resolve = function(kind, value, implicit) {
      var empty, exact_paths, k, regexp, resolvers, tag, _i, _len, _ref1, _ref2, _ref3, _ref4;
      if (kind === nodes.ScalarNode && implicit[0]) {
        if (value === '') {
          resolvers = (_ref1 = this.yaml_implicit_resolvers['']) != null ? _ref1 : [];
        } else {
          resolvers = (_ref2 = this.yaml_implicit_resolvers[value[0]]) != null ? _ref2 : [];
        }
        resolvers = resolvers.concat((_ref3 = this.yaml_implicit_resolvers[null]) != null ? _ref3 : []);
        for (_i = 0, _len = resolvers.length; _i < _len; _i++) {
          _ref4 = resolvers[_i], tag = _ref4[0], regexp = _ref4[1];
          if (value.match(regexp)) {
            return tag;
          }
        }
        implicit = implicit[1];
      }
      empty = true;
      for (k in this.yaml_path_resolvers) {
        if ({}[k] == null) {
          empty = false;
        }
      }
      if (!empty) {
        exact_paths = this.resolver_exact_paths.slice(-1)[0];
        if (__indexOf.call(exact_paths, kind) >= 0) {
          return exact_paths[kind];
        }
        if (__indexOf.call(exact_paths, null) >= 0) {
          return exact_paths[null];
        }
      }
      if (kind === nodes.ScalarNode) {
        return DEFAULT_SCALAR_TAG;
      }
      if (kind === nodes.SequenceNode) {
        return DEFAULT_SEQUENCE_TAG;
      }
      if (kind === nodes.MappingNode) {
        return DEFAULT_MAPPING_TAG;
      }
    };

    return BaseResolver;

  })();

  this.Resolver = (function(_super) {
    __extends(Resolver, _super);

    function Resolver() {
      _ref1 = Resolver.__super__.constructor.apply(this, arguments);
      return _ref1;
    }

    return Resolver;

  })(this.BaseResolver);

  this.Resolver.add_implicit_resolver('tag:yaml.org,2002:bool', /^(?:true|True|TRUE|false|False|FALSE)$/, 'tTfF');

  this.Resolver.add_implicit_resolver('tag:yaml.org,2002:float', /^(?:[-+]?(?:[0-9][0-9_]*)\.[0-9_]*(?:[eE][-+][0-9]+)?|\.[0-9_]+(?:[eE][-+][0-9]+)?|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$/, '-+0123456789.');

  this.Resolver.add_implicit_resolver('tag:yaml.org,2002:int', /^(?:[-+]?0b[01_]+|[-+]?0[0-7_]+|[-+]?(?:0|[1-9][0-9_]*)|[-+]?0x[0-9a-fA-F_]+|[-+]?0o[0-7_]+|[-+]?[1-9][0-9_]*(?::[0-5]?[0-9])+)$/, '-+0123456789');

  this.Resolver.add_implicit_resolver('tag:yaml.org,2002:merge', /^(?:<<)$/, '<');

  this.Resolver.add_implicit_resolver('tag:yaml.org,2002:null', /^(?:~|null|Null|NULL|)$/, ['~', 'n', 'N', '']);

  this.Resolver.add_implicit_resolver('tag:yaml.org,2002:timestamp', /^(?:[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]|[0-9][0-9][0-9][0-9]-[0-9][0-9]?-[0-9][0-9]?(?:[Tt]|[\x20\t]+)[0-9][0-9]?:[0-9][0-9]:[0-9][0-9](?:\.[0-9]*)?(?:[\x20\t]*(?:Z|[-+][0-9][0-9]?(?::[0-9][0-9])?))?)$/, '0123456789');

  this.Resolver.add_implicit_resolver('tag:yaml.org,2002:value', /^(?:=)$/, '=');

  this.Resolver.add_implicit_resolver('tag:yaml.org,2002:yaml', /^(?:!|&|\*)$/, '!&*');

}).call(this);

},{"./errors":3,"./nodes":7,"./util":20}],12:[function(require,module,exports){
(function() {
  var MarkedYAMLError, nodes, util, _ref,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  MarkedYAMLError = require('./errors').MarkedYAMLError;

  nodes = require('./nodes');

  util = require('./util');

  /*
  The ResourceTypes throws these.
  */


  this.ResourceTypeError = (function(_super) {
    __extends(ResourceTypeError, _super);

    function ResourceTypeError() {
      _ref = ResourceTypeError.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    return ResourceTypeError;

  })(MarkedYAMLError);

  /*
  The ResourceTypes class deals with applying ResourceTypes to resources according to the spec
  */


  this.ResourceTypes = (function() {
    function ResourceTypes() {
      this.apply_parameters_to_type = __bind(this.apply_parameters_to_type, this);
      this.apply_type = __bind(this.apply_type, this);
      this.apply_types = __bind(this.apply_types, this);
      this.get_type = __bind(this.get_type, this);
      this.has_types = __bind(this.has_types, this);
      this.load_types = __bind(this.load_types, this);
      this.declaredTypes = {};
    }

    ResourceTypes.prototype.load_types = function(node) {
      var allTypes,
        _this = this;
      this.load_default_media_type(node);
      if (this.has_property(node, 'resourceTypes')) {
        allTypes = this.property_value(node, 'resourceTypes');
        if (allTypes && typeof allTypes === 'object') {
          return allTypes.forEach(function(type_item) {
            if (type_item && typeof type_item === 'object' && typeof type_item.value === 'object') {
              return type_item.value.forEach(function(type) {
                return _this.declaredTypes[type[0].value] = type;
              });
            }
          });
        }
      }
    };

    ResourceTypes.prototype.has_types = function(node) {
      if (Object.keys(this.declaredTypes).length === 0 && this.has_property(node, 'resourceTypes')) {
        this.load_types(node);
      }
      return Object.keys(this.declaredTypes).length > 0;
    };

    ResourceTypes.prototype.get_type = function(typeName) {
      return this.declaredTypes[typeName];
    };

    ResourceTypes.prototype.apply_types = function(node, resourceUri) {
      var resources,
        _this = this;
      if (resourceUri == null) {
        resourceUri = "";
      }
      if (!util.isMapping(node)) {
        return;
      }
      if (this.has_types(node)) {
        resources = this.child_resources(node);
        return resources.forEach(function(resource) {
          var type;
          _this.apply_default_media_type_to_resource(resource[1]);
          if (_this.has_property(resource[1], 'type')) {
            type = _this.get_property(resource[1], 'type');
            _this.apply_type(resourceUri + resource[0].value, resource, type);
          }
          return _this.apply_types(resource[1], resourceUri + resource[0].value);
        });
      } else {
        resources = this.child_resources(node);
        return resources.forEach(function(resource) {
          return _this.apply_default_media_type_to_resource(resource[1]);
        });
      }
    };

    ResourceTypes.prototype.apply_type = function(resourceUri, resource, typeKey) {
      var tempType;
      tempType = this.resolve_inheritance_chain(resourceUri, typeKey);
      tempType.combine(resource[1]);
      resource[1] = tempType;
      return resource[1].remove_question_mark_properties();
    };

    ResourceTypes.prototype.resolve_inheritance_chain = function(resourceUri, typeKey) {
      var baseType, childType, childTypeName, childTypeProperty, compiledTypes, inheritsFrom, parentType, parentTypeName, pathToCircularRef, result, rootType, typesToApply;
      childTypeName = this.key_or_value(typeKey);
      childType = this.apply_parameters_to_type(resourceUri, childTypeName, typeKey);
      typesToApply = [childTypeName];
      compiledTypes = {};
      compiledTypes[childTypeName] = childType;
      this.apply_default_media_type_to_resource(childType);
      this.apply_traits_to_resource(resourceUri, childType, false);
      while (this.has_property(childType, 'type')) {
        typeKey = this.get_property(childType, 'type');
        parentTypeName = this.key_or_value(typeKey);
        if (parentTypeName in compiledTypes) {
          pathToCircularRef = typesToApply.concat(parentTypeName).join(' -> ');
          childTypeProperty = this.get_type(childTypeName)[0];
          throw new exports.ResourceTypeError('while applying resourceTypes', null, "circular reference of \"" + parentTypeName + "\" has been detected: " + pathToCircularRef, childTypeProperty.start_mark);
        }
        parentType = this.apply_parameters_to_type(resourceUri, parentTypeName, typeKey);
        this.apply_default_media_type_to_resource(parentType);
        this.apply_traits_to_resource(resourceUri, parentType, false);
        childTypeName = parentTypeName;
        childType = parentType;
        compiledTypes[childTypeName] = childType;
        typesToApply.push(childTypeName);
      }
      rootType = typesToApply.pop();
      baseType = compiledTypes[rootType].cloneForResourceType();
      result = baseType;
      while (inheritsFrom = typesToApply.pop()) {
        baseType = compiledTypes[inheritsFrom].cloneForResourceType();
        result.combine(baseType);
      }
      return result;
    };

    ResourceTypes.prototype.apply_parameters_to_type = function(resourceUri, typeName, typeKey) {
      var parameters, type;
      if (!(typeName != null ? typeName.trim() : void 0)) {
        throw new exports.ResourceTypeError('while applying resource type', null, 'resource type name must be provided', typeKey.start_mark);
      }
      if (!(type = this.get_type(typeName))) {
        throw new exports.ResourceTypeError('while applying resource type', null, "there is no resource type named " + typeName, typeKey.start_mark);
      }
      type = type[1].clone();
      parameters = this._get_parameters_from_type_key(resourceUri, typeKey);
      this.apply_parameters(type, parameters, typeKey);
      return type;
    };

    ResourceTypes.prototype._get_parameters_from_type_key = function(resourceUri, typeKey) {
      var parameter, parameters, reserved, result, _i, _len, _ref1;
      result = {};
      reserved = {
        resourcePath: resourceUri.replace(/\/\/*/g, '/'),
        resourcePathName: this.extractResourcePathName(resourceUri)
      };
      if (util.isMapping(typeKey)) {
        parameters = this.value_or_undefined(typeKey);
        if (util.isMapping(parameters[0][1])) {
          _ref1 = parameters[0][1].value;
          for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
            parameter = _ref1[_i];
            if (parameter[0].value in reserved) {
              throw new exports.ResourceTypeError('while applying parameters', null, "invalid parameter name: " + parameter[0].value + " is reserved", parameter[0].start_mark);
            }
            result[parameter[0].value] = parameter[1].value;
          }
        }
      }
      return util.extend(result, reserved);
    };

    return ResourceTypes;

  })();

}).call(this);

},{"./errors":3,"./nodes":7,"./util":20}],13:[function(require,module,exports){
(function() {
  var MarkedYAMLError, SimpleKey, tokens, util, _ref,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  MarkedYAMLError = require('./errors').MarkedYAMLError;

  tokens = require('./tokens');

  util = require('./util');

  /*
  The Scanner throws these.
  */


  this.ScannerError = (function(_super) {
    __extends(ScannerError, _super);

    function ScannerError() {
      _ref = ScannerError.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    return ScannerError;

  })(MarkedYAMLError);

  /*
  Represents a possible simple key.
  */


  SimpleKey = (function() {
    function SimpleKey(token_number, required, index, line, column, mark) {
      this.token_number = token_number;
      this.required = required;
      this.index = index;
      this.line = line;
      this.column = column;
      this.mark = mark;
    }

    return SimpleKey;

  })();

  /*
  The Scanner class deals with converting a YAML stream into a token stream.
  */


  this.Scanner = (function() {
    var C_LB, C_NUMBERS, C_WS, ESCAPE_CODES, ESCAPE_REPLACEMENTS, USL_VERSION, USL_VERSION_RE;

    C_LB = '\r\n\x85\u2028\u2029';

    C_WS = '\t ';

    C_NUMBERS = '0123456789';

    ESCAPE_REPLACEMENTS = {
      '0': '\x00',
      'a': '\x07',
      'b': '\x08',
      't': '\x09',
      '\t': '\x09',
      'n': '\x0A',
      'v': '\x0B',
      'f': '\x0C',
      'r': '\x0D',
      'e': '\x1B',
      ' ': '\x20',
      '"': '"',
      '\\': '\\',
      'N': '\x85',
      '_': '\xA0',
      'L': '\u2028',
      'P': '\u2029'
    };

    ESCAPE_CODES = {
      'x': 2,
      'u': 4,
      'U': 8
    };

    USL_VERSION = '#%USL 0.1';

    USL_VERSION_RE = /^#%USL .+$/;

    /*
    Initialise the Scanner
    */


    function Scanner(settings) {
      this.settings = settings;
      this.done = false;
      this.uslHeaderFound = !this.settings.validate;
      this.flow_level = 0;
      this.tokens = [];
      this.fetch_stream_start();
      this.tokens_taken = 0;
      this.indent = -1;
      this.indents = [];
      this.allow_simple_key = true;
      this.possible_simple_keys = {};
    }

    /*
    Check if the next token is one of the given types.
    */


    Scanner.prototype.check_token = function() {
      var choice, choices, _i, _len;
      choices = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      while (this.need_more_tokens()) {
        this.fetch_more_tokens();
      }
      if (this.tokens.length !== 0) {
        if (choices.length === 0) {
          return true;
        }
        for (_i = 0, _len = choices.length; _i < _len; _i++) {
          choice = choices[_i];
          if (this.tokens[0] instanceof choice) {
            return true;
          }
        }
      }
      return false;
    };

    /*
    Return the next token, but do not delete it from the queue.
    */


    Scanner.prototype.peek_token = function() {
      while (this.need_more_tokens()) {
        this.fetch_more_tokens();
      }
      if (this.tokens.length !== 0) {
        return this.tokens[0];
      }
    };

    /*
    Return the next token, and remove it from the queue.
    */


    Scanner.prototype.get_token = function() {
      while (this.need_more_tokens()) {
        this.fetch_more_tokens();
      }
      if (this.tokens.length !== 0) {
        this.tokens_taken++;
        return this.tokens.shift();
      }
    };

    Scanner.prototype.need_more_tokens = function() {
      if (this.done) {
        return false;
      }
      if (this.tokens.length === 0) {
        return true;
      }
      this.stale_possible_simple_keys();
      if (this.next_possible_simple_key() === this.tokens_taken) {
        return true;
      }
      return false;
    };

    Scanner.prototype.fetch_more_tokens = function() {
      var char;
      this.scan_to_next_token();
      this.stale_possible_simple_keys();
      this.unwind_indent(this.column);
      char = this.peek();
      if (char === '\x00') {
        return this.fetch_stream_end();
      }
      if (char === '%' && this.check_directive()) {
        return this.fetch_directive();
      }
      if (char === '-' && this.check_document_start()) {
        return this.fetch_document_start();
      }
      if (char === '.' && this.check_document_end()) {
        return this.fetch_document_end();
      }
      if (char === '[') {
        return this.fetch_flow_sequence_start();
      }
      if (char === '{') {
        return this.fetch_flow_mapping_start();
      }
      if (char === ']') {
        return this.fetch_flow_sequence_end();
      }
      if (char === '}') {
        return this.fetch_flow_mapping_end();
      }
      if (char === ',') {
        return this.fetch_flow_entry();
      }
      if (char === '-' && this.check_block_entry()) {
        return this.fetch_block_entry();
      }
      if (char === '?' && this.check_key()) {
        return this.fetch_key();
      }
      if (char === ':' && this.check_value()) {
        return this.fetch_value();
      }
      if (char === '*') {
        return this.fetch_alias();
      }
      if (char === '&') {
        return this.fetch_anchor();
      }
      if (char === '!') {
        return this.fetch_tag();
      }
      if (char === '|' && this.flow_level === 0) {
        return this.fetch_literal();
      }
      if (char === '>' && this.flow_level === 0) {
        return this.fetch_folded();
      }
      if (char === '\'') {
        return this.fetch_single();
      }
      if (char === '"') {
        return this.fetch_double();
      }
      if (this.check_plain()) {
        return this.fetch_plain();
      }
      throw new exports.ScannerError('while scanning for the next token', null, "found character " + char + " that cannot start any token", this.get_mark());
    };

    /*
    Return the number of the nearest possible simple key.
    */


    Scanner.prototype.next_possible_simple_key = function() {
      var key, level, min_token_number, _ref1;
      min_token_number = null;
      _ref1 = this.possible_simple_keys;
      for (level in _ref1) {
        if (!__hasProp.call(_ref1, level)) continue;
        key = _ref1[level];
        if (min_token_number === null || key.token_number < min_token_number) {
          min_token_number = key.token_number;
        }
      }
      return min_token_number;
    };

    /*
    Remove entries that are no longer possible simple keys.  According to the
    YAML spec, simple keys:
      should be limited to a single line
      should be no longer than 1024 characters
    Disabling this procedure will allow simple keys of any length and height
    (may cause problems if indentation is broken though).
    */


    Scanner.prototype.stale_possible_simple_keys = function() {
      var key, level, _ref1, _results;
      _ref1 = this.possible_simple_keys;
      _results = [];
      for (level in _ref1) {
        if (!__hasProp.call(_ref1, level)) continue;
        key = _ref1[level];
        if (key.line === this.line && this.index - key.index <= 1024) {
          continue;
        }
        if (!key.required) {
          _results.push(delete this.possible_simple_keys[level]);
        } else {
          throw new exports.ScannerError('while scanning a simple key', key.mark, 'could not find expected \':\'', this.get_mark());
        }
      }
      return _results;
    };

    /*
    The next token may start a simple key.  We check if it's possible and save
    its position.  This function is called for ALIAS, ANCHOR, TAG,
    SCALAR (flow),'[' and '{'.
    */


    Scanner.prototype.save_possible_simple_key = function() {
      var required, token_number;
      required = this.flow_level === 0 && this.indent === this.column;
      if (required && !this.allow_simple_key) {
        throw new Error('logic failure');
      }
      if (!this.allow_simple_key) {
        return;
      }
      this.remove_possible_simple_key();
      token_number = this.tokens_taken + this.tokens.length;
      return this.possible_simple_keys[this.flow_level] = new SimpleKey(token_number, required, this.index, this.line, this.column, this.get_mark());
    };

    /*
    Remove the saved possible simple key at the current flow level.
    */


    Scanner.prototype.remove_possible_simple_key = function() {
      var key;
      if (!(key = this.possible_simple_keys[this.flow_level])) {
        return;
      }
      if (!key.required) {
        return delete this.possible_simple_keys[this.flow_level];
      } else {
        throw new exports.ScannerError('while scanning a simple key', key.mark, 'could not find expected \':\'', this.get_mark());
      }
    };

    /*
    In flow context, tokens should respect indentation.
    Actually the condition should be `self.indent >= column` according to
    the spec. But this condition will prohibit intuitively correct
    constructions such as
      key : {
      }
    */


    Scanner.prototype.unwind_indent = function(column) {
      var mark, _results;
      if (this.flow_level !== 0) {
        return;
      }
      _results = [];
      while (this.indent > column) {
        mark = this.get_mark();
        this.indent = this.indents.pop();
        _results.push(this.tokens.push(new tokens.BlockEndToken(mark, mark)));
      }
      return _results;
    };

    /*
    Check if we need to increase indentation.
    */


    Scanner.prototype.add_indent = function(column) {
      if (!(column > this.indent)) {
        return false;
      }
      this.indents.push(this.indent);
      this.indent = column;
      return true;
    };

    Scanner.prototype.fetch_stream_start = function() {
      var mark;
      mark = this.get_mark();
      return this.tokens.push(new tokens.StreamStartToken(mark, mark, this.encoding));
    };

    Scanner.prototype.fetch_stream_end = function() {
      var mark;
      this.unwind_indent(-1);
      this.remove_possible_simple_key();
      this.allow_possible_simple_key = false;
      this.possible_simple_keys = {};
      mark = this.get_mark();
      this.tokens.push(new tokens.StreamEndToken(mark, mark));
      return this.done = true;
    };

    Scanner.prototype.fetch_directive = function() {
      this.unwind_indent(-1);
      this.remove_possible_simple_key();
      this.allow_simple_key = false;
      return this.tokens.push(this.scan_directive());
    };

    Scanner.prototype.fetch_document_start = function() {
      return this.fetch_document_indicator(tokens.DocumentStartToken);
    };

    Scanner.prototype.fetch_document_end = function() {
      return this.fetch_document_indicator(tokens.DocumentEndToken);
    };

    Scanner.prototype.fetch_document_indicator = function(TokenClass) {
      var start_mark;
      this.unwind_indent(-1);
      this.remove_possible_simple_key();
      this.allow_simple_key = false;
      start_mark = this.get_mark();
      this.forward(3);
      return this.tokens.push(new TokenClass(start_mark, this.get_mark()));
    };

    Scanner.prototype.fetch_flow_sequence_start = function() {
      return this.fetch_flow_collection_start(tokens.FlowSequenceStartToken);
    };

    Scanner.prototype.fetch_flow_mapping_start = function() {
      return this.fetch_flow_collection_start(tokens.FlowMappingStartToken);
    };

    Scanner.prototype.fetch_flow_collection_start = function(TokenClass) {
      var start_mark;
      this.save_possible_simple_key();
      this.flow_level++;
      this.allow_simple_key = true;
      start_mark = this.get_mark();
      this.forward();
      return this.tokens.push(new TokenClass(start_mark, this.get_mark()));
    };

    Scanner.prototype.fetch_flow_sequence_end = function() {
      return this.fetch_flow_collection_end(tokens.FlowSequenceEndToken);
    };

    Scanner.prototype.fetch_flow_mapping_end = function() {
      return this.fetch_flow_collection_end(tokens.FlowMappingEndToken);
    };

    Scanner.prototype.fetch_flow_collection_end = function(TokenClass) {
      var start_mark;
      this.remove_possible_simple_key();
      this.flow_level--;
      this.allow_simple_key = false;
      start_mark = this.get_mark();
      this.forward();
      return this.tokens.push(new TokenClass(start_mark, this.get_mark()));
    };

    Scanner.prototype.fetch_flow_entry = function() {
      var start_mark;
      this.allow_simple_key = true;
      this.remove_possible_simple_key();
      start_mark = this.get_mark();
      this.forward();
      return this.tokens.push(new tokens.FlowEntryToken(start_mark, this.get_mark()));
    };

    Scanner.prototype.fetch_block_entry = function() {
      var mark, start_mark;
      if (this.flow_level === 0) {
        if (!this.allow_simple_key) {
          throw new exports.ScannerError(null, null, 'sequence entries are not allowed here', this.get_mark());
        }
        if (this.add_indent(this.column)) {
          mark = this.get_mark();
          this.tokens.push(new tokens.BlockSequenceStartToken(mark, mark));
        }
      }
      this.allow_simple_key = true;
      this.remove_possible_simple_key();
      start_mark = this.get_mark();
      this.forward();
      return this.tokens.push(new tokens.BlockEntryToken(start_mark, this.get_mark()));
    };

    Scanner.prototype.fetch_key = function() {
      var mark, start_mark;
      if (this.flow_level === 0) {
        if (!this.allow_simple_key) {
          throw new exports.ScannerError(null, null, 'mapping keys are not allowed here', this.get_mark());
        }
        if (this.add_indent(this.column)) {
          mark = this.get_mark();
          this.tokens.push(new tokens.BlockMappingStartToken(mark, mark));
        }
      }
      this.allow_simple_key = !this.flow_level;
      this.remove_possible_simple_key();
      start_mark = this.get_mark();
      this.forward();
      return this.tokens.push(new tokens.KeyToken(start_mark, this.get_mark()));
    };

    Scanner.prototype.fetch_value = function() {
      var key, mark, start_mark;
      if (key = this.possible_simple_keys[this.flow_level]) {
        delete this.possible_simple_keys[this.flow_level];
        this.tokens.splice(key.token_number - this.tokens_taken, 0, new tokens.KeyToken(key.mark, key.mark));
        if (this.flow_level === 0) {
          if (this.add_indent(key.column)) {
            this.tokens.splice(key.token_number - this.tokens_taken, 0, new tokens.BlockMappingStartToken(key.mark, key.mark));
          }
        }
        this.allow_simple_key = false;
      } else {
        if (this.flow_level === 0) {
          if (!this.allow_simple_key) {
            throw new exports.ScannerError(null, null, 'mapping values are not allowed here', this.get_mark());
          }
          if (this.add_indent(this.column)) {
            mark = this.get_mark();
            this.tokens.push(new tokens.BlockMappingStartToken(mark, mark));
          }
        }
        this.allow_simple_key = !this.flow_level;
        this.remove_possible_simple_key();
      }
      start_mark = this.get_mark();
      this.forward();
      return this.tokens.push(new tokens.ValueToken(start_mark, this.get_mark()));
    };

    Scanner.prototype.fetch_alias = function() {
      this.save_possible_simple_key();
      this.allow_simple_key = false;
      return this.tokens.push(this.scan_anchor(tokens.AliasToken));
    };

    Scanner.prototype.fetch_anchor = function() {
      this.save_possible_simple_key();
      this.allow_simple_key = false;
      return this.tokens.push(this.scan_anchor(tokens.AnchorToken));
    };

    Scanner.prototype.fetch_tag = function() {
      this.save_possible_simple_key();
      this.allow_simple_key = false;
      return this.tokens.push(this.scan_tag());
    };

    Scanner.prototype.fetch_literal = function() {
      return this.fetch_block_scalar('|');
    };

    Scanner.prototype.fetch_folded = function() {
      return this.fetch_block_scalar('>');
    };

    Scanner.prototype.fetch_block_scalar = function(style) {
      this.allow_simple_key = true;
      this.remove_possible_simple_key();
      return this.tokens.push(this.scan_block_scalar(style));
    };

    Scanner.prototype.fetch_single = function() {
      return this.fetch_flow_scalar('\'');
    };

    Scanner.prototype.fetch_double = function() {
      return this.fetch_flow_scalar('"');
    };

    Scanner.prototype.fetch_flow_scalar = function(style) {
      this.save_possible_simple_key();
      this.allow_simple_key = false;
      return this.tokens.push(this.scan_flow_scalar(style));
    };

    Scanner.prototype.fetch_plain = function() {
      this.save_possible_simple_key();
      this.allow_simple_key = false;
      return this.tokens.push(this.scan_plain());
    };

    /*
    DIRECTIVE: ^ '%'
    */


    Scanner.prototype.check_directive = function() {
      if (this.column === 0) {
        return true;
      }
      return false;
    };

    /*
    DOCUMENT-START: ^ '---' (' '|'\n')
    */


    Scanner.prototype.check_document_start = function() {
      var _ref1;
      if (this.column === 0 && this.prefix(3) === '---' && (_ref1 = this.peek(3), __indexOf.call(C_LB + C_WS + '\x00', _ref1) >= 0)) {
        return true;
      }
      return false;
    };

    /*
    DOCUMENT-END: ^ '...' (' '|'\n')
    */


    Scanner.prototype.check_document_end = function() {
      var _ref1;
      if (this.column === 0 && this.prefix(3) === '...' && (_ref1 = this.peek(3), __indexOf.call(C_LB + C_WS + '\x00', _ref1) >= 0)) {
        return true;
      }
      return false;
    };

    /*
    BLOCK-ENTRY: '-' (' '|'\n')
    */


    Scanner.prototype.check_block_entry = function() {
      var _ref1;
      return _ref1 = this.peek(1), __indexOf.call(C_LB + C_WS + '\x00', _ref1) >= 0;
    };

    /*
    KEY (flow context):  '?'
    KEY (block context): '?' (' '|'\n')
    */


    Scanner.prototype.check_key = function() {
      var _ref1;
      if (this.flow_level !== 0) {
        return true;
      }
      return _ref1 = this.peek(1), __indexOf.call(C_LB + C_WS + '\x00', _ref1) >= 0;
    };

    /*
    VALUE (flow context):  ':'
    VALUE (block context): ':' (' '|'\n')
    */


    Scanner.prototype.check_value = function() {
      var _ref1;
      if (this.flow_level !== 0) {
        return true;
      }
      return _ref1 = this.peek(1), __indexOf.call(C_LB + C_WS + '\x00', _ref1) >= 0;
    };

    /*
    A plain scalar may start with any non-space character except:
      '-', '?', ':', ',', '[', ']', '{', '}',
      '#', '&', '*', '!', '|', '>', '\'', '"',
      '%', '@', '`'.
    
    It may also start with
      '-', '?', ':'
    if it is followed by a non-space character.
    
    Note that we limit the last rule to the block context (except the '-'
    character) because we want the flow context to be space independent.
    */


    Scanner.prototype.check_plain = function() {
      var char, _ref1;
      char = this.peek();
      return __indexOf.call(C_LB + C_WS + '\x00-?:,[]{}#&*!|>\'"%@`', char) < 0 || ((_ref1 = this.peek(1), __indexOf.call(C_LB + C_WS + '\x00', _ref1) < 0) && (char === '-' || (this.flow_level === 0 && __indexOf.call('?:', char) >= 0)));
    };

    /*
    We ignore spaces, line breaks and comments.
    If we find a line break in the block context, we set the flag
    `allow_simple_key` on.
    The byte order mark is stripped if it's the first character in the stream.
    We do not yet support BOM inside the stream as the specification requires.
    Any such mark will be considered as a part of the document.
    
    TODO: We need to make tab handling rules more sane.  A good rule is
      Tabs cannot precede tokens BLOCK-SEQUENCE-START, BLOCK-MAPPING-START,
      BLOCK-END, KEY (block context), VALUE (block context), BLOCK-ENTRY
    So the tab checking code is
      @allow_simple_key = off if <TAB>
    We also need to add the check for `allow_simple_key is on` to
    `unwind_indent` before issuing BLOCK-END.  Scanners for block, flow and
    plain scalars need to be modified.
    */


    Scanner.prototype.scan_to_next_token = function() {
      var comment, found, trimmedComment, _ref1, _results;
      if (this.index === 0 && this.peek() === '\uFEFF') {
        this.forward();
      }
      found = false;
      _results = [];
      while (!found) {
        while (this.peek() === ' ') {
          this.forward();
        }
        comment = '';
        if (this.peek() === '#') {
          while (_ref1 = this.peek(), __indexOf.call(C_LB + '\x00', _ref1) < 0) {
            if (!this.uslHeaderFound) {
              comment += this.peek();
            }
            this.forward();
          }
        }
        if (!this.uslHeaderFound) {
          trimmedComment = comment.trim();
          if (trimmedComment && USL_VERSION_RE.test(trimmedComment)) {
            if (trimmedComment === USL_VERSION) {
              this.uslHeaderFound = true;
            } else {
              throw new exports.ScannerError('version validation', null, "Unsupported USL version: '" + comment + "'", this.create_mark(0, 0));
            }
          } else {
            throw new exports.ScannerError('version validation', null, "The first line must be: '" + USL_VERSION + "'", this.create_mark(0, 0));
          }
        }
        if (this.scan_line_break()) {
          if (this.flow_level === 0) {
            _results.push(this.allow_simple_key = true);
          } else {
            _results.push(void 0);
          }
        } else {
          _results.push(found = true);
        }
      }
      return _results;
    };

    /*
    See the specification for details.
    */


    Scanner.prototype.scan_directive = function() {
      var end_mark, name, start_mark, value, _ref1;
      start_mark = this.get_mark();
      this.forward();
      name = this.scan_directive_name(start_mark);
      value = null;
      if (name === 'YAML') {
        value = this.scan_yaml_directive_value(start_mark);
        end_mark = this.get_mark();
      } else if (name === 'TAG') {
        value = this.scan_tag_directive_value(start_mark);
        end_mark = this.get_mark();
      } else {
        end_mark = this.get_mark();
        while (_ref1 = this.peek(), __indexOf.call(C_LB + '\x00', _ref1) < 0) {
          this.forward();
        }
      }
      this.scan_directive_ignored_line(start_mark);
      return new tokens.DirectiveToken(name, value, start_mark, end_mark);
    };

    /*
    See the specification for details.
    */


    Scanner.prototype.scan_directive_name = function(start_mark) {
      var char, length, value;
      length = 0;
      char = this.peek(length);
      while (('0' <= char && char <= '9') || ('A' <= char && char <= 'Z') || ('a' <= char && char <= 'z') || __indexOf.call('-_', char) >= 0) {
        length++;
        char = this.peek(length);
      }
      if (length === 0) {
        throw new exports.ScannerError('while scanning a directive', start_mark, "expected alphanumeric or numeric character but found " + char, this.get_mark());
      }
      value = this.prefix(length);
      this.forward(length);
      char = this.peek();
      if (__indexOf.call(C_LB + '\x00 ', char) < 0) {
        throw new exports.ScannerError('while scanning a directive', start_mark, "expected alphanumeric or numeric character but found " + char, this.get_mark());
      }
      return value;
    };

    /*
    See the specification for details.
    */


    Scanner.prototype.scan_yaml_directive_value = function(start_mark) {
      var major, minor, _ref1;
      while (this.peek() === ' ') {
        this.forward();
      }
      major = this.scan_yaml_directive_number(start_mark);
      if (this.peek() !== '.') {
        throw new exports.ScannerError('while scanning a directive', start_mark, "expected a digit or '.' but found " + (this.peek()), this.get_mark());
      }
      this.forward();
      minor = this.scan_yaml_directive_number(start_mark);
      if (_ref1 = this.peek(), __indexOf.call(C_LB + '\x00 ', _ref1) < 0) {
        throw new exports.ScannerError('while scanning a directive', start_mark, "expected a digit or ' ' but found " + (this.peek()), this.get_mark());
      }
      return [major, minor];
    };

    /*
    See the specification for details.
    */


    Scanner.prototype.scan_yaml_directive_number = function(start_mark) {
      var char, length, value, _ref1;
      char = this.peek();
      if (!(('0' <= char && char <= '9'))) {
        throw new exports.ScannerError('while scanning a directive', start_mark, "expected a digit but found " + char, this.get_mark());
      }
      length = 0;
      while (('0' <= (_ref1 = this.peek(length)) && _ref1 <= '9')) {
        length++;
      }
      value = parseInt(this.prefix(length));
      this.forward(length);
      return value;
    };

    /*
    See the specification for details.
    */


    Scanner.prototype.scan_tag_directive_value = function(start_mark) {
      var handle, prefix;
      while (this.peek() === ' ') {
        this.forward();
      }
      handle = this.scan_tag_directive_handle(start_mark);
      while (this.peek() === ' ') {
        this.forward();
      }
      prefix = this.scan_tag_directive_prefix(start_mark);
      return [handle, prefix];
    };

    /*
    See the specification for details.
    */


    Scanner.prototype.scan_tag_directive_handle = function(start_mark) {
      var char, value;
      value = this.scan_tag_handle('directive', start_mark);
      char = this.peek();
      if (char !== ' ') {
        throw new exports.ScannerError('while scanning a directive', start_mark, "expected ' ' but found " + char, this.get_mark());
      }
      return value;
    };

    /*
    See the specification for details.
    */


    Scanner.prototype.scan_tag_directive_prefix = function(start_mark) {
      var char, value;
      value = this.scan_tag_uri('directive', start_mark);
      char = this.peek();
      if (__indexOf.call(C_LB + '\x00 ', char) < 0) {
        throw new exports.ScannerError('while scanning a directive', start_mark, "expected ' ' but found " + char, this.get_mark());
      }
      return value;
    };

    /*
    See the specification for details.
    */


    Scanner.prototype.scan_directive_ignored_line = function(start_mark) {
      var char, _ref1;
      while (this.peek() === ' ') {
        this.forward();
      }
      if (this.peek() === '#') {
        while (_ref1 = this.peek(), __indexOf.call(C_LB + '\x00', _ref1) < 0) {
          this.forward();
        }
      }
      char = this.peek();
      if (__indexOf.call(C_LB + '\x00', char) < 0) {
        throw new exports.ScannerError('while scanning a directive', start_mark, "expected a comment or a line break but found " + char, this.get_mark());
      }
      return this.scan_line_break();
    };

    /*
    The specification does not restrict characters for anchors and aliases.
    This may lead to problems, for instance, the document:
      [ *alias, value ]
    can be interpteted in two ways, as
      [ "value" ]
    and
      [ *alias , "value" ]
    Therefore we restrict aliases to numbers and ASCII letters.
    */


    Scanner.prototype.scan_anchor = function(TokenClass) {
      var char, indicator, length, name, start_mark, value;
      start_mark = this.get_mark();
      indicator = this.peek();
      if (indicator === '*') {
        name = 'alias';
      } else {
        name = 'anchor';
      }
      this.forward();
      length = 0;
      char = this.peek(length);
      while (('0' <= char && char <= '9') || ('A' <= char && char <= 'Z') || ('a' <= char && char <= 'z') || __indexOf.call('-_', char) >= 0) {
        length++;
        char = this.peek(length);
      }
      if (length === 0) {
        throw new exports.ScannerError("while scanning an " + name, start_mark, "expected alphabetic or numeric character but found '" + char + "'", this.get_mark());
      }
      value = this.prefix(length);
      this.forward(length);
      char = this.peek();
      if (__indexOf.call(C_LB + C_WS + '\x00' + '?:,]}%@`', char) < 0) {
        throw new exports.ScannerError("while scanning an " + name, start_mark, "expected alphabetic or numeric character but found '" + char + "'", this.get_mark());
      }
      return new TokenClass(value, start_mark, this.get_mark());
    };

    /*
    See the specification for details.
    */


    Scanner.prototype.scan_tag = function() {
      var char, handle, length, start_mark, suffix, use_handle;
      start_mark = this.get_mark();
      char = this.peek(1);
      if (char === '<') {
        handle = null;
        this.forward(2);
        suffix = this.scan_tag_uri('tag', start_mark);
        if (this.peek() !== '>') {
          throw new exports.ScannerError('while parsing a tag', start_mark, "expected '>' but found " + (this.peek()), this.get_mark());
        }
        this.forward();
      } else if (__indexOf.call(C_LB + C_WS + '\x00', char) >= 0) {
        handle = null;
        suffix = '!';
        this.forward();
      } else {
        length = 1;
        use_handle = false;
        while (__indexOf.call(C_LB + '\x00 ', char) < 0) {
          if (char === '!') {
            use_handle = true;
            break;
          }
          length++;
          char = this.peek(length);
        }
        if (use_handle) {
          handle = this.scan_tag_handle('tag', start_mark);
        } else {
          handle = '!';
          this.forward();
        }
        suffix = this.scan_tag_uri('tag', start_mark);
      }
      char = this.peek();
      if (__indexOf.call(C_LB + '\x00 ', char) < 0) {
        throw new exports.ScannerError('while scanning a tag', start_mark, "expected ' ' but found " + char, this.get_mark());
      }
      return new tokens.TagToken([handle, suffix], start_mark, this.get_mark());
    };

    /*
    See the specification for details.
    */


    Scanner.prototype.scan_block_scalar = function(style) {
      var breaks, chomping, chunks, end_mark, folded, increment, indent, leading_non_space, length, line_break, max_indent, min_indent, start_mark, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7;
      folded = style === '>';
      chunks = [];
      start_mark = this.get_mark();
      this.forward();
      _ref1 = this.scan_block_scalar_indicators(start_mark), chomping = _ref1[0], increment = _ref1[1];
      this.scan_block_scalar_ignored_line(start_mark);
      min_indent = this.indent + 1;
      if (min_indent < 1) {
        min_indent = 1;
      }
      if (increment == null) {
        _ref2 = this.scan_block_scalar_indentation(), breaks = _ref2[0], max_indent = _ref2[1], end_mark = _ref2[2];
        indent = Math.max(min_indent, max_indent);
      } else {
        indent = min_indent + increment - 1;
        _ref3 = this.scan_block_scalar_breaks(indent), breaks = _ref3[0], end_mark = _ref3[1];
      }
      line_break = '';
      while (this.column === indent && this.peek() !== '\x00') {
        chunks = chunks.concat(breaks);
        leading_non_space = (_ref4 = this.peek(), __indexOf.call(' \t', _ref4) < 0);
        length = 0;
        while (_ref5 = this.peek(length), __indexOf.call(C_LB + '\x00', _ref5) < 0) {
          length++;
        }
        chunks.push(this.prefix(length));
        this.forward(length);
        line_break = this.scan_line_break();
        _ref6 = this.scan_block_scalar_breaks(indent), breaks = _ref6[0], end_mark = _ref6[1];
        if (this.column === indent && this.peek() !== '\x00') {
          if (folded && line_break === '\n' && leading_non_space && (_ref7 = this.peek(), __indexOf.call(' \t', _ref7) < 0)) {
            if (util.is_empty(breaks)) {
              chunks.push(' ');
            }
          } else {
            chunks.push(line_break);
          }
        } else {
          break;
        }
      }
      if (chomping !== false) {
        chunks.push(line_break);
      }
      if (chomping === true) {
        chunks = chunks.concat(breaks);
      }
      return new tokens.ScalarToken(chunks.join(''), false, start_mark, end_mark, style);
    };

    /*
    See the specification for details.
    */


    Scanner.prototype.scan_block_scalar_indicators = function(start_mark) {
      var char, chomping, increment;
      chomping = null;
      increment = null;
      char = this.peek();
      if (__indexOf.call('+-', char) >= 0) {
        chomping = char === '+';
        this.forward();
        char = this.peek();
        if (__indexOf.call(C_NUMBERS, char) >= 0) {
          increment = parseInt(char);
          if (increment === 0) {
            throw new exports.ScannerError('while scanning a block scalar', start_mark, 'expected indentation indicator in the range 1-9 but found 0', this.get_mark());
          }
          this.forward();
        }
      } else if (__indexOf.call(C_NUMBERS, char) >= 0) {
        increment = parseInt(char);
        if (increment === 0) {
          throw new exports.ScannerError('while scanning a block scalar', start_mark, 'expected indentation indicator in the range 1-9 but found 0', this.get_mark());
        }
        this.forward();
        char = this.peek();
        if (__indexOf.call('+-', char) >= 0) {
          chomping = char === '+';
          this.forward();
        }
      }
      char = this.peek();
      if (__indexOf.call(C_LB + '\x00 ', char) < 0) {
        throw new exports.ScannerError('while scanning a block scalar', start_mark, "expected chomping or indentation indicators, but found " + char, this.get_mark());
      }
      return [chomping, increment];
    };

    /*
    See the specification for details.
    */


    Scanner.prototype.scan_block_scalar_ignored_line = function(start_mark) {
      var char, _ref1;
      while (this.peek() === ' ') {
        this.forward();
      }
      if (this.peek() === '#') {
        while (_ref1 = this.peek(), __indexOf.call(C_LB + '\x00', _ref1) < 0) {
          this.forward();
        }
      }
      char = this.peek();
      if (__indexOf.call(C_LB + '\x00', char) < 0) {
        throw new exports.ScannerError('while scanning a block scalar', start_mark, "expected a comment or a line break but found " + char, this.get_mark());
      }
      return this.scan_line_break();
    };

    /*
    See the specification for details.
    */


    Scanner.prototype.scan_block_scalar_indentation = function() {
      var chunks, end_mark, max_indent, _ref1;
      chunks = [];
      max_indent = 0;
      end_mark = this.get_mark();
      while (_ref1 = this.peek(), __indexOf.call(C_LB + ' ', _ref1) >= 0) {
        if (this.peek() !== ' ') {
          chunks.push(this.scan_line_break());
          end_mark = this.get_mark();
        } else {
          this.forward();
          if (this.column > max_indent) {
            max_indent = this.column;
          }
        }
      }
      return [chunks, max_indent, end_mark];
    };

    /*
    See the specification for details.
    */


    Scanner.prototype.scan_block_scalar_breaks = function(indent) {
      var chunks, end_mark, _ref1;
      chunks = [];
      end_mark = this.get_mark();
      while (this.column < indent && this.peek() === ' ') {
        this.forward();
      }
      while (_ref1 = this.peek(), __indexOf.call(C_LB, _ref1) >= 0) {
        chunks.push(this.scan_line_break());
        end_mark = this.get_mark();
        while (this.column < indent && this.peek() === ' ') {
          this.forward();
        }
      }
      return [chunks, end_mark];
    };

    /*
    See the specification for details.
    Note that we loose indentation rules for quoted scalars. Quoted scalars
    don't need to adhere indentation because " and ' clearly mark the beginning
    and the end of them. Therefore we are less restrictive than the
    specification requires. We only need to check that document separators are
    not included in scalars.
    */


    Scanner.prototype.scan_flow_scalar = function(style) {
      var chunks, double, quote, start_mark;
      double = style === '"';
      chunks = [];
      start_mark = this.get_mark();
      quote = this.peek();
      this.forward();
      chunks = chunks.concat(this.scan_flow_scalar_non_spaces(double, start_mark));
      while (this.peek() !== quote) {
        chunks = chunks.concat(this.scan_flow_scalar_spaces(double, start_mark));
        chunks = chunks.concat(this.scan_flow_scalar_non_spaces(double, start_mark));
      }
      this.forward();
      return new tokens.ScalarToken(chunks.join(''), false, start_mark, this.get_mark(), style);
    };

    /*
    See the specification for details.
    */


    Scanner.prototype.scan_flow_scalar_non_spaces = function(double, start_mark) {
      var char, chunks, code, k, length, _i, _ref1, _ref2;
      chunks = [];
      while (true) {
        length = 0;
        while (_ref1 = this.peek(length), __indexOf.call(C_LB + C_WS + '\'"\\\x00', _ref1) < 0) {
          length++;
        }
        if (length !== 0) {
          chunks.push(this.prefix(length));
          this.forward(length);
        }
        char = this.peek();
        if (!double && char === '\'' && this.peek(1) === '\'') {
          chunks.push('\'');
          this.forward(2);
        } else if ((double && char === '\'') || (!double && __indexOf.call('"\\', char) >= 0)) {
          chunks.push(char);
          this.forward();
        } else if (double && char === '\\') {
          this.forward();
          char = this.peek();
          if (char in ESCAPE_REPLACEMENTS) {
            chunks.push(ESCAPE_REPLACEMENTS[char]);
            this.forward();
          } else if (char in ESCAPE_CODES) {
            length = ESCAPE_CODES[char];
            this.forward();
            for (k = _i = 0; 0 <= length ? _i < length : _i > length; k = 0 <= length ? ++_i : --_i) {
              if (_ref2 = this.peek(k), __indexOf.call(C_NUMBERS + 'ABCDEFabcdef', _ref2) < 0) {
                throw new exports.ScannerError('while scanning a double-quoted scalar', start_mark, "expected escape sequence of " + length + " hexadecimal numbers, but found " + (this.peek(k)), this.get_mark());
              }
            }
            code = parseInt(this.prefix(length), 16);
            chunks.push(String.fromCharCode(code));
            this.forward(length);
          } else if (__indexOf.call(C_LB, char) >= 0) {
            this.scan_line_break();
            chunks = chunks.concat(this.scan_flow_scalar_breaks(double, start_mark));
          } else {
            throw new exports.ScannerError('while scanning a double-quoted scalar', start_mark, "found unknown escape character " + char, this.get_mark());
          }
        } else {
          return chunks;
        }
      }
    };

    /*
    See the specification for details.
    */


    Scanner.prototype.scan_flow_scalar_spaces = function(double, start_mark) {
      var breaks, char, chunks, length, line_break, whitespaces, _ref1;
      chunks = [];
      length = 0;
      while (_ref1 = this.peek(length), __indexOf.call(C_WS, _ref1) >= 0) {
        length++;
      }
      whitespaces = this.prefix(length);
      this.forward(length);
      char = this.peek();
      if (char === '\x00') {
        throw new exports.ScannerError('while scanning a quoted scalar', start_mark, 'found unexpected end of stream', this.get_mark());
      }
      if (__indexOf.call(C_LB, char) >= 0) {
        line_break = this.scan_line_break();
        breaks = this.scan_flow_scalar_breaks(double, start_mark);
        if (line_break !== '\n') {
          chunks.push(line_break);
        } else if (!breaks) {
          chunks.push(' ');
        }
        chunks = chunks.concat(breaks);
      } else {
        chunks.push(whitespaces);
      }
      return chunks;
    };

    /*
    See the specification for details.
    */


    Scanner.prototype.scan_flow_scalar_breaks = function(double, start_mark) {
      var chunks, prefix, _ref1, _ref2, _ref3;
      chunks = [];
      while (true) {
        prefix = this.prefix(3);
        if (prefix === '---' || prefix === '...' && (_ref1 = this.peek(3), __indexOf.call(C_LB + C_WS + '\x00', _ref1) >= 0)) {
          throw new exports.ScannerError('while scanning a quoted scalar', start_mark, 'found unexpected document separator', this.get_mark());
        }
        while (_ref2 = this.peek(), __indexOf.call(C_WS, _ref2) >= 0) {
          this.forward();
        }
        if (_ref3 = this.peek(), __indexOf.call(C_LB, _ref3) >= 0) {
          chunks.push(this.scan_line_break());
        } else {
          return chunks;
        }
      }
    };

    /*
    See the specification for details.
    We add an additional restriction for the flow context:
      plain scalars in the flow context cannot contain ',', ':' and '?'.
    We also keep track of the `allow_simple_key` flag here.
    Indentation rules are loosed for the flow context.
    */


    Scanner.prototype.scan_plain = function() {
      var char, chunks, end_mark, indent, length, spaces, start_mark, _ref1, _ref2;
      chunks = [];
      start_mark = end_mark = this.get_mark();
      indent = this.indent + 1;
      spaces = [];
      while (true) {
        length = 0;
        if (this.peek() === '#') {
          break;
        }
        while (true) {
          char = this.peek(length);
          if (__indexOf.call(C_LB + C_WS + '\x00', char) >= 0 || (this.flow_level === 0 && char === ':' && (_ref1 = this.peek(length + 1), __indexOf.call(C_LB + C_WS + '\x00', _ref1) >= 0)) || (this.flow_level !== 0 && __indexOf.call(',:?[]{}', char) >= 0)) {
            break;
          }
          length++;
        }
        if (this.flow_level !== 0 && char === ':' && (_ref2 = this.peek(length + 1), __indexOf.call(C_LB + C_WS + '\x00,[]{}', _ref2) < 0)) {
          this.forward(length);
          throw new exports.ScannerError('while scanning a plain scalar', start_mark, 'found unexpected \':\'', this.get_mark(), 'Please check http://pyyaml.org/wiki/YAMLColonInFlowContext');
        }
        if (length === 0) {
          break;
        }
        this.allow_simple_key = false;
        chunks = chunks.concat(spaces);
        chunks.push(this.prefix(length));
        this.forward(length);
        end_mark = this.get_mark();
        spaces = this.scan_plain_spaces(indent, start_mark);
        if ((spaces == null) || spaces.length === 0 || this.peek() === '#' || (this.flow_level === 0 && this.column < indent)) {
          break;
        }
      }
      return new tokens.ScalarToken(chunks.join(''), true, start_mark, end_mark);
    };

    /*
    See the specification for details.
    The specification is really confusing about tabs in plain scalars.
    We just forbid them completely. Do not use tabs in YAML!
    */


    Scanner.prototype.scan_plain_spaces = function(indent, start_mark) {
      var breaks, char, chunks, length, line_break, prefix, whitespaces, _ref1, _ref2;
      chunks = [];
      length = 0;
      while (_ref1 = this.peek(length), __indexOf.call(' ', _ref1) >= 0) {
        length++;
      }
      whitespaces = this.prefix(length);
      this.forward(length);
      char = this.peek();
      if (__indexOf.call(C_LB, char) >= 0) {
        line_break = this.scan_line_break();
        this.allow_simple_key = true;
        prefix = this.prefix(3);
        if (prefix === '---' || prefix === '...' && this.peek(__indexOf.call(C_LB + C_WS + '\x00', 3) >= 0)) {
          return;
        }
        breaks = [];
        while (_ref2 = this.peek(), __indexOf.call(C_LB + ' ', _ref2) >= 0) {
          if (this.peek() === ' ') {
            this.forward();
          } else {
            breaks.push(this.scan_line_break());
            prefix = this.prefix(3);
            if (prefix === '---' || prefix === '...' && this.peek(__indexOf.call(C_LB + C_WS + '\x00', 3) >= 0)) {
              return;
            }
          }
        }
        if (line_break !== '\n') {
          chunks.push(line_break);
        } else if (breaks.length === 0) {
          chunks.push(' ');
        }
        chunks = chunks.concat(breaks);
      } else if (whitespaces) {
        chunks.push(whitespaces);
      }
      return chunks;
    };

    /*
    See the specification for details.
    For some strange reasons, the specification does not allow '_' in tag
    handles. I have allowed it anyway.
    */


    Scanner.prototype.scan_tag_handle = function(name, start_mark) {
      var char, length, value;
      char = this.peek();
      if (char !== '!') {
        throw new exports.ScannerError("while scanning a " + name, start_mark, "expected '!' but found " + char, this.get_mark());
      }
      length = 1;
      char = this.peek(length);
      if (char !== ' ') {
        while (('0' <= char && char <= '9') || ('A' <= char && char <= 'Z') || ('a' <= char && char <= 'z') || __indexOf.call('-_', char) >= 0) {
          length++;
          char = this.peek(length);
        }
        if (char !== '!') {
          this.forward(length);
          throw new exports.ScannerError("while scanning a " + name, start_mark, "expected '!' but found " + char, this.get_mark());
        }
        length++;
      }
      value = this.prefix(length);
      this.forward(length);
      return value;
    };

    /*
    See the specification for details.
    Note: we do not check if URI is well-formed.
    */


    Scanner.prototype.scan_tag_uri = function(name, start_mark) {
      var char, chunks, length;
      chunks = [];
      length = 0;
      char = this.peek(length);
      while (('0' <= char && char <= '9') || ('A' <= char && char <= 'Z') || ('a' <= char && char <= 'z') || __indexOf.call('-;/?:@&=+$,_.!~*\'()[]%', char) >= 0) {
        if (char === '%') {
          chunks.push(this.prefix(length));
          this.forward(length);
          length = 0;
          chunks.push(this.scan_uri_escapes(name, start_mark));
        } else {
          length++;
        }
        char = this.peek(length);
      }
      if (length !== 0) {
        chunks.push(this.prefix(length));
        this.forward(length);
        length = 0;
      }
      if (chunks.length === 0) {
        throw new exports.ScannerError("while parsing a " + name, start_mark, "expected URI but found " + char, this.get_mark());
      }
      return chunks.join('');
    };

    /*
    See the specification for details.
    */


    Scanner.prototype.scan_uri_escapes = function(name, start_mark) {
      var bytes, k, mark, _i;
      bytes = [];
      mark = this.get_mark();
      while (this.peek() === '%') {
        this.forward();
        for (k = _i = 0; _i <= 2; k = ++_i) {
          throw new exports.ScannerError("while scanning a " + name, start_mark, "expected URI escape sequence of 2 hexadecimal numbers but found          " + (this.peek(k)), this.get_mark());
        }
        bytes.push(String.fromCharCode(parseInt(this.prefix(2), 16)));
        this.forward(2);
      }
      return bytes.join('');
    };

    /*
    Transforms:
      '\r\n'      :   '\n'
      '\r'        :   '\n'
      '\n'        :   '\n'
      '\x85'      :   '\n'
      '\u2028'    :   '\u2028'
      '\u2029     :   '\u2029'
      default     :   ''
    */


    Scanner.prototype.scan_line_break = function() {
      var char;
      char = this.peek();
      if (__indexOf.call('\r\n\x85', char) >= 0) {
        if (this.prefix(2) === '\r\n') {
          this.forward(2);
        } else {
          this.forward();
        }
        return '\n';
      } else if (__indexOf.call('\u2028\u2029', char) >= 0) {
        this.forward();
        return char;
      }
      return '';
    };

    return Scanner;

  })();

}).call(this);

},{"./errors":3,"./tokens":16,"./util":20}],14:[function(require,module,exports){
(function() {
  var MarkedYAMLError, nodes, _ref,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  MarkedYAMLError = require('./errors').MarkedYAMLError;

  nodes = require('./nodes');

  /*
  The Schemas throws these.
  */


  this.SchemaError = (function(_super) {
    __extends(SchemaError, _super);

    function SchemaError() {
      _ref = SchemaError.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    return SchemaError;

  })(MarkedYAMLError);

  /*
    The Schemas class deals with applying schemas to resources according to the spec
  */


  this.Schemas = (function() {
    function Schemas() {
      this.get_schemas_used = __bind(this.get_schemas_used, this);
      this.apply_schemas = __bind(this.apply_schemas, this);
      this.get_all_schemas = __bind(this.get_all_schemas, this);
      this.has_schemas = __bind(this.has_schemas, this);
      this.load_schemas = __bind(this.load_schemas, this);
      this.declaredSchemas = {};
    }

    Schemas.prototype.load_schemas = function(node) {
      var allSchemas,
        _this = this;
      if (this.has_property(node, "schemas")) {
        allSchemas = this.property_value(node, 'schemas');
        if (allSchemas && typeof allSchemas === "object") {
          return allSchemas.forEach(function(schema_entry) {
            if (schema_entry && typeof schema_entry === "object" && typeof schema_entry.value === "object") {
              return schema_entry.value.forEach(function(schema) {
                return _this.declaredSchemas[schema[0].value] = schema;
              });
            }
          });
        }
      }
    };

    Schemas.prototype.has_schemas = function(node) {
      if (this.declaredSchemas.length === 0 && this.has_property(node, "schemas")) {
        this.load_schemas(node);
      }
      return Object.keys(this.declaredSchemas).length > 0;
    };

    Schemas.prototype.get_all_schemas = function() {
      return this.declaredSchemas;
    };

    Schemas.prototype.apply_schemas = function(node) {
      var resources, schemas,
        _this = this;
      resources = this.child_resources(node);
      schemas = this.get_schemas_used(resources);
      return schemas.forEach(function(schema) {
        if (schema[1].value in _this.declaredSchemas) {
          return schema[1].value = _this.declaredSchemas[schema[1].value][1].value;
        }
      });
    };

    Schemas.prototype.get_schemas_used = function(resources) {
      var schemas,
        _this = this;
      schemas = [];
      resources.forEach(function(resource) {
        var properties;
        properties = _this.get_properties(resource[1], "schema");
        return schemas = schemas.concat(properties);
      });
      return schemas;
    };

    return Schemas;

  })();

}).call(this);

},{"./errors":3,"./nodes":7}],15:[function(require,module,exports){
(function() {
  var MarkedYAMLError, nodes, _ref,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  MarkedYAMLError = require('./errors').MarkedYAMLError;

  nodes = require('./nodes');

  /*
  The Schemas throws these.
  */


  this.SecuritySchemeError = (function(_super) {
    __extends(SecuritySchemeError, _super);

    /*
      The Schemas class deals with applying schemas to resources according to the spec
    */


    function SecuritySchemeError() {
      _ref = SecuritySchemeError.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    return SecuritySchemeError;

  })(MarkedYAMLError);

  this.SecuritySchemes = (function() {
    function SecuritySchemes() {
      this.get_security_scheme = __bind(this.get_security_scheme, this);
      this.get_all_schemes = __bind(this.get_all_schemes, this);
      this.load_security_schemes = __bind(this.load_security_schemes, this);
      this.declaredSchemes = {};
    }

    SecuritySchemes.prototype.load_security_schemes = function(node) {
      var allschemes,
        _this = this;
      if (this.has_property(node, "securitySchemes")) {
        allschemes = this.property_value(node, 'securitySchemes');
        if (allschemes && typeof allschemes === "object") {
          return allschemes.forEach(function(scheme_entry) {
            if (scheme_entry.tag === 'tag:yaml.org,2002:map') {
              return scheme_entry.value.forEach(function(scheme) {
                return _this.declaredSchemes[scheme[0].value] = scheme[1].value;
              });
            }
          });
        }
      }
    };

    SecuritySchemes.prototype.get_all_schemes = function() {
      return this.declaredSchemes;
    };

    SecuritySchemes.prototype.get_security_scheme = function(schemaName) {
      return this.declaredSchemes[schemaName];
    };

    return SecuritySchemes;

  })();

}).call(this);

},{"./errors":3,"./nodes":7}],16:[function(require,module,exports){
(function() {
  var _ref, _ref1, _ref10, _ref11, _ref12, _ref13, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  this.Token = (function() {
    function Token(start_mark, end_mark) {
      this.start_mark = start_mark;
      this.end_mark = end_mark;
    }

    return Token;

  })();

  this.DirectiveToken = (function(_super) {
    __extends(DirectiveToken, _super);

    DirectiveToken.prototype.id = '<directive>';

    function DirectiveToken(name, value, start_mark, end_mark) {
      this.name = name;
      this.value = value;
      this.start_mark = start_mark;
      this.end_mark = end_mark;
    }

    return DirectiveToken;

  })(this.Token);

  this.DocumentStartToken = (function(_super) {
    __extends(DocumentStartToken, _super);

    function DocumentStartToken() {
      _ref = DocumentStartToken.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    DocumentStartToken.prototype.id = '<document start>';

    return DocumentStartToken;

  })(this.Token);

  this.DocumentEndToken = (function(_super) {
    __extends(DocumentEndToken, _super);

    function DocumentEndToken() {
      _ref1 = DocumentEndToken.__super__.constructor.apply(this, arguments);
      return _ref1;
    }

    DocumentEndToken.prototype.id = '<document end>';

    return DocumentEndToken;

  })(this.Token);

  this.StreamStartToken = (function(_super) {
    __extends(StreamStartToken, _super);

    StreamStartToken.prototype.id = '<stream start>';

    function StreamStartToken(start_mark, end_mark, encoding) {
      this.start_mark = start_mark;
      this.end_mark = end_mark;
      this.encoding = encoding;
    }

    return StreamStartToken;

  })(this.Token);

  this.StreamEndToken = (function(_super) {
    __extends(StreamEndToken, _super);

    function StreamEndToken() {
      _ref2 = StreamEndToken.__super__.constructor.apply(this, arguments);
      return _ref2;
    }

    StreamEndToken.prototype.id = '<stream end>';

    return StreamEndToken;

  })(this.Token);

  this.BlockSequenceStartToken = (function(_super) {
    __extends(BlockSequenceStartToken, _super);

    function BlockSequenceStartToken() {
      _ref3 = BlockSequenceStartToken.__super__.constructor.apply(this, arguments);
      return _ref3;
    }

    BlockSequenceStartToken.prototype.id = '<block sequence start>';

    return BlockSequenceStartToken;

  })(this.Token);

  this.BlockMappingStartToken = (function(_super) {
    __extends(BlockMappingStartToken, _super);

    function BlockMappingStartToken() {
      _ref4 = BlockMappingStartToken.__super__.constructor.apply(this, arguments);
      return _ref4;
    }

    BlockMappingStartToken.prototype.id = '<block mapping end>';

    return BlockMappingStartToken;

  })(this.Token);

  this.BlockEndToken = (function(_super) {
    __extends(BlockEndToken, _super);

    function BlockEndToken() {
      _ref5 = BlockEndToken.__super__.constructor.apply(this, arguments);
      return _ref5;
    }

    BlockEndToken.prototype.id = '<block end>';

    return BlockEndToken;

  })(this.Token);

  this.FlowSequenceStartToken = (function(_super) {
    __extends(FlowSequenceStartToken, _super);

    function FlowSequenceStartToken() {
      _ref6 = FlowSequenceStartToken.__super__.constructor.apply(this, arguments);
      return _ref6;
    }

    FlowSequenceStartToken.prototype.id = '[';

    return FlowSequenceStartToken;

  })(this.Token);

  this.FlowMappingStartToken = (function(_super) {
    __extends(FlowMappingStartToken, _super);

    function FlowMappingStartToken() {
      _ref7 = FlowMappingStartToken.__super__.constructor.apply(this, arguments);
      return _ref7;
    }

    FlowMappingStartToken.prototype.id = '{';

    return FlowMappingStartToken;

  })(this.Token);

  this.FlowSequenceEndToken = (function(_super) {
    __extends(FlowSequenceEndToken, _super);

    function FlowSequenceEndToken() {
      _ref8 = FlowSequenceEndToken.__super__.constructor.apply(this, arguments);
      return _ref8;
    }

    FlowSequenceEndToken.prototype.id = ']';

    return FlowSequenceEndToken;

  })(this.Token);

  this.FlowMappingEndToken = (function(_super) {
    __extends(FlowMappingEndToken, _super);

    function FlowMappingEndToken() {
      _ref9 = FlowMappingEndToken.__super__.constructor.apply(this, arguments);
      return _ref9;
    }

    FlowMappingEndToken.prototype.id = '}';

    return FlowMappingEndToken;

  })(this.Token);

  this.KeyToken = (function(_super) {
    __extends(KeyToken, _super);

    function KeyToken() {
      _ref10 = KeyToken.__super__.constructor.apply(this, arguments);
      return _ref10;
    }

    KeyToken.prototype.id = '?';

    return KeyToken;

  })(this.Token);

  this.ValueToken = (function(_super) {
    __extends(ValueToken, _super);

    function ValueToken() {
      _ref11 = ValueToken.__super__.constructor.apply(this, arguments);
      return _ref11;
    }

    ValueToken.prototype.id = ':';

    return ValueToken;

  })(this.Token);

  this.BlockEntryToken = (function(_super) {
    __extends(BlockEntryToken, _super);

    function BlockEntryToken() {
      _ref12 = BlockEntryToken.__super__.constructor.apply(this, arguments);
      return _ref12;
    }

    BlockEntryToken.prototype.id = '-';

    return BlockEntryToken;

  })(this.Token);

  this.FlowEntryToken = (function(_super) {
    __extends(FlowEntryToken, _super);

    function FlowEntryToken() {
      _ref13 = FlowEntryToken.__super__.constructor.apply(this, arguments);
      return _ref13;
    }

    FlowEntryToken.prototype.id = ',';

    return FlowEntryToken;

  })(this.Token);

  this.AliasToken = (function(_super) {
    __extends(AliasToken, _super);

    AliasToken.prototype.id = '<alias>';

    function AliasToken(value, start_mark, end_mark) {
      this.value = value;
      this.start_mark = start_mark;
      this.end_mark = end_mark;
    }

    return AliasToken;

  })(this.Token);

  this.AnchorToken = (function(_super) {
    __extends(AnchorToken, _super);

    AnchorToken.prototype.id = '<anchor>';

    function AnchorToken(value, start_mark, end_mark) {
      this.value = value;
      this.start_mark = start_mark;
      this.end_mark = end_mark;
    }

    return AnchorToken;

  })(this.Token);

  this.TagToken = (function(_super) {
    __extends(TagToken, _super);

    TagToken.prototype.id = '<tag>';

    function TagToken(value, start_mark, end_mark) {
      this.value = value;
      this.start_mark = start_mark;
      this.end_mark = end_mark;
    }

    return TagToken;

  })(this.Token);

  this.ScalarToken = (function(_super) {
    __extends(ScalarToken, _super);

    ScalarToken.prototype.id = '<scalar>';

    function ScalarToken(value, plain, start_mark, end_mark, style) {
      this.value = value;
      this.plain = plain;
      this.start_mark = start_mark;
      this.end_mark = end_mark;
      this.style = style;
    }

    return ScalarToken;

  })(this.Token);

}).call(this);

},{}],17:[function(require,module,exports){
(function() {
  var MarkedYAMLError, nodes, pluralize, util, _ref, _ref1,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  pluralize = require('pluralize');

  MarkedYAMLError = require('./errors').MarkedYAMLError;

  nodes = require('./nodes');

  util = require('./util');

  /*
  The Traits throws these.
  */


  this.TraitError = (function(_super) {
    __extends(TraitError, _super);

    function TraitError() {
      _ref = TraitError.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    return TraitError;

  })(MarkedYAMLError);

  /*
  */


  this.ParameterError = (function(_super) {
    __extends(ParameterError, _super);

    function ParameterError() {
      _ref1 = ParameterError.__super__.constructor.apply(this, arguments);
      return _ref1;
    }

    return ParameterError;

  })(MarkedYAMLError);

  /*
  The Traits class deals with applying traits to resources according to the spec
  */


  this.Traits = (function() {
    function Traits() {
      this.declaredTraits = {};
    }

    Traits.prototype.load_traits = function(node) {
      var allTraits,
        _this = this;
      if (this.has_property(node, 'traits')) {
        allTraits = this.property_value(node, 'traits');
        if (allTraits && typeof allTraits === "object") {
          return allTraits.forEach(function(trait_item) {
            if (trait_item && typeof trait_item === "object" && typeof trait_item.value === "object") {
              return trait_item.value.forEach(function(trait) {
                return _this.declaredTraits[trait[0].value] = trait;
              });
            }
          });
        }
      }
    };

    Traits.prototype.has_traits = function(node) {
      if (this.declaredTraits.length === 0 && this.has_property(node, 'traits')) {
        this.load_traits(node);
      }
      return Object.keys(this.declaredTraits).length > 0;
    };

    Traits.prototype.get_trait = function(traitName) {
      if (traitName in this.declaredTraits) {
        return this.declaredTraits[traitName][1];
      }
      return null;
    };

    Traits.prototype.apply_traits = function(node, resourceUri, removeQs) {
      var resources,
        _this = this;
      if (resourceUri == null) {
        resourceUri = "";
      }
      if (removeQs == null) {
        removeQs = true;
      }
      if (!util.isMapping(node)) {
        return;
      }
      if (this.has_traits(node)) {
        resources = this.child_resources(node);
        return resources.forEach(function(resource) {
          return _this.apply_traits_to_resource(resourceUri + resource[0].value, resource[1], removeQs);
        });
      }
    };

    Traits.prototype.apply_traits_to_resource = function(resourceUri, resource, removeQs) {
      var methods, uses,
        _this = this;
      if (!util.isMapping(resource)) {
        return;
      }
      methods = this.child_methods(resource, true);
      if (this.has_property(resource, 'is')) {
        uses = this.property_value(resource, 'is');
        uses.forEach(function(use) {
          return methods.forEach(function(method) {
            return _this.apply_trait(resourceUri, method, use);
          });
        });
      }
      methods.forEach(function(method) {
        if (_this.has_property(method[1], 'is')) {
          uses = _this.property_value(method[1], 'is');
          return uses.forEach(function(use) {
            return _this.apply_trait(resourceUri, method, use);
          });
        }
      });
      if (removeQs) {
        resource.remove_question_mark_properties();
      }
      return this.apply_traits(resource, resourceUri, removeQs);
    };

    Traits.prototype.apply_trait = function(resourceUri, method, useKey) {
      var plainParameters, temp, trait, traitName;
      traitName = this.key_or_value(useKey);
      if (!(traitName != null ? traitName.trim() : void 0)) {
        throw new exports.TraitError('while applying trait', null, 'trait name must be provided', useKey.start_mark);
      }
      if (!(trait = this.get_trait(traitName))) {
        throw new exports.TraitError('while applying trait', null, "there is no trait named " + traitName, useKey.start_mark);
      }
      plainParameters = this.get_parameters_from_is_key(resourceUri, method[0].value, useKey);
      temp = trait.cloneForTrait();
      this.apply_parameters(temp, plainParameters, useKey);
      this.apply_default_media_type_to_method(temp);
      temp.combine(method[1]);
      return method[1] = temp;
    };

    Traits.prototype.apply_parameters = function(resource, parameters, useKey) {
      var parameterName, usedParameters, _results;
      this._apply_parameters(resource, parameters, useKey, usedParameters = {
        resourcePath: true,
        resourcePathName: true,
        methodName: true
      });
      _results = [];
      for (parameterName in parameters) {
        if (!usedParameters[parameterName]) {
          throw new exports.ParameterError('while applying parameters', null, "unused parameter: " + parameterName, useKey.start_mark);
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    Traits.prototype._apply_parameters = function(resource, parameters, useKey, usedParameters) {
      var parameterUse,
        _this = this;
      if (!resource) {
        return;
      }
      if (util.isString(resource)) {
        if (parameterUse = resource.value.match(/<<\s*([^\|\s>]+)\s*(\|[^>]*)?\s*>>/g)) {
          parameterUse.forEach(function(parameter) {
            var method, parameterName, value, _ref2, _ref3;
            parameterName = parameter != null ? (_ref2 = parameter.trim()) != null ? _ref2.replace(/[<>]+/g, '').trim() : void 0 : void 0;
            _ref3 = parameterName.split(/\s*\|\s*/), parameterName = _ref3[0], method = _ref3[1];
            if (!(parameterName in parameters)) {
              throw new exports.ParameterError('while applying parameters', null, "value was not provided for parameter: " + parameterName, useKey.start_mark);
            }
            value = parameters[parameterName];
            usedParameters[parameterName] = true;
            if (method) {
              if (method.match(/!\s*singularize/)) {
                value = pluralize.singular(value);
              } else if (method.match(/!\s*pluralize/)) {
                value = pluralize.plural(value);
              } else {
                throw new exports.ParameterError('while validating parameter', null, 'unknown function applied to parameter', resource.start_mark);
              }
            }
            return resource.value = resource.value.replace(parameter, value);
          });
        }
        return;
      }
      if (util.isSequence(resource)) {
        resource.value.forEach(function(node) {
          return _this._apply_parameters(node, parameters, useKey, usedParameters);
        });
        return;
      }
      if (util.isMapping(resource)) {
        resource.value.forEach(function(property) {
          _this._apply_parameters(property[0], parameters, useKey, usedParameters);
          return _this._apply_parameters(property[1], parameters, useKey, usedParameters);
        });
      }
    };

    Traits.prototype.get_parameters_from_is_key = function(resourceUri, methodName, typeKey) {
      var parameter, parameters, reserved, result, _i, _len, _ref2;
      result = {};
      reserved = {
        methodName: methodName,
        resourcePath: resourceUri.replace(/\/\/*/g, '/'),
        resourcePathName: this.extractResourcePathName(resourceUri)
      };
      if (util.isMapping(typeKey)) {
        parameters = this.value_or_undefined(typeKey);
        if (util.isMapping(parameters[0][1])) {
          _ref2 = parameters[0][1].value;
          for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
            parameter = _ref2[_i];
            if (parameter[0].value in reserved) {
              throw new exports.TraitError('while applying parameters', null, "invalid parameter name: " + parameter[0].value + " is reserved", parameter[0].start_mark);
            }
            result[parameter[0].value] = parameter[1].value;
          }
        }
      }
      return util.extend(result, reserved);
    };

    Traits.prototype.extractResourcePathName = function(resourceUri) {
      var pathSegments, segment;
      pathSegments = resourceUri.split(/\//);
      while (segment = pathSegments.pop()) {
        if (!(typeof segment !== "undefined" && segment !== null ? segment.match(/[{}]/) : void 0)) {
          return segment;
        }
      }
      return "";
    };

    return Traits;

  })();

}).call(this);

},{"./errors":3,"./nodes":7,"./util":20,"pluralize":96}],18:[function(require,module,exports){
(function() {
  var nodes, uritemplate, util,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  uritemplate = require('uritemplate');

  nodes = require('./nodes');

  util = require('./util');

  /*
     Applies transformations to the USL
  */


  this.Transformations = (function() {
    function Transformations(settings) {
      this.settings = settings;
      this.apply_default_media_type_to_resource = __bind(this.apply_default_media_type_to_resource, this);
      this.get_media_type = __bind(this.get_media_type, this);
      this.load_default_media_type = __bind(this.load_default_media_type, this);
      this.applyAstTransformations = __bind(this.applyAstTransformations, this);
      this.applyTransformations = __bind(this.applyTransformations, this);
      this.declaredSchemas = {};
    }

    Transformations.prototype.applyTransformations = function(rootObject) {
      var resources;
      if (this.settings.transform) {
        this.applyTransformationsToRoot(rootObject);
        resources = rootObject.resources;
        return this.applyTransformationsToResources(rootObject, resources);
      }
    };

    Transformations.prototype.applyAstTransformations = function(document) {
      if (this.settings.transform) {
        return this.transform_document(document);
      }
    };

    Transformations.prototype.load_default_media_type = function(node) {
      if (!util.isMapping(node || (node != null ? node.value : void 0))) {
        return;
      }
      return this.mediaType = this.property_value(node, 'mediaType');
    };

    Transformations.prototype.get_media_type = function() {
      return this.mediaType;
    };

    Transformations.prototype.applyTransformationsToRoot = function(rootObject) {
      var expressions, template;
      if (rootObject.baseUri) {
        template = uritemplate.parse(rootObject.baseUri);
        expressions = template.expressions.filter(function(expr) {
          return 'templateText' in expr;
        }).map(function(expression) {
          return expression.templateText;
        });
        if (expressions.length) {
          if (!rootObject.baseUriParameters) {
            rootObject.baseUriParameters = {};
          }
        }
        return expressions.forEach(function(parameterName) {
          if (!(parameterName in rootObject.baseUriParameters)) {
            rootObject.baseUriParameters[parameterName] = {
              type: "string",
              required: true,
              displayName: parameterName
            };
            if (parameterName === "version") {
              return rootObject.baseUriParameters[parameterName]["enum"] = [rootObject.version];
            }
          }
        });
      }
    };

    Transformations.prototype.applyTransformationsToResources = function(rootObject, resources) {
      var expressions, inheritedSecScheme, method, parameterName, pathParts, resource, template, _i, _j, _k, _len, _len1, _len2, _ref, _ref1, _results;
      if (resources != null ? resources.length : void 0) {
        _results = [];
        for (_i = 0, _len = resources.length; _i < _len; _i++) {
          resource = resources[_i];
          inheritedSecScheme = resource.securedBy ? resource.securedBy : rootObject != null ? rootObject.securedBy : void 0;
          if ((_ref = resource.methods) != null ? _ref.length : void 0) {
            _ref1 = resource.methods;
            for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
              method = _ref1[_j];
              if (!("securedBy" in method)) {
                if (inheritedSecScheme) {
                  method.securedBy = inheritedSecScheme;
                }
              }
            }
          }
          pathParts = resource.relativeUri.split('\/');
          while (!pathParts[0] && pathParts.length) {
            pathParts.shift();
          }
          resource.relativeUriPathSegments = pathParts;
          template = uritemplate.parse(resource.relativeUri);
          expressions = template.expressions.filter(function(expr) {
            return 'templateText' in expr;
          }).map(function(expression) {
            return expression.templateText;
          });
          if (expressions.length) {
            if (!resource.uriParameters) {
              resource.uriParameters = {};
            }
          }
          for (_k = 0, _len2 = expressions.length; _k < _len2; _k++) {
            parameterName = expressions[_k];
            if (!(parameterName in resource.uriParameters)) {
              resource.uriParameters[parameterName] = {
                type: "string",
                required: true,
                displayName: parameterName
              };
            }
          }
          _results.push(this.applyTransformationsToResources(rootObject, resource.resources));
        }
        return _results;
      }
    };

    /*
    Media Type pivot when using default mediaType property
    */


    Transformations.prototype.apply_default_media_type_to_resource = function(resource) {
      var childResource, method, _i, _j, _len, _len1, _ref, _ref1, _results;
      if (!this.mediaType) {
        return;
      }
      if (!util.isMapping(resource)) {
        return;
      }
      _ref = this.child_resources(resource);
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        childResource = _ref[_i];
        this.apply_default_media_type_to_resource(childResource[1]);
      }
      _ref1 = this.child_methods(resource);
      _results = [];
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        method = _ref1[_j];
        _results.push(this.apply_default_media_type_to_method(method[1]));
      }
      return _results;
    };

    Transformations.prototype.apply_default_media_type_to_method = function(method) {
      var responses,
        _this = this;
      if (!this.mediaType) {
        return;
      }
      if (!util.isMapping(method)) {
        return;
      }
      if (this.has_property(method, 'body')) {
        this.apply_default_media_type_to_body(this.get_property_pair(method, 'body'));
      }
      if (this.has_property(method, 'responses')) {
        responses = this.get_property(method, 'responses');
        if (!(responses && responses.value)) {
          return;
        }
        return responses.value.forEach(function(response) {
          if (_this.has_property(response[1], 'body')) {
            return _this.apply_default_media_type_to_body(_this.get_property_pair(response[1], 'body'));
          }
        });
      }
    };

    Transformations.prototype.apply_default_media_type_to_body = function(body) {
      var key, responseType, responseTypeKey, _ref, _ref1, _ref2, _ref3;
      if (util.isNull(body[1])) {
        body[1] = new nodes.MappingNode('tag:yaml.org,2002:map', []);
      }
      if ((_ref = body[1]) != null ? (_ref1 = _ref.value) != null ? (_ref2 = _ref1[0]) != null ? (_ref3 = _ref2[0]) != null ? _ref3.value : void 0 : void 0 : void 0 : void 0) {
        key = body[1].value[0][0].value;
        if (!key.match(/\//)) {
          responseType = new nodes.MappingNode('tag:yaml.org,2002:map', [], body[1].start_mark, body[1].end_mark);
          responseTypeKey = new nodes.ScalarNode('tag:yaml.org,2002:str', this.mediaType, body[1].start_mark, body[1].end_mark);
          responseType.value.push([responseTypeKey, body[1].clone()]);
          return body[1].value = responseType.value;
        }
      } else {
        return body[1].value.push([new nodes.ScalarNode('tag:yaml.org,2002:str', this.mediaType), new nodes.ScalarNode('tag:yaml.org,2002:null')]);
      }
    };

    Transformations.prototype.noop = function() {};

    Transformations.prototype.transform_types = function(typeProperty) {
      var types,
        _this = this;
      types = typeProperty.value;
      return types.forEach(function(type_entry) {
        return type_entry.value.forEach(function(type) {
          return _this.transform_resource(type, true);
        });
      });
    };

    Transformations.prototype.transform_traits = function(traitProperty) {
      var traits,
        _this = this;
      traits = traitProperty.value;
      return traits.forEach(function(trait_entry) {
        return trait_entry.value.forEach(function(trait) {
          return _this.transform_method(trait[1], true);
        });
      });
    };

    Transformations.prototype.transform_named_params = function(property, allowParameterKeys, requiredByDefault) {
      var _this = this;
      if (requiredByDefault == null) {
        requiredByDefault = true;
      }
      if (util.isNull(property[1])) {
        return;
      }
      return property[1].value.forEach(function(param) {
        if (util.isNull(param[1])) {
          param[1] = new nodes.MappingNode('tag:yaml.org,2002:map', [], param[1].start_mark, param[1].end_mark);
        }
        return _this.transform_common_parameter_properties(param[0].value, param[1], allowParameterKeys, requiredByDefault);
      });
    };

    Transformations.prototype.transform_common_parameter_properties = function(parameterName, node, allowParameterKeys, requiredByDefault) {
      var _this = this;
      if (util.isSequence(node)) {
        return node.value.forEach(function(parameter) {
          return _this.transform_named_parameter(parameterName, parameter, allowParameterKeys, requiredByDefault);
        });
      } else {
        return this.transform_named_parameter(parameterName, node, allowParameterKeys, requiredByDefault);
      }
    };

    Transformations.prototype.transform_named_parameter = function(parameterName, node, allowParameterKeys, requiredByDefault) {
      var hasDisplayName, hasRequired, hasType,
        _this = this;
      hasDisplayName = false;
      hasRequired = false;
      hasType = false;
      node.value.forEach(function(childNode) {
        var canonicalPropertyName;
        if (allowParameterKeys && _this.isParameterKey(childNode)) {
          return;
        }
        canonicalPropertyName = _this.canonicalizePropertyName(childNode[0].value, allowParameterKeys);
        switch (canonicalPropertyName) {
          case "pattern":
            return _this.noop();
          case "default":
            return _this.noop();
          case "enum":
            return _this.noop();
          case "description":
            return _this.noop();
          case "example":
            return _this.noop();
          case "minLength":
            return _this.noop();
          case "maxLength":
            return _this.noop();
          case "minimum":
            return _this.noop();
          case "maximum":
            return _this.noop();
          case "repeat":
            return _this.noop();
          case "displayName":
            return hasDisplayName = true;
          case "type":
            return hasType = true;
          case "required":
            return hasRequired = true;
          default:
            return _this.noop();
        }
      });
      if (!hasDisplayName) {
        this.add_key_value_to_node(node, 'displayName', 'tag:yaml.org,2002:str', this.canonicalizePropertyName(parameterName, allowParameterKeys));
      }
      if (!hasRequired) {
        if (requiredByDefault) {
          this.add_key_value_to_node(node, 'required', 'tag:yaml.org,2002:bool', 'true');
        }
      }
      if (!hasType) {
        return this.add_key_value_to_node(node, 'type', 'tag:yaml.org,2002:str', 'string');
      }
    };

    Transformations.prototype.add_key_value_to_node = function(node, keyName, valueTag, value) {
      var propertyName, propertyValue;
      propertyName = new nodes.ScalarNode('tag:yaml.org,2002:str', keyName, node.start_mark, node.end_mark);
      propertyValue = new nodes.ScalarNode(valueTag, value, node.start_mark, node.end_mark);
      return node.value.push([propertyName, propertyValue]);
    };

    Transformations.prototype.transform_document = function(node) {
      var _this = this;
      if (node != null ? node.value : void 0) {
        return node.value.forEach(function(property) {
          var _ref;
          switch (property[0].value) {
            case "title":
              return _this.noop();
            case "securitySchemes":
              return _this.noop();
            case "schemas":
              return _this.noop();
            case "version":
              return _this.noop();
            case "documentation":
              return _this.noop();
            case "mediaType":
              return _this.noop();
            case "securedBy":
              return _this.noop();
            case "baseUri":
              return _this.noop();
            case "traits":
              return _this.transform_traits(property[1]);
            case "baseUriParameters":
              return _this.transform_named_params(property, false);
            case "resourceTypes":
              return _this.transform_types(property[1]);
            case "resources":
              return (_ref = property[1]) != null ? _ref.value.forEach(function(resource) {
                return _this.transform_resource(resource);
              }) : void 0;
            default:
              return _this.noop();
          }
        });
      }
    };

    Transformations.prototype.transform_resource = function(resource, allowParameterKeys) {
      var _this = this;
      if (allowParameterKeys == null) {
        allowParameterKeys = false;
      }
      if (resource.value) {
        return resource.value.forEach(function(property) {
          var canonicalKey, isKnownCommonProperty, _ref, _ref1;
          isKnownCommonProperty = _this.transform_common_properties(property, allowParameterKeys);
          if (!isKnownCommonProperty) {
            if (_this.isHttpMethod(property[0].value, allowParameterKeys)) {
              return _this.transform_method(property[1], allowParameterKeys);
            } else {
              canonicalKey = _this.canonicalizePropertyName(property[0].value, allowParameterKeys);
              switch (canonicalKey) {
                case "type":
                  return _this.noop();
                case "usage":
                  return _this.noop();
                case "securedBy":
                  return _this.noop();
                case "uriParameters":
                  return _this.transform_named_params(property, allowParameterKeys);
                case "baseUriParameters":
                  return _this.transform_named_params(property, allowParameterKeys);
                case "resources":
                  return (_ref = property[1]) != null ? _ref.value.forEach(function(resource) {
                    return _this.transform_resource(resource);
                  }) : void 0;
                case "methods":
                  return (_ref1 = property[1]) != null ? _ref1.value.forEach(function(method) {
                    return _this.transform_method(method, allowParameterKeys);
                  }) : void 0;
                default:
                  return _this.noop();
              }
            }
          }
        });
      }
    };

    Transformations.prototype.transform_method = function(method, allowParameterKeys) {
      var _this = this;
      if (util.isNull(method)) {
        return;
      }
      return method.value.forEach(function(property) {
        var canonicalKey;
        if (_this.transform_common_properties(property, allowParameterKeys)) {
          return;
        }
        canonicalKey = _this.canonicalizePropertyName(property[0].value, allowParameterKeys);
        switch (canonicalKey) {
          case "securedBy":
            return _this.noop();
          case "usage":
            return _this.noop();
          case "headers":
            return _this.transform_named_params(property, allowParameterKeys, false);
          case "queryParameters":
            return _this.transform_named_params(property, allowParameterKeys, false);
          case "baseUriParameters":
            return _this.transform_named_params(property, allowParameterKeys);
          case "body":
            return _this.transform_body(property, allowParameterKeys);
          case "responses":
            return _this.transform_responses(property, allowParameterKeys);
          default:
            return _this.noop();
        }
      });
    };

    Transformations.prototype.transform_responses = function(responses, allowParameterKeys) {
      var _this = this;
      if (util.isNull(responses[1])) {
        return;
      }
      return responses[1].value.forEach(function(response) {
        return _this.transform_response(response, allowParameterKeys);
      });
    };

    Transformations.prototype.transform_response = function(response, allowParameterKeys) {
      var _this = this;
      if (util.isMapping(response[1])) {
        return response[1].value.forEach(function(property) {
          var canonicalKey;
          canonicalKey = _this.canonicalizePropertyName(property[0].value, allowParameterKeys);
          switch (canonicalKey) {
            case "description":
              return _this.noop();
            case "body":
              return _this.transform_body(property, allowParameterKeys);
            case "headers":
              return _this.transform_named_params(property, allowParameterKeys, false);
            default:
              return _this.noop();
          }
        });
      }
    };

    Transformations.prototype.isContentTypeString = function(value) {
      return value != null ? value.match(/^[^\/]+\/[^\/]+$/) : void 0;
    };

    Transformations.prototype.transform_body = function(property, allowParameterKeys) {
      var _ref,
        _this = this;
      if (util.isNull(property[1])) {
        return;
      }
      return (_ref = property[1].value) != null ? _ref.forEach(function(bodyProperty) {
        var canonicalProperty;
        if (_this.isParameterKey(bodyProperty)) {
          return _this.noop();
        } else if (_this.isContentTypeString(bodyProperty[0].value)) {
          return _this.transform_body(bodyProperty, allowParameterKeys);
        } else {
          canonicalProperty = _this.canonicalizePropertyName(bodyProperty[0].value, allowParameterKeys);
          switch (canonicalProperty) {
            case "example":
              return _this.noop();
            case "schema":
              return _this.noop();
            case "formParameters":
              return _this.transform_named_params(bodyProperty, allowParameterKeys, false);
            default:
              return _this.noop();
          }
        }
      }) : void 0;
    };

    Transformations.prototype.transform_common_properties = function(property, allowParameterKeys) {
      var canonicalProperty;
      if (this.isParameterKey(property)) {
        return true;
      } else {
        canonicalProperty = this.canonicalizePropertyName(property[0].value, allowParameterKeys);
        switch (canonicalProperty) {
          case "displayName":
            return true;
          case "description":
            return true;
          case "is":
            return true;
          default:
            this.noop();
        }
      }
      return false;
    };

    return Transformations;

  })();

}).call(this);

},{"./nodes":7,"./util":20,"uritemplate":120}],19:[function(require,module,exports){
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

},{"./errors":3,"./loader":6,"./nodes":7,"./util":20,"fs":24,"got":23,"json-schema-ref-parser":73,"path":95,"q":100,"url":121}],20:[function(require,module,exports){
(function() {
  var objectAssign,
    __slice = [].slice,
    __hasProp = {}.hasOwnProperty;

  objectAssign = require('object-assign');

  this.extend = function() {
    var destination, k, source, sources, v, _i, _len;
    destination = arguments[0], sources = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    for (_i = 0, _len = sources.length; _i < _len; _i++) {
      source = sources[_i];
      for (k in source) {
        v = source[k];
        destination[k] = v;
      }
    }
    return destination;
  };

  this.is_empty = function(obj) {
    var key;
    if (Array.isArray(obj) || typeof obj === 'string') {
      return obj.length === 0;
    }
    for (key in obj) {
      if (!__hasProp.call(obj, key)) continue;
      return false;
    }
    return true;
  };

  this.isNoop = function(node) {
    return node;
  };

  this.isMapping = function(node) {
    return (node != null ? node.tag : void 0) === "tag:yaml.org,2002:map";
  };

  this.isNull = function(node) {
    return (node != null ? node.tag : void 0) === "tag:yaml.org,2002:null";
  };

  this.isSequence = function(node) {
    return (node != null ? node.tag : void 0) === "tag:yaml.org,2002:seq";
  };

  this.isString = function(node) {
    return (node != null ? node.tag : void 0) === "tag:yaml.org,2002:str";
  };

  this.isInteger = function(node) {
    return (node != null ? node.tag : void 0) === "tag:yaml.org,2002:int";
  };

  this.isNullableMapping = function(node) {
    return this.isMapping(node) || this.isNull(node);
  };

  this.isNullableString = function(node) {
    return this.isString(node) || this.isNull(node);
  };

  this.isNullableSequence = function(node) {
    return this.isSequence(node) || this.isNull(node);
  };

  this.isNumber = function(node) {
    return (node != null ? node.tag : void 0) === 'tag:yaml.org,2002:int' || (node != null ? node.tag : void 0) === 'tag:yaml.org,2002:float';
  };

  this.isScalar = function(node) {
    return (node != null ? node.tag : void 0) === 'tag:yaml.org,2002:null' || (node != null ? node.tag : void 0) === 'tag:yaml.org,2002:bool' || (node != null ? node.tag : void 0) === 'tag:yaml.org,2002:int' || (node != null ? node.tag : void 0) === 'tag:yaml.org,2002:float' || (node != null ? node.tag : void 0) === 'tag:yaml.org,2002:binary' || (node != null ? node.tag : void 0) === 'tag:yaml.org,2002:timestamp' || (node != null ? node.tag : void 0) === 'tag:yaml.org,2002:str';
  };

  this.isCollection = function(node) {
    return (node != null ? node.tag : void 0) === 'tag:yaml.org,2002:omap' || (node != null ? node.tag : void 0) === 'tag:yaml.org,2002:pairs' || (node != null ? node.tag : void 0) === 'tag:yaml.org,2002:set' || (node != null ? node.tag : void 0) === 'tag:yaml.org,2002:seq' || (node != null ? node.tag : void 0) === 'tag:yaml.org,2002:map';
  };

  this.NON_PRINTABLE = /[^\x09\x0A\x0D\x20-\x7E\x85\xA0-\uD7FF\uE000-\uFFFD]/;

  this.stringifyJSONCircularDepth = function(json, depth) {
    var cache;
    if (depth == null) {
      depth = 1000;
    }
    cache = {};
    return JSON.stringify(json, function(key, value) {
      if (typeof value === 'object' && value !== null) {
        if (cache[key] && cache[key].value === value && cache[key].repetitions > depth) {
          delete cache[key];
          return;
        }
        if (!cache[key]) {
          cache[key] = {
            value: value,
            repetitions: 0
          };
        }
        cache[key].repetitions++;
        if (Array.isArray(value)) {
          return value.slice();
        } else {
          return objectAssign({}, value);
        }
      }
      return value;
    });
  };

}).call(this);

},{"object-assign":93}],21:[function(require,module,exports){
(function() {
  var MarkedYAMLError, jju, nodes, traits, uritemplate, url, util, _ref,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  url = require('url');

  uritemplate = require('uritemplate');

  MarkedYAMLError = require('./errors').MarkedYAMLError;

  nodes = require('./nodes');

  traits = require('./traits');

  util = require('./util');

  jju = require('jju/lib/parse');

  /*
  The Validator throws these.
  */


  this.ValidationError = (function(_super) {
    __extends(ValidationError, _super);

    function ValidationError() {
      _ref = ValidationError.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    return ValidationError;

  })(MarkedYAMLError);

  /*
  A collection of multiple validation errors
  */


  this.ValidationErrors = (function(_super) {
    __extends(ValidationErrors, _super);

    function ValidationErrors(validation_errors) {
      this.validation_errors = validation_errors;
    }

    ValidationErrors.prototype.get_validation_errors = function() {
      return this.validation_errors;
    };

    return ValidationErrors;

  })(MarkedYAMLError);

  /*
  The Validator class deals with validating a YAML file according to the spec
  */


  this.Validator = (function() {
    function Validator() {
      this.get_properties = __bind(this.get_properties, this);
      this.validations = [this.validate_root, this.validate_root_properties, this.validate_base_uri_parameters, this.valid_absolute_uris];
    }

    Validator.prototype.validate_document = function(node) {
      var validation, _i, _len, _ref1;
      _ref1 = this.validations;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        validation = _ref1[_i];
        validation.call(this, node);
      }
      return true;
    };

    Validator.prototype.validate_security_schemes = function(schemesProperty) {
      var scheme, scheme_entry, _i, _len, _ref1, _results;
      if (!util.isSequence(schemesProperty)) {
        throw new exports.ValidationError('while validating securitySchemes', null, 'invalid security schemes property, it must be an array', schemesProperty.start_mark);
      }
      _ref1 = schemesProperty.value;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        scheme_entry = _ref1[_i];
        if (!util.isMapping(scheme_entry)) {
          throw new exports.ValidationError('while validating securitySchemes', null, 'invalid security scheme property, it must be a map', scheme_entry.start_mark);
        }
        _results.push((function() {
          var _j, _len1, _ref2, _results1;
          _ref2 = scheme_entry.value;
          _results1 = [];
          for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
            scheme = _ref2[_j];
            if (!util.isMapping(scheme[1])) {
              throw new exports.ValidationError('while validating securitySchemes', null, 'invalid security scheme property, it must be a map', scheme[0].start_mark);
            }
            _results1.push(this.validate_security_scheme(scheme[1]));
          }
          return _results1;
        }).call(this));
      }
      return _results;
    };

    Validator.prototype.trackRepeatedProperties = function(properties, key, property, section, errorMessage) {
      if (section == null) {
        section = "USL";
      }
      if (errorMessage == null) {
        errorMessage = "a property with the same name already exists";
      }
      if (key in properties) {
        throw new exports.ValidationError("while validating " + section, null, "" + errorMessage + ": '" + key + "'", property.start_mark);
      }
      return properties[key] = property;
    };

    Validator.prototype.validate_security_scheme = function(scheme) {
      var property, schemeProperties, settings, type, _i, _len, _ref1;
      type = null;
      settings = null;
      schemeProperties = {};
      _ref1 = scheme.value;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        property = _ref1[_i];
        this.trackRepeatedProperties(schemeProperties, property[0].value, property[0], 'while validating security scheme', "property already used in security scheme");
        switch (property[0].value) {
          case "description":
            if (!util.isScalar(property[1])) {
              throw new exports.ValidationError('while validating security scheme', null, 'schemes description must be a string', property[1].start_mark);
            }
            break;
          case "type":
            type = property[1].value;
            if (!(util.isString(property[1]) && type.match(/^(OAuth 1.0|OAuth 2.0|Basic Authentication|Digest Authentication|x-.+)$/))) {
              throw new exports.ValidationError('while validating security scheme', null, 'schemes type must be any of: "OAuth 1.0", "OAuth 2.0", "Basic Authentication", "Digest Authentication", "x-\{.+\}"', property[1].start_mark);
            }
            break;
          case "describedBy":
            this.validate_method(property, true, "security scheme");
            break;
          case "settings":
            settings = property;
            if (!util.isNullableMapping(property[1])) {
              throw new exports.ValidationError('while validating security scheme', null, 'schemes settings must be a map', property[1].start_mark);
            }
            break;
          default:
            throw new exports.ValidationError('while validating security scheme', null, "property: '" + property[0].value + "' is invalid in a security scheme", property[0].start_mark);
        }
      }
      if (!type) {
        throw new exports.ValidationError('while validating security scheme', null, 'schemes type must be any of: "OAuth 1.0", "OAuth 2.0", "Basic Authentication", "Digest Authentication", "x-\{.+\}"', scheme.start_mark);
      } else if (type === "OAuth 2.0") {
        if (!settings) {
          throw new exports.ValidationError('while validating security scheme', null, 'for OAuth 2.0 settings must be a map', scheme.start_mark);
        }
        return this.validate_oauth2_settings(settings);
      } else if (type === "OAuth 1.0") {
        if (!settings) {
          throw new exports.ValidationError('while validating security scheme', null, 'for OAuth 1.0 settings must be a map', scheme.start_mark);
        }
        return this.validate_oauth1_settings(settings);
      }
    };

    Validator.prototype.validate_oauth2_settings = function(settings) {
      var property, propertyName, settingProperties, _i, _j, _len, _len1, _ref1, _ref2, _results;
      settingProperties = {};
      _ref1 = settings[1].value;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        property = _ref1[_i];
        this.trackRepeatedProperties(settingProperties, property[0].value, property[0], 'while validating security scheme', "setting with the same name already exists");
        switch (property[0].value) {
          case "authorizationUri":
            if (!util.isString(property[1])) {
              throw new exports.ValidationError('while validating security scheme', null, 'authorizationUri must be a URL', property[0].start_mark);
            }
            break;
          case "accessTokenUri":
            if (!util.isString(property[1])) {
              throw new exports.ValidationError('while validating security scheme', null, 'accessTokenUri must be a URL', property[0].start_mark);
            }
        }
      }
      _ref2 = ['accessTokenUri', 'authorizationUri'];
      _results = [];
      for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
        propertyName = _ref2[_j];
        if (!(propertyName in settingProperties)) {
          throw new exports.ValidationError('while validating security scheme', null, "OAuth 2.0 settings must have " + propertyName + " property", settings[0].start_mark);
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    Validator.prototype.validate_oauth1_settings = function(settings) {
      var property, propertyName, settingProperties, _i, _j, _len, _len1, _ref1, _ref2, _results;
      settingProperties = {};
      _ref1 = settings[1].value;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        property = _ref1[_i];
        this.trackRepeatedProperties(settingProperties, property[0].value, property[0], 'while validating security scheme', "setting with the same name already exists");
        switch (property[0].value) {
          case "requestTokenUri":
            if (!util.isString(property[1])) {
              throw new exports.ValidationError('while validating security scheme', null, 'requestTokenUri must be a URL', property[0].start_mark);
            }
            break;
          case "authorizationUri":
            if (!util.isString(property[1])) {
              throw new exports.ValidationError('while validating security scheme', null, 'authorizationUri must be a URL', property[0].start_mark);
            }
            break;
          case "tokenCredentialsUri":
            if (!util.isString(property[1])) {
              throw new exports.ValidationError('while validating security scheme', null, 'tokenCredentialsUri must be a URL', property[0].start_mark);
            }
        }
      }
      _ref2 = ['requestTokenUri', 'authorizationUri', 'tokenCredentialsUri'];
      _results = [];
      for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
        propertyName = _ref2[_j];
        if (!(propertyName in settingProperties)) {
          throw new exports.ValidationError('while validating security scheme', null, "OAuth 1.0 settings must have " + propertyName + " property", settings[0].start_mark);
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    Validator.prototype.validate_root_schemas = function(schemas) {
      var schema, schemaList, schemaName, _results;
      if (!util.isSequence(schemas)) {
        throw new exports.ValidationError('while validating schemas', null, 'schemas property must be an array', schemas.start_mark);
      }
      schemaList = this.get_all_schemas();
      _results = [];
      for (schemaName in schemaList) {
        schema = schemaList[schemaName];
        if (!(schema[1].tag && util.isString(schema[1]))) {
          throw new exports.ValidationError('while validating schemas', null, 'schema ' + schemaName + ' must be a string', schema[0].start_mark);
        }
        _results.push(this.validateSchema(schema[1]));
      }
      return _results;
    };

    Validator.prototype.validate_root = function(node) {
      if (!(node || util.isNull(node))) {
        throw new exports.ValidationError('while validating root', null, 'empty document', node != null ? node.start_mark : void 0);
      }
      if (!util.isMapping(node)) {
        throw new exports.ValidationError('while validating root', null, 'document must be a map', node.start_mark);
      }
    };

    Validator.prototype.validate_base_uri_parameters = function() {
      if (!this.baseUriParameters) {
        return;
      }
      if (!this.baseUri) {
        throw new exports.ValidationError('while validating uri parameters', null, 'uri parameters defined when there is no baseUri', this.baseUriParameters.start_mark);
      }
      if (!util.isNullableMapping(this.baseUriParameters)) {
        throw new exports.ValidationError('while validating uri parameters', null, 'base uri parameters must be a map', this.baseUriParameters.start_mark);
      }
      return this.validate_uri_parameters(this.baseUri, this.baseUriParameters, false, false, ["version"]);
    };

    Validator.prototype.validate_uri_parameters = function(uri, uriProperty, allowParameterKeys, skipParameterUseCheck, reservedNames) {
      var err, expressions, parameterName, template, uriParameter, uriParameters, _i, _len, _ref1, _ref2, _results;
      if (reservedNames == null) {
        reservedNames = [];
      }
      try {
        template = uritemplate.parse(uri);
      } catch (_error) {
        err = _error;
        throw new exports.ValidationError('while validating uri parameters', null, err != null ? (_ref1 = err.options) != null ? _ref1.message : void 0 : void 0, uriProperty.start_mark);
      }
      expressions = template.expressions.filter(function(expr) {
        return "templateText" in expr;
      }).map(function(expression) {
        return expression.templateText;
      });
      uriParameters = {};
      if (typeof uriProperty.value === "object") {
        _ref2 = uriProperty.value;
        _results = [];
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          uriParameter = _ref2[_i];
          parameterName = this.canonicalizePropertyName(uriParameter[0].value, allowParameterKeys);
          this.trackRepeatedProperties(uriParameters, parameterName, uriProperty, 'while validating URI parameters', "URI parameter with the same name already exists");
          if (__indexOf.call(reservedNames, parameterName) >= 0) {
            throw new exports.ValidationError('while validating baseUri', null, uriParameter[0].value + ' parameter not allowed here', uriParameter[0].start_mark);
          }
          if (!(util.isNullableMapping(uriParameter[1], allowParameterKeys) || util.isNullableSequence(uriParameter[1], allowParameterKeys))) {
            throw new exports.ValidationError('while validating baseUri', null, 'URI parameter must be a map', uriParameter[0].start_mark);
          }
          if (!util.isNull(uriParameter[1])) {
            this.valid_common_parameter_properties(uriParameter[1], allowParameterKeys);
          }
          if (!(skipParameterUseCheck || this.isParameterKey(uriParameter) || __indexOf.call(expressions, parameterName) >= 0)) {
            throw new exports.ValidationError('while validating baseUri', null, uriParameter[0].value + ' uri parameter unused', uriParameter[0].start_mark);
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      }
    };

    Validator.prototype.validate_types = function(typeProperty) {
      var type, type_entry, types, _i, _len, _results;
      types = typeProperty.value;
      if (!util.isSequence(typeProperty)) {
        throw new exports.ValidationError('while validating resource types', null, 'invalid resourceTypes definition, it must be an array', typeProperty.start_mark);
      }
      _results = [];
      for (_i = 0, _len = types.length; _i < _len; _i++) {
        type_entry = types[_i];
        if (!util.isMapping(type_entry)) {
          throw new exports.ValidationError('while validating resource types', null, 'invalid resourceType definition, it must be a map', type_entry.start_mark);
        }
        _results.push((function() {
          var _j, _len1, _ref1, _results1;
          _ref1 = type_entry.value;
          _results1 = [];
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            type = _ref1[_j];
            if (this.isParameterKey(type)) {
              throw new exports.ValidationError('while validating resource types', null, 'parameter key cannot be used as a resource type name', type[0].start_mark);
            }
            if (!util.isMapping(type[1])) {
              throw new exports.ValidationError('while validating resource types', null, 'invalid resourceType definition, it must be a map', type[1].start_mark);
            }
            _results1.push(this.validate_resource(type, true, 'resource type'));
          }
          return _results1;
        }).call(this));
      }
      return _results;
    };

    Validator.prototype.validate_traits = function(traitProperty) {
      var trait, trait_entry, _i, _len, _results;
      traits = traitProperty.value;
      if (!Array.isArray(traits)) {
        throw new exports.ValidationError('while validating traits', null, 'invalid traits definition, it must be an array', traitProperty.start_mark);
      }
      _results = [];
      for (_i = 0, _len = traits.length; _i < _len; _i++) {
        trait_entry = traits[_i];
        if (!Array.isArray(trait_entry.value)) {
          throw new exports.ValidationError('while validating traits', null, 'invalid traits definition, it must be an array', traitProperty.start_mark);
        }
        _results.push((function() {
          var _j, _len1, _ref1, _results1;
          _ref1 = trait_entry.value;
          _results1 = [];
          for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
            trait = _ref1[_j];
            if (this.isParameterKey(trait)) {
              throw new exports.ValidationError('while validating traits', null, 'parameter key cannot be used as a trait name', trait[0].start_mark);
            }
            if (!util.isMapping(trait[1])) {
              throw new exports.ValidationError('while validating traits', null, 'invalid trait definition, it must be a map', trait[1].start_mark);
            }
            _results1.push(this.valid_traits_properties(trait));
          }
          return _results1;
        }).call(this));
      }
      return _results;
    };

    Validator.prototype.valid_traits_properties = function(node) {
      var invalid;
      if (!node[1].value) {
        return;
      }
      if (!util.isMapping(node[1])) {
        return;
      }
      invalid = node[1].value.filter(function(childNode) {
        return childNode[0].value === "is" || childNode[0].value === "type";
      });
      if (invalid.length > 0) {
        throw new exports.ValidationError('while validating trait properties', null, "property: '" + invalid[0][0].value + "' is invalid in a trait", invalid[0][0].start_mark);
      }
      return this.validate_method(node, true, 'trait');
    };

    Validator.prototype.canonicalizePropertyName = function(propertyName, mustRemoveQuestionMark) {
      if (mustRemoveQuestionMark && propertyName.slice(-1) === '?') {
        return propertyName.slice(0, -1);
      }
      return propertyName;
    };

    Validator.prototype.valid_common_parameter_properties = function(node, allowParameterKeys) {
      var parameter, _i, _len, _ref1, _results;
      if (!node.value) {
        return;
      }
      if (util.isSequence(node)) {
        if (node.value.length === 0) {
          throw new exports.ValidationError('while validating parameter properties', null, 'named parameter needs at least one type', node.start_mark);
        }
        if (!(node.value.length > 1)) {
          throw new exports.ValidationError('while validating parameter properties', null, 'single type for variably typed parameter', node.start_mark);
        }
        _ref1 = node.value;
        _results = [];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          parameter = _ref1[_i];
          _results.push(this.validate_named_parameter(parameter, allowParameterKeys));
        }
        return _results;
      } else {
        return this.validate_named_parameter(node, allowParameterKeys);
      }
    };

    Validator.prototype.validate_named_parameter = function(node, allowParameterKeys) {
      var booleanValues, canonicalPropertyName, childNode, enumValues, parameterProperties, parameterType, propertyName, propertyValue, unusableProperty, valid, validTypes, _i, _j, _k, _len, _len1, _len2, _ref1, _ref2, _ref3, _results;
      parameterProperties = {};
      parameterType = "string";
      _ref1 = node.value;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        childNode = _ref1[_i];
        propertyName = childNode[0].value;
        propertyValue = childNode[1].value;
        this.trackRepeatedProperties(parameterProperties, this.canonicalizePropertyName(childNode[0].value, true), childNode[0], 'while validating parameter properties', "parameter property already used");
        booleanValues = ["true", "false"];
        if (allowParameterKeys) {
          if (this.isParameterKey(childNode) || this.isParameterValue(childNode)) {
            continue;
          }
        }
        canonicalPropertyName = this.canonicalizePropertyName(propertyName, allowParameterKeys);
        valid = true;
        switch (propertyName) {
          case "displayName":
            if (!util.isScalar(childNode[1])) {
              throw new exports.ValidationError('while validating parameter properties', null, 'the value of displayName must be a scalar', childNode[1].start_mark);
            }
            break;
          case "pattern":
            if (!util.isScalar(childNode[1])) {
              throw new exports.ValidationError('while validating parameter properties', null, 'the value of pattern must be a scalar', childNode[1].start_mark);
            }
            break;
          case "default":
            if (!util.isScalar(childNode[1])) {
              throw new exports.ValidationError('while validating parameter properties', null, 'the value of default must be a scalar', childNode[1].start_mark);
            }
            break;
          case "description":
            if (!util.isScalar(childNode[1])) {
              throw new exports.ValidationError('while validating parameter properties', null, 'the value of description must be a scalar', childNode[1].start_mark);
            }
            break;
          case "example":
            if (!util.isScalar(childNode[1])) {
              throw new exports.ValidationError('while validating parameter properties', null, 'the value of example must be a scalar', childNode[1].start_mark);
            }
            break;
          case "minLength":
            if (isNaN(propertyValue)) {
              throw new exports.ValidationError('while validating parameter properties', null, 'the value of minLength must be a number', childNode[1].start_mark);
            }
            break;
          case "maxLength":
            if (isNaN(propertyValue)) {
              throw new exports.ValidationError('while validating parameter properties', null, 'the value of maxLength must be a number', childNode[1].start_mark);
            }
            break;
          case "minimum":
            if (isNaN(propertyValue)) {
              throw new exports.ValidationError('while validating parameter properties', null, 'the value of minimum must be a number', childNode[1].start_mark);
            }
            break;
          case "maximum":
            if (isNaN(propertyValue)) {
              throw new exports.ValidationError('while validating parameter properties', null, 'the value of maximum must be a number', childNode[1].start_mark);
            }
            break;
          case "type":
            parameterType = propertyValue;
            validTypes = ['string', 'number', 'integer', 'date', 'boolean', 'file'];
            if (__indexOf.call(validTypes, propertyValue) < 0) {
              throw new exports.ValidationError('while validating parameter properties', null, 'type can be either of: string, number, integer, file, date or boolean ', childNode[1].start_mark);
            }
            break;
          case "required":
            if (__indexOf.call(booleanValues, propertyValue) < 0) {
              throw new exports.ValidationError('while validating parameter properties', null, 'required can be any either true or false', childNode[1].start_mark);
            }
            break;
          case "repeat":
            if (__indexOf.call(booleanValues, propertyValue) < 0) {
              throw new exports.ValidationError('while validating parameter properties', null, 'repeat can be any either true or false', childNode[1].start_mark);
            }
            break;
          default:
            valid = false;
        }
        switch (canonicalPropertyName) {
          case "enum":
            if (!util.isNullableSequence(childNode[1])) {
              throw new exports.ValidationError('while validating parameter properties', null, 'the value of enum must be an array', childNode[1].start_mark);
            }
            if (!childNode[1].value.length) {
              throw new exports.ValidationError('while validating parameter properties', null, 'enum is empty', childNode[1].start_mark);
            }
            enumValues = this.get_list_values(childNode[1].value);
            if (this.hasDuplicates(enumValues)) {
              throw new exports.ValidationError('while validating parameter properties', null, 'enum contains duplicated values', childNode[1].start_mark);
            }
            break;
          default:
            if (!valid) {
              throw new exports.ValidationError('while validating parameter properties', null, "unknown property " + propertyName, childNode[0].start_mark);
            }
        }
      }
      if (parameterType !== "string") {
        _ref2 = ['enum', 'pattern', 'minLength', 'maxLength'];
        for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
          unusableProperty = _ref2[_j];
          if (unusableProperty in parameterProperties) {
            throw new exports.ValidationError('while validating parameter properties', null, "property " + unusableProperty + " can only be used if type is 'string'", parameterProperties[unusableProperty].start_mark);
          }
        }
      }
      if (!(parameterType === "number" || parameterType === "integer")) {
        _ref3 = ['minimum', 'maximum'];
        _results = [];
        for (_k = 0, _len2 = _ref3.length; _k < _len2; _k++) {
          unusableProperty = _ref3[_k];
          if (unusableProperty in parameterProperties) {
            throw new exports.ValidationError('while validating parameter properties', null, "property " + unusableProperty + " can only be used if type is 'number' or 'integer'", parameterProperties[unusableProperty].start_mark);
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      }
    };

    Validator.prototype.get_list_values = function(node) {
      return node.map(function(item) {
        return item.value;
      });
    };

    Validator.prototype.validate_root_properties = function(node) {
      var checkVersion, property, rootProperties, _i, _len, _ref1;
      checkVersion = false;
      rootProperties = {};
      if (node != null ? node.value : void 0) {
        _ref1 = node.value;
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          property = _ref1[_i];
          if (property[0].value.match(/^\//)) {
            this.trackRepeatedProperties(rootProperties, this.canonicalizePropertyName(property[0].value, true), property[0], 'while validating root properties', "resource already declared");
          } else {
            this.trackRepeatedProperties(rootProperties, property[0].value, property[0], 'while validating root properties', 'root property already used');
          }
          switch (property[0].value) {
            case 'title':
              if (!util.isScalar(property[1])) {
                throw new exports.ValidationError('while validating root properties', null, 'title must be a string', property[0].start_mark);
              }
              break;
            case 'baseUri':
              if (!util.isScalar(property[1])) {
                throw new exports.ValidationError('while validating root properties', null, 'baseUri must be a string', property[0].start_mark);
              }
              this.baseUri = property[1].value;
              checkVersion = this.validate_base_uri(property[1]);
              break;
            case 'securitySchemes':
              this.validate_security_schemes(property[1]);
              break;
            case 'schemas':
              this.validate_root_schemas(property[1]);
              break;
            case 'version':
              if (!util.isScalar(property[1])) {
                throw new exports.ValidationError('while validating root properties', null, 'version must be a string', property[0].start_mark);
              }
              if (!util.isNull(property[1])) {
                property[1].tag = 'tag:yaml.org,2002:str';
              }
              break;
            case 'traits':
              this.validate_traits(property[1]);
              break;
            case 'documentation':
              if (!util.isSequence(property[1])) {
                throw new exports.ValidationError('while validating root properties', null, 'documentation must be an array', property[0].start_mark);
              }
              this.validate_documentation(property[1]);
              break;
            case 'mediaType':
              if (!util.isString(property[1])) {
                throw new exports.ValidationError('while validating root properties', null, 'mediaType must be a scalar', property[0].start_mark);
              }
              break;
            case 'baseUriParameters':
              this.baseUriParameters = property[1];
              util.isNoop(property[1]);
              break;
            case 'resourceTypes':
              this.validate_types(property[1]);
              break;
            case 'securedBy':
              this.validate_secured_by(property);
              break;
            case 'protocols':
              this.validate_protocols_property(property);
              break;
            default:
              if (property[0].value.match(/^\//)) {
                this.validate_resource(property);
              } else {
                throw new exports.ValidationError('while validating root properties', null, "unknown property " + property[0].value, property[0].start_mark);
              }
          }
        }
      }
      if (!('title' in rootProperties)) {
        throw new exports.ValidationError('while validating root properties', null, 'missing title', node.start_mark);
      }
      if (checkVersion && !('version' in rootProperties)) {
        throw new exports.ValidationError('while validating version', null, 'missing version', node.start_mark);
      }
    };

    Validator.prototype.validate_documentation = function(documentation_property) {
      var docSection, _i, _len, _ref1, _results;
      if (!documentation_property.value.length) {
        throw new exports.ValidationError('while validating documentation section', null, 'there must be at least one document in the documentation section', documentation_property.start_mark);
      }
      _ref1 = documentation_property.value;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        docSection = _ref1[_i];
        _results.push(this.validate_doc_section(docSection));
      }
      return _results;
    };

    Validator.prototype.validate_doc_section = function(docSection) {
      var docProperties, property, _i, _len, _ref1;
      if (!util.isMapping(docSection)) {
        throw new exports.ValidationError('while validating documentation section', null, 'each documentation section must be a map', docSection.start_mark);
      }
      docProperties = {};
      _ref1 = docSection.value;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        property = _ref1[_i];
        this.trackRepeatedProperties(docProperties, property[0].value, property[0], 'while validating documentation section', "property already used");
        switch (property[0].value) {
          case "title":
            if (!(util.isScalar(property[1]) && !util.isNull(property[1]))) {
              throw new exports.ValidationError('while validating documentation section', null, 'title must be a string', property[0].start_mark);
            }
            break;
          case "content":
            if (!(util.isScalar(property[1]) && !util.isNull(property[1]))) {
              throw new exports.ValidationError('while validating documentation section', null, 'content must be a string', property[0].start_mark);
            }
            break;
          default:
            throw new exports.ValidationError('while validating root properties', null, 'unknown property ' + property[0].value, property[0].start_mark);
        }
      }
      if (!("content" in docProperties)) {
        throw new exports.ValidationError('while validating documentation section', null, 'a documentation entry must have content property', docSection.start_mark);
      }
      if (!("title" in docProperties)) {
        throw new exports.ValidationError('while validating documentation section', null, 'a documentation entry must have title property', docSection.start_mark);
      }
    };

    Validator.prototype.child_resources = function(node) {
      if (node && util.isMapping(node)) {
        return node.value.filter(function(childNode) {
          return childNode[0].value.match(/^\//);
        });
      }
      return [];
    };

    Validator.prototype.validate_resource = function(resource, allowParameterKeys, context) {
      var canonicalKey, err, key, property, resourceProperties, template, valid, _i, _len, _ref1, _ref2, _results;
      if (allowParameterKeys == null) {
        allowParameterKeys = false;
      }
      if (context == null) {
        context = "resource";
      }
      if (!(resource[1] && util.isNullableMapping(resource[1]))) {
        throw new exports.ValidationError('while validating resources', null, 'resource is not a map', resource[1].start_mark);
      }
      if (resource[0].value) {
        try {
          template = uritemplate.parse(resource[0].value);
        } catch (_error) {
          err = _error;
          throw new exports.ValidationError('while validating resource', null, "Resource name is invalid: " + (err != null ? (_ref1 = err.options) != null ? _ref1.message : void 0 : void 0), resource[0].start_mark);
        }
      }
      if (util.isNull(resource[1])) {
        return;
      }
      if (resource[1].value) {
        resourceProperties = {};
        _ref2 = resource[1].value;
        _results = [];
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          property = _ref2[_i];
          if (property[0].value.match(/^\//)) {
            this.trackRepeatedProperties(resourceProperties, this.canonicalizePropertyName(property[0].value, true), property[0], 'while validating resource', "resource already declared");
          } else if (this.isHttpMethod(property[0].value, allowParameterKeys)) {
            this.trackRepeatedProperties(resourceProperties, this.canonicalizePropertyName(property[0].value, true), property[0], 'while validating resource', "method already declared");
          } else {
            this.trackRepeatedProperties(resourceProperties, this.canonicalizePropertyName(property[0].value, true), property[0], 'while validating resource', "property already used");
          }
          if (!this.validate_common_properties(property, allowParameterKeys)) {
            if (property[0].value.match(/^\//)) {
              if (allowParameterKeys) {
                throw new exports.ValidationError('while validating trait properties', null, 'resource type cannot define child resources', property[0].start_mark);
              }
              _results.push(this.validate_resource(property, allowParameterKeys));
            } else if (this.isHttpMethod(property[0].value, allowParameterKeys)) {
              _results.push(this.validate_method(property, allowParameterKeys, 'method'));
            } else {
              key = property[0].value;
              canonicalKey = this.canonicalizePropertyName(key, allowParameterKeys);
              valid = true;
              switch (canonicalKey) {
                case "uriParameters":
                  if (!util.isNullableMapping(property[1])) {
                    throw new exports.ValidationError('while validating uri parameters', null, 'uri parameters must be a map', property[0].start_mark);
                  }
                  this.validate_uri_parameters(resource[0].value, property[1], allowParameterKeys, allowParameterKeys);
                  break;
                case "baseUriParameters":
                  if (!this.baseUri) {
                    throw new exports.ValidationError('while validating uri parameters', null, 'base uri parameters defined when there is no baseUri', property[0].start_mark);
                  }
                  if (!util.isNullableMapping(property[1])) {
                    throw new exports.ValidationError('while validating uri parameters', null, 'base uri parameters must be a map', property[0].start_mark);
                  }
                  this.validate_uri_parameters(this.baseUri, property[1], allowParameterKeys);
                  break;
                default:
                  valid = false;
              }
              switch (key) {
                case "type":
                  _results.push(this.validate_type_property(property, allowParameterKeys));
                  break;
                case "usage":
                  if (!allowParameterKeys) {
                    throw new exports.ValidationError('while validating resources', null, "property: '" + property[0].value + "' is invalid in a resource", property[0].start_mark);
                  } else {
                    _results.push(void 0);
                  }
                  break;
                case "securedBy":
                  _results.push(this.validate_secured_by(property));
                  break;
                default:
                  if (!valid) {
                    throw new exports.ValidationError('while validating resources', null, "property: '" + property[0].value + ("' is invalid in a " + context), property[0].start_mark);
                  } else {
                    _results.push(void 0);
                  }
              }
            }
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      }
    };

    Validator.prototype.validate_secured_by = function(property) {
      var secScheme, secSchemes, securitySchemeName, _i, _len, _ref1, _results;
      if (!util.isSequence(property[1])) {
        throw new exports.ValidationError('while validating securityScheme', null, "property 'securedBy' must be an array", property[0].start_mark);
      }
      secSchemes = this.get_list_values(property[1].value);
      if (this.hasDuplicates(secSchemes)) {
        throw new exports.ValidationError('while validating securityScheme consumption', null, 'securitySchemes can only be referenced once in a securedBy property', property[0].start_mark);
      }
      _ref1 = property[1].value;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        secScheme = _ref1[_i];
        if (util.isSequence(secScheme)) {
          throw new exports.ValidationError('while validating securityScheme consumption', null, 'securityScheme reference cannot be an array', secScheme.start_mark);
        }
        if (!util.isNull(secScheme)) {
          securitySchemeName = this.key_or_value(secScheme);
          if (!this.get_security_scheme(securitySchemeName)) {
            throw new exports.ValidationError('while validating securityScheme consumption', null, 'there is no securityScheme named ' + securitySchemeName, secScheme.start_mark);
          } else {
            _results.push(void 0);
          }
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    Validator.prototype.validate_protocols_property = function(property) {
      var protocol, _i, _len, _ref1, _ref2, _results;
      if (!util.isSequence(property[1])) {
        throw new exports.ValidationError('while validating protocols', null, 'property must be an array', property[0].start_mark);
      }
      _ref1 = property[1].value;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        protocol = _ref1[_i];
        if (!util.isString(protocol)) {
          throw new exports.ValidationError('while validating protocols', null, 'value must be a string', protocol.start_mark);
        }
        if ((_ref2 = protocol.value) !== 'HTTP' && _ref2 !== 'HTTPS') {
          throw new exports.ValidationError('while validating protocols', null, 'only HTTP and HTTPS values are allowed', protocol.start_mark);
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    Validator.prototype.validate_type_property = function(property) {
      var parameter, typeName, _i, _len, _ref1, _results;
      if (!(util.isMapping(property[1]) || util.isString(property[1]))) {
        throw new exports.ValidationError('while validating resource types', null, "property 'type' must be a string or a map", property[0].start_mark);
      }
      if (util.isMapping(property[1])) {
        if (property[1].value.length > 1) {
          throw new exports.ValidationError('while validating resource types', null, 'a resource or resourceType can inherit from a single resourceType', property[0].start_mark);
        }
      }
      typeName = this.key_or_value(property[1]);
      if (!(typeName != null ? typeName.trim() : void 0)) {
        throw new exports.ValidationError('while validating resource type consumption', null, 'resource type name must be provided', property[1].start_mark);
      }
      if (!(this.isParameterKeyValue(typeName) || this.get_type(typeName))) {
        throw new exports.ValidationError('while validating resource type consumption', null, "there is no resource type named " + typeName, property[1].start_mark);
      }
      if (util.isMapping(property[1])) {
        _ref1 = property[1].value;
        _results = [];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          parameter = _ref1[_i];
          if (!(util.isNull(parameter[1]) || util.isMapping(parameter[1]))) {
            throw new exports.ValidationError('while validating resource consumption', null, 'resource type parameters must be in a map', parameter[1].start_mark);
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      }
    };

    Validator.prototype.validate_method = function(method, allowParameterKeys, context) {
      var canonicalKey, key, methodProperties, property, valid, _i, _len, _ref1, _results;
      if (context == null) {
        context = 'method';
      }
      if (util.isNull(method[1])) {
        return;
      }
      if (!util.isMapping(method[1])) {
        throw new exports.ValidationError('while validating methods', null, "method must be a map", method[0].start_mark);
      }
      methodProperties = {};
      _ref1 = method[1].value;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        property = _ref1[_i];
        this.trackRepeatedProperties(methodProperties, this.canonicalizePropertyName(property[0].value, true), property[0], 'while validating method', "property already used");
        if (this.validate_common_properties(property, allowParameterKeys, context)) {
          continue;
        }
        key = property[0].value;
        canonicalKey = this.canonicalizePropertyName(key, allowParameterKeys);
        valid = true;
        switch (canonicalKey) {
          case 'headers':
            this.validate_headers(property, allowParameterKeys);
            break;
          case 'queryParameters':
            this.validate_query_params(property, allowParameterKeys);
            break;
          case 'body':
            this.validate_body(property, allowParameterKeys, null, false);
            break;
          case 'responses':
            this.validate_responses(property, allowParameterKeys);
            break;
          case 'baseUriParameters':
            if (!this.baseUri) {
              throw new exports.ValidationError('while validating uri parameters', null, 'base uri parameters defined when there is no baseUri', property[0].start_mark);
            }
            if (!util.isNullableMapping(property[1])) {
              throw new exports.ValidationError('while validating uri parameters', null, 'base uri parameters must be a map', property[0].start_mark);
            }
            this.validate_uri_parameters(this.baseUri, property[1], allowParameterKeys);
            break;
          case 'protocols':
            this.validate_protocols_property(property);
            break;
          default:
            valid = false;
        }
        switch (key) {
          case 'securedBy':
            _results.push(this.validate_secured_by(property));
            break;
          case 'usage':
            if (!(allowParameterKeys && context === 'trait')) {
              throw new exports.ValidationError('while validating resources', null, "property: 'usage' is invalid in a " + context, property[0].start_mark);
            } else {
              _results.push(void 0);
            }
            break;
          default:
            if (!valid) {
              throw new exports.ValidationError('while validating resources', null, "property: '" + property[0].value + "' is invalid in a " + context, property[0].start_mark);
            } else {
              _results.push(void 0);
            }
        }
      }
      return _results;
    };

    Validator.prototype.validate_responses = function(responses, allowParameterKeys) {
      var response, responseValues, _i, _len, _ref1, _results;
      if (util.isNull(responses[1])) {
        return;
      }
      if (!util.isMapping(responses[1])) {
        throw new exports.ValidationError('while validating responses', null, "property: 'responses' must be a map", responses[0].start_mark);
      }
      responseValues = {};
      _ref1 = responses[1].value;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        response = _ref1[_i];
        if (!util.isNullableMapping(response[1])) {
          throw new exports.ValidationError('while validating responses', null, 'each response must be a map', response[1].start_mark);
        }
        this.trackRepeatedProperties(responseValues, this.canonicalizePropertyName(response[0].value, true), response[0], 'while validating responses', "response code already used");
        _results.push(this.validate_response(response, allowParameterKeys));
      }
      return _results;
    };

    Validator.prototype.validate_query_params = function(property, allowParameterKeys) {
      var param, queryParameters, _i, _len, _ref1, _results;
      if (util.isNull(property[1])) {
        return;
      }
      if (!util.isMapping(property[1])) {
        throw new exports.ValidationError('while validating query parameters', null, "property: 'queryParameters' must be a map", property[0].start_mark);
      }
      queryParameters = {};
      _ref1 = property[1].value;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        param = _ref1[_i];
        if (!(util.isNullableMapping(param[1]) || util.isNullableSequence(param[1]))) {
          throw new exports.ValidationError('while validating query parameters', null, "each query parameter must be a map", param[1].start_mark);
        }
        this.trackRepeatedProperties(queryParameters, this.canonicalizePropertyName(param[0].value, true), param[0], 'while validating query parameter', "parameter name already used");
        _results.push(this.valid_common_parameter_properties(param[1], allowParameterKeys));
      }
      return _results;
    };

    Validator.prototype.validate_form_params = function(property, allowParameterKeys) {
      var formParameters, param, _i, _len, _ref1, _results;
      if (util.isNull(property[1])) {
        return;
      }
      if (!util.isMapping(property[1])) {
        throw new exports.ValidationError('while validating query parameters', null, "property: 'formParameters' must be a map", property[0].start_mark);
      }
      formParameters = {};
      _ref1 = property[1].value;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        param = _ref1[_i];
        if (!(util.isNullableMapping(param[1]) || util.isNullableSequence(param[1]))) {
          throw new exports.ValidationError('while validating query parameters', null, 'each form parameter must be a map', param[1].start_mark);
        }
        this.trackRepeatedProperties(formParameters, this.canonicalizePropertyName(param[0].value, true), param[0], 'while validating form parameter', "parameter name already used");
        _results.push(this.valid_common_parameter_properties(param[1], allowParameterKeys));
      }
      return _results;
    };

    Validator.prototype.validate_headers = function(property, allowParameterKeys) {
      var headerNames, param, _i, _len, _ref1, _results;
      if (util.isNull(property[1])) {
        return;
      }
      if (!util.isMapping(property[1])) {
        throw new exports.ValidationError('while validating headers', null, "property: 'headers' must be a map", property[0].start_mark);
      }
      headerNames = {};
      _ref1 = property[1].value;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        param = _ref1[_i];
        if (!(util.isNullableMapping(param[1]) || util.isNullableSequence(param[1]))) {
          throw new exports.ValidationError('while validating query parameters', null, "each header must be a map", param[1].start_mark);
        }
        this.trackRepeatedProperties(headerNames, this.canonicalizePropertyName(param[0].value, true), param[0], 'while validating headers', "header name already used");
        _results.push(this.valid_common_parameter_properties(param[1], allowParameterKeys));
      }
      return _results;
    };

    Validator.prototype.validate_response = function(response, allowParameterKeys) {
      var canonicalKey, property, responseCode, responseProperties, valid, _i, _j, _len, _len1, _ref1, _ref2, _results;
      if (util.isSequence(response[0])) {
        if (!response[0].value.length) {
          throw new exports.ValidationError('while validating responses', null, 'there must be at least one response code', response[0].start_mark);
        }
        _ref1 = response[0].value;
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          responseCode = _ref1[_i];
          if (!(this.isParameterKey(responseCode) || util.isInteger(responseCode) || !isNaN(this.canonicalizePropertyName(responseCode, allowParameterKeys)))) {
            throw new exports.ValidationError('while validating responses', null, "each response key must be an integer", responseCode.start_mark);
          }
        }
      } else if (!(this.isParameterKey(response) || util.isInteger(response[0]) || !isNaN(this.canonicalizePropertyName(response[0].value, allowParameterKeys)))) {
        throw new exports.ValidationError('while validating responses', null, "each response key must be an integer", response[0].start_mark);
      }
      if (!util.isNullableMapping(response[1])) {
        throw new exports.ValidationError('while validating responses', null, "each response property must be a map", response[0].start_mark);
      }
      if (util.isMapping(response[1])) {
        responseProperties = {};
        _ref2 = response[1].value;
        _results = [];
        for (_j = 0, _len1 = _ref2.length; _j < _len1; _j++) {
          property = _ref2[_j];
          canonicalKey = this.canonicalizePropertyName(property[0].value, allowParameterKeys);
          this.trackRepeatedProperties(responseProperties, canonicalKey, property[0], 'while validating responses', "property already used");
          valid = true;
          if (!this.isParameterKey(property)) {
            switch (property[0].value) {
              case "description":
                if (!util.isScalar(property[1])) {
                  throw new exports.ValidationError('while validating responses', null, 'property description must be a string', response[0].start_mark);
                }
                break;
              default:
                valid = false;
            }
            switch (canonicalKey) {
              case "body":
                _results.push(this.validate_body(property, allowParameterKeys, null, true));
                break;
              case "headers":
                if (!util.isNullableMapping(property[1])) {
                  throw new exports.ValidationError('while validating resources', null, "property 'headers' must be a map", property[0].start_mark);
                }
                _results.push(this.validate_headers(property));
                break;
              default:
                if (!valid) {
                  throw new exports.ValidationError('while validating response', null, "property: '" + property[0].value + "' is invalid in a response", property[0].start_mark);
                } else {
                  _results.push(void 0);
                }
            }
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      }
    };

    Validator.prototype.isHttpMethod = function(value, allowParameterKeys) {
      var _ref1;
      if (allowParameterKeys == null) {
        allowParameterKeys = false;
      }
      if (value) {
        value = this.canonicalizePropertyName(value, allowParameterKeys);
        return (_ref1 = value.toLowerCase()) === 'options' || _ref1 === 'get' || _ref1 === 'head' || _ref1 === 'post' || _ref1 === 'put' || _ref1 === 'delete' || _ref1 === 'trace' || _ref1 === 'connect' || _ref1 === 'patch';
      }
      return false;
    };

    Validator.prototype.isParameterValue = function(property) {
      return this.isParameterKey(property, false);
    };

    Validator.prototype.isParameterKey = function(property, checkKey) {
      var offset;
      if (checkKey == null) {
        checkKey = true;
      }
      offset = checkKey ? 0 : 1;
      if (!(checkKey || util.isScalar(property[1]))) {
        return false;
      }
      if (this.isParameterKeyValue(property[offset].value)) {
        return true;
      } else if (property[offset].value.match(/<<\s*([^\|\s>]+)\s*\|.*\s*>>/g)) {
        throw new exports.ValidationError('while validating parameter', null, "unknown function applied to property name", property[0].start_mark);
      }
      return false;
    };

    Validator.prototype.isParameterKeyValue = function(value) {
      if (value.match(/<<\s*([^\|\s>]+)\s*>>/g) || value.match(/<<\s*([^\|\s>]+)\s*(\|\s*\!\s*(singularize|pluralize))?\s*>>/g)) {
        return true;
      }
      return false;
    };

    Validator.prototype.validate_body = function(property, allowParameterKeys, bodyMode, isResponseBody) {
      var bodyProperties, bodyProperty, canonicalProperty, implicitMode, key, start_mark, valid, _i, _len, _ref1;
      if (bodyMode == null) {
        bodyMode = null;
      }
      if (util.isNull(property[1])) {
        return;
      }
      if (!util.isMapping(property[1])) {
        throw new exports.ValidationError('while validating body', null, "property: body specification must be a map", property[0].start_mark);
      }
      implicitMode = ["implicit", "forcedImplicit"];
      bodyProperties = {};
      _ref1 = property[1].value;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        bodyProperty = _ref1[_i];
        this.trackRepeatedProperties(bodyProperties, this.canonicalizePropertyName(bodyProperty[0].value, true), bodyProperty[0], 'while validating body', "property already used");
        if (this.isParameterKey(bodyProperty)) {
          if (!allowParameterKeys) {
            throw new exports.ValidationError('while validating body', null, "property '" + bodyProperty[0].value + "' is invalid in a resource", bodyProperty[0].start_mark);
          }
        } else if (bodyProperty[0].value.match(/^[^\/]+\/[^\/]+$/)) {
          if (bodyMode && bodyMode !== "explicit") {
            throw new exports.ValidationError('while validating body', null, "not compatible with implicit default Media Type", bodyProperty[0].start_mark);
          }
          bodyMode = "explicit";
          this.validate_body(bodyProperty, allowParameterKeys, "forcedImplicit", isResponseBody);
        } else {
          key = bodyProperty[0].value;
          canonicalProperty = this.canonicalizePropertyName(key, allowParameterKeys);
          valid = true;
          switch (canonicalProperty) {
            case "formParameters":
              if (bodyMode && __indexOf.call(implicitMode, bodyMode) < 0) {
                throw new exports.ValidationError('while validating body', null, "not compatible with explicit Media Type", bodyProperty[0].start_mark);
              }
              if (bodyMode == null) {
                bodyMode = "implicit";
              }
              this.validate_form_params(bodyProperty, allowParameterKeys);
              break;
            default:
              valid = false;
          }
          switch (key) {
            case "description":
              if (!util.isScalar(bodyProperty[1])) {
                throw new exports.ValidationError('while validating body', null, "body description must be a string", bodyProperty[0].start_mark);
              }
              break;
            case "example":
              if (bodyMode && __indexOf.call(implicitMode, bodyMode) < 0) {
                throw new exports.ValidationError('while validating body', null, "not compatible with explicit Media Type", bodyProperty[0].start_mark);
              }
              if (bodyMode == null) {
                bodyMode = "implicit";
              }
              if (!util.isScalar(bodyProperty[1])) {
                throw new exports.ValidationError('while validating body', null, "example must be a string", bodyProperty[0].start_mark);
              }
              break;
            case "schema":
              if (bodyMode && __indexOf.call(implicitMode, bodyMode) < 0) {
                throw new exports.ValidationError('while validating body', null, "not compatible with explicit Media Type", bodyProperty[0].start_mark);
              }
              if (bodyMode == null) {
                bodyMode = "implicit";
              }
              if (!util.isScalar(bodyProperty[1])) {
                throw new exports.ValidationError('while validating body', null, "schema must be a string", bodyProperty[0].start_mark);
              }
              this.validateSchema(bodyProperty[1]);
              break;
            default:
              if (!valid) {
                throw new exports.ValidationError('while validating body', null, "property: '" + bodyProperty[0].value + "' is invalid in a body", bodyProperty[0].start_mark);
              }
          }
        }
      }
      if ("formParameters" in bodyProperties) {
        start_mark = bodyProperties.formParameters.start_mark;
        if (isResponseBody) {
          throw new exports.ValidationError('while validating body', null, "formParameters cannot be used to describe response bodies", start_mark);
        }
        if ("schema" in bodyProperties || "example" in bodyProperties) {
          throw new exports.ValidationError('while validating body', null, "formParameters cannot be used together with the example or schema properties", start_mark);
        }
      }
      if (bodyMode === "implicit") {
        if (!this.get_media_type()) {
          throw new exports.ValidationError('while validating body', null, "body tries to use default Media Type, but mediaType is null", property[0].start_mark);
        }
      }
    };

    Validator.prototype.validateSchema = function(property) {
      var error, mark, schema;
      if (this.isXmlSchema(property.value)) {
        return void 0;
      } else if (this.isJsonSchema(property.value)) {
        try {
          return schema = JSON.parse(property.value);
        } catch (_error) {
          error = _error;
          try {
            schema = jju.parse(property.value);
          } catch (_error) {
            error = _error;
            mark = this.create_mark(property.start_mark.line + error.row, 0);
            if (property.end_mark.line === mark.line && property.end_mark.column === 0) {
              mark.line--;
            }
            throw new exports.ValidationError('while validating body', null, "schema is not valid JSON error: '" + (error.message.split('\n')[0]) + "'", mark);
          }
          throw new exports.ValidationError('while validating body', null, "schema is not valid JSON error: '" + error + "'", property.start_mark);
        }
      }
    };

    Validator.prototype.isJsonSchema = function(string) {
      return string != null ? string.match(/^\s*\{/) : void 0;
    };

    Validator.prototype.isXmlSchema = function(string) {
      return string != null ? string.match(/^\s*(<\?xml[^>]+>)?[\s\n]*<xs:schema/) : void 0;
    };

    Validator.prototype.validate_common_properties = function(property, allowParameterKeys, context) {
      var use, _i, _len, _ref1;
      if (this.isParameterKey(property)) {
        if (!allowParameterKeys) {
          throw new exports.ValidationError('while validating resources', null, "property '" + property[0].value + "' is invalid in a resource", property[0].start_mark);
        }
        return true;
      } else {
        switch (property[0].value) {
          case "displayName":
            if (!util.isScalar(property[1])) {
              throw new exports.ValidationError('while validating resources', null, "property 'displayName' must be a string", property[0].start_mark);
            }
            return true;
          case "description":
            if (!util.isScalar(property[1])) {
              throw new exports.ValidationError('while validating resources', null, "property 'description' must be a string", property[0].start_mark);
            }
            return true;
          case "is":
            if (!util.isSequence(property[1])) {
              throw new exports.ValidationError('while validating resources', null, "property 'is' must be an array", property[0].start_mark);
            }
            _ref1 = property[1].value;
            for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
              use = _ref1[_i];
              this.validate_trait_use(use);
            }
            return true;
        }
      }
      return false;
    };

    Validator.prototype.validate_trait_use = function(node) {
      var parameter, traitName, traitValue, _i, _len, _ref1, _results;
      if (!(util.isScalar(node) || util.isMapping(node))) {
        throw new exports.ValidationError('while validating trait consumption', null, 'trait must be a string or a map', node.start_mark);
      }
      traitName = this.key_or_value(node);
      if (!(traitName != null ? traitName.trim() : void 0)) {
        throw new exports.ValidationError('while validating trait consumption', null, 'trait name must be provided', node.start_mark);
      }
      if (!(this.isParameterKeyValue(traitName) || this.get_trait(traitName))) {
        throw new exports.ValidationError('while validating trait consumption', null, "there is no trait named " + traitName, node.start_mark);
      }
      if (util.isScalar(node)) {
        return;
      }
      traitValue = node.value[0][1];
      if (!(util.isNull(traitValue) || util.isMapping(traitValue))) {
        throw new exports.ValidationError('while validating trait consumption', null, 'trait must be a map', traitValue.start_mark);
      }
      if (util.isNull(traitValue)) {
        return;
      }
      _ref1 = traitValue.value;
      _results = [];
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        parameter = _ref1[_i];
        if (!util.isScalar(parameter[1])) {
          throw new exports.ValidationError('while validating trait consumption', null, 'parameter value must be a scalar', parameter[1].start_mark);
        } else {
          _results.push(void 0);
        }
      }
      return _results;
    };

    Validator.prototype.child_methods = function(node, allowParameterKeys) {
      var _this = this;
      if (allowParameterKeys == null) {
        allowParameterKeys = false;
      }
      if (!(node && util.isMapping(node))) {
        return [];
      }
      return node.value.filter(function(childNode) {
        return _this.isHttpMethod(childNode[0].value, allowParameterKeys);
      });
    };

    Validator.prototype.has_property = function(node, property) {
      if (node && util.isMapping(node)) {
        return node.value.some(function(childNode) {
          return childNode[0].value && typeof childNode[0].value !== "object" && childNode[0].value === property;
        });
      }
      return false;
    };

    Validator.prototype.property_value = function(node, property) {
      var filteredNodes;
      filteredNodes = node.value.filter(function(childNode) {
        return typeof childNode[0].value !== "object" && childNode[0].value === property;
      });
      if (filteredNodes.length) {
        return filteredNodes[0][1].value;
      }
    };

    Validator.prototype.get_property_pair = function(node, property) {
      var filteredNodes;
      if (node && util.isMapping(node)) {
        filteredNodes = node.value.filter(function(childNode) {
          return util.isString(childNode[0]) && childNode[0].value === property;
        });
        if (filteredNodes.length > 0) {
          if (filteredNodes[0].length > 0) {
            return filteredNodes[0];
          }
        }
      }
      return [];
    };

    Validator.prototype.get_property = function(node, property) {
      var pair;
      pair = this.get_property_pair(node, property);
      if (pair != null) {
        return pair[1];
      }
      return [];
    };

    Validator.prototype.get_properties = function(node, property) {
      var prop, properties, _i, _len, _ref1;
      properties = [];
      if (node && util.isMapping(node)) {
        _ref1 = node.value;
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          prop = _ref1[_i];
          if (util.isString(prop[0]) && prop[0].value === property) {
            properties.push(prop);
          } else {
            properties = properties.concat(this.get_properties(prop[1], property));
          }
        }
      }
      return properties;
    };

    Validator.prototype.valid_absolute_uris = function(node) {
      var repeatedUri, uris;
      uris = this.get_absolute_uris(node);
      if (repeatedUri = this.hasDuplicatesUris(uris)) {
        throw new exports.ValidationError('while validating trait consumption', null, "two resources share same URI " + repeatedUri.uri, repeatedUri.mark);
      }
    };

    Validator.prototype.get_absolute_uris = function(node, parentPath) {
      var childResource, child_resources, response, uri, _i, _len;
      response = [];
      if (!util.isNullableMapping(node)) {
        throw new exports.ValidationError('while validating resources', null, 'resource is not a map', node.start_mark);
      }
      child_resources = this.child_resources(node);
      for (_i = 0, _len = child_resources.length; _i < _len; _i++) {
        childResource = child_resources[_i];
        if (parentPath != null) {
          uri = parentPath + childResource[0].value;
        } else {
          uri = childResource[0].value;
        }
        response.push({
          uri: uri,
          mark: childResource[0].start_mark
        });
        response = response.concat(this.get_absolute_uris(childResource[1], uri));
      }
      return response;
    };

    Validator.prototype.key_or_value = function(node) {
      var possibleKeyName, _ref1, _ref2, _ref3;
      if (node instanceof nodes.ScalarNode) {
        return node.value;
      }
      if (node instanceof nodes.MappingNode) {
        possibleKeyName = node != null ? (_ref1 = node.value) != null ? (_ref2 = _ref1[0]) != null ? (_ref3 = _ref2[0]) != null ? _ref3.value : void 0 : void 0 : void 0 : void 0;
        if (possibleKeyName) {
          return possibleKeyName;
        }
      }
      return null;
    };

    Validator.prototype.value_or_undefined = function(node) {
      if (node instanceof nodes.MappingNode) {
        return node.value;
      }
      return void 0;
    };

    Validator.prototype.validate_base_uri = function(baseUriNode) {
      var baseUri, err, expressions, protocol, template, _ref1, _ref2;
      baseUri = (_ref1 = baseUriNode.value) != null ? _ref1.trim() : void 0;
      if (!baseUri) {
        throw new exports.ValidationError('while validating baseUri', null, 'baseUri must have a value', baseUriNode.start_mark);
      }
      protocol = ((url.parse(baseUri)).protocol || 'http:').slice(0, -1).toUpperCase();
      if (protocol !== 'HTTP' && protocol !== 'HTTPS') {
        throw new exports.ValidationError('while validating baseUri', null, 'baseUri protocol must be either HTTP or HTTPS', baseUriNode.start_mark);
      }
      try {
        template = uritemplate.parse(baseUri);
      } catch (_error) {
        err = _error;
        throw new exports.ValidationError('while validating baseUri', null, err != null ? (_ref2 = err.options) != null ? _ref2.message : void 0 : void 0, baseUriNode.start_mark);
      }
      expressions = template.expressions.filter(function(expr) {
        return 'templateText' in expr;
      }).map(function(expression) {
        return expression.templateText;
      });
      if (__indexOf.call(expressions, 'version') >= 0) {
        return true;
      }
    };

    Validator.prototype.get_validation_errors = function() {
      return this.validation_errors;
    };

    Validator.prototype.is_valid = function() {
      return this.validation_errors.length === 0;
    };

    Validator.prototype.hasDuplicatesUris = function(array) {
      var item, output, _i, _len;
      output = {};
      for (_i = 0, _len = array.length; _i < _len; _i++) {
        item = array[_i];
        if (item.uri in output) {
          return item;
        }
        output[item.uri] = item;
      }
      return false;
    };

    Validator.prototype.hasDuplicates = function(array) {
      var item, output, _i, _len;
      output = {};
      for (_i = 0, _len = array.length; _i < _len; _i++) {
        item = array[_i];
        if (item in output) {
          return true;
        }
        output[item] = true;
      }
      return false;
    };

    return Validator;

  })();

}).call(this);

},{"./errors":3,"./nodes":7,"./traits":17,"./util":20,"jju/lib/parse":39,"uritemplate":120,"url":121}],22:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],23:[function(require,module,exports){

},{}],24:[function(require,module,exports){
arguments[4][23][0].apply(exports,arguments)
},{"dup":23}],25:[function(require,module,exports){
(function (global){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('isarray')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Due to various browser bugs, sometimes the Object implementation will be used even
 * when the browser supports typed arrays.
 *
 * Note:
 *
 *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
 *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *   - Safari 5-7 lacks support for changing the `Object.prototype.constructor` property
 *     on objects.
 *
 *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *     incorrect length in some situations.

 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
 * get the Object implementation, which is slower but behaves correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = global.TYPED_ARRAY_SUPPORT !== undefined
  ? global.TYPED_ARRAY_SUPPORT
  : typedArraySupport()

function typedArraySupport () {
  function Bar () {}
  try {
    var arr = new Uint8Array(1)
    arr.foo = function () { return 42 }
    arr.constructor = Bar
    return arr.foo() === 42 && // typed array instances can be augmented
        arr.constructor === Bar && // constructor can be set
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        arr.subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
}

function kMaxLength () {
  return Buffer.TYPED_ARRAY_SUPPORT
    ? 0x7fffffff
    : 0x3fffffff
}

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (arg) {
  if (!(this instanceof Buffer)) {
    // Avoid going through an ArgumentsAdaptorTrampoline in the common case.
    if (arguments.length > 1) return new Buffer(arg, arguments[1])
    return new Buffer(arg)
  }

  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    this.length = 0
    this.parent = undefined
  }

  // Common case.
  if (typeof arg === 'number') {
    return fromNumber(this, arg)
  }

  // Slightly less common case.
  if (typeof arg === 'string') {
    return fromString(this, arg, arguments.length > 1 ? arguments[1] : 'utf8')
  }

  // Unusual.
  return fromObject(this, arg)
}

function fromNumber (that, length) {
  that = allocate(that, length < 0 ? 0 : checked(length) | 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < length; i++) {
      that[i] = 0
    }
  }
  return that
}

function fromString (that, string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') encoding = 'utf8'

  // Assumption: byteLength() return value is always < kMaxLength.
  var length = byteLength(string, encoding) | 0
  that = allocate(that, length)

  that.write(string, encoding)
  return that
}

function fromObject (that, object) {
  if (Buffer.isBuffer(object)) return fromBuffer(that, object)

  if (isArray(object)) return fromArray(that, object)

  if (object == null) {
    throw new TypeError('must start with number, buffer, array or string')
  }

  if (typeof ArrayBuffer !== 'undefined') {
    if (object.buffer instanceof ArrayBuffer) {
      return fromTypedArray(that, object)
    }
    if (object instanceof ArrayBuffer) {
      return fromArrayBuffer(that, object)
    }
  }

  if (object.length) return fromArrayLike(that, object)

  return fromJsonObject(that, object)
}

function fromBuffer (that, buffer) {
  var length = checked(buffer.length) | 0
  that = allocate(that, length)
  buffer.copy(that, 0, 0, length)
  return that
}

function fromArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Duplicate of fromArray() to keep fromArray() monomorphic.
function fromTypedArray (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  // Truncating the elements is probably not what people expect from typed
  // arrays with BYTES_PER_ELEMENT > 1 but it's compatible with the behavior
  // of the old Buffer constructor.
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

function fromArrayBuffer (that, array) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    array.byteLength
    that = Buffer._augment(new Uint8Array(array))
  } else {
    // Fallback: Return an object instance of the Buffer class
    that = fromTypedArray(that, new Uint8Array(array))
  }
  return that
}

function fromArrayLike (that, array) {
  var length = checked(array.length) | 0
  that = allocate(that, length)
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

// Deserialize { type: 'Buffer', data: [1,2,3,...] } into a Buffer object.
// Returns a zero-length buffer for inputs that don't conform to the spec.
function fromJsonObject (that, object) {
  var array
  var length = 0

  if (object.type === 'Buffer' && isArray(object.data)) {
    array = object.data
    length = checked(array.length) | 0
  }
  that = allocate(that, length)

  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255
  }
  return that
}

if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype
  Buffer.__proto__ = Uint8Array
} else {
  // pre-set for values that may exist in the future
  Buffer.prototype.length = undefined
  Buffer.prototype.parent = undefined
}

function allocate (that, length) {
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Return an augmented `Uint8Array` instance, for best performance
    that = Buffer._augment(new Uint8Array(length))
    that.__proto__ = Buffer.prototype
  } else {
    // Fallback: Return an object instance of the Buffer class
    that.length = length
    that._isBuffer = true
  }

  var fromPool = length !== 0 && length <= Buffer.poolSize >>> 1
  if (fromPool) that.parent = rootParent

  return that
}

function checked (length) {
  // Note: cannot use `length < kMaxLength` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= kMaxLength()) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + kMaxLength().toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (subject, encoding) {
  if (!(this instanceof SlowBuffer)) return new SlowBuffer(subject, encoding)

  var buf = new Buffer(subject, encoding)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function isBuffer (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function compare (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError('Arguments must be Buffers')
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  var i = 0
  var len = Math.min(x, y)
  while (i < len) {
    if (a[i] !== b[i]) break

    ++i
  }

  if (i !== len) {
    x = a[i]
    y = b[i]
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!isArray(list)) throw new TypeError('list argument must be an Array of Buffers.')

  if (list.length === 0) {
    return new Buffer(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; i++) {
      length += list[i].length
    }
  }

  var buf = new Buffer(length)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

function byteLength (string, encoding) {
  if (typeof string !== 'string') string = '' + string

  var len = string.length
  if (len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'binary':
      // Deprecated
      case 'raw':
      case 'raws':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) return utf8ToBytes(string).length // assume utf8
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  start = start | 0
  end = end === undefined || end === Infinity ? this.length : end | 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toString = function toString () {
  var length = this.length | 0
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max) str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return 0
  return Buffer.compare(this, b)
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset) {
  if (byteOffset > 0x7fffffff) byteOffset = 0x7fffffff
  else if (byteOffset < -0x80000000) byteOffset = -0x80000000
  byteOffset >>= 0

  if (this.length === 0) return -1
  if (byteOffset >= this.length) return -1

  // Negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = Math.max(this.length + byteOffset, 0)

  if (typeof val === 'string') {
    if (val.length === 0) return -1 // special case: looking for empty string always fails
    return String.prototype.indexOf.call(this, val, byteOffset)
  }
  if (Buffer.isBuffer(val)) {
    return arrayIndexOf(this, val, byteOffset)
  }
  if (typeof val === 'number') {
    if (Buffer.TYPED_ARRAY_SUPPORT && Uint8Array.prototype.indexOf === 'function') {
      return Uint8Array.prototype.indexOf.call(this, val, byteOffset)
    }
    return arrayIndexOf(this, [ val ], byteOffset)
  }

  function arrayIndexOf (arr, val, byteOffset) {
    var foundIndex = -1
    for (var i = 0; byteOffset + i < arr.length; i++) {
      if (arr[byteOffset + i] === val[foundIndex === -1 ? 0 : i - foundIndex]) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === val.length) return byteOffset + foundIndex
      } else {
        foundIndex = -1
      }
    }
    return -1
  }

  throw new TypeError('val must be string, number or Buffer')
}

// `get` is deprecated
Buffer.prototype.get = function get (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` is deprecated
Buffer.prototype.set = function set (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(parsed)) throw new Error('Invalid hex string')
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset | 0
    if (isFinite(length)) {
      length = length | 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  // legacy write(string, encoding, offset, length) - remove in v0.13
  } else {
    var swap = encoding
    encoding = offset
    offset = length | 0
    length = swap
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'binary':
        return binaryWrite(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
      : (firstByte > 0xBF) ? 2
      : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length) newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  byteLength = byteLength | 0
  if (!noAssert) checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = (value & 0xff)
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
  } else {
    objectWriteUInt16(this, value, offset, true)
  }
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = (value & 0xff)
  } else {
    objectWriteUInt16(this, value, offset, false)
  }
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value & 0xff)
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else {
    objectWriteUInt32(this, value, offset, true)
  }
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset | 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = (value & 0xff)
  } else {
    objectWriteUInt32(this, value, offset, false)
  }
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start
  var i

  if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (i = len - 1; i >= 0; i--) {
      target[i + targetStart] = this[i + start]
    }
  } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    // ascending copy from start
    for (i = 0; i < len; i++) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), targetStart)
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function fill (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function toArrayBuffer () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function _augment (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array set method before overwriting
  arr._set = arr.set

  // deprecated
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.indexOf = BP.indexOf
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUIntLE = BP.readUIntLE
  arr.readUIntBE = BP.readUIntBE
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readIntLE = BP.readIntLE
  arr.readIntBE = BP.readIntBE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUIntLE = BP.writeUIntLE
  arr.writeUIntBE = BP.writeUIntBE
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeIntLE = BP.writeIntLE
  arr.writeIntBE = BP.writeIntBE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"base64-js":22,"ieee754":35,"isarray":38}],26:[function(require,module,exports){
module.exports = {
  "100": "Continue",
  "101": "Switching Protocols",
  "102": "Processing",
  "200": "OK",
  "201": "Created",
  "202": "Accepted",
  "203": "Non-Authoritative Information",
  "204": "No Content",
  "205": "Reset Content",
  "206": "Partial Content",
  "207": "Multi-Status",
  "208": "Already Reported",
  "226": "IM Used",
  "300": "Multiple Choices",
  "301": "Moved Permanently",
  "302": "Found",
  "303": "See Other",
  "304": "Not Modified",
  "305": "Use Proxy",
  "307": "Temporary Redirect",
  "308": "Permanent Redirect",
  "400": "Bad Request",
  "401": "Unauthorized",
  "402": "Payment Required",
  "403": "Forbidden",
  "404": "Not Found",
  "405": "Method Not Allowed",
  "406": "Not Acceptable",
  "407": "Proxy Authentication Required",
  "408": "Request Timeout",
  "409": "Conflict",
  "410": "Gone",
  "411": "Length Required",
  "412": "Precondition Failed",
  "413": "Payload Too Large",
  "414": "URI Too Long",
  "415": "Unsupported Media Type",
  "416": "Range Not Satisfiable",
  "417": "Expectation Failed",
  "418": "I'm a teapot",
  "421": "Misdirected Request",
  "422": "Unprocessable Entity",
  "423": "Locked",
  "424": "Failed Dependency",
  "425": "Unordered Collection",
  "426": "Upgrade Required",
  "428": "Precondition Required",
  "429": "Too Many Requests",
  "431": "Request Header Fields Too Large",
  "451": "Unavailable For Legal Reasons",
  "500": "Internal Server Error",
  "501": "Not Implemented",
  "502": "Bad Gateway",
  "503": "Service Unavailable",
  "504": "Gateway Timeout",
  "505": "HTTP Version Not Supported",
  "506": "Variant Also Negotiates",
  "507": "Insufficient Storage",
  "508": "Loop Detected",
  "509": "Bandwidth Limit Exceeded",
  "510": "Not Extended",
  "511": "Network Authentication Required"
}

},{}],27:[function(require,module,exports){
(function (process,global){
"use strict"

var next = (global.process && process.nextTick) || global.setImmediate || function (f) {
  setTimeout(f, 0)
}

module.exports = function maybe (cb, promise) {
  if (cb) {
    promise
      .then(function (result) {
        next(function () { cb(null, result) })
      }, function (err) {
        next(function () { cb(err) })
      })
    return undefined
  }
  else {
    return promise
  }
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":98}],28:[function(require,module,exports){
(function (Buffer){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.

function isArray(arg) {
  if (Array.isArray) {
    return Array.isArray(arg);
  }
  return objectToString(arg) === '[object Array]';
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = Buffer.isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}

}).call(this,{"isBuffer":require("../../is-buffer/index.js")})
},{"../../is-buffer/index.js":37}],29:[function(require,module,exports){
(function (process){
/**
 * This is the web browser implementation of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = require('./debug');
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = 'undefined' != typeof chrome
               && 'undefined' != typeof chrome.storage
                  ? chrome.storage.local
                  : localstorage();

/**
 * Colors.
 */

exports.colors = [
  '#0000CC', '#0000FF', '#0033CC', '#0033FF', '#0066CC', '#0066FF', '#0099CC',
  '#0099FF', '#00CC00', '#00CC33', '#00CC66', '#00CC99', '#00CCCC', '#00CCFF',
  '#3300CC', '#3300FF', '#3333CC', '#3333FF', '#3366CC', '#3366FF', '#3399CC',
  '#3399FF', '#33CC00', '#33CC33', '#33CC66', '#33CC99', '#33CCCC', '#33CCFF',
  '#6600CC', '#6600FF', '#6633CC', '#6633FF', '#66CC00', '#66CC33', '#9900CC',
  '#9900FF', '#9933CC', '#9933FF', '#99CC00', '#99CC33', '#CC0000', '#CC0033',
  '#CC0066', '#CC0099', '#CC00CC', '#CC00FF', '#CC3300', '#CC3333', '#CC3366',
  '#CC3399', '#CC33CC', '#CC33FF', '#CC6600', '#CC6633', '#CC9900', '#CC9933',
  '#CCCC00', '#CCCC33', '#FF0000', '#FF0033', '#FF0066', '#FF0099', '#FF00CC',
  '#FF00FF', '#FF3300', '#FF3333', '#FF3366', '#FF3399', '#FF33CC', '#FF33FF',
  '#FF6600', '#FF6633', '#FF9900', '#FF9933', '#FFCC00', '#FFCC33'
];

/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */

function useColors() {
  // NB: In an Electron preload script, document will be defined but not fully
  // initialized. Since we know we're in Chrome, we'll just detect this case
  // explicitly
  if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
    return true;
  }

  // Internet Explorer and Edge do not support colors.
  if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
    return false;
  }

  // is webkit? http://stackoverflow.com/a/16459606/376773
  // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
  return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
    // is firebug? http://stackoverflow.com/a/398120/376773
    (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
    // is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31) ||
    // double check webkit in userAgent just in case we are in a worker
    (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}

/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */

exports.formatters.j = function(v) {
  try {
    return JSON.stringify(v);
  } catch (err) {
    return '[UnexpectedJSONParseError]: ' + err.message;
  }
};


/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */

function formatArgs(args) {
  var useColors = this.useColors;

  args[0] = (useColors ? '%c' : '')
    + this.namespace
    + (useColors ? ' %c' : ' ')
    + args[0]
    + (useColors ? '%c ' : ' ')
    + '+' + exports.humanize(this.diff);

  if (!useColors) return;

  var c = 'color: ' + this.color;
  args.splice(1, 0, c, 'color: inherit')

  // the final "%c" is somewhat tricky, because there could be other
  // arguments passed either before or after the %c, so we need to
  // figure out the correct index to insert the CSS into
  var index = 0;
  var lastC = 0;
  args[0].replace(/%[a-zA-Z%]/g, function(match) {
    if ('%%' === match) return;
    index++;
    if ('%c' === match) {
      // we only are interested in the *last* %c
      // (the user may have provided their own)
      lastC = index;
    }
  });

  args.splice(lastC, 0, c);
}

/**
 * Invokes `console.log()` when available.
 * No-op when `console.log` is not a "function".
 *
 * @api public
 */

function log() {
  // this hackery is required for IE8/9, where
  // the `console.log` function doesn't have 'apply'
  return 'object' === typeof console
    && console.log
    && Function.prototype.apply.call(console.log, console, arguments);
}

/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */

function save(namespaces) {
  try {
    if (null == namespaces) {
      exports.storage.removeItem('debug');
    } else {
      exports.storage.debug = namespaces;
    }
  } catch(e) {}
}

/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */

function load() {
  var r;
  try {
    r = exports.storage.debug;
  } catch(e) {}

  // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
  if (!r && typeof process !== 'undefined' && 'env' in process) {
    r = process.env.DEBUG;
  }

  return r;
}

/**
 * Enable namespaces listed in `localStorage.debug` initially.
 */

exports.enable(load());

/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */

function localstorage() {
  try {
    return window.localStorage;
  } catch (e) {}
}

}).call(this,require('_process'))
},{"./debug":30,"_process":98}],30:[function(require,module,exports){

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 *
 * Expose `debug()` as the module.
 */

exports = module.exports = createDebug.debug = createDebug['default'] = createDebug;
exports.coerce = coerce;
exports.disable = disable;
exports.enable = enable;
exports.enabled = enabled;
exports.humanize = require('ms');

/**
 * Active `debug` instances.
 */
exports.instances = [];

/**
 * The currently active debug mode names, and names to skip.
 */

exports.names = [];
exports.skips = [];

/**
 * Map of special "%n" handling functions, for the debug "format" argument.
 *
 * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
 */

exports.formatters = {};

/**
 * Select a color.
 * @param {String} namespace
 * @return {Number}
 * @api private
 */

function selectColor(namespace) {
  var hash = 0, i;

  for (i in namespace) {
    hash  = ((hash << 5) - hash) + namespace.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  return exports.colors[Math.abs(hash) % exports.colors.length];
}

/**
 * Create a debugger with the given `namespace`.
 *
 * @param {String} namespace
 * @return {Function}
 * @api public
 */

function createDebug(namespace) {

  var prevTime;

  function debug() {
    // disabled?
    if (!debug.enabled) return;

    var self = debug;

    // set `diff` timestamp
    var curr = +new Date();
    var ms = curr - (prevTime || curr);
    self.diff = ms;
    self.prev = prevTime;
    self.curr = curr;
    prevTime = curr;

    // turn the `arguments` into a proper Array
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }

    args[0] = exports.coerce(args[0]);

    if ('string' !== typeof args[0]) {
      // anything else let's inspect with %O
      args.unshift('%O');
    }

    // apply any `formatters` transformations
    var index = 0;
    args[0] = args[0].replace(/%([a-zA-Z%])/g, function(match, format) {
      // if we encounter an escaped % then don't increase the array index
      if (match === '%%') return match;
      index++;
      var formatter = exports.formatters[format];
      if ('function' === typeof formatter) {
        var val = args[index];
        match = formatter.call(self, val);

        // now we need to remove `args[index]` since it's inlined in the `format`
        args.splice(index, 1);
        index--;
      }
      return match;
    });

    // apply env-specific formatting (colors, etc.)
    exports.formatArgs.call(self, args);

    var logFn = debug.log || exports.log || console.log.bind(console);
    logFn.apply(self, args);
  }

  debug.namespace = namespace;
  debug.enabled = exports.enabled(namespace);
  debug.useColors = exports.useColors();
  debug.color = selectColor(namespace);
  debug.destroy = destroy;

  // env-specific initialization logic for debug instances
  if ('function' === typeof exports.init) {
    exports.init(debug);
  }

  exports.instances.push(debug);

  return debug;
}

function destroy () {
  var index = exports.instances.indexOf(this);
  if (index !== -1) {
    exports.instances.splice(index, 1);
    return true;
  } else {
    return false;
  }
}

/**
 * Enables a debug mode by namespaces. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} namespaces
 * @api public
 */

function enable(namespaces) {
  exports.save(namespaces);

  exports.names = [];
  exports.skips = [];

  var i;
  var split = (typeof namespaces === 'string' ? namespaces : '').split(/[\s,]+/);
  var len = split.length;

  for (i = 0; i < len; i++) {
    if (!split[i]) continue; // ignore empty strings
    namespaces = split[i].replace(/\*/g, '.*?');
    if (namespaces[0] === '-') {
      exports.skips.push(new RegExp('^' + namespaces.substr(1) + '$'));
    } else {
      exports.names.push(new RegExp('^' + namespaces + '$'));
    }
  }

  for (i = 0; i < exports.instances.length; i++) {
    var instance = exports.instances[i];
    instance.enabled = exports.enabled(instance.namespace);
  }
}

/**
 * Disable debug output.
 *
 * @api public
 */

function disable() {
  exports.enable('');
}

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

function enabled(name) {
  if (name[name.length - 1] === '*') {
    return true;
  }
  var i, len;
  for (i = 0, len = exports.skips.length; i < len; i++) {
    if (exports.skips[i].test(name)) {
      return false;
    }
  }
  for (i = 0, len = exports.names.length; i < len; i++) {
    if (exports.names[i].test(name)) {
      return true;
    }
  }
  return false;
}

/**
 * Coerce `val`.
 *
 * @param {Mixed} val
 * @return {Mixed}
 * @api private
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

},{"ms":92}],31:[function(require,module,exports){
(function (process,global){
/*!
 * @overview es6-promise - a tiny implementation of Promises/A+.
 * @copyright Copyright (c) 2014 Yehuda Katz, Tom Dale, Stefan Penner and contributors (Conversion to ES6 API by Jake Archibald)
 * @license   Licensed under MIT license
 *            See https://raw.githubusercontent.com/stefanpenner/es6-promise/master/LICENSE
 * @version   4.1.1
 */

(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
	typeof define === 'function' && define.amd ? define(factory) :
	(global.ES6Promise = factory());
}(this, (function () { 'use strict';

function objectOrFunction(x) {
  var type = typeof x;
  return x !== null && (type === 'object' || type === 'function');
}

function isFunction(x) {
  return typeof x === 'function';
}

var _isArray = undefined;
if (Array.isArray) {
  _isArray = Array.isArray;
} else {
  _isArray = function (x) {
    return Object.prototype.toString.call(x) === '[object Array]';
  };
}

var isArray = _isArray;

var len = 0;
var vertxNext = undefined;
var customSchedulerFn = undefined;

var asap = function asap(callback, arg) {
  queue[len] = callback;
  queue[len + 1] = arg;
  len += 2;
  if (len === 2) {
    // If len is 2, that means that we need to schedule an async flush.
    // If additional callbacks are queued before the queue is flushed, they
    // will be processed by this flush that we are scheduling.
    if (customSchedulerFn) {
      customSchedulerFn(flush);
    } else {
      scheduleFlush();
    }
  }
};

function setScheduler(scheduleFn) {
  customSchedulerFn = scheduleFn;
}

function setAsap(asapFn) {
  asap = asapFn;
}

var browserWindow = typeof window !== 'undefined' ? window : undefined;
var browserGlobal = browserWindow || {};
var BrowserMutationObserver = browserGlobal.MutationObserver || browserGlobal.WebKitMutationObserver;
var isNode = typeof self === 'undefined' && typeof process !== 'undefined' && ({}).toString.call(process) === '[object process]';

// test for web worker but not in IE10
var isWorker = typeof Uint8ClampedArray !== 'undefined' && typeof importScripts !== 'undefined' && typeof MessageChannel !== 'undefined';

// node
function useNextTick() {
  // node version 0.10.x displays a deprecation warning when nextTick is used recursively
  // see https://github.com/cujojs/when/issues/410 for details
  return function () {
    return process.nextTick(flush);
  };
}

// vertx
function useVertxTimer() {
  if (typeof vertxNext !== 'undefined') {
    return function () {
      vertxNext(flush);
    };
  }

  return useSetTimeout();
}

function useMutationObserver() {
  var iterations = 0;
  var observer = new BrowserMutationObserver(flush);
  var node = document.createTextNode('');
  observer.observe(node, { characterData: true });

  return function () {
    node.data = iterations = ++iterations % 2;
  };
}

// web worker
function useMessageChannel() {
  var channel = new MessageChannel();
  channel.port1.onmessage = flush;
  return function () {
    return channel.port2.postMessage(0);
  };
}

function useSetTimeout() {
  // Store setTimeout reference so es6-promise will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var globalSetTimeout = setTimeout;
  return function () {
    return globalSetTimeout(flush, 1);
  };
}

var queue = new Array(1000);
function flush() {
  for (var i = 0; i < len; i += 2) {
    var callback = queue[i];
    var arg = queue[i + 1];

    callback(arg);

    queue[i] = undefined;
    queue[i + 1] = undefined;
  }

  len = 0;
}

function attemptVertx() {
  try {
    var r = require;
    var vertx = r('vertx');
    vertxNext = vertx.runOnLoop || vertx.runOnContext;
    return useVertxTimer();
  } catch (e) {
    return useSetTimeout();
  }
}

var scheduleFlush = undefined;
// Decide what async method to use to triggering processing of queued callbacks:
if (isNode) {
  scheduleFlush = useNextTick();
} else if (BrowserMutationObserver) {
  scheduleFlush = useMutationObserver();
} else if (isWorker) {
  scheduleFlush = useMessageChannel();
} else if (browserWindow === undefined && typeof require === 'function') {
  scheduleFlush = attemptVertx();
} else {
  scheduleFlush = useSetTimeout();
}

function then(onFulfillment, onRejection) {
  var _arguments = arguments;

  var parent = this;

  var child = new this.constructor(noop);

  if (child[PROMISE_ID] === undefined) {
    makePromise(child);
  }

  var _state = parent._state;

  if (_state) {
    (function () {
      var callback = _arguments[_state - 1];
      asap(function () {
        return invokeCallback(_state, child, callback, parent._result);
      });
    })();
  } else {
    subscribe(parent, child, onFulfillment, onRejection);
  }

  return child;
}

/**
  `Promise.resolve` returns a promise that will become resolved with the
  passed `value`. It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    resolve(1);
  });

  promise.then(function(value){
    // value === 1
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.resolve(1);

  promise.then(function(value){
    // value === 1
  });
  ```

  @method resolve
  @static
  @param {Any} value value that the returned promise will be resolved with
  Useful for tooling.
  @return {Promise} a promise that will become fulfilled with the given
  `value`
*/
function resolve$1(object) {
  /*jshint validthis:true */
  var Constructor = this;

  if (object && typeof object === 'object' && object.constructor === Constructor) {
    return object;
  }

  var promise = new Constructor(noop);
  resolve(promise, object);
  return promise;
}

var PROMISE_ID = Math.random().toString(36).substring(16);

function noop() {}

var PENDING = void 0;
var FULFILLED = 1;
var REJECTED = 2;

var GET_THEN_ERROR = new ErrorObject();

function selfFulfillment() {
  return new TypeError("You cannot resolve a promise with itself");
}

function cannotReturnOwn() {
  return new TypeError('A promises callback cannot return that same promise.');
}

function getThen(promise) {
  try {
    return promise.then;
  } catch (error) {
    GET_THEN_ERROR.error = error;
    return GET_THEN_ERROR;
  }
}

function tryThen(then$$1, value, fulfillmentHandler, rejectionHandler) {
  try {
    then$$1.call(value, fulfillmentHandler, rejectionHandler);
  } catch (e) {
    return e;
  }
}

function handleForeignThenable(promise, thenable, then$$1) {
  asap(function (promise) {
    var sealed = false;
    var error = tryThen(then$$1, thenable, function (value) {
      if (sealed) {
        return;
      }
      sealed = true;
      if (thenable !== value) {
        resolve(promise, value);
      } else {
        fulfill(promise, value);
      }
    }, function (reason) {
      if (sealed) {
        return;
      }
      sealed = true;

      reject(promise, reason);
    }, 'Settle: ' + (promise._label || ' unknown promise'));

    if (!sealed && error) {
      sealed = true;
      reject(promise, error);
    }
  }, promise);
}

function handleOwnThenable(promise, thenable) {
  if (thenable._state === FULFILLED) {
    fulfill(promise, thenable._result);
  } else if (thenable._state === REJECTED) {
    reject(promise, thenable._result);
  } else {
    subscribe(thenable, undefined, function (value) {
      return resolve(promise, value);
    }, function (reason) {
      return reject(promise, reason);
    });
  }
}

function handleMaybeThenable(promise, maybeThenable, then$$1) {
  if (maybeThenable.constructor === promise.constructor && then$$1 === then && maybeThenable.constructor.resolve === resolve$1) {
    handleOwnThenable(promise, maybeThenable);
  } else {
    if (then$$1 === GET_THEN_ERROR) {
      reject(promise, GET_THEN_ERROR.error);
      GET_THEN_ERROR.error = null;
    } else if (then$$1 === undefined) {
      fulfill(promise, maybeThenable);
    } else if (isFunction(then$$1)) {
      handleForeignThenable(promise, maybeThenable, then$$1);
    } else {
      fulfill(promise, maybeThenable);
    }
  }
}

function resolve(promise, value) {
  if (promise === value) {
    reject(promise, selfFulfillment());
  } else if (objectOrFunction(value)) {
    handleMaybeThenable(promise, value, getThen(value));
  } else {
    fulfill(promise, value);
  }
}

function publishRejection(promise) {
  if (promise._onerror) {
    promise._onerror(promise._result);
  }

  publish(promise);
}

function fulfill(promise, value) {
  if (promise._state !== PENDING) {
    return;
  }

  promise._result = value;
  promise._state = FULFILLED;

  if (promise._subscribers.length !== 0) {
    asap(publish, promise);
  }
}

function reject(promise, reason) {
  if (promise._state !== PENDING) {
    return;
  }
  promise._state = REJECTED;
  promise._result = reason;

  asap(publishRejection, promise);
}

function subscribe(parent, child, onFulfillment, onRejection) {
  var _subscribers = parent._subscribers;
  var length = _subscribers.length;

  parent._onerror = null;

  _subscribers[length] = child;
  _subscribers[length + FULFILLED] = onFulfillment;
  _subscribers[length + REJECTED] = onRejection;

  if (length === 0 && parent._state) {
    asap(publish, parent);
  }
}

function publish(promise) {
  var subscribers = promise._subscribers;
  var settled = promise._state;

  if (subscribers.length === 0) {
    return;
  }

  var child = undefined,
      callback = undefined,
      detail = promise._result;

  for (var i = 0; i < subscribers.length; i += 3) {
    child = subscribers[i];
    callback = subscribers[i + settled];

    if (child) {
      invokeCallback(settled, child, callback, detail);
    } else {
      callback(detail);
    }
  }

  promise._subscribers.length = 0;
}

function ErrorObject() {
  this.error = null;
}

var TRY_CATCH_ERROR = new ErrorObject();

function tryCatch(callback, detail) {
  try {
    return callback(detail);
  } catch (e) {
    TRY_CATCH_ERROR.error = e;
    return TRY_CATCH_ERROR;
  }
}

function invokeCallback(settled, promise, callback, detail) {
  var hasCallback = isFunction(callback),
      value = undefined,
      error = undefined,
      succeeded = undefined,
      failed = undefined;

  if (hasCallback) {
    value = tryCatch(callback, detail);

    if (value === TRY_CATCH_ERROR) {
      failed = true;
      error = value.error;
      value.error = null;
    } else {
      succeeded = true;
    }

    if (promise === value) {
      reject(promise, cannotReturnOwn());
      return;
    }
  } else {
    value = detail;
    succeeded = true;
  }

  if (promise._state !== PENDING) {
    // noop
  } else if (hasCallback && succeeded) {
      resolve(promise, value);
    } else if (failed) {
      reject(promise, error);
    } else if (settled === FULFILLED) {
      fulfill(promise, value);
    } else if (settled === REJECTED) {
      reject(promise, value);
    }
}

function initializePromise(promise, resolver) {
  try {
    resolver(function resolvePromise(value) {
      resolve(promise, value);
    }, function rejectPromise(reason) {
      reject(promise, reason);
    });
  } catch (e) {
    reject(promise, e);
  }
}

var id = 0;
function nextId() {
  return id++;
}

function makePromise(promise) {
  promise[PROMISE_ID] = id++;
  promise._state = undefined;
  promise._result = undefined;
  promise._subscribers = [];
}

function Enumerator$1(Constructor, input) {
  this._instanceConstructor = Constructor;
  this.promise = new Constructor(noop);

  if (!this.promise[PROMISE_ID]) {
    makePromise(this.promise);
  }

  if (isArray(input)) {
    this.length = input.length;
    this._remaining = input.length;

    this._result = new Array(this.length);

    if (this.length === 0) {
      fulfill(this.promise, this._result);
    } else {
      this.length = this.length || 0;
      this._enumerate(input);
      if (this._remaining === 0) {
        fulfill(this.promise, this._result);
      }
    }
  } else {
    reject(this.promise, validationError());
  }
}

function validationError() {
  return new Error('Array Methods must be provided an Array');
}

Enumerator$1.prototype._enumerate = function (input) {
  for (var i = 0; this._state === PENDING && i < input.length; i++) {
    this._eachEntry(input[i], i);
  }
};

Enumerator$1.prototype._eachEntry = function (entry, i) {
  var c = this._instanceConstructor;
  var resolve$$1 = c.resolve;

  if (resolve$$1 === resolve$1) {
    var _then = getThen(entry);

    if (_then === then && entry._state !== PENDING) {
      this._settledAt(entry._state, i, entry._result);
    } else if (typeof _then !== 'function') {
      this._remaining--;
      this._result[i] = entry;
    } else if (c === Promise$2) {
      var promise = new c(noop);
      handleMaybeThenable(promise, entry, _then);
      this._willSettleAt(promise, i);
    } else {
      this._willSettleAt(new c(function (resolve$$1) {
        return resolve$$1(entry);
      }), i);
    }
  } else {
    this._willSettleAt(resolve$$1(entry), i);
  }
};

Enumerator$1.prototype._settledAt = function (state, i, value) {
  var promise = this.promise;

  if (promise._state === PENDING) {
    this._remaining--;

    if (state === REJECTED) {
      reject(promise, value);
    } else {
      this._result[i] = value;
    }
  }

  if (this._remaining === 0) {
    fulfill(promise, this._result);
  }
};

Enumerator$1.prototype._willSettleAt = function (promise, i) {
  var enumerator = this;

  subscribe(promise, undefined, function (value) {
    return enumerator._settledAt(FULFILLED, i, value);
  }, function (reason) {
    return enumerator._settledAt(REJECTED, i, reason);
  });
};

/**
  `Promise.all` accepts an array of promises, and returns a new promise which
  is fulfilled with an array of fulfillment values for the passed promises, or
  rejected with the reason of the first passed promise to be rejected. It casts all
  elements of the passed iterable to promises as it runs this algorithm.

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = resolve(2);
  let promise3 = resolve(3);
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // The array here would be [ 1, 2, 3 ];
  });
  ```

  If any of the `promises` given to `all` are rejected, the first promise
  that is rejected will be given as an argument to the returned promises's
  rejection handler. For example:

  Example:

  ```javascript
  let promise1 = resolve(1);
  let promise2 = reject(new Error("2"));
  let promise3 = reject(new Error("3"));
  let promises = [ promise1, promise2, promise3 ];

  Promise.all(promises).then(function(array){
    // Code here never runs because there are rejected promises!
  }, function(error) {
    // error.message === "2"
  });
  ```

  @method all
  @static
  @param {Array} entries array of promises
  @param {String} label optional string for labeling the promise.
  Useful for tooling.
  @return {Promise} promise that is fulfilled when all `promises` have been
  fulfilled, or rejected if any of them become rejected.
  @static
*/
function all$1(entries) {
  return new Enumerator$1(this, entries).promise;
}

/**
  `Promise.race` returns a new promise which is settled in the same way as the
  first passed promise to settle.

  Example:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 2');
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // result === 'promise 2' because it was resolved before promise1
    // was resolved.
  });
  ```

  `Promise.race` is deterministic in that only the state of the first
  settled promise matters. For example, even if other promises given to the
  `promises` array argument are resolved, but the first settled promise has
  become rejected before the other promises became fulfilled, the returned
  promise will become rejected:

  ```javascript
  let promise1 = new Promise(function(resolve, reject){
    setTimeout(function(){
      resolve('promise 1');
    }, 200);
  });

  let promise2 = new Promise(function(resolve, reject){
    setTimeout(function(){
      reject(new Error('promise 2'));
    }, 100);
  });

  Promise.race([promise1, promise2]).then(function(result){
    // Code here never runs
  }, function(reason){
    // reason.message === 'promise 2' because promise 2 became rejected before
    // promise 1 became fulfilled
  });
  ```

  An example real-world use case is implementing timeouts:

  ```javascript
  Promise.race([ajax('foo.json'), timeout(5000)])
  ```

  @method race
  @static
  @param {Array} promises array of promises to observe
  Useful for tooling.
  @return {Promise} a promise which settles in the same way as the first passed
  promise to settle.
*/
function race$1(entries) {
  /*jshint validthis:true */
  var Constructor = this;

  if (!isArray(entries)) {
    return new Constructor(function (_, reject) {
      return reject(new TypeError('You must pass an array to race.'));
    });
  } else {
    return new Constructor(function (resolve, reject) {
      var length = entries.length;
      for (var i = 0; i < length; i++) {
        Constructor.resolve(entries[i]).then(resolve, reject);
      }
    });
  }
}

/**
  `Promise.reject` returns a promise rejected with the passed `reason`.
  It is shorthand for the following:

  ```javascript
  let promise = new Promise(function(resolve, reject){
    reject(new Error('WHOOPS'));
  });

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  Instead of writing the above, your code now simply becomes the following:

  ```javascript
  let promise = Promise.reject(new Error('WHOOPS'));

  promise.then(function(value){
    // Code here doesn't run because the promise is rejected!
  }, function(reason){
    // reason.message === 'WHOOPS'
  });
  ```

  @method reject
  @static
  @param {Any} reason value that the returned promise will be rejected with.
  Useful for tooling.
  @return {Promise} a promise rejected with the given `reason`.
*/
function reject$1(reason) {
  /*jshint validthis:true */
  var Constructor = this;
  var promise = new Constructor(noop);
  reject(promise, reason);
  return promise;
}

function needsResolver() {
  throw new TypeError('You must pass a resolver function as the first argument to the promise constructor');
}

function needsNew() {
  throw new TypeError("Failed to construct 'Promise': Please use the 'new' operator, this object constructor cannot be called as a function.");
}

/**
  Promise objects represent the eventual result of an asynchronous operation. The
  primary way of interacting with a promise is through its `then` method, which
  registers callbacks to receive either a promise's eventual value or the reason
  why the promise cannot be fulfilled.

  Terminology
  -----------

  - `promise` is an object or function with a `then` method whose behavior conforms to this specification.
  - `thenable` is an object or function that defines a `then` method.
  - `value` is any legal JavaScript value (including undefined, a thenable, or a promise).
  - `exception` is a value that is thrown using the throw statement.
  - `reason` is a value that indicates why a promise was rejected.
  - `settled` the final resting state of a promise, fulfilled or rejected.

  A promise can be in one of three states: pending, fulfilled, or rejected.

  Promises that are fulfilled have a fulfillment value and are in the fulfilled
  state.  Promises that are rejected have a rejection reason and are in the
  rejected state.  A fulfillment value is never a thenable.

  Promises can also be said to *resolve* a value.  If this value is also a
  promise, then the original promise's settled state will match the value's
  settled state.  So a promise that *resolves* a promise that rejects will
  itself reject, and a promise that *resolves* a promise that fulfills will
  itself fulfill.


  Basic Usage:
  ------------

  ```js
  let promise = new Promise(function(resolve, reject) {
    // on success
    resolve(value);

    // on failure
    reject(reason);
  });

  promise.then(function(value) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Advanced Usage:
  ---------------

  Promises shine when abstracting away asynchronous interactions such as
  `XMLHttpRequest`s.

  ```js
  function getJSON(url) {
    return new Promise(function(resolve, reject){
      let xhr = new XMLHttpRequest();

      xhr.open('GET', url);
      xhr.onreadystatechange = handler;
      xhr.responseType = 'json';
      xhr.setRequestHeader('Accept', 'application/json');
      xhr.send();

      function handler() {
        if (this.readyState === this.DONE) {
          if (this.status === 200) {
            resolve(this.response);
          } else {
            reject(new Error('getJSON: `' + url + '` failed with status: [' + this.status + ']'));
          }
        }
      };
    });
  }

  getJSON('/posts.json').then(function(json) {
    // on fulfillment
  }, function(reason) {
    // on rejection
  });
  ```

  Unlike callbacks, promises are great composable primitives.

  ```js
  Promise.all([
    getJSON('/posts'),
    getJSON('/comments')
  ]).then(function(values){
    values[0] // => postsJSON
    values[1] // => commentsJSON

    return values;
  });
  ```

  @class Promise
  @param {function} resolver
  Useful for tooling.
  @constructor
*/
function Promise$2(resolver) {
  this[PROMISE_ID] = nextId();
  this._result = this._state = undefined;
  this._subscribers = [];

  if (noop !== resolver) {
    typeof resolver !== 'function' && needsResolver();
    this instanceof Promise$2 ? initializePromise(this, resolver) : needsNew();
  }
}

Promise$2.all = all$1;
Promise$2.race = race$1;
Promise$2.resolve = resolve$1;
Promise$2.reject = reject$1;
Promise$2._setScheduler = setScheduler;
Promise$2._setAsap = setAsap;
Promise$2._asap = asap;

Promise$2.prototype = {
  constructor: Promise$2,

  /**
    The primary way of interacting with a promise is through its `then` method,
    which registers callbacks to receive either a promise's eventual value or the
    reason why the promise cannot be fulfilled.
  
    ```js
    findUser().then(function(user){
      // user is available
    }, function(reason){
      // user is unavailable, and you are given the reason why
    });
    ```
  
    Chaining
    --------
  
    The return value of `then` is itself a promise.  This second, 'downstream'
    promise is resolved with the return value of the first promise's fulfillment
    or rejection handler, or rejected if the handler throws an exception.
  
    ```js
    findUser().then(function (user) {
      return user.name;
    }, function (reason) {
      return 'default name';
    }).then(function (userName) {
      // If `findUser` fulfilled, `userName` will be the user's name, otherwise it
      // will be `'default name'`
    });
  
    findUser().then(function (user) {
      throw new Error('Found user, but still unhappy');
    }, function (reason) {
      throw new Error('`findUser` rejected and we're unhappy');
    }).then(function (value) {
      // never reached
    }, function (reason) {
      // if `findUser` fulfilled, `reason` will be 'Found user, but still unhappy'.
      // If `findUser` rejected, `reason` will be '`findUser` rejected and we're unhappy'.
    });
    ```
    If the downstream promise does not specify a rejection handler, rejection reasons will be propagated further downstream.
  
    ```js
    findUser().then(function (user) {
      throw new PedagogicalException('Upstream error');
    }).then(function (value) {
      // never reached
    }).then(function (value) {
      // never reached
    }, function (reason) {
      // The `PedgagocialException` is propagated all the way down to here
    });
    ```
  
    Assimilation
    ------------
  
    Sometimes the value you want to propagate to a downstream promise can only be
    retrieved asynchronously. This can be achieved by returning a promise in the
    fulfillment or rejection handler. The downstream promise will then be pending
    until the returned promise is settled. This is called *assimilation*.
  
    ```js
    findUser().then(function (user) {
      return findCommentsByAuthor(user);
    }).then(function (comments) {
      // The user's comments are now available
    });
    ```
  
    If the assimliated promise rejects, then the downstream promise will also reject.
  
    ```js
    findUser().then(function (user) {
      return findCommentsByAuthor(user);
    }).then(function (comments) {
      // If `findCommentsByAuthor` fulfills, we'll have the value here
    }, function (reason) {
      // If `findCommentsByAuthor` rejects, we'll have the reason here
    });
    ```
  
    Simple Example
    --------------
  
    Synchronous Example
  
    ```javascript
    let result;
  
    try {
      result = findResult();
      // success
    } catch(reason) {
      // failure
    }
    ```
  
    Errback Example
  
    ```js
    findResult(function(result, err){
      if (err) {
        // failure
      } else {
        // success
      }
    });
    ```
  
    Promise Example;
  
    ```javascript
    findResult().then(function(result){
      // success
    }, function(reason){
      // failure
    });
    ```
  
    Advanced Example
    --------------
  
    Synchronous Example
  
    ```javascript
    let author, books;
  
    try {
      author = findAuthor();
      books  = findBooksByAuthor(author);
      // success
    } catch(reason) {
      // failure
    }
    ```
  
    Errback Example
  
    ```js
  
    function foundBooks(books) {
  
    }
  
    function failure(reason) {
  
    }
  
    findAuthor(function(author, err){
      if (err) {
        failure(err);
        // failure
      } else {
        try {
          findBoooksByAuthor(author, function(books, err) {
            if (err) {
              failure(err);
            } else {
              try {
                foundBooks(books);
              } catch(reason) {
                failure(reason);
              }
            }
          });
        } catch(error) {
          failure(err);
        }
        // success
      }
    });
    ```
  
    Promise Example;
  
    ```javascript
    findAuthor().
      then(findBooksByAuthor).
      then(function(books){
        // found books
    }).catch(function(reason){
      // something went wrong
    });
    ```
  
    @method then
    @param {Function} onFulfilled
    @param {Function} onRejected
    Useful for tooling.
    @return {Promise}
  */
  then: then,

  /**
    `catch` is simply sugar for `then(undefined, onRejection)` which makes it the same
    as the catch block of a try/catch statement.
  
    ```js
    function findAuthor(){
      throw new Error('couldn't find that author');
    }
  
    // synchronous
    try {
      findAuthor();
    } catch(reason) {
      // something went wrong
    }
  
    // async with promises
    findAuthor().catch(function(reason){
      // something went wrong
    });
    ```
  
    @method catch
    @param {Function} onRejection
    Useful for tooling.
    @return {Promise}
  */
  'catch': function _catch(onRejection) {
    return this.then(null, onRejection);
  }
};

/*global self*/
function polyfill$1() {
    var local = undefined;

    if (typeof global !== 'undefined') {
        local = global;
    } else if (typeof self !== 'undefined') {
        local = self;
    } else {
        try {
            local = Function('return this')();
        } catch (e) {
            throw new Error('polyfill failed because global object is unavailable in this environment');
        }
    }

    var P = local.Promise;

    if (P) {
        var promiseToString = null;
        try {
            promiseToString = Object.prototype.toString.call(P.resolve());
        } catch (e) {
            // silently ignored
        }

        if (promiseToString === '[object Promise]' && !P.cast) {
            return;
        }
    }

    local.Promise = Promise$2;
}

// Strange compat..
Promise$2.polyfill = polyfill$1;
Promise$2.Promise = Promise$2;

return Promise$2;

})));



}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":98}],32:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],33:[function(require,module,exports){
function format(fmt) {
  var re = /(%?)(%([jds]))/g
    , args = Array.prototype.slice.call(arguments, 1);
  if(args.length) {
    fmt = fmt.replace(re, function(match, escaped, ptn, flag) {
      var arg = args.shift();
      switch(flag) {
        case 's':
          arg = '' + arg;
          break;
        case 'd':
          arg = Number(arg);
          break;
        case 'j':
          arg = JSON.stringify(arg);
          break;
      }
      if(!escaped) {
        return arg; 
      }
      args.unshift(arg);
      return match;
    })
  }

  // arguments remain after formatting
  if(args.length) {
    fmt += ' ' + args.join(' ');
  }

  // update escaped %% values
  fmt = fmt.replace(/%{2,2}/g, '%');

  return '' + fmt;
}

module.exports = format;

},{}],34:[function(require,module,exports){
var http = require('http');

var https = module.exports;

for (var key in http) {
    if (http.hasOwnProperty(key)) https[key] = http[key];
};

https.request = function (params, cb) {
    if (!params) params = {};
    params.scheme = 'https';
    params.protocol = 'https:';
    return http.request.call(this, params, cb);
}

},{"http":114}],35:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],36:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],37:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}],38:[function(require,module,exports){
var toString = {}.toString;

module.exports = Array.isArray || function (arr) {
  return toString.call(arr) == '[object Array]';
};

},{}],39:[function(require,module,exports){
/*
 * Author: Alex Kocharin <alex@kocharin.ru>
 * GIT: https://github.com/rlidwka/jju
 * License: WTFPL, grab your copy here: http://www.wtfpl.net/txt/copying/
 */

// RTFM: http://www.ecma-international.org/publications/files/ECMA-ST/Ecma-262.pdf

var Uni = require('./unicode')

function isHexDigit(x) {
  return (x >= '0' && x <= '9')
      || (x >= 'A' && x <= 'F')
      || (x >= 'a' && x <= 'f')
}

function isOctDigit(x) {
  return x >= '0' && x <= '7'
}

function isDecDigit(x) {
  return x >= '0' && x <= '9'
}

var unescapeMap = {
  '\'': '\'',
  '"' : '"',
  '\\': '\\',
  'b' : '\b',
  'f' : '\f',
  'n' : '\n',
  'r' : '\r',
  't' : '\t',
  'v' : '\v',
  '/' : '/',
}

function formatError(input, msg, position, lineno, column, json5) {
  var result = msg + ' at ' + (lineno + 1) + ':' + (column + 1)
    , tmppos = position - column - 1
    , srcline = ''
    , underline = ''

  var isLineTerminator = json5 ? Uni.isLineTerminator : Uni.isLineTerminatorJSON

  // output no more than 70 characters before the wrong ones
  if (tmppos < position - 70) {
    tmppos = position - 70
  }

  while (1) {
    var chr = input[++tmppos]

    if (isLineTerminator(chr) || tmppos === input.length) {
      if (position >= tmppos) {
        // ending line error, so show it after the last char
        underline += '^'
      }
      break
    }
    srcline += chr

    if (position === tmppos) {
      underline += '^'
    } else if (position > tmppos) {
      underline += input[tmppos] === '\t' ? '\t' : ' '
    }

    // output no more than 78 characters on the string
    if (srcline.length > 78) break
  }

  return result + '\n' + srcline + '\n' + underline
}

function parse(input, options) {
  // parse as a standard JSON mode
  var json5 = !(options.mode === 'json' || options.legacy)
  var isLineTerminator = json5 ? Uni.isLineTerminator : Uni.isLineTerminatorJSON
  var isWhiteSpace = json5 ? Uni.isWhiteSpace : Uni.isWhiteSpaceJSON

  var length = input.length
    , lineno = 0
    , linestart = 0
    , position = 0
    , stack = []

  var tokenStart = function() {}
  var tokenEnd = function(v) {return v}

  /* tokenize({
       raw: '...',
       type: 'whitespace'|'comment'|'key'|'literal'|'separator'|'newline',
       value: 'number'|'string'|'whatever',
       path: [...],
     })
  */
  if (options._tokenize) {
    ;(function() {
      var start = null
      tokenStart = function() {
        if (start !== null) throw Error('internal error, token overlap')
        start = position
      }

      tokenEnd = function(v, type) {
        if (start != position) {
          var hash = {
            raw: input.substr(start, position-start),
            type: type,
            stack: stack.slice(0),
          }
          if (v !== undefined) hash.value = v
          options._tokenize.call(null, hash)
        }
        start = null
        return v
      }
    })()
  }

  function fail(msg) {
    var column = position - linestart

    if (!msg) {
      if (position < length) {
        var token = '\'' +
          JSON
            .stringify(input[position])
            .replace(/^"|"$/g, '')
            .replace(/'/g, "\\'")
            .replace(/\\"/g, '"')
          + '\''

        if (!msg) msg = 'Unexpected token ' + token
      } else {
        if (!msg) msg = 'Unexpected end of input'
      }
    }

    var error = SyntaxError(formatError(input, msg, position, lineno, column, json5))
    error.row = lineno + 1
    error.column = column + 1
    throw error
  }

  function newline(chr) {
    // account for <cr><lf>
    if (chr === '\r' && input[position] === '\n') position++
    linestart = position
    lineno++
  }

  function parseGeneric() {
    var result

    while (position < length) {
      tokenStart()
      var chr = input[position++]

      if (chr === '"' || (chr === '\'' && json5)) {
        return tokenEnd(parseString(chr), 'literal')

      } else if (chr === '{') {
        tokenEnd(undefined, 'separator')
        return parseObject()

      } else if (chr === '[') {
        tokenEnd(undefined, 'separator')
        return parseArray()

      } else if (chr === '-'
             ||  chr === '.'
             ||  isDecDigit(chr)
                 //           + number       Infinity          NaN
             ||  (json5 && (chr === '+' || chr === 'I' || chr === 'N'))
      ) {
        return tokenEnd(parseNumber(), 'literal')

      } else if (chr === 'n') {
        parseKeyword('null')
        return tokenEnd(null, 'literal')

      } else if (chr === 't') {
        parseKeyword('true')
        return tokenEnd(true, 'literal')

      } else if (chr === 'f') {
        parseKeyword('false')
        return tokenEnd(false, 'literal')

      } else {
        position--
        return tokenEnd(undefined)
      }
    }
  }

  function parseKey() {
    var result

    while (position < length) {
      tokenStart()
      var chr = input[position++]

      if (chr === '"' || (chr === '\'' && json5)) {
        return tokenEnd(parseString(chr), 'key')

      } else if (chr === '{') {
        tokenEnd(undefined, 'separator')
        return parseObject()

      } else if (chr === '[') {
        tokenEnd(undefined, 'separator')
        return parseArray()

      } else if (chr === '.'
             ||  isDecDigit(chr)
      ) {
        return tokenEnd(parseNumber(true), 'key')

      } else if (json5
             &&  Uni.isIdentifierStart(chr) || (chr === '\\' && input[position] === 'u')) {
        // unicode char or a unicode sequence
        var rollback = position - 1
        var result = parseIdentifier()

        if (result === undefined) {
          position = rollback
          return tokenEnd(undefined)
        } else {
          return tokenEnd(result, 'key')
        }

      } else {
        position--
        return tokenEnd(undefined)
      }
    }
  }

  function skipWhiteSpace() {
    tokenStart()
    while (position < length) {
      var chr = input[position++]

      if (isLineTerminator(chr)) {
        position--
        tokenEnd(undefined, 'whitespace')
        tokenStart()
        position++
        newline(chr)
        tokenEnd(undefined, 'newline')
        tokenStart()

      } else if (isWhiteSpace(chr)) {
        // nothing

      } else if (chr === '/'
             && json5
             && (input[position] === '/' || input[position] === '*')
      ) {
        position--
        tokenEnd(undefined, 'whitespace')
        tokenStart()
        position++
        skipComment(input[position++] === '*')
        tokenEnd(undefined, 'comment')
        tokenStart()

      } else {
        position--
        break
      }
    }
    return tokenEnd(undefined, 'whitespace')
  }

  function skipComment(multi) {
    while (position < length) {
      var chr = input[position++]

      if (isLineTerminator(chr)) {
        // LineTerminator is an end of singleline comment
        if (!multi) {
          // let parent function deal with newline
          position--
          return
        }

        newline(chr)

      } else if (chr === '*' && multi) {
        // end of multiline comment
        if (input[position] === '/') {
          position++
          return
        }

      } else {
        // nothing
      }
    }

    if (multi) {
      fail('Unclosed multiline comment')
    }
  }

  function parseKeyword(keyword) {
    // keyword[0] is not checked because it should've checked earlier
    var _pos = position
    var len = keyword.length
    for (var i=1; i<len; i++) {
      if (position >= length || keyword[i] != input[position]) {
        position = _pos-1
        fail()
      }
      position++
    }
  }

  function parseObject() {
    var result = options.null_prototype ? Object.create(null) : {}
      , empty_object = {}
      , is_non_empty = false

    while (position < length) {
      skipWhiteSpace()
      var item1 = parseKey()
      skipWhiteSpace()
      tokenStart()
      var chr = input[position++]
      tokenEnd(undefined, 'separator')

      if (chr === '}' && item1 === undefined) {
        if (!json5 && is_non_empty) {
          position--
          fail('Trailing comma in object')
        }
        return result

      } else if (chr === ':' && item1 !== undefined) {
        skipWhiteSpace()
        stack.push(item1)
        var item2 = parseGeneric()
        stack.pop()

        if (item2 === undefined) fail('No value found for key ' + item1)
        if (typeof(item1) !== 'string') {
          if (!json5 || typeof(item1) !== 'number') {
            fail('Wrong key type: ' + item1)
          }
        }

        if ((item1 in empty_object || empty_object[item1] != null) && options.reserved_keys !== 'replace') {
          if (options.reserved_keys === 'throw') {
            fail('Reserved key: ' + item1)
          } else {
            // silently ignore it
          }
        } else {
          if (typeof(options.reviver) === 'function') {
            item2 = options.reviver.call(null, item1, item2)
          }

          if (item2 !== undefined) {
            is_non_empty = true
            Object.defineProperty(result, item1, {
              value: item2,
              enumerable: true,
              configurable: true,
              writable: true,
            })
          }
        }

        skipWhiteSpace()

        tokenStart()
        var chr = input[position++]
        tokenEnd(undefined, 'separator')

        if (chr === ',') {
          continue

        } else if (chr === '}') {
          return result

        } else {
          fail()
        }

      } else {
        position--
        fail()
      }
    }

    fail()
  }

  function parseArray() {
    var result = []

    while (position < length) {
      skipWhiteSpace()
      stack.push(result.length)
      var item = parseGeneric()
      stack.pop()
      skipWhiteSpace()
      tokenStart()
      var chr = input[position++]
      tokenEnd(undefined, 'separator')

      if (item !== undefined) {
        if (typeof(options.reviver) === 'function') {
          item = options.reviver.call(null, String(result.length), item)
        }
        if (item === undefined) {
          result.length++
          item = true // hack for check below, not included into result
        } else {
          result.push(item)
        }
      }

      if (chr === ',') {
        if (item === undefined) {
          fail('Elisions are not supported')
        }

      } else if (chr === ']') {
        if (!json5 && item === undefined && result.length) {
          position--
          fail('Trailing comma in array')
        }
        return result

      } else {
        position--
        fail()
      }
    }
  }

  function parseNumber() {
    // rewind because we don't know first char
    position--

    var start = position
      , chr = input[position++]
      , t

    var to_num = function(is_octal) {
      var str = input.substr(start, position - start)

      if (is_octal) {
        var result = parseInt(str.replace(/^0o?/, ''), 8)
      } else {
        var result = Number(str)
      }

      if (Number.isNaN(result)) {
        position--
        fail('Bad numeric literal - "' + input.substr(start, position - start + 1) + '"')
      } else if (!json5 && !str.match(/^-?(0|[1-9][0-9]*)(\.[0-9]+)?(e[+-]?[0-9]+)?$/i)) {
        // additional restrictions imposed by json
        position--
        fail('Non-json numeric literal - "' + input.substr(start, position - start + 1) + '"')
      } else {
        return result
      }
    }

    // ex: -5982475.249875e+29384
    //     ^ skipping this
    if (chr === '-' || (chr === '+' && json5)) chr = input[position++]

    if (chr === 'N' && json5) {
      parseKeyword('NaN')
      return NaN
    }

    if (chr === 'I' && json5) {
      parseKeyword('Infinity')

      // returning +inf or -inf
      return to_num()
    }

    if (chr >= '1' && chr <= '9') {
      // ex: -5982475.249875e+29384
      //        ^^^ skipping these
      while (position < length && isDecDigit(input[position])) position++
      chr = input[position++]
    }

    // special case for leading zero: 0.123456
    if (chr === '0') {
      chr = input[position++]

      //             new syntax, "0o777"           old syntax, "0777"
      var is_octal = chr === 'o' || chr === 'O' || isOctDigit(chr)
      var is_hex = chr === 'x' || chr === 'X'

      if (json5 && (is_octal || is_hex)) {
        while (position < length
           &&  (is_hex ? isHexDigit : isOctDigit)( input[position] )
        ) position++

        var sign = 1
        if (input[start] === '-') {
          sign = -1
          start++
        } else if (input[start] === '+') {
          start++
        }

        return sign * to_num(is_octal)
      }
    }

    if (chr === '.') {
      // ex: -5982475.249875e+29384
      //                ^^^ skipping these
      while (position < length && isDecDigit(input[position])) position++
      chr = input[position++]
    }

    if (chr === 'e' || chr === 'E') {
      chr = input[position++]
      if (chr === '-' || chr === '+') position++
      // ex: -5982475.249875e+29384
      //                       ^^^ skipping these
      while (position < length && isDecDigit(input[position])) position++
      chr = input[position++]
    }

    // we have char in the buffer, so count for it
    position--
    return to_num()
  }

  function parseIdentifier() {
    // rewind because we don't know first char
    position--

    var result = ''

    while (position < length) {
      var chr = input[position++]

      if (chr === '\\'
      &&  input[position] === 'u'
      &&  isHexDigit(input[position+1])
      &&  isHexDigit(input[position+2])
      &&  isHexDigit(input[position+3])
      &&  isHexDigit(input[position+4])
      ) {
        // UnicodeEscapeSequence
        chr = String.fromCharCode(parseInt(input.substr(position+1, 4), 16))
        position += 5
      }

      if (result.length) {
        // identifier started
        if (Uni.isIdentifierPart(chr)) {
          result += chr
        } else {
          position--
          return result
        }

      } else {
        if (Uni.isIdentifierStart(chr)) {
          result += chr
        } else {
          return undefined
        }
      }
    }

    fail()
  }

  function parseString(endChar) {
    // 7.8.4 of ES262 spec
    var result = ''

    while (position < length) {
      var chr = input[position++]

      if (chr === endChar) {
        return result

      } else if (chr === '\\') {
        if (position >= length) fail()
        chr = input[position++]

        if (unescapeMap[chr] && (json5 || (chr != 'v' && chr != "'"))) {
          result += unescapeMap[chr]

        } else if (json5 && isLineTerminator(chr)) {
          // line continuation
          newline(chr)

        } else if (chr === 'u' || (chr === 'x' && json5)) {
          // unicode/character escape sequence
          var off = chr === 'u' ? 4 : 2

          // validation for \uXXXX
          for (var i=0; i<off; i++) {
            if (position >= length) fail()
            if (!isHexDigit(input[position])) fail('Bad escape sequence')
            position++
          }

          result += String.fromCharCode(parseInt(input.substr(position-off, off), 16))
        } else if (json5 && isOctDigit(chr)) {
          if (chr < '4' && isOctDigit(input[position]) && isOctDigit(input[position+1])) {
            // three-digit octal
            var digits = 3
          } else if (isOctDigit(input[position])) {
            // two-digit octal
            var digits = 2
          } else {
            var digits = 1
          }
          position += digits - 1
          result += String.fromCharCode(parseInt(input.substr(position-digits, digits), 8))
          /*if (!isOctDigit(input[position])) {
            // \0 is allowed still
            result += '\0'
          } else {
            fail('Octal literals are not supported')
          }*/

        } else if (json5) {
          // \X -> x
          result += chr

        } else {
          position--
          fail()
        }

      } else if (isLineTerminator(chr)) {
        fail()

      } else {
        if (!json5 && chr.charCodeAt(0) < 32) {
          position--
          fail('Unexpected control character')
        }

        // SourceCharacter but not one of " or \ or LineTerminator
        result += chr
      }
    }

    fail()
  }

  skipWhiteSpace()
  var return_value = parseGeneric()
  if (return_value !== undefined || position < length) {
    skipWhiteSpace()

    if (position >= length) {
      if (typeof(options.reviver) === 'function') {
        return_value = options.reviver.call(null, '', return_value)
      }
      return return_value
    } else {
      fail()
    }

  } else {
    if (position) {
      fail('No data, only a whitespace')
    } else {
      fail('No data, empty input')
    }
  }
}

/*
 * parse(text, options)
 * or
 * parse(text, reviver)
 *
 * where:
 * text - string
 * options - object
 * reviver - function
 */
module.exports.parse = function parseJSON(input, options) {
  // support legacy functions
  if (typeof(options) === 'function') {
    options = {
      reviver: options
    }
  }

  if (input === undefined) {
    // parse(stringify(x)) should be equal x
    // with JSON functions it is not 'cause of undefined
    // so we're fixing it
    return undefined
  }

  // JSON.parse compat
  if (typeof(input) !== 'string') input = String(input)
  if (options == null) options = {}
  if (options.reserved_keys == null) options.reserved_keys = 'ignore'

  if (options.reserved_keys === 'throw' || options.reserved_keys === 'ignore') {
    if (options.null_prototype == null) {
      options.null_prototype = true
    }
  }

  try {
    return parse(input, options)
  } catch(err) {
    // jju is a recursive parser, so JSON.parse("{{{{{{{") could blow up the stack
    //
    // this catch is used to skip all those internal calls
    if (err instanceof SyntaxError && err.row != null && err.column != null) {
      var old_err = err
      err = SyntaxError(old_err.message)
      err.column = old_err.column
      err.row = old_err.row
    }
    throw err
  }
}

module.exports.tokenize = function tokenizeJSON(input, options) {
  if (options == null) options = {}

  options._tokenize = function(smth) {
    if (options._addstack) smth.stack.unshift.apply(smth.stack, options._addstack)
    tokens.push(smth)
  }

  var tokens = []
  tokens.data = module.exports.parse(input, options)
  return tokens
}


},{"./unicode":40}],40:[function(require,module,exports){

// This is autogenerated with esprima tools, see:
// https://github.com/ariya/esprima/blob/master/esprima.js
//
// PS: oh God, I hate Unicode

// ECMAScript 5.1/Unicode v6.3.0 NonAsciiIdentifierStart:

var Uni = module.exports

module.exports.isWhiteSpace = function isWhiteSpace(x) {
  // section 7.2, table 2
  return x === '\u0020'
      || x === '\u00A0'
      || x === '\uFEFF' // <-- this is not a Unicode WS, only a JS one
      || (x >= '\u0009' && x <= '\u000D') // 9 A B C D

      // + whitespace characters from unicode, category Zs
      || x === '\u1680'
      || x === '\u180E'
      || (x >= '\u2000' && x <= '\u200A') // 0 1 2 3 4 5 6 7 8 9 A
      || x === '\u2028'
      || x === '\u2029'
      || x === '\u202F'
      || x === '\u205F'
      || x === '\u3000'
}

module.exports.isWhiteSpaceJSON = function isWhiteSpaceJSON(x) {
  return x === '\u0020'
      || x === '\u0009'
      || x === '\u000A'
      || x === '\u000D'
}

module.exports.isLineTerminator = function isLineTerminator(x) {
  // ok, here is the part when JSON is wrong
  // section 7.3, table 3
  return x === '\u000A'
      || x === '\u000D'
      || x === '\u2028'
      || x === '\u2029'
}

module.exports.isLineTerminatorJSON = function isLineTerminatorJSON(x) {
  return x === '\u000A'
      || x === '\u000D'
}

module.exports.isIdentifierStart = function isIdentifierStart(x) {
  return x === '$'
      || x === '_'
      || (x >= 'A' && x <= 'Z')
      || (x >= 'a' && x <= 'z')
      || (x >= '\u0080' && Uni.NonAsciiIdentifierStart.test(x))
}

module.exports.isIdentifierPart = function isIdentifierPart(x) {
  return x === '$'
      || x === '_'
      || (x >= 'A' && x <= 'Z')
      || (x >= 'a' && x <= 'z')
      || (x >= '0' && x <= '9') // <-- addition to Start
      || (x >= '\u0080' && Uni.NonAsciiIdentifierPart.test(x))
}

module.exports.NonAsciiIdentifierStart = /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0\u08A2-\u08AC\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097F\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F0\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191C\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA697\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA80-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/

// ECMAScript 5.1/Unicode v6.3.0 NonAsciiIdentifierPart:

module.exports.NonAsciiIdentifierPart = /[\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u0527\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0\u08A2-\u08AC\u08E4-\u08FE\u0900-\u0963\u0966-\u096F\u0971-\u0977\u0979-\u097F\u0981-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C01-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C33\u0C35-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58\u0C59\u0C60-\u0C63\u0C66-\u0C6F\u0C82\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D02\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D60-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F0\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191C\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1CD0-\u1CD2\u1CD4-\u1CF6\u1D00-\u1DE6\u1DFC-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA697\uA69F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA793\uA7A0-\uA7AA\uA7F8-\uA827\uA840-\uA873\uA880-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A\uAA7B\uAA80-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uABC0-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE26\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC]/

},{}],41:[function(require,module,exports){
'use strict';


var yaml = require('./lib/js-yaml.js');


module.exports = yaml;

},{"./lib/js-yaml.js":42}],42:[function(require,module,exports){
'use strict';


var loader = require('./js-yaml/loader');
var dumper = require('./js-yaml/dumper');


function deprecated(name) {
  return function () {
    throw new Error('Function ' + name + ' is deprecated and cannot be used.');
  };
}


module.exports.Type                = require('./js-yaml/type');
module.exports.Schema              = require('./js-yaml/schema');
module.exports.FAILSAFE_SCHEMA     = require('./js-yaml/schema/failsafe');
module.exports.JSON_SCHEMA         = require('./js-yaml/schema/json');
module.exports.CORE_SCHEMA         = require('./js-yaml/schema/core');
module.exports.DEFAULT_SAFE_SCHEMA = require('./js-yaml/schema/default_safe');
module.exports.DEFAULT_FULL_SCHEMA = require('./js-yaml/schema/default_full');
module.exports.load                = loader.load;
module.exports.loadAll             = loader.loadAll;
module.exports.safeLoad            = loader.safeLoad;
module.exports.safeLoadAll         = loader.safeLoadAll;
module.exports.dump                = dumper.dump;
module.exports.safeDump            = dumper.safeDump;
module.exports.YAMLException       = require('./js-yaml/exception');

// Deprecated schema names from JS-YAML 2.0.x
module.exports.MINIMAL_SCHEMA = require('./js-yaml/schema/failsafe');
module.exports.SAFE_SCHEMA    = require('./js-yaml/schema/default_safe');
module.exports.DEFAULT_SCHEMA = require('./js-yaml/schema/default_full');

// Deprecated functions from JS-YAML 1.x.x
module.exports.scan           = deprecated('scan');
module.exports.parse          = deprecated('parse');
module.exports.compose        = deprecated('compose');
module.exports.addConstructor = deprecated('addConstructor');

},{"./js-yaml/dumper":44,"./js-yaml/exception":45,"./js-yaml/loader":46,"./js-yaml/schema":48,"./js-yaml/schema/core":49,"./js-yaml/schema/default_full":50,"./js-yaml/schema/default_safe":51,"./js-yaml/schema/failsafe":52,"./js-yaml/schema/json":53,"./js-yaml/type":54}],43:[function(require,module,exports){
'use strict';


function isNothing(subject) {
  return (typeof subject === 'undefined') || (subject === null);
}


function isObject(subject) {
  return (typeof subject === 'object') && (subject !== null);
}


function toArray(sequence) {
  if (Array.isArray(sequence)) return sequence;
  else if (isNothing(sequence)) return [];

  return [ sequence ];
}


function extend(target, source) {
  var index, length, key, sourceKeys;

  if (source) {
    sourceKeys = Object.keys(source);

    for (index = 0, length = sourceKeys.length; index < length; index += 1) {
      key = sourceKeys[index];
      target[key] = source[key];
    }
  }

  return target;
}


function repeat(string, count) {
  var result = '', cycle;

  for (cycle = 0; cycle < count; cycle += 1) {
    result += string;
  }

  return result;
}


function isNegativeZero(number) {
  return (number === 0) && (Number.NEGATIVE_INFINITY === 1 / number);
}


module.exports.isNothing      = isNothing;
module.exports.isObject       = isObject;
module.exports.toArray        = toArray;
module.exports.repeat         = repeat;
module.exports.isNegativeZero = isNegativeZero;
module.exports.extend         = extend;

},{}],44:[function(require,module,exports){
'use strict';

/*eslint-disable no-use-before-define*/

var common              = require('./common');
var YAMLException       = require('./exception');
var DEFAULT_FULL_SCHEMA = require('./schema/default_full');
var DEFAULT_SAFE_SCHEMA = require('./schema/default_safe');

var _toString       = Object.prototype.toString;
var _hasOwnProperty = Object.prototype.hasOwnProperty;

var CHAR_TAB                  = 0x09; /* Tab */
var CHAR_LINE_FEED            = 0x0A; /* LF */
var CHAR_SPACE                = 0x20; /* Space */
var CHAR_EXCLAMATION          = 0x21; /* ! */
var CHAR_DOUBLE_QUOTE         = 0x22; /* " */
var CHAR_SHARP                = 0x23; /* # */
var CHAR_PERCENT              = 0x25; /* % */
var CHAR_AMPERSAND            = 0x26; /* & */
var CHAR_SINGLE_QUOTE         = 0x27; /* ' */
var CHAR_ASTERISK             = 0x2A; /* * */
var CHAR_COMMA                = 0x2C; /* , */
var CHAR_MINUS                = 0x2D; /* - */
var CHAR_COLON                = 0x3A; /* : */
var CHAR_GREATER_THAN         = 0x3E; /* > */
var CHAR_QUESTION             = 0x3F; /* ? */
var CHAR_COMMERCIAL_AT        = 0x40; /* @ */
var CHAR_LEFT_SQUARE_BRACKET  = 0x5B; /* [ */
var CHAR_RIGHT_SQUARE_BRACKET = 0x5D; /* ] */
var CHAR_GRAVE_ACCENT         = 0x60; /* ` */
var CHAR_LEFT_CURLY_BRACKET   = 0x7B; /* { */
var CHAR_VERTICAL_LINE        = 0x7C; /* | */
var CHAR_RIGHT_CURLY_BRACKET  = 0x7D; /* } */

var ESCAPE_SEQUENCES = {};

ESCAPE_SEQUENCES[0x00]   = '\\0';
ESCAPE_SEQUENCES[0x07]   = '\\a';
ESCAPE_SEQUENCES[0x08]   = '\\b';
ESCAPE_SEQUENCES[0x09]   = '\\t';
ESCAPE_SEQUENCES[0x0A]   = '\\n';
ESCAPE_SEQUENCES[0x0B]   = '\\v';
ESCAPE_SEQUENCES[0x0C]   = '\\f';
ESCAPE_SEQUENCES[0x0D]   = '\\r';
ESCAPE_SEQUENCES[0x1B]   = '\\e';
ESCAPE_SEQUENCES[0x22]   = '\\"';
ESCAPE_SEQUENCES[0x5C]   = '\\\\';
ESCAPE_SEQUENCES[0x85]   = '\\N';
ESCAPE_SEQUENCES[0xA0]   = '\\_';
ESCAPE_SEQUENCES[0x2028] = '\\L';
ESCAPE_SEQUENCES[0x2029] = '\\P';

var DEPRECATED_BOOLEANS_SYNTAX = [
  'y', 'Y', 'yes', 'Yes', 'YES', 'on', 'On', 'ON',
  'n', 'N', 'no', 'No', 'NO', 'off', 'Off', 'OFF'
];

function compileStyleMap(schema, map) {
  var result, keys, index, length, tag, style, type;

  if (map === null) return {};

  result = {};
  keys = Object.keys(map);

  for (index = 0, length = keys.length; index < length; index += 1) {
    tag = keys[index];
    style = String(map[tag]);

    if (tag.slice(0, 2) === '!!') {
      tag = 'tag:yaml.org,2002:' + tag.slice(2);
    }
    type = schema.compiledTypeMap['fallback'][tag];

    if (type && _hasOwnProperty.call(type.styleAliases, style)) {
      style = type.styleAliases[style];
    }

    result[tag] = style;
  }

  return result;
}

function encodeHex(character) {
  var string, handle, length;

  string = character.toString(16).toUpperCase();

  if (character <= 0xFF) {
    handle = 'x';
    length = 2;
  } else if (character <= 0xFFFF) {
    handle = 'u';
    length = 4;
  } else if (character <= 0xFFFFFFFF) {
    handle = 'U';
    length = 8;
  } else {
    throw new YAMLException('code point within a string may not be greater than 0xFFFFFFFF');
  }

  return '\\' + handle + common.repeat('0', length - string.length) + string;
}

function State(options) {
  this.schema       = options['schema'] || DEFAULT_FULL_SCHEMA;
  this.indent       = Math.max(1, (options['indent'] || 2));
  this.skipInvalid  = options['skipInvalid'] || false;
  this.flowLevel    = (common.isNothing(options['flowLevel']) ? -1 : options['flowLevel']);
  this.styleMap     = compileStyleMap(this.schema, options['styles'] || null);
  this.sortKeys     = options['sortKeys'] || false;
  this.lineWidth    = options['lineWidth'] || 80;
  this.noRefs       = options['noRefs'] || false;
  this.noCompatMode = options['noCompatMode'] || false;
  this.condenseFlow = options['condenseFlow'] || false;

  this.implicitTypes = this.schema.compiledImplicit;
  this.explicitTypes = this.schema.compiledExplicit;

  this.tag = null;
  this.result = '';

  this.duplicates = [];
  this.usedDuplicates = null;
}

// Indents every line in a string. Empty lines (\n only) are not indented.
function indentString(string, spaces) {
  var ind = common.repeat(' ', spaces),
      position = 0,
      next = -1,
      result = '',
      line,
      length = string.length;

  while (position < length) {
    next = string.indexOf('\n', position);
    if (next === -1) {
      line = string.slice(position);
      position = length;
    } else {
      line = string.slice(position, next + 1);
      position = next + 1;
    }

    if (line.length && line !== '\n') result += ind;

    result += line;
  }

  return result;
}

function generateNextLine(state, level) {
  return '\n' + common.repeat(' ', state.indent * level);
}

function testImplicitResolving(state, str) {
  var index, length, type;

  for (index = 0, length = state.implicitTypes.length; index < length; index += 1) {
    type = state.implicitTypes[index];

    if (type.resolve(str)) {
      return true;
    }
  }

  return false;
}

// [33] s-white ::= s-space | s-tab
function isWhitespace(c) {
  return c === CHAR_SPACE || c === CHAR_TAB;
}

// Returns true if the character can be printed without escaping.
// From YAML 1.2: "any allowed characters known to be non-printable
// should also be escaped. [However,] This isn’t mandatory"
// Derived from nb-char - \t - #x85 - #xA0 - #x2028 - #x2029.
function isPrintable(c) {
  return  (0x00020 <= c && c <= 0x00007E)
      || ((0x000A1 <= c && c <= 0x00D7FF) && c !== 0x2028 && c !== 0x2029)
      || ((0x0E000 <= c && c <= 0x00FFFD) && c !== 0xFEFF /* BOM */)
      ||  (0x10000 <= c && c <= 0x10FFFF);
}

// Simplified test for values allowed after the first character in plain style.
function isPlainSafe(c) {
  // Uses a subset of nb-char - c-flow-indicator - ":" - "#"
  // where nb-char ::= c-printable - b-char - c-byte-order-mark.
  return isPrintable(c) && c !== 0xFEFF
    // - c-flow-indicator
    && c !== CHAR_COMMA
    && c !== CHAR_LEFT_SQUARE_BRACKET
    && c !== CHAR_RIGHT_SQUARE_BRACKET
    && c !== CHAR_LEFT_CURLY_BRACKET
    && c !== CHAR_RIGHT_CURLY_BRACKET
    // - ":" - "#"
    && c !== CHAR_COLON
    && c !== CHAR_SHARP;
}

// Simplified test for values allowed as the first character in plain style.
function isPlainSafeFirst(c) {
  // Uses a subset of ns-char - c-indicator
  // where ns-char = nb-char - s-white.
  return isPrintable(c) && c !== 0xFEFF
    && !isWhitespace(c) // - s-white
    // - (c-indicator ::=
    // “-” | “?” | “:” | “,” | “[” | “]” | “{” | “}”
    && c !== CHAR_MINUS
    && c !== CHAR_QUESTION
    && c !== CHAR_COLON
    && c !== CHAR_COMMA
    && c !== CHAR_LEFT_SQUARE_BRACKET
    && c !== CHAR_RIGHT_SQUARE_BRACKET
    && c !== CHAR_LEFT_CURLY_BRACKET
    && c !== CHAR_RIGHT_CURLY_BRACKET
    // | “#” | “&” | “*” | “!” | “|” | “>” | “'” | “"”
    && c !== CHAR_SHARP
    && c !== CHAR_AMPERSAND
    && c !== CHAR_ASTERISK
    && c !== CHAR_EXCLAMATION
    && c !== CHAR_VERTICAL_LINE
    && c !== CHAR_GREATER_THAN
    && c !== CHAR_SINGLE_QUOTE
    && c !== CHAR_DOUBLE_QUOTE
    // | “%” | “@” | “`”)
    && c !== CHAR_PERCENT
    && c !== CHAR_COMMERCIAL_AT
    && c !== CHAR_GRAVE_ACCENT;
}

var STYLE_PLAIN   = 1,
    STYLE_SINGLE  = 2,
    STYLE_LITERAL = 3,
    STYLE_FOLDED  = 4,
    STYLE_DOUBLE  = 5;

// Determines which scalar styles are possible and returns the preferred style.
// lineWidth = -1 => no limit.
// Pre-conditions: str.length > 0.
// Post-conditions:
//    STYLE_PLAIN or STYLE_SINGLE => no \n are in the string.
//    STYLE_LITERAL => no lines are suitable for folding (or lineWidth is -1).
//    STYLE_FOLDED => a line > lineWidth and can be folded (and lineWidth != -1).
function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType) {
  var i;
  var char;
  var hasLineBreak = false;
  var hasFoldableLine = false; // only checked if shouldTrackWidth
  var shouldTrackWidth = lineWidth !== -1;
  var previousLineBreak = -1; // count the first line correctly
  var plain = isPlainSafeFirst(string.charCodeAt(0))
          && !isWhitespace(string.charCodeAt(string.length - 1));

  if (singleLineOnly) {
    // Case: no block styles.
    // Check for disallowed characters to rule out plain and single.
    for (i = 0; i < string.length; i++) {
      char = string.charCodeAt(i);
      if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char);
    }
  } else {
    // Case: block styles permitted.
    for (i = 0; i < string.length; i++) {
      char = string.charCodeAt(i);
      if (char === CHAR_LINE_FEED) {
        hasLineBreak = true;
        // Check if any line can be folded.
        if (shouldTrackWidth) {
          hasFoldableLine = hasFoldableLine ||
            // Foldable line = too long, and not more-indented.
            (i - previousLineBreak - 1 > lineWidth &&
             string[previousLineBreak + 1] !== ' ');
          previousLineBreak = i;
        }
      } else if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char);
    }
    // in case the end is missing a \n
    hasFoldableLine = hasFoldableLine || (shouldTrackWidth &&
      (i - previousLineBreak - 1 > lineWidth &&
       string[previousLineBreak + 1] !== ' '));
  }
  // Although every style can represent \n without escaping, prefer block styles
  // for multiline, since they're more readable and they don't add empty lines.
  // Also prefer folding a super-long line.
  if (!hasLineBreak && !hasFoldableLine) {
    // Strings interpretable as another type have to be quoted;
    // e.g. the string 'true' vs. the boolean true.
    return plain && !testAmbiguousType(string)
      ? STYLE_PLAIN : STYLE_SINGLE;
  }
  // Edge case: block indentation indicator can only have one digit.
  if (string[0] === ' ' && indentPerLevel > 9) {
    return STYLE_DOUBLE;
  }
  // At this point we know block styles are valid.
  // Prefer literal style unless we want to fold.
  return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
}

// Note: line breaking/folding is implemented for only the folded style.
// NB. We drop the last trailing newline (if any) of a returned block scalar
//  since the dumper adds its own newline. This always works:
//    • No ending newline => unaffected; already using strip "-" chomping.
//    • Ending newline    => removed then restored.
//  Importantly, this keeps the "+" chomp indicator from gaining an extra line.
function writeScalar(state, string, level, iskey) {
  state.dump = (function () {
    if (string.length === 0) {
      return "''";
    }
    if (!state.noCompatMode &&
        DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1) {
      return "'" + string + "'";
    }

    var indent = state.indent * Math.max(1, level); // no 0-indent scalars
    // As indentation gets deeper, let the width decrease monotonically
    // to the lower bound min(state.lineWidth, 40).
    // Note that this implies
    //  state.lineWidth ≤ 40 + state.indent: width is fixed at the lower bound.
    //  state.lineWidth > 40 + state.indent: width decreases until the lower bound.
    // This behaves better than a constant minimum width which disallows narrower options,
    // or an indent threshold which causes the width to suddenly increase.
    var lineWidth = state.lineWidth === -1
      ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);

    // Without knowing if keys are implicit/explicit, assume implicit for safety.
    var singleLineOnly = iskey
      // No block styles in flow mode.
      || (state.flowLevel > -1 && level >= state.flowLevel);
    function testAmbiguity(string) {
      return testImplicitResolving(state, string);
    }

    switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth, testAmbiguity)) {
      case STYLE_PLAIN:
        return string;
      case STYLE_SINGLE:
        return "'" + string.replace(/'/g, "''") + "'";
      case STYLE_LITERAL:
        return '|' + blockHeader(string, state.indent)
          + dropEndingNewline(indentString(string, indent));
      case STYLE_FOLDED:
        return '>' + blockHeader(string, state.indent)
          + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
      case STYLE_DOUBLE:
        return '"' + escapeString(string, lineWidth) + '"';
      default:
        throw new YAMLException('impossible error: invalid scalar style');
    }
  }());
}

// Pre-conditions: string is valid for a block scalar, 1 <= indentPerLevel <= 9.
function blockHeader(string, indentPerLevel) {
  var indentIndicator = (string[0] === ' ') ? String(indentPerLevel) : '';

  // note the special case: the string '\n' counts as a "trailing" empty line.
  var clip =          string[string.length - 1] === '\n';
  var keep = clip && (string[string.length - 2] === '\n' || string === '\n');
  var chomp = keep ? '+' : (clip ? '' : '-');

  return indentIndicator + chomp + '\n';
}

// (See the note for writeScalar.)
function dropEndingNewline(string) {
  return string[string.length - 1] === '\n' ? string.slice(0, -1) : string;
}

// Note: a long line without a suitable break point will exceed the width limit.
// Pre-conditions: every char in str isPrintable, str.length > 0, width > 0.
function foldString(string, width) {
  // In folded style, $k$ consecutive newlines output as $k+1$ newlines—
  // unless they're before or after a more-indented line, or at the very
  // beginning or end, in which case $k$ maps to $k$.
  // Therefore, parse each chunk as newline(s) followed by a content line.
  var lineRe = /(\n+)([^\n]*)/g;

  // first line (possibly an empty line)
  var result = (function () {
    var nextLF = string.indexOf('\n');
    nextLF = nextLF !== -1 ? nextLF : string.length;
    lineRe.lastIndex = nextLF;
    return foldLine(string.slice(0, nextLF), width);
  }());
  // If we haven't reached the first content line yet, don't add an extra \n.
  var prevMoreIndented = string[0] === '\n' || string[0] === ' ';
  var moreIndented;

  // rest of the lines
  var match;
  while ((match = lineRe.exec(string))) {
    var prefix = match[1], line = match[2];
    moreIndented = (line[0] === ' ');
    result += prefix
      + (!prevMoreIndented && !moreIndented && line !== ''
        ? '\n' : '')
      + foldLine(line, width);
    prevMoreIndented = moreIndented;
  }

  return result;
}

// Greedy line breaking.
// Picks the longest line under the limit each time,
// otherwise settles for the shortest line over the limit.
// NB. More-indented lines *cannot* be folded, as that would add an extra \n.
function foldLine(line, width) {
  if (line === '' || line[0] === ' ') return line;

  // Since a more-indented line adds a \n, breaks can't be followed by a space.
  var breakRe = / [^ ]/g; // note: the match index will always be <= length-2.
  var match;
  // start is an inclusive index. end, curr, and next are exclusive.
  var start = 0, end, curr = 0, next = 0;
  var result = '';

  // Invariants: 0 <= start <= length-1.
  //   0 <= curr <= next <= max(0, length-2). curr - start <= width.
  // Inside the loop:
  //   A match implies length >= 2, so curr and next are <= length-2.
  while ((match = breakRe.exec(line))) {
    next = match.index;
    // maintain invariant: curr - start <= width
    if (next - start > width) {
      end = (curr > start) ? curr : next; // derive end <= length-2
      result += '\n' + line.slice(start, end);
      // skip the space that was output as \n
      start = end + 1;                    // derive start <= length-1
    }
    curr = next;
  }

  // By the invariants, start <= length-1, so there is something left over.
  // It is either the whole string or a part starting from non-whitespace.
  result += '\n';
  // Insert a break if the remainder is too long and there is a break available.
  if (line.length - start > width && curr > start) {
    result += line.slice(start, curr) + '\n' + line.slice(curr + 1);
  } else {
    result += line.slice(start);
  }

  return result.slice(1); // drop extra \n joiner
}

// Escapes a double-quoted string.
function escapeString(string) {
  var result = '';
  var char, nextChar;
  var escapeSeq;

  for (var i = 0; i < string.length; i++) {
    char = string.charCodeAt(i);
    // Check for surrogate pairs (reference Unicode 3.0 section "3.7 Surrogates").
    if (char >= 0xD800 && char <= 0xDBFF/* high surrogate */) {
      nextChar = string.charCodeAt(i + 1);
      if (nextChar >= 0xDC00 && nextChar <= 0xDFFF/* low surrogate */) {
        // Combine the surrogate pair and store it escaped.
        result += encodeHex((char - 0xD800) * 0x400 + nextChar - 0xDC00 + 0x10000);
        // Advance index one extra since we already used that char here.
        i++; continue;
      }
    }
    escapeSeq = ESCAPE_SEQUENCES[char];
    result += !escapeSeq && isPrintable(char)
      ? string[i]
      : escapeSeq || encodeHex(char);
  }

  return result;
}

function writeFlowSequence(state, level, object) {
  var _result = '',
      _tag    = state.tag,
      index,
      length;

  for (index = 0, length = object.length; index < length; index += 1) {
    // Write only valid elements.
    if (writeNode(state, level, object[index], false, false)) {
      if (index !== 0) _result += ',' + (!state.condenseFlow ? ' ' : '');
      _result += state.dump;
    }
  }

  state.tag = _tag;
  state.dump = '[' + _result + ']';
}

function writeBlockSequence(state, level, object, compact) {
  var _result = '',
      _tag    = state.tag,
      index,
      length;

  for (index = 0, length = object.length; index < length; index += 1) {
    // Write only valid elements.
    if (writeNode(state, level + 1, object[index], true, true)) {
      if (!compact || index !== 0) {
        _result += generateNextLine(state, level);
      }

      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        _result += '-';
      } else {
        _result += '- ';
      }

      _result += state.dump;
    }
  }

  state.tag = _tag;
  state.dump = _result || '[]'; // Empty sequence if no valid values.
}

function writeFlowMapping(state, level, object) {
  var _result       = '',
      _tag          = state.tag,
      objectKeyList = Object.keys(object),
      index,
      length,
      objectKey,
      objectValue,
      pairBuffer;

  for (index = 0, length = objectKeyList.length; index < length; index += 1) {
    pairBuffer = state.condenseFlow ? '"' : '';

    if (index !== 0) pairBuffer += ', ';

    objectKey = objectKeyList[index];
    objectValue = object[objectKey];

    if (!writeNode(state, level, objectKey, false, false)) {
      continue; // Skip this pair because of invalid key;
    }

    if (state.dump.length > 1024) pairBuffer += '? ';

    pairBuffer += state.dump + (state.condenseFlow ? '"' : '') + ':' + (state.condenseFlow ? '' : ' ');

    if (!writeNode(state, level, objectValue, false, false)) {
      continue; // Skip this pair because of invalid value.
    }

    pairBuffer += state.dump;

    // Both key and value are valid.
    _result += pairBuffer;
  }

  state.tag = _tag;
  state.dump = '{' + _result + '}';
}

function writeBlockMapping(state, level, object, compact) {
  var _result       = '',
      _tag          = state.tag,
      objectKeyList = Object.keys(object),
      index,
      length,
      objectKey,
      objectValue,
      explicitPair,
      pairBuffer;

  // Allow sorting keys so that the output file is deterministic
  if (state.sortKeys === true) {
    // Default sorting
    objectKeyList.sort();
  } else if (typeof state.sortKeys === 'function') {
    // Custom sort function
    objectKeyList.sort(state.sortKeys);
  } else if (state.sortKeys) {
    // Something is wrong
    throw new YAMLException('sortKeys must be a boolean or a function');
  }

  for (index = 0, length = objectKeyList.length; index < length; index += 1) {
    pairBuffer = '';

    if (!compact || index !== 0) {
      pairBuffer += generateNextLine(state, level);
    }

    objectKey = objectKeyList[index];
    objectValue = object[objectKey];

    if (!writeNode(state, level + 1, objectKey, true, true, true)) {
      continue; // Skip this pair because of invalid key.
    }

    explicitPair = (state.tag !== null && state.tag !== '?') ||
                   (state.dump && state.dump.length > 1024);

    if (explicitPair) {
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += '?';
      } else {
        pairBuffer += '? ';
      }
    }

    pairBuffer += state.dump;

    if (explicitPair) {
      pairBuffer += generateNextLine(state, level);
    }

    if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
      continue; // Skip this pair because of invalid value.
    }

    if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
      pairBuffer += ':';
    } else {
      pairBuffer += ': ';
    }

    pairBuffer += state.dump;

    // Both key and value are valid.
    _result += pairBuffer;
  }

  state.tag = _tag;
  state.dump = _result || '{}'; // Empty mapping if no valid pairs.
}

function detectType(state, object, explicit) {
  var _result, typeList, index, length, type, style;

  typeList = explicit ? state.explicitTypes : state.implicitTypes;

  for (index = 0, length = typeList.length; index < length; index += 1) {
    type = typeList[index];

    if ((type.instanceOf  || type.predicate) &&
        (!type.instanceOf || ((typeof object === 'object') && (object instanceof type.instanceOf))) &&
        (!type.predicate  || type.predicate(object))) {

      state.tag = explicit ? type.tag : '?';

      if (type.represent) {
        style = state.styleMap[type.tag] || type.defaultStyle;

        if (_toString.call(type.represent) === '[object Function]') {
          _result = type.represent(object, style);
        } else if (_hasOwnProperty.call(type.represent, style)) {
          _result = type.represent[style](object, style);
        } else {
          throw new YAMLException('!<' + type.tag + '> tag resolver accepts not "' + style + '" style');
        }

        state.dump = _result;
      }

      return true;
    }
  }

  return false;
}

// Serializes `object` and writes it to global `result`.
// Returns true on success, or false on invalid object.
//
function writeNode(state, level, object, block, compact, iskey) {
  state.tag = null;
  state.dump = object;

  if (!detectType(state, object, false)) {
    detectType(state, object, true);
  }

  var type = _toString.call(state.dump);

  if (block) {
    block = (state.flowLevel < 0 || state.flowLevel > level);
  }

  var objectOrArray = type === '[object Object]' || type === '[object Array]',
      duplicateIndex,
      duplicate;

  if (objectOrArray) {
    duplicateIndex = state.duplicates.indexOf(object);
    duplicate = duplicateIndex !== -1;
  }

  if ((state.tag !== null && state.tag !== '?') || duplicate || (state.indent !== 2 && level > 0)) {
    compact = false;
  }

  if (duplicate && state.usedDuplicates[duplicateIndex]) {
    state.dump = '*ref_' + duplicateIndex;
  } else {
    if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
      state.usedDuplicates[duplicateIndex] = true;
    }
    if (type === '[object Object]') {
      if (block && (Object.keys(state.dump).length !== 0)) {
        writeBlockMapping(state, level, state.dump, compact);
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + state.dump;
        }
      } else {
        writeFlowMapping(state, level, state.dump);
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + ' ' + state.dump;
        }
      }
    } else if (type === '[object Array]') {
      if (block && (state.dump.length !== 0)) {
        writeBlockSequence(state, level, state.dump, compact);
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + state.dump;
        }
      } else {
        writeFlowSequence(state, level, state.dump);
        if (duplicate) {
          state.dump = '&ref_' + duplicateIndex + ' ' + state.dump;
        }
      }
    } else if (type === '[object String]') {
      if (state.tag !== '?') {
        writeScalar(state, state.dump, level, iskey);
      }
    } else {
      if (state.skipInvalid) return false;
      throw new YAMLException('unacceptable kind of an object to dump ' + type);
    }

    if (state.tag !== null && state.tag !== '?') {
      state.dump = '!<' + state.tag + '> ' + state.dump;
    }
  }

  return true;
}

function getDuplicateReferences(object, state) {
  var objects = [],
      duplicatesIndexes = [],
      index,
      length;

  inspectNode(object, objects, duplicatesIndexes);

  for (index = 0, length = duplicatesIndexes.length; index < length; index += 1) {
    state.duplicates.push(objects[duplicatesIndexes[index]]);
  }
  state.usedDuplicates = new Array(length);
}

function inspectNode(object, objects, duplicatesIndexes) {
  var objectKeyList,
      index,
      length;

  if (object !== null && typeof object === 'object') {
    index = objects.indexOf(object);
    if (index !== -1) {
      if (duplicatesIndexes.indexOf(index) === -1) {
        duplicatesIndexes.push(index);
      }
    } else {
      objects.push(object);

      if (Array.isArray(object)) {
        for (index = 0, length = object.length; index < length; index += 1) {
          inspectNode(object[index], objects, duplicatesIndexes);
        }
      } else {
        objectKeyList = Object.keys(object);

        for (index = 0, length = objectKeyList.length; index < length; index += 1) {
          inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
        }
      }
    }
  }
}

function dump(input, options) {
  options = options || {};

  var state = new State(options);

  if (!state.noRefs) getDuplicateReferences(input, state);

  if (writeNode(state, 0, input, true, true)) return state.dump + '\n';

  return '';
}

function safeDump(input, options) {
  return dump(input, common.extend({ schema: DEFAULT_SAFE_SCHEMA }, options));
}

module.exports.dump     = dump;
module.exports.safeDump = safeDump;

},{"./common":43,"./exception":45,"./schema/default_full":50,"./schema/default_safe":51}],45:[function(require,module,exports){
// YAML error class. http://stackoverflow.com/questions/8458984
//
'use strict';

function YAMLException(reason, mark) {
  // Super constructor
  Error.call(this);

  this.name = 'YAMLException';
  this.reason = reason;
  this.mark = mark;
  this.message = (this.reason || '(unknown reason)') + (this.mark ? ' ' + this.mark.toString() : '');

  // Include stack trace in error object
  if (Error.captureStackTrace) {
    // Chrome and NodeJS
    Error.captureStackTrace(this, this.constructor);
  } else {
    // FF, IE 10+ and Safari 6+. Fallback for others
    this.stack = (new Error()).stack || '';
  }
}


// Inherit from Error
YAMLException.prototype = Object.create(Error.prototype);
YAMLException.prototype.constructor = YAMLException;


YAMLException.prototype.toString = function toString(compact) {
  var result = this.name + ': ';

  result += this.reason || '(unknown reason)';

  if (!compact && this.mark) {
    result += ' ' + this.mark.toString();
  }

  return result;
};


module.exports = YAMLException;

},{}],46:[function(require,module,exports){
'use strict';

/*eslint-disable max-len,no-use-before-define*/

var common              = require('./common');
var YAMLException       = require('./exception');
var Mark                = require('./mark');
var DEFAULT_SAFE_SCHEMA = require('./schema/default_safe');
var DEFAULT_FULL_SCHEMA = require('./schema/default_full');


var _hasOwnProperty = Object.prototype.hasOwnProperty;


var CONTEXT_FLOW_IN   = 1;
var CONTEXT_FLOW_OUT  = 2;
var CONTEXT_BLOCK_IN  = 3;
var CONTEXT_BLOCK_OUT = 4;


var CHOMPING_CLIP  = 1;
var CHOMPING_STRIP = 2;
var CHOMPING_KEEP  = 3;


var PATTERN_NON_PRINTABLE         = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
var PATTERN_FLOW_INDICATORS       = /[,\[\]\{\}]/;
var PATTERN_TAG_HANDLE            = /^(?:!|!!|![a-z\-]+!)$/i;
var PATTERN_TAG_URI               = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;


function is_EOL(c) {
  return (c === 0x0A/* LF */) || (c === 0x0D/* CR */);
}

function is_WHITE_SPACE(c) {
  return (c === 0x09/* Tab */) || (c === 0x20/* Space */);
}

function is_WS_OR_EOL(c) {
  return (c === 0x09/* Tab */) ||
         (c === 0x20/* Space */) ||
         (c === 0x0A/* LF */) ||
         (c === 0x0D/* CR */);
}

function is_FLOW_INDICATOR(c) {
  return c === 0x2C/* , */ ||
         c === 0x5B/* [ */ ||
         c === 0x5D/* ] */ ||
         c === 0x7B/* { */ ||
         c === 0x7D/* } */;
}

function fromHexCode(c) {
  var lc;

  if ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */)) {
    return c - 0x30;
  }

  /*eslint-disable no-bitwise*/
  lc = c | 0x20;

  if ((0x61/* a */ <= lc) && (lc <= 0x66/* f */)) {
    return lc - 0x61 + 10;
  }

  return -1;
}

function escapedHexLen(c) {
  if (c === 0x78/* x */) { return 2; }
  if (c === 0x75/* u */) { return 4; }
  if (c === 0x55/* U */) { return 8; }
  return 0;
}

function fromDecimalCode(c) {
  if ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */)) {
    return c - 0x30;
  }

  return -1;
}

function simpleEscapeSequence(c) {
  /* eslint-disable indent */
  return (c === 0x30/* 0 */) ? '\x00' :
        (c === 0x61/* a */) ? '\x07' :
        (c === 0x62/* b */) ? '\x08' :
        (c === 0x74/* t */) ? '\x09' :
        (c === 0x09/* Tab */) ? '\x09' :
        (c === 0x6E/* n */) ? '\x0A' :
        (c === 0x76/* v */) ? '\x0B' :
        (c === 0x66/* f */) ? '\x0C' :
        (c === 0x72/* r */) ? '\x0D' :
        (c === 0x65/* e */) ? '\x1B' :
        (c === 0x20/* Space */) ? ' ' :
        (c === 0x22/* " */) ? '\x22' :
        (c === 0x2F/* / */) ? '/' :
        (c === 0x5C/* \ */) ? '\x5C' :
        (c === 0x4E/* N */) ? '\x85' :
        (c === 0x5F/* _ */) ? '\xA0' :
        (c === 0x4C/* L */) ? '\u2028' :
        (c === 0x50/* P */) ? '\u2029' : '';
}

function charFromCodepoint(c) {
  if (c <= 0xFFFF) {
    return String.fromCharCode(c);
  }
  // Encode UTF-16 surrogate pair
  // https://en.wikipedia.org/wiki/UTF-16#Code_points_U.2B010000_to_U.2B10FFFF
  return String.fromCharCode(
    ((c - 0x010000) >> 10) + 0xD800,
    ((c - 0x010000) & 0x03FF) + 0xDC00
  );
}

var simpleEscapeCheck = new Array(256); // integer, for fast access
var simpleEscapeMap = new Array(256);
for (var i = 0; i < 256; i++) {
  simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
  simpleEscapeMap[i] = simpleEscapeSequence(i);
}


function State(input, options) {
  this.input = input;

  this.filename  = options['filename']  || null;
  this.schema    = options['schema']    || DEFAULT_FULL_SCHEMA;
  this.onWarning = options['onWarning'] || null;
  this.legacy    = options['legacy']    || false;
  this.json      = options['json']      || false;
  this.listener  = options['listener']  || null;

  this.implicitTypes = this.schema.compiledImplicit;
  this.typeMap       = this.schema.compiledTypeMap;

  this.length     = input.length;
  this.position   = 0;
  this.line       = 0;
  this.lineStart  = 0;
  this.lineIndent = 0;

  this.documents = [];

  /*
  this.version;
  this.checkLineBreaks;
  this.tagMap;
  this.anchorMap;
  this.tag;
  this.anchor;
  this.kind;
  this.result;*/

}


function generateError(state, message) {
  return new YAMLException(
    message,
    new Mark(state.filename, state.input, state.position, state.line, (state.position - state.lineStart)));
}

function throwError(state, message) {
  throw generateError(state, message);
}

function throwWarning(state, message) {
  if (state.onWarning) {
    state.onWarning.call(null, generateError(state, message));
  }
}


var directiveHandlers = {

  YAML: function handleYamlDirective(state, name, args) {

    var match, major, minor;

    if (state.version !== null) {
      throwError(state, 'duplication of %YAML directive');
    }

    if (args.length !== 1) {
      throwError(state, 'YAML directive accepts exactly one argument');
    }

    match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);

    if (match === null) {
      throwError(state, 'ill-formed argument of the YAML directive');
    }

    major = parseInt(match[1], 10);
    minor = parseInt(match[2], 10);

    if (major !== 1) {
      throwError(state, 'unacceptable YAML version of the document');
    }

    state.version = args[0];
    state.checkLineBreaks = (minor < 2);

    if (minor !== 1 && minor !== 2) {
      throwWarning(state, 'unsupported YAML version of the document');
    }
  },

  TAG: function handleTagDirective(state, name, args) {

    var handle, prefix;

    if (args.length !== 2) {
      throwError(state, 'TAG directive accepts exactly two arguments');
    }

    handle = args[0];
    prefix = args[1];

    if (!PATTERN_TAG_HANDLE.test(handle)) {
      throwError(state, 'ill-formed tag handle (first argument) of the TAG directive');
    }

    if (_hasOwnProperty.call(state.tagMap, handle)) {
      throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
    }

    if (!PATTERN_TAG_URI.test(prefix)) {
      throwError(state, 'ill-formed tag prefix (second argument) of the TAG directive');
    }

    state.tagMap[handle] = prefix;
  }
};


function captureSegment(state, start, end, checkJson) {
  var _position, _length, _character, _result;

  if (start < end) {
    _result = state.input.slice(start, end);

    if (checkJson) {
      for (_position = 0, _length = _result.length; _position < _length; _position += 1) {
        _character = _result.charCodeAt(_position);
        if (!(_character === 0x09 ||
              (0x20 <= _character && _character <= 0x10FFFF))) {
          throwError(state, 'expected valid JSON character');
        }
      }
    } else if (PATTERN_NON_PRINTABLE.test(_result)) {
      throwError(state, 'the stream contains non-printable characters');
    }

    state.result += _result;
  }
}

function mergeMappings(state, destination, source, overridableKeys) {
  var sourceKeys, key, index, quantity;

  if (!common.isObject(source)) {
    throwError(state, 'cannot merge mappings; the provided source object is unacceptable');
  }

  sourceKeys = Object.keys(source);

  for (index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
    key = sourceKeys[index];

    if (!_hasOwnProperty.call(destination, key)) {
      destination[key] = source[key];
      overridableKeys[key] = true;
    }
  }
}

function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startPos) {
  var index, quantity;

  keyNode = String(keyNode);

  if (_result === null) {
    _result = {};
  }

  if (keyTag === 'tag:yaml.org,2002:merge') {
    if (Array.isArray(valueNode)) {
      for (index = 0, quantity = valueNode.length; index < quantity; index += 1) {
        mergeMappings(state, _result, valueNode[index], overridableKeys);
      }
    } else {
      mergeMappings(state, _result, valueNode, overridableKeys);
    }
  } else {
    if (!state.json &&
        !_hasOwnProperty.call(overridableKeys, keyNode) &&
        _hasOwnProperty.call(_result, keyNode)) {
      state.line = startLine || state.line;
      state.position = startPos || state.position;
      throwError(state, 'duplicated mapping key');
    }
    _result[keyNode] = valueNode;
    delete overridableKeys[keyNode];
  }

  return _result;
}

function readLineBreak(state) {
  var ch;

  ch = state.input.charCodeAt(state.position);

  if (ch === 0x0A/* LF */) {
    state.position++;
  } else if (ch === 0x0D/* CR */) {
    state.position++;
    if (state.input.charCodeAt(state.position) === 0x0A/* LF */) {
      state.position++;
    }
  } else {
    throwError(state, 'a line break is expected');
  }

  state.line += 1;
  state.lineStart = state.position;
}

function skipSeparationSpace(state, allowComments, checkIndent) {
  var lineBreaks = 0,
      ch = state.input.charCodeAt(state.position);

  while (ch !== 0) {
    while (is_WHITE_SPACE(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }

    if (allowComments && ch === 0x23/* # */) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 0x0A/* LF */ && ch !== 0x0D/* CR */ && ch !== 0);
    }

    if (is_EOL(ch)) {
      readLineBreak(state);

      ch = state.input.charCodeAt(state.position);
      lineBreaks++;
      state.lineIndent = 0;

      while (ch === 0x20/* Space */) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
    } else {
      break;
    }
  }

  if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
    throwWarning(state, 'deficient indentation');
  }

  return lineBreaks;
}

function testDocumentSeparator(state) {
  var _position = state.position,
      ch;

  ch = state.input.charCodeAt(_position);

  // Condition state.position === state.lineStart is tested
  // in parent on each call, for efficiency. No needs to test here again.
  if ((ch === 0x2D/* - */ || ch === 0x2E/* . */) &&
      ch === state.input.charCodeAt(_position + 1) &&
      ch === state.input.charCodeAt(_position + 2)) {

    _position += 3;

    ch = state.input.charCodeAt(_position);

    if (ch === 0 || is_WS_OR_EOL(ch)) {
      return true;
    }
  }

  return false;
}

function writeFoldedLines(state, count) {
  if (count === 1) {
    state.result += ' ';
  } else if (count > 1) {
    state.result += common.repeat('\n', count - 1);
  }
}


function readPlainScalar(state, nodeIndent, withinFlowCollection) {
  var preceding,
      following,
      captureStart,
      captureEnd,
      hasPendingContent,
      _line,
      _lineStart,
      _lineIndent,
      _kind = state.kind,
      _result = state.result,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (is_WS_OR_EOL(ch)      ||
      is_FLOW_INDICATOR(ch) ||
      ch === 0x23/* # */    ||
      ch === 0x26/* & */    ||
      ch === 0x2A/* * */    ||
      ch === 0x21/* ! */    ||
      ch === 0x7C/* | */    ||
      ch === 0x3E/* > */    ||
      ch === 0x27/* ' */    ||
      ch === 0x22/* " */    ||
      ch === 0x25/* % */    ||
      ch === 0x40/* @ */    ||
      ch === 0x60/* ` */) {
    return false;
  }

  if (ch === 0x3F/* ? */ || ch === 0x2D/* - */) {
    following = state.input.charCodeAt(state.position + 1);

    if (is_WS_OR_EOL(following) ||
        withinFlowCollection && is_FLOW_INDICATOR(following)) {
      return false;
    }
  }

  state.kind = 'scalar';
  state.result = '';
  captureStart = captureEnd = state.position;
  hasPendingContent = false;

  while (ch !== 0) {
    if (ch === 0x3A/* : */) {
      following = state.input.charCodeAt(state.position + 1);

      if (is_WS_OR_EOL(following) ||
          withinFlowCollection && is_FLOW_INDICATOR(following)) {
        break;
      }

    } else if (ch === 0x23/* # */) {
      preceding = state.input.charCodeAt(state.position - 1);

      if (is_WS_OR_EOL(preceding)) {
        break;
      }

    } else if ((state.position === state.lineStart && testDocumentSeparator(state)) ||
               withinFlowCollection && is_FLOW_INDICATOR(ch)) {
      break;

    } else if (is_EOL(ch)) {
      _line = state.line;
      _lineStart = state.lineStart;
      _lineIndent = state.lineIndent;
      skipSeparationSpace(state, false, -1);

      if (state.lineIndent >= nodeIndent) {
        hasPendingContent = true;
        ch = state.input.charCodeAt(state.position);
        continue;
      } else {
        state.position = captureEnd;
        state.line = _line;
        state.lineStart = _lineStart;
        state.lineIndent = _lineIndent;
        break;
      }
    }

    if (hasPendingContent) {
      captureSegment(state, captureStart, captureEnd, false);
      writeFoldedLines(state, state.line - _line);
      captureStart = captureEnd = state.position;
      hasPendingContent = false;
    }

    if (!is_WHITE_SPACE(ch)) {
      captureEnd = state.position + 1;
    }

    ch = state.input.charCodeAt(++state.position);
  }

  captureSegment(state, captureStart, captureEnd, false);

  if (state.result) {
    return true;
  }

  state.kind = _kind;
  state.result = _result;
  return false;
}

function readSingleQuotedScalar(state, nodeIndent) {
  var ch,
      captureStart, captureEnd;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x27/* ' */) {
    return false;
  }

  state.kind = 'scalar';
  state.result = '';
  state.position++;
  captureStart = captureEnd = state.position;

  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 0x27/* ' */) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);

      if (ch === 0x27/* ' */) {
        captureStart = state.position;
        state.position++;
        captureEnd = state.position;
      } else {
        return true;
      }

    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;

    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, 'unexpected end of the document within a single quoted scalar');

    } else {
      state.position++;
      captureEnd = state.position;
    }
  }

  throwError(state, 'unexpected end of the stream within a single quoted scalar');
}

function readDoubleQuotedScalar(state, nodeIndent) {
  var captureStart,
      captureEnd,
      hexLength,
      hexResult,
      tmp,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x22/* " */) {
    return false;
  }

  state.kind = 'scalar';
  state.result = '';
  state.position++;
  captureStart = captureEnd = state.position;

  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 0x22/* " */) {
      captureSegment(state, captureStart, state.position, true);
      state.position++;
      return true;

    } else if (ch === 0x5C/* \ */) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);

      if (is_EOL(ch)) {
        skipSeparationSpace(state, false, nodeIndent);

        // TODO: rework to inline fn with no type cast?
      } else if (ch < 256 && simpleEscapeCheck[ch]) {
        state.result += simpleEscapeMap[ch];
        state.position++;

      } else if ((tmp = escapedHexLen(ch)) > 0) {
        hexLength = tmp;
        hexResult = 0;

        for (; hexLength > 0; hexLength--) {
          ch = state.input.charCodeAt(++state.position);

          if ((tmp = fromHexCode(ch)) >= 0) {
            hexResult = (hexResult << 4) + tmp;

          } else {
            throwError(state, 'expected hexadecimal character');
          }
        }

        state.result += charFromCodepoint(hexResult);

        state.position++;

      } else {
        throwError(state, 'unknown escape sequence');
      }

      captureStart = captureEnd = state.position;

    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;

    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, 'unexpected end of the document within a double quoted scalar');

    } else {
      state.position++;
      captureEnd = state.position;
    }
  }

  throwError(state, 'unexpected end of the stream within a double quoted scalar');
}

function readFlowCollection(state, nodeIndent) {
  var readNext = true,
      _line,
      _tag     = state.tag,
      _result,
      _anchor  = state.anchor,
      following,
      terminator,
      isPair,
      isExplicitPair,
      isMapping,
      overridableKeys = {},
      keyNode,
      keyTag,
      valueNode,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch === 0x5B/* [ */) {
    terminator = 0x5D;/* ] */
    isMapping = false;
    _result = [];
  } else if (ch === 0x7B/* { */) {
    terminator = 0x7D;/* } */
    isMapping = true;
    _result = {};
  } else {
    return false;
  }

  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }

  ch = state.input.charCodeAt(++state.position);

  while (ch !== 0) {
    skipSeparationSpace(state, true, nodeIndent);

    ch = state.input.charCodeAt(state.position);

    if (ch === terminator) {
      state.position++;
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = isMapping ? 'mapping' : 'sequence';
      state.result = _result;
      return true;
    } else if (!readNext) {
      throwError(state, 'missed comma between flow collection entries');
    }

    keyTag = keyNode = valueNode = null;
    isPair = isExplicitPair = false;

    if (ch === 0x3F/* ? */) {
      following = state.input.charCodeAt(state.position + 1);

      if (is_WS_OR_EOL(following)) {
        isPair = isExplicitPair = true;
        state.position++;
        skipSeparationSpace(state, true, nodeIndent);
      }
    }

    _line = state.line;
    composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
    keyTag = state.tag;
    keyNode = state.result;
    skipSeparationSpace(state, true, nodeIndent);

    ch = state.input.charCodeAt(state.position);

    if ((isExplicitPair || state.line === _line) && ch === 0x3A/* : */) {
      isPair = true;
      ch = state.input.charCodeAt(++state.position);
      skipSeparationSpace(state, true, nodeIndent);
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      valueNode = state.result;
    }

    if (isMapping) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode);
    } else if (isPair) {
      _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode));
    } else {
      _result.push(keyNode);
    }

    skipSeparationSpace(state, true, nodeIndent);

    ch = state.input.charCodeAt(state.position);

    if (ch === 0x2C/* , */) {
      readNext = true;
      ch = state.input.charCodeAt(++state.position);
    } else {
      readNext = false;
    }
  }

  throwError(state, 'unexpected end of the stream within a flow collection');
}

function readBlockScalar(state, nodeIndent) {
  var captureStart,
      folding,
      chomping       = CHOMPING_CLIP,
      didReadContent = false,
      detectedIndent = false,
      textIndent     = nodeIndent,
      emptyLines     = 0,
      atMoreIndented = false,
      tmp,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch === 0x7C/* | */) {
    folding = false;
  } else if (ch === 0x3E/* > */) {
    folding = true;
  } else {
    return false;
  }

  state.kind = 'scalar';
  state.result = '';

  while (ch !== 0) {
    ch = state.input.charCodeAt(++state.position);

    if (ch === 0x2B/* + */ || ch === 0x2D/* - */) {
      if (CHOMPING_CLIP === chomping) {
        chomping = (ch === 0x2B/* + */) ? CHOMPING_KEEP : CHOMPING_STRIP;
      } else {
        throwError(state, 'repeat of a chomping mode identifier');
      }

    } else if ((tmp = fromDecimalCode(ch)) >= 0) {
      if (tmp === 0) {
        throwError(state, 'bad explicit indentation width of a block scalar; it cannot be less than one');
      } else if (!detectedIndent) {
        textIndent = nodeIndent + tmp - 1;
        detectedIndent = true;
      } else {
        throwError(state, 'repeat of an indentation width identifier');
      }

    } else {
      break;
    }
  }

  if (is_WHITE_SPACE(ch)) {
    do { ch = state.input.charCodeAt(++state.position); }
    while (is_WHITE_SPACE(ch));

    if (ch === 0x23/* # */) {
      do { ch = state.input.charCodeAt(++state.position); }
      while (!is_EOL(ch) && (ch !== 0));
    }
  }

  while (ch !== 0) {
    readLineBreak(state);
    state.lineIndent = 0;

    ch = state.input.charCodeAt(state.position);

    while ((!detectedIndent || state.lineIndent < textIndent) &&
           (ch === 0x20/* Space */)) {
      state.lineIndent++;
      ch = state.input.charCodeAt(++state.position);
    }

    if (!detectedIndent && state.lineIndent > textIndent) {
      textIndent = state.lineIndent;
    }

    if (is_EOL(ch)) {
      emptyLines++;
      continue;
    }

    // End of the scalar.
    if (state.lineIndent < textIndent) {

      // Perform the chomping.
      if (chomping === CHOMPING_KEEP) {
        state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
      } else if (chomping === CHOMPING_CLIP) {
        if (didReadContent) { // i.e. only if the scalar is not empty.
          state.result += '\n';
        }
      }

      // Break this `while` cycle and go to the funciton's epilogue.
      break;
    }

    // Folded style: use fancy rules to handle line breaks.
    if (folding) {

      // Lines starting with white space characters (more-indented lines) are not folded.
      if (is_WHITE_SPACE(ch)) {
        atMoreIndented = true;
        // except for the first content line (cf. Example 8.1)
        state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);

      // End of more-indented block.
      } else if (atMoreIndented) {
        atMoreIndented = false;
        state.result += common.repeat('\n', emptyLines + 1);

      // Just one line break - perceive as the same line.
      } else if (emptyLines === 0) {
        if (didReadContent) { // i.e. only if we have already read some scalar content.
          state.result += ' ';
        }

      // Several line breaks - perceive as different lines.
      } else {
        state.result += common.repeat('\n', emptyLines);
      }

    // Literal style: just add exact number of line breaks between content lines.
    } else {
      // Keep all line breaks except the header line break.
      state.result += common.repeat('\n', didReadContent ? 1 + emptyLines : emptyLines);
    }

    didReadContent = true;
    detectedIndent = true;
    emptyLines = 0;
    captureStart = state.position;

    while (!is_EOL(ch) && (ch !== 0)) {
      ch = state.input.charCodeAt(++state.position);
    }

    captureSegment(state, captureStart, state.position, false);
  }

  return true;
}

function readBlockSequence(state, nodeIndent) {
  var _line,
      _tag      = state.tag,
      _anchor   = state.anchor,
      _result   = [],
      following,
      detected  = false,
      ch;

  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }

  ch = state.input.charCodeAt(state.position);

  while (ch !== 0) {

    if (ch !== 0x2D/* - */) {
      break;
    }

    following = state.input.charCodeAt(state.position + 1);

    if (!is_WS_OR_EOL(following)) {
      break;
    }

    detected = true;
    state.position++;

    if (skipSeparationSpace(state, true, -1)) {
      if (state.lineIndent <= nodeIndent) {
        _result.push(null);
        ch = state.input.charCodeAt(state.position);
        continue;
      }
    }

    _line = state.line;
    composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
    _result.push(state.result);
    skipSeparationSpace(state, true, -1);

    ch = state.input.charCodeAt(state.position);

    if ((state.line === _line || state.lineIndent > nodeIndent) && (ch !== 0)) {
      throwError(state, 'bad indentation of a sequence entry');
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }

  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = 'sequence';
    state.result = _result;
    return true;
  }
  return false;
}

function readBlockMapping(state, nodeIndent, flowIndent) {
  var following,
      allowCompact,
      _line,
      _pos,
      _tag          = state.tag,
      _anchor       = state.anchor,
      _result       = {},
      overridableKeys = {},
      keyTag        = null,
      keyNode       = null,
      valueNode     = null,
      atExplicitKey = false,
      detected      = false,
      ch;

  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }

  ch = state.input.charCodeAt(state.position);

  while (ch !== 0) {
    following = state.input.charCodeAt(state.position + 1);
    _line = state.line; // Save the current line.
    _pos = state.position;

    //
    // Explicit notation case. There are two separate blocks:
    // first for the key (denoted by "?") and second for the value (denoted by ":")
    //
    if ((ch === 0x3F/* ? */ || ch === 0x3A/* : */) && is_WS_OR_EOL(following)) {

      if (ch === 0x3F/* ? */) {
        if (atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null);
          keyTag = keyNode = valueNode = null;
        }

        detected = true;
        atExplicitKey = true;
        allowCompact = true;

      } else if (atExplicitKey) {
        // i.e. 0x3A/* : */ === character after the explicit key.
        atExplicitKey = false;
        allowCompact = true;

      } else {
        throwError(state, 'incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line');
      }

      state.position += 1;
      ch = following;

    //
    // Implicit notation case. Flow-style node as the key first, then ":", and the value.
    //
    } else if (composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {

      if (state.line === _line) {
        ch = state.input.charCodeAt(state.position);

        while (is_WHITE_SPACE(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }

        if (ch === 0x3A/* : */) {
          ch = state.input.charCodeAt(++state.position);

          if (!is_WS_OR_EOL(ch)) {
            throwError(state, 'a whitespace character is expected after the key-value separator within a block mapping');
          }

          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null);
            keyTag = keyNode = valueNode = null;
          }

          detected = true;
          atExplicitKey = false;
          allowCompact = false;
          keyTag = state.tag;
          keyNode = state.result;

        } else if (detected) {
          throwError(state, 'can not read an implicit mapping pair; a colon is missed');

        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true; // Keep the result of `composeNode`.
        }

      } else if (detected) {
        throwError(state, 'can not read a block mapping entry; a multiline key may not be an implicit key');

      } else {
        state.tag = _tag;
        state.anchor = _anchor;
        return true; // Keep the result of `composeNode`.
      }

    } else {
      break; // Reading is done. Go to the epilogue.
    }

    //
    // Common reading code for both explicit and implicit notations.
    //
    if (state.line === _line || state.lineIndent > nodeIndent) {
      if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
        if (atExplicitKey) {
          keyNode = state.result;
        } else {
          valueNode = state.result;
        }
      }

      if (!atExplicitKey) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _pos);
        keyTag = keyNode = valueNode = null;
      }

      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
    }

    if (state.lineIndent > nodeIndent && (ch !== 0)) {
      throwError(state, 'bad indentation of a mapping entry');
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }

  //
  // Epilogue.
  //

  // Special case: last mapping's node contains only the key in explicit notation.
  if (atExplicitKey) {
    storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null);
  }

  // Expose the resulting mapping.
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = 'mapping';
    state.result = _result;
  }

  return detected;
}

function readTagProperty(state) {
  var _position,
      isVerbatim = false,
      isNamed    = false,
      tagHandle,
      tagName,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x21/* ! */) return false;

  if (state.tag !== null) {
    throwError(state, 'duplication of a tag property');
  }

  ch = state.input.charCodeAt(++state.position);

  if (ch === 0x3C/* < */) {
    isVerbatim = true;
    ch = state.input.charCodeAt(++state.position);

  } else if (ch === 0x21/* ! */) {
    isNamed = true;
    tagHandle = '!!';
    ch = state.input.charCodeAt(++state.position);

  } else {
    tagHandle = '!';
  }

  _position = state.position;

  if (isVerbatim) {
    do { ch = state.input.charCodeAt(++state.position); }
    while (ch !== 0 && ch !== 0x3E/* > */);

    if (state.position < state.length) {
      tagName = state.input.slice(_position, state.position);
      ch = state.input.charCodeAt(++state.position);
    } else {
      throwError(state, 'unexpected end of the stream within a verbatim tag');
    }
  } else {
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {

      if (ch === 0x21/* ! */) {
        if (!isNamed) {
          tagHandle = state.input.slice(_position - 1, state.position + 1);

          if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
            throwError(state, 'named tag handle cannot contain such characters');
          }

          isNamed = true;
          _position = state.position + 1;
        } else {
          throwError(state, 'tag suffix cannot contain exclamation marks');
        }
      }

      ch = state.input.charCodeAt(++state.position);
    }

    tagName = state.input.slice(_position, state.position);

    if (PATTERN_FLOW_INDICATORS.test(tagName)) {
      throwError(state, 'tag suffix cannot contain flow indicator characters');
    }
  }

  if (tagName && !PATTERN_TAG_URI.test(tagName)) {
    throwError(state, 'tag name cannot contain such characters: ' + tagName);
  }

  if (isVerbatim) {
    state.tag = tagName;

  } else if (_hasOwnProperty.call(state.tagMap, tagHandle)) {
    state.tag = state.tagMap[tagHandle] + tagName;

  } else if (tagHandle === '!') {
    state.tag = '!' + tagName;

  } else if (tagHandle === '!!') {
    state.tag = 'tag:yaml.org,2002:' + tagName;

  } else {
    throwError(state, 'undeclared tag handle "' + tagHandle + '"');
  }

  return true;
}

function readAnchorProperty(state) {
  var _position,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x26/* & */) return false;

  if (state.anchor !== null) {
    throwError(state, 'duplication of an anchor property');
  }

  ch = state.input.charCodeAt(++state.position);
  _position = state.position;

  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }

  if (state.position === _position) {
    throwError(state, 'name of an anchor node must contain at least one character');
  }

  state.anchor = state.input.slice(_position, state.position);
  return true;
}

function readAlias(state) {
  var _position, alias,
      ch;

  ch = state.input.charCodeAt(state.position);

  if (ch !== 0x2A/* * */) return false;

  ch = state.input.charCodeAt(++state.position);
  _position = state.position;

  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }

  if (state.position === _position) {
    throwError(state, 'name of an alias node must contain at least one character');
  }

  alias = state.input.slice(_position, state.position);

  if (!state.anchorMap.hasOwnProperty(alias)) {
    throwError(state, 'unidentified alias "' + alias + '"');
  }

  state.result = state.anchorMap[alias];
  skipSeparationSpace(state, true, -1);
  return true;
}

function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
  var allowBlockStyles,
      allowBlockScalars,
      allowBlockCollections,
      indentStatus = 1, // 1: this>parent, 0: this=parent, -1: this<parent
      atNewLine  = false,
      hasContent = false,
      typeIndex,
      typeQuantity,
      type,
      flowIndent,
      blockIndent;

  if (state.listener !== null) {
    state.listener('open', state);
  }

  state.tag    = null;
  state.anchor = null;
  state.kind   = null;
  state.result = null;

  allowBlockStyles = allowBlockScalars = allowBlockCollections =
    CONTEXT_BLOCK_OUT === nodeContext ||
    CONTEXT_BLOCK_IN  === nodeContext;

  if (allowToSeek) {
    if (skipSeparationSpace(state, true, -1)) {
      atNewLine = true;

      if (state.lineIndent > parentIndent) {
        indentStatus = 1;
      } else if (state.lineIndent === parentIndent) {
        indentStatus = 0;
      } else if (state.lineIndent < parentIndent) {
        indentStatus = -1;
      }
    }
  }

  if (indentStatus === 1) {
    while (readTagProperty(state) || readAnchorProperty(state)) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        allowBlockCollections = allowBlockStyles;

        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      } else {
        allowBlockCollections = false;
      }
    }
  }

  if (allowBlockCollections) {
    allowBlockCollections = atNewLine || allowCompact;
  }

  if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
    if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
      flowIndent = parentIndent;
    } else {
      flowIndent = parentIndent + 1;
    }

    blockIndent = state.position - state.lineStart;

    if (indentStatus === 1) {
      if (allowBlockCollections &&
          (readBlockSequence(state, blockIndent) ||
           readBlockMapping(state, blockIndent, flowIndent)) ||
          readFlowCollection(state, flowIndent)) {
        hasContent = true;
      } else {
        if ((allowBlockScalars && readBlockScalar(state, flowIndent)) ||
            readSingleQuotedScalar(state, flowIndent) ||
            readDoubleQuotedScalar(state, flowIndent)) {
          hasContent = true;

        } else if (readAlias(state)) {
          hasContent = true;

          if (state.tag !== null || state.anchor !== null) {
            throwError(state, 'alias node should not have any properties');
          }

        } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
          hasContent = true;

          if (state.tag === null) {
            state.tag = '?';
          }
        }

        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
      }
    } else if (indentStatus === 0) {
      // Special case: block sequences are allowed to have same indentation level as the parent.
      // http://www.yaml.org/spec/1.2/spec.html#id2799784
      hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
    }
  }

  if (state.tag !== null && state.tag !== '!') {
    if (state.tag === '?') {
      for (typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
        type = state.implicitTypes[typeIndex];

        // Implicit resolving is not allowed for non-scalar types, and '?'
        // non-specific tag is only assigned to plain scalars. So, it isn't
        // needed to check for 'kind' conformity.

        if (type.resolve(state.result)) { // `state.result` updated in resolver if matched
          state.result = type.construct(state.result);
          state.tag = type.tag;
          if (state.anchor !== null) {
            state.anchorMap[state.anchor] = state.result;
          }
          break;
        }
      }
    } else if (_hasOwnProperty.call(state.typeMap[state.kind || 'fallback'], state.tag)) {
      type = state.typeMap[state.kind || 'fallback'][state.tag];

      if (state.result !== null && type.kind !== state.kind) {
        throwError(state, 'unacceptable node kind for !<' + state.tag + '> tag; it should be "' + type.kind + '", not "' + state.kind + '"');
      }

      if (!type.resolve(state.result)) { // `state.result` updated in resolver if matched
        throwError(state, 'cannot resolve a node with !<' + state.tag + '> explicit tag');
      } else {
        state.result = type.construct(state.result);
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
      }
    } else {
      throwError(state, 'unknown tag !<' + state.tag + '>');
    }
  }

  if (state.listener !== null) {
    state.listener('close', state);
  }
  return state.tag !== null ||  state.anchor !== null || hasContent;
}

function readDocument(state) {
  var documentStart = state.position,
      _position,
      directiveName,
      directiveArgs,
      hasDirectives = false,
      ch;

  state.version = null;
  state.checkLineBreaks = state.legacy;
  state.tagMap = {};
  state.anchorMap = {};

  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    skipSeparationSpace(state, true, -1);

    ch = state.input.charCodeAt(state.position);

    if (state.lineIndent > 0 || ch !== 0x25/* % */) {
      break;
    }

    hasDirectives = true;
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;

    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }

    directiveName = state.input.slice(_position, state.position);
    directiveArgs = [];

    if (directiveName.length < 1) {
      throwError(state, 'directive name must not be less than one character in length');
    }

    while (ch !== 0) {
      while (is_WHITE_SPACE(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }

      if (ch === 0x23/* # */) {
        do { ch = state.input.charCodeAt(++state.position); }
        while (ch !== 0 && !is_EOL(ch));
        break;
      }

      if (is_EOL(ch)) break;

      _position = state.position;

      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }

      directiveArgs.push(state.input.slice(_position, state.position));
    }

    if (ch !== 0) readLineBreak(state);

    if (_hasOwnProperty.call(directiveHandlers, directiveName)) {
      directiveHandlers[directiveName](state, directiveName, directiveArgs);
    } else {
      throwWarning(state, 'unknown document directive "' + directiveName + '"');
    }
  }

  skipSeparationSpace(state, true, -1);

  if (state.lineIndent === 0 &&
      state.input.charCodeAt(state.position)     === 0x2D/* - */ &&
      state.input.charCodeAt(state.position + 1) === 0x2D/* - */ &&
      state.input.charCodeAt(state.position + 2) === 0x2D/* - */) {
    state.position += 3;
    skipSeparationSpace(state, true, -1);

  } else if (hasDirectives) {
    throwError(state, 'directives end mark is expected');
  }

  composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
  skipSeparationSpace(state, true, -1);

  if (state.checkLineBreaks &&
      PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
    throwWarning(state, 'non-ASCII line breaks are interpreted as content');
  }

  state.documents.push(state.result);

  if (state.position === state.lineStart && testDocumentSeparator(state)) {

    if (state.input.charCodeAt(state.position) === 0x2E/* . */) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    }
    return;
  }

  if (state.position < (state.length - 1)) {
    throwError(state, 'end of the stream or a document separator is expected');
  } else {
    return;
  }
}


function loadDocuments(input, options) {
  input = String(input);
  options = options || {};

  if (input.length !== 0) {

    // Add tailing `\n` if not exists
    if (input.charCodeAt(input.length - 1) !== 0x0A/* LF */ &&
        input.charCodeAt(input.length - 1) !== 0x0D/* CR */) {
      input += '\n';
    }

    // Strip BOM
    if (input.charCodeAt(0) === 0xFEFF) {
      input = input.slice(1);
    }
  }

  var state = new State(input, options);

  // Use 0 as string terminator. That significantly simplifies bounds check.
  state.input += '\0';

  while (state.input.charCodeAt(state.position) === 0x20/* Space */) {
    state.lineIndent += 1;
    state.position += 1;
  }

  while (state.position < (state.length - 1)) {
    readDocument(state);
  }

  return state.documents;
}


function loadAll(input, iterator, options) {
  var documents = loadDocuments(input, options), index, length;

  if (typeof iterator !== 'function') {
    return documents;
  }

  for (index = 0, length = documents.length; index < length; index += 1) {
    iterator(documents[index]);
  }
}


function load(input, options) {
  var documents = loadDocuments(input, options);

  if (documents.length === 0) {
    /*eslint-disable no-undefined*/
    return undefined;
  } else if (documents.length === 1) {
    return documents[0];
  }
  throw new YAMLException('expected a single document in the stream, but found more');
}


function safeLoadAll(input, output, options) {
  if (typeof output === 'function') {
    loadAll(input, output, common.extend({ schema: DEFAULT_SAFE_SCHEMA }, options));
  } else {
    return loadAll(input, common.extend({ schema: DEFAULT_SAFE_SCHEMA }, options));
  }
}


function safeLoad(input, options) {
  return load(input, common.extend({ schema: DEFAULT_SAFE_SCHEMA }, options));
}


module.exports.loadAll     = loadAll;
module.exports.load        = load;
module.exports.safeLoadAll = safeLoadAll;
module.exports.safeLoad    = safeLoad;

},{"./common":43,"./exception":45,"./mark":47,"./schema/default_full":50,"./schema/default_safe":51}],47:[function(require,module,exports){
'use strict';


var common = require('./common');


function Mark(name, buffer, position, line, column) {
  this.name     = name;
  this.buffer   = buffer;
  this.position = position;
  this.line     = line;
  this.column   = column;
}


Mark.prototype.getSnippet = function getSnippet(indent, maxLength) {
  var head, start, tail, end, snippet;

  if (!this.buffer) return null;

  indent = indent || 4;
  maxLength = maxLength || 75;

  head = '';
  start = this.position;

  while (start > 0 && '\x00\r\n\x85\u2028\u2029'.indexOf(this.buffer.charAt(start - 1)) === -1) {
    start -= 1;
    if (this.position - start > (maxLength / 2 - 1)) {
      head = ' ... ';
      start += 5;
      break;
    }
  }

  tail = '';
  end = this.position;

  while (end < this.buffer.length && '\x00\r\n\x85\u2028\u2029'.indexOf(this.buffer.charAt(end)) === -1) {
    end += 1;
    if (end - this.position > (maxLength / 2 - 1)) {
      tail = ' ... ';
      end -= 5;
      break;
    }
  }

  snippet = this.buffer.slice(start, end);

  return common.repeat(' ', indent) + head + snippet + tail + '\n' +
         common.repeat(' ', indent + this.position - start + head.length) + '^';
};


Mark.prototype.toString = function toString(compact) {
  var snippet, where = '';

  if (this.name) {
    where += 'in "' + this.name + '" ';
  }

  where += 'at line ' + (this.line + 1) + ', column ' + (this.column + 1);

  if (!compact) {
    snippet = this.getSnippet();

    if (snippet) {
      where += ':\n' + snippet;
    }
  }

  return where;
};


module.exports = Mark;

},{"./common":43}],48:[function(require,module,exports){
'use strict';

/*eslint-disable max-len*/

var common        = require('./common');
var YAMLException = require('./exception');
var Type          = require('./type');


function compileList(schema, name, result) {
  var exclude = [];

  schema.include.forEach(function (includedSchema) {
    result = compileList(includedSchema, name, result);
  });

  schema[name].forEach(function (currentType) {
    result.forEach(function (previousType, previousIndex) {
      if (previousType.tag === currentType.tag && previousType.kind === currentType.kind) {
        exclude.push(previousIndex);
      }
    });

    result.push(currentType);
  });

  return result.filter(function (type, index) {
    return exclude.indexOf(index) === -1;
  });
}


function compileMap(/* lists... */) {
  var result = {
        scalar: {},
        sequence: {},
        mapping: {},
        fallback: {}
      }, index, length;

  function collectType(type) {
    result[type.kind][type.tag] = result['fallback'][type.tag] = type;
  }

  for (index = 0, length = arguments.length; index < length; index += 1) {
    arguments[index].forEach(collectType);
  }
  return result;
}


function Schema(definition) {
  this.include  = definition.include  || [];
  this.implicit = definition.implicit || [];
  this.explicit = definition.explicit || [];

  this.implicit.forEach(function (type) {
    if (type.loadKind && type.loadKind !== 'scalar') {
      throw new YAMLException('There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.');
    }
  });

  this.compiledImplicit = compileList(this, 'implicit', []);
  this.compiledExplicit = compileList(this, 'explicit', []);
  this.compiledTypeMap  = compileMap(this.compiledImplicit, this.compiledExplicit);
}


Schema.DEFAULT = null;


Schema.create = function createSchema() {
  var schemas, types;

  switch (arguments.length) {
    case 1:
      schemas = Schema.DEFAULT;
      types = arguments[0];
      break;

    case 2:
      schemas = arguments[0];
      types = arguments[1];
      break;

    default:
      throw new YAMLException('Wrong number of arguments for Schema.create function');
  }

  schemas = common.toArray(schemas);
  types = common.toArray(types);

  if (!schemas.every(function (schema) { return schema instanceof Schema; })) {
    throw new YAMLException('Specified list of super schemas (or a single Schema object) contains a non-Schema object.');
  }

  if (!types.every(function (type) { return type instanceof Type; })) {
    throw new YAMLException('Specified list of YAML types (or a single Type object) contains a non-Type object.');
  }

  return new Schema({
    include: schemas,
    explicit: types
  });
};


module.exports = Schema;

},{"./common":43,"./exception":45,"./type":54}],49:[function(require,module,exports){
// Standard YAML's Core schema.
// http://www.yaml.org/spec/1.2/spec.html#id2804923
//
// NOTE: JS-YAML does not support schema-specific tag resolution restrictions.
// So, Core schema has no distinctions from JSON schema is JS-YAML.


'use strict';


var Schema = require('../schema');


module.exports = new Schema({
  include: [
    require('./json')
  ]
});

},{"../schema":48,"./json":53}],50:[function(require,module,exports){
// JS-YAML's default schema for `load` function.
// It is not described in the YAML specification.
//
// This schema is based on JS-YAML's default safe schema and includes
// JavaScript-specific types: !!js/undefined, !!js/regexp and !!js/function.
//
// Also this schema is used as default base schema at `Schema.create` function.


'use strict';


var Schema = require('../schema');


module.exports = Schema.DEFAULT = new Schema({
  include: [
    require('./default_safe')
  ],
  explicit: [
    require('../type/js/undefined'),
    require('../type/js/regexp'),
    require('../type/js/function')
  ]
});

},{"../schema":48,"../type/js/function":59,"../type/js/regexp":60,"../type/js/undefined":61,"./default_safe":51}],51:[function(require,module,exports){
// JS-YAML's default schema for `safeLoad` function.
// It is not described in the YAML specification.
//
// This schema is based on standard YAML's Core schema and includes most of
// extra types described at YAML tag repository. (http://yaml.org/type/)


'use strict';


var Schema = require('../schema');


module.exports = new Schema({
  include: [
    require('./core')
  ],
  implicit: [
    require('../type/timestamp'),
    require('../type/merge')
  ],
  explicit: [
    require('../type/binary'),
    require('../type/omap'),
    require('../type/pairs'),
    require('../type/set')
  ]
});

},{"../schema":48,"../type/binary":55,"../type/merge":63,"../type/omap":65,"../type/pairs":66,"../type/set":68,"../type/timestamp":70,"./core":49}],52:[function(require,module,exports){
// Standard YAML's Failsafe schema.
// http://www.yaml.org/spec/1.2/spec.html#id2802346


'use strict';


var Schema = require('../schema');


module.exports = new Schema({
  explicit: [
    require('../type/str'),
    require('../type/seq'),
    require('../type/map')
  ]
});

},{"../schema":48,"../type/map":62,"../type/seq":67,"../type/str":69}],53:[function(require,module,exports){
// Standard YAML's JSON schema.
// http://www.yaml.org/spec/1.2/spec.html#id2803231
//
// NOTE: JS-YAML does not support schema-specific tag resolution restrictions.
// So, this schema is not such strict as defined in the YAML specification.
// It allows numbers in binary notaion, use `Null` and `NULL` as `null`, etc.


'use strict';


var Schema = require('../schema');


module.exports = new Schema({
  include: [
    require('./failsafe')
  ],
  implicit: [
    require('../type/null'),
    require('../type/bool'),
    require('../type/int'),
    require('../type/float')
  ]
});

},{"../schema":48,"../type/bool":56,"../type/float":57,"../type/int":58,"../type/null":64,"./failsafe":52}],54:[function(require,module,exports){
'use strict';

var YAMLException = require('./exception');

var TYPE_CONSTRUCTOR_OPTIONS = [
  'kind',
  'resolve',
  'construct',
  'instanceOf',
  'predicate',
  'represent',
  'defaultStyle',
  'styleAliases'
];

var YAML_NODE_KINDS = [
  'scalar',
  'sequence',
  'mapping'
];

function compileStyleAliases(map) {
  var result = {};

  if (map !== null) {
    Object.keys(map).forEach(function (style) {
      map[style].forEach(function (alias) {
        result[String(alias)] = style;
      });
    });
  }

  return result;
}

function Type(tag, options) {
  options = options || {};

  Object.keys(options).forEach(function (name) {
    if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
      throw new YAMLException('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
    }
  });

  // TODO: Add tag format check.
  this.tag          = tag;
  this.kind         = options['kind']         || null;
  this.resolve      = options['resolve']      || function () { return true; };
  this.construct    = options['construct']    || function (data) { return data; };
  this.instanceOf   = options['instanceOf']   || null;
  this.predicate    = options['predicate']    || null;
  this.represent    = options['represent']    || null;
  this.defaultStyle = options['defaultStyle'] || null;
  this.styleAliases = compileStyleAliases(options['styleAliases'] || null);

  if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
    throw new YAMLException('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
  }
}

module.exports = Type;

},{"./exception":45}],55:[function(require,module,exports){
'use strict';

/*eslint-disable no-bitwise*/

var NodeBuffer;

try {
  // A trick for browserified version, to not include `Buffer` shim
  var _require = require;
  NodeBuffer = _require('buffer').Buffer;
} catch (__) {}

var Type       = require('../type');


// [ 64, 65, 66 ] -> [ padding, CR, LF ]
var BASE64_MAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r';


function resolveYamlBinary(data) {
  if (data === null) return false;

  var code, idx, bitlen = 0, max = data.length, map = BASE64_MAP;

  // Convert one by one.
  for (idx = 0; idx < max; idx++) {
    code = map.indexOf(data.charAt(idx));

    // Skip CR/LF
    if (code > 64) continue;

    // Fail on illegal characters
    if (code < 0) return false;

    bitlen += 6;
  }

  // If there are any bits left, source was corrupted
  return (bitlen % 8) === 0;
}

function constructYamlBinary(data) {
  var idx, tailbits,
      input = data.replace(/[\r\n=]/g, ''), // remove CR/LF & padding to simplify scan
      max = input.length,
      map = BASE64_MAP,
      bits = 0,
      result = [];

  // Collect by 6*4 bits (3 bytes)

  for (idx = 0; idx < max; idx++) {
    if ((idx % 4 === 0) && idx) {
      result.push((bits >> 16) & 0xFF);
      result.push((bits >> 8) & 0xFF);
      result.push(bits & 0xFF);
    }

    bits = (bits << 6) | map.indexOf(input.charAt(idx));
  }

  // Dump tail

  tailbits = (max % 4) * 6;

  if (tailbits === 0) {
    result.push((bits >> 16) & 0xFF);
    result.push((bits >> 8) & 0xFF);
    result.push(bits & 0xFF);
  } else if (tailbits === 18) {
    result.push((bits >> 10) & 0xFF);
    result.push((bits >> 2) & 0xFF);
  } else if (tailbits === 12) {
    result.push((bits >> 4) & 0xFF);
  }

  // Wrap into Buffer for NodeJS and leave Array for browser
  if (NodeBuffer) {
    // Support node 6.+ Buffer API when available
    return NodeBuffer.from ? NodeBuffer.from(result) : new NodeBuffer(result);
  }

  return result;
}

function representYamlBinary(object /*, style*/) {
  var result = '', bits = 0, idx, tail,
      max = object.length,
      map = BASE64_MAP;

  // Convert every three bytes to 4 ASCII characters.

  for (idx = 0; idx < max; idx++) {
    if ((idx % 3 === 0) && idx) {
      result += map[(bits >> 18) & 0x3F];
      result += map[(bits >> 12) & 0x3F];
      result += map[(bits >> 6) & 0x3F];
      result += map[bits & 0x3F];
    }

    bits = (bits << 8) + object[idx];
  }

  // Dump tail

  tail = max % 3;

  if (tail === 0) {
    result += map[(bits >> 18) & 0x3F];
    result += map[(bits >> 12) & 0x3F];
    result += map[(bits >> 6) & 0x3F];
    result += map[bits & 0x3F];
  } else if (tail === 2) {
    result += map[(bits >> 10) & 0x3F];
    result += map[(bits >> 4) & 0x3F];
    result += map[(bits << 2) & 0x3F];
    result += map[64];
  } else if (tail === 1) {
    result += map[(bits >> 2) & 0x3F];
    result += map[(bits << 4) & 0x3F];
    result += map[64];
    result += map[64];
  }

  return result;
}

function isBinary(object) {
  return NodeBuffer && NodeBuffer.isBuffer(object);
}

module.exports = new Type('tag:yaml.org,2002:binary', {
  kind: 'scalar',
  resolve: resolveYamlBinary,
  construct: constructYamlBinary,
  predicate: isBinary,
  represent: representYamlBinary
});

},{"../type":54}],56:[function(require,module,exports){
'use strict';

var Type = require('../type');

function resolveYamlBoolean(data) {
  if (data === null) return false;

  var max = data.length;

  return (max === 4 && (data === 'true' || data === 'True' || data === 'TRUE')) ||
         (max === 5 && (data === 'false' || data === 'False' || data === 'FALSE'));
}

function constructYamlBoolean(data) {
  return data === 'true' ||
         data === 'True' ||
         data === 'TRUE';
}

function isBoolean(object) {
  return Object.prototype.toString.call(object) === '[object Boolean]';
}

module.exports = new Type('tag:yaml.org,2002:bool', {
  kind: 'scalar',
  resolve: resolveYamlBoolean,
  construct: constructYamlBoolean,
  predicate: isBoolean,
  represent: {
    lowercase: function (object) { return object ? 'true' : 'false'; },
    uppercase: function (object) { return object ? 'TRUE' : 'FALSE'; },
    camelcase: function (object) { return object ? 'True' : 'False'; }
  },
  defaultStyle: 'lowercase'
});

},{"../type":54}],57:[function(require,module,exports){
'use strict';

var common = require('../common');
var Type   = require('../type');

var YAML_FLOAT_PATTERN = new RegExp(
  // 2.5e4, 2.5 and integers
  '^(?:[-+]?(?:0|[1-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?' +
  // .2e4, .2
  // special case, seems not from spec
  '|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?' +
  // 20:59
  '|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\\.[0-9_]*' +
  // .inf
  '|[-+]?\\.(?:inf|Inf|INF)' +
  // .nan
  '|\\.(?:nan|NaN|NAN))$');

function resolveYamlFloat(data) {
  if (data === null) return false;

  if (!YAML_FLOAT_PATTERN.test(data) ||
      // Quick hack to not allow integers end with `_`
      // Probably should update regexp & check speed
      data[data.length - 1] === '_') {
    return false;
  }

  return true;
}

function constructYamlFloat(data) {
  var value, sign, base, digits;

  value  = data.replace(/_/g, '').toLowerCase();
  sign   = value[0] === '-' ? -1 : 1;
  digits = [];

  if ('+-'.indexOf(value[0]) >= 0) {
    value = value.slice(1);
  }

  if (value === '.inf') {
    return (sign === 1) ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

  } else if (value === '.nan') {
    return NaN;

  } else if (value.indexOf(':') >= 0) {
    value.split(':').forEach(function (v) {
      digits.unshift(parseFloat(v, 10));
    });

    value = 0.0;
    base = 1;

    digits.forEach(function (d) {
      value += d * base;
      base *= 60;
    });

    return sign * value;

  }
  return sign * parseFloat(value, 10);
}


var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;

function representYamlFloat(object, style) {
  var res;

  if (isNaN(object)) {
    switch (style) {
      case 'lowercase': return '.nan';
      case 'uppercase': return '.NAN';
      case 'camelcase': return '.NaN';
    }
  } else if (Number.POSITIVE_INFINITY === object) {
    switch (style) {
      case 'lowercase': return '.inf';
      case 'uppercase': return '.INF';
      case 'camelcase': return '.Inf';
    }
  } else if (Number.NEGATIVE_INFINITY === object) {
    switch (style) {
      case 'lowercase': return '-.inf';
      case 'uppercase': return '-.INF';
      case 'camelcase': return '-.Inf';
    }
  } else if (common.isNegativeZero(object)) {
    return '-0.0';
  }

  res = object.toString(10);

  // JS stringifier can build scientific format without dots: 5e-100,
  // while YAML requres dot: 5.e-100. Fix it with simple hack

  return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace('e', '.e') : res;
}

function isFloat(object) {
  return (Object.prototype.toString.call(object) === '[object Number]') &&
         (object % 1 !== 0 || common.isNegativeZero(object));
}

module.exports = new Type('tag:yaml.org,2002:float', {
  kind: 'scalar',
  resolve: resolveYamlFloat,
  construct: constructYamlFloat,
  predicate: isFloat,
  represent: representYamlFloat,
  defaultStyle: 'lowercase'
});

},{"../common":43,"../type":54}],58:[function(require,module,exports){
'use strict';

var common = require('../common');
var Type   = require('../type');

function isHexCode(c) {
  return ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */)) ||
         ((0x41/* A */ <= c) && (c <= 0x46/* F */)) ||
         ((0x61/* a */ <= c) && (c <= 0x66/* f */));
}

function isOctCode(c) {
  return ((0x30/* 0 */ <= c) && (c <= 0x37/* 7 */));
}

function isDecCode(c) {
  return ((0x30/* 0 */ <= c) && (c <= 0x39/* 9 */));
}

function resolveYamlInteger(data) {
  if (data === null) return false;

  var max = data.length,
      index = 0,
      hasDigits = false,
      ch;

  if (!max) return false;

  ch = data[index];

  // sign
  if (ch === '-' || ch === '+') {
    ch = data[++index];
  }

  if (ch === '0') {
    // 0
    if (index + 1 === max) return true;
    ch = data[++index];

    // base 2, base 8, base 16

    if (ch === 'b') {
      // base 2
      index++;

      for (; index < max; index++) {
        ch = data[index];
        if (ch === '_') continue;
        if (ch !== '0' && ch !== '1') return false;
        hasDigits = true;
      }
      return hasDigits && ch !== '_';
    }


    if (ch === 'x') {
      // base 16
      index++;

      for (; index < max; index++) {
        ch = data[index];
        if (ch === '_') continue;
        if (!isHexCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== '_';
    }

    // base 8
    for (; index < max; index++) {
      ch = data[index];
      if (ch === '_') continue;
      if (!isOctCode(data.charCodeAt(index))) return false;
      hasDigits = true;
    }
    return hasDigits && ch !== '_';
  }

  // base 10 (except 0) or base 60

  // value should not start with `_`;
  if (ch === '_') return false;

  for (; index < max; index++) {
    ch = data[index];
    if (ch === '_') continue;
    if (ch === ':') break;
    if (!isDecCode(data.charCodeAt(index))) {
      return false;
    }
    hasDigits = true;
  }

  // Should have digits and should not end with `_`
  if (!hasDigits || ch === '_') return false;

  // if !base60 - done;
  if (ch !== ':') return true;

  // base60 almost not used, no needs to optimize
  return /^(:[0-5]?[0-9])+$/.test(data.slice(index));
}

function constructYamlInteger(data) {
  var value = data, sign = 1, ch, base, digits = [];

  if (value.indexOf('_') !== -1) {
    value = value.replace(/_/g, '');
  }

  ch = value[0];

  if (ch === '-' || ch === '+') {
    if (ch === '-') sign = -1;
    value = value.slice(1);
    ch = value[0];
  }

  if (value === '0') return 0;

  if (ch === '0') {
    if (value[1] === 'b') return sign * parseInt(value.slice(2), 2);
    if (value[1] === 'x') return sign * parseInt(value, 16);
    return sign * parseInt(value, 8);
  }

  if (value.indexOf(':') !== -1) {
    value.split(':').forEach(function (v) {
      digits.unshift(parseInt(v, 10));
    });

    value = 0;
    base = 1;

    digits.forEach(function (d) {
      value += (d * base);
      base *= 60;
    });

    return sign * value;

  }

  return sign * parseInt(value, 10);
}

function isInteger(object) {
  return (Object.prototype.toString.call(object)) === '[object Number]' &&
         (object % 1 === 0 && !common.isNegativeZero(object));
}

module.exports = new Type('tag:yaml.org,2002:int', {
  kind: 'scalar',
  resolve: resolveYamlInteger,
  construct: constructYamlInteger,
  predicate: isInteger,
  represent: {
    binary:      function (object) { return '0b' + object.toString(2); },
    octal:       function (object) { return '0'  + object.toString(8); },
    decimal:     function (object) { return        object.toString(10); },
    hexadecimal: function (object) { return '0x' + object.toString(16).toUpperCase(); }
  },
  defaultStyle: 'decimal',
  styleAliases: {
    binary:      [ 2,  'bin' ],
    octal:       [ 8,  'oct' ],
    decimal:     [ 10, 'dec' ],
    hexadecimal: [ 16, 'hex' ]
  }
});

},{"../common":43,"../type":54}],59:[function(require,module,exports){
'use strict';

var esprima;

// Browserified version does not have esprima
//
// 1. For node.js just require module as deps
// 2. For browser try to require mudule via external AMD system.
//    If not found - try to fallback to window.esprima. If not
//    found too - then fail to parse.
//
try {
  // workaround to exclude package from browserify list.
  var _require = require;
  esprima = _require('esprima');
} catch (_) {
  /*global window */
  if (typeof window !== 'undefined') esprima = window.esprima;
}

var Type = require('../../type');

function resolveJavascriptFunction(data) {
  if (data === null) return false;

  try {
    var source = '(' + data + ')',
        ast    = esprima.parse(source, { range: true });

    if (ast.type                    !== 'Program'             ||
        ast.body.length             !== 1                     ||
        ast.body[0].type            !== 'ExpressionStatement' ||
        ast.body[0].expression.type !== 'FunctionExpression') {
      return false;
    }

    return true;
  } catch (err) {
    return false;
  }
}

function constructJavascriptFunction(data) {
  /*jslint evil:true*/

  var source = '(' + data + ')',
      ast    = esprima.parse(source, { range: true }),
      params = [],
      body;

  if (ast.type                    !== 'Program'             ||
      ast.body.length             !== 1                     ||
      ast.body[0].type            !== 'ExpressionStatement' ||
      ast.body[0].expression.type !== 'FunctionExpression') {
    throw new Error('Failed to resolve function');
  }

  ast.body[0].expression.params.forEach(function (param) {
    params.push(param.name);
  });

  body = ast.body[0].expression.body.range;

  // Esprima's ranges include the first '{' and the last '}' characters on
  // function expressions. So cut them out.
  /*eslint-disable no-new-func*/
  return new Function(params, source.slice(body[0] + 1, body[1] - 1));
}

function representJavascriptFunction(object /*, style*/) {
  return object.toString();
}

function isFunction(object) {
  return Object.prototype.toString.call(object) === '[object Function]';
}

module.exports = new Type('tag:yaml.org,2002:js/function', {
  kind: 'scalar',
  resolve: resolveJavascriptFunction,
  construct: constructJavascriptFunction,
  predicate: isFunction,
  represent: representJavascriptFunction
});

},{"../../type":54}],60:[function(require,module,exports){
'use strict';

var Type = require('../../type');

function resolveJavascriptRegExp(data) {
  if (data === null) return false;
  if (data.length === 0) return false;

  var regexp = data,
      tail   = /\/([gim]*)$/.exec(data),
      modifiers = '';

  // if regexp starts with '/' it can have modifiers and must be properly closed
  // `/foo/gim` - modifiers tail can be maximum 3 chars
  if (regexp[0] === '/') {
    if (tail) modifiers = tail[1];

    if (modifiers.length > 3) return false;
    // if expression starts with /, is should be properly terminated
    if (regexp[regexp.length - modifiers.length - 1] !== '/') return false;
  }

  return true;
}

function constructJavascriptRegExp(data) {
  var regexp = data,
      tail   = /\/([gim]*)$/.exec(data),
      modifiers = '';

  // `/foo/gim` - tail can be maximum 4 chars
  if (regexp[0] === '/') {
    if (tail) modifiers = tail[1];
    regexp = regexp.slice(1, regexp.length - modifiers.length - 1);
  }

  return new RegExp(regexp, modifiers);
}

function representJavascriptRegExp(object /*, style*/) {
  var result = '/' + object.source + '/';

  if (object.global) result += 'g';
  if (object.multiline) result += 'm';
  if (object.ignoreCase) result += 'i';

  return result;
}

function isRegExp(object) {
  return Object.prototype.toString.call(object) === '[object RegExp]';
}

module.exports = new Type('tag:yaml.org,2002:js/regexp', {
  kind: 'scalar',
  resolve: resolveJavascriptRegExp,
  construct: constructJavascriptRegExp,
  predicate: isRegExp,
  represent: representJavascriptRegExp
});

},{"../../type":54}],61:[function(require,module,exports){
'use strict';

var Type = require('../../type');

function resolveJavascriptUndefined() {
  return true;
}

function constructJavascriptUndefined() {
  /*eslint-disable no-undefined*/
  return undefined;
}

function representJavascriptUndefined() {
  return '';
}

function isUndefined(object) {
  return typeof object === 'undefined';
}

module.exports = new Type('tag:yaml.org,2002:js/undefined', {
  kind: 'scalar',
  resolve: resolveJavascriptUndefined,
  construct: constructJavascriptUndefined,
  predicate: isUndefined,
  represent: representJavascriptUndefined
});

},{"../../type":54}],62:[function(require,module,exports){
'use strict';

var Type = require('../type');

module.exports = new Type('tag:yaml.org,2002:map', {
  kind: 'mapping',
  construct: function (data) { return data !== null ? data : {}; }
});

},{"../type":54}],63:[function(require,module,exports){
'use strict';

var Type = require('../type');

function resolveYamlMerge(data) {
  return data === '<<' || data === null;
}

module.exports = new Type('tag:yaml.org,2002:merge', {
  kind: 'scalar',
  resolve: resolveYamlMerge
});

},{"../type":54}],64:[function(require,module,exports){
'use strict';

var Type = require('../type');

function resolveYamlNull(data) {
  if (data === null) return true;

  var max = data.length;

  return (max === 1 && data === '~') ||
         (max === 4 && (data === 'null' || data === 'Null' || data === 'NULL'));
}

function constructYamlNull() {
  return null;
}

function isNull(object) {
  return object === null;
}

module.exports = new Type('tag:yaml.org,2002:null', {
  kind: 'scalar',
  resolve: resolveYamlNull,
  construct: constructYamlNull,
  predicate: isNull,
  represent: {
    canonical: function () { return '~';    },
    lowercase: function () { return 'null'; },
    uppercase: function () { return 'NULL'; },
    camelcase: function () { return 'Null'; }
  },
  defaultStyle: 'lowercase'
});

},{"../type":54}],65:[function(require,module,exports){
'use strict';

var Type = require('../type');

var _hasOwnProperty = Object.prototype.hasOwnProperty;
var _toString       = Object.prototype.toString;

function resolveYamlOmap(data) {
  if (data === null) return true;

  var objectKeys = [], index, length, pair, pairKey, pairHasKey,
      object = data;

  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    pairHasKey = false;

    if (_toString.call(pair) !== '[object Object]') return false;

    for (pairKey in pair) {
      if (_hasOwnProperty.call(pair, pairKey)) {
        if (!pairHasKey) pairHasKey = true;
        else return false;
      }
    }

    if (!pairHasKey) return false;

    if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
    else return false;
  }

  return true;
}

function constructYamlOmap(data) {
  return data !== null ? data : [];
}

module.exports = new Type('tag:yaml.org,2002:omap', {
  kind: 'sequence',
  resolve: resolveYamlOmap,
  construct: constructYamlOmap
});

},{"../type":54}],66:[function(require,module,exports){
'use strict';

var Type = require('../type');

var _toString = Object.prototype.toString;

function resolveYamlPairs(data) {
  if (data === null) return true;

  var index, length, pair, keys, result,
      object = data;

  result = new Array(object.length);

  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];

    if (_toString.call(pair) !== '[object Object]') return false;

    keys = Object.keys(pair);

    if (keys.length !== 1) return false;

    result[index] = [ keys[0], pair[keys[0]] ];
  }

  return true;
}

function constructYamlPairs(data) {
  if (data === null) return [];

  var index, length, pair, keys, result,
      object = data;

  result = new Array(object.length);

  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];

    keys = Object.keys(pair);

    result[index] = [ keys[0], pair[keys[0]] ];
  }

  return result;
}

module.exports = new Type('tag:yaml.org,2002:pairs', {
  kind: 'sequence',
  resolve: resolveYamlPairs,
  construct: constructYamlPairs
});

},{"../type":54}],67:[function(require,module,exports){
'use strict';

var Type = require('../type');

module.exports = new Type('tag:yaml.org,2002:seq', {
  kind: 'sequence',
  construct: function (data) { return data !== null ? data : []; }
});

},{"../type":54}],68:[function(require,module,exports){
'use strict';

var Type = require('../type');

var _hasOwnProperty = Object.prototype.hasOwnProperty;

function resolveYamlSet(data) {
  if (data === null) return true;

  var key, object = data;

  for (key in object) {
    if (_hasOwnProperty.call(object, key)) {
      if (object[key] !== null) return false;
    }
  }

  return true;
}

function constructYamlSet(data) {
  return data !== null ? data : {};
}

module.exports = new Type('tag:yaml.org,2002:set', {
  kind: 'mapping',
  resolve: resolveYamlSet,
  construct: constructYamlSet
});

},{"../type":54}],69:[function(require,module,exports){
'use strict';

var Type = require('../type');

module.exports = new Type('tag:yaml.org,2002:str', {
  kind: 'scalar',
  construct: function (data) { return data !== null ? data : ''; }
});

},{"../type":54}],70:[function(require,module,exports){
'use strict';

var Type = require('../type');

var YAML_DATE_REGEXP = new RegExp(
  '^([0-9][0-9][0-9][0-9])'          + // [1] year
  '-([0-9][0-9])'                    + // [2] month
  '-([0-9][0-9])$');                   // [3] day

var YAML_TIMESTAMP_REGEXP = new RegExp(
  '^([0-9][0-9][0-9][0-9])'          + // [1] year
  '-([0-9][0-9]?)'                   + // [2] month
  '-([0-9][0-9]?)'                   + // [3] day
  '(?:[Tt]|[ \\t]+)'                 + // ...
  '([0-9][0-9]?)'                    + // [4] hour
  ':([0-9][0-9])'                    + // [5] minute
  ':([0-9][0-9])'                    + // [6] second
  '(?:\\.([0-9]*))?'                 + // [7] fraction
  '(?:[ \\t]*(Z|([-+])([0-9][0-9]?)' + // [8] tz [9] tz_sign [10] tz_hour
  '(?::([0-9][0-9]))?))?$');           // [11] tz_minute

function resolveYamlTimestamp(data) {
  if (data === null) return false;
  if (YAML_DATE_REGEXP.exec(data) !== null) return true;
  if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
  return false;
}

function constructYamlTimestamp(data) {
  var match, year, month, day, hour, minute, second, fraction = 0,
      delta = null, tz_hour, tz_minute, date;

  match = YAML_DATE_REGEXP.exec(data);
  if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);

  if (match === null) throw new Error('Date resolve error');

  // match: [1] year [2] month [3] day

  year = +(match[1]);
  month = +(match[2]) - 1; // JS month starts with 0
  day = +(match[3]);

  if (!match[4]) { // no hour
    return new Date(Date.UTC(year, month, day));
  }

  // match: [4] hour [5] minute [6] second [7] fraction

  hour = +(match[4]);
  minute = +(match[5]);
  second = +(match[6]);

  if (match[7]) {
    fraction = match[7].slice(0, 3);
    while (fraction.length < 3) { // milli-seconds
      fraction += '0';
    }
    fraction = +fraction;
  }

  // match: [8] tz [9] tz_sign [10] tz_hour [11] tz_minute

  if (match[9]) {
    tz_hour = +(match[10]);
    tz_minute = +(match[11] || 0);
    delta = (tz_hour * 60 + tz_minute) * 60000; // delta in mili-seconds
    if (match[9] === '-') delta = -delta;
  }

  date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));

  if (delta) date.setTime(date.getTime() - delta);

  return date;
}

function representYamlTimestamp(object /*, style*/) {
  return object.toISOString();
}

module.exports = new Type('tag:yaml.org,2002:timestamp', {
  kind: 'scalar',
  resolve: resolveYamlTimestamp,
  construct: constructYamlTimestamp,
  instanceOf: Date,
  represent: representYamlTimestamp
});

},{"../type":54}],71:[function(require,module,exports){
/** !
 * JSON Schema $Ref Parser v3.3.1
 *
 * @link https://github.com/BigstickCarpet/json-schema-ref-parser
 * @license MIT
 */
'use strict';

var $Ref    = require('./ref'),
    Pointer = require('./pointer'),
    debug   = require('./util/debug'),
    url     = require('./util/url');

module.exports = bundle;

/**
 * Bundles all external JSON references into the main JSON schema, thus resulting in a schema that
 * only has *internal* references, not any *external* references.
 * This method mutates the JSON schema object, adding new references and re-mapping existing ones.
 *
 * @param {$RefParser} parser
 * @param {$RefParserOptions} options
 */
function bundle(parser, options) {
  debug('Bundling $ref pointers in %s', parser.$refs._root$Ref.path);

  // Build an inventory of all $ref pointers in the JSON Schema
  var inventory = [];
  crawl(parser, 'schema', parser.$refs._root$Ref.path + '#', '#', inventory, parser.$refs, options);

  // Remap all $ref pointers
  remap(inventory);
}

/**
 * Recursively crawls the given value, and inventories all JSON references.
 *
 * @param {object} parent - The object containing the value to crawl. If the value is not an object or array, it will be ignored.
 * @param {string} key - The property key of `parent` to be crawled
 * @param {string} path - The full path of the property being crawled, possibly with a JSON Pointer in the hash
 * @param {string} pathFromRoot - The path of the property being crawled, from the schema root
 * @param {object[]} inventory - An array of already-inventoried $ref pointers
 * @param {$Refs} $refs
 * @param {$RefParserOptions} options
 */
function crawl(parent, key, path, pathFromRoot, inventory, $refs, options) {
  var obj = key === null ? parent : parent[key];

  if (obj && typeof obj === 'object') {
    if ($Ref.isAllowed$Ref(obj)) {
      inventory$Ref(parent, key, path, pathFromRoot, inventory, $refs, options);
    }
    else {
      var keys = Object.keys(obj);

      // Most people will expect references to be bundled into the the "definitions" property,
      // so we always crawl that property first, if it exists.
      var defs = keys.indexOf('definitions');
      if (defs > 0) {
        keys.splice(0, 0, keys.splice(defs, 1)[0]);
      }

      keys.forEach(function(key) {
        var keyPath = Pointer.join(path, key);
        var keyPathFromRoot = Pointer.join(pathFromRoot, key);
        var value = obj[key];

        if ($Ref.isAllowed$Ref(value)) {
          inventory$Ref(obj, key, path, keyPathFromRoot, inventory, $refs, options);
        }
        else {
          crawl(obj, key, keyPath, keyPathFromRoot, inventory, $refs, options);
        }
      });
    }
  }
}

/**
 * Inventories the given JSON Reference (i.e. records detailed information about it so we can
 * optimize all $refs in the schema), and then crawls the resolved value.
 *
 * @param {object} $refParent - The object that contains a JSON Reference as one of its keys
 * @param {string} $refKey - The key in `$refParent` that is a JSON Reference
 * @param {string} path - The full path of the JSON Reference at `$refKey`, possibly with a JSON Pointer in the hash
 * @param {string} pathFromRoot - The path of the JSON Reference at `$refKey`, from the schema root
 * @param {object[]} inventory - An array of already-inventoried $ref pointers
 * @param {$Refs} $refs
 * @param {$RefParserOptions} options
 */
function inventory$Ref($refParent, $refKey, path, pathFromRoot, inventory, $refs, options) {
  if (inventory.some(function(i) { return i.parent === $refParent && i.key === $refKey; })) {
    // This $Ref has already been inventoried, so we don't need to process it again
    return;
  }

  var $ref = $refKey === null ? $refParent : $refParent[$refKey];
  var $refPath = url.resolve(path, $ref.$ref);
  var pointer = $refs._resolve($refPath, options);
  var depth = Pointer.parse(pathFromRoot).length;
  var file = url.stripHash(pointer.path);
  var hash = url.getHash(pointer.path);
  var external = file !== $refs._root$Ref.path;
  var extended = $Ref.isExtended$Ref($ref);

  inventory.push({
    $ref: $ref,                   // The JSON Reference (e.g. {$ref: string})
    parent: $refParent,           // The object that contains this $ref pointer
    key: $refKey,                 // The key in `parent` that is the $ref pointer
    pathFromRoot: pathFromRoot,   // The path to the $ref pointer, from the JSON Schema root
    depth: depth,                 // How far from the JSON Schema root is this $ref pointer?
    file: file,                   // The file that the $ref pointer resolves to
    hash: hash,                   // The hash within `file` that the $ref pointer resolves to
    value: pointer.value,         // The resolved value of the $ref pointer
    circular: pointer.circular,   // Is this $ref pointer DIRECTLY circular? (i.e. it references itself)
    extended: extended,           // Does this $ref extend its resolved value? (i.e. it has extra properties, in addition to "$ref")
    external: external            // Does this $ref pointer point to a file other than the main JSON Schema file?
  });

  // Recursively crawl the resolved value
  crawl(pointer.value, null, pointer.path, pathFromRoot, inventory, $refs, options);
}

/**
 * Re-maps every $ref pointer, so that they're all relative to the root of the JSON Schema.
 * Each referenced value is dereferenced EXACTLY ONCE.  All subsequent references to the same
 * value are re-mapped to point to the first reference.
 *
 * @example:
 *  {
 *    first: { $ref: somefile.json#/some/part },
 *    second: { $ref: somefile.json#/another/part },
 *    third: { $ref: somefile.json },
 *    fourth: { $ref: somefile.json#/some/part/sub/part }
 *  }
 *
 * In this example, there are four references to the same file, but since the third reference points
 * to the ENTIRE file, that's the only one we need to dereference.  The other three can just be
 * remapped to point inside the third one.
 *
 * On the other hand, if the third reference DIDN'T exist, then the first and second would both need
 * to be dereferenced, since they point to different parts of the file. The fourth reference does NOT
 * need to be dereferenced, because it can be remapped to point inside the first one.
 *
 * @param {object[]} inventory
 */
function remap(inventory) {
  // Group & sort all the $ref pointers, so they're in the order that we need to dereference/remap them
  inventory.sort(function(a, b) {
    if (a.file !== b.file) {
      return a.file < b.file ? -1 : +1;   // Group all the $refs that point to the same file
    }
    else if (a.hash !== b.hash) {
      return a.hash < b.hash ? -1 : +1;   // Group all the $refs that point to the same part of the file
    }
    else if (a.circular !== b.circular) {
      return a.circular ? -1 : +1;        // If the $ref points to itself, then sort it higher than other $refs that point to this $ref
    }
    else if (a.extended !== b.extended) {
      return a.extended ? +1 : -1;        // If the $ref extends the resolved value, then sort it lower than other $refs that don't extend the value
    }
    else if (a.depth !== b.depth) {
      return a.depth - b.depth;           // Sort $refs by how close they are to the JSON Schema root
    }
    else {
      // If all else is equal, use the $ref that's in the "definitions" property
      return b.pathFromRoot.lastIndexOf('/definitions') - a.pathFromRoot.lastIndexOf('/definitions');
    }
  });

  var file, hash, pathFromRoot;
  inventory.forEach(function(i) {
    debug('Re-mapping $ref pointer "%s" at %s', i.$ref.$ref, i.pathFromRoot);

    if (!i.external) {
      // This $ref already resolves to the main JSON Schema file
      i.$ref.$ref = i.hash;
    }
    else if (i.file === file && i.hash === hash) {
      // This $ref points to the same value as the prevous $ref, so remap it to the same path
      i.$ref.$ref = pathFromRoot;
    }
    else if (i.file === file && i.hash.indexOf(hash + '/') === 0) {
      // This $ref points to the a sub-value as the prevous $ref, so remap it beneath that path
      i.$ref.$ref = Pointer.join(pathFromRoot, Pointer.parse(i.hash));
    }
    else {
      // We've moved to a new file or new hash
      file = i.file;
      hash = i.hash;
      pathFromRoot = i.pathFromRoot;

      // This is the first $ref to point to this value, so dereference the value.
      // Any other $refs that point to the same value will point to this $ref instead
      i.$ref = i.parent[i.key] = $Ref.dereference(i.$ref, i.value);

      if (i.circular) {
        // This $ref points to itself
        i.$ref.$ref = i.pathFromRoot;
      }
    }

    debug('    new value: %s', (i.$ref && i.$ref.$ref) ? i.$ref.$ref : '[object Object]');
  });
}

},{"./pointer":80,"./ref":81,"./util/debug":86,"./util/url":89}],72:[function(require,module,exports){
'use strict';

var $Ref    = require('./ref'),
    Pointer = require('./pointer'),
    ono     = require('ono'),
    debug   = require('./util/debug'),
    url     = require('./util/url');

module.exports = dereference;

/**
 * Crawls the JSON schema, finds all JSON references, and dereferences them.
 * This method mutates the JSON schema object, replacing JSON references with their resolved value.
 *
 * @param {$RefParser} parser
 * @param {$RefParserOptions} options
 */
function dereference(parser, options) {
  debug('Dereferencing $ref pointers in %s', parser.$refs._root$Ref.path);
  var dereferenced = crawl(parser.schema, parser.$refs._root$Ref.path, '#', [], parser.$refs, options);
  parser.$refs.circular = dereferenced.circular;
  parser.schema = dereferenced.value;
}

/**
 * Recursively crawls the given value, and dereferences any JSON references.
 *
 * @param {*} obj - The value to crawl. If it's not an object or array, it will be ignored.
 * @param {string} path - The full path of `obj`, possibly with a JSON Pointer in the hash
 * @param {string} pathFromRoot - The path of `obj` from the schema root
 * @param {object[]} parents - An array of the parent objects that have already been dereferenced
 * @param {$Refs} $refs
 * @param {$RefParserOptions} options
 * @returns {{value: object, circular: boolean}}
 */
function crawl(obj, path, pathFromRoot, parents, $refs, options) {
  var dereferenced;
  var result = {
    value: obj,
    circular: false
  };

  if (obj && typeof obj === 'object') {
    parents.push(obj);

    if ($Ref.isAllowed$Ref(obj, options)) {
      dereferenced = dereference$Ref(obj, path, pathFromRoot, parents, $refs, options);
      result.circular = dereferenced.circular;
      result.value = dereferenced.value;
    }
    else {
      Object.keys(obj).forEach(function(key) {
        var keyPath = Pointer.join(path, key);
        var keyPathFromRoot = Pointer.join(pathFromRoot, key);
        var value = obj[key];
        var circular = false;

        if ($Ref.isAllowed$Ref(value, options)) {
          dereferenced = dereference$Ref(value, keyPath, keyPathFromRoot, parents, $refs, options);
          circular = dereferenced.circular;
          obj[key] = dereferenced.value;
        }
        else {
          if (parents.indexOf(value) === -1) {
            dereferenced = crawl(value, keyPath, keyPathFromRoot, parents, $refs, options);
            circular = dereferenced.circular;
            obj[key] = dereferenced.value;
          }
          else {
            circular = foundCircularReference(keyPath, $refs, options);
          }
        }

        // Set the "isCircular" flag if this or any other property is circular
        result.circular = result.circular || circular;
      });
    }

    parents.pop();
  }

  return result;
}

/**
 * Dereferences the given JSON Reference, and then crawls the resulting value.
 *
 * @param {{$ref: string}} $ref - The JSON Reference to resolve
 * @param {string} path - The full path of `$ref`, possibly with a JSON Pointer in the hash
 * @param {string} pathFromRoot - The path of `$ref` from the schema root
 * @param {object[]} parents - An array of the parent objects that have already been dereferenced
 * @param {$Refs} $refs
 * @param {$RefParserOptions} options
 * @returns {{value: object, circular: boolean}}
 */
function dereference$Ref($ref, path, pathFromRoot, parents, $refs, options) {
  debug('Dereferencing $ref pointer "%s" at %s', $ref.$ref, path);

  var $refPath = url.resolve(path, $ref.$ref);
  var pointer = $refs._resolve($refPath, options);

  // Check for circular references
  var directCircular = pointer.circular;
  var circular = directCircular || parents.indexOf(pointer.value) !== -1;
  circular && foundCircularReference(path, $refs, options);

  // Dereference the JSON reference
  var dereferencedValue = $Ref.dereference($ref, pointer.value);

  // Crawl the dereferenced value (unless it's circular)
  if (!circular) {
    // Determine if the dereferenced value is circular
    var dereferenced = crawl(dereferencedValue, pointer.path, pathFromRoot, parents, $refs, options);
    circular = dereferenced.circular;
    dereferencedValue = dereferenced.value;
  }

  if (circular && !directCircular && options.dereference.circular === 'ignore') {
    // The user has chosen to "ignore" circular references, so don't change the value
    dereferencedValue = $ref;
  }

  if (directCircular) {
    // The pointer is a DIRECT circular reference (i.e. it references itself).
    // So replace the $ref path with the absolute path from the JSON Schema root
    dereferencedValue.$ref = pathFromRoot;
  }

  return {
    circular: circular,
    value: dereferencedValue
  };
}

/**
 * Called when a circular reference is found.
 * It sets the {@link $Refs#circular} flag, and throws an error if options.dereference.circular is false.
 *
 * @param {string} keyPath - The JSON Reference path of the circular reference
 * @param {$Refs} $refs
 * @param {$RefParserOptions} options
 * @returns {boolean} - always returns true, to indicate that a circular reference was found
 */
function foundCircularReference(keyPath, $refs, options) {
  $refs.circular = true;
  if (!options.dereference.circular) {
    throw ono.reference('Circular $ref pointer found at %s', keyPath);
  }
  return true;
}

},{"./pointer":80,"./ref":81,"./util/debug":86,"./util/url":89,"ono":94}],73:[function(require,module,exports){
(function (Buffer){
'use strict';

var Promise         = require('./util/promise'),
    Options         = require('./options'),
    $Refs           = require('./refs'),
    parse           = require('./parse'),
    resolveExternal = require('./resolve-external'),
    bundle          = require('./bundle'),
    dereference     = require('./dereference'),
    url             = require('./util/url'),
    maybe           = require('call-me-maybe'),
    ono             = require('ono');

module.exports = $RefParser;
module.exports.YAML = require('./util/yaml');

/**
 * This class parses a JSON schema, builds a map of its JSON references and their resolved values,
 * and provides methods for traversing, manipulating, and dereferencing those references.
 *
 * @constructor
 */
function $RefParser() {
  /**
   * The parsed (and possibly dereferenced) JSON schema object
   *
   * @type {object}
   * @readonly
   */
  this.schema = null;

  /**
   * The resolved JSON references
   *
   * @type {$Refs}
   * @readonly
   */
  this.$refs = new $Refs();
}

/**
 * Parses the given JSON schema.
 * This method does not resolve any JSON references.
 * It just reads a single file in JSON or YAML format, and parse it as a JavaScript object.
 *
 * @param {string|object} schema - The file path or URL of the JSON schema. Or a JSON schema object.
 * @param {$RefParserOptions} [options] - Options that determine how the schema is parsed
 * @param {function} [callback] - An error-first callback. The second parameter is the parsed JSON schema object.
 * @returns {Promise} - The returned promise resolves with the parsed JSON schema object.
 */
$RefParser.parse = function(schema, options, callback) {
  var Class = this; // eslint-disable-line consistent-this
  var instance = new Class();
  return instance.parse.apply(instance, arguments);
};

/**
 * Parses the given JSON schema.
 * This method does not resolve any JSON references.
 * It just reads a single file in JSON or YAML format, and parse it as a JavaScript object.
 *
 * @param {string|object} schema - The file path or URL of the JSON schema. Or a JSON schema object.
 * @param {$RefParserOptions} [options] - Options that determine how the schema is parsed
 * @param {function} [callback] - An error-first callback. The second parameter is the parsed JSON schema object.
 * @returns {Promise} - The returned promise resolves with the parsed JSON schema object.
 */
$RefParser.prototype.parse = function(schema, options, callback) {
  var args = normalizeArgs(arguments);
  var promise;

  if (!args.path && !args.schema) {
    var err = ono('Expected a file path, URL, or object. Got %s', args.path || args.schema);
    return maybe(args.callback, Promise.reject(err));
  }

  // Reset everything
  this.schema = null;
  this.$refs = new $Refs();

  // If the path is a filesystem path, then convert it to a URL.
  // NOTE: According to the JSON Reference spec, these should already be URLs,
  // but, in practice, many people use local filesystem paths instead.
  // So we're being generous here and doing the conversion automatically.
  // This is not intended to be a 100% bulletproof solution.
  // If it doesn't work for your use-case, then use a URL instead.
  if (url.isFileSystemPath(args.path)) {
    args.path = url.fromFileSystemPath(args.path);
  }

  // Resolve the absolute path of the schema
  args.path = url.resolve(url.cwd(), args.path);

  if (args.schema && typeof args.schema === 'object') {
    // A schema object was passed-in.
    // So immediately add a new $Ref with the schema object as its value
    this.$refs._add(args.path, args.schema);
    promise = Promise.resolve(args.schema);
  }
  else {
    // Parse the schema file/url
    promise = parse(args.path, this.$refs, args.options);
  }

  var me = this;
  return promise
    .then(function(result) {
      if (!result || typeof result !== 'object' || Buffer.isBuffer(result)) {
        throw ono.syntax('"%s" is not a valid JSON Schema', me.$refs._root$Ref.path || result);
      }
      else {
        me.schema = result;
        return maybe(args.callback, Promise.resolve(me.schema));
      }
    })
    .catch(function(e) {
      return maybe(args.callback, Promise.reject(e));
    });
};

/**
 * Parses the given JSON schema and resolves any JSON references, including references in
 * externally-referenced files.
 *
 * @param {string|object} schema - The file path or URL of the JSON schema. Or a JSON schema object.
 * @param {$RefParserOptions} [options] - Options that determine how the schema is parsed and resolved
 * @param {function} [callback]
 * - An error-first callback. The second parameter is a {@link $Refs} object containing the resolved JSON references
 *
 * @returns {Promise}
 * The returned promise resolves with a {@link $Refs} object containing the resolved JSON references
 */
$RefParser.resolve = function(schema, options, callback) {
  var Class = this; // eslint-disable-line consistent-this
  var instance = new Class();
  return instance.resolve.apply(instance, arguments);
};

/**
 * Parses the given JSON schema and resolves any JSON references, including references in
 * externally-referenced files.
 *
 * @param {string|object} schema - The file path or URL of the JSON schema. Or a JSON schema object.
 * @param {$RefParserOptions} [options] - Options that determine how the schema is parsed and resolved
 * @param {function} [callback]
 * - An error-first callback. The second parameter is a {@link $Refs} object containing the resolved JSON references
 *
 * @returns {Promise}
 * The returned promise resolves with a {@link $Refs} object containing the resolved JSON references
 */
$RefParser.prototype.resolve = function(schema, options, callback) {
  var me = this;
  var args = normalizeArgs(arguments);

  return this.parse(args.path, args.schema, args.options)
    .then(function() {
      return resolveExternal(me, args.options);
    })
    .then(function() {
      return maybe(args.callback, Promise.resolve(me.$refs));
    })
    .catch(function(err) {
      return maybe(args.callback, Promise.reject(err));
    });
};

/**
 * Parses the given JSON schema, resolves any JSON references, and bundles all external references
 * into the main JSON schema. This produces a JSON schema that only has *internal* references,
 * not any *external* references.
 *
 * @param {string|object} schema - The file path or URL of the JSON schema. Or a JSON schema object.
 * @param {$RefParserOptions} [options] - Options that determine how the schema is parsed, resolved, and dereferenced
 * @param {function} [callback] - An error-first callback. The second parameter is the bundled JSON schema object
 * @returns {Promise} - The returned promise resolves with the bundled JSON schema object.
 */
$RefParser.bundle = function(schema, options, callback) {
  var Class = this; // eslint-disable-line consistent-this
  var instance = new Class();
  return instance.bundle.apply(instance, arguments);
};

/**
 * Parses the given JSON schema, resolves any JSON references, and bundles all external references
 * into the main JSON schema. This produces a JSON schema that only has *internal* references,
 * not any *external* references.
 *
 * @param {string|object} schema - The file path or URL of the JSON schema. Or a JSON schema object.
 * @param {$RefParserOptions} [options] - Options that determine how the schema is parsed, resolved, and dereferenced
 * @param {function} [callback] - An error-first callback. The second parameter is the bundled JSON schema object
 * @returns {Promise} - The returned promise resolves with the bundled JSON schema object.
 */
$RefParser.prototype.bundle = function(schema, options, callback) {
  var me = this;
  var args = normalizeArgs(arguments);

  return this.resolve(args.path, args.schema, args.options)
    .then(function() {
      bundle(me, args.options);
      return maybe(args.callback, Promise.resolve(me.schema));
    })
    .catch(function(err) {
      return maybe(args.callback, Promise.reject(err));
    });
};

/**
 * Parses the given JSON schema, resolves any JSON references, and dereferences the JSON schema.
 * That is, all JSON references are replaced with their resolved values.
 *
 * @param {string|object} schema - The file path or URL of the JSON schema. Or a JSON schema object.
 * @param {$RefParserOptions} [options] - Options that determine how the schema is parsed, resolved, and dereferenced
 * @param {function} [callback] - An error-first callback. The second parameter is the dereferenced JSON schema object
 * @returns {Promise} - The returned promise resolves with the dereferenced JSON schema object.
 */
$RefParser.dereference = function(schema, options, callback) {
  var Class = this; // eslint-disable-line consistent-this
  var instance = new Class();
  return instance.dereference.apply(instance, arguments);
};

/**
 * Parses the given JSON schema, resolves any JSON references, and dereferences the JSON schema.
 * That is, all JSON references are replaced with their resolved values.
 *
 * @param {string|object} schema - The file path or URL of the JSON schema. Or a JSON schema object.
 * @param {$RefParserOptions} [options] - Options that determine how the schema is parsed, resolved, and dereferenced
 * @param {function} [callback] - An error-first callback. The second parameter is the dereferenced JSON schema object
 * @returns {Promise} - The returned promise resolves with the dereferenced JSON schema object.
 */
$RefParser.prototype.dereference = function(schema, options, callback) {
  var me = this;
  var args = normalizeArgs(arguments);

  return this.resolve(args.path, args.schema, args.options)
    .then(function() {
      dereference(me, args.options);
      return maybe(args.callback, Promise.resolve(me.schema));
    })
    .catch(function(err) {
      return maybe(args.callback, Promise.reject(err));
    });
};

/**
 * Normalizes the given arguments, accounting for optional args.
 *
 * @param {Arguments} args
 * @returns {object}
 */
function normalizeArgs(args) {
  var path, schema, options, callback;
  args = Array.prototype.slice.call(args);

  if (typeof args[args.length - 1] === 'function') {
    // The last parameter is a callback function
    callback = args.pop();
  }

  if (typeof args[0] === 'string') {
    // The first parameter is the path
    path = args[0];
    if (typeof args[2] === 'object') {
      // The second parameter is the schema, and the third parameter is the options
      schema = args[1];
      options = args[2];
    }
    else {
      // The second parameter is the options
      schema = undefined;
      options = args[1];
    }
  }
  else {
    // The first parameter is the schema
    path = '';
    schema = args[0];
    options = args[1];
  }

  if (!(options instanceof Options)) {
    options = new Options(options);
  }

  return {
    path: path,
    schema: schema,
    options: options,
    callback: callback
  };
}

}).call(this,{"isBuffer":require("../../is-buffer/index.js")})
},{"../../is-buffer/index.js":37,"./bundle":71,"./dereference":72,"./options":74,"./parse":75,"./refs":82,"./resolve-external":83,"./util/promise":88,"./util/url":89,"./util/yaml":90,"call-me-maybe":27,"ono":94}],74:[function(require,module,exports){
/* eslint lines-around-comment: [2, {beforeBlockComment: false}] */
'use strict';

var jsonParser       = require('./parsers/json'),
    yamlParser       = require('./parsers/yaml'),
    textParser       = require('./parsers/text'),
    binaryParser     = require('./parsers/binary'),
    fileResolver     = require('./resolvers/file'),
    httpResolver     = require('./resolvers/http'),
    zschemaValidator = require('./validators/z-schema');

module.exports = $RefParserOptions;

/**
 * Options that determine how JSON schemas are parsed, resolved, dereferenced, and validated.
 *
 * @param {object|$RefParserOptions} [options] - Overridden options
 * @constructor
 */
function $RefParserOptions(options) {
  merge(this, $RefParserOptions.defaults);
  merge(this, options);
}

$RefParserOptions.defaults = {
  /**
   * Determines how different types of files will be parsed.
   *
   * You can add additional parsers of your own, replace an existing one with
   * your own implemenation, or disable any parser by setting it to false.
   */
  parse: {
    json: jsonParser,
    yaml: yamlParser,
    text: textParser,
    binary: binaryParser,
  },

  /**
   * Determines how JSON References will be resolved.
   *
   * You can add additional resolvers of your own, replace an existing one with
   * your own implemenation, or disable any resolver by setting it to false.
   */
  resolve: {
    file: fileResolver,
    http: httpResolver,

    /**
     * Determines whether external $ref pointers will be resolved.
     * If this option is disabled, then none of above resolvers will be called.
     * Instead, external $ref pointers will simply be ignored.
     *
     * @type {boolean}
     */
    external: true,
  },

  /**
   * Determines the types of JSON references that are allowed.
   */
  dereference: {
    /**
     * Dereference circular (recursive) JSON references?
     * If false, then a {@link ReferenceError} will be thrown if a circular reference is found.
     * If "ignore", then circular references will not be dereferenced.
     *
     * @type {boolean|string}
     */
    circular: true
  },

  /**
   * Validator plug-ins that can be used to validate the schema.
   */
  validate: {
    zschema: zschemaValidator
  }
};

/**
 * Merges the properties of the source object into the target object.
 *
 * @param {object} target - The object that we're populating
 * @param {?object} source - The options that are being merged
 * @returns {object}
 */
function merge(target, source) {
  if (isMergeable(source)) {
    var keys = Object.keys(source);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var sourceSetting = source[key];
      var targetSetting = target[key];

      if (isMergeable(sourceSetting)) {
        // It's a nested object, so merge it recursively
        target[key] = merge(targetSetting || {}, sourceSetting);
      }
      else if (sourceSetting !== undefined) {
        // It's a scalar value, function, or array. No merging necessary. Just overwrite the target value.
        target[key] = sourceSetting;
      }
    }
  }
  return target;
}

/**
 * Determines whether the given value can be merged,
 * or if it is a scalar value that should just override the target value.
 *
 * @param   {*}  val
 * @returns {Boolean}
 */
function isMergeable(val) {
  return val &&
    (typeof val === 'object') &&
    !Array.isArray(val) &&
    !(val instanceof RegExp) &&
    !(val instanceof Date);
}

},{"./parsers/binary":76,"./parsers/json":77,"./parsers/text":78,"./parsers/yaml":79,"./resolvers/file":84,"./resolvers/http":85,"./validators/z-schema":91}],75:[function(require,module,exports){
(function (Buffer){
'use strict';

var ono      = require('ono'),
    debug    = require('./util/debug'),
    url      = require('./util/url'),
    plugins  = require('./util/plugins'),
    Promise  = require('./util/promise');

module.exports = parse;

/**
 * Reads and parses the specified file path or URL.
 *
 * @param {string} path - This path MUST already be resolved, since `read` doesn't know the resolution context
 * @param {$Refs} $refs
 * @param {$RefParserOptions} options
 *
 * @returns {Promise}
 * The promise resolves with the parsed file contents, NOT the raw (Buffer) contents.
 */
function parse(path, $refs, options) {
  try {
    // Remove the URL fragment, if any
    path = url.stripHash(path);

    // Add a new $Ref for this file, even though we don't have the value yet.
    // This ensures that we don't simultaneously read & parse the same file multiple times
    var $ref = $refs._add(path);

    // This "file object" will be passed to all resolvers and parsers.
    var file = {
      url: path,
      extension: url.getExtension(path),
    };

    // Read the file and then parse the data
    return readFile(file, options)
      .then(function(resolver) {
        $ref.pathType = resolver.plugin.name;
        file.data = resolver.result;
        return parseFile(file, options);
      })
      .then(function(parser) {
        $ref.value = parser.result;
        return parser.result;
      });
  }
  catch (e) {
    return Promise.reject(e);
  }
}

/**
 * Reads the given file, using the configured resolver plugins
 *
 * @param {object} file           - An object containing information about the referenced file
 * @param {string} file.url       - The full URL of the referenced file
 * @param {string} file.extension - The lowercased file extension (e.g. ".txt", ".html", etc.)
 * @param {$RefParserOptions} options
 *
 * @returns {Promise}
 * The promise resolves with the raw file contents and the resolver that was used.
 */
function readFile(file, options) {
  return new Promise(function(resolve, reject) {
    debug('Reading %s', file.url);

    // Find the resolvers that can read this file
    var resolvers = plugins.all(options.resolve);
    resolvers = plugins.filter(resolvers, 'canRead', file);

    // Run the resolvers, in order, until one of them succeeds
    plugins.sort(resolvers);
    plugins.run(resolvers, 'read', file)
      .then(resolve, onError);

    function onError(err) {
      // Throw the original error, if it's one of our own (user-friendly) errors.
      // Otherwise, throw a generic, friendly error.
      if (err && !(err instanceof SyntaxError)) {
        reject(err);
      }
      else {
        reject(ono.syntax('Unable to resolve $ref pointer "%s"', file.url));
      }
    }
  });
}

/**
 * Parses the given file's contents, using the configured parser plugins.
 *
 * @param {object} file           - An object containing information about the referenced file
 * @param {string} file.url       - The full URL of the referenced file
 * @param {string} file.extension - The lowercased file extension (e.g. ".txt", ".html", etc.)
 * @param {*}      file.data      - The file contents. This will be whatever data type was returned by the resolver
 * @param {$RefParserOptions} options
 *
 * @returns {Promise}
 * The promise resolves with the parsed file contents and the parser that was used.
 */
function parseFile(file, options) {
  return new Promise(function(resolve, reject) {
    debug('Parsing %s', file.url);

    // Find the parsers that can read this file type.
    // If none of the parsers are an exact match for this file, then we'll try ALL of them.
    // This handles situations where the file IS a supported type, just with an unknown extension.
    var allParsers = plugins.all(options.parse);
    var filteredParsers = plugins.filter(allParsers, 'canParse', file);
    var parsers = filteredParsers.length > 0 ? filteredParsers : allParsers;

    // Run the parsers, in order, until one of them succeeds
    plugins.sort(parsers);
    plugins.run(parsers, 'parse', file)
      .then(onParsed, onError);

    function onParsed(parser) {
      if (!parser.plugin.allowEmpty && isEmpty(parser.result)) {
        reject(ono.syntax('Error parsing "%s" as %s. \nParsed value is empty', file.url, parser.plugin.name));
      }
      else {
        resolve(parser);
      }
    }

    function onError(err) {
      if (err) {
        err = err instanceof Error ? err : new Error(err);
        reject(ono.syntax(err, 'Error parsing %s', file.url));
      }
      else {
        reject(ono.syntax('Unable to parse %s', file.url));
      }
    }
  });
}

/**
 * Determines whether the parsed value is "empty".
 *
 * @param {*} value
 * @returns {boolean}
 */
function isEmpty(value) {
  return value === undefined ||
    (typeof value === 'object' && Object.keys(value).length === 0) ||
    (typeof value === 'string' && value.trim().length === 0) ||
    (Buffer.isBuffer(value) && value.length === 0);
}

}).call(this,{"isBuffer":require("../../is-buffer/index.js")})
},{"../../is-buffer/index.js":37,"./util/debug":86,"./util/plugins":87,"./util/promise":88,"./util/url":89,"ono":94}],76:[function(require,module,exports){
(function (Buffer){
'use strict';

var BINARY_REGEXP = /\.(jpeg|jpg|gif|png|bmp|ico)$/i;

module.exports = {
  /**
   * The order that this parser will run, in relation to other parsers.
   *
   * @type {number}
   */
  order: 400,

  /**
   * Whether to allow "empty" files (zero bytes).
   *
   * @type {boolean}
   */
  allowEmpty: true,

  /**
   * Determines whether this parser can parse a given file reference.
   * Parsers that return true will be tried, in order, until one successfully parses the file.
   * Parsers that return false will be skipped, UNLESS all parsers returned false, in which case
   * every parser will be tried.
   *
   * @param {object} file           - An object containing information about the referenced file
   * @param {string} file.url       - The full URL of the referenced file
   * @param {string} file.extension - The lowercased file extension (e.g. ".txt", ".html", etc.)
   * @param {*}      file.data      - The file contents. This will be whatever data type was returned by the resolver
   * @returns {boolean}
   */
  canParse: function isBinary(file) {
    // Use this parser if the file is a Buffer, and has a known binary extension
    return Buffer.isBuffer(file.data) && BINARY_REGEXP.test(file.url);
  },

  /**
   * Parses the given data as a Buffer (byte array).
   *
   * @param {object} file           - An object containing information about the referenced file
   * @param {string} file.url       - The full URL of the referenced file
   * @param {string} file.extension - The lowercased file extension (e.g. ".txt", ".html", etc.)
   * @param {*}      file.data      - The file contents. This will be whatever data type was returned by the resolver
   * @returns {Promise<Buffer>}
   */
  parse: function parseBinary(file) {
    if (Buffer.isBuffer(file.data)) {
      return file.data;
    }
    else {
      // This will reject if data is anything other than a string or typed array
      return new Buffer(file.data);
    }
  }
};

}).call(this,require("buffer").Buffer)
},{"buffer":25}],77:[function(require,module,exports){
(function (Buffer){
'use strict';

var Promise = require('../util/promise');

module.exports = {
  /**
   * The order that this parser will run, in relation to other parsers.
   *
   * @type {number}
   */
  order: 100,

  /**
   * Whether to allow "empty" files. This includes zero-byte files, as well as empty JSON objects.
   *
   * @type {boolean}
   */
  allowEmpty: true,

  /**
   * Determines whether this parser can parse a given file reference.
   * Parsers that match will be tried, in order, until one successfully parses the file.
   * Parsers that don't match will be skipped, UNLESS none of the parsers match, in which case
   * every parser will be tried.
   *
   * @type {RegExp|string[]|function}
   */
  canParse: '.json',

  /**
   * Parses the given file as JSON
   *
   * @param {object} file           - An object containing information about the referenced file
   * @param {string} file.url       - The full URL of the referenced file
   * @param {string} file.extension - The lowercased file extension (e.g. ".txt", ".html", etc.)
   * @param {*}      file.data      - The file contents. This will be whatever data type was returned by the resolver
   * @returns {Promise}
   */
  parse: function parseJSON(file) {
    return new Promise(function(resolve, reject) {
      var data = file.data;
      if (Buffer.isBuffer(data)) {
        data = data.toString();
      }

      if (typeof data === 'string') {
        if (data.trim().length === 0) {
          resolve(undefined);  // This mirrors the YAML behavior
        }
        else {
          resolve(JSON.parse(data));
        }
      }
      else {
        // data is already a JavaScript value (object, array, number, null, NaN, etc.)
        resolve(data);
      }
    });
  }
};

}).call(this,{"isBuffer":require("../../../is-buffer/index.js")})
},{"../../../is-buffer/index.js":37,"../util/promise":88}],78:[function(require,module,exports){
(function (Buffer){
'use strict';

var TEXT_REGEXP = /\.(txt|htm|html|md|xml|js|min|map|css|scss|less|svg)$/i;

module.exports = {
  /**
   * The order that this parser will run, in relation to other parsers.
   *
   * @type {number}
   */
  order: 300,

  /**
   * Whether to allow "empty" files (zero bytes).
   *
   * @type {boolean}
   */
  allowEmpty: true,

  /**
   * The encoding that the text is expected to be in.
   *
   * @type {string}
   */
  encoding: 'utf8',

  /**
   * Determines whether this parser can parse a given file reference.
   * Parsers that return true will be tried, in order, until one successfully parses the file.
   * Parsers that return false will be skipped, UNLESS all parsers returned false, in which case
   * every parser will be tried.
   *
   * @param {object} file           - An object containing information about the referenced file
   * @param {string} file.url       - The full URL of the referenced file
   * @param {string} file.extension - The lowercased file extension (e.g. ".txt", ".html", etc.)
   * @param {*}      file.data      - The file contents. This will be whatever data type was returned by the resolver
   * @returns {boolean}
   */
  canParse: function isText(file) {
    // Use this parser if the file is a string or Buffer, and has a known text-based extension
    return (typeof file.data === 'string' || Buffer.isBuffer(file.data)) && TEXT_REGEXP.test(file.url);
  },

  /**
   * Parses the given file as text
   *
   * @param {object} file           - An object containing information about the referenced file
   * @param {string} file.url       - The full URL of the referenced file
   * @param {string} file.extension - The lowercased file extension (e.g. ".txt", ".html", etc.)
   * @param {*}      file.data      - The file contents. This will be whatever data type was returned by the resolver
   * @returns {Promise<string>}
   */
  parse: function parseText(file) {
    if (typeof file.data === 'string') {
      return file.data;
    }
    else if (Buffer.isBuffer(file.data)) {
      return file.data.toString(this.encoding);
    }
    else {
      throw new Error('data is not text');
    }
  }
};

}).call(this,{"isBuffer":require("../../../is-buffer/index.js")})
},{"../../../is-buffer/index.js":37}],79:[function(require,module,exports){
(function (Buffer){
'use strict';

var Promise = require('../util/promise'),
    YAML    = require('../util/yaml');

module.exports = {
  /**
   * The order that this parser will run, in relation to other parsers.
   *
   * @type {number}
   */
  order: 200,

  /**
   * Whether to allow "empty" files. This includes zero-byte files, as well as empty JSON objects.
   *
   * @type {boolean}
   */
  allowEmpty: true,

  /**
   * Determines whether this parser can parse a given file reference.
   * Parsers that match will be tried, in order, until one successfully parses the file.
   * Parsers that don't match will be skipped, UNLESS none of the parsers match, in which case
   * every parser will be tried.
   *
   * @type {RegExp|string[]|function}
   */
  canParse: ['.yaml', '.yml', '.json'],  // JSON is valid YAML

  /**
   * Parses the given file as YAML
   *
   * @param {object} file           - An object containing information about the referenced file
   * @param {string} file.url       - The full URL of the referenced file
   * @param {string} file.extension - The lowercased file extension (e.g. ".txt", ".html", etc.)
   * @param {*}      file.data      - The file contents. This will be whatever data type was returned by the resolver
   * @returns {Promise}
   */
  parse: function parseYAML(file) {
    return new Promise(function(resolve, reject) {
      var data = file.data;
      if (Buffer.isBuffer(data)) {
        data = data.toString();
      }

      if (typeof data === 'string') {
        resolve(YAML.parse(data));
      }
      else {
        // data is already a JavaScript value (object, array, number, null, NaN, etc.)
        resolve(data);
      }
    });
  }
};

}).call(this,{"isBuffer":require("../../../is-buffer/index.js")})
},{"../../../is-buffer/index.js":37,"../util/promise":88,"../util/yaml":90}],80:[function(require,module,exports){
'use strict';

module.exports = Pointer;

var $Ref         = require('./ref'),
    url          = require('./util/url'),
    ono          = require('ono'),
    slashes      = /\//g,
    tildes       = /~/g,
    escapedSlash = /~1/g,
    escapedTilde = /~0/g;

/**
 * This class represents a single JSON pointer and its resolved value.
 *
 * @param {$Ref} $ref
 * @param {string} path
 * @constructor
 */
function Pointer($ref, path) {
  /**
   * The {@link $Ref} object that contains this {@link Pointer} object.
   * @type {$Ref}
   */
  this.$ref = $ref;

  /**
   * The file path or URL, containing the JSON pointer in the hash.
   * This path is relative to the path of the main JSON schema file.
   * @type {string}
   */
  this.path = path;

  /**
   * The value of the JSON pointer.
   * Can be any JSON type, not just objects. Unknown file types are represented as Buffers (byte arrays).
   * @type {?*}
   */
  this.value = undefined;

  /**
   * Indicates whether the pointer references itself.
   * @type {boolean}
   */
  this.circular = false;
}

/**
 * Resolves the value of a nested property within the given object.
 *
 * @param {*} obj - The object that will be crawled
 * @param {$RefParserOptions} options
 *
 * @returns {Pointer}
 * Returns a JSON pointer whose {@link Pointer#value} is the resolved value.
 * If resolving this value required resolving other JSON references, then
 * the {@link Pointer#$ref} and {@link Pointer#path} will reflect the resolution path
 * of the resolved value.
 */
Pointer.prototype.resolve = function(obj, options) {
  var tokens = Pointer.parse(this.path);

  // Crawl the object, one token at a time
  this.value = obj;
  for (var i = 0; i < tokens.length; i++) {
    if (resolveIf$Ref(this, options)) {
      // The $ref path has changed, so append the remaining tokens to the path
      this.path = Pointer.join(this.path, tokens.slice(i));
    }

    var token = tokens[i];
    if (this.value[token] === undefined) {
      throw ono.syntax('Error resolving $ref pointer "%s". \nToken "%s" does not exist.', this.path, token);
    }
    else {
      this.value = this.value[token];
    }
  }

  // Resolve the final value
  resolveIf$Ref(this, options);
  return this;
};

/**
 * Sets the value of a nested property within the given object.
 *
 * @param {*} obj - The object that will be crawled
 * @param {*} value - the value to assign
 * @param {$RefParserOptions} options
 *
 * @returns {*}
 * Returns the modified object, or an entirely new object if the entire object is overwritten.
 */
Pointer.prototype.set = function(obj, value, options) {
  var tokens = Pointer.parse(this.path);
  var token;

  if (tokens.length === 0) {
    // There are no tokens, replace the entire object with the new value
    this.value = value;
    return value;
  }

  // Crawl the object, one token at a time
  this.value = obj;
  for (var i = 0; i < tokens.length - 1; i++) {
    resolveIf$Ref(this, options);

    token = tokens[i];
    if (this.value && this.value[token] !== undefined) {
      // The token exists
      this.value = this.value[token];
    }
    else {
      // The token doesn't exist, so create it
      this.value = setValue(this, token, {});
    }
  }

  // Set the value of the final token
  resolveIf$Ref(this, options);
  token = tokens[tokens.length - 1];
  setValue(this, token, value);

  // Return the updated object
  return obj;
};

/**
 * Parses a JSON pointer (or a path containing a JSON pointer in the hash)
 * and returns an array of the pointer's tokens.
 * (e.g. "schema.json#/definitions/person/name" => ["definitions", "person", "name"])
 *
 * The pointer is parsed according to RFC 6901
 * {@link https://tools.ietf.org/html/rfc6901#section-3}
 *
 * @param {string} path
 * @returns {string[]}
 */
Pointer.parse = function(path) {
  // Get the JSON pointer from the path's hash
  var pointer = url.getHash(path).substr(1);

  // If there's no pointer, then there are no tokens,
  // so return an empty array
  if (!pointer) {
    return [];
  }

  // Split into an array
  pointer = pointer.split('/');

  // Decode each part, according to RFC 6901
  for (var i = 0; i < pointer.length; i++) {
    pointer[i] = decodeURI(pointer[i].replace(escapedSlash, '/').replace(escapedTilde, '~'));
  }

  if (pointer[0] !== '') {
    throw ono.syntax('Invalid $ref pointer "%s". Pointers must begin with "#/"', pointer);
  }

  return pointer.slice(1);
};

/**
 * Creates a JSON pointer path, by joining one or more tokens to a base path.
 *
 * @param {string} base - The base path (e.g. "schema.json#/definitions/person")
 * @param {string|string[]} tokens - The token(s) to append (e.g. ["name", "first"])
 * @returns {string}
 */
Pointer.join = function(base, tokens) {
  // Ensure that the base path contains a hash
  if (base.indexOf('#') === -1) {
    base += '#';
  }

  // Append each token to the base path
  tokens = Array.isArray(tokens) ? tokens : [tokens];
  for (var i = 0; i < tokens.length; i++) {
    var token = tokens[i];
    // Encode the token, according to RFC 6901
    base += '/' + encodeURI(token.replace(tildes, '~0').replace(slashes, '~1'));
  }

  return base;
};

/**
 * If the given pointer's {@link Pointer#value} is a JSON reference,
 * then the reference is resolved and {@link Pointer#value} is replaced with the resolved value.
 * In addition, {@link Pointer#path} and {@link Pointer#$ref} are updated to reflect the
 * resolution path of the new value.
 *
 * @param {Pointer} pointer
 * @param {$RefParserOptions} options
 * @returns {boolean} - Returns `true` if the resolution path changed
 */
function resolveIf$Ref(pointer, options) {
  // Is the value a JSON reference? (and allowed?)

  if ($Ref.isAllowed$Ref(pointer.value, options)) {
    var $refPath = url.resolve(pointer.path, pointer.value.$ref);

    if ($refPath === pointer.path) {
      // The value is a reference to itself, so there's nothing to do.
      pointer.circular = true;
    }
    else {
      var resolved = pointer.$ref.$refs._resolve($refPath, options);

      if ($Ref.isExtended$Ref(pointer.value)) {
        // This JSON reference "extends" the resolved value, rather than simply pointing to it.
        // So the resolved path does NOT change.  Just the value does.
        pointer.value = $Ref.dereference(pointer.value, resolved.value);
      }
      else {
        // Resolve the reference
        pointer.$ref = resolved.$ref;
        pointer.path = resolved.path;
        pointer.value = resolved.value;
      }

      return true;
    }
  }
}

/**
 * Sets the specified token value of the {@link Pointer#value}.
 *
 * The token is evaluated according to RFC 6901.
 * {@link https://tools.ietf.org/html/rfc6901#section-4}
 *
 * @param {Pointer} pointer - The JSON Pointer whose value will be modified
 * @param {string} token - A JSON Pointer token that indicates how to modify `obj`
 * @param {*} value - The value to assign
 * @returns {*} - Returns the assigned value
 */
function setValue(pointer, token, value) {
  if (pointer.value && typeof pointer.value === 'object') {
    if (token === '-' && Array.isArray(pointer.value)) {
      pointer.value.push(value);
    }
    else {
      pointer.value[token] = value;
    }
  }
  else {
    throw ono.syntax('Error assigning $ref pointer "%s". \nCannot set "%s" of a non-object.', pointer.path, token);
  }
  return value;
}

},{"./ref":81,"./util/url":89,"ono":94}],81:[function(require,module,exports){
'use strict';

module.exports = $Ref;

var Pointer = require('./pointer');

/**
 * This class represents a single JSON reference and its resolved value.
 *
 * @constructor
 */
function $Ref() {
  /**
   * The file path or URL of the referenced file.
   * This path is relative to the path of the main JSON schema file.
   *
   * This path does NOT contain document fragments (JSON pointers). It always references an ENTIRE file.
   * Use methods such as {@link $Ref#get}, {@link $Ref#resolve}, and {@link $Ref#exists} to get
   * specific JSON pointers within the file.
   *
   * @type {string}
   */
  this.path = undefined;

  /**
   * The resolved value of the JSON reference.
   * Can be any JSON type, not just objects. Unknown file types are represented as Buffers (byte arrays).
   * @type {?*}
   */
  this.value = undefined;

  /**
   * The {@link $Refs} object that contains this {@link $Ref} object.
   * @type {$Refs}
   */
  this.$refs = undefined;

  /**
   * Indicates the type of {@link $Ref#path} (e.g. "file", "http", etc.)
   * @type {?string}
   */
  this.pathType = undefined;
}

/**
 * Determines whether the given JSON reference exists within this {@link $Ref#value}.
 *
 * @param {string} path - The full path being resolved, optionally with a JSON pointer in the hash
 * @param {$RefParserOptions} options
 * @returns {boolean}
 */
$Ref.prototype.exists = function(path, options) {
  try {
    this.resolve(path, options);
    return true;
  }
  catch (e) {
    return false;
  }
};

/**
 * Resolves the given JSON reference within this {@link $Ref#value} and returns the resolved value.
 *
 * @param {string} path - The full path being resolved, optionally with a JSON pointer in the hash
 * @param {$RefParserOptions} options
 * @returns {*} - Returns the resolved value
 */
$Ref.prototype.get = function(path, options) {
  return this.resolve(path, options).value;
};

/**
 * Resolves the given JSON reference within this {@link $Ref#value}.
 *
 * @param {string} path - The full path being resolved, optionally with a JSON pointer in the hash
 * @param {$RefParserOptions} options
 * @returns {Pointer}
 */
$Ref.prototype.resolve = function(path, options) {
  var pointer = new Pointer(this, path);
  return pointer.resolve(this.value, options);
};

/**
 * Sets the value of a nested property within this {@link $Ref#value}.
 * If the property, or any of its parents don't exist, they will be created.
 *
 * @param {string} path - The full path of the property to set, optionally with a JSON pointer in the hash
 * @param {*} value - The value to assign
 */
$Ref.prototype.set = function(path, value) {
  var pointer = new Pointer(this, path);
  this.value = pointer.set(this.value, value);
};

/**
 * Determines whether the given value is a JSON reference.
 *
 * @param {*} value - The value to inspect
 * @returns {boolean}
 */
$Ref.is$Ref = function(value) {
  return value && typeof value === 'object' && typeof value.$ref === 'string' && value.$ref.length > 0;
};

/**
 * Determines whether the given value is an external JSON reference.
 *
 * @param {*} value - The value to inspect
 * @returns {boolean}
 */
$Ref.isExternal$Ref = function(value) {
  return $Ref.is$Ref(value) && value.$ref[0] !== '#';
};

/**
 * Determines whether the given value is a JSON reference, and whether it is allowed by the options.
 * For example, if it references an external file, then options.resolve.external must be true.
 *
 * @param {*} value - The value to inspect
 * @param {$RefParserOptions} options
 * @returns {boolean}
 */
$Ref.isAllowed$Ref = function(value, options) {
  if ($Ref.is$Ref(value)) {
    if (value.$ref.substr(0, 2) === '#/' || value.$ref === '#') {
      // It's a JSON Pointer reference, which is always allowed
      return true;
    }
    else if (value.$ref[0] !== '#' && (!options || options.resolve.external)) {
      // It's an external reference, which is allowed by the options
      return true;
    }
  }
};

/**
 * Determines whether the given value is a JSON reference that "extends" its resolved value.
 * That is, it has extra properties (in addition to "$ref"), so rather than simply pointing to
 * an existing value, this $ref actually creates a NEW value that is a shallow copy of the resolved
 * value, plus the extra properties.
 *
 * @example:
 *  {
 *    person: {
 *      properties: {
 *        firstName: { type: string }
 *        lastName: { type: string }
 *      }
 *    }
 *    employee: {
 *      properties: {
 *        $ref: #/person/properties
 *        salary: { type: number }
 *      }
 *    }
 *  }
 *
 *  In this example, "employee" is an extended $ref, since it extends "person" with an additional
 *  property (salary).  The result is a NEW value that looks like this:
 *
 *  {
 *    properties: {
 *      firstName: { type: string }
 *      lastName: { type: string }
 *      salary: { type: number }
 *    }
 *  }
 *
 * @param {*} value - The value to inspect
 * @returns {boolean}
 */
$Ref.isExtended$Ref = function(value) {
  return $Ref.is$Ref(value) && Object.keys(value).length > 1;
};

/**
 * Returns the resolved value of a JSON Reference.
 * If necessary, the resolved value is merged with the JSON Reference to create a new object
 *
 * @example:
 *  {
 *    person: {
 *      properties: {
 *        firstName: { type: string }
 *        lastName: { type: string }
 *      }
 *    }
 *    employee: {
 *      properties: {
 *        $ref: #/person/properties
 *        salary: { type: number }
 *      }
 *    }
 *  }
 *
 *  When "person" and "employee" are merged, you end up with the following object:
 *
 *  {
 *    properties: {
 *      firstName: { type: string }
 *      lastName: { type: string }
 *      salary: { type: number }
 *    }
 *  }
 *
 * @param {object} $ref - The JSON reference object (the one with the "$ref" property)
 * @param {*} resolvedValue - The resolved value, which can be any type
 * @returns {*} - Returns the dereferenced value
 */
$Ref.dereference = function($ref, resolvedValue) {
  if (resolvedValue && typeof resolvedValue === 'object' && $Ref.isExtended$Ref($ref)) {
    var merged = {};
    Object.keys($ref).forEach(function(key) {
      if (key !== '$ref') {
        merged[key] = $ref[key];
      }
    });
    Object.keys(resolvedValue).forEach(function(key) {
      if (!(key in merged)) {
        merged[key] = resolvedValue[key];
      }
    });
    return merged;
  }
  else {
    // Completely replace the original reference with the resolved value
    return resolvedValue;
  }
};

},{"./pointer":80}],82:[function(require,module,exports){
'use strict';

var ono  = require('ono'),
    $Ref = require('./ref'),
    url  = require('./util/url');

module.exports = $Refs;

/**
 * This class is a map of JSON references and their resolved values.
 */
function $Refs() {
  /**
   * Indicates whether the schema contains any circular references.
   *
   * @type {boolean}
   */
  this.circular = false;

  /**
   * A map of paths/urls to {@link $Ref} objects
   *
   * @type {object}
   * @protected
   */
  this._$refs = {};

  /**
   * The {@link $Ref} object that is the root of the JSON schema.
   *
   * @type {$Ref}
   * @protected
   */
  this._root$Ref = null;
}

/**
 * Returns the paths of all the files/URLs that are referenced by the JSON schema,
 * including the schema itself.
 *
 * @param {...string|string[]} [types] - Only return paths of the given types ("file", "http", etc.)
 * @returns {string[]}
 */
$Refs.prototype.paths = function(types) {
  var paths = getPaths(this._$refs, arguments);
  return paths.map(function(path) {
    return path.decoded;
  });
};

/**
 * Returns the map of JSON references and their resolved values.
 *
 * @param {...string|string[]} [types] - Only return references of the given types ("file", "http", etc.)
 * @returns {object}
 */
$Refs.prototype.values = function(types) {
  var $refs = this._$refs;
  var paths = getPaths($refs, arguments);
  return paths.reduce(function(obj, path) {
    obj[path.decoded] = $refs[path.encoded].value;
    return obj;
  }, {});
};

/**
 * Returns a POJO (plain old JavaScript object) for serialization as JSON.
 *
 * @returns {object}
 */
$Refs.prototype.toJSON = $Refs.prototype.values;

/**
 * Determines whether the given JSON reference exists.
 *
 * @param {string} path - The path being resolved, optionally with a JSON pointer in the hash
 * @param {$RefParserOptions} [options]
 * @returns {boolean}
 */
$Refs.prototype.exists = function(path, options) {
  try {
    this._resolve(path, options);
    return true;
  }
  catch (e) {
    return false;
  }
};

/**
 * Resolves the given JSON reference and returns the resolved value.
 *
 * @param {string} path - The path being resolved, with a JSON pointer in the hash
 * @param {$RefParserOptions} [options]
 * @returns {*} - Returns the resolved value
 */
$Refs.prototype.get = function(path, options) {
  return this._resolve(path, options).value;
};

/**
 * Sets the value of a nested property within this {@link $Ref#value}.
 * If the property, or any of its parents don't exist, they will be created.
 *
 * @param {string} path - The path of the property to set, optionally with a JSON pointer in the hash
 * @param {*} value - The value to assign
 */
$Refs.prototype.set = function(path, value) {
  path = url.resolve(this._root$Ref.path, path);
  var withoutHash = url.stripHash(path);
  var $ref = this._$refs[withoutHash];

  if (!$ref) {
    throw ono('Error resolving $ref pointer "%s". \n"%s" not found.', path, withoutHash);
  }

  $ref.set(path, value);
};

/**
 * Creates a new {@link $Ref} object and adds it to this {@link $Refs} object.
 *
 * @param {string} path  - The file path or URL of the referenced file
 * @param {*} [value] - Optional. The value of the $ref.
 */
$Refs.prototype._add = function(path, value) {
  var withoutHash = url.stripHash(path);

  var $ref = new $Ref();
  $ref.path = withoutHash;
  $ref.value = value;
  $ref.$refs = this;

  this._$refs[withoutHash] = $ref;
  this._root$Ref = this._root$Ref || $ref;

  return $ref;
};

/**
 * Resolves the given JSON reference.
 *
 * @param {string} path - The path being resolved, optionally with a JSON pointer in the hash
 * @param {$RefParserOptions} [options]
 * @returns {Pointer}
 * @protected
 */
$Refs.prototype._resolve = function(path, options) {
  path = url.resolve(this._root$Ref.path, path);
  var withoutHash = url.stripHash(path);
  var $ref = this._$refs[withoutHash];

  if (!$ref) {
    throw ono('Error resolving $ref pointer "%s". \n"%s" not found.', path, withoutHash);
  }

  return $ref.resolve(path, options);
};

/**
 * Returns the specified {@link $Ref} object, or undefined.
 *
 * @param {string} path - The path being resolved, optionally with a JSON pointer in the hash
 * @returns {$Ref|undefined}
 * @protected
 */
$Refs.prototype._get$Ref = function(path) {
  path = url.resolve(this._root$Ref.path, path);
  var withoutHash = url.stripHash(path);
  return this._$refs[withoutHash];
};

/**
 * Returns the encoded and decoded paths keys of the given object.
 *
 * @param {object} $refs - The object whose keys are URL-encoded paths
 * @param {...string|string[]} [types] - Only return paths of the given types ("file", "http", etc.)
 * @returns {object[]}
 */
function getPaths($refs, types) {
  var paths = Object.keys($refs);

  // Filter the paths by type
  types = Array.isArray(types[0]) ? types[0] : Array.prototype.slice.call(types);
  if (types.length > 0 && types[0]) {
    paths = paths.filter(function(key) {
      return types.indexOf($refs[key].pathType) !== -1;
    });
  }

  // Decode local filesystem paths
  return paths.map(function(path) {
    return {
      encoded: path,
      decoded: $refs[path].pathType === 'file' ? url.toFileSystemPath(path, true) : path
    };
  });
}

},{"./ref":81,"./util/url":89,"ono":94}],83:[function(require,module,exports){
'use strict';

var Promise = require('./util/promise'),
    $Ref    = require('./ref'),
    Pointer = require('./pointer'),
    parse   = require('./parse'),
    debug   = require('./util/debug'),
    url     = require('./util/url');

module.exports = resolveExternal;

/**
 * Crawls the JSON schema, finds all external JSON references, and resolves their values.
 * This method does not mutate the JSON schema. The resolved values are added to {@link $RefParser#$refs}.
 *
 * NOTE: We only care about EXTERNAL references here. INTERNAL references are only relevant when dereferencing.
 *
 * @param {$RefParser} parser
 * @param {$RefParserOptions} options
 *
 * @returns {Promise}
 * The promise resolves once all JSON references in the schema have been resolved,
 * including nested references that are contained in externally-referenced files.
 */
function resolveExternal(parser, options) {
  if (!options.resolve.external) {
    // Nothing to resolve, so exit early
    return Promise.resolve();
  }

  try {
    debug('Resolving $ref pointers in %s', parser.$refs._root$Ref.path);
    var promises = crawl(parser.schema, parser.$refs._root$Ref.path + '#', parser.$refs, options);
    return Promise.all(promises);
  }
  catch (e) {
    return Promise.reject(e);
  }
}

/**
 * Recursively crawls the given value, and resolves any external JSON references.
 *
 * @param {*} obj - The value to crawl. If it's not an object or array, it will be ignored.
 * @param {string} path - The full path of `obj`, possibly with a JSON Pointer in the hash
 * @param {$Refs} $refs
 * @param {$RefParserOptions} options
 *
 * @returns {Promise[]}
 * Returns an array of promises. There will be one promise for each JSON reference in `obj`.
 * If `obj` does not contain any JSON references, then the array will be empty.
 * If any of the JSON references point to files that contain additional JSON references,
 * then the corresponding promise will internally reference an array of promises.
 */
function crawl(obj, path, $refs, options) {
  var promises = [];

  if (obj && typeof obj === 'object') {
    if ($Ref.isExternal$Ref(obj)) {
      promises.push(resolve$Ref(obj, path, $refs, options));
    }
    else {
      Object.keys(obj).forEach(function(key) {
        var keyPath = Pointer.join(path, key);
        var value = obj[key];

        if ($Ref.isExternal$Ref(value)) {
          promises.push(resolve$Ref(value, keyPath, $refs, options));
        }
        else {
          promises = promises.concat(crawl(value, keyPath, $refs, options));
        }
      });
    }
  }

  return promises;
}

/**
 * Resolves the given JSON Reference, and then crawls the resulting value.
 *
 * @param {{$ref: string}} $ref - The JSON Reference to resolve
 * @param {string} path - The full path of `$ref`, possibly with a JSON Pointer in the hash
 * @param {$Refs} $refs
 * @param {$RefParserOptions} options
 *
 * @returns {Promise}
 * The promise resolves once all JSON references in the object have been resolved,
 * including nested references that are contained in externally-referenced files.
 */
function resolve$Ref($ref, path, $refs, options) {
  debug('Resolving $ref pointer "%s" at %s', $ref.$ref, path);

  var resolvedPath = url.resolve(path, $ref.$ref);
  var withoutHash = url.stripHash(resolvedPath);

  // Do we already have this $ref?
  $ref = $refs._$refs[withoutHash];
  if ($ref) {
    // We've already parsed this $ref, so use the existing value
    return Promise.resolve($ref.value);
  }

  // Parse the $referenced file/url
  return parse(resolvedPath, $refs, options)
    .then(function(result) {
      // Crawl the parsed value
      debug('Resolving $ref pointers in %s', withoutHash);
      var promises = crawl(result, withoutHash + '#', $refs, options);
      return Promise.all(promises);
    });
}

},{"./parse":75,"./pointer":80,"./ref":81,"./util/debug":86,"./util/promise":88,"./util/url":89}],84:[function(require,module,exports){
'use strict';
var fs      = require('fs'),
    ono     = require('ono'),
    Promise = require('../util/promise'),
    url     = require('../util/url'),
    debug   = require('../util/debug');

module.exports = {
  /**
   * The order that this resolver will run, in relation to other resolvers.
   *
   * @type {number}
   */
  order: 100,

  /**
   * Determines whether this resolver can read a given file reference.
   * Resolvers that return true will be tried, in order, until one successfully resolves the file.
   * Resolvers that return false will not be given a chance to resolve the file.
   *
   * @param {object} file           - An object containing information about the referenced file
   * @param {string} file.url       - The full URL of the referenced file
   * @param {string} file.extension - The lowercased file extension (e.g. ".txt", ".html", etc.)
   * @returns {boolean}
   */
  canRead: function isFile(file) {
    return url.isFileSystemPath(file.url);
  },

  /**
   * Reads the given file and returns its raw contents as a Buffer.
   *
   * @param {object} file           - An object containing information about the referenced file
   * @param {string} file.url       - The full URL of the referenced file
   * @param {string} file.extension - The lowercased file extension (e.g. ".txt", ".html", etc.)
   * @returns {Promise<Buffer>}
   */
  read: function readFile(file) {
    return new Promise(function(resolve, reject) {
      var path;
      try {
        path = url.toFileSystemPath(file.url);
      }
      catch (err) {
        reject(ono.uri(err, 'Malformed URI: %s', file.url));
      }

      debug('Opening file: %s', path);

      try {
        fs.readFile(path, function(err, data) {
          if (err) {
            reject(ono(err, 'Error opening file "%s"', path));
          }
          else {
            resolve(data);
          }
        });
      }
      catch (err) {
        reject(ono(err, 'Error opening file "%s"', path));
      }
    });
  }
};

},{"../util/debug":86,"../util/promise":88,"../util/url":89,"fs":23,"ono":94}],85:[function(require,module,exports){
(function (process,Buffer){
'use strict';

var http    = require('http'),
    https   = require('https'),
    ono     = require('ono'),
    url     = require('../util/url'),
    debug   = require('../util/debug'),
    Promise = require('../util/promise');

module.exports = {
  /**
   * The order that this resolver will run, in relation to other resolvers.
   *
   * @type {number}
   */
  order: 200,

  /**
   * HTTP headers to send when downloading files.
   *
   * @example:
   * {
   *   "User-Agent": "JSON Schema $Ref Parser",
   *   Accept: "application/json"
   * }
   *
   * @type {object}
   */
  headers: null,

  /**
   * HTTP request timeout (in milliseconds).
   *
   * @type {number}
   */
  timeout: 5000, // 5 seconds

  /**
   * The maximum number of HTTP redirects to follow.
   * To disable automatic following of redirects, set this to zero.
   *
   * @type {number}
   */
  redirects: 5,

  /**
   * The `withCredentials` option of XMLHttpRequest.
   * Set this to `true` if you're downloading files from a CORS-enabled server that requires authentication
   *
   * @type {boolean}
   */
  withCredentials: false,

  /**
   * Determines whether this resolver can read a given file reference.
   * Resolvers that return true will be tried in order, until one successfully resolves the file.
   * Resolvers that return false will not be given a chance to resolve the file.
   *
   * @param {object} file           - An object containing information about the referenced file
   * @param {string} file.url       - The full URL of the referenced file
   * @param {string} file.extension - The lowercased file extension (e.g. ".txt", ".html", etc.)
   * @returns {boolean}
   */
  canRead: function isHttp(file) {
    return url.isHttp(file.url);
  },

  /**
   * Reads the given URL and returns its raw contents as a Buffer.
   *
   * @param {object} file           - An object containing information about the referenced file
   * @param {string} file.url       - The full URL of the referenced file
   * @param {string} file.extension - The lowercased file extension (e.g. ".txt", ".html", etc.)
   * @returns {Promise<Buffer>}
   */
  read: function readHttp(file) {
    var u = url.parse(file.url);

    if (process.browser && !u.protocol) {
      // Use the protocol of the current page
      u.protocol = url.parse(location.href).protocol;
    }

    return download(u, this);
  }
};

/**
 * Downloads the given file.
 *
 * @param {Url|string} u        - The url to download (can be a parsed {@link Url} object)
 * @param {object} httpOptions  - The `options.resolve.http` object
 * @param {number} [redirects]  - The redirect URLs that have already been followed
 *
 * @returns {Promise<Buffer>}
 * The promise resolves with the raw downloaded data, or rejects if there is an HTTP error.
 */
function download(u, httpOptions, redirects) {
  return new Promise(function(resolve, reject) {
    u = url.parse(u);
    redirects = redirects || [];
    redirects.push(u.href);

    get(u, httpOptions)
      .then(function(res) {
        if (res.statusCode >= 400) {
          throw ono({status: res.statusCode}, 'HTTP ERROR %d', res.statusCode);
        }
        else if (res.statusCode >= 300) {
          if (redirects.length > httpOptions.redirects) {
            reject(ono({status: res.statusCode}, 'Error downloading %s. \nToo many redirects: \n  %s',
              redirects[0], redirects.join(' \n  ')));
          }
          else if (!res.headers.location) {
            throw ono({status: res.statusCode}, 'HTTP %d redirect with no location header', res.statusCode);
          }
          else {
            debug('HTTP %d redirect %s -> %s', res.statusCode, u.href, res.headers.location);
            var redirectTo = url.resolve(u, res.headers.location);
            download(redirectTo, httpOptions, redirects).then(resolve, reject);
          }
        }
        else {
          resolve(res.body || new Buffer(0));
        }
      })
      .catch(function(err) {
        reject(ono(err, 'Error downloading', u.href));
      });
  });
}

/**
 * Sends an HTTP GET request.
 *
 * @param {Url} u - A parsed {@link Url} object
 * @param {object} httpOptions - The `options.resolve.http` object
 *
 * @returns {Promise<Response>}
 * The promise resolves with the HTTP Response object.
 */
function get(u, httpOptions) {
  return new Promise(function(resolve, reject) {
    debug('GET', u.href);

    var protocol = u.protocol === 'https:' ? https : http;
    var req = protocol.get({
      hostname: u.hostname,
      port: u.port,
      path: u.path,
      auth: u.auth,
      headers: httpOptions.headers || {},
      withCredentials: httpOptions.withCredentials
    });

    if (typeof req.setTimeout === 'function') {
      req.setTimeout(httpOptions.timeout);
    }

    req.on('timeout', function() {
      req.abort();
    });

    req.on('error', reject);

    req.once('response', function(res) {
      res.body = new Buffer(0);

      res.on('data', function(data) {
        res.body = Buffer.concat([res.body, new Buffer(data)]);
      });

      res.on('error', reject);

      res.on('end', function() {
        resolve(res);
      });
    });
  });
}

}).call(this,require('_process'),require("buffer").Buffer)
},{"../util/debug":86,"../util/promise":88,"../util/url":89,"_process":98,"buffer":25,"http":114,"https":34,"ono":94}],86:[function(require,module,exports){
'use strict';

var debug = require('debug');

/**
 * Writes messages to stdout.
 * Log messages are suppressed by default, but can be enabled by setting the DEBUG variable.
 * @type {function}
 */
module.exports = debug('json-schema-ref-parser');

},{"debug":29}],87:[function(require,module,exports){
'use strict';

var Promise = require('./promise'),
    debug   = require('./debug');

/**
 * Returns the given plugins as an array, rather than an object map.
 * All other methods in this module expect an array of plugins rather than an object map.
 *
 * @param  {object} plugins - A map of plugin objects
 * @return {object[]}
 */
exports.all = function(plugins) {
  return Object.keys(plugins)
    .filter(function(key) {
      return typeof plugins[key] === 'object';
    })
    .map(function(key) {
      plugins[key].name = key;
      return plugins[key];
    });
};

/**
 * Filters the given plugins, returning only the ones return `true` for the given method.
 *
 * @param  {object[]} plugins - An array of plugin objects
 * @param  {string}   method  - The name of the filter method to invoke for each plugin
 * @param  {object}   file    - A file info object, which will be passed to each method
 * @return {object[]}
 */
exports.filter = function(plugins, method, file) {
  return plugins
    .filter(function(plugin) {
      return !!getResult(plugin, method, file);
    });
};

/**
 * Sorts the given plugins, in place, by their `order` property.
 *
 * @param {object[]} plugins - An array of plugin objects
 * @returns {object[]}
 */
exports.sort = function(plugins) {
  plugins.forEach(function(plugin) {
    plugin.order = plugin.order || Number.MAX_SAFE_INTEGER;
  });

  return plugins.sort(function(a, b) { return a.order - b.order; });
};

/**
 * Runs the specified method of the given plugins, in order, until one of them returns a successful result.
 * Each method can return a synchronous value, a Promise, or call an error-first callback.
 * If the promise resolves successfully, or the callback is called without an error, then the result
 * is immediately returned and no further plugins are called.
 * If the promise rejects, or the callback is called with an error, then the next plugin is called.
 * If ALL plugins fail, then the last error is thrown.
 *
 * @param {object[]}  plugins - An array of plugin objects
 * @param {string}    method  - The name of the method to invoke for each plugin
 * @param {object}    file    - A file info object, which will be passed to each method
 * @returns {Promise}
 */
exports.run = function(plugins, method, file) {
  var plugin, lastError, index = 0;

  return new Promise(function(resolve, reject) {
    runNextPlugin();

    function runNextPlugin() {
      plugin = plugins[index++];
      if (!plugin) {
        // There are no more functions, so re-throw the last error
        return reject(lastError);
      }

      try {
        debug('  %s', plugin.name);
        var result = getResult(plugin, method, file, callback);
        if (result && typeof result.then === 'function') {
          // A promise was returned
          result.then(onSuccess, onError);
        }
        else if (result !== undefined) {
          // A synchronous result was returned
          onSuccess(result);
        }
        // else { the callback will be called }
      }
      catch (e) {
        onError(e);
      }
    }

    function callback(err, result) {
      if (err) {
        onError(err);
      }
      else {
        onSuccess(result);
      }
    }

    function onSuccess(result) {
      debug('    success');
      resolve({
        plugin: plugin,
        result: result
      });
    }

    function onError(err) {
      debug('    %s', err.message || err);
      lastError = err;
      runNextPlugin();
    }
  });
};

/**
 * Returns the value of the given property.
 * If the property is a function, then the result of the function is returned.
 * If the value is a RegExp, then it will be tested against the file URL.
 * If the value is an aray, then it will be compared against the file extension.
 *
 * @param   {object}   obj        - The object whose property/method is called
 * @param   {string}   prop       - The name of the property/method to invoke
 * @param   {object}   file       - A file info object, which will be passed to the method
 * @param   {function} [callback] - A callback function, which will be passed to the method
 * @returns {*}
 */
function getResult(obj, prop, file, callback) {
  var value = obj[prop];

  if (typeof value === 'function') {
    return value.apply(obj, [file, callback]);
  }

  if (!callback) {
    // The synchronous plugin functions (canParse and canRead)
    // allow a "shorthand" syntax, where the user can match
    // files by RegExp or by file extension.
    if (value instanceof RegExp) {
      return value.test(file.url);
    }
    else if (typeof value === 'string') {
      return value === file.extension;
    }
    else if (Array.isArray(value)) {
      return value.indexOf(file.extension) !== -1;
    }
  }

  return value;
}

},{"./debug":86,"./promise":88}],88:[function(require,module,exports){
'use strict';

/** @type {Promise} **/
module.exports = typeof Promise === 'function' ? Promise : require('es6-promise').Promise;

},{"es6-promise":31}],89:[function(require,module,exports){
(function (process){
'use strict';

var isWindows           = /^win/.test(process.platform),
    forwardSlashPattern = /\//g,
    protocolPattern     = /^([a-z0-9.+-]+):\/\//i,
    url                 = module.exports;

// RegExp patterns to URL-encode special characters in local filesystem paths
var urlEncodePatterns = [
  /\?/g, '%3F',
  /\#/g, '%23',
  isWindows ? /\\/g : /\//, '/'
];

// RegExp patterns to URL-decode special characters for local filesystem paths
var urlDecodePatterns = [
  /\%23/g, '#',
  /\%24/g, '$',
  /\%26/g, '&',
  /\%2C/g, ',',
  /\%40/g, '@'
];

exports.parse = require('url').parse;
exports.resolve = require('url').resolve;

/**
 * Returns the current working directory (in Node) or the current page URL (in browsers).
 *
 * @returns {string}
 */
exports.cwd = function cwd() {
  return process.browser ? location.href : process.cwd() + '/';
};

/**
 * Returns the protocol of the given URL, or `undefined` if it has no protocol.
 *
 * @param   {string} path
 * @returns {?string}
 */
exports.getProtocol = function getProtocol(path) {
  var match = protocolPattern.exec(path);
  if (match) {
    return match[1].toLowerCase();
  }
};

/**
 * Returns the lowercased file extension of the given URL,
 * or an empty string if it has no extension.
 *
 * @param   {string} path
 * @returns {string}
 */
exports.getExtension = function getExtension(path) {
  var lastDot = path.lastIndexOf('.');
  if (lastDot >= 0) {
    return path.substr(lastDot).toLowerCase();
  }
  return '';
};

/**
 * Returns the hash (URL fragment), of the given path.
 * If there is no hash, then the root hash ("#") is returned.
 *
 * @param   {string} path
 * @returns {string}
 */
exports.getHash = function getHash(path) {
  var hashIndex = path.indexOf('#');
  if (hashIndex >= 0) {
    return path.substr(hashIndex);
  }
  return '#';
};

/**
 * Removes the hash (URL fragment), if any, from the given path.
 *
 * @param   {string} path
 * @returns {string}
 */
exports.stripHash = function stripHash(path) {
  var hashIndex = path.indexOf('#');
  if (hashIndex >= 0) {
    path = path.substr(0, hashIndex);
  }
  return path;
};

/**
 * Determines whether the given path is an HTTP(S) URL.
 *
 * @param   {string} path
 * @returns {boolean}
 */
exports.isHttp = function isHttp(path) {
  var protocol = url.getProtocol(path);
  if (protocol === 'http' || protocol === 'https') {
    return true;
  }
  else if (protocol === undefined) {
    // There is no protocol.  If we're running in a browser, then assume it's HTTP.
    return process.browser;
  }
  else {
    // It's some other protocol, such as "ftp://", "mongodb://", etc.
    return false;
  }
};

/**
 * Determines whether the given path is a filesystem path.
 * This includes "file://" URLs.
 *
 * @param   {string} path
 * @returns {boolean}
 */
exports.isFileSystemPath = function isFileSystemPath(path) {
  if (process.browser) {
    // We're running in a browser, so assume that all paths are URLs.
    // This way, even relative paths will be treated as URLs rather than as filesystem paths
    return false;
  }

  var protocol = url.getProtocol(path);
  return protocol === undefined || protocol === 'file';
};

/**
 * Converts a filesystem path to a properly-encoded URL.
 *
 * This is intended to handle situations where JSON Schema $Ref Parser is called
 * with a filesystem path that contains characters which are not allowed in URLs.
 *
 * @example
 * The following filesystem paths would be converted to the following URLs:
 *
 *    <"!@#$%^&*+=?'>.json              ==>   %3C%22!@%23$%25%5E&*+=%3F\'%3E.json
 *    C:\\My Documents\\File (1).json   ==>   C:/My%20Documents/File%20(1).json
 *    file://Project #42/file.json      ==>   file://Project%20%2342/file.json
 *
 * @param {string} path
 * @returns {string}
 */
exports.fromFileSystemPath = function fromFileSystemPath(path) {
  // Step 1: Manually encode characters that are not encoded by `encodeURI`.
  // This includes characters such as "#" and "?", which have special meaning in URLs,
  // but are just normal characters in a filesystem path.
  // On Windows, this will also replace backslashes with forward slashes,
  // rather than encoding them as special characters.
  for (var i = 0; i < urlEncodePatterns.length; i += 2) {
    path = path.replace(urlEncodePatterns[i], urlEncodePatterns[i + 1]);
  }

  // Step 2: `encodeURI` will take care of all other characters
  return encodeURI(path);
};

/**
 * Converts a URL to a local filesystem path.
 *
 * @param {string}  path
 * @param {boolean} [keepFileProtocol] - If true, then "file://" will NOT be stripped
 * @returns {string}
 */
exports.toFileSystemPath = function toFileSystemPath(path, keepFileProtocol) {
  // Step 1: `decodeURI` will decode characters such as Cyrillic characters, spaces, etc.
  path = decodeURI(path);

  // Step 2: Manually decode characters that are not decoded by `decodeURI`.
  // This includes characters such as "#" and "?", which have special meaning in URLs,
  // but are just normal characters in a filesystem path.
  for (var i = 0; i < urlDecodePatterns.length; i += 2) {
    path = path.replace(urlDecodePatterns[i], urlDecodePatterns[i + 1]);
  }

  // Step 3: If it's a "file://" URL, then format it consistently
  // or convert it to a local filesystem path
  var isFileUrl = path.substr(0, 7).toLowerCase() === 'file://';
  if (isFileUrl) {
    // Strip-off the protocol, and the initial "/", if there is one
    path = path[7] === '/' ? path.substr(8) : path.substr(7);

    // insert a colon (":") after the drive letter on Windows
    if (isWindows && path[1] === '/') {
      path = path[0] + ':' + path.substr(1);
    }

    if (keepFileProtocol) {
      // Return the consistently-formatted "file://" URL
      path = 'file:///' + path;
    }
    else {
      // Convert the "file://" URL to a local filesystem path.
      // On Windows, it will start with something like "C:/".
      // On Posix, it will start with "/"
      isFileUrl = false;
      path = isWindows ? path : '/' + path;
    }
  }

  // Step 4: On Windows, convert backslashes to forward slashes,
  // unless it's a "file://" URL
  if (isWindows && !isFileUrl) {
    path = path.replace(forwardSlashPattern, '\\');
  }

  return path;
};

}).call(this,require('_process'))
},{"_process":98,"url":121}],90:[function(require,module,exports){
/* eslint lines-around-comment: [2, {beforeBlockComment: false}] */
'use strict';

var yaml = require('js-yaml'),
    ono  = require('ono');

/**
 * Simple YAML parsing functions, similar to {@link JSON.parse} and {@link JSON.stringify}
 */
module.exports = {
  /**
   * Parses a YAML string and returns the value.
   *
   * @param {string} text - The YAML string to be parsed
   * @param {function} [reviver] - Not currently supported. Provided for consistency with {@link JSON.parse}
   * @returns {*}
   */
  parse: function yamlParse(text, reviver) {
    try {
      return yaml.safeLoad(text);
    }
    catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      else {
        // https://github.com/nodeca/js-yaml/issues/153
        throw ono(e, e.message);
      }
    }
  },

  /**
   * Converts a JavaScript value to a YAML string.
   *
   * @param   {*} value - The value to convert to YAML
   * @param   {function|array} replacer - Not currently supported. Provided for consistency with {@link JSON.stringify}
   * @param   {string|number} space - The number of spaces to use for indentation, or a string containing the number of spaces.
   * @returns {string}
   */
  stringify: function yamlStringify(value, replacer, space) {
    try {
      var indent = (typeof space === 'string' ? space.length : space) || 2;
      return yaml.safeDump(value, {indent: indent});
    }
    catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      else {
        // https://github.com/nodeca/js-yaml/issues/153
        throw ono(e, e.message);
      }
    }
  }
};

},{"js-yaml":41,"ono":94}],91:[function(require,module,exports){
'use strict';

module.exports = {
  /**
   * The order that this validator will run, in relation to other validators.
   *
   * @type {number}
   */
  order: 100,

  /**
   * Determines whether this validator can parse a given schema file.
   *
   * There are three opportunities at which a validator may choose to validate a schema:
   *
   *  1 - After the JSON Schema is parsed, but before any of its JSON References are resolved
   *
   *  2 - After all JSON References have been resolved (and the $Refs object has been populated),
   *      but before any references have been dereferenced
   *
   *  3 - After all JSON References have been dereferenced
   *
   * JSON Schema $Ref Parser's {@link $RefParser.validate} method will only perform as much processing
   * as is necessary to satisfy all validators. So, if all validators are able to process the
   * schema after step 1 above, then steps 2 and 3 will not be performed.  If some validators aren't
   * able to process the schema after step 1, then step 2 will be performed and the remaining validators
   * will be given a second chance to process the schema. If they all do, then step 3 will not be performed.
   * If there are still remaining validators, then step 3 will be performed and the remaining validators
   * will be given a third chance.
   *
   * @param {object} file               - An object containing information about the JSON Schema
   * @param {string} file.url           - The full URL of the schema file
   * @param {string} file.extension     - The lowercased scheam file extension (e.g. ".json", ".yaml", etc.)
   * @param {*}      file.data          - The raw file contents. This will be whatever data type was returned by the resolver
   * @param {object} file.parsed        - The parsed JSON Schema (available in steps 1, 2, and 3)
   * @param {$Refs}  file.resolved      - The resolved JSON References (available in steps 2 and 3)
   * @param {object} file.dereferenced  - The dereferenced JSON Schema (only available in step 3)
   * @returns {boolean}
   */
  canValidate: function canValidate(file) {
    // Z-Schema requires JSON References to already be resolved (but not dereferenced)
    return !!file.resolved;
  },

  /**
   * Validates the given JSON Schema
   *
   * @param {object} file           - An object containing information about the referenced file
   * @param {string} file.url       - The full URL of the referenced file
   * @param {string} file.extension - The lowercased file extension (e.g. ".txt", ".html", etc.)
   * @param {*}      file.data      - The file contents. This will be whatever data type was returned by the resolver
   * @returns {Promise<Buffer>}
   */
  validate: function validate(file) {
    // TODO
  }
};

},{}],92:[function(require,module,exports){
/**
 * Helpers.
 */

var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var y = d * 365.25;

/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */

module.exports = function(val, options) {
  options = options || {};
  var type = typeof val;
  if (type === 'string' && val.length > 0) {
    return parse(val);
  } else if (type === 'number' && isNaN(val) === false) {
    return options.long ? fmtLong(val) : fmtShort(val);
  }
  throw new Error(
    'val is not a non-empty string or a valid number. val=' +
      JSON.stringify(val)
  );
};

/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function parse(str) {
  str = String(str);
  if (str.length > 100) {
    return;
  }
  var match = /^((?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|years?|yrs?|y)?$/i.exec(
    str
  );
  if (!match) {
    return;
  }
  var n = parseFloat(match[1]);
  var type = (match[2] || 'ms').toLowerCase();
  switch (type) {
    case 'years':
    case 'year':
    case 'yrs':
    case 'yr':
    case 'y':
      return n * y;
    case 'days':
    case 'day':
    case 'd':
      return n * d;
    case 'hours':
    case 'hour':
    case 'hrs':
    case 'hr':
    case 'h':
      return n * h;
    case 'minutes':
    case 'minute':
    case 'mins':
    case 'min':
    case 'm':
      return n * m;
    case 'seconds':
    case 'second':
    case 'secs':
    case 'sec':
    case 's':
      return n * s;
    case 'milliseconds':
    case 'millisecond':
    case 'msecs':
    case 'msec':
    case 'ms':
      return n;
    default:
      return undefined;
  }
}

/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtShort(ms) {
  if (ms >= d) {
    return Math.round(ms / d) + 'd';
  }
  if (ms >= h) {
    return Math.round(ms / h) + 'h';
  }
  if (ms >= m) {
    return Math.round(ms / m) + 'm';
  }
  if (ms >= s) {
    return Math.round(ms / s) + 's';
  }
  return ms + 'ms';
}

/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */

function fmtLong(ms) {
  return plural(ms, d, 'day') ||
    plural(ms, h, 'hour') ||
    plural(ms, m, 'minute') ||
    plural(ms, s, 'second') ||
    ms + ' ms';
}

/**
 * Pluralization helper.
 */

function plural(ms, n, name) {
  if (ms < n) {
    return;
  }
  if (ms < n * 1.5) {
    return Math.floor(ms / n) + ' ' + name;
  }
  return Math.ceil(ms / n) + ' ' + name + 's';
}

},{}],93:[function(require,module,exports){
/*
object-assign
(c) Sindre Sorhus
@license MIT
*/

'use strict';
/* eslint-disable no-unused-vars */
var getOwnPropertySymbols = Object.getOwnPropertySymbols;
var hasOwnProperty = Object.prototype.hasOwnProperty;
var propIsEnumerable = Object.prototype.propertyIsEnumerable;

function toObject(val) {
	if (val === null || val === undefined) {
		throw new TypeError('Object.assign cannot be called with null or undefined');
	}

	return Object(val);
}

function shouldUseNative() {
	try {
		if (!Object.assign) {
			return false;
		}

		// Detect buggy property enumeration order in older V8 versions.

		// https://bugs.chromium.org/p/v8/issues/detail?id=4118
		var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
		test1[5] = 'de';
		if (Object.getOwnPropertyNames(test1)[0] === '5') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test2 = {};
		for (var i = 0; i < 10; i++) {
			test2['_' + String.fromCharCode(i)] = i;
		}
		var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
			return test2[n];
		});
		if (order2.join('') !== '0123456789') {
			return false;
		}

		// https://bugs.chromium.org/p/v8/issues/detail?id=3056
		var test3 = {};
		'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
			test3[letter] = letter;
		});
		if (Object.keys(Object.assign({}, test3)).join('') !==
				'abcdefghijklmnopqrst') {
			return false;
		}

		return true;
	} catch (err) {
		// We don't expect any of the above to throw, but better to be safe.
		return false;
	}
}

module.exports = shouldUseNative() ? Object.assign : function (target, source) {
	var from;
	var to = toObject(target);
	var symbols;

	for (var s = 1; s < arguments.length; s++) {
		from = Object(arguments[s]);

		for (var key in from) {
			if (hasOwnProperty.call(from, key)) {
				to[key] = from[key];
			}
		}

		if (getOwnPropertySymbols) {
			symbols = getOwnPropertySymbols(from);
			for (var i = 0; i < symbols.length; i++) {
				if (propIsEnumerable.call(from, symbols[i])) {
					to[symbols[i]] = from[symbols[i]];
				}
			}
		}
	}

	return to;
};

},{}],94:[function(require,module,exports){
'use strict';

var format = require('format-util');
var slice = Array.prototype.slice;
var protectedProperties = ['name', 'message', 'stack'];
var errorPrototypeProperties = [
  'name', 'message', 'description', 'number', 'code', 'fileName', 'lineNumber', 'columnNumber',
  'sourceURL', 'line', 'column', 'stack'
];

module.exports = create(Error);
module.exports.error = create(Error);
module.exports.eval = create(EvalError);
module.exports.range = create(RangeError);
module.exports.reference = create(ReferenceError);
module.exports.syntax = create(SyntaxError);
module.exports.type = create(TypeError);
module.exports.uri = create(URIError);
module.exports.formatter = format;

/**
 * Creates a new {@link ono} function that creates the given Error class.
 *
 * @param {Class} Klass - The Error subclass to create
 * @returns {ono}
 */
function create (Klass) {
  /**
   * @param {Error}   [err]     - The original error, if any
   * @param {object}  [props]   - An object whose properties will be added to the error object
   * @param {string}  [message] - The error message. May contain {@link util#format} placeholders
   * @param {...*}    [params]  - Parameters that map to the `message` placeholders
   * @returns {Error}
   */
  return function onoFactory (err, props, message, params) {   // eslint-disable-line no-unused-vars
    var formatArgs = [];
    var formattedMessage = '';

    // Determine which arguments were actually specified
    if (typeof err === 'string') {
      formatArgs = slice.call(arguments);
      err = props = undefined;
    }
    else if (typeof props === 'string') {
      formatArgs = slice.call(arguments, 1);
      props = undefined;
    }
    else if (typeof message === 'string') {
      formatArgs = slice.call(arguments, 2);
    }

    // If there are any format arguments, then format the error message
    if (formatArgs.length > 0) {
      formattedMessage = module.exports.formatter.apply(null, formatArgs);
    }

    if (err && err.message) {
      // The inner-error's message will be added to the new message
      formattedMessage += (formattedMessage ? ' \n' : '') + err.message;
    }

    // Create the new error
    // NOTE: DON'T move this to a separate function! We don't want to pollute the stack trace
    var newError = new Klass(formattedMessage);

    // Extend the new error with the additional properties
    extendError(newError, err);   // Copy properties of the original error
    extendToJSON(newError);       // Replace the original toJSON method
    extend(newError, props);      // Copy custom properties, possibly including a custom toJSON method

    return newError;
  };
}

/**
 * Extends the targetError with the properties of the source error.
 *
 * @param {Error}   targetError - The error object to extend
 * @param {?Error}  sourceError - The source error object, if any
 */
function extendError (targetError, sourceError) {
  extendStack(targetError, sourceError);
  extend(targetError, sourceError);
}

/**
 * JavaScript engines differ in how errors are serialized to JSON - especially when it comes
 * to custom error properties and stack traces.  So we add our own toJSON method that ALWAYS
 * outputs every property of the error.
 */
function extendToJSON (error) {
  error.toJSON = errorToJSON;

  // Also add an inspect() method, for compatibility with Node.js' `util.inspect()` method
  error.inspect = errorToString;
}

/**
 * Extends the target object with the properties of the source object.
 *
 * @param {object}  target - The object to extend
 * @param {?source} source - The object whose properties are copied
 */
function extend (target, source) {
  if (source && typeof source === 'object') {
    var keys = Object.keys(source);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];

      // Don't copy "protected" properties, since they have special meaning/behavior
      // and are set by the onoFactory function
      if (protectedProperties.indexOf(key) >= 0) {
        continue;
      }

      try {
        target[key] = source[key];
      }
      catch (e) {
        // This property is read-only, so it can't be copied
      }
    }
  }
}

/**
 * Custom JSON serializer for Error objects.
 * Returns all built-in error properties, as well as extended properties.
 *
 * @returns {object}
 */
function errorToJSON () {
  var json = {};

  // Get all the properties of this error
  var keys = Object.keys(this);

  // Also include properties from the Error prototype
  keys = keys.concat(errorPrototypeProperties);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = this[key];
    var type = typeof value;
    if (type !== 'undefined' && type !== 'function') {
      json[key] = value;
    }
  }

  return json;
}

/**
 * Serializes Error objects as human-readable JSON strings for debugging/logging purposes.
 *
 * @returns {string}
 */
function errorToString () {
  return JSON.stringify(this, null, 2).replace(/\\n/g, '\n');
}

/**
 * Extend the error stack to include its cause
 *
 * @param {Error} targetError
 * @param {Error} sourceError
 */
function extendStack (targetError, sourceError) {
  if (hasLazyStack(targetError)) {
    if (sourceError) {
      lazyJoinStacks(targetError, sourceError);
    }
    else {
      lazyPopStack(targetError);
    }
  }
  else {
    if (sourceError) {
      targetError.stack = joinStacks(targetError.stack, sourceError.stack);
    }
    else {
      targetError.stack = popStack(targetError.stack);
    }
  }
}

/**
 * Appends the original {@link Error#stack} property to the new Error's stack.
 *
 * @param {string} newStack
 * @param {string} originalStack
 * @returns {string}
 */
function joinStacks (newStack, originalStack) {
  newStack = popStack(newStack);

  if (newStack && originalStack) {
    return newStack + '\n\n' + originalStack;
  }
  else {
    return newStack || originalStack;
  }
}

/**
 * Removes Ono from the stack, so that the stack starts at the original error location
 *
 * @param {string} stack
 * @returns {string}
 */
function popStack (stack) {
  if (stack) {
    var lines = stack.split('\n');

    if (lines.length < 2) {
      // The stack only has one line, so there's nothing we can remove
      return stack;
    }

    // Find the `onoFactory` call in the stack, and remove it
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.indexOf('onoFactory') >= 0) {
        lines.splice(i, 1);
        return lines.join('\n');
      }
    }

    // If we get here, then the stack doesn't contain a call to `onoFactory`.
    // This may be due to minification or some optimization of the JS engine.
    // So just return the stack as-is.
    return stack;
  }
}

/**
 * Does a one-time determination of whether this JavaScript engine
 * supports lazy `Error.stack` properties.
 */
var supportsLazyStack = (function () {
  return !!(
    // ES5 property descriptors must be supported
    Object.getOwnPropertyDescriptor && Object.defineProperty &&

    // Chrome on Android doesn't support lazy stacks :(
    (typeof navigator === 'undefined' || !/Android/.test(navigator.userAgent))
  );
}());

/**
 * Does this error have a lazy stack property?
 *
 * @param {Error} err
 * @returns {boolean}
 */
function hasLazyStack (err) {
  if (!supportsLazyStack) {
    return false;
  }

  var descriptor = Object.getOwnPropertyDescriptor(err, 'stack');
  if (!descriptor) {
    return false;
  }
  return typeof descriptor.get === 'function';
}

/**
 * Calls {@link joinStacks} lazily, when the {@link Error#stack} property is accessed.
 *
 * @param {Error} targetError
 * @param {Error} sourceError
 */
function lazyJoinStacks (targetError, sourceError) {
  var targetStack = Object.getOwnPropertyDescriptor(targetError, 'stack');

  Object.defineProperty(targetError, 'stack', {
    get: function () {
      return joinStacks(targetStack.get.apply(targetError), sourceError.stack);
    },
    enumerable: false,
    configurable: true
  });
}

/**
 * Calls {@link popStack} lazily, when the {@link Error#stack} property is accessed.
 *
 * @param {Error} error
 */
function lazyPopStack (error) {
  var targetStack = Object.getOwnPropertyDescriptor(error, 'stack');

  Object.defineProperty(error, 'stack', {
    get: function () {
      return popStack(targetStack.get.apply(error));
    },
    enumerable: false,
    configurable: true
  });
}

},{"format-util":33}],95:[function(require,module,exports){
(function (process){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length - 1; i >= 0; i--) {
    var last = parts[i];
    if (last === '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Split a filename into [root, dir, basename, ext], unix version
// 'root' is just a slash, or nothing.
var splitPathRe =
    /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;
var splitPath = function(filename) {
  return splitPathRe.exec(filename).slice(1);
};

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
  var resolvedPath = '',
      resolvedAbsolute = false;

  for (var i = arguments.length - 1; i >= -1 && !resolvedAbsolute; i--) {
    var path = (i >= 0) ? arguments[i] : process.cwd();

    // Skip empty and invalid entries
    if (typeof path !== 'string') {
      throw new TypeError('Arguments to path.resolve must be strings');
    } else if (!path) {
      continue;
    }

    resolvedPath = path + '/' + resolvedPath;
    resolvedAbsolute = path.charAt(0) === '/';
  }

  // At this point the path should be resolved to a full absolute path, but
  // handle relative paths to be safe (might happen when process.cwd() fails)

  // Normalize the path
  resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
  var isAbsolute = exports.isAbsolute(path),
      trailingSlash = substr(path, -1) === '/';

  // Normalize the path
  path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};

// posix version
exports.isAbsolute = function(path) {
  return path.charAt(0) === '/';
};

// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to path.join must be strings');
    }
    return p;
  }).join('/'));
};


// path.relative(from, to)
// posix version
exports.relative = function(from, to) {
  from = exports.resolve(from).substr(1);
  to = exports.resolve(to).substr(1);

  function trim(arr) {
    var start = 0;
    for (; start < arr.length; start++) {
      if (arr[start] !== '') break;
    }

    var end = arr.length - 1;
    for (; end >= 0; end--) {
      if (arr[end] !== '') break;
    }

    if (start > end) return [];
    return arr.slice(start, end - start + 1);
  }

  var fromParts = trim(from.split('/'));
  var toParts = trim(to.split('/'));

  var length = Math.min(fromParts.length, toParts.length);
  var samePartsLength = length;
  for (var i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      samePartsLength = i;
      break;
    }
  }

  var outputParts = [];
  for (var i = samePartsLength; i < fromParts.length; i++) {
    outputParts.push('..');
  }

  outputParts = outputParts.concat(toParts.slice(samePartsLength));

  return outputParts.join('/');
};

exports.sep = '/';
exports.delimiter = ':';

exports.dirname = function(path) {
  var result = splitPath(path),
      root = result[0],
      dir = result[1];

  if (!root && !dir) {
    // No dirname whatsoever
    return '.';
  }

  if (dir) {
    // It has a dirname, strip trailing slash
    dir = dir.substr(0, dir.length - 1);
  }

  return root + dir;
};


exports.basename = function(path, ext) {
  var f = splitPath(path)[2];
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPath(path)[3];
};

function filter (xs, f) {
    if (xs.filter) return xs.filter(f);
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (f(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// String.prototype.substr - negative index don't work in IE8
var substr = 'ab'.substr(-1) === 'b'
    ? function (str, start, len) { return str.substr(start, len) }
    : function (str, start, len) {
        if (start < 0) start = str.length + start;
        return str.substr(start, len);
    }
;

}).call(this,require('_process'))
},{"_process":98}],96:[function(require,module,exports){
/* global define */

(function (root, pluralize) {
  /* istanbul ignore else */
  if (typeof require === 'function' && typeof exports === 'object' && typeof module === 'object') {
    // Node.
    module.exports = pluralize();
  } else if (typeof define === 'function' && define.amd) {
    // AMD, registers as an anonymous module.
    define(function () {
      return pluralize();
    });
  } else {
    // Browser global.
    root.pluralize = pluralize();
  }
})(this, function () {
  // Rule storage - pluralize and singularize need to be run sequentially,
  // while other rules can be optimized using an object for instant lookups.
  var pluralRules = [];
  var singularRules = [];
  var uncountables = {};
  var irregularPlurals = {};
  var irregularSingles = {};

  /**
   * Title case a string.
   *
   * @param  {string} str
   * @return {string}
   */
  function toTitleCase (str) {
    return str.charAt(0).toUpperCase() + str.substr(1).toLowerCase();
  }

  /**
   * Sanitize a pluralization rule to a usable regular expression.
   *
   * @param  {(RegExp|string)} rule
   * @return {RegExp}
   */
  function sanitizeRule (rule) {
    if (typeof rule === 'string') {
      return new RegExp('^' + rule + '$', 'i');
    }

    return rule;
  }

  /**
   * Pass in a word token to produce a function that can replicate the case on
   * another word.
   *
   * @param  {string}   word
   * @param  {string}   token
   * @return {Function}
   */
  function restoreCase (word, token) {
    // Upper cased words. E.g. "HELLO".
    if (word === word.toUpperCase()) {
      return token.toUpperCase();
    }

    // Title cased words. E.g. "Title".
    if (word[0] === word[0].toUpperCase()) {
      return toTitleCase(token);
    }

    // Lower cased words. E.g. "test".
    return token.toLowerCase();
  }

  /**
   * Interpolate a regexp string.
   *
   * @param  {string} str
   * @param  {Array}  args
   * @return {string}
   */
  function interpolate (str, args) {
    return str.replace(/\$(\d{1,2})/g, function (match, index) {
      return args[index] || '';
    });
  }

  /**
   * Sanitize a word by passing in the word and sanitization rules.
   *
   * @param  {String}   word
   * @param  {Array}    collection
   * @return {String}
   */
  function sanitizeWord (word, collection) {
    // Empty string or doesn't need fixing.
    if (!word.length || uncountables.hasOwnProperty(word)) {
      return word;
    }

    var len = collection.length;

    // Iterate over the sanitization rules and use the first one to match.
    while (len--) {
      var rule = collection[len];

      // If the rule passes, return the replacement.
      if (rule[0].test(word)) {
        return word.replace(rule[0], function (match, index, word) {
          var result = interpolate(rule[1], arguments);

          if (match === '') {
            return restoreCase(word[index - 1], result);
          }

          return restoreCase(match, result);
        });
      }
    }

    return word;
  }

  /**
   * Replace a word with the updated word.
   *
   * @param  {Object}   replaceMap
   * @param  {Object}   keepMap
   * @param  {Array}    rules
   * @return {Function}
   */
  function replaceWord (replaceMap, keepMap, rules) {
    return function (word) {
      // Get the correct token and case restoration functions.
      var token = word.toLowerCase();

      // Check against the keep object map.
      if (keepMap.hasOwnProperty(token)) {
        return restoreCase(word, token);
      }

      // Check against the replacement map for a direct word replacement.
      if (replaceMap.hasOwnProperty(token)) {
        return restoreCase(word, replaceMap[token]);
      }

      // Run all the rules against the word.
      return sanitizeWord(word, rules);
    };
  }

  /**
   * Pluralize or singularize a word based on the passed in count.
   *
   * @param  {String}  word
   * @param  {Number}  count
   * @param  {Boolean} inclusive
   * @return {String}
   */
  function pluralize (word, count, inclusive) {
    var pluralized = count === 1
      ? pluralize.singular(word) : pluralize.plural(word);

    return (inclusive ? count + ' ' : '') + pluralized;
  }

  /**
   * Pluralize a word.
   *
   * @type {Function}
   */
  pluralize.plural = replaceWord(
    irregularSingles, irregularPlurals, pluralRules
  );

  /**
   * Singularize a word.
   *
   * @type {Function}
   */
  pluralize.singular = replaceWord(
    irregularPlurals, irregularSingles, singularRules
  );

  /**
   * Add a pluralization rule to the collection.
   *
   * @param {(string|RegExp)} rule
   * @param {string}          replacement
   */
  pluralize.addPluralRule = function (rule, replacement) {
    pluralRules.push([sanitizeRule(rule), replacement]);
  };

  /**
   * Add a singularization rule to the collection.
   *
   * @param {(string|RegExp)} rule
   * @param {string}          replacement
   */
  pluralize.addSingularRule = function (rule, replacement) {
    singularRules.push([sanitizeRule(rule), replacement]);
  };

  /**
   * Add an uncountable word rule.
   *
   * @param {(string|RegExp)} word
   */
  pluralize.addUncountableRule = function (word) {
    if (typeof word === 'string') {
      uncountables[word.toLowerCase()] = true;
      return;
    }

    // Set singular and plural references for the word.
    pluralize.addPluralRule(word, '$0');
    pluralize.addSingularRule(word, '$0');
  };

  /**
   * Add an irregular word definition.
   *
   * @param {String} single
   * @param {String} plural
   */
  pluralize.addIrregularRule = function (single, plural) {
    plural = plural.toLowerCase();
    single = single.toLowerCase();

    irregularSingles[single] = plural;
    irregularPlurals[plural] = single;
  };

  /**
   * Irregular rules.
   */
  [
    // Pronouns.
    ['I', 'we'],
    ['me', 'us'],
    ['he', 'they'],
    ['she', 'they'],
    ['them', 'them'],
    ['myself', 'ourselves'],
    ['yourself', 'yourselves'],
    ['itself', 'themselves'],
    ['herself', 'themselves'],
    ['himself', 'themselves'],
    ['themself', 'themselves'],
    ['is', 'are'],
    ['this', 'these'],
    ['that', 'those'],
    // Words ending in with a consonant and `o`.
    ['echo', 'echoes'],
    ['dingo', 'dingoes'],
    ['volcano', 'volcanoes'],
    ['tornado', 'tornadoes'],
    ['torpedo', 'torpedoes'],
    // Ends with `us`.
    ['genus', 'genera'],
    ['viscus', 'viscera'],
    // Ends with `ma`.
    ['stigma', 'stigmata'],
    ['stoma', 'stomata'],
    ['dogma', 'dogmata'],
    ['lemma', 'lemmata'],
    ['schema', 'schemata'],
    ['anathema', 'anathemata'],
    // Other irregular rules.
    ['ox', 'oxen'],
    ['axe', 'axes'],
    ['die', 'dice'],
    ['yes', 'yeses'],
    ['foot', 'feet'],
    ['eave', 'eaves'],
    ['goose', 'geese'],
    ['tooth', 'teeth'],
    ['quiz', 'quizzes'],
    ['human', 'humans'],
    ['proof', 'proofs'],
    ['carve', 'carves'],
    ['valve', 'valves'],
    ['thief', 'thieves'],
    ['genie', 'genies'],
    ['groove', 'grooves'],
    ['pickaxe', 'pickaxes'],
    ['whiskey', 'whiskies']
  ].forEach(function (rule) {
    return pluralize.addIrregularRule(rule[0], rule[1]);
  });

  /**
   * Pluralization rules.
   */
  [
    [/s?$/i, 's'],
    [/([^aeiou]ese)$/i, '$1'],
    [/(ax|test)is$/i, '$1es'],
    [/(alias|[^aou]us|tlas|gas|ris)$/i, '$1es'],
    [/(e[mn]u)s?$/i, '$1s'],
    [/([^l]ias|[aeiou]las|[emjzr]as|[iu]am)$/i, '$1'],
    [/(alumn|syllab|octop|vir|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat)(?:us|i)$/i, '$1i'],
    [/(alumn|alg|vertebr)(?:a|ae)$/i, '$1ae'],
    [/(seraph|cherub)(?:im)?$/i, '$1im'],
    [/(her|at|gr)o$/i, '$1oes'],
    [/(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|automat|quor)(?:a|um)$/i, '$1a'],
    [/(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|hedr|automat)(?:a|on)$/i, '$1a'],
    [/sis$/i, 'ses'],
    [/(?:(kni|wi|li)fe|(ar|l|ea|eo|oa|hoo)f)$/i, '$1$2ves'],
    [/([^aeiouy]|qu)y$/i, '$1ies'],
    [/([^ch][ieo][ln])ey$/i, '$1ies'],
    [/(x|ch|ss|sh|zz)$/i, '$1es'],
    [/(matr|cod|mur|sil|vert|ind|append)(?:ix|ex)$/i, '$1ices'],
    [/(m|l)(?:ice|ouse)$/i, '$1ice'],
    [/(pe)(?:rson|ople)$/i, '$1ople'],
    [/(child)(?:ren)?$/i, '$1ren'],
    [/eaux$/i, '$0'],
    [/m[ae]n$/i, 'men'],
    ['thou', 'you']
  ].forEach(function (rule) {
    return pluralize.addPluralRule(rule[0], rule[1]);
  });

  /**
   * Singularization rules.
   */
  [
    [/s$/i, ''],
    [/(ss)$/i, '$1'],
    [/((a)naly|(b)a|(d)iagno|(p)arenthe|(p)rogno|(s)ynop|(t)he)(?:sis|ses)$/i, '$1sis'],
    [/(^analy)(?:sis|ses)$/i, '$1sis'],
    [/(wi|kni|(?:after|half|high|low|mid|non|night|[^\w]|^)li)ves$/i, '$1fe'],
    [/(ar|(?:wo|[ae])l|[eo][ao])ves$/i, '$1f'],
    [/([^aeiouy]|qu)ies$/i, '$1y'],
    [/(^[pl]|zomb|^(?:neck)?t|[aeo][lt]|cut)ies$/i, '$1ie'],
    [/([^c][eor]n|smil)ies$/i, '$1ey'],
    [/(m|l)ice$/i, '$1ouse'],
    [/(seraph|cherub)im$/i, '$1'],
    [/(x|ch|ss|sh|zz|tto|go|cho|alias|[^aou]us|tlas|gas|(?:her|at|gr)o|ris)(?:es)?$/i, '$1'],
    [/(e[mn]u)s?$/i, '$1'],
    [/(movie|twelve)s$/i, '$1'],
    [/(cris|test|diagnos)(?:is|es)$/i, '$1is'],
    [/(alumn|syllab|octop|vir|radi|nucle|fung|cact|stimul|termin|bacill|foc|uter|loc|strat)(?:us|i)$/i, '$1us'],
    [/(agend|addend|millenni|dat|extrem|bacteri|desiderat|strat|candelabr|errat|ov|symposi|curricul|quor)a$/i, '$1um'],
    [/(apheli|hyperbat|periheli|asyndet|noumen|phenomen|criteri|organ|prolegomen|hedr|automat)a$/i, '$1on'],
    [/(alumn|alg|vertebr)ae$/i, '$1a'],
    [/(cod|mur|sil|vert|ind)ices$/i, '$1ex'],
    [/(matr|append)ices$/i, '$1ix'],
    [/(pe)(rson|ople)$/i, '$1rson'],
    [/(child)ren$/i, '$1'],
    [/(eau)x?$/i, '$1'],
    [/men$/i, 'man']
  ].forEach(function (rule) {
    return pluralize.addSingularRule(rule[0], rule[1]);
  });

  /**
   * Uncountable rules.
   */
  [
    // Singular words with no plurals.
    'advice',
    'agenda',
    'bison',
    'bream',
    'buffalo',
    'carp',
    'chassis',
    'cod',
    'cooperation',
    'corps',
    'digestion',
    'debris',
    'diabetes',
    'energy',
    'equipment',
    'elk',
    'excretion',
    'expertise',
    'flounder',
    'gallows',
    'garbage',
    'graffiti',
    'headquarters',
    'health',
    'herpes',
    'highjinks',
    'homework',
    'information',
    'jeans',
    'justice',
    'kudos',
    'labour',
    'machinery',
    'mackerel',
    'media',
    'mews',
    'moose',
    'news',
    'pike',
    'plankton',
    'pliers',
    'pollution',
    'premises',
    'rain',
    'rice',
    'salmon',
    'scissors',
    'series',
    'sewage',
    'shambles',
    'shrimp',
    'species',
    'staff',
    'swine',
    'trout',
    'tuna',
    'whiting',
    'wildebeest',
    'wildlife',
    'you',
    // Regexes.
    /pox$/i, // "chickpox", "smallpox"
    /ois$/i,
    /deer$/i, // "deer", "reindeer"
    /fish$/i, // "fish", "blowfish", "angelfish"
    /sheep$/i,
    /measles$/i,
    /[^aeiou]ese$/i // "chinese", "japanese"
  ].forEach(pluralize.addUncountableRule);

  return pluralize;
});

},{}],97:[function(require,module,exports){
(function (process){
'use strict';

if (!process.version ||
    process.version.indexOf('v0.') === 0 ||
    process.version.indexOf('v1.') === 0 && process.version.indexOf('v1.8.') !== 0) {
  module.exports = nextTick;
} else {
  module.exports = process.nextTick;
}

function nextTick(fn, arg1, arg2, arg3) {
  if (typeof fn !== 'function') {
    throw new TypeError('"callback" argument must be a function');
  }
  var len = arguments.length;
  var args, i;
  switch (len) {
  case 0:
  case 1:
    return process.nextTick(fn);
  case 2:
    return process.nextTick(function afterTickOne() {
      fn.call(null, arg1);
    });
  case 3:
    return process.nextTick(function afterTickTwo() {
      fn.call(null, arg1, arg2);
    });
  case 4:
    return process.nextTick(function afterTickThree() {
      fn.call(null, arg1, arg2, arg3);
    });
  default:
    args = new Array(len - 1);
    i = 0;
    while (i < args.length) {
      args[i++] = arguments[i];
    }
    return process.nextTick(function afterTick() {
      fn.apply(null, args);
    });
  }
}

}).call(this,require('_process'))
},{"_process":98}],98:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],99:[function(require,module,exports){
(function (global){
/*! https://mths.be/punycode v1.4.1 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports &&
		!exports.nodeType && exports;
	var freeModule = typeof module == 'object' && module &&
		!module.nodeType && module;
	var freeGlobal = typeof global == 'object' && global;
	if (
		freeGlobal.global === freeGlobal ||
		freeGlobal.window === freeGlobal ||
		freeGlobal.self === freeGlobal
	) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw new RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		var result = [];
		while (length--) {
			result[length] = fn(array[length]);
		}
		return result;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings or email
	 * addresses.
	 * @private
	 * @param {String} domain The domain name or email address.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		var parts = string.split('@');
		var result = '';
		if (parts.length > 1) {
			// In email addresses, only the domain name should be punycoded. Leave
			// the local part (i.e. everything up to `@`) intact.
			result = parts[0] + '@';
			string = parts[1];
		}
		// Avoid `split(regex)` for IE8 compatibility. See #17.
		string = string.replace(regexSeparators, '\x2E');
		var labels = string.split('.');
		var encoded = map(labels, fn).join('.');
		return result + encoded;
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * https://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
	 * Punycode string of ASCII-only symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name or an email address
	 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
	 * it doesn't matter if you call it on a string that has already been
	 * converted to Unicode.
	 * @memberOf punycode
	 * @param {String} input The Punycoded domain name or email address to
	 * convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(input) {
		return mapDomain(input, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name or an email address to
	 * Punycode. Only the non-ASCII parts of the domain name will be converted,
	 * i.e. it doesn't matter if you call it with a domain that's already in
	 * ASCII.
	 * @memberOf punycode
	 * @param {String} input The domain name or email address to convert, as a
	 * Unicode string.
	 * @returns {String} The Punycode representation of the given domain name or
	 * email address.
	 */
	function toASCII(input) {
		return mapDomain(input, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.4.1',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && freeModule) {
		if (module.exports == freeExports) {
			// in Node.js, io.js, or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else {
			// in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else {
		// in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],100:[function(require,module,exports){
// vim:ts=4:sts=4:sw=4:
/*!
 *
 * Copyright 2009-2012 Kris Kowal under the terms of the MIT
 * license found at http://github.com/kriskowal/q/raw/master/LICENSE
 *
 * With parts by Tyler Close
 * Copyright 2007-2009 Tyler Close under the terms of the MIT X license found
 * at http://www.opensource.org/licenses/mit-license.html
 * Forked at ref_send.js version: 2009-05-11
 *
 * With parts by Mark Miller
 * Copyright (C) 2011 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

(function (definition) {
    // Turn off strict mode for this function so we can assign to global.Q
    /* jshint strict: false */

    // This file will function properly as a <script> tag, or a module
    // using CommonJS and NodeJS or RequireJS module formats.  In
    // Common/Node/RequireJS, the module exports the Q API and when
    // executed as a simple <script>, it creates a Q global instead.

    // Montage Require
    if (typeof bootstrap === "function") {
        bootstrap("promise", definition);

    // CommonJS
    } else if (typeof exports === "object") {
        module.exports = definition();

    // RequireJS
    } else if (typeof define === "function" && define.amd) {
        define(definition);

    // SES (Secure EcmaScript)
    } else if (typeof ses !== "undefined") {
        if (!ses.ok()) {
            return;
        } else {
            ses.makeQ = definition;
        }

    // <script>
    } else {
        Q = definition();
    }

})(function () {
"use strict";

var hasStacks = false;
try {
    throw new Error();
} catch (e) {
    hasStacks = !!e.stack;
}

// All code after this point will be filtered from stack traces reported
// by Q.
var qStartingLine = captureLine();
var qFileName;

// shims

// used for fallback in "allResolved"
var noop = function () {};

// Use the fastest possible means to execute a task in a future turn
// of the event loop.
var nextTick =(function () {
    // linked list of tasks (single, with head node)
    var head = {task: void 0, next: null};
    var tail = head;
    var flushing = false;
    var requestTick = void 0;
    var isNodeJS = false;

    function flush() {
        /* jshint loopfunc: true */

        while (head.next) {
            head = head.next;
            var task = head.task;
            head.task = void 0;
            var domain = head.domain;

            if (domain) {
                head.domain = void 0;
                domain.enter();
            }

            try {
                task();

            } catch (e) {
                if (isNodeJS) {
                    // In node, uncaught exceptions are considered fatal errors.
                    // Re-throw them synchronously to interrupt flushing!

                    // Ensure continuation if the uncaught exception is suppressed
                    // listening "uncaughtException" events (as domains does).
                    // Continue in next event to avoid tick recursion.
                    if (domain) {
                        domain.exit();
                    }
                    setTimeout(flush, 0);
                    if (domain) {
                        domain.enter();
                    }

                    throw e;

                } else {
                    // In browsers, uncaught exceptions are not fatal.
                    // Re-throw them asynchronously to avoid slow-downs.
                    setTimeout(function() {
                       throw e;
                    }, 0);
                }
            }

            if (domain) {
                domain.exit();
            }
        }

        flushing = false;
    }

    nextTick = function (task) {
        tail = tail.next = {
            task: task,
            domain: isNodeJS && process.domain,
            next: null
        };

        if (!flushing) {
            flushing = true;
            requestTick();
        }
    };

    if (typeof process !== "undefined" && process.nextTick) {
        // Node.js before 0.9. Note that some fake-Node environments, like the
        // Mocha test runner, introduce a `process` global without a `nextTick`.
        isNodeJS = true;

        requestTick = function () {
            process.nextTick(flush);
        };

    } else if (typeof setImmediate === "function") {
        // In IE10, Node.js 0.9+, or https://github.com/NobleJS/setImmediate
        if (typeof window !== "undefined") {
            requestTick = setImmediate.bind(window, flush);
        } else {
            requestTick = function () {
                setImmediate(flush);
            };
        }

    } else if (typeof MessageChannel !== "undefined") {
        // modern browsers
        // http://www.nonblocking.io/2011/06/windownexttick.html
        var channel = new MessageChannel();
        // At least Safari Version 6.0.5 (8536.30.1) intermittently cannot create
        // working message ports the first time a page loads.
        channel.port1.onmessage = function () {
            requestTick = requestPortTick;
            channel.port1.onmessage = flush;
            flush();
        };
        var requestPortTick = function () {
            // Opera requires us to provide a message payload, regardless of
            // whether we use it.
            channel.port2.postMessage(0);
        };
        requestTick = function () {
            setTimeout(flush, 0);
            requestPortTick();
        };

    } else {
        // old browsers
        requestTick = function () {
            setTimeout(flush, 0);
        };
    }

    return nextTick;
})();

// Attempt to make generics safe in the face of downstream
// modifications.
// There is no situation where this is necessary.
// If you need a security guarantee, these primordials need to be
// deeply frozen anyway, and if you don’t need a security guarantee,
// this is just plain paranoid.
// However, this does have the nice side-effect of reducing the size
// of the code by reducing x.call() to merely x(), eliminating many
// hard-to-minify characters.
// See Mark Miller’s explanation of what this does.
// http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
var call = Function.call;
function uncurryThis(f) {
    return function () {
        return call.apply(f, arguments);
    };
}
// This is equivalent, but slower:
// uncurryThis = Function_bind.bind(Function_bind.call);
// http://jsperf.com/uncurrythis

var array_slice = uncurryThis(Array.prototype.slice);

var array_reduce = uncurryThis(
    Array.prototype.reduce || function (callback, basis) {
        var index = 0,
            length = this.length;
        // concerning the initial value, if one is not provided
        if (arguments.length === 1) {
            // seek to the first value in the array, accounting
            // for the possibility that is is a sparse array
            do {
                if (index in this) {
                    basis = this[index++];
                    break;
                }
                if (++index >= length) {
                    throw new TypeError();
                }
            } while (1);
        }
        // reduce
        for (; index < length; index++) {
            // account for the possibility that the array is sparse
            if (index in this) {
                basis = callback(basis, this[index], index);
            }
        }
        return basis;
    }
);

var array_indexOf = uncurryThis(
    Array.prototype.indexOf || function (value) {
        // not a very good shim, but good enough for our one use of it
        for (var i = 0; i < this.length; i++) {
            if (this[i] === value) {
                return i;
            }
        }
        return -1;
    }
);

var array_map = uncurryThis(
    Array.prototype.map || function (callback, thisp) {
        var self = this;
        var collect = [];
        array_reduce(self, function (undefined, value, index) {
            collect.push(callback.call(thisp, value, index, self));
        }, void 0);
        return collect;
    }
);

var object_create = Object.create || function (prototype) {
    function Type() { }
    Type.prototype = prototype;
    return new Type();
};

var object_hasOwnProperty = uncurryThis(Object.prototype.hasOwnProperty);

var object_keys = Object.keys || function (object) {
    var keys = [];
    for (var key in object) {
        if (object_hasOwnProperty(object, key)) {
            keys.push(key);
        }
    }
    return keys;
};

var object_toString = uncurryThis(Object.prototype.toString);

function isObject(value) {
    return value === Object(value);
}

// generator related shims

// FIXME: Remove this function once ES6 generators are in SpiderMonkey.
function isStopIteration(exception) {
    return (
        object_toString(exception) === "[object StopIteration]" ||
        exception instanceof QReturnValue
    );
}

// FIXME: Remove this helper and Q.return once ES6 generators are in
// SpiderMonkey.
var QReturnValue;
if (typeof ReturnValue !== "undefined") {
    QReturnValue = ReturnValue;
} else {
    QReturnValue = function (value) {
        this.value = value;
    };
}

// Until V8 3.19 / Chromium 29 is released, SpiderMonkey is the only
// engine that has a deployed base of browsers that support generators.
// However, SM's generators use the Python-inspired semantics of
// outdated ES6 drafts.  We would like to support ES6, but we'd also
// like to make it possible to use generators in deployed browsers, so
// we also support Python-style generators.  At some point we can remove
// this block.
var hasES6Generators;
try {
    /* jshint evil: true, nonew: false */
    new Function("(function* (){ yield 1; })");
    hasES6Generators = true;
} catch (e) {
    hasES6Generators = false;
}

// long stack traces

var STACK_JUMP_SEPARATOR = "From previous event:";

function makeStackTraceLong(error, promise) {
    // If possible, transform the error stack trace by removing Node and Q
    // cruft, then concatenating with the stack trace of `promise`. See #57.
    if (hasStacks &&
        promise.stack &&
        typeof error === "object" &&
        error !== null &&
        error.stack &&
        error.stack.indexOf(STACK_JUMP_SEPARATOR) === -1
    ) {
        var stacks = [];
        for (var p = promise; !!p; p = p.source) {
            if (p.stack) {
                stacks.unshift(p.stack);
            }
        }
        stacks.unshift(error.stack);

        var concatedStacks = stacks.join("\n" + STACK_JUMP_SEPARATOR + "\n");
        error.stack = filterStackString(concatedStacks);
    }
}

function filterStackString(stackString) {
    var lines = stackString.split("\n");
    var desiredLines = [];
    for (var i = 0; i < lines.length; ++i) {
        var line = lines[i];

        if (!isInternalFrame(line) && !isNodeFrame(line) && line) {
            desiredLines.push(line);
        }
    }
    return desiredLines.join("\n");
}

function isNodeFrame(stackLine) {
    return stackLine.indexOf("(module.js:") !== -1 ||
           stackLine.indexOf("(node.js:") !== -1;
}

function getFileNameAndLineNumber(stackLine) {
    // Named functions: "at functionName (filename:lineNumber:columnNumber)"
    // In IE10 function name can have spaces ("Anonymous function") O_o
    var attempt1 = /at .+ \((.+):(\d+):(?:\d+)\)$/.exec(stackLine);
    if (attempt1) {
        return [attempt1[1], Number(attempt1[2])];
    }

    // Anonymous functions: "at filename:lineNumber:columnNumber"
    var attempt2 = /at ([^ ]+):(\d+):(?:\d+)$/.exec(stackLine);
    if (attempt2) {
        return [attempt2[1], Number(attempt2[2])];
    }

    // Firefox style: "function@filename:lineNumber or @filename:lineNumber"
    var attempt3 = /.*@(.+):(\d+)$/.exec(stackLine);
    if (attempt3) {
        return [attempt3[1], Number(attempt3[2])];
    }
}

function isInternalFrame(stackLine) {
    var fileNameAndLineNumber = getFileNameAndLineNumber(stackLine);

    if (!fileNameAndLineNumber) {
        return false;
    }

    var fileName = fileNameAndLineNumber[0];
    var lineNumber = fileNameAndLineNumber[1];

    return fileName === qFileName &&
        lineNumber >= qStartingLine &&
        lineNumber <= qEndingLine;
}

// discover own file name and line number range for filtering stack
// traces
function captureLine() {
    if (!hasStacks) {
        return;
    }

    try {
        throw new Error();
    } catch (e) {
        var lines = e.stack.split("\n");
        var firstLine = lines[0].indexOf("@") > 0 ? lines[1] : lines[2];
        var fileNameAndLineNumber = getFileNameAndLineNumber(firstLine);
        if (!fileNameAndLineNumber) {
            return;
        }

        qFileName = fileNameAndLineNumber[0];
        return fileNameAndLineNumber[1];
    }
}

function deprecate(callback, name, alternative) {
    return function () {
        if (typeof console !== "undefined" &&
            typeof console.warn === "function") {
            console.warn(name + " is deprecated, use " + alternative +
                         " instead.", new Error("").stack);
        }
        return callback.apply(callback, arguments);
    };
}

// end of shims
// beginning of real work

/**
 * Constructs a promise for an immediate reference, passes promises through, or
 * coerces promises from different systems.
 * @param value immediate reference or promise
 */
function Q(value) {
    // If the object is already a Promise, return it directly.  This enables
    // the resolve function to both be used to created references from objects,
    // but to tolerably coerce non-promises to promises.
    if (isPromise(value)) {
        return value;
    }

    // assimilate thenables
    if (isPromiseAlike(value)) {
        return coerce(value);
    } else {
        return fulfill(value);
    }
}
Q.resolve = Q;

/**
 * Performs a task in a future turn of the event loop.
 * @param {Function} task
 */
Q.nextTick = nextTick;

/**
 * Controls whether or not long stack traces will be on
 */
Q.longStackSupport = false;

/**
 * Constructs a {promise, resolve, reject} object.
 *
 * `resolve` is a callback to invoke with a more resolved value for the
 * promise. To fulfill the promise, invoke `resolve` with any value that is
 * not a thenable. To reject the promise, invoke `resolve` with a rejected
 * thenable, or invoke `reject` with the reason directly. To resolve the
 * promise to another thenable, thus putting it in the same state, invoke
 * `resolve` with that other thenable.
 */
Q.defer = defer;
function defer() {
    // if "messages" is an "Array", that indicates that the promise has not yet
    // been resolved.  If it is "undefined", it has been resolved.  Each
    // element of the messages array is itself an array of complete arguments to
    // forward to the resolved promise.  We coerce the resolution value to a
    // promise using the `resolve` function because it handles both fully
    // non-thenable values and other thenables gracefully.
    var messages = [], progressListeners = [], resolvedPromise;

    var deferred = object_create(defer.prototype);
    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, operands) {
        var args = array_slice(arguments);
        if (messages) {
            messages.push(args);
            if (op === "when" && operands[1]) { // progress operand
                progressListeners.push(operands[1]);
            }
        } else {
            nextTick(function () {
                resolvedPromise.promiseDispatch.apply(resolvedPromise, args);
            });
        }
    };

    // XXX deprecated
    promise.valueOf = deprecate(function () {
        if (messages) {
            return promise;
        }
        var nearerValue = nearer(resolvedPromise);
        if (isPromise(nearerValue)) {
            resolvedPromise = nearerValue; // shorten chain
        }
        return nearerValue;
    }, "valueOf", "inspect");

    promise.inspect = function () {
        if (!resolvedPromise) {
            return { state: "pending" };
        }
        return resolvedPromise.inspect();
    };

    if (Q.longStackSupport && hasStacks) {
        try {
            throw new Error();
        } catch (e) {
            // NOTE: don't try to use `Error.captureStackTrace` or transfer the
            // accessor around; that causes memory leaks as per GH-111. Just
            // reify the stack trace as a string ASAP.
            //
            // At the same time, cut off the first line; it's always just
            // "[object Promise]\n", as per the `toString`.
            promise.stack = e.stack.substring(e.stack.indexOf("\n") + 1);
        }
    }

    // NOTE: we do the checks for `resolvedPromise` in each method, instead of
    // consolidating them into `become`, since otherwise we'd create new
    // promises with the lines `become(whatever(value))`. See e.g. GH-252.

    function become(newPromise) {
        resolvedPromise = newPromise;
        promise.source = newPromise;

        array_reduce(messages, function (undefined, message) {
            nextTick(function () {
                newPromise.promiseDispatch.apply(newPromise, message);
            });
        }, void 0);

        messages = void 0;
        progressListeners = void 0;
    }

    deferred.promise = promise;
    deferred.resolve = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(Q(value));
    };

    deferred.fulfill = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(fulfill(value));
    };
    deferred.reject = function (reason) {
        if (resolvedPromise) {
            return;
        }

        become(reject(reason));
    };
    deferred.notify = function (progress) {
        if (resolvedPromise) {
            return;
        }

        array_reduce(progressListeners, function (undefined, progressListener) {
            nextTick(function () {
                progressListener(progress);
            });
        }, void 0);
    };

    return deferred;
}

/**
 * Creates a Node-style callback that will resolve or reject the deferred
 * promise.
 * @returns a nodeback
 */
defer.prototype.makeNodeResolver = function () {
    var self = this;
    return function (error, value) {
        if (error) {
            self.reject(error);
        } else if (arguments.length > 2) {
            self.resolve(array_slice(arguments, 1));
        } else {
            self.resolve(value);
        }
    };
};

/**
 * @param resolver {Function} a function that returns nothing and accepts
 * the resolve, reject, and notify functions for a deferred.
 * @returns a promise that may be resolved with the given resolve and reject
 * functions, or rejected by a thrown exception in resolver
 */
Q.promise = promise;
function promise(resolver) {
    if (typeof resolver !== "function") {
        throw new TypeError("resolver must be a function.");
    }
    var deferred = defer();
    try {
        resolver(deferred.resolve, deferred.reject, deferred.notify);
    } catch (reason) {
        deferred.reject(reason);
    }
    return deferred.promise;
}

// XXX experimental.  This method is a way to denote that a local value is
// serializable and should be immediately dispatched to a remote upon request,
// instead of passing a reference.
Q.passByCopy = function (object) {
    //freeze(object);
    //passByCopies.set(object, true);
    return object;
};

Promise.prototype.passByCopy = function () {
    //freeze(object);
    //passByCopies.set(object, true);
    return this;
};

/**
 * If two promises eventually fulfill to the same value, promises that value,
 * but otherwise rejects.
 * @param x {Any*}
 * @param y {Any*}
 * @returns {Any*} a promise for x and y if they are the same, but a rejection
 * otherwise.
 *
 */
Q.join = function (x, y) {
    return Q(x).join(y);
};

Promise.prototype.join = function (that) {
    return Q([this, that]).spread(function (x, y) {
        if (x === y) {
            // TODO: "===" should be Object.is or equiv
            return x;
        } else {
            throw new Error("Can't join: not the same: " + x + " " + y);
        }
    });
};

/**
 * Returns a promise for the first of an array of promises to become fulfilled.
 * @param answers {Array[Any*]} promises to race
 * @returns {Any*} the first promise to be fulfilled
 */
Q.race = race;
function race(answerPs) {
    return promise(function(resolve, reject) {
        // Switch to this once we can assume at least ES5
        // answerPs.forEach(function(answerP) {
        //     Q(answerP).then(resolve, reject);
        // });
        // Use this in the meantime
        for (var i = 0, len = answerPs.length; i < len; i++) {
            Q(answerPs[i]).then(resolve, reject);
        }
    });
}

Promise.prototype.race = function () {
    return this.then(Q.race);
};

/**
 * Constructs a Promise with a promise descriptor object and optional fallback
 * function.  The descriptor contains methods like when(rejected), get(name),
 * set(name, value), post(name, args), and delete(name), which all
 * return either a value, a promise for a value, or a rejection.  The fallback
 * accepts the operation name, a resolver, and any further arguments that would
 * have been forwarded to the appropriate method above had a method been
 * provided with the proper name.  The API makes no guarantees about the nature
 * of the returned object, apart from that it is usable whereever promises are
 * bought and sold.
 */
Q.makePromise = Promise;
function Promise(descriptor, fallback, inspect) {
    if (fallback === void 0) {
        fallback = function (op) {
            return reject(new Error(
                "Promise does not support operation: " + op
            ));
        };
    }
    if (inspect === void 0) {
        inspect = function () {
            return {state: "unknown"};
        };
    }

    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, args) {
        var result;
        try {
            if (descriptor[op]) {
                result = descriptor[op].apply(promise, args);
            } else {
                result = fallback.call(promise, op, args);
            }
        } catch (exception) {
            result = reject(exception);
        }
        if (resolve) {
            resolve(result);
        }
    };

    promise.inspect = inspect;

    // XXX deprecated `valueOf` and `exception` support
    if (inspect) {
        var inspected = inspect();
        if (inspected.state === "rejected") {
            promise.exception = inspected.reason;
        }

        promise.valueOf = deprecate(function () {
            var inspected = inspect();
            if (inspected.state === "pending" ||
                inspected.state === "rejected") {
                return promise;
            }
            return inspected.value;
        });
    }

    return promise;
}

Promise.prototype.toString = function () {
    return "[object Promise]";
};

Promise.prototype.then = function (fulfilled, rejected, progressed) {
    var self = this;
    var deferred = defer();
    var done = false;   // ensure the untrusted promise makes at most a
                        // single call to one of the callbacks

    function _fulfilled(value) {
        try {
            return typeof fulfilled === "function" ? fulfilled(value) : value;
        } catch (exception) {
            return reject(exception);
        }
    }

    function _rejected(exception) {
        if (typeof rejected === "function") {
            makeStackTraceLong(exception, self);
            try {
                return rejected(exception);
            } catch (newException) {
                return reject(newException);
            }
        }
        return reject(exception);
    }

    function _progressed(value) {
        return typeof progressed === "function" ? progressed(value) : value;
    }

    nextTick(function () {
        self.promiseDispatch(function (value) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_fulfilled(value));
        }, "when", [function (exception) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_rejected(exception));
        }]);
    });

    // Progress propagator need to be attached in the current tick.
    self.promiseDispatch(void 0, "when", [void 0, function (value) {
        var newValue;
        var threw = false;
        try {
            newValue = _progressed(value);
        } catch (e) {
            threw = true;
            if (Q.onerror) {
                Q.onerror(e);
            } else {
                throw e;
            }
        }

        if (!threw) {
            deferred.notify(newValue);
        }
    }]);

    return deferred.promise;
};

/**
 * Registers an observer on a promise.
 *
 * Guarantees:
 *
 * 1. that fulfilled and rejected will be called only once.
 * 2. that either the fulfilled callback or the rejected callback will be
 *    called, but not both.
 * 3. that fulfilled and rejected will not be called in this turn.
 *
 * @param value      promise or immediate reference to observe
 * @param fulfilled  function to be called with the fulfilled value
 * @param rejected   function to be called with the rejection exception
 * @param progressed function to be called on any progress notifications
 * @return promise for the return value from the invoked callback
 */
Q.when = when;
function when(value, fulfilled, rejected, progressed) {
    return Q(value).then(fulfilled, rejected, progressed);
}

Promise.prototype.thenResolve = function (value) {
    return this.then(function () { return value; });
};

Q.thenResolve = function (promise, value) {
    return Q(promise).thenResolve(value);
};

Promise.prototype.thenReject = function (reason) {
    return this.then(function () { throw reason; });
};

Q.thenReject = function (promise, reason) {
    return Q(promise).thenReject(reason);
};

/**
 * If an object is not a promise, it is as "near" as possible.
 * If a promise is rejected, it is as "near" as possible too.
 * If it’s a fulfilled promise, the fulfillment value is nearer.
 * If it’s a deferred promise and the deferred has been resolved, the
 * resolution is "nearer".
 * @param object
 * @returns most resolved (nearest) form of the object
 */

// XXX should we re-do this?
Q.nearer = nearer;
function nearer(value) {
    if (isPromise(value)) {
        var inspected = value.inspect();
        if (inspected.state === "fulfilled") {
            return inspected.value;
        }
    }
    return value;
}

/**
 * @returns whether the given object is a promise.
 * Otherwise it is a fulfilled value.
 */
Q.isPromise = isPromise;
function isPromise(object) {
    return isObject(object) &&
        typeof object.promiseDispatch === "function" &&
        typeof object.inspect === "function";
}

Q.isPromiseAlike = isPromiseAlike;
function isPromiseAlike(object) {
    return isObject(object) && typeof object.then === "function";
}

/**
 * @returns whether the given object is a pending promise, meaning not
 * fulfilled or rejected.
 */
Q.isPending = isPending;
function isPending(object) {
    return isPromise(object) && object.inspect().state === "pending";
}

Promise.prototype.isPending = function () {
    return this.inspect().state === "pending";
};

/**
 * @returns whether the given object is a value or fulfilled
 * promise.
 */
Q.isFulfilled = isFulfilled;
function isFulfilled(object) {
    return !isPromise(object) || object.inspect().state === "fulfilled";
}

Promise.prototype.isFulfilled = function () {
    return this.inspect().state === "fulfilled";
};

/**
 * @returns whether the given object is a rejected promise.
 */
Q.isRejected = isRejected;
function isRejected(object) {
    return isPromise(object) && object.inspect().state === "rejected";
}

Promise.prototype.isRejected = function () {
    return this.inspect().state === "rejected";
};

//// BEGIN UNHANDLED REJECTION TRACKING

// This promise library consumes exceptions thrown in handlers so they can be
// handled by a subsequent promise.  The exceptions get added to this array when
// they are created, and removed when they are handled.  Note that in ES6 or
// shimmed environments, this would naturally be a `Set`.
var unhandledReasons = [];
var unhandledRejections = [];
var unhandledReasonsDisplayed = false;
var trackUnhandledRejections = true;
function displayUnhandledReasons() {
    if (
        !unhandledReasonsDisplayed &&
        typeof window !== "undefined" &&
        !window.Touch &&
        window.console
    ) {
        console.warn("[Q] Unhandled rejection reasons (should be empty):",
                     unhandledReasons);
    }

    unhandledReasonsDisplayed = true;
}

function logUnhandledReasons() {
    for (var i = 0; i < unhandledReasons.length; i++) {
        var reason = unhandledReasons[i];
        console.warn("Unhandled rejection reason:", reason);
    }
}

function resetUnhandledRejections() {
    unhandledReasons.length = 0;
    unhandledRejections.length = 0;
    unhandledReasonsDisplayed = false;

    if (!trackUnhandledRejections) {
        trackUnhandledRejections = true;

        // Show unhandled rejection reasons if Node exits without handling an
        // outstanding rejection.  (Note that Browserify presently produces a
        // `process` global without the `EventEmitter` `on` method.)
        if (typeof process !== "undefined" && process.on) {
            process.on("exit", logUnhandledReasons);
        }
    }
}

function trackRejection(promise, reason) {
    if (!trackUnhandledRejections) {
        return;
    }

    unhandledRejections.push(promise);
    if (reason && typeof reason.stack !== "undefined") {
        unhandledReasons.push(reason.stack);
    } else {
        unhandledReasons.push("(no stack) " + reason);
    }
    displayUnhandledReasons();
}

function untrackRejection(promise) {
    if (!trackUnhandledRejections) {
        return;
    }

    var at = array_indexOf(unhandledRejections, promise);
    if (at !== -1) {
        unhandledRejections.splice(at, 1);
        unhandledReasons.splice(at, 1);
    }
}

Q.resetUnhandledRejections = resetUnhandledRejections;

Q.getUnhandledReasons = function () {
    // Make a copy so that consumers can't interfere with our internal state.
    return unhandledReasons.slice();
};

Q.stopUnhandledRejectionTracking = function () {
    resetUnhandledRejections();
    if (typeof process !== "undefined" && process.on) {
        process.removeListener("exit", logUnhandledReasons);
    }
    trackUnhandledRejections = false;
};

resetUnhandledRejections();

//// END UNHANDLED REJECTION TRACKING

/**
 * Constructs a rejected promise.
 * @param reason value describing the failure
 */
Q.reject = reject;
function reject(reason) {
    var rejection = Promise({
        "when": function (rejected) {
            // note that the error has been handled
            if (rejected) {
                untrackRejection(this);
            }
            return rejected ? rejected(reason) : this;
        }
    }, function fallback() {
        return this;
    }, function inspect() {
        return { state: "rejected", reason: reason };
    });

    // Note that the reason has not been handled.
    trackRejection(rejection, reason);

    return rejection;
}

/**
 * Constructs a fulfilled promise for an immediate reference.
 * @param value immediate reference
 */
Q.fulfill = fulfill;
function fulfill(value) {
    return Promise({
        "when": function () {
            return value;
        },
        "get": function (name) {
            return value[name];
        },
        "set": function (name, rhs) {
            value[name] = rhs;
        },
        "delete": function (name) {
            delete value[name];
        },
        "post": function (name, args) {
            // Mark Miller proposes that post with no name should apply a
            // promised function.
            if (name === null || name === void 0) {
                return value.apply(void 0, args);
            } else {
                return value[name].apply(value, args);
            }
        },
        "apply": function (thisp, args) {
            return value.apply(thisp, args);
        },
        "keys": function () {
            return object_keys(value);
        }
    }, void 0, function inspect() {
        return { state: "fulfilled", value: value };
    });
}

/**
 * Converts thenables to Q promises.
 * @param promise thenable promise
 * @returns a Q promise
 */
function coerce(promise) {
    var deferred = defer();
    nextTick(function () {
        try {
            promise.then(deferred.resolve, deferred.reject, deferred.notify);
        } catch (exception) {
            deferred.reject(exception);
        }
    });
    return deferred.promise;
}

/**
 * Annotates an object such that it will never be
 * transferred away from this process over any promise
 * communication channel.
 * @param object
 * @returns promise a wrapping of that object that
 * additionally responds to the "isDef" message
 * without a rejection.
 */
Q.master = master;
function master(object) {
    return Promise({
        "isDef": function () {}
    }, function fallback(op, args) {
        return dispatch(object, op, args);
    }, function () {
        return Q(object).inspect();
    });
}

/**
 * Spreads the values of a promised array of arguments into the
 * fulfillment callback.
 * @param fulfilled callback that receives variadic arguments from the
 * promised array
 * @param rejected callback that receives the exception if the promise
 * is rejected.
 * @returns a promise for the return value or thrown exception of
 * either callback.
 */
Q.spread = spread;
function spread(value, fulfilled, rejected) {
    return Q(value).spread(fulfilled, rejected);
}

Promise.prototype.spread = function (fulfilled, rejected) {
    return this.all().then(function (array) {
        return fulfilled.apply(void 0, array);
    }, rejected);
};

/**
 * The async function is a decorator for generator functions, turning
 * them into asynchronous generators.  Although generators are only part
 * of the newest ECMAScript 6 drafts, this code does not cause syntax
 * errors in older engines.  This code should continue to work and will
 * in fact improve over time as the language improves.
 *
 * ES6 generators are currently part of V8 version 3.19 with the
 * --harmony-generators runtime flag enabled.  SpiderMonkey has had them
 * for longer, but under an older Python-inspired form.  This function
 * works on both kinds of generators.
 *
 * Decorates a generator function such that:
 *  - it may yield promises
 *  - execution will continue when that promise is fulfilled
 *  - the value of the yield expression will be the fulfilled value
 *  - it returns a promise for the return value (when the generator
 *    stops iterating)
 *  - the decorated function returns a promise for the return value
 *    of the generator or the first rejected promise among those
 *    yielded.
 *  - if an error is thrown in the generator, it propagates through
 *    every following yield until it is caught, or until it escapes
 *    the generator function altogether, and is translated into a
 *    rejection for the promise returned by the decorated generator.
 */
Q.async = async;
function async(makeGenerator) {
    return function () {
        // when verb is "send", arg is a value
        // when verb is "throw", arg is an exception
        function continuer(verb, arg) {
            var result;
            if (hasES6Generators) {
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    return reject(exception);
                }
                if (result.done) {
                    return result.value;
                } else {
                    return when(result.value, callback, errback);
                }
            } else {
                // FIXME: Remove this case when SM does ES6 generators.
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    if (isStopIteration(exception)) {
                        return exception.value;
                    } else {
                        return reject(exception);
                    }
                }
                return when(result, callback, errback);
            }
        }
        var generator = makeGenerator.apply(this, arguments);
        var callback = continuer.bind(continuer, "next");
        var errback = continuer.bind(continuer, "throw");
        return callback();
    };
}

/**
 * The spawn function is a small wrapper around async that immediately
 * calls the generator and also ends the promise chain, so that any
 * unhandled errors are thrown instead of forwarded to the error
 * handler. This is useful because it's extremely common to run
 * generators at the top-level to work with libraries.
 */
Q.spawn = spawn;
function spawn(makeGenerator) {
    Q.done(Q.async(makeGenerator)());
}

// FIXME: Remove this interface once ES6 generators are in SpiderMonkey.
/**
 * Throws a ReturnValue exception to stop an asynchronous generator.
 *
 * This interface is a stop-gap measure to support generator return
 * values in older Firefox/SpiderMonkey.  In browsers that support ES6
 * generators like Chromium 29, just use "return" in your generator
 * functions.
 *
 * @param value the return value for the surrounding generator
 * @throws ReturnValue exception with the value.
 * @example
 * // ES6 style
 * Q.async(function* () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      return foo + bar;
 * })
 * // Older SpiderMonkey style
 * Q.async(function () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      Q.return(foo + bar);
 * })
 */
Q["return"] = _return;
function _return(value) {
    throw new QReturnValue(value);
}

/**
 * The promised function decorator ensures that any promise arguments
 * are settled and passed as values (`this` is also settled and passed
 * as a value).  It will also ensure that the result of a function is
 * always a promise.
 *
 * @example
 * var add = Q.promised(function (a, b) {
 *     return a + b;
 * });
 * add(Q(a), Q(B));
 *
 * @param {function} callback The function to decorate
 * @returns {function} a function that has been decorated.
 */
Q.promised = promised;
function promised(callback) {
    return function () {
        return spread([this, all(arguments)], function (self, args) {
            return callback.apply(self, args);
        });
    };
}

/**
 * sends a message to a value in a future turn
 * @param object* the recipient
 * @param op the name of the message operation, e.g., "when",
 * @param args further arguments to be forwarded to the operation
 * @returns result {Promise} a promise for the result of the operation
 */
Q.dispatch = dispatch;
function dispatch(object, op, args) {
    return Q(object).dispatch(op, args);
}

Promise.prototype.dispatch = function (op, args) {
    var self = this;
    var deferred = defer();
    nextTick(function () {
        self.promiseDispatch(deferred.resolve, op, args);
    });
    return deferred.promise;
};

/**
 * Gets the value of a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to get
 * @return promise for the property value
 */
Q.get = function (object, key) {
    return Q(object).dispatch("get", [key]);
};

Promise.prototype.get = function (key) {
    return this.dispatch("get", [key]);
};

/**
 * Sets the value of a property in a future turn.
 * @param object    promise or immediate reference for object object
 * @param name      name of property to set
 * @param value     new value of property
 * @return promise for the return value
 */
Q.set = function (object, key, value) {
    return Q(object).dispatch("set", [key, value]);
};

Promise.prototype.set = function (key, value) {
    return this.dispatch("set", [key, value]);
};

/**
 * Deletes a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to delete
 * @return promise for the return value
 */
Q.del = // XXX legacy
Q["delete"] = function (object, key) {
    return Q(object).dispatch("delete", [key]);
};

Promise.prototype.del = // XXX legacy
Promise.prototype["delete"] = function (key) {
    return this.dispatch("delete", [key]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param value     a value to post, typically an array of
 *                  invocation arguments for promises that
 *                  are ultimately backed with `resolve` values,
 *                  as opposed to those backed with URLs
 *                  wherein the posted value can be any
 *                  JSON serializable object.
 * @return promise for the return value
 */
// bound locally because it is used by other methods
Q.mapply = // XXX As proposed by "Redsandro"
Q.post = function (object, name, args) {
    return Q(object).dispatch("post", [name, args]);
};

Promise.prototype.mapply = // XXX As proposed by "Redsandro"
Promise.prototype.post = function (name, args) {
    return this.dispatch("post", [name, args]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param ...args   array of invocation arguments
 * @return promise for the return value
 */
Q.send = // XXX Mark Miller's proposed parlance
Q.mcall = // XXX As proposed by "Redsandro"
Q.invoke = function (object, name /*...args*/) {
    return Q(object).dispatch("post", [name, array_slice(arguments, 2)]);
};

Promise.prototype.send = // XXX Mark Miller's proposed parlance
Promise.prototype.mcall = // XXX As proposed by "Redsandro"
Promise.prototype.invoke = function (name /*...args*/) {
    return this.dispatch("post", [name, array_slice(arguments, 1)]);
};

/**
 * Applies the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param args      array of application arguments
 */
Q.fapply = function (object, args) {
    return Q(object).dispatch("apply", [void 0, args]);
};

Promise.prototype.fapply = function (args) {
    return this.dispatch("apply", [void 0, args]);
};

/**
 * Calls the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q["try"] =
Q.fcall = function (object /* ...args*/) {
    return Q(object).dispatch("apply", [void 0, array_slice(arguments, 1)]);
};

Promise.prototype.fcall = function (/*...args*/) {
    return this.dispatch("apply", [void 0, array_slice(arguments)]);
};

/**
 * Binds the promised function, transforming return values into a fulfilled
 * promise and thrown errors into a rejected one.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q.fbind = function (object /*...args*/) {
    var promise = Q(object);
    var args = array_slice(arguments, 1);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};
Promise.prototype.fbind = function (/*...args*/) {
    var promise = this;
    var args = array_slice(arguments);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};

/**
 * Requests the names of the owned properties of a promised
 * object in a future turn.
 * @param object    promise or immediate reference for target object
 * @return promise for the keys of the eventually settled object
 */
Q.keys = function (object) {
    return Q(object).dispatch("keys", []);
};

Promise.prototype.keys = function () {
    return this.dispatch("keys", []);
};

/**
 * Turns an array of promises into a promise for an array.  If any of
 * the promises gets rejected, the whole array is rejected immediately.
 * @param {Array*} an array (or promise for an array) of values (or
 * promises for values)
 * @returns a promise for an array of the corresponding values
 */
// By Mark Miller
// http://wiki.ecmascript.org/doku.php?id=strawman:concurrency&rev=1308776521#allfulfilled
Q.all = all;
function all(promises) {
    return when(promises, function (promises) {
        var countDown = 0;
        var deferred = defer();
        array_reduce(promises, function (undefined, promise, index) {
            var snapshot;
            if (
                isPromise(promise) &&
                (snapshot = promise.inspect()).state === "fulfilled"
            ) {
                promises[index] = snapshot.value;
            } else {
                ++countDown;
                when(
                    promise,
                    function (value) {
                        promises[index] = value;
                        if (--countDown === 0) {
                            deferred.resolve(promises);
                        }
                    },
                    deferred.reject,
                    function (progress) {
                        deferred.notify({ index: index, value: progress });
                    }
                );
            }
        }, void 0);
        if (countDown === 0) {
            deferred.resolve(promises);
        }
        return deferred.promise;
    });
}

Promise.prototype.all = function () {
    return all(this);
};

/**
 * Waits for all promises to be settled, either fulfilled or
 * rejected.  This is distinct from `all` since that would stop
 * waiting at the first rejection.  The promise returned by
 * `allResolved` will never be rejected.
 * @param promises a promise for an array (or an array) of promises
 * (or values)
 * @return a promise for an array of promises
 */
Q.allResolved = deprecate(allResolved, "allResolved", "allSettled");
function allResolved(promises) {
    return when(promises, function (promises) {
        promises = array_map(promises, Q);
        return when(all(array_map(promises, function (promise) {
            return when(promise, noop, noop);
        })), function () {
            return promises;
        });
    });
}

Promise.prototype.allResolved = function () {
    return allResolved(this);
};

/**
 * @see Promise#allSettled
 */
Q.allSettled = allSettled;
function allSettled(promises) {
    return Q(promises).allSettled();
}

/**
 * Turns an array of promises into a promise for an array of their states (as
 * returned by `inspect`) when they have all settled.
 * @param {Array[Any*]} values an array (or promise for an array) of values (or
 * promises for values)
 * @returns {Array[State]} an array of states for the respective values.
 */
Promise.prototype.allSettled = function () {
    return this.then(function (promises) {
        return all(array_map(promises, function (promise) {
            promise = Q(promise);
            function regardless() {
                return promise.inspect();
            }
            return promise.then(regardless, regardless);
        }));
    });
};

/**
 * Captures the failure of a promise, giving an oportunity to recover
 * with a callback.  If the given promise is fulfilled, the returned
 * promise is fulfilled.
 * @param {Any*} promise for something
 * @param {Function} callback to fulfill the returned promise if the
 * given promise is rejected
 * @returns a promise for the return value of the callback
 */
Q.fail = // XXX legacy
Q["catch"] = function (object, rejected) {
    return Q(object).then(void 0, rejected);
};

Promise.prototype.fail = // XXX legacy
Promise.prototype["catch"] = function (rejected) {
    return this.then(void 0, rejected);
};

/**
 * Attaches a listener that can respond to progress notifications from a
 * promise's originating deferred. This listener receives the exact arguments
 * passed to ``deferred.notify``.
 * @param {Any*} promise for something
 * @param {Function} callback to receive any progress notifications
 * @returns the given promise, unchanged
 */
Q.progress = progress;
function progress(object, progressed) {
    return Q(object).then(void 0, void 0, progressed);
}

Promise.prototype.progress = function (progressed) {
    return this.then(void 0, void 0, progressed);
};

/**
 * Provides an opportunity to observe the settling of a promise,
 * regardless of whether the promise is fulfilled or rejected.  Forwards
 * the resolution to the returned promise when the callback is done.
 * The callback can return a promise to defer completion.
 * @param {Any*} promise
 * @param {Function} callback to observe the resolution of the given
 * promise, takes no arguments.
 * @returns a promise for the resolution of the given promise when
 * ``fin`` is done.
 */
Q.fin = // XXX legacy
Q["finally"] = function (object, callback) {
    return Q(object)["finally"](callback);
};

Promise.prototype.fin = // XXX legacy
Promise.prototype["finally"] = function (callback) {
    callback = Q(callback);
    return this.then(function (value) {
        return callback.fcall().then(function () {
            return value;
        });
    }, function (reason) {
        // TODO attempt to recycle the rejection with "this".
        return callback.fcall().then(function () {
            throw reason;
        });
    });
};

/**
 * Terminates a chain of promises, forcing rejections to be
 * thrown as exceptions.
 * @param {Any*} promise at the end of a chain of promises
 * @returns nothing
 */
Q.done = function (object, fulfilled, rejected, progress) {
    return Q(object).done(fulfilled, rejected, progress);
};

Promise.prototype.done = function (fulfilled, rejected, progress) {
    var onUnhandledError = function (error) {
        // forward to a future turn so that ``when``
        // does not catch it and turn it into a rejection.
        nextTick(function () {
            makeStackTraceLong(error, promise);
            if (Q.onerror) {
                Q.onerror(error);
            } else {
                throw error;
            }
        });
    };

    // Avoid unnecessary `nextTick`ing via an unnecessary `when`.
    var promise = fulfilled || rejected || progress ?
        this.then(fulfilled, rejected, progress) :
        this;

    if (typeof process === "object" && process && process.domain) {
        onUnhandledError = process.domain.bind(onUnhandledError);
    }

    promise.then(void 0, onUnhandledError);
};

/**
 * Causes a promise to be rejected if it does not get fulfilled before
 * some milliseconds time out.
 * @param {Any*} promise
 * @param {Number} milliseconds timeout
 * @param {String} custom error message (optional)
 * @returns a promise for the resolution of the given promise if it is
 * fulfilled before the timeout, otherwise rejected.
 */
Q.timeout = function (object, ms, message) {
    return Q(object).timeout(ms, message);
};

Promise.prototype.timeout = function (ms, message) {
    var deferred = defer();
    var timeoutId = setTimeout(function () {
        deferred.reject(new Error(message || "Timed out after " + ms + " ms"));
    }, ms);

    this.then(function (value) {
        clearTimeout(timeoutId);
        deferred.resolve(value);
    }, function (exception) {
        clearTimeout(timeoutId);
        deferred.reject(exception);
    }, deferred.notify);

    return deferred.promise;
};

/**
 * Returns a promise for the given value (or promised value), some
 * milliseconds after it resolved. Passes rejections immediately.
 * @param {Any*} promise
 * @param {Number} milliseconds
 * @returns a promise for the resolution of the given promise after milliseconds
 * time has elapsed since the resolution of the given promise.
 * If the given promise rejects, that is passed immediately.
 */
Q.delay = function (object, timeout) {
    if (timeout === void 0) {
        timeout = object;
        object = void 0;
    }
    return Q(object).delay(timeout);
};

Promise.prototype.delay = function (timeout) {
    return this.then(function (value) {
        var deferred = defer();
        setTimeout(function () {
            deferred.resolve(value);
        }, timeout);
        return deferred.promise;
    });
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided as an array, and returns a promise.
 *
 *      Q.nfapply(FS.readFile, [__filename])
 *      .then(function (content) {
 *      })
 *
 */
Q.nfapply = function (callback, args) {
    return Q(callback).nfapply(args);
};

Promise.prototype.nfapply = function (args) {
    var deferred = defer();
    var nodeArgs = array_slice(args);
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided individually, and returns a promise.
 * @example
 * Q.nfcall(FS.readFile, __filename)
 * .then(function (content) {
 * })
 *
 */
Q.nfcall = function (callback /*...args*/) {
    var args = array_slice(arguments, 1);
    return Q(callback).nfapply(args);
};

Promise.prototype.nfcall = function (/*...args*/) {
    var nodeArgs = array_slice(arguments);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Wraps a NodeJS continuation passing function and returns an equivalent
 * version that returns a promise.
 * @example
 * Q.nfbind(FS.readFile, __filename)("utf-8")
 * .then(console.log)
 * .done()
 */
Q.nfbind =
Q.denodeify = function (callback /*...args*/) {
    var baseArgs = array_slice(arguments, 1);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        Q(callback).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nfbind =
Promise.prototype.denodeify = function (/*...args*/) {
    var args = array_slice(arguments);
    args.unshift(this);
    return Q.denodeify.apply(void 0, args);
};

Q.nbind = function (callback, thisp /*...args*/) {
    var baseArgs = array_slice(arguments, 2);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        function bound() {
            return callback.apply(thisp, arguments);
        }
        Q(bound).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nbind = function (/*thisp, ...args*/) {
    var args = array_slice(arguments, 0);
    args.unshift(this);
    return Q.nbind.apply(void 0, args);
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback with a given array of arguments, plus a provided callback.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param {Array} args arguments to pass to the method; the callback
 * will be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nmapply = // XXX As proposed by "Redsandro"
Q.npost = function (object, name, args) {
    return Q(object).npost(name, args);
};

Promise.prototype.nmapply = // XXX As proposed by "Redsandro"
Promise.prototype.npost = function (name, args) {
    var nodeArgs = array_slice(args || []);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback, forwarding the given variadic arguments, plus a provided
 * callback argument.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param ...args arguments to pass to the method; the callback will
 * be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nsend = // XXX Based on Mark Miller's proposed "send"
Q.nmcall = // XXX Based on "Redsandro's" proposal
Q.ninvoke = function (object, name /*...args*/) {
    var nodeArgs = array_slice(arguments, 2);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    Q(object).dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

Promise.prototype.nsend = // XXX Based on Mark Miller's proposed "send"
Promise.prototype.nmcall = // XXX Based on "Redsandro's" proposal
Promise.prototype.ninvoke = function (name /*...args*/) {
    var nodeArgs = array_slice(arguments, 1);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * If a function would like to support both Node continuation-passing-style and
 * promise-returning-style, it can end its internal promise chain with
 * `nodeify(nodeback)`, forwarding the optional nodeback argument.  If the user
 * elects to use a nodeback, the result will be sent there.  If they do not
 * pass a nodeback, they will receive the result promise.
 * @param object a result (or a promise for a result)
 * @param {Function} nodeback a Node.js-style callback
 * @returns either the promise or nothing
 */
Q.nodeify = nodeify;
function nodeify(object, nodeback) {
    return Q(object).nodeify(nodeback);
}

Promise.prototype.nodeify = function (nodeback) {
    if (nodeback) {
        this.then(function (value) {
            nextTick(function () {
                nodeback(null, value);
            });
        }, function (error) {
            nextTick(function () {
                nodeback(error);
            });
        });
    } else {
        return this;
    }
};

// All code before this point will be filtered from stack traces.
var qEndingLine = captureLine();

return Q;

});

},{}],101:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],102:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],103:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":101,"./encode":102}],104:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

'use strict';

/*<replacement>*/

var processNextTick = require('process-nextick-args');
/*</replacement>*/

/*<replacement>*/
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) {
    keys.push(key);
  }return keys;
};
/*</replacement>*/

module.exports = Duplex;

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

var keys = objectKeys(Writable.prototype);
for (var v = 0; v < keys.length; v++) {
  var method = keys[v];
  if (!Duplex.prototype[method]) Duplex.prototype[method] = Writable.prototype[method];
}

function Duplex(options) {
  if (!(this instanceof Duplex)) return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false) this.readable = false;

  if (options && options.writable === false) this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false) this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended) return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  processNextTick(onEndNT, this);
}

function onEndNT(self) {
  self.end();
}

Object.defineProperty(Duplex.prototype, 'destroyed', {
  get: function () {
    if (this._readableState === undefined || this._writableState === undefined) {
      return false;
    }
    return this._readableState.destroyed && this._writableState.destroyed;
  },
  set: function (value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (this._readableState === undefined || this._writableState === undefined) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._readableState.destroyed = value;
    this._writableState.destroyed = value;
  }
});

Duplex.prototype._destroy = function (err, cb) {
  this.push(null);
  this.end();

  processNextTick(cb, err);
};

function forEach(xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}
},{"./_stream_readable":106,"./_stream_writable":108,"core-util-is":28,"inherits":36,"process-nextick-args":97}],105:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

'use strict';

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough)) return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function (chunk, encoding, cb) {
  cb(null, chunk);
};
},{"./_stream_transform":107,"core-util-is":28,"inherits":36}],106:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

/*<replacement>*/

var processNextTick = require('process-nextick-args');
/*</replacement>*/

module.exports = Readable;

/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/

/*<replacement>*/
var Duplex;
/*</replacement>*/

Readable.ReadableState = ReadableState;

/*<replacement>*/
var EE = require('events').EventEmitter;

var EElistenerCount = function (emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

/*<replacement>*/
var Stream = require('./internal/streams/stream');
/*</replacement>*/

// TODO(bmeurer): Change this back to const once hole checks are
// properly optimized away early in Ignition+TurboFan.
/*<replacement>*/
var Buffer = require('safe-buffer').Buffer;
var OurUint8Array = global.Uint8Array || function () {};
function _uint8ArrayToBuffer(chunk) {
  return Buffer.from(chunk);
}
function _isUint8Array(obj) {
  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
}
/*</replacement>*/

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

/*<replacement>*/
var debugUtil = require('util');
var debug = void 0;
if (debugUtil && debugUtil.debuglog) {
  debug = debugUtil.debuglog('stream');
} else {
  debug = function () {};
}
/*</replacement>*/

var BufferList = require('./internal/streams/BufferList');
var destroyImpl = require('./internal/streams/destroy');
var StringDecoder;

util.inherits(Readable, Stream);

var kProxyEvents = ['error', 'close', 'destroy', 'pause', 'resume'];

function prependListener(emitter, event, fn) {
  // Sadly this is not cacheable as some libraries bundle their own
  // event emitter implementation with them.
  if (typeof emitter.prependListener === 'function') {
    return emitter.prependListener(event, fn);
  } else {
    // This is a hack to make sure that our error handler is attached before any
    // userland ones.  NEVER DO THIS. This is here only because this code needs
    // to continue to work with older versions of Node.js that do not include
    // the prependListener() method. The goal is to eventually remove this hack.
    if (!emitter._events || !emitter._events[event]) emitter.on(event, fn);else if (isArray(emitter._events[event])) emitter._events[event].unshift(fn);else emitter._events[event] = [fn, emitter._events[event]];
  }
}

function ReadableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.readableObjectMode;

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = Math.floor(this.highWaterMark);

  // A linked list is used to store data chunks instead of an array because the
  // linked list can remove elements from the beginning faster than
  // array.shift()
  this.buffer = new BufferList();
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the event 'readable'/'data' is emitted
  // immediately, or on a later tick.  We set this to true at first, because
  // any actions that shouldn't happen until "later" should generally also
  // not happen before the first read call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;
  this.resumeScheduled = false;

  // has it been destroyed
  this.destroyed = false;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  if (!(this instanceof Readable)) return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  if (options) {
    if (typeof options.read === 'function') this._read = options.read;

    if (typeof options.destroy === 'function') this._destroy = options.destroy;
  }

  Stream.call(this);
}

Object.defineProperty(Readable.prototype, 'destroyed', {
  get: function () {
    if (this._readableState === undefined) {
      return false;
    }
    return this._readableState.destroyed;
  },
  set: function (value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (!this._readableState) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._readableState.destroyed = value;
  }
});

Readable.prototype.destroy = destroyImpl.destroy;
Readable.prototype._undestroy = destroyImpl.undestroy;
Readable.prototype._destroy = function (err, cb) {
  this.push(null);
  cb(err);
};

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function (chunk, encoding) {
  var state = this._readableState;
  var skipChunkCheck;

  if (!state.objectMode) {
    if (typeof chunk === 'string') {
      encoding = encoding || state.defaultEncoding;
      if (encoding !== state.encoding) {
        chunk = Buffer.from(chunk, encoding);
        encoding = '';
      }
      skipChunkCheck = true;
    }
  } else {
    skipChunkCheck = true;
  }

  return readableAddChunk(this, chunk, encoding, false, skipChunkCheck);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function (chunk) {
  return readableAddChunk(this, chunk, null, true, false);
};

function readableAddChunk(stream, chunk, encoding, addToFront, skipChunkCheck) {
  var state = stream._readableState;
  if (chunk === null) {
    state.reading = false;
    onEofChunk(stream, state);
  } else {
    var er;
    if (!skipChunkCheck) er = chunkInvalid(state, chunk);
    if (er) {
      stream.emit('error', er);
    } else if (state.objectMode || chunk && chunk.length > 0) {
      if (typeof chunk !== 'string' && !state.objectMode && Object.getPrototypeOf(chunk) !== Buffer.prototype) {
        chunk = _uint8ArrayToBuffer(chunk);
      }

      if (addToFront) {
        if (state.endEmitted) stream.emit('error', new Error('stream.unshift() after end event'));else addChunk(stream, state, chunk, true);
      } else if (state.ended) {
        stream.emit('error', new Error('stream.push() after EOF'));
      } else {
        state.reading = false;
        if (state.decoder && !encoding) {
          chunk = state.decoder.write(chunk);
          if (state.objectMode || chunk.length !== 0) addChunk(stream, state, chunk, false);else maybeReadMore(stream, state);
        } else {
          addChunk(stream, state, chunk, false);
        }
      }
    } else if (!addToFront) {
      state.reading = false;
    }
  }

  return needMoreData(state);
}

function addChunk(stream, state, chunk, addToFront) {
  if (state.flowing && state.length === 0 && !state.sync) {
    stream.emit('data', chunk);
    stream.read(0);
  } else {
    // update the buffer info.
    state.length += state.objectMode ? 1 : chunk.length;
    if (addToFront) state.buffer.unshift(chunk);else state.buffer.push(chunk);

    if (state.needReadable) emitReadable(stream);
  }
  maybeReadMore(stream, state);
}

function chunkInvalid(state, chunk) {
  var er;
  if (!_isUint8Array(chunk) && typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}

// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended && (state.needReadable || state.length < state.highWaterMark || state.length === 0);
}

Readable.prototype.isPaused = function () {
  return this._readableState.flowing === false;
};

// backwards compatibility.
Readable.prototype.setEncoding = function (enc) {
  if (!StringDecoder) StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};

// Don't raise the hwm > 8MB
var MAX_HWM = 0x800000;
function computeNewHighWaterMark(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2 to prevent increasing hwm excessively in
    // tiny amounts
    n--;
    n |= n >>> 1;
    n |= n >>> 2;
    n |= n >>> 4;
    n |= n >>> 8;
    n |= n >>> 16;
    n++;
  }
  return n;
}

// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function howMuchToRead(n, state) {
  if (n <= 0 || state.length === 0 && state.ended) return 0;
  if (state.objectMode) return 1;
  if (n !== n) {
    // Only flow one buffer at a time
    if (state.flowing && state.length) return state.buffer.head.data.length;else return state.length;
  }
  // If we're asking for more than the current hwm, then raise the hwm.
  if (n > state.highWaterMark) state.highWaterMark = computeNewHighWaterMark(n);
  if (n <= state.length) return n;
  // Don't have enough
  if (!state.ended) {
    state.needReadable = true;
    return 0;
  }
  return state.length;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function (n) {
  debug('read', n);
  n = parseInt(n, 10);
  var state = this._readableState;
  var nOrig = n;

  if (n !== 0) state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 && state.needReadable && (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended) endReadable(this);else emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0) endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  } else if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0) state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
    // If _read pushed data synchronously, then `reading` will be false,
    // and we need to re-evaluate how much data we can return to the user.
    if (!state.reading) n = howMuchToRead(nOrig, state);
  }

  var ret;
  if (n > 0) ret = fromList(n, state);else ret = null;

  if (ret === null) {
    state.needReadable = true;
    n = 0;
  } else {
    state.length -= n;
  }

  if (state.length === 0) {
    // If we have nothing in the buffer, then we want to know
    // as soon as we *do* get something into the buffer.
    if (!state.ended) state.needReadable = true;

    // If we tried to read() past the EOF, then emit end on the next tick.
    if (nOrig !== n && state.ended) endReadable(this);
  }

  if (ret !== null) this.emit('data', ret);

  return ret;
};

function onEofChunk(stream, state) {
  if (state.ended) return;
  if (state.decoder) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // emit 'readable' now to make sure it gets picked up.
  emitReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync) processNextTick(emitReadable_, stream);else emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}

// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    processNextTick(maybeReadMore_, stream, state);
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended && state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;else len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function (n) {
  this.emit('error', new Error('_read() is not implemented'));
};

Readable.prototype.pipe = function (dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

  var doEnd = (!pipeOpts || pipeOpts.end !== false) && dest !== process.stdout && dest !== process.stderr;

  var endFn = doEnd ? onend : unpipe;
  if (state.endEmitted) processNextTick(endFn);else src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable, unpipeInfo) {
    debug('onunpipe');
    if (readable === src) {
      if (unpipeInfo && unpipeInfo.hasUnpiped === false) {
        unpipeInfo.hasUnpiped = true;
        cleanup();
      }
    }
  }

  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  var cleanedUp = false;
  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', unpipe);
    src.removeListener('data', ondata);

    cleanedUp = true;

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain && (!dest._writableState || dest._writableState.needDrain)) ondrain();
  }

  // If the user pushes more data while we're writing to dest then we'll end up
  // in ondata again. However, we only want to increase awaitDrain once because
  // dest will only emit one 'drain' event for the multiple writes.
  // => Introduce a guard on increasing awaitDrain.
  var increasedAwaitDrain = false;
  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    increasedAwaitDrain = false;
    var ret = dest.write(chunk);
    if (false === ret && !increasedAwaitDrain) {
      // If the user unpiped during `dest.write()`, it is possible
      // to get stuck in a permanently paused state if that write
      // also returned false.
      // => Check whether `dest` is still a piping destination.
      if ((state.pipesCount === 1 && state.pipes === dest || state.pipesCount > 1 && indexOf(state.pipes, dest) !== -1) && !cleanedUp) {
        debug('false write response, pause', src._readableState.awaitDrain);
        src._readableState.awaitDrain++;
        increasedAwaitDrain = true;
      }
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EElistenerCount(dest, 'error') === 0) dest.emit('error', er);
  }

  // Make sure our error handler is attached before userland ones.
  prependListener(dest, 'error', onerror);

  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }

  return dest;
};

function pipeOnDrain(src) {
  return function () {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain) state.awaitDrain--;
    if (state.awaitDrain === 0 && EElistenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}

Readable.prototype.unpipe = function (dest) {
  var state = this._readableState;
  var unpipeInfo = { hasUnpiped: false };

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0) return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes) return this;

    if (!dest) dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest) dest.emit('unpipe', this, unpipeInfo);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;

    for (var i = 0; i < len; i++) {
      dests[i].emit('unpipe', this, unpipeInfo);
    }return this;
  }

  // try to find the right one.
  var index = indexOf(state.pipes, dest);
  if (index === -1) return this;

  state.pipes.splice(index, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1) state.pipes = state.pipes[0];

  dest.emit('unpipe', this, unpipeInfo);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function (ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  if (ev === 'data') {
    // Start flowing on next tick if stream isn't explicitly paused
    if (this._readableState.flowing !== false) this.resume();
  } else if (ev === 'readable') {
    var state = this._readableState;
    if (!state.endEmitted && !state.readableListening) {
      state.readableListening = state.needReadable = true;
      state.emittedReadable = false;
      if (!state.reading) {
        processNextTick(nReadingNextTick, this);
      } else if (state.length) {
        emitReadable(this);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

function nReadingNextTick(self) {
  debug('readable nexttick read 0');
  self.read(0);
}

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function () {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    processNextTick(resume_, stream, state);
  }
}

function resume_(stream, state) {
  if (!state.reading) {
    debug('resume read 0');
    stream.read(0);
  }

  state.resumeScheduled = false;
  state.awaitDrain = 0;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading) stream.read(0);
}

Readable.prototype.pause = function () {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};

function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  while (state.flowing && stream.read() !== null) {}
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function (stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function () {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length) self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function (chunk) {
    debug('wrapped data');
    if (state.decoder) chunk = state.decoder.write(chunk);

    // don't skip over falsy values in objectMode
    if (state.objectMode && (chunk === null || chunk === undefined)) return;else if (!state.objectMode && (!chunk || !chunk.length)) return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (this[i] === undefined && typeof stream[i] === 'function') {
      this[i] = function (method) {
        return function () {
          return stream[method].apply(stream, arguments);
        };
      }(i);
    }
  }

  // proxy certain important events.
  for (var n = 0; n < kProxyEvents.length; n++) {
    stream.on(kProxyEvents[n], self.emit.bind(self, kProxyEvents[n]));
  }

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function (n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};

// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function fromList(n, state) {
  // nothing buffered
  if (state.length === 0) return null;

  var ret;
  if (state.objectMode) ret = state.buffer.shift();else if (!n || n >= state.length) {
    // read it all, truncate the list
    if (state.decoder) ret = state.buffer.join('');else if (state.buffer.length === 1) ret = state.buffer.head.data;else ret = state.buffer.concat(state.length);
    state.buffer.clear();
  } else {
    // read part of list
    ret = fromListPartial(n, state.buffer, state.decoder);
  }

  return ret;
}

// Extracts only enough buffered data to satisfy the amount requested.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function fromListPartial(n, list, hasStrings) {
  var ret;
  if (n < list.head.data.length) {
    // slice is the same for buffers and strings
    ret = list.head.data.slice(0, n);
    list.head.data = list.head.data.slice(n);
  } else if (n === list.head.data.length) {
    // first chunk is a perfect match
    ret = list.shift();
  } else {
    // result spans more than one buffer
    ret = hasStrings ? copyFromBufferString(n, list) : copyFromBuffer(n, list);
  }
  return ret;
}

// Copies a specified amount of characters from the list of buffered data
// chunks.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function copyFromBufferString(n, list) {
  var p = list.head;
  var c = 1;
  var ret = p.data;
  n -= ret.length;
  while (p = p.next) {
    var str = p.data;
    var nb = n > str.length ? str.length : n;
    if (nb === str.length) ret += str;else ret += str.slice(0, n);
    n -= nb;
    if (n === 0) {
      if (nb === str.length) {
        ++c;
        if (p.next) list.head = p.next;else list.head = list.tail = null;
      } else {
        list.head = p;
        p.data = str.slice(nb);
      }
      break;
    }
    ++c;
  }
  list.length -= c;
  return ret;
}

// Copies a specified amount of bytes from the list of buffered data chunks.
// This function is designed to be inlinable, so please take care when making
// changes to the function body.
function copyFromBuffer(n, list) {
  var ret = Buffer.allocUnsafe(n);
  var p = list.head;
  var c = 1;
  p.data.copy(ret);
  n -= p.data.length;
  while (p = p.next) {
    var buf = p.data;
    var nb = n > buf.length ? buf.length : n;
    buf.copy(ret, ret.length - n, 0, nb);
    n -= nb;
    if (n === 0) {
      if (nb === buf.length) {
        ++c;
        if (p.next) list.head = p.next;else list.head = list.tail = null;
      } else {
        list.head = p;
        p.data = buf.slice(nb);
      }
      break;
    }
    ++c;
  }
  list.length -= c;
  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0) throw new Error('"endReadable()" called on non-empty stream');

  if (!state.endEmitted) {
    state.ended = true;
    processNextTick(endReadableNT, state, stream);
  }
}

function endReadableNT(state, stream) {
  // Check that we didn't get one last unshift.
  if (!state.endEmitted && state.length === 0) {
    state.endEmitted = true;
    stream.readable = false;
    stream.emit('end');
  }
}

function forEach(xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf(xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}
}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./_stream_duplex":104,"./internal/streams/BufferList":109,"./internal/streams/destroy":110,"./internal/streams/stream":111,"_process":98,"core-util-is":28,"events":32,"inherits":36,"isarray":38,"process-nextick-args":97,"safe-buffer":113,"string_decoder/":118,"util":23}],107:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

'use strict';

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);

function TransformState(stream) {
  this.afterTransform = function (er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
  this.writeencoding = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb) {
    return stream.emit('error', new Error('write callback called multiple times'));
  }

  ts.writechunk = null;
  ts.writecb = null;

  if (data !== null && data !== undefined) stream.push(data);

  cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}

function Transform(options) {
  if (!(this instanceof Transform)) return new Transform(options);

  Duplex.call(this, options);

  this._transformState = new TransformState(this);

  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  if (options) {
    if (typeof options.transform === 'function') this._transform = options.transform;

    if (typeof options.flush === 'function') this._flush = options.flush;
  }

  // When the writable side finishes, then flush out anything remaining.
  this.once('prefinish', function () {
    if (typeof this._flush === 'function') this._flush(function (er, data) {
      done(stream, er, data);
    });else done(stream);
  });
}

Transform.prototype.push = function (chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function (chunk, encoding, cb) {
  throw new Error('_transform() is not implemented');
};

Transform.prototype._write = function (chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform || rs.needReadable || rs.length < rs.highWaterMark) this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function (n) {
  var ts = this._transformState;

  if (ts.writechunk !== null && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};

Transform.prototype._destroy = function (err, cb) {
  var _this = this;

  Duplex.prototype._destroy.call(this, err, function (err2) {
    cb(err2);
    _this.emit('close');
  });
};

function done(stream, er, data) {
  if (er) return stream.emit('error', er);

  if (data !== null && data !== undefined) stream.push(data);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var ts = stream._transformState;

  if (ws.length) throw new Error('Calling transform done when ws.length != 0');

  if (ts.transforming) throw new Error('Calling transform done when still transforming');

  return stream.push(null);
}
},{"./_stream_duplex":104,"core-util-is":28,"inherits":36}],108:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

// A bit simpler than readable streams.
// Implement an async ._write(chunk, encoding, cb), and it'll handle all
// the drain event emission and buffering.

'use strict';

/*<replacement>*/

var processNextTick = require('process-nextick-args');
/*</replacement>*/

module.exports = Writable;

/* <replacement> */
function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
  this.next = null;
}

// It seems a linked list but it is not
// there will be only 2 of these for each stream
function CorkedRequest(state) {
  var _this = this;

  this.next = null;
  this.entry = null;
  this.finish = function () {
    onCorkedFinish(_this, state);
  };
}
/* </replacement> */

/*<replacement>*/
var asyncWrite = !process.browser && ['v0.10', 'v0.9.'].indexOf(process.version.slice(0, 5)) > -1 ? setImmediate : processNextTick;
/*</replacement>*/

/*<replacement>*/
var Duplex;
/*</replacement>*/

Writable.WritableState = WritableState;

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

/*<replacement>*/
var internalUtil = {
  deprecate: require('util-deprecate')
};
/*</replacement>*/

/*<replacement>*/
var Stream = require('./internal/streams/stream');
/*</replacement>*/

/*<replacement>*/
var Buffer = require('safe-buffer').Buffer;
var OurUint8Array = global.Uint8Array || function () {};
function _uint8ArrayToBuffer(chunk) {
  return Buffer.from(chunk);
}
function _isUint8Array(obj) {
  return Buffer.isBuffer(obj) || obj instanceof OurUint8Array;
}
/*</replacement>*/

var destroyImpl = require('./internal/streams/destroy');

util.inherits(Writable, Stream);

function nop() {}

function WritableState(options, stream) {
  Duplex = Duplex || require('./_stream_duplex');

  options = options || {};

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex) this.objectMode = this.objectMode || !!options.writableObjectMode;

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var defaultHwm = this.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = hwm || hwm === 0 ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = Math.floor(this.highWaterMark);

  // if _final has been called
  this.finalCalled = false;

  // drain event flag.
  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // has it been destroyed
  this.destroyed = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function (er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.bufferedRequest = null;
  this.lastBufferedRequest = null;

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;

  // count buffered requests
  this.bufferedRequestCount = 0;

  // allocate the first CorkedRequest, there is always
  // one allocated and free to use, and we maintain at most two
  this.corkedRequestsFree = new CorkedRequest(this);
}

WritableState.prototype.getBuffer = function getBuffer() {
  var current = this.bufferedRequest;
  var out = [];
  while (current) {
    out.push(current);
    current = current.next;
  }
  return out;
};

(function () {
  try {
    Object.defineProperty(WritableState.prototype, 'buffer', {
      get: internalUtil.deprecate(function () {
        return this.getBuffer();
      }, '_writableState.buffer is deprecated. Use _writableState.getBuffer ' + 'instead.', 'DEP0003')
    });
  } catch (_) {}
})();

// Test _writableState for inheritance to account for Duplex streams,
// whose prototype chain only points to Readable.
var realHasInstance;
if (typeof Symbol === 'function' && Symbol.hasInstance && typeof Function.prototype[Symbol.hasInstance] === 'function') {
  realHasInstance = Function.prototype[Symbol.hasInstance];
  Object.defineProperty(Writable, Symbol.hasInstance, {
    value: function (object) {
      if (realHasInstance.call(this, object)) return true;

      return object && object._writableState instanceof WritableState;
    }
  });
} else {
  realHasInstance = function (object) {
    return object instanceof this;
  };
}

function Writable(options) {
  Duplex = Duplex || require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, too.
  // `realHasInstance` is necessary because using plain `instanceof`
  // would return false, as no `_writableState` property is attached.

  // Trying to use the custom `instanceof` for Writable here will also break the
  // Node.js LazyTransform implementation, which has a non-trivial getter for
  // `_writableState` that would lead to infinite recursion.
  if (!realHasInstance.call(Writable, this) && !(this instanceof Duplex)) {
    return new Writable(options);
  }

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  if (options) {
    if (typeof options.write === 'function') this._write = options.write;

    if (typeof options.writev === 'function') this._writev = options.writev;

    if (typeof options.destroy === 'function') this._destroy = options.destroy;

    if (typeof options.final === 'function') this._final = options.final;
  }

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function () {
  this.emit('error', new Error('Cannot pipe, not readable'));
};

function writeAfterEnd(stream, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  processNextTick(cb, er);
}

// Checks that a user-supplied chunk is valid, especially for the particular
// mode the stream is in. Currently this means that `null` is never accepted
// and undefined/non-string values are only allowed in object mode.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  var er = false;

  if (chunk === null) {
    er = new TypeError('May not write null values to stream');
  } else if (typeof chunk !== 'string' && chunk !== undefined && !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  if (er) {
    stream.emit('error', er);
    processNextTick(cb, er);
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function (chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;
  var isBuf = _isUint8Array(chunk) && !state.objectMode;

  if (isBuf && !Buffer.isBuffer(chunk)) {
    chunk = _uint8ArrayToBuffer(chunk);
  }

  if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (isBuf) encoding = 'buffer';else if (!encoding) encoding = state.defaultEncoding;

  if (typeof cb !== 'function') cb = nop;

  if (state.ended) writeAfterEnd(this, cb);else if (isBuf || validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, isBuf, chunk, encoding, cb);
  }

  return ret;
};

Writable.prototype.cork = function () {
  var state = this._writableState;

  state.corked++;
};

Writable.prototype.uncork = function () {
  var state = this._writableState;

  if (state.corked) {
    state.corked--;

    if (!state.writing && !state.corked && !state.finished && !state.bufferProcessing && state.bufferedRequest) clearBuffer(this, state);
  }
};

Writable.prototype.setDefaultEncoding = function setDefaultEncoding(encoding) {
  // node::ParseEncoding() requires lower case.
  if (typeof encoding === 'string') encoding = encoding.toLowerCase();
  if (!(['hex', 'utf8', 'utf-8', 'ascii', 'binary', 'base64', 'ucs2', 'ucs-2', 'utf16le', 'utf-16le', 'raw'].indexOf((encoding + '').toLowerCase()) > -1)) throw new TypeError('Unknown encoding: ' + encoding);
  this._writableState.defaultEncoding = encoding;
  return this;
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode && state.decodeStrings !== false && typeof chunk === 'string') {
    chunk = Buffer.from(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, isBuf, chunk, encoding, cb) {
  if (!isBuf) {
    var newChunk = decodeChunk(state, chunk, encoding);
    if (chunk !== newChunk) {
      isBuf = true;
      encoding = 'buffer';
      chunk = newChunk;
    }
  }
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret) state.needDrain = true;

  if (state.writing || state.corked) {
    var last = state.lastBufferedRequest;
    state.lastBufferedRequest = {
      chunk: chunk,
      encoding: encoding,
      isBuf: isBuf,
      callback: cb,
      next: null
    };
    if (last) {
      last.next = state.lastBufferedRequest;
    } else {
      state.bufferedRequest = state.lastBufferedRequest;
    }
    state.bufferedRequestCount += 1;
  } else {
    doWrite(stream, state, false, len, chunk, encoding, cb);
  }

  return ret;
}

function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev) stream._writev(chunk, state.onwrite);else stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  --state.pendingcb;

  if (sync) {
    // defer the callback if we are being called synchronously
    // to avoid piling up things on the stack
    processNextTick(cb, er);
    // this can emit finish, and it will always happen
    // after error
    processNextTick(finishMaybe, stream, state);
    stream._writableState.errorEmitted = true;
    stream.emit('error', er);
  } else {
    // the caller expect this to happen before if
    // it is async
    cb(er);
    stream._writableState.errorEmitted = true;
    stream.emit('error', er);
    // this can emit finish, but finish must
    // always follow error
    finishMaybe(stream, state);
  }
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er) onwriteError(stream, state, sync, er, cb);else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(state);

    if (!finished && !state.corked && !state.bufferProcessing && state.bufferedRequest) {
      clearBuffer(stream, state);
    }

    if (sync) {
      /*<replacement>*/
      asyncWrite(afterWrite, stream, state, finished, cb);
      /*</replacement>*/
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished) onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}

// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;
  var entry = state.bufferedRequest;

  if (stream._writev && entry && entry.next) {
    // Fast case, write everything using _writev()
    var l = state.bufferedRequestCount;
    var buffer = new Array(l);
    var holder = state.corkedRequestsFree;
    holder.entry = entry;

    var count = 0;
    var allBuffers = true;
    while (entry) {
      buffer[count] = entry;
      if (!entry.isBuf) allBuffers = false;
      entry = entry.next;
      count += 1;
    }
    buffer.allBuffers = allBuffers;

    doWrite(stream, state, true, state.length, buffer, '', holder.finish);

    // doWrite is almost always async, defer these to save a bit of time
    // as the hot path ends with doWrite
    state.pendingcb++;
    state.lastBufferedRequest = null;
    if (holder.next) {
      state.corkedRequestsFree = holder.next;
      holder.next = null;
    } else {
      state.corkedRequestsFree = new CorkedRequest(state);
    }
  } else {
    // Slow case, write chunks one-by-one
    while (entry) {
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, false, len, chunk, encoding, cb);
      entry = entry.next;
      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        break;
      }
    }

    if (entry === null) state.lastBufferedRequest = null;
  }

  state.bufferedRequestCount = 0;
  state.bufferedRequest = entry;
  state.bufferProcessing = false;
}

Writable.prototype._write = function (chunk, encoding, cb) {
  cb(new Error('_write() is not implemented'));
};

Writable.prototype._writev = null;

Writable.prototype.end = function (chunk, encoding, cb) {
  var state = this._writableState;

  if (typeof chunk === 'function') {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (typeof encoding === 'function') {
    cb = encoding;
    encoding = null;
  }

  if (chunk !== null && chunk !== undefined) this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished) endWritable(this, state, cb);
};

function needFinish(state) {
  return state.ending && state.length === 0 && state.bufferedRequest === null && !state.finished && !state.writing;
}
function callFinal(stream, state) {
  stream._final(function (err) {
    state.pendingcb--;
    if (err) {
      stream.emit('error', err);
    }
    state.prefinished = true;
    stream.emit('prefinish');
    finishMaybe(stream, state);
  });
}
function prefinish(stream, state) {
  if (!state.prefinished && !state.finalCalled) {
    if (typeof stream._final === 'function') {
      state.pendingcb++;
      state.finalCalled = true;
      processNextTick(callFinal, stream, state);
    } else {
      state.prefinished = true;
      stream.emit('prefinish');
    }
  }
}

function finishMaybe(stream, state) {
  var need = needFinish(state);
  if (need) {
    prefinish(stream, state);
    if (state.pendingcb === 0) {
      state.finished = true;
      stream.emit('finish');
    }
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished) processNextTick(cb);else stream.once('finish', cb);
  }
  state.ended = true;
  stream.writable = false;
}

function onCorkedFinish(corkReq, state, err) {
  var entry = corkReq.entry;
  corkReq.entry = null;
  while (entry) {
    var cb = entry.callback;
    state.pendingcb--;
    cb(err);
    entry = entry.next;
  }
  if (state.corkedRequestsFree) {
    state.corkedRequestsFree.next = corkReq;
  } else {
    state.corkedRequestsFree = corkReq;
  }
}

Object.defineProperty(Writable.prototype, 'destroyed', {
  get: function () {
    if (this._writableState === undefined) {
      return false;
    }
    return this._writableState.destroyed;
  },
  set: function (value) {
    // we ignore the value if the stream
    // has not been initialized yet
    if (!this._writableState) {
      return;
    }

    // backward compatibility, the user is explicitly
    // managing destroyed
    this._writableState.destroyed = value;
  }
});

Writable.prototype.destroy = destroyImpl.destroy;
Writable.prototype._undestroy = destroyImpl.undestroy;
Writable.prototype._destroy = function (err, cb) {
  this.end();
  cb(err);
};
}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./_stream_duplex":104,"./internal/streams/destroy":110,"./internal/streams/stream":111,"_process":98,"core-util-is":28,"inherits":36,"process-nextick-args":97,"safe-buffer":113,"util-deprecate":123}],109:[function(require,module,exports){
'use strict';

/*<replacement>*/

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Buffer = require('safe-buffer').Buffer;
/*</replacement>*/

function copyBuffer(src, target, offset) {
  src.copy(target, offset);
}

module.exports = function () {
  function BufferList() {
    _classCallCheck(this, BufferList);

    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  BufferList.prototype.push = function push(v) {
    var entry = { data: v, next: null };
    if (this.length > 0) this.tail.next = entry;else this.head = entry;
    this.tail = entry;
    ++this.length;
  };

  BufferList.prototype.unshift = function unshift(v) {
    var entry = { data: v, next: this.head };
    if (this.length === 0) this.tail = entry;
    this.head = entry;
    ++this.length;
  };

  BufferList.prototype.shift = function shift() {
    if (this.length === 0) return;
    var ret = this.head.data;
    if (this.length === 1) this.head = this.tail = null;else this.head = this.head.next;
    --this.length;
    return ret;
  };

  BufferList.prototype.clear = function clear() {
    this.head = this.tail = null;
    this.length = 0;
  };

  BufferList.prototype.join = function join(s) {
    if (this.length === 0) return '';
    var p = this.head;
    var ret = '' + p.data;
    while (p = p.next) {
      ret += s + p.data;
    }return ret;
  };

  BufferList.prototype.concat = function concat(n) {
    if (this.length === 0) return Buffer.alloc(0);
    if (this.length === 1) return this.head.data;
    var ret = Buffer.allocUnsafe(n >>> 0);
    var p = this.head;
    var i = 0;
    while (p) {
      copyBuffer(p.data, ret, i);
      i += p.data.length;
      p = p.next;
    }
    return ret;
  };

  return BufferList;
}();
},{"safe-buffer":113}],110:[function(require,module,exports){
'use strict';

/*<replacement>*/

var processNextTick = require('process-nextick-args');
/*</replacement>*/

// undocumented cb() API, needed for core, not for public API
function destroy(err, cb) {
  var _this = this;

  var readableDestroyed = this._readableState && this._readableState.destroyed;
  var writableDestroyed = this._writableState && this._writableState.destroyed;

  if (readableDestroyed || writableDestroyed) {
    if (cb) {
      cb(err);
    } else if (err && (!this._writableState || !this._writableState.errorEmitted)) {
      processNextTick(emitErrorNT, this, err);
    }
    return;
  }

  // we set destroyed to true before firing error callbacks in order
  // to make it re-entrance safe in case destroy() is called within callbacks

  if (this._readableState) {
    this._readableState.destroyed = true;
  }

  // if this is a duplex stream mark the writable part as destroyed as well
  if (this._writableState) {
    this._writableState.destroyed = true;
  }

  this._destroy(err || null, function (err) {
    if (!cb && err) {
      processNextTick(emitErrorNT, _this, err);
      if (_this._writableState) {
        _this._writableState.errorEmitted = true;
      }
    } else if (cb) {
      cb(err);
    }
  });
}

function undestroy() {
  if (this._readableState) {
    this._readableState.destroyed = false;
    this._readableState.reading = false;
    this._readableState.ended = false;
    this._readableState.endEmitted = false;
  }

  if (this._writableState) {
    this._writableState.destroyed = false;
    this._writableState.ended = false;
    this._writableState.ending = false;
    this._writableState.finished = false;
    this._writableState.errorEmitted = false;
  }
}

function emitErrorNT(self, err) {
  self.emit('error', err);
}

module.exports = {
  destroy: destroy,
  undestroy: undestroy
};
},{"process-nextick-args":97}],111:[function(require,module,exports){
module.exports = require('events').EventEmitter;

},{"events":32}],112:[function(require,module,exports){
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = exports;
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":104,"./lib/_stream_passthrough.js":105,"./lib/_stream_readable.js":106,"./lib/_stream_transform.js":107,"./lib/_stream_writable.js":108}],113:[function(require,module,exports){
/* eslint-disable node/no-deprecated-api */
var buffer = require('buffer')
var Buffer = buffer.Buffer

// alternative to using Object.keys for old browsers
function copyProps (src, dst) {
  for (var key in src) {
    dst[key] = src[key]
  }
}
if (Buffer.from && Buffer.alloc && Buffer.allocUnsafe && Buffer.allocUnsafeSlow) {
  module.exports = buffer
} else {
  // Copy properties from require('buffer')
  copyProps(buffer, exports)
  exports.Buffer = SafeBuffer
}

function SafeBuffer (arg, encodingOrOffset, length) {
  return Buffer(arg, encodingOrOffset, length)
}

// Copy static methods from Buffer
copyProps(Buffer, SafeBuffer)

SafeBuffer.from = function (arg, encodingOrOffset, length) {
  if (typeof arg === 'number') {
    throw new TypeError('Argument must not be a number')
  }
  return Buffer(arg, encodingOrOffset, length)
}

SafeBuffer.alloc = function (size, fill, encoding) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  var buf = Buffer(size)
  if (fill !== undefined) {
    if (typeof encoding === 'string') {
      buf.fill(fill, encoding)
    } else {
      buf.fill(fill)
    }
  } else {
    buf.fill(0)
  }
  return buf
}

SafeBuffer.allocUnsafe = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return Buffer(size)
}

SafeBuffer.allocUnsafeSlow = function (size) {
  if (typeof size !== 'number') {
    throw new TypeError('Argument must be a number')
  }
  return buffer.SlowBuffer(size)
}

},{"buffer":25}],114:[function(require,module,exports){
(function (global){
var ClientRequest = require('./lib/request')
var extend = require('xtend')
var statusCodes = require('builtin-status-codes')
var url = require('url')

var http = exports

http.request = function (opts, cb) {
	if (typeof opts === 'string')
		opts = url.parse(opts)
	else
		opts = extend(opts)

	// Normally, the page is loaded from http or https, so not specifying a protocol
	// will result in a (valid) protocol-relative url. However, this won't work if
	// the protocol is something else, like 'file:'
	var defaultProtocol = global.location.protocol.search(/^https?:$/) === -1 ? 'http:' : ''

	var protocol = opts.protocol || defaultProtocol
	var host = opts.hostname || opts.host
	var port = opts.port
	var path = opts.path || '/'

	// Necessary for IPv6 addresses
	if (host && host.indexOf(':') !== -1)
		host = '[' + host + ']'

	// This may be a relative url. The browser should always be able to interpret it correctly.
	opts.url = (host ? (protocol + '//' + host) : '') + (port ? ':' + port : '') + path
	opts.method = (opts.method || 'GET').toUpperCase()
	opts.headers = opts.headers || {}

	// Also valid opts.auth, opts.mode

	var req = new ClientRequest(opts)
	if (cb)
		req.on('response', cb)
	return req
}

http.get = function get (opts, cb) {
	var req = http.request(opts, cb)
	req.end()
	return req
}

http.Agent = function () {}
http.Agent.defaultMaxSockets = 4

http.STATUS_CODES = statusCodes

http.METHODS = [
	'CHECKOUT',
	'CONNECT',
	'COPY',
	'DELETE',
	'GET',
	'HEAD',
	'LOCK',
	'M-SEARCH',
	'MERGE',
	'MKACTIVITY',
	'MKCOL',
	'MOVE',
	'NOTIFY',
	'OPTIONS',
	'PATCH',
	'POST',
	'PROPFIND',
	'PROPPATCH',
	'PURGE',
	'PUT',
	'REPORT',
	'SEARCH',
	'SUBSCRIBE',
	'TRACE',
	'UNLOCK',
	'UNSUBSCRIBE'
]
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./lib/request":116,"builtin-status-codes":26,"url":121,"xtend":124}],115:[function(require,module,exports){
(function (global){
exports.fetch = isFunction(global.fetch) && isFunction(global.ReadableStream)

exports.blobConstructor = false
try {
	new Blob([new ArrayBuffer(1)])
	exports.blobConstructor = true
} catch (e) {}

// The xhr request to example.com may violate some restrictive CSP configurations,
// so if we're running in a browser that supports `fetch`, avoid calling getXHR()
// and assume support for certain features below.
var xhr
function getXHR () {
	// Cache the xhr value
	if (xhr !== undefined) return xhr

	if (global.XMLHttpRequest) {
		xhr = new global.XMLHttpRequest()
		// If XDomainRequest is available (ie only, where xhr might not work
		// cross domain), use the page location. Otherwise use example.com
		// Note: this doesn't actually make an http request.
		try {
			xhr.open('GET', global.XDomainRequest ? '/' : 'https://example.com')
		} catch(e) {
			xhr = null
		}
	} else {
		// Service workers don't have XHR
		xhr = null
	}
	return xhr
}

function checkTypeSupport (type) {
	var xhr = getXHR()
	if (!xhr) return false
	try {
		xhr.responseType = type
		return xhr.responseType === type
	} catch (e) {}
	return false
}

// For some strange reason, Safari 7.0 reports typeof global.ArrayBuffer === 'object'.
// Safari 7.1 appears to have fixed this bug.
var haveArrayBuffer = typeof global.ArrayBuffer !== 'undefined'
var haveSlice = haveArrayBuffer && isFunction(global.ArrayBuffer.prototype.slice)

// If fetch is supported, then arraybuffer will be supported too. Skip calling
// checkTypeSupport(), since that calls getXHR().
exports.arraybuffer = exports.fetch || (haveArrayBuffer && checkTypeSupport('arraybuffer'))

// These next two tests unavoidably show warnings in Chrome. Since fetch will always
// be used if it's available, just return false for these to avoid the warnings.
exports.msstream = !exports.fetch && haveSlice && checkTypeSupport('ms-stream')
exports.mozchunkedarraybuffer = !exports.fetch && haveArrayBuffer &&
	checkTypeSupport('moz-chunked-arraybuffer')

// If fetch is supported, then overrideMimeType will be supported too. Skip calling
// getXHR().
exports.overrideMimeType = exports.fetch || (getXHR() ? isFunction(getXHR().overrideMimeType) : false)

exports.vbArray = isFunction(global.VBArray)

function isFunction (value) {
	return typeof value === 'function'
}

xhr = null // Help gc

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],116:[function(require,module,exports){
(function (process,global,Buffer){
var capability = require('./capability')
var inherits = require('inherits')
var response = require('./response')
var stream = require('readable-stream')
var toArrayBuffer = require('to-arraybuffer')

var IncomingMessage = response.IncomingMessage
var rStates = response.readyStates

function decideMode (preferBinary, useFetch) {
	if (capability.fetch && useFetch) {
		return 'fetch'
	} else if (capability.mozchunkedarraybuffer) {
		return 'moz-chunked-arraybuffer'
	} else if (capability.msstream) {
		return 'ms-stream'
	} else if (capability.arraybuffer && preferBinary) {
		return 'arraybuffer'
	} else if (capability.vbArray && preferBinary) {
		return 'text:vbarray'
	} else {
		return 'text'
	}
}

var ClientRequest = module.exports = function (opts) {
	var self = this
	stream.Writable.call(self)

	self._opts = opts
	self._body = []
	self._headers = {}
	if (opts.auth)
		self.setHeader('Authorization', 'Basic ' + new Buffer(opts.auth).toString('base64'))
	Object.keys(opts.headers).forEach(function (name) {
		self.setHeader(name, opts.headers[name])
	})

	var preferBinary
	var useFetch = true
	if (opts.mode === 'disable-fetch' || 'timeout' in opts) {
		// If the use of XHR should be preferred and includes preserving the 'content-type' header.
		// Force XHR to be used since the Fetch API does not yet support timeouts.
		useFetch = false
		preferBinary = true
	} else if (opts.mode === 'prefer-streaming') {
		// If streaming is a high priority but binary compatibility and
		// the accuracy of the 'content-type' header aren't
		preferBinary = false
	} else if (opts.mode === 'allow-wrong-content-type') {
		// If streaming is more important than preserving the 'content-type' header
		preferBinary = !capability.overrideMimeType
	} else if (!opts.mode || opts.mode === 'default' || opts.mode === 'prefer-fast') {
		// Use binary if text streaming may corrupt data or the content-type header, or for speed
		preferBinary = true
	} else {
		throw new Error('Invalid value for opts.mode')
	}
	self._mode = decideMode(preferBinary, useFetch)

	self.on('finish', function () {
		self._onFinish()
	})
}

inherits(ClientRequest, stream.Writable)

ClientRequest.prototype.setHeader = function (name, value) {
	var self = this
	var lowerName = name.toLowerCase()
	// This check is not necessary, but it prevents warnings from browsers about setting unsafe
	// headers. To be honest I'm not entirely sure hiding these warnings is a good thing, but
	// http-browserify did it, so I will too.
	if (unsafeHeaders.indexOf(lowerName) !== -1)
		return

	self._headers[lowerName] = {
		name: name,
		value: value
	}
}

ClientRequest.prototype.getHeader = function (name) {
	var header = this._headers[name.toLowerCase()]
	if (header)
		return header.value
	return null
}

ClientRequest.prototype.removeHeader = function (name) {
	var self = this
	delete self._headers[name.toLowerCase()]
}

ClientRequest.prototype._onFinish = function () {
	var self = this

	if (self._destroyed)
		return
	var opts = self._opts

	var headersObj = self._headers
	var body = null
	if (opts.method !== 'GET' && opts.method !== 'HEAD') {
		if (capability.blobConstructor) {
			body = new global.Blob(self._body.map(function (buffer) {
				return toArrayBuffer(buffer)
			}), {
				type: (headersObj['content-type'] || {}).value || ''
			})
		} else {
			// get utf8 string
			body = Buffer.concat(self._body).toString()
		}
	}

	// create flattened list of headers
	var headersList = []
	Object.keys(headersObj).forEach(function (keyName) {
		var name = headersObj[keyName].name
		var value = headersObj[keyName].value
		if (Array.isArray(value)) {
			value.forEach(function (v) {
				headersList.push([name, v])
			})
		} else {
			headersList.push([name, value])
		}
	})

	if (self._mode === 'fetch') {
		global.fetch(self._opts.url, {
			method: self._opts.method,
			headers: headersList,
			body: body || undefined,
			mode: 'cors',
			credentials: opts.withCredentials ? 'include' : 'same-origin'
		}).then(function (response) {
			self._fetchResponse = response
			self._connect()
		}, function (reason) {
			self.emit('error', reason)
		})
	} else {
		var xhr = self._xhr = new global.XMLHttpRequest()
		try {
			xhr.open(self._opts.method, self._opts.url, true)
		} catch (err) {
			process.nextTick(function () {
				self.emit('error', err)
			})
			return
		}

		// Can't set responseType on really old browsers
		if ('responseType' in xhr)
			xhr.responseType = self._mode.split(':')[0]

		if ('withCredentials' in xhr)
			xhr.withCredentials = !!opts.withCredentials

		if (self._mode === 'text' && 'overrideMimeType' in xhr)
			xhr.overrideMimeType('text/plain; charset=x-user-defined')

		if ('timeout' in opts) {
			xhr.timeout = opts.timeout
			xhr.ontimeout = function () {
				self.emit('timeout')
			}
		}

		headersList.forEach(function (header) {
			xhr.setRequestHeader(header[0], header[1])
		})

		self._response = null
		xhr.onreadystatechange = function () {
			switch (xhr.readyState) {
				case rStates.LOADING:
				case rStates.DONE:
					self._onXHRProgress()
					break
			}
		}
		// Necessary for streaming in Firefox, since xhr.response is ONLY defined
		// in onprogress, not in onreadystatechange with xhr.readyState = 3
		if (self._mode === 'moz-chunked-arraybuffer') {
			xhr.onprogress = function () {
				self._onXHRProgress()
			}
		}

		xhr.onerror = function () {
			if (self._destroyed)
				return
			self.emit('error', new Error('XHR error'))
		}

		try {
			xhr.send(body)
		} catch (err) {
			process.nextTick(function () {
				self.emit('error', err)
			})
			return
		}
	}
}

/**
 * Checks if xhr.status is readable and non-zero, indicating no error.
 * Even though the spec says it should be available in readyState 3,
 * accessing it throws an exception in IE8
 */
function statusValid (xhr) {
	try {
		var status = xhr.status
		return (status !== null && status !== 0)
	} catch (e) {
		return false
	}
}

ClientRequest.prototype._onXHRProgress = function () {
	var self = this

	if (!statusValid(self._xhr) || self._destroyed)
		return

	if (!self._response)
		self._connect()

	self._response._onXHRProgress()
}

ClientRequest.prototype._connect = function () {
	var self = this

	if (self._destroyed)
		return

	self._response = new IncomingMessage(self._xhr, self._fetchResponse, self._mode)
	self._response.on('error', function(err) {
		self.emit('error', err)
	})

	self.emit('response', self._response)
}

ClientRequest.prototype._write = function (chunk, encoding, cb) {
	var self = this

	self._body.push(chunk)
	cb()
}

ClientRequest.prototype.abort = ClientRequest.prototype.destroy = function () {
	var self = this
	self._destroyed = true
	if (self._response)
		self._response._destroyed = true
	if (self._xhr)
		self._xhr.abort()
	// Currently, there isn't a way to truly abort a fetch.
	// If you like bikeshedding, see https://github.com/whatwg/fetch/issues/27
}

ClientRequest.prototype.end = function (data, encoding, cb) {
	var self = this
	if (typeof data === 'function') {
		cb = data
		data = undefined
	}

	stream.Writable.prototype.end.call(self, data, encoding, cb)
}

ClientRequest.prototype.flushHeaders = function () {}
ClientRequest.prototype.setTimeout = function () {}
ClientRequest.prototype.setNoDelay = function () {}
ClientRequest.prototype.setSocketKeepAlive = function () {}

// Taken from http://www.w3.org/TR/XMLHttpRequest/#the-setrequestheader%28%29-method
var unsafeHeaders = [
	'accept-charset',
	'accept-encoding',
	'access-control-request-headers',
	'access-control-request-method',
	'connection',
	'content-length',
	'cookie',
	'cookie2',
	'date',
	'dnt',
	'expect',
	'host',
	'keep-alive',
	'origin',
	'referer',
	'te',
	'trailer',
	'transfer-encoding',
	'upgrade',
	'user-agent',
	'via'
]

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"./capability":115,"./response":117,"_process":98,"buffer":25,"inherits":36,"readable-stream":112,"to-arraybuffer":119}],117:[function(require,module,exports){
(function (process,global,Buffer){
var capability = require('./capability')
var inherits = require('inherits')
var stream = require('readable-stream')

var rStates = exports.readyStates = {
	UNSENT: 0,
	OPENED: 1,
	HEADERS_RECEIVED: 2,
	LOADING: 3,
	DONE: 4
}

var IncomingMessage = exports.IncomingMessage = function (xhr, response, mode) {
	var self = this
	stream.Readable.call(self)

	self._mode = mode
	self.headers = {}
	self.rawHeaders = []
	self.trailers = {}
	self.rawTrailers = []

	// Fake the 'close' event, but only once 'end' fires
	self.on('end', function () {
		// The nextTick is necessary to prevent the 'request' module from causing an infinite loop
		process.nextTick(function () {
			self.emit('close')
		})
	})

	if (mode === 'fetch') {
		self._fetchResponse = response

		self.url = response.url
		self.statusCode = response.status
		self.statusMessage = response.statusText
		
		response.headers.forEach(function(header, key){
			self.headers[key.toLowerCase()] = header
			self.rawHeaders.push(key, header)
		})


		// TODO: this doesn't respect backpressure. Once WritableStream is available, this can be fixed
		var reader = response.body.getReader()
		function read () {
			reader.read().then(function (result) {
				if (self._destroyed)
					return
				if (result.done) {
					self.push(null)
					return
				}
				self.push(new Buffer(result.value))
				read()
			}).catch(function(err) {
				self.emit('error', err)
			})
		}
		read()

	} else {
		self._xhr = xhr
		self._pos = 0

		self.url = xhr.responseURL
		self.statusCode = xhr.status
		self.statusMessage = xhr.statusText
		var headers = xhr.getAllResponseHeaders().split(/\r?\n/)
		headers.forEach(function (header) {
			var matches = header.match(/^([^:]+):\s*(.*)/)
			if (matches) {
				var key = matches[1].toLowerCase()
				if (key === 'set-cookie') {
					if (self.headers[key] === undefined) {
						self.headers[key] = []
					}
					self.headers[key].push(matches[2])
				} else if (self.headers[key] !== undefined) {
					self.headers[key] += ', ' + matches[2]
				} else {
					self.headers[key] = matches[2]
				}
				self.rawHeaders.push(matches[1], matches[2])
			}
		})

		self._charset = 'x-user-defined'
		if (!capability.overrideMimeType) {
			var mimeType = self.rawHeaders['mime-type']
			if (mimeType) {
				var charsetMatch = mimeType.match(/;\s*charset=([^;])(;|$)/)
				if (charsetMatch) {
					self._charset = charsetMatch[1].toLowerCase()
				}
			}
			if (!self._charset)
				self._charset = 'utf-8' // best guess
		}
	}
}

inherits(IncomingMessage, stream.Readable)

IncomingMessage.prototype._read = function () {}

IncomingMessage.prototype._onXHRProgress = function () {
	var self = this

	var xhr = self._xhr

	var response = null
	switch (self._mode) {
		case 'text:vbarray': // For IE9
			if (xhr.readyState !== rStates.DONE)
				break
			try {
				// This fails in IE8
				response = new global.VBArray(xhr.responseBody).toArray()
			} catch (e) {}
			if (response !== null) {
				self.push(new Buffer(response))
				break
			}
			// Falls through in IE8	
		case 'text':
			try { // This will fail when readyState = 3 in IE9. Switch mode and wait for readyState = 4
				response = xhr.responseText
			} catch (e) {
				self._mode = 'text:vbarray'
				break
			}
			if (response.length > self._pos) {
				var newData = response.substr(self._pos)
				if (self._charset === 'x-user-defined') {
					var buffer = new Buffer(newData.length)
					for (var i = 0; i < newData.length; i++)
						buffer[i] = newData.charCodeAt(i) & 0xff

					self.push(buffer)
				} else {
					self.push(newData, self._charset)
				}
				self._pos = response.length
			}
			break
		case 'arraybuffer':
			if (xhr.readyState !== rStates.DONE || !xhr.response)
				break
			response = xhr.response
			self.push(new Buffer(new Uint8Array(response)))
			break
		case 'moz-chunked-arraybuffer': // take whole
			response = xhr.response
			if (xhr.readyState !== rStates.LOADING || !response)
				break
			self.push(new Buffer(new Uint8Array(response)))
			break
		case 'ms-stream':
			response = xhr.response
			if (xhr.readyState !== rStates.LOADING)
				break
			var reader = new global.MSStreamReader()
			reader.onprogress = function () {
				if (reader.result.byteLength > self._pos) {
					self.push(new Buffer(new Uint8Array(reader.result.slice(self._pos))))
					self._pos = reader.result.byteLength
				}
			}
			reader.onload = function () {
				self.push(null)
			}
			// reader.onerror = ??? // TODO: this
			reader.readAsArrayBuffer(response)
			break
	}

	// The ms-stream case handles end separately in reader.onload()
	if (self._xhr.readyState === rStates.DONE && self._mode !== 'ms-stream') {
		self.push(null)
	}
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"./capability":115,"_process":98,"buffer":25,"inherits":36,"readable-stream":112}],118:[function(require,module,exports){
'use strict';

var Buffer = require('safe-buffer').Buffer;

var isEncoding = Buffer.isEncoding || function (encoding) {
  encoding = '' + encoding;
  switch (encoding && encoding.toLowerCase()) {
    case 'hex':case 'utf8':case 'utf-8':case 'ascii':case 'binary':case 'base64':case 'ucs2':case 'ucs-2':case 'utf16le':case 'utf-16le':case 'raw':
      return true;
    default:
      return false;
  }
};

function _normalizeEncoding(enc) {
  if (!enc) return 'utf8';
  var retried;
  while (true) {
    switch (enc) {
      case 'utf8':
      case 'utf-8':
        return 'utf8';
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return 'utf16le';
      case 'latin1':
      case 'binary':
        return 'latin1';
      case 'base64':
      case 'ascii':
      case 'hex':
        return enc;
      default:
        if (retried) return; // undefined
        enc = ('' + enc).toLowerCase();
        retried = true;
    }
  }
};

// Do not cache `Buffer.isEncoding` when checking encoding names as some
// modules monkey-patch it to support additional encodings
function normalizeEncoding(enc) {
  var nenc = _normalizeEncoding(enc);
  if (typeof nenc !== 'string' && (Buffer.isEncoding === isEncoding || !isEncoding(enc))) throw new Error('Unknown encoding: ' + enc);
  return nenc || enc;
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters.
exports.StringDecoder = StringDecoder;
function StringDecoder(encoding) {
  this.encoding = normalizeEncoding(encoding);
  var nb;
  switch (this.encoding) {
    case 'utf16le':
      this.text = utf16Text;
      this.end = utf16End;
      nb = 4;
      break;
    case 'utf8':
      this.fillLast = utf8FillLast;
      nb = 4;
      break;
    case 'base64':
      this.text = base64Text;
      this.end = base64End;
      nb = 3;
      break;
    default:
      this.write = simpleWrite;
      this.end = simpleEnd;
      return;
  }
  this.lastNeed = 0;
  this.lastTotal = 0;
  this.lastChar = Buffer.allocUnsafe(nb);
}

StringDecoder.prototype.write = function (buf) {
  if (buf.length === 0) return '';
  var r;
  var i;
  if (this.lastNeed) {
    r = this.fillLast(buf);
    if (r === undefined) return '';
    i = this.lastNeed;
    this.lastNeed = 0;
  } else {
    i = 0;
  }
  if (i < buf.length) return r ? r + this.text(buf, i) : this.text(buf, i);
  return r || '';
};

StringDecoder.prototype.end = utf8End;

// Returns only complete characters in a Buffer
StringDecoder.prototype.text = utf8Text;

// Attempts to complete a partial non-UTF-8 character using bytes from a Buffer
StringDecoder.prototype.fillLast = function (buf) {
  if (this.lastNeed <= buf.length) {
    buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, this.lastNeed);
    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
  }
  buf.copy(this.lastChar, this.lastTotal - this.lastNeed, 0, buf.length);
  this.lastNeed -= buf.length;
};

// Checks the type of a UTF-8 byte, whether it's ASCII, a leading byte, or a
// continuation byte.
function utf8CheckByte(byte) {
  if (byte <= 0x7F) return 0;else if (byte >> 5 === 0x06) return 2;else if (byte >> 4 === 0x0E) return 3;else if (byte >> 3 === 0x1E) return 4;
  return -1;
}

// Checks at most 3 bytes at the end of a Buffer in order to detect an
// incomplete multi-byte UTF-8 character. The total number of bytes (2, 3, or 4)
// needed to complete the UTF-8 character (if applicable) are returned.
function utf8CheckIncomplete(self, buf, i) {
  var j = buf.length - 1;
  if (j < i) return 0;
  var nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) self.lastNeed = nb - 1;
    return nb;
  }
  if (--j < i) return 0;
  nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) self.lastNeed = nb - 2;
    return nb;
  }
  if (--j < i) return 0;
  nb = utf8CheckByte(buf[j]);
  if (nb >= 0) {
    if (nb > 0) {
      if (nb === 2) nb = 0;else self.lastNeed = nb - 3;
    }
    return nb;
  }
  return 0;
}

// Validates as many continuation bytes for a multi-byte UTF-8 character as
// needed or are available. If we see a non-continuation byte where we expect
// one, we "replace" the validated continuation bytes we've seen so far with
// UTF-8 replacement characters ('\ufffd'), to match v8's UTF-8 decoding
// behavior. The continuation byte check is included three times in the case
// where all of the continuation bytes for a character exist in the same buffer.
// It is also done this way as a slight performance increase instead of using a
// loop.
function utf8CheckExtraBytes(self, buf, p) {
  if ((buf[0] & 0xC0) !== 0x80) {
    self.lastNeed = 0;
    return '\ufffd'.repeat(p);
  }
  if (self.lastNeed > 1 && buf.length > 1) {
    if ((buf[1] & 0xC0) !== 0x80) {
      self.lastNeed = 1;
      return '\ufffd'.repeat(p + 1);
    }
    if (self.lastNeed > 2 && buf.length > 2) {
      if ((buf[2] & 0xC0) !== 0x80) {
        self.lastNeed = 2;
        return '\ufffd'.repeat(p + 2);
      }
    }
  }
}

// Attempts to complete a multi-byte UTF-8 character using bytes from a Buffer.
function utf8FillLast(buf) {
  var p = this.lastTotal - this.lastNeed;
  var r = utf8CheckExtraBytes(this, buf, p);
  if (r !== undefined) return r;
  if (this.lastNeed <= buf.length) {
    buf.copy(this.lastChar, p, 0, this.lastNeed);
    return this.lastChar.toString(this.encoding, 0, this.lastTotal);
  }
  buf.copy(this.lastChar, p, 0, buf.length);
  this.lastNeed -= buf.length;
}

// Returns all complete UTF-8 characters in a Buffer. If the Buffer ended on a
// partial character, the character's bytes are buffered until the required
// number of bytes are available.
function utf8Text(buf, i) {
  var total = utf8CheckIncomplete(this, buf, i);
  if (!this.lastNeed) return buf.toString('utf8', i);
  this.lastTotal = total;
  var end = buf.length - (total - this.lastNeed);
  buf.copy(this.lastChar, 0, end);
  return buf.toString('utf8', i, end);
}

// For UTF-8, a replacement character for each buffered byte of a (partial)
// character needs to be added to the output.
function utf8End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) return r + '\ufffd'.repeat(this.lastTotal - this.lastNeed);
  return r;
}

// UTF-16LE typically needs two bytes per character, but even if we have an even
// number of bytes available, we need to check if we end on a leading/high
// surrogate. In that case, we need to wait for the next two bytes in order to
// decode the last character properly.
function utf16Text(buf, i) {
  if ((buf.length - i) % 2 === 0) {
    var r = buf.toString('utf16le', i);
    if (r) {
      var c = r.charCodeAt(r.length - 1);
      if (c >= 0xD800 && c <= 0xDBFF) {
        this.lastNeed = 2;
        this.lastTotal = 4;
        this.lastChar[0] = buf[buf.length - 2];
        this.lastChar[1] = buf[buf.length - 1];
        return r.slice(0, -1);
      }
    }
    return r;
  }
  this.lastNeed = 1;
  this.lastTotal = 2;
  this.lastChar[0] = buf[buf.length - 1];
  return buf.toString('utf16le', i, buf.length - 1);
}

// For UTF-16LE we do not explicitly append special replacement characters if we
// end on a partial character, we simply let v8 handle that.
function utf16End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) {
    var end = this.lastTotal - this.lastNeed;
    return r + this.lastChar.toString('utf16le', 0, end);
  }
  return r;
}

function base64Text(buf, i) {
  var n = (buf.length - i) % 3;
  if (n === 0) return buf.toString('base64', i);
  this.lastNeed = 3 - n;
  this.lastTotal = 3;
  if (n === 1) {
    this.lastChar[0] = buf[buf.length - 1];
  } else {
    this.lastChar[0] = buf[buf.length - 2];
    this.lastChar[1] = buf[buf.length - 1];
  }
  return buf.toString('base64', i, buf.length - n);
}

function base64End(buf) {
  var r = buf && buf.length ? this.write(buf) : '';
  if (this.lastNeed) return r + this.lastChar.toString('base64', 0, 3 - this.lastNeed);
  return r;
}

// Pass bytes on through for single-byte encodings (e.g. ascii, latin1, hex)
function simpleWrite(buf) {
  return buf.toString(this.encoding);
}

function simpleEnd(buf) {
  return buf && buf.length ? this.write(buf) : '';
}
},{"safe-buffer":113}],119:[function(require,module,exports){
var Buffer = require('buffer').Buffer

module.exports = function (buf) {
	// If the buffer is backed by a Uint8Array, a faster version will work
	if (buf instanceof Uint8Array) {
		// If the buffer isn't a subarray, return the underlying ArrayBuffer
		if (buf.byteOffset === 0 && buf.byteLength === buf.buffer.byteLength) {
			return buf.buffer
		} else if (typeof buf.buffer.slice === 'function') {
			// Otherwise we need to get a proper copy
			return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
		}
	}

	if (Buffer.isBuffer(buf)) {
		// This is the slow version that will work with any Buffer
		// implementation (even in old browsers)
		var arrayCopy = new Uint8Array(buf.length)
		var len = buf.length
		for (var i = 0; i < len; i++) {
			arrayCopy[i] = buf[i]
		}
		return arrayCopy.buffer
	} else {
		throw new Error('Argument must be a Buffer')
	}
}

},{"buffer":25}],120:[function(require,module,exports){
(function (global){
/*global unescape, module, define, window, global*/

/*
 UriTemplate Copyright (c) 2012-2013 Franz Antesberger. All Rights Reserved.
 Available via the MIT license.
*/

(function (exportCallback) {
    "use strict";

var UriTemplateError = (function () {

    function UriTemplateError (options) {
        this.options = options;
    }

    UriTemplateError.prototype.toString = function () {
        if (JSON && JSON.stringify) {
            return JSON.stringify(this.options);
        }
        else {
            return this.options;
        }
    };

    return UriTemplateError;
}());

var objectHelper = (function () {
    function isArray (value) {
        return Object.prototype.toString.apply(value) === '[object Array]';
    }

    function isString (value) {
        return Object.prototype.toString.apply(value) === '[object String]';
    }
    
    function isNumber (value) {
        return Object.prototype.toString.apply(value) === '[object Number]';
    }
    
    function isBoolean (value) {
        return Object.prototype.toString.apply(value) === '[object Boolean]';
    }
    
    function join (arr, separator) {
        var
            result = '',
            first = true,
            index;
        for (index = 0; index < arr.length; index += 1) {
            if (first) {
                first = false;
            }
            else {
                result += separator;
            }
            result += arr[index];
        }
        return result;
    }

    function map (arr, mapper) {
        var
            result = [],
            index = 0;
        for (; index < arr.length; index += 1) {
            result.push(mapper(arr[index]));
        }
        return result;
    }

    function filter (arr, predicate) {
        var
            result = [],
            index = 0;
        for (; index < arr.length; index += 1) {
            if (predicate(arr[index])) {
                result.push(arr[index]);
            }
        }
        return result;
    }

    function deepFreezeUsingObjectFreeze (object) {
        if (typeof object !== "object" || object === null) {
            return object;
        }
        Object.freeze(object);
        var property, propertyName;
        for (propertyName in object) {
            if (object.hasOwnProperty(propertyName)) {
                property = object[propertyName];
                // be aware, arrays are 'object', too
                if (typeof property === "object") {
                    deepFreeze(property);
                }
            }
        }
        return object;
    }

    function deepFreeze (object) {
        if (typeof Object.freeze === 'function') {
            return deepFreezeUsingObjectFreeze(object);
        }
        return object;
    }


    return {
        isArray: isArray,
        isString: isString,
        isNumber: isNumber,
        isBoolean: isBoolean,
        join: join,
        map: map,
        filter: filter,
        deepFreeze: deepFreeze
    };
}());

var charHelper = (function () {

    function isAlpha (chr) {
        return (chr >= 'a' && chr <= 'z') || ((chr >= 'A' && chr <= 'Z'));
    }

    function isDigit (chr) {
        return chr >= '0' && chr <= '9';
    }

    function isHexDigit (chr) {
        return isDigit(chr) || (chr >= 'a' && chr <= 'f') || (chr >= 'A' && chr <= 'F');
    }

    return {
        isAlpha: isAlpha,
        isDigit: isDigit,
        isHexDigit: isHexDigit
    };
}());

var pctEncoder = (function () {
    var utf8 = {
        encode: function (chr) {
            // see http://ecmanaut.blogspot.de/2006/07/encoding-decoding-utf8-in-javascript.html
            return unescape(encodeURIComponent(chr));
        },
        numBytes: function (firstCharCode) {
            if (firstCharCode <= 0x7F) {
                return 1;
            }
            else if (0xC2 <= firstCharCode && firstCharCode <= 0xDF) {
                return 2;
            }
            else if (0xE0 <= firstCharCode && firstCharCode <= 0xEF) {
                return 3;
            }
            else if (0xF0 <= firstCharCode && firstCharCode <= 0xF4) {
                return 4;
            }
            // no valid first octet
            return 0;
        },
        isValidFollowingCharCode: function (charCode) {
            return 0x80 <= charCode && charCode <= 0xBF;
        }
    };

    /**
     * encodes a character, if needed or not.
     * @param chr
     * @return pct-encoded character
     */
    function encodeCharacter (chr) {
        var
            result = '',
            octets = utf8.encode(chr),
            octet,
            index;
        for (index = 0; index < octets.length; index += 1) {
            octet = octets.charCodeAt(index);
            result += '%' + (octet < 0x10 ? '0' : '') + octet.toString(16).toUpperCase();
        }
        return result;
    }

    /**
     * Returns, whether the given text at start is in the form 'percent hex-digit hex-digit', like '%3F'
     * @param text
     * @param start
     * @return {boolean|*|*}
     */
    function isPercentDigitDigit (text, start) {
        return text.charAt(start) === '%' && charHelper.isHexDigit(text.charAt(start + 1)) && charHelper.isHexDigit(text.charAt(start + 2));
    }

    /**
     * Parses a hex number from start with length 2.
     * @param text a string
     * @param start the start index of the 2-digit hex number
     * @return {Number}
     */
    function parseHex2 (text, start) {
        return parseInt(text.substr(start, 2), 16);
    }

    /**
     * Returns whether or not the given char sequence is a correctly pct-encoded sequence.
     * @param chr
     * @return {boolean}
     */
    function isPctEncoded (chr) {
        if (!isPercentDigitDigit(chr, 0)) {
            return false;
        }
        var firstCharCode = parseHex2(chr, 1);
        var numBytes = utf8.numBytes(firstCharCode);
        if (numBytes === 0) {
            return false;
        }
        for (var byteNumber = 1; byteNumber < numBytes; byteNumber += 1) {
            if (!isPercentDigitDigit(chr, 3*byteNumber) || !utf8.isValidFollowingCharCode(parseHex2(chr, 3*byteNumber + 1))) {
                return false;
            }
        }
        return true;
    }

    /**
     * Reads as much as needed from the text, e.g. '%20' or '%C3%B6'. It does not decode!
     * @param text
     * @param startIndex
     * @return the character or pct-string of the text at startIndex
     */
    function pctCharAt(text, startIndex) {
        var chr = text.charAt(startIndex);
        if (!isPercentDigitDigit(text, startIndex)) {
            return chr;
        }
        var utf8CharCode = parseHex2(text, startIndex + 1);
        var numBytes = utf8.numBytes(utf8CharCode);
        if (numBytes === 0) {
            return chr;
        }
        for (var byteNumber = 1; byteNumber < numBytes; byteNumber += 1) {
            if (!isPercentDigitDigit(text, startIndex + 3 * byteNumber) || !utf8.isValidFollowingCharCode(parseHex2(text, startIndex + 3 * byteNumber + 1))) {
                return chr;
            }
        }
        return text.substr(startIndex, 3 * numBytes);
    }

    return {
        encodeCharacter: encodeCharacter,
        isPctEncoded: isPctEncoded,
        pctCharAt: pctCharAt
    };
}());

var rfcCharHelper = (function () {

    /**
     * Returns if an character is an varchar character according 2.3 of rfc 6570
     * @param chr
     * @return (Boolean)
     */
    function isVarchar (chr) {
        return charHelper.isAlpha(chr) || charHelper.isDigit(chr) || chr === '_' || pctEncoder.isPctEncoded(chr);
    }

    /**
     * Returns if chr is an unreserved character according 1.5 of rfc 6570
     * @param chr
     * @return {Boolean}
     */
    function isUnreserved (chr) {
        return charHelper.isAlpha(chr) || charHelper.isDigit(chr) || chr === '-' || chr === '.' || chr === '_' || chr === '~';
    }

    /**
     * Returns if chr is an reserved character according 1.5 of rfc 6570
     * or the percent character mentioned in 3.2.1.
     * @param chr
     * @return {Boolean}
     */
    function isReserved (chr) {
        return chr === ':' || chr === '/' || chr === '?' || chr === '#' || chr === '[' || chr === ']' || chr === '@' || chr === '!' || chr === '$' || chr === '&' || chr === '(' ||
            chr === ')' || chr === '*' || chr === '+' || chr === ',' || chr === ';' || chr === '=' || chr === "'";
    }

    return {
        isVarchar: isVarchar,
        isUnreserved: isUnreserved,
        isReserved: isReserved
    };

}());

/**
 * encoding of rfc 6570
 */
var encodingHelper = (function () {

    function encode (text, passReserved) {
        var
            result = '',
            index,
            chr = '';
        if (typeof text === "number" || typeof text === "boolean") {
            text = text.toString();
        }
        for (index = 0; index < text.length; index += chr.length) {
            chr = text.charAt(index);
            result += rfcCharHelper.isUnreserved(chr) || (passReserved && rfcCharHelper.isReserved(chr)) ? chr : pctEncoder.encodeCharacter(chr);
        }
        return result;
    }

    function encodePassReserved (text) {
        return encode(text, true);
    }

    function encodeLiteralCharacter (literal, index) {
        var chr = pctEncoder.pctCharAt(literal, index);
        if (chr.length > 1) {
            return chr;
        }
        else {
            return rfcCharHelper.isReserved(chr) || rfcCharHelper.isUnreserved(chr) ? chr : pctEncoder.encodeCharacter(chr);
        }
    }

    function encodeLiteral (literal) {
        var
            result = '',
            index,
            chr = '';
        for (index = 0; index < literal.length; index += chr.length) {
            chr = pctEncoder.pctCharAt(literal, index);
            if (chr.length > 1) {
                result += chr;
            }
            else {
                result += rfcCharHelper.isReserved(chr) || rfcCharHelper.isUnreserved(chr) ? chr : pctEncoder.encodeCharacter(chr);
            }
        }
        return result;
    }

    return {
        encode: encode,
        encodePassReserved: encodePassReserved,
        encodeLiteral: encodeLiteral,
        encodeLiteralCharacter: encodeLiteralCharacter
    };

}());


// the operators defined by rfc 6570
var operators = (function () {

    var
        bySymbol = {};

    function create (symbol) {
        bySymbol[symbol] = {
            symbol: symbol,
            separator: (symbol === '?') ? '&' : (symbol === '' || symbol === '+' || symbol === '#') ? ',' : symbol,
            named: symbol === ';' || symbol === '&' || symbol === '?',
            ifEmpty: (symbol === '&' || symbol === '?') ? '=' : '',
            first: (symbol === '+' ) ? '' : symbol,
            encode: (symbol === '+' || symbol === '#') ? encodingHelper.encodePassReserved : encodingHelper.encode,
            toString: function () {
                return this.symbol;
            }
        };
    }

    create('');
    create('+');
    create('#');
    create('.');
    create('/');
    create(';');
    create('?');
    create('&');
    return {
        valueOf: function (chr) {
            if (bySymbol[chr]) {
                return bySymbol[chr];
            }
            if ("=,!@|".indexOf(chr) >= 0) {
                return null;
            }
            return bySymbol[''];
        }
    };
}());


/**
 * Detects, whether a given element is defined in the sense of rfc 6570
 * Section 2.3 of the RFC makes clear defintions:
 * * undefined and null are not defined.
 * * the empty string is defined
 * * an array ("list") is defined, if it is not empty (even if all elements are not defined)
 * * an object ("map") is defined, if it contains at least one property with defined value
 * @param object
 * @return {Boolean}
 */
function isDefined (object) {
    var
        propertyName;
    if (object === null || object === undefined) {
        return false;
    }
    if (objectHelper.isArray(object)) {
        // Section 2.3: A variable defined as a list value is considered undefined if the list contains zero members
        return object.length > 0;
    }
    if (typeof object === "string" || typeof object === "number" || typeof object === "boolean") {
        // falsy values like empty strings, false or 0 are "defined"
        return true;
    }
    // else Object
    for (propertyName in object) {
        if (object.hasOwnProperty(propertyName) && isDefined(object[propertyName])) {
            return true;
        }
    }
    return false;
}

var LiteralExpression = (function () {
    function LiteralExpression (literal) {
        this.literal = encodingHelper.encodeLiteral(literal);
    }

    LiteralExpression.prototype.expand = function () {
        return this.literal;
    };

    LiteralExpression.prototype.toString = LiteralExpression.prototype.expand;

    return LiteralExpression;
}());

var parse = (function () {

    function parseExpression (expressionText) {
        var
            operator,
            varspecs = [],
            varspec = null,
            varnameStart = null,
            maxLengthStart = null,
            index,
            chr = '';

        function closeVarname () {
            var varname = expressionText.substring(varnameStart, index);
            if (varname.length === 0) {
                throw new UriTemplateError({expressionText: expressionText, message: "a varname must be specified", position: index});
            }
            varspec = {varname: varname, exploded: false, maxLength: null};
            varnameStart = null;
        }

        function closeMaxLength () {
            if (maxLengthStart === index) {
                throw new UriTemplateError({expressionText: expressionText, message: "after a ':' you have to specify the length", position: index});
            }
            varspec.maxLength = parseInt(expressionText.substring(maxLengthStart, index), 10);
            maxLengthStart = null;
        }

        operator = (function (operatorText) {
            var op = operators.valueOf(operatorText);
            if (op === null) {
                throw new UriTemplateError({expressionText: expressionText, message: "illegal use of reserved operator", position: index, operator: operatorText});
            }
            return op;
        }(expressionText.charAt(0)));
        index = operator.symbol.length;

        varnameStart = index;

        for (; index < expressionText.length; index += chr.length) {
            chr = pctEncoder.pctCharAt(expressionText, index);

            if (varnameStart !== null) {
                // the spec says: varname =  varchar *( ["."] varchar )
                // so a dot is allowed except for the first char
                if (chr === '.') {
                    if (varnameStart === index) {
                        throw new UriTemplateError({expressionText: expressionText, message: "a varname MUST NOT start with a dot", position: index});
                    }
                    continue;
                }
                if (rfcCharHelper.isVarchar(chr)) {
                    continue;
                }
                closeVarname();
            }
            if (maxLengthStart !== null) {
                if (index === maxLengthStart && chr === '0') {
                    throw new UriTemplateError({expressionText: expressionText, message: "A :prefix must not start with digit 0", position: index});
                }
                if (charHelper.isDigit(chr)) {
                    if (index - maxLengthStart >= 4) {
                        throw new UriTemplateError({expressionText: expressionText, message: "A :prefix must have max 4 digits", position: index});
                    }
                    continue;
                }
                closeMaxLength();
            }
            if (chr === ':') {
                if (varspec.maxLength !== null) {
                    throw new UriTemplateError({expressionText: expressionText, message: "only one :maxLength is allowed per varspec", position: index});
                }
                if (varspec.exploded) {
                    throw new UriTemplateError({expressionText: expressionText, message: "an exploeded varspec MUST NOT be varspeced", position: index});
                }
                maxLengthStart = index + 1;
                continue;
            }
            if (chr === '*') {
                if (varspec === null) {
                    throw new UriTemplateError({expressionText: expressionText, message: "exploded without varspec", position: index});
                }
                if (varspec.exploded) {
                    throw new UriTemplateError({expressionText: expressionText, message: "exploded twice", position: index});
                }
                if (varspec.maxLength) {
                    throw new UriTemplateError({expressionText: expressionText, message: "an explode (*) MUST NOT follow to a prefix", position: index});
                }
                varspec.exploded = true;
                continue;
            }
            // the only legal character now is the comma
            if (chr === ',') {
                varspecs.push(varspec);
                varspec = null;
                varnameStart = index + 1;
                continue;
            }
            throw new UriTemplateError({expressionText: expressionText, message: "illegal character", character: chr, position: index});
        } // for chr
        if (varnameStart !== null) {
            closeVarname();
        }
        if (maxLengthStart !== null) {
            closeMaxLength();
        }
        varspecs.push(varspec);
        return new VariableExpression(expressionText, operator, varspecs);
    }

    function parse (uriTemplateText) {
        // assert filled string
        var
            index,
            chr,
            expressions = [],
            braceOpenIndex = null,
            literalStart = 0;
        for (index = 0; index < uriTemplateText.length; index += 1) {
            chr = uriTemplateText.charAt(index);
            if (literalStart !== null) {
                if (chr === '}') {
                    throw new UriTemplateError({templateText: uriTemplateText, message: "unopened brace closed", position: index});
                }
                if (chr === '{') {
                    if (literalStart < index) {
                        expressions.push(new LiteralExpression(uriTemplateText.substring(literalStart, index)));
                    }
                    literalStart = null;
                    braceOpenIndex = index;
                }
                continue;
            }

            if (braceOpenIndex !== null) {
                // here just { is forbidden
                if (chr === '{') {
                    throw new UriTemplateError({templateText: uriTemplateText, message: "brace already opened", position: index});
                }
                if (chr === '}') {
                    if (braceOpenIndex + 1 === index) {
                        throw new UriTemplateError({templateText: uriTemplateText, message: "empty braces", position: braceOpenIndex});
                    }
                    try {
                        expressions.push(parseExpression(uriTemplateText.substring(braceOpenIndex + 1, index)));
                    }
                    catch (error) {
                        if (error.prototype === UriTemplateError.prototype) {
                            throw new UriTemplateError({templateText: uriTemplateText, message: error.options.message, position: braceOpenIndex + error.options.position, details: error.options});
                        }
                        throw error;
                    }
                    braceOpenIndex = null;
                    literalStart = index + 1;
                }
                continue;
            }
            throw new Error('reached unreachable code');
        }
        if (braceOpenIndex !== null) {
            throw new UriTemplateError({templateText: uriTemplateText, message: "unclosed brace", position: braceOpenIndex});
        }
        if (literalStart < uriTemplateText.length) {
            expressions.push(new LiteralExpression(uriTemplateText.substr(literalStart)));
        }
        return new UriTemplate(uriTemplateText, expressions);
    }

    return parse;
}());

var VariableExpression = (function () {
    // helper function if JSON is not available
    function prettyPrint (value) {
        return (JSON && JSON.stringify) ? JSON.stringify(value) : value;
    }

    function isEmpty (value) {
        if (!isDefined(value)) {
            return true;
        }
        if (objectHelper.isString(value)) {
            return value === '';
        }
        if (objectHelper.isNumber(value) || objectHelper.isBoolean(value)) {
            return false;
        }
        if (objectHelper.isArray(value)) {
            return value.length === 0;
        }
        for (var propertyName in value) {
            if (value.hasOwnProperty(propertyName)) {
                return false;
            }
        }
        return true;
    }

    function propertyArray (object) {
        var
            result = [],
            propertyName;
        for (propertyName in object) {
            if (object.hasOwnProperty(propertyName)) {
                result.push({name: propertyName, value: object[propertyName]});
            }
        }
        return result;
    }

    function VariableExpression (templateText, operator, varspecs) {
        this.templateText = templateText;
        this.operator = operator;
        this.varspecs = varspecs;
    }

    VariableExpression.prototype.toString = function () {
        return this.templateText;
    };

    function expandSimpleValue(varspec, operator, value) {
        var result = '';
        value = value.toString();
        if (operator.named) {
            result += encodingHelper.encodeLiteral(varspec.varname);
            if (value === '') {
                result += operator.ifEmpty;
                return result;
            }
            result += '=';
        }
        if (varspec.maxLength !== null) {
            value = value.substr(0, varspec.maxLength);
        }
        result += operator.encode(value);
        return result;
    }

    function valueDefined (nameValue) {
        return isDefined(nameValue.value);
    }

    function expandNotExploded(varspec, operator, value) {
        var
            arr = [],
            result = '';
        if (operator.named) {
            result += encodingHelper.encodeLiteral(varspec.varname);
            if (isEmpty(value)) {
                result += operator.ifEmpty;
                return result;
            }
            result += '=';
        }
        if (objectHelper.isArray(value)) {
            arr = value;
            arr = objectHelper.filter(arr, isDefined);
            arr = objectHelper.map(arr, operator.encode);
            result += objectHelper.join(arr, ',');
        }
        else {
            arr = propertyArray(value);
            arr = objectHelper.filter(arr, valueDefined);
            arr = objectHelper.map(arr, function (nameValue) {
                return operator.encode(nameValue.name) + ',' + operator.encode(nameValue.value);
            });
            result += objectHelper.join(arr, ',');
        }
        return result;
    }

    function expandExplodedNamed (varspec, operator, value) {
        var
            isArray = objectHelper.isArray(value),
            arr = [];
        if (isArray) {
            arr = value;
            arr = objectHelper.filter(arr, isDefined);
            arr = objectHelper.map(arr, function (listElement) {
                var tmp = encodingHelper.encodeLiteral(varspec.varname);
                if (isEmpty(listElement)) {
                    tmp += operator.ifEmpty;
                }
                else {
                    tmp += '=' + operator.encode(listElement);
                }
                return tmp;
            });
        }
        else {
            arr = propertyArray(value);
            arr = objectHelper.filter(arr, valueDefined);
            arr = objectHelper.map(arr, function (nameValue) {
                var tmp = encodingHelper.encodeLiteral(nameValue.name);
                if (isEmpty(nameValue.value)) {
                    tmp += operator.ifEmpty;
                }
                else {
                    tmp += '=' + operator.encode(nameValue.value);
                }
                return tmp;
            });
        }
        return objectHelper.join(arr, operator.separator);
    }

    function expandExplodedUnnamed (operator, value) {
        var
            arr = [],
            result = '';
        if (objectHelper.isArray(value)) {
            arr = value;
            arr = objectHelper.filter(arr, isDefined);
            arr = objectHelper.map(arr, operator.encode);
            result += objectHelper.join(arr, operator.separator);
        }
        else {
            arr = propertyArray(value);
            arr = objectHelper.filter(arr, function (nameValue) {
                return isDefined(nameValue.value);
            });
            arr = objectHelper.map(arr, function (nameValue) {
                return operator.encode(nameValue.name) + '=' + operator.encode(nameValue.value);
            });
            result += objectHelper.join(arr, operator.separator);
        }
        return result;
    }


    VariableExpression.prototype.expand = function (variables) {
        var
            expanded = [],
            index,
            varspec,
            value,
            valueIsArr,
            oneExploded = false,
            operator = this.operator;

        // expand each varspec and join with operator's separator
        for (index = 0; index < this.varspecs.length; index += 1) {
            varspec = this.varspecs[index];
            value = variables[varspec.varname];
            // if (!isDefined(value)) {
            // if (variables.hasOwnProperty(varspec.name)) {
            if (value === null || value === undefined) {
                continue;
            }
            if (varspec.exploded) {
                oneExploded = true;
            }
            valueIsArr = objectHelper.isArray(value);
            if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
                expanded.push(expandSimpleValue(varspec, operator, value));
            }
            else if (varspec.maxLength && isDefined(value)) {
                // 2.4.1 of the spec says: "Prefix modifiers are not applicable to variables that have composite values."
                throw new Error('Prefix modifiers are not applicable to variables that have composite values. You tried to expand ' + this + " with " + prettyPrint(value));
            }
            else if (!varspec.exploded) {
                if (operator.named || !isEmpty(value)) {
                    expanded.push(expandNotExploded(varspec, operator, value));
                }
            }
            else if (isDefined(value)) {
                if (operator.named) {
                    expanded.push(expandExplodedNamed(varspec, operator, value));
                }
                else {
                    expanded.push(expandExplodedUnnamed(operator, value));
                }
            }
        }

        if (expanded.length === 0) {
            return "";
        }
        else {
            return operator.first + objectHelper.join(expanded, operator.separator);
        }
    };

    return VariableExpression;
}());

var UriTemplate = (function () {
    function UriTemplate (templateText, expressions) {
        this.templateText = templateText;
        this.expressions = expressions;
        objectHelper.deepFreeze(this);
    }

    UriTemplate.prototype.toString = function () {
        return this.templateText;
    };

    UriTemplate.prototype.expand = function (variables) {
        // this.expressions.map(function (expression) {return expression.expand(variables);}).join('');
        var
            index,
            result = '';
        for (index = 0; index < this.expressions.length; index += 1) {
            result += this.expressions[index].expand(variables);
        }
        return result;
    };

    UriTemplate.parse = parse;
    UriTemplate.UriTemplateError = UriTemplateError;
    return UriTemplate;
}());

    exportCallback(UriTemplate);

}(function (UriTemplate) {
        "use strict";
        // export UriTemplate, when module is present, or pass it to window or global
        if (typeof module !== "undefined") {
            module.exports = UriTemplate;
        }
        else if (typeof define === "function") {
            define([],function() {
                return UriTemplate;
            });
        }
        else if (typeof window !== "undefined") {
            window.UriTemplate = UriTemplate;
        }
        else {
            global.UriTemplate = UriTemplate;
        }
    }
));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],121:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var punycode = require('punycode');
var util = require('./util');

exports.parse = urlParse;
exports.resolve = urlResolve;
exports.resolveObject = urlResolveObject;
exports.format = urlFormat;

exports.Url = Url;

function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.host = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.query = null;
  this.pathname = null;
  this.path = null;
  this.href = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // Special case for a simple path URL
    simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    // RFC 2396: characters not allowed for various reasons.
    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = ['\''].concat(unwise),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
    hostEndingChars = ['/', '?', '#'],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    querystring = require('querystring');

function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (url && util.isObject(url) && url instanceof Url) return url;

  var u = new Url;
  u.parse(url, parseQueryString, slashesDenoteHost);
  return u;
}

Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
  if (!util.isString(url)) {
    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
  }

  // Copy chrome, IE, opera backslash-handling behavior.
  // Back slashes before the query string get converted to forward slashes
  // See: https://code.google.com/p/chromium/issues/detail?id=25916
  var queryIndex = url.indexOf('?'),
      splitter =
          (queryIndex !== -1 && queryIndex < url.indexOf('#')) ? '?' : '#',
      uSplit = url.split(splitter),
      slashRegex = /\\/g;
  uSplit[0] = uSplit[0].replace(slashRegex, '/');
  url = uSplit.join(splitter);

  var rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  if (!slashesDenoteHost && url.split('#').length === 1) {
    // Try fast path regexp
    var simplePath = simplePathPattern.exec(rest);
    if (simplePath) {
      this.path = rest;
      this.href = rest;
      this.pathname = simplePath[1];
      if (simplePath[2]) {
        this.search = simplePath[2];
        if (parseQueryString) {
          this.query = querystring.parse(this.search.substr(1));
        } else {
          this.query = this.search.substr(1);
        }
      } else if (parseQueryString) {
        this.search = '';
        this.query = {};
      }
      return this;
    }
  }

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    this.protocol = lowerProto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    var slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {

    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    var hostEnd = -1;
    for (var i = 0; i < hostEndingChars.length; i++) {
      var hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    var auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = decodeURIComponent(auth);
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (var i = 0; i < nonHostChars.length; i++) {
      var hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1)
      hostEnd = rest.length;

    this.host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost();

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      var hostparts = this.hostname.split(/\./);
      for (var i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) continue;
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = '/' + notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    } else {
      // hostnames are always lower case.
      this.hostname = this.hostname.toLowerCase();
    }

    if (!ipv6Hostname) {
      // IDNA Support: Returns a punycoded representation of "domain".
      // It only converts parts of the domain name that
      // have non-ASCII characters, i.e. it doesn't matter if
      // you call it with a domain that already is ASCII-only.
      this.hostname = punycode.toASCII(this.hostname);
    }

    var p = this.port ? ':' + this.port : '';
    var h = this.hostname || '';
    this.host = h + p;
    this.href += this.host;

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
      if (rest[0] !== '/') {
        rest = '/' + rest;
      }
    }
  }

  // now rest is set to the post-host stuff.
  // chop off any delim chars.
  if (!unsafeProtocol[lowerProto]) {

    // First, make 100% sure that any "autoEscape" chars get
    // escaped, even if encodeURIComponent doesn't think they
    // need to be.
    for (var i = 0, l = autoEscape.length; i < l; i++) {
      var ae = autoEscape[i];
      if (rest.indexOf(ae) === -1)
        continue;
      var esc = encodeURIComponent(ae);
      if (esc === ae) {
        esc = escape(ae);
      }
      rest = rest.split(ae).join(esc);
    }
  }


  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    this.query = rest.substr(qm + 1);
    if (parseQueryString) {
      this.query = querystring.parse(this.query);
    }
    rest = rest.slice(0, qm);
  } else if (parseQueryString) {
    // no query string, but parseQueryString still requested
    this.search = '';
    this.query = {};
  }
  if (rest) this.pathname = rest;
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '/';
  }

  //to support http.request
  if (this.pathname || this.search) {
    var p = this.pathname || '';
    var s = this.search || '';
    this.path = p + s;
  }

  // finally, reconstruct the href based on what has been validated.
  this.href = this.format();
  return this;
};

// format a parsed object into a url string
function urlFormat(obj) {
  // ensure it's an object, and not a string url.
  // If it's an obj, this is a no-op.
  // this way, you can call url_format() on strings
  // to clean up potentially wonky urls.
  if (util.isString(obj)) obj = urlParse(obj);
  if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
  return obj.format();
}

Url.prototype.format = function() {
  var auth = this.auth || '';
  if (auth) {
    auth = encodeURIComponent(auth);
    auth = auth.replace(/%3A/i, ':');
    auth += '@';
  }

  var protocol = this.protocol || '',
      pathname = this.pathname || '',
      hash = this.hash || '',
      host = false,
      query = '';

  if (this.host) {
    host = auth + this.host;
  } else if (this.hostname) {
    host = auth + (this.hostname.indexOf(':') === -1 ?
        this.hostname :
        '[' + this.hostname + ']');
    if (this.port) {
      host += ':' + this.port;
    }
  }

  if (this.query &&
      util.isObject(this.query) &&
      Object.keys(this.query).length) {
    query = querystring.stringify(this.query);
  }

  var search = this.search || (query && ('?' + query)) || '';

  if (protocol && protocol.substr(-1) !== ':') protocol += ':';

  // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
  // unless they had them to begin with.
  if (this.slashes ||
      (!protocol || slashedProtocol[protocol]) && host !== false) {
    host = '//' + (host || '');
    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
  } else if (!host) {
    host = '';
  }

  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
  if (search && search.charAt(0) !== '?') search = '?' + search;

  pathname = pathname.replace(/[?#]/g, function(match) {
    return encodeURIComponent(match);
  });
  search = search.replace('#', '%23');

  return protocol + host + pathname + search + hash;
};

function urlResolve(source, relative) {
  return urlParse(source, false, true).resolve(relative);
}

Url.prototype.resolve = function(relative) {
  return this.resolveObject(urlParse(relative, false, true)).format();
};

function urlResolveObject(source, relative) {
  if (!source) return relative;
  return urlParse(source, false, true).resolveObject(relative);
}

Url.prototype.resolveObject = function(relative) {
  if (util.isString(relative)) {
    var rel = new Url();
    rel.parse(relative, false, true);
    relative = rel;
  }

  var result = new Url();
  var tkeys = Object.keys(this);
  for (var tk = 0; tk < tkeys.length; tk++) {
    var tkey = tkeys[tk];
    result[tkey] = this[tkey];
  }

  // hash is always overridden, no matter what.
  // even href="" will remove it.
  result.hash = relative.hash;

  // if the relative url is empty, then there's nothing left to do here.
  if (relative.href === '') {
    result.href = result.format();
    return result;
  }

  // hrefs like //foo/bar always cut to the protocol.
  if (relative.slashes && !relative.protocol) {
    // take everything except the protocol from relative
    var rkeys = Object.keys(relative);
    for (var rk = 0; rk < rkeys.length; rk++) {
      var rkey = rkeys[rk];
      if (rkey !== 'protocol')
        result[rkey] = relative[rkey];
    }

    //urlParse appends trailing / to urls like http://www.example.com
    if (slashedProtocol[result.protocol] &&
        result.hostname && !result.pathname) {
      result.path = result.pathname = '/';
    }

    result.href = result.format();
    return result;
  }

  if (relative.protocol && relative.protocol !== result.protocol) {
    // if it's a known url protocol, then changing
    // the protocol does weird things
    // first, if it's not file:, then we MUST have a host,
    // and if there was a path
    // to begin with, then we MUST have a path.
    // if it is file:, then the host is dropped,
    // because that's known to be hostless.
    // anything else is assumed to be absolute.
    if (!slashedProtocol[relative.protocol]) {
      var keys = Object.keys(relative);
      for (var v = 0; v < keys.length; v++) {
        var k = keys[v];
        result[k] = relative[k];
      }
      result.href = result.format();
      return result;
    }

    result.protocol = relative.protocol;
    if (!relative.host && !hostlessProtocol[relative.protocol]) {
      var relPath = (relative.pathname || '').split('/');
      while (relPath.length && !(relative.host = relPath.shift()));
      if (!relative.host) relative.host = '';
      if (!relative.hostname) relative.hostname = '';
      if (relPath[0] !== '') relPath.unshift('');
      if (relPath.length < 2) relPath.unshift('');
      result.pathname = relPath.join('/');
    } else {
      result.pathname = relative.pathname;
    }
    result.search = relative.search;
    result.query = relative.query;
    result.host = relative.host || '';
    result.auth = relative.auth;
    result.hostname = relative.hostname || relative.host;
    result.port = relative.port;
    // to support http.request
    if (result.pathname || result.search) {
      var p = result.pathname || '';
      var s = result.search || '';
      result.path = p + s;
    }
    result.slashes = result.slashes || relative.slashes;
    result.href = result.format();
    return result;
  }

  var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
      isRelAbs = (
          relative.host ||
          relative.pathname && relative.pathname.charAt(0) === '/'
      ),
      mustEndAbs = (isRelAbs || isSourceAbs ||
                    (result.host && relative.pathname)),
      removeAllDots = mustEndAbs,
      srcPath = result.pathname && result.pathname.split('/') || [],
      relPath = relative.pathname && relative.pathname.split('/') || [],
      psychotic = result.protocol && !slashedProtocol[result.protocol];

  // if the url is a non-slashed url, then relative
  // links like ../.. should be able
  // to crawl up to the hostname, as well.  This is strange.
  // result.protocol has already been set by now.
  // Later on, put the first path part into the host field.
  if (psychotic) {
    result.hostname = '';
    result.port = null;
    if (result.host) {
      if (srcPath[0] === '') srcPath[0] = result.host;
      else srcPath.unshift(result.host);
    }
    result.host = '';
    if (relative.protocol) {
      relative.hostname = null;
      relative.port = null;
      if (relative.host) {
        if (relPath[0] === '') relPath[0] = relative.host;
        else relPath.unshift(relative.host);
      }
      relative.host = null;
    }
    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
  }

  if (isRelAbs) {
    // it's absolute.
    result.host = (relative.host || relative.host === '') ?
                  relative.host : result.host;
    result.hostname = (relative.hostname || relative.hostname === '') ?
                      relative.hostname : result.hostname;
    result.search = relative.search;
    result.query = relative.query;
    srcPath = relPath;
    // fall through to the dot-handling below.
  } else if (relPath.length) {
    // it's relative
    // throw away the existing file, and take the new path instead.
    if (!srcPath) srcPath = [];
    srcPath.pop();
    srcPath = srcPath.concat(relPath);
    result.search = relative.search;
    result.query = relative.query;
  } else if (!util.isNullOrUndefined(relative.search)) {
    // just pull out the search.
    // like href='?foo'.
    // Put this after the other two cases because it simplifies the booleans
    if (psychotic) {
      result.hostname = result.host = srcPath.shift();
      //occationaly the auth can get stuck only in host
      //this especially happens in cases like
      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
      var authInHost = result.host && result.host.indexOf('@') > 0 ?
                       result.host.split('@') : false;
      if (authInHost) {
        result.auth = authInHost.shift();
        result.host = result.hostname = authInHost.shift();
      }
    }
    result.search = relative.search;
    result.query = relative.query;
    //to support http.request
    if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
      result.path = (result.pathname ? result.pathname : '') +
                    (result.search ? result.search : '');
    }
    result.href = result.format();
    return result;
  }

  if (!srcPath.length) {
    // no path at all.  easy.
    // we've already handled the other stuff above.
    result.pathname = null;
    //to support http.request
    if (result.search) {
      result.path = '/' + result.search;
    } else {
      result.path = null;
    }
    result.href = result.format();
    return result;
  }

  // if a url ENDs in . or .., then it must get a trailing slash.
  // however, if it ends in anything else non-slashy,
  // then it must NOT get a trailing slash.
  var last = srcPath.slice(-1)[0];
  var hasTrailingSlash = (
      (result.host || relative.host || srcPath.length > 1) &&
      (last === '.' || last === '..') || last === '');

  // strip single dots, resolve double dots to parent dir
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = srcPath.length; i >= 0; i--) {
    last = srcPath[i];
    if (last === '.') {
      srcPath.splice(i, 1);
    } else if (last === '..') {
      srcPath.splice(i, 1);
      up++;
    } else if (up) {
      srcPath.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (!mustEndAbs && !removeAllDots) {
    for (; up--; up) {
      srcPath.unshift('..');
    }
  }

  if (mustEndAbs && srcPath[0] !== '' &&
      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
    srcPath.unshift('');
  }

  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
    srcPath.push('');
  }

  var isAbsolute = srcPath[0] === '' ||
      (srcPath[0] && srcPath[0].charAt(0) === '/');

  // put the host back
  if (psychotic) {
    result.hostname = result.host = isAbsolute ? '' :
                                    srcPath.length ? srcPath.shift() : '';
    //occationaly the auth can get stuck only in host
    //this especially happens in cases like
    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
    var authInHost = result.host && result.host.indexOf('@') > 0 ?
                     result.host.split('@') : false;
    if (authInHost) {
      result.auth = authInHost.shift();
      result.host = result.hostname = authInHost.shift();
    }
  }

  mustEndAbs = mustEndAbs || (result.host && srcPath.length);

  if (mustEndAbs && !isAbsolute) {
    srcPath.unshift('');
  }

  if (!srcPath.length) {
    result.pathname = null;
    result.path = null;
  } else {
    result.pathname = srcPath.join('/');
  }

  //to support request.http
  if (!util.isNull(result.pathname) || !util.isNull(result.search)) {
    result.path = (result.pathname ? result.pathname : '') +
                  (result.search ? result.search : '');
  }
  result.auth = relative.auth || result.auth;
  result.slashes = result.slashes || relative.slashes;
  result.href = result.format();
  return result;
};

Url.prototype.parseHost = function() {
  var host = this.host;
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) this.hostname = host;
};

},{"./util":122,"punycode":99,"querystring":103}],122:[function(require,module,exports){
'use strict';

module.exports = {
  isString: function(arg) {
    return typeof(arg) === 'string';
  },
  isObject: function(arg) {
    return typeof(arg) === 'object' && arg !== null;
  },
  isNull: function(arg) {
    return arg === null;
  },
  isNullOrUndefined: function(arg) {
    return arg == null;
  }
};

},{}],123:[function(require,module,exports){
(function (global){

/**
 * Module exports.
 */

module.exports = deprecate;

/**
 * Mark that a method should not be used.
 * Returns a modified function which warns once by default.
 *
 * If `localStorage.noDeprecation = true` is set, then it is a no-op.
 *
 * If `localStorage.throwDeprecation = true` is set, then deprecated functions
 * will throw an Error when invoked.
 *
 * If `localStorage.traceDeprecation = true` is set, then deprecated functions
 * will invoke `console.trace()` instead of `console.error()`.
 *
 * @param {Function} fn - the function to deprecate
 * @param {String} msg - the string to print to the console when `fn` is invoked
 * @returns {Function} a new "deprecated" version of `fn`
 * @api public
 */

function deprecate (fn, msg) {
  if (config('noDeprecation')) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (config('throwDeprecation')) {
        throw new Error(msg);
      } else if (config('traceDeprecation')) {
        console.trace(msg);
      } else {
        console.warn(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
}

/**
 * Checks `localStorage` for boolean values for the given `name`.
 *
 * @param {String} name
 * @returns {Boolean}
 * @api private
 */

function config (name) {
  // accessing global.localStorage can trigger a DOMException in sandboxed iframes
  try {
    if (!global.localStorage) return false;
  } catch (_) {
    return false;
  }
  var val = global.localStorage[name];
  if (null == val) return false;
  return String(val).toLowerCase() === 'true';
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],124:[function(require,module,exports){
module.exports = extend

var hasOwnProperty = Object.prototype.hasOwnProperty;

function extend() {
    var target = {}

    for (var i = 0; i < arguments.length; i++) {
        var source = arguments[i]

        for (var key in source) {
            if (hasOwnProperty.call(source, key)) {
                target[key] = source[key]
            }
        }
    }

    return target
}

},{}]},{},[19])(19)
});
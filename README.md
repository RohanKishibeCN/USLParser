# USL JS


[![npm version](https://badge.fury.io/js/%40usl%2Fusl-js.svg)](https://badge.fury.io/js/%40usl%2Fusl-js)

A JavaScript parser for [USL](http://usl.io).

### Contributing
If you are interested in contributing some code to this project, thanks! - Watch this space :-)

To discuss this project, please use its [github issues](https://github.com/usl-org/usl.tooling.parsers.usl-js/issues).

## Usage for NodeJS

### Load

Loading a USL file is as easy as follows:

```javascript
  var usl = require('usl-js');

  usl.loadFile('myAPI.usl').then( function(data) {
    console.log(data);
  }, function(error) {
    console.log('Error parsing: ' + error);
  });
```

You can alternatively load from a string containing the api definition:

```javascript
  var usl = require('usl-js');

  var definition = [
    '#%USL 0.1',
    '---',
    'title: MyApi',
    'baseUri: http://myapi.com',
    '/Root:'
  ].join('\n');

  usl.load(definition).then( function(data) {
    console.log(data);
  }, function(error) {
    console.log('Error parsing: ' + error);
  });
```

The shape of the returned object is (unofficially) documented in this [Typescript interface](https://github.com/aldonline/usl-typescript).

### Abstract Syntax Tree

Generating an AST from a USL file is as easy as follows:

```javascript
  var usl = require('usl-js');

  var myAPI;
  usl.composeFile('myAPI.usl').then( function(rootNode) {
    console.log('Root Node: ' + rootNode)
  }, function(error) {
    console.log('Error parsing: ' + error);
  });
```

you can also alternatively generate an AST from a string containing the api definition:

```javascript
  var usl = require('usl-js');

  var definition = [
    '#%USL 0.1',
    '---',
    'title: MyApi',
    'baseUri: http://myapi.com',
    '/Root:'
  ].join('\n');

  usl.compose(definition).then( function(rootNode) {
    console.log('Root Node: ' + rootNode)
  }, function(error) {
    console.log('Error parsing: ' + error);
  });
```

## Usage for In-Browser

Using the USL parser from inside the browser requires the user to actually
include the USL javascript file in a script tag as follows:

```html
<script src="usl-js.min.js"></script>
```

from there on the usage is pretty much the same as NodeJS, the script
defines a *USL.Parser* object globally which can be used as follows:

```javascript
USL.Parser.loadFile('http://localhost:9001/myAPI.usl').then( function(data) {
  console.log(data)
}, function(error) {
  console.log('Error parsing: ' + error);
});
```

Notice that the in-browser version can fetch remote API definitions via XHR.

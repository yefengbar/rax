import ConcatSource from 'webpack/lib/ConcatSource';
import fs from 'fs';
import path from 'path';

const POLYFILLS = [
  path.join(__dirname, 'polyfills/require.js'),
  path.join(__dirname, 'polyfills/array.js'),
  path.join(__dirname, 'polyfills/object.js'),
];

export default class CustomUmdMainTemplatePlugin {

  constructor(options){
    this.name = '[name]';
    this.options = options;
  }

  apply(compilation){

    let mainTemplate = compilation.mainTemplate;

    compilation.templatesPlugin('render-with-entry', (source, chunk, hash) => {

      let externals = chunk.modules.filter( m => {
        return m.external;
      });
      let externalsDepsArray = externals.map( m => {
        return typeof m.request === 'object' ? m.request.amd : m.request;
      });
      let externalsArguments = externals.map( m => {
        return '__WEBPACK_EXTERNAL_MODULE_' + m.id + '__';
      });

      externalsArguments = externalsArguments.join(', ');
      externalsDepsArray = JSON.stringify(externalsDepsArray);

      let requireCall = '';
      let polyfills = [];
      let name = mainTemplate.applyPluginsWaterfall('asset-path', this.name, {
        hash: hash,
        chunk: chunk
      });

      if (this.options.includePolyfills) {
        let includePolyfills = POLYFILLS;
        if (Array.isArray(this.options.includePolyfills)) {
          includePolyfills = this.options.includePolyfills;
        }
        polyfills = includePolyfills.map((fp) => {
          return fs.readFileSync(fp, 'utf8');
        });
      }

      if (this.options.runMainModule) {
        requireCall = `
if (typeof require === "function"){
  require(${JSON.stringify(name)});
}`;
      }

      let moduleName = this.options.moduleName || name;
      let globalName = this.options.globalName || name;

      let sourcePrefix = `
;(function(f) {
  if (typeof define === "function"){
    define(${JSON.stringify(moduleName)}, ${externalsDepsArray}, function(require, exports, module){
      module.exports = f();
    });
  } else {
    var g;
    if (typeof window !== "undefined") {
      g = window;
    } else if (typeof global !== "undefined") {
      g = global;
    } else if (typeof self !== "undefined") {
      g = self;
    } else {
      // NOTICE: In JavaScript strict mode, this is null
      g = this;
    }
    g.${globalName} = f();
  }
})(function(){
  return`;
      let sourceSuffix = `});`;

      return new ConcatSource(
        polyfills.join('\n'),
        sourcePrefix,
        source,
        sourceSuffix,
        requireCall
      );
    });

    mainTemplate.plugin('global-hash-paths', (paths) => {
      if(this.name) paths = paths.concat(this.name);
		  return paths;
    });

    mainTemplate.plugin('hash', (hash) => {
      hash.update('custom-umd');
      hash.update(String(this.name));
    });
  }
}
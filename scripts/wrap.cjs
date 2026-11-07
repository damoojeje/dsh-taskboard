// Wrap an esbuild CommonJS output in the module-loader factory the Harness
// serves to the browser: factory(require) returns the plugin exports.
const fs = require('node:fs')

const [, , input, output] = process.argv
if (!input || !output) {
  console.error('usage: wrap.cjs <input.cjs.js> <output.js>')
  process.exit(1)
}

const body = fs.readFileSync(input, 'utf8')
const wrapped = `/* dsh-taskboard client bundle. Built with esbuild; React stays external and
   resolves through the page's shared module table. Do not hand-edit this file;
   edit src/client.jsx and run ./build.sh. */
window.__ModuleLoader__.load({
  id: 'dsh-taskboard',
  factory: function (require) {
    var module = { exports: {} };
    (function (module, exports, require) {
${body}
    })(module, module.exports, require);
    return module.exports;
  },
});
`

fs.mkdirSync(require('node:path').dirname(output), { recursive: true })
fs.writeFileSync(output, wrapped)

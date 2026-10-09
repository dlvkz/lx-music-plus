// Copies the changed native files of dependencies over the installed ones (run after npm install).
// react-native-track-player is pinned to a git commit (package.json), the files here are that commit's
// files with the changes: pitch, audio offload switch, ambient reverb (ConvolutionAudioProcessor).
const fs = require('fs')
const path = require('path')

const root = path.join(__dirname)
const copy = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const from = path.join(dir, name)
    if (fs.statSync(from).isDirectory()) {
      copy(from)
      continue
    }
    if (from == __filename) continue
    const to = path.join(__dirname, '..', 'node_modules', path.relative(root, from))
    if (!fs.existsSync(path.dirname(to))) continue
    fs.copyFileSync(from, to)
    console.log('patched', path.relative(path.join(__dirname, '..'), to))
  }
}
copy(root)

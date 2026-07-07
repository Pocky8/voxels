const fs = require('fs')
const path = require('path')

const files = [
  'VoxelizerModal.css',
  'OrbitExportModal.css',
  'HologramExportModal.css',
  'GreenscreenExportModal.css',
  'SketchModal.css'
]

files.forEach(f => {
  const filepath = path.join(__dirname, 'src', f)
  let content = fs.readFileSync(filepath, 'utf8')
  
  const wrapperClass = f === 'VoxelizerModal.css' ? '.modal' :
                       f === 'OrbitExportModal.css' ? '.orbit-modal' :
                       f === 'HologramExportModal.css' ? '.holo-modal' :
                       f === 'GreenscreenExportModal.css' ? '.gs-modal' :
                       f === 'SketchModal.css' ? '.sketch-modal' : ''
                       
  // 1. Remove overflow-y: auto; from the wrapper class block if it exists
  // and add flex layout
  const wrapperRegex = new RegExp(`(\\\\.${wrapperClass.slice(1)}\\s*\\{[^}]*\\})`, 'g')
  content = content.replace(wrapperRegex, (match) => {
    let newMatch = match.replace(/\s*overflow-y:\s*auto;/, '')
    if (!newMatch.includes('display: flex')) {
      newMatch = newMatch.replace('{', '{\n  display: flex;\n  flex-direction: column;')
    }
    return newMatch
  })

  // 2. Add overflow-y: auto; to the body class
  const bodyClass = wrapperClass + '__body'
  const bodyRegex = new RegExp(`(\\\\.${bodyClass.slice(1)}\\s*\\{[^}]*\\})`, 'g')
  content = content.replace(bodyRegex, (match) => {
    if (!match.includes('overflow-y: auto')) {
      return match.replace('{', '{\n  overflow-y: auto;\n  -webkit-overflow-scrolling: touch;')
    }
    return match
  })

  fs.writeFileSync(filepath, content)
  console.log(`Updated ${f}`)
})

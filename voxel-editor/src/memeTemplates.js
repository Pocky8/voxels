const svgDataUrl = (svg) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

const frame = (content) => svgDataUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
    <rect width="1200" height="800" fill="#f9f9f6"/>
    <path d="M0 80H1200M0 240H1200M0 400H1200M0 560H1200M0 720H1200" stroke="#d9d9d2" stroke-width="3"/>
    ${content}
    <rect x="18" y="18" width="1164" height="764" fill="none" stroke="#1a1a24" stroke-width="12"/>
  </svg>
`)

// These scenes are original UnFlat artwork, released CC0 so the canvas remains
// export-safe and the gallery does not depend on remote assets or third-party memes.
export const MEME_TEMPLATES = [
  {
    id: 'blank-meme-macro',
    name: 'Blank Meme Macro',
    license: 'CC0 · Atomicdragon136',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Blank_meme_macro.jpg',
    src: blankMemeMacro,
    width: 500,
    height: 500,
    // The Commons image includes example labels baked into the bitmap. Hide those
    // labels and replace them with actual editable caption layers in the editor.
    masks: [
      { x: 0, y: 0, width: 1, height: 0.22 },
      { x: 0, y: 0.78, width: 1, height: 0.22 },
    ],
    captionSlots: [
      { key: 'top', text: 'TOP TEXT', x: 0.06, y: 0.025, width: 0.88, height: 0.14, fontSize: 0.078 },
      { key: 'bottom', text: 'BOTTOM TEXT', x: 0.06, y: 0.835, width: 0.88, height: 0.14, fontSize: 0.078 },
    ],
  },
  {
    id: 'be-like-bill',
    name: 'Be Like Bill',
    license: 'CC0 · Spiritia',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Be-like-Bill-1lib1ref.png',
    src: beLikeBill,
    width: 727,
    height: 474,
  },
  {
    id: 'farmer',
    name: 'Honest Work',
    license: 'Public domain · Cakelot1 / USDA source',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Farmer_meme_with_apostrophe.jpg',
    src: farmerMeme,
    width: 3008,
    height: 1911,
  },
  {
    id: 'lego-y-u-no',
    name: 'LEGO Y U NO',
    license: 'Public domain · Ochre Jelly',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:LEGO_%22Y_U_NO_%22_meme_(Free_to_use).jpg',
    src: legoYuNo,
    width: 3648,
    height: 2736,
  },
  {
    id: 'two-choices',
    name: 'Two Choices',
    license: 'CC0 · Original UnFlat artwork',
    width: 1200,
    height: 800,
    src: frame(`
      <rect x="70" y="105" width="480" height="560" fill="#00ffff" stroke="#1a1a24" stroke-width="12"/>
      <rect x="650" y="105" width="480" height="560" fill="#ff00ff" stroke="#1a1a24" stroke-width="12"/>
      <circle cx="310" cy="370" r="140" fill="#ffea00" stroke="#1a1a24" stroke-width="12"/>
      <circle cx="890" cy="370" r="140" fill="#ffea00" stroke="#1a1a24" stroke-width="12"/>
      <path d="M235 340h35m80 0h35M250 425q60 55 120 0M830 340h35m80 0h35M830 430q60-55 120 0" fill="none" stroke="#1a1a24" stroke-width="18" stroke-linecap="square"/>
      <text x="310" y="610" text-anchor="middle" font-family="monospace" font-size="46" font-weight="bold">OPTION A</text>
      <text x="890" y="610" text-anchor="middle" font-family="monospace" font-size="46" font-weight="bold">OPTION B</text>
    `),
  },
  {
    id: 'reaction',
    name: 'The Reaction',
    license: 'CC0 · Original UnFlat artwork',
    width: 1200,
    height: 800,
    src: frame(`
      <rect x="70" y="105" width="1060" height="560" fill="#ffea00" stroke="#1a1a24" stroke-width="12"/>
      <path d="M70 545 280 350l165 120 140-210 175 230 145-150 225 205" fill="#00ffff" stroke="#1a1a24" stroke-width="12"/>
      <circle cx="600" cy="380" r="180" fill="#ff00ff" stroke="#1a1a24" stroke-width="14"/>
      <circle cx="530" cy="345" r="24" fill="#1a1a24"/><circle cx="670" cy="345" r="24" fill="#1a1a24"/>
      <path d="M480 445q120 120 240 0" fill="none" stroke="#1a1a24" stroke-width="22"/>
      <path d="m185 180 55 55m-55 0 55-55m720 0 55 55m-55 0 55-55" stroke="#1a1a24" stroke-width="18"/>
    `),
  },
  {
    id: 'deadline',
    name: 'Deadline',
    license: 'CC0 · Original UnFlat artwork',
    width: 1200,
    height: 800,
    src: frame(`
      <rect x="70" y="105" width="1060" height="560" fill="#00ffff" stroke="#1a1a24" stroke-width="12"/>
      <rect x="160" y="190" width="360" height="390" fill="#f9f9f6" stroke="#1a1a24" stroke-width="12"/>
      <path d="M220 260h240m-240 75h240m-240 75h180" stroke="#1a1a24" stroke-width="20"/>
      <circle cx="820" cy="380" r="175" fill="#ffea00" stroke="#1a1a24" stroke-width="14"/>
      <path d="M820 255v130l90 55" fill="none" stroke="#1a1a24" stroke-width="24" stroke-linecap="square"/>
      <path d="M690 175l45 45m210-45-45 45m-270 330 55-30m330 30-55-30" stroke="#ff00ff" stroke-width="24"/>
    `),
  },
  {
    id: 'galaxy-brain',
    name: 'Big Brain',
    license: 'CC0 · Original UnFlat artwork',
    width: 1200,
    height: 800,
    src: frame(`
      <rect x="70" y="105" width="1060" height="560" fill="#1a1a24" stroke="#1a1a24" stroke-width="12"/>
      <path d="M150 220h900M150 360h900M150 500h900" stroke="#ff00ff" stroke-width="18"/>
      <circle cx="600" cy="385" r="205" fill="#00ffff" stroke="#f9f9f6" stroke-width="14"/>
      <path d="M460 390q45-150 105 0q40-170 95 0q65-135 110 10M485 460q100 75 230 0" fill="none" stroke="#1a1a24" stroke-width="24"/>
      <path d="m240 175 30 30m-30 0 30-30m660 0 30 30m-30 0 30-30m-720 390 30 30m-30 0 30-30m660 0 30 30m-30 0 30-30" stroke="#ffea00" stroke-width="18"/>
    `),
  },
]
import beLikeBill from './assets/memes/be-like-bill.png'
import blankMemeMacro from './assets/memes/blank-meme-macro.jpg'
import farmerMeme from './assets/memes/farmer-meme.jpg'
import legoYuNo from './assets/memes/lego-y-u-no.jpg'

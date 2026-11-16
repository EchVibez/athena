// Builds import/fysik/manifest.json: the teacher's OneNote pages for Fysik 1b kap 1–5,
// grouped into linked notes, plus a written summary. Images come from render-pages.ps1.
import { writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(import.meta.dirname, '..', 'import', 'fysik')
const have = new Set(readdirSync(join(dir, 'img')))
const img = (...nums) => nums.flat().map((n) => `img/p${String(n).padStart(3, '0')}.jpg`).filter((p) => have.has(p.slice(4)))
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

const K12 = 'Kap 1–2 – Fysikens grunder'
const K3 = 'Kap 3 – Rörelse'
const K4 = 'Kap 4 – Kraft och rörelse'
const K5 = 'Kap 5 – Densitet och tryck'
const PROV = 'Prov 1 – inför provet'
const BOK = 'Övrigt – bokens lösningar'

const notes = [
  // Kap 1–2
  { key: 'k1-krafter', title: '1.1 Naturens krafter', kind: 'material', folder: K12, tags: ['krafter'], pages: img(68, 69), links: ['k2-storheter', 'k4-grav'] },
  { key: 'k2-storheter', title: '2.2 Storheter och enheter', kind: 'material', folder: K12, tags: ['enheter'], pages: img(range(70, 75)), links: ['k2-modeller'] },
  { key: 'k2-modeller', title: '2.1 Modeller och vetenskap', kind: 'material', folder: K12, tags: ['modeller'], pages: img(range(76, 79)), links: ['k3-lage'] },

  // Kap 3
  { key: 'k3-lage', title: '3.1 Läge och hastighet', kind: 'material', folder: K3, tags: ['rörelse'], pages: img(80, 81), links: ['k3-medel'] },
  { key: 'k3-medel', title: '3.2 Medel- och momentanhastighet', kind: 'material', folder: K3, tags: ['rörelse'], pages: img(82, 83, 84), links: ['k3-acc'] },
  { key: 'k3-acc', title: '3.3 Hastighet och acceleration', kind: 'material', folder: K3, tags: ['rörelse'], pages: img(85, 86, 87, 88), links: ['k3-fall'] },
  { key: 'k3-fall', title: '3.3 Fritt fall', kind: 'material', folder: K3, tags: ['rörelse'], pages: img(89, 90, 91), links: ['k3-formler', 'k4-n23'] },
  { key: 'k3-formler', title: '3.4 Formler vid konstant acceleration', kind: 'material', folder: K3, tags: ['rörelse', 'formler'], pages: img(range(92, 96)), links: ['k3-lab', 'k2-storheter'] },
  { key: 'k3-lab', title: 'Laboration 1 – Rörelse', kind: 'material', folder: K3, tags: ['labb'], pages: img(97, 98), links: ['k3-diag'] },
  { key: 'k3-diag', title: 'Diagnos kap 1–3', kind: 'uppgift', folder: K3, tags: ['diagnos', 'prov1'], pages: img(range(99, 104)), links: ['k3-diag-l', 'k3-lage', 'k3-medel', 'k3-acc', 'k3-formler'] },
  { key: 'k3-diag-l', title: 'Lösning – Diagnos kap 1–3', kind: 'losning', folder: K3, tags: ['diagnos', 'prov1'], pages: img(range(105, 108)), links: ['k3-diag'] },

  // Kap 4
  { key: 'k4-krafter', title: '4.1 Krafter av olika slag', kind: 'material', folder: K4, tags: ['kraft'], pages: img(range(109, 113)), links: ['k4-beskriva', 'k4-grav'] },
  { key: 'k4-beskriva', title: '4.2 Att beskriva en kraft', kind: 'material', folder: K4, tags: ['kraft'], pages: img(range(114, 119)), links: ['k4-n1'] },
  { key: 'k4-lab2', title: 'Laboration 2 – Hemlabb', kind: 'material', folder: K4, tags: ['labb'], pages: img(232, 233), links: ['k3-medel'] },
  { key: 'k4-n1', title: '4.3 Newtons första lag', kind: 'material', folder: K4, tags: ['kraft', 'newton'], pages: img(121, 122, 123), links: ['k4-n23'] },
  { key: 'k4-n23', title: '4.3 Newtons andra och tredje lag', kind: 'material', folder: K4, tags: ['kraft', 'newton'], pages: img(range(124, 127)), links: ['k4-friktion', 'k3-acc'] },
  { key: 'k4-friktion', title: '4.4 Friktion', kind: 'material', folder: K4, tags: ['kraft'], pages: img(128, 129, 130), links: ['k4-grav', 'k4-n1'] },
  { key: 'k4-grav', title: '4.5 Newtons gravitationslag', kind: 'material', folder: K4, tags: ['kraft', 'newton'], pages: img(131, 132), links: ['k4-diag'] },
  { key: 'k4-diag', title: 'Diagnos kap 4', kind: 'uppgift', folder: K4, tags: ['diagnos', 'prov1'], pages: img(range(133, 140)), links: ['k4-diag-l', 'k4-krafter', 'k4-beskriva', 'k4-n1', 'k4-n23', 'k4-friktion', 'k4-grav'] },
  { key: 'k4-diag-l', title: 'Lösning – Diagnos kap 4', kind: 'losning', folder: K4, tags: ['diagnos', 'prov1'], pages: img(range(141, 150)), links: ['k4-diag'] },

  // Kap 5
  { key: 'k5-densitet', title: '5.1 Materia och densitet', kind: 'material', folder: K5, tags: ['densitet'], pages: img(151, 152, 153), links: ['k5-tryck', 'k5-lab'] },
  { key: 'k5-tryck', title: '5.2 Tryckkraft och tryck', kind: 'material', folder: K5, tags: ['tryck'], pages: img(range(154, 157)), links: ['k4-n23', 'k5-densitet'] },
  { key: 'k5-lab', title: 'Laboration 3 – Densitet', kind: 'material', folder: K5, tags: ['labb', 'densitet'], pages: img(234, 235), links: [] },

  // Inför prov 1
  { key: 'p-plan', title: 'Plugga inför prov 1', kind: 'material', folder: PROV, tags: ['prov1'], pages: img(160), links: ['p-rep', 'p-extra', 'k3-diag', 'k4-diag', 'p-rep23', 'p-rep45'] },
  { key: 'p-rep', title: 'Repetitionsuppgifter prov 1', kind: 'uppgift', folder: PROV, tags: ['prov1'], pages: img(range(161, 170)), links: ['p-rep-l'] },
  { key: 'p-rep-l', title: 'Lösning – Repetitionsuppgifter prov 1', kind: 'losning', folder: PROV, tags: ['prov1'], pages: img(range(171, 182)), links: ['p-rep'] },
  { key: 'p-extra', title: 'Extra övningsuppgifter – Rörelse och krafter', kind: 'uppgift', folder: PROV, tags: ['prov1'], pages: img(184, 185, 186), links: ['p-extra-l'] },
  { key: 'p-extra-l', title: 'Facit – Extra övningsuppgifter', kind: 'losning', folder: PROV, tags: ['prov1'], pages: img(187, 188, 189), links: ['p-extra'] },
  { key: 'p-rep23', title: 'Repetition kap 2–3', kind: 'material', folder: PROV, tags: ['prov1', 'rörelse'], pages: img(220, 221, 222), links: ['k2-storheter', 'k3-lage', 'k3-medel', 'k3-acc', 'k3-fall', 'k3-formler'] },
  { key: 'p-rep45', title: 'Repetition kap 4–5.2', kind: 'material', folder: PROV, tags: ['prov1', 'kraft'], pages: img(range(223, 229)), links: ['k4-krafter', 'k4-beskriva', 'k4-n1', 'k4-n23', 'k4-friktion', 'k4-grav', 'k5-densitet', 'k5-tryck'] },
  { key: 'p-planering', title: 'Planering Fysik 1b', kind: 'material', folder: PROV, tags: [], pages: img(6, 7), links: ['p-plan'] },

  // The book's worked solutions
  { key: 'b-k1', title: 'Lösningar bokuppgifter kap 1', kind: 'losning', folder: BOK, tags: [], pages: img(10), links: ['k1-krafter'] },
  { key: 'b-k2', title: 'Lösningar bokuppgifter kap 2', kind: 'losning', folder: BOK, tags: [], pages: img(12), links: ['k2-storheter'] },
  { key: 'b-k3', title: 'Lösningar bokuppgifter kap 3', kind: 'losning', folder: BOK, tags: [], pages: img(14, 15, 16, 17), links: ['k3-lage'] },
  { key: 'b-k4', title: 'Lösningar bokuppgifter kap 4', kind: 'losning', folder: BOK, tags: [], pages: img(19, 20), links: ['k4-krafter'] },
  { key: 'b-k5', title: 'Lösningar bokuppgifter kap 5', kind: 'losning', folder: BOK, tags: [], pages: img(22, 23, 24, 25), links: ['k5-densitet'] },
]

const summary = String.raw`# Prov 1 – det viktigaste i kap 1–5

Provet gäller **rörelse, krafter, densitet och tryck** (kap 1–5.2). Läraren strök uppgifterna om temperatur, gaslagar och lyftkraft. Se [[Plugga inför prov 1]].

## 1. Grunderna – [[2.2 Storheter och enheter]]
- **Storhet** = vad du mäter, **mätetal** = siffran, **enhet** = måttet. ”65 km”: sträcka · 65 · km.
- Prefix: G = $10^9$, M = $10^6$, k = $10^3$, m = $10^{-3}$, µ = $10^{-6}$, n = $10^{-9}$.
- km/h → m/s: **dela med 3,6**. cm² → m²: dela med 10 000. 1 g/cm³ = 1000 kg/m³.
- **Enhetsanalys**: kolla att enheterna blir samma i vänster och höger led.
- **Systematiskt fel** – samma fel åt samma håll varje gång. **Slumpmässigt fel** – varierar; mät flera gånger och ta medelvärde.
- Fysik bygger **modeller** som kan prövas och motbevisas – [[2.1 Modeller och vetenskap]]. De fyra fundamentala krafterna: [[1.1 Naturens krafter]].

## 2. Rörelse (kap 3)
- **Hastighet** har riktning (vektor), **fart** bara storlek. Medelhastighet $\bar v = \frac{\Delta s}{\Delta t}$ – [[3.1 Läge och hastighet]].
- Medelhastighet = total sträcka / total tid (inte medelvärdet av hastigheterna!). Momentanhastighet = lutningen på **tangenten** – [[3.2 Medel- och momentanhastighet]].
- **Acceleration** $a = \frac{\Delta v}{\Delta t}$ i m/s² – [[3.3 Hastighet och acceleration]].

| Graf | Lutningen ger | Arean under ger |
|---|---|---|
| s/t | hastighet | – |
| v/t | acceleration | sträckan |

**Formler vid konstant acceleration** – [[3.4 Formler vid konstant acceleration]]:
$$v = v_0 + at \qquad s = v_0 t + \frac{at^2}{2} \qquad s = \frac{v_0 + v}{2}\cdot t$$

**Fritt fall** – [[3.3 Fritt fall]]: $a = g = 9{,}82\ \text{m/s}^2$ nedåt, luftmotståndet försummas. Från vila: $t = \sqrt{2s/g}$, $v = gt$. I vändläget vid kast uppåt är $v = 0$ men accelerationen är **fortfarande g**.

## 3. Kraft och rörelse (kap 4)
- Kraft $F$ i newton (N). Pilen visar storlek, riktning och angreppspunkt – [[4.2 Att beskriva en kraft]].
- **Tyngdkraft** $F_g = mg$, **Hookes lag** $F = k\cdot\Delta l$ – [[4.1 Krafter av olika slag]].
- **Frilägg**: rita bara föremålet, tyngdkraften från mitten, sedan en kraft för allt som rör vid det.
- Resultant: lika riktade adderas, motriktade subtraheras, vinkelräta med Pythagoras.
- **Newtons 1:a lag**: $F_R = 0 \Leftrightarrow$ vila eller konstant hastighet – [[4.3 Newtons första lag]].
- **Newtons 2:a lag**: $F_R = m\cdot a$. **3:e lagen**: kraft och motkraft är lika stora, motriktade och verkar på **olika föremål** – [[4.3 Newtons andra och tredje lag]].
- ⚠️ Tyngdkraft och normalkraft på en bok är **inte** kraft–motkraft (båda verkar på boken).
- **Friktion** $F_f = \mu \cdot F_N$. Vilofriktion = så stor som din kraft (upp till ett max), glidfriktion är konstant – [[4.4 Friktion]].
- **Gravitationslagen** $F = G\frac{m_1 m_2}{r^2}$, $G = 6{,}67\cdot10^{-11}$ – [[4.5 Newtons gravitationslag]].
- Hiss: konstant fart → linkraft $= mg$; accelererar uppåt → $mg + ma$; nedåt → $mg - ma$.

## 4. Densitet och tryck (kap 5)
- **Densitet** $\rho = \frac{m}{V}$ – [[5.1 Materia och densitet]]. Räkna i g och cm³ när uppgiften gör det.
- **Tryck** $p = \frac{F}{A}$ i Pa = N/m². Större area → lägre tryck (snöskor) – [[5.2 Tryckkraft och tryck]].
- **Vätsketryck** $p = \rho g h$; i vatten ökar trycket ca 1 atm (101,3 kPa) per 10 m. Totalt tryck = lufttryck + $\rho g h$.
- **Pascals princip**: $F_2 = F_1 \cdot \frac{A_2}{A_1}$ (hydraulisk domkraft). Kommunicerande kärl står lika högt.

## Öva
- [[Repetitionsuppgifter prov 1]] och [[Lösning – Repetitionsuppgifter prov 1]]
- [[Extra övningsuppgifter – Rörelse och krafter]] och [[Facit – Extra övningsuppgifter]]
- [[Diagnos kap 1–3]] och [[Diagnos kap 4]] med lösningar
- Lärarens repetition: [[Repetition kap 2–3]] och [[Repetition kap 4–5.2]]

## Vanliga fällor
1. Omvandla km/h → m/s, cm → m, g → kg, cm² → m².
2. ”Väger 5 kg” är massan – tyngden är $mg$ i newton.
3. Konstant hastighet ⇒ $F_R = 0$, inte ”inga krafter”.
4. Svara alltid med enhet och rimligt antal värdesiffror.

#prov1`

notes.push({ key: 'p-sammanfattning', title: 'Sammanfattning – Prov 1', kind: 'sammanfattning', folder: PROV, tags: ['prov1'], format: 'text', text: summary, links: [] })

const manifest = { format: 'athena-import', version: 1, vault: 'fysik', notes }
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1))
const pages = notes.reduce((s, n) => s + (n.pages?.length ?? 0), 0)
console.log(`${notes.length} notes, ${pages} pages`)

// Builds import/matte/manifest.json: the teacher's OneNote pages for Matematik 1c kap 1–6,
// grouped into linked notes (also linked to the physics package where topics meet),
// plus a written summary. Images come from render-pages.ps1.
import { writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(import.meta.dirname, '..', 'import', 'matte')
const have = new Set(readdirSync(join(dir, 'img')))
const img = (...nums) => nums.flat().map((n) => `img/p${String(n).padStart(3, '0')}.jpg`).filter((p) => have.has(p.slice(4)))
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i)

const K1 = 'Kap 1 – Tal'
const K2 = 'Kap 2 – Algebra'
const K3 = 'Kap 3 – Procent'
const K4 = 'Kap 4 – Samband och funktioner'
const K6 = 'Kap 6 – Trigonometri och vektorer'
const PROV = 'Prov 1 – inför provet'
const OVR = 'Övrigt'

const m = (key, title, folder, pages, links = [], tags = [], kind = 'material') => ({ key, title, kind, folder, tags, pages: img(pages), links })

const notes = [
  // Kap 1 – Tal
  m('ma-k1-talmangder', '1.1 Talmängder och negativa tal', K1, range(12, 15), ['ma-k1-brak-add'], ['tal']),
  m('ma-k1-brak-add', '1.2 Bråk – addition och subtraktion', K1, range(16, 20), ['ma-k1-brak-mul'], ['bråk']),
  m('ma-k1-brak-mul', '1.3 Bråk – multiplikation och division', K1, range(21, 23), ['ma-k1-decimal'], ['bråk']),
  m('ma-k1-decimal', '1.4 Tal i decimalform och värdesiffror', K1, range(24, 26), ['ma-k1-pot-pos', 'k2-storheter'], ['tal']),
  m('ma-k1-pot-pos', '1.5 Potenser med positiva heltalsexponenter', K1, range(27, 29), ['ma-k1-pot-neg'], ['potenser']),
  m('ma-k1-pot-neg', '1.6 Negativa exponenter och exponenten noll', K1, range(30, 32), ['ma-k1-pot-rat'], ['potenser']),
  m('ma-k1-pot-rat', '1.7 Rationella exponenter och rötter', K1, range(33, 36), ['ma-k1-prefix', 'ma-k2-potensekv'], ['potenser']),
  m('ma-k1-prefix', '1.8 Prefix och grundpotensform', K1, range(37, 39), ['ma-k1-prio', 'k2-storheter'], ['potenser']),
  m('ma-k1-prio', '1.9 Prioriteringsregler', K1, range(40, 42), ['ma-k1-diag'], ['tal']),
  m('ma-k1-diag', 'Diagnos kap 1 – Tal', K1, range(43, 47), ['ma-k1-diag-l', 'ma-k1-brak-add', 'ma-k1-pot-pos', 'ma-k1-prefix', 'ma-k1-prio'], ['diagnos'], 'uppgift'),
  m('ma-k1-diag-l', 'Lösning – Diagnos kap 1 – Tal', K1, range(48, 53), ['ma-k1-diag'], ['diagnos'], 'losning'),

  // Kap 2 – Algebra
  m('ma-k2-uttryck', '2.1 Teckna och tolka uttryck', K2, [54, 55], ['ma-k2-forenkla'], ['algebra']),
  m('ma-k2-forenkla', '2.2 Förenkla uttryck', K2, range(56, 58), ['ma-k2-parenteser'], ['algebra']),
  m('ma-k2-parenteser', '2.3 Multiplikation av parenteser', K2, range(59, 61), ['ma-k2-faktorisera'], ['algebra']),
  m('ma-k2-faktorisera', '2.4 Faktorisera uttryck', K2, [62, 63], ['ma-k2-ekv'], ['algebra']),
  m('ma-k2-ekv', '2.5 Ekvationslösningens grunder', K2, range(64, 66), ['ma-k2-ekv-namnare'], ['ekvationer']),
  m('ma-k2-ekv-namnare', '2.6 Ekvationer med parenteser och nämnare', K2, range(67, 69), ['ma-k2-problem'], ['ekvationer']),
  m('ma-k2-problem', '2.7 Problemlösning med ekvationer', K2, range(70, 73), ['ma-k2-andragrad'], ['ekvationer']),
  m('ma-k2-andragrad', '2.8 Andra- och tredjegradsekvationer', K2, range(74, 77), ['ma-k2-potensekv'], ['ekvationer']),
  m('ma-k2-potensekv', '2.9 Potensekvationer', K2, range(78, 80), ['ma-k2-olikheter', 'ma-k3-upprepade'], ['ekvationer', 'potenser']),
  m('ma-k2-olikheter', '2.10 Olikheter', K2, range(81, 84), ['ma-k2-formler'], ['olikheter']),
  m('ma-k2-formler', '2.11 Formler och formelhantering', K2, range(85, 88), ['ma-k2-diag', 'k3-formler'], ['algebra']),
  m('ma-k2-diag', 'Diagnos kap 2 – Algebra', K2, range(89, 93), ['ma-k2-diag-l', 'ma-k2-forenkla', 'ma-k2-faktorisera', 'ma-k2-ekv', 'ma-k2-olikheter', 'ma-k2-formler'], ['diagnos'], 'uppgift'),
  m('ma-k2-diag-l', 'Lösning – Diagnos kap 2 – Algebra', K2, range(94, 97), ['ma-k2-diag'], ['diagnos'], 'losning'),

  // Kap 3 – Procent
  m('ma-k3-procent', '3.1 Procent, promille och ppm', K3, range(98, 100), ['ma-k3-ff'], ['procent']),
  m('ma-k3-ff', '3.2 Förändringsfaktor', K3, range(101, 103), ['ma-k3-upprepade'], ['procent']),
  m('ma-k3-upprepade', '3.3 Upprepade procentuella förändringar', K3, range(104, 106), ['ma-k3-spara', 'ma-k4-exp'], ['procent']),
  m('ma-k3-spara', '3.4 Sparande och ränta', K3, range(107, 109), ['ma-k3-lan'], ['procent']),
  m('ma-k3-lan', '3.5 Lån och ränta', K3, range(110, 112), ['ma-k3-diag'], ['procent']),
  m('ma-k3-diag', 'Diagnos kap 3 – Procent och trigonometri', K3, range(113, 118), ['ma-k3-diag-l', 'ma-k3-procent', 'ma-k3-ff', 'ma-k3-upprepade', 'ma-k6-sincos'], ['diagnos'], 'uppgift'),
  m('ma-k3-diag-l', 'Lösning – Diagnos kap 3 – Procent och trigonometri', K3, range(119, 125), ['ma-k3-diag'], ['diagnos'], 'losning'),

  // Kap 4 – Samband och funktioner
  m('ma-k4-koord', '4.1 Koordinatsystemet', K4, [136], ['ma-k4-linjara', 'ma-k6-koord'], ['funktioner']),
  m('ma-k4-linjara', '4.2 Linjära modeller', K4, range(137, 139), ['ma-k4-prop'], ['funktioner', 'räta linjen']),
  m('ma-k4-prop', '4.3 Proportionaliteter', K4, [140, 141], ['ma-k4-prop2'], ['funktioner']),
  m('ma-k4-prop2', '4.4 Mer om proportionaliteter', K4, [142, 143], ['ma-k4-ekv-graf', 'k3-fall'], ['funktioner']),
  m('ma-k4-ekv-graf', '4.5 Från ekvation till graf', K4, range(144, 146), ['ma-k4-graf-ekv'], ['funktioner', 'räta linjen']),
  m('ma-k4-graf-ekv', '4.6 Från graf till ekvation', K4, range(147, 149), ['ma-k4-kform'], ['funktioner', 'räta linjen']),
  m('ma-k4-kform', '4.7 k-form och enpunktsform', K4, range(150, 152), ['ma-k4-parallella'], ['räta linjen']),
  m('ma-k4-parallella', '4.8 Parallella och vinkelräta linjer', K4, range(153, 156), ['ma-k4-funktion'], ['räta linjen']),
  m('ma-k4-funktion', '4.9 Funktion och funktionsvärde', K4, range(157, 161), ['ma-k4-grafisk'], ['funktioner']),
  m('ma-k4-grafisk', '4.10 Grafisk lösning av ekvationer och olikheter', K4, range(162, 164), ['ma-k4-dv', 'ma-k2-olikheter'], ['funktioner']),
  m('ma-k4-dv', '4.11 Definitionsmängd och värdemängd', K4, range(165, 167), ['ma-k4-exp'], ['funktioner']),
  m('ma-k4-exp', '4.12 Exponentialfunktioner', K4, range(168, 170), ['ma-k4-potf'], ['funktioner', 'procent']),
  m('ma-k4-potf', '4.13 Potensfunktioner', K4, range(171, 173), ['ma-k4-diag', 'ma-k4-prop2'], ['funktioner']),
  m('ma-k4-diag', 'Diagnos kap 4 – Funktioner', K4, range(174, 180), ['ma-k4-diag-l', 'ma-k4-linjara', 'ma-k4-kform', 'ma-k4-funktion', 'ma-k4-exp', 'ma-k4-potf'], ['diagnos'], 'uppgift'),
  m('ma-k4-diag-l', 'Lösning – Diagnos kap 4 – Funktioner', K4, range(181, 188), ['ma-k4-diag'], ['diagnos'], 'losning'),

  // Kap 6 – Trigonometri och vektorer
  m('ma-k6-tan', '6.1 Tangens', K6, range(189, 191), ['ma-k6-sincos'], ['trigonometri']),
  m('ma-k6-sincos', '6.2 Sinus och cosinus', K6, range(192, 194), ['ma-k6-invers'], ['trigonometri']),
  m('ma-k6-invers', '6.3 Vinklar med inversa funktioner', K6, [195, 196], ['ma-k6-koord'], ['trigonometri']),
  m('ma-k6-koord', '6.4 Sträckor och vinklar i koordinatsystem', K6, range(197, 199), ['ma-k6-vektor'], ['trigonometri']),
  m('ma-k6-vektor', '6.5 Vektorer och skalärer', K6, range(200, 202), ['k4-beskriva', 'k2-storheter'], ['vektorer']),

  // Inför prov 1
  m('ma-p-plan', 'Plugga inför prov 1 – matte', PROV, [126], ['ma-p-rep-alg', 'ma-p-rep-ovr', 'ma-k1-diag', 'ma-k2-diag', 'ma-k3-diag'], ['prov1']),
  m('ma-p-rep-alg', 'Repetition – Algebra', PROV, range(127, 131), ['ma-k2-forenkla', 'ma-k2-faktorisera', 'ma-k2-ekv', 'ma-k2-formler', 'ma-k2-olikheter'], ['prov1']),
  m('ma-p-rep-ovr', 'Repetition – Procent, potenser och trigonometri', PROV, range(132, 135), ['ma-k3-ff', 'ma-k3-upprepade', 'ma-k1-pot-pos', 'ma-k6-sincos'], ['prov1']),

  // Övrigt
  m('ma-formelblad', 'Formelblad Ma 1c', OVR, [7, 8, 9], [], ['formler']),
  m('ma-planering', 'Planering Matematik 1c', OVR, [5], ['ma-p-plan']),
  m('ma-redovisat', 'Mina redovisade uppgifter', OVR, range(204, 211), ['ma-k2-problem'], [], 'anteckning'),
]

const summary = String.raw`# Matte 1c – det viktigaste i kap 1–6

Lärarens material täcker kap 1 Tal, 2 Algebra, 3 Procent, 4 Samband och funktioner och 6 Trigonometri och vektorer (kap 5 finns inte med). Prov 1 gällde kap 1–3 och trigonometrin – se [[Plugga inför prov 1 – matte]]. Alla formler finns på [[Formelblad Ma 1c]].

## 1. Tal (kap 1)
**Talmängder** – [[1.1 Talmängder och negativa tal]]: ℕ naturliga (0, 1, 2 …) ⊂ ℤ hela (… −1, 0, 1 …) ⊂ ℚ rationella (bråk som 1/3) ⊂ ℝ reella (även √2 och π) ⊂ ℂ komplexa.

**Negativa tal**: minus minus blir plus, $4-(-3)=7$. Gånger och delat: samma tecken ger plus, olika tecken ger minus: $3\cdot(-5)=-15$, $(-3)\cdot(-5)=15$.

**Bråk, plus och minus** – [[1.2 Bråk – addition och subtraktion]]:
1. Hitta minsta gemensamma nämnare (mgn)
2. Förläng så att nämnarna blir lika
3. Räkna
4. Förkorta om det går
5. Skriv i blandad form om det går

$\frac{7}{9}-\frac{1}{12}=\frac{28}{36}-\frac{3}{36}=\frac{25}{36}$ och $5-1\frac{3}{7}=\frac{35}{7}-\frac{10}{7}=\frac{25}{7}=3\frac{4}{7}$

**Bråk, gånger och delat** – [[1.3 Bråk – multiplikation och division]]: täljare gånger täljare, nämnare gånger nämnare. Vid division vänder du på bråket du delar med: $\frac{8}{15}\Big/\frac{2}{5}=\frac{8}{15}\cdot\frac{5}{2}=\frac{4}{3}=1\frac13$.
Orden: term + term = **summa**, term − term = **differens**, faktor · faktor = **produkt**, täljare / nämnare = **kvot**.

**Värdesiffror** – [[1.4 Tal i decimalform och värdesiffror]]:
- Gånger och delat: svara med lika många värdesiffror som det minst noggranna talet.
- Plus och minus: svara med lika många decimaler som talet med minst decimaler.
- Nollor först räknas aldrig (0,00350 har 3), nollor i mitten alltid (53,067 har 5), nollor sist i ett decimaltal räknas (5,270 har 4), nollor sist i ett heltal kanske (2900 har 2–4).

**Potenslagarna** – [[1.5 Potenser med positiva heltalsexponenter]], [[1.6 Negativa exponenter och exponenten noll]], [[1.7 Rationella exponenter och rötter]]:

| Lag | Exempel |
|---|---|
| $a^x\cdot a^y=a^{x+y}$ | $5^2\cdot5^4=5^6$ |
| $\frac{a^x}{a^y}=a^{x-y}$ | $\frac{a^9}{a^5}=a^4$ |
| $(a^x)^y=a^{x\cdot y}$ | $(5^2)^3=5^6$ |
| $(ab)^x=a^x b^x$ | $(2x)^3=8x^3$ |
| $\left(\frac ab\right)^x=\frac{a^x}{b^x}$ | $\left(\frac1{2a}\right)^4=\frac1{16a^4}$ |
| $a^0=1$ | $7^0=1$ |
| $a^{-x}=\frac1{a^x}$ | $3^{-4}=\frac1{81}$ |
| $a^{1/n}=\sqrt[n]a$ | $64^{1/3}=\sqrt[3]{64}=4$ |

Knep: skriv om till samma bas. $9^4=(3^2)^4=3^8$. Vilket är störst, $2^{300}$ eller $3^{200}$? $2^{300}=8^{100}$ och $3^{200}=9^{100}$, så $3^{200}$. $8^{2/3}=(\sqrt[3]8)^2=4$. $\sqrt[3]{-8}=-2$, men $\sqrt{-4}$ finns inte bland de reella talen.

**Prefix och grundpotensform** – [[1.8 Prefix och grundpotensform]]: ett tal mellan 1 och 10 gånger en tiopotens, $35\,000\text{ m}=3{,}5\cdot10^4\text{ m}$. G $=10^9$, M $=10^6$, k $=10^3$, m $=10^{-3}$, µ $=10^{-6}$, n $=10^{-9}$. 43 µm $=4{,}3\cdot10^{-5}$ m. Samma prefix som i fysiken: [[2.2 Storheter och enheter]].

**Prioriteringsregler** – [[1.9 Prioriteringsregler]]: 1) parenteser 2) potenser 3) gånger och delat 4) plus och minus. $4+3^2(2+3)-\frac84=4+45-2=47$. Ett bråkstreck fungerar som en parentes.

## 2. Algebra (kap 2)
- **Uttryck** – [[2.1 Teckna och tolka uttryck]]: numeriskt (bara tal) eller algebraiskt (med variabler). Hyrbil 200 kr plus 15 kr per mil: $T=200+15x$.
- **Förenkla** – [[2.2 Förenkla uttryck]]: slå ihop termer av samma sort. Minus framför en parentes byter tecken på allt inuti: $8+(3x-5)+(2x+3)=5x+6$ men $2(4-x)-4(x-1)=8-2x-4x+4=12-6x$.
- **Multiplicera parenteser** – [[2.3 Multiplikation av parenteser]]: varje term gånger varje term. $(2+x)(3x+4)=6x+8+3x^2+4x=3x^2+10x+8$.
- **Faktorisera** – [[2.4 Faktorisera uttryck]]: bryt ut den största gemensamma faktorn. $14a^2-21a=7a(2a-3)$, $\frac{5a-20}{5}=a-4$, $\frac{5^x-5^{x+1}}{4}=\frac{5^x(1-5)}{4}=-5^x$.
- **Ekvationer** – [[2.5 Ekvationslösningens grunder]], [[2.6 Ekvationer med parenteser och nämnare]]: gör samma sak på båda sidor. Med nämnare: multiplicera alla termer med mgn. $\frac{8}{x-3}+2=4 \Rightarrow 8+2(x-3)=4(x-3) \Rightarrow x=7$. Pröva svaret!
- **Problemlösning** – [[2.7 Problemlösning med ekvationer]]: Förstå → Planera (vad är x? teckna en ekvation) → Genomför → Värdera (rimligt?) → Svara med enhet. 220 åskådare, barn 40 kr, vuxna 80 kr, totalt 15 200 kr: $40x+80(220-x)=15200 \Rightarrow x=60$ barn.
- **Andra- och tredjegradsekvationer** – [[2.8 Andra- och tredjegradsekvationer]]: $x^2=25 \Rightarrow x=\pm5$ (två lösningar!), $x^3=100 \Rightarrow x=\sqrt[3]{100}\approx4{,}64$ (en lösning). Är x en längd gäller bara den positiva.
- **Potensekvationer** – [[2.9 Potensekvationer]]: $x^n=a \Rightarrow x=\sqrt[n]a=a^{1/n}$. Jämn exponent ger två reella lösningar, udda en. Typfråga: värdet ökar 30 % på 9 år, alltså $x^9=1{,}30 \Rightarrow x\approx1{,}0296$, ca 3,0 % per år. $x^{3/2}=8 \Rightarrow x=8^{2/3}=4$.
- **Olikheter** – [[2.10 Olikheter]]: löses som ekvationer, men **multiplicerar eller dividerar du med ett negativt tal vänds tecknet**. $5-2x>17+4x \Rightarrow -6x>12 \Rightarrow x<-2$. På tallinjen: öppen ring för < och >, fylld för ≤ och ≥.
- **Formler** – [[2.11 Formler och formelhantering]]: lös ut variabeln som i en ekvation. $a=\frac{\Delta v}{\Delta t} \Rightarrow \Delta t=\frac{\Delta v}{a}$, $E=mc^2 \Rightarrow c=\sqrt{E/m}$, $W_k=\frac{mv^2}{2} \Rightarrow v=\sqrt{\frac{2W_k}{m}}$, $\bar x=\frac{a+b}{2} \Rightarrow a=2\bar x-b$. Samma sak som i fysiken: [[3.4 Formler vid konstant acceleration]].

## 3. Procent (kap 3)
- **Grunden** – [[3.1 Procent, promille och ppm]]: $\text{delen}=\text{andelen}\cdot\text{det hela}$, $\text{andelen}=\frac{\text{delen}}{\text{det hela}}$, $\text{det hela}=\frac{\text{delen}}{\text{andelen}}$. 1 % = 0,01, 1 ‰ = 0,001, 1 ppm = $10^{-6}$. 26 elever är 13 %: $26/0{,}13=200$ elever.
- **Förändringsfaktor** – [[3.2 Förändringsfaktor]]: ökning med p % ger $1+\frac{p}{100}$, minskning $1-\frac{p}{100}$. +5 % → 1,05 och −30 % → 0,70. $\text{Nytt}=\text{f.f.}\cdot\text{Gammalt}$, så $\text{f.f.}=\frac{\text{Nytt}}{\text{Gammalt}}$ och $\text{Gammalt}=\frac{\text{Nytt}}{\text{f.f.}}$. Sänkt 40 % till 300 kr: $300/0{,}60=500$ kr från början.
- **Upprepade förändringar** – [[3.3 Upprepade procentuella förändringar]]: multiplicera faktorerna. +30 % och sedan −30 %: $1{,}3\cdot0{,}7=0{,}91$, alltså −9 % (inte 0 %!). Samma förändring varje år: $y=C\cdot a^x$ (C startvärde, a förändringsfaktor, x antal år). 4 % i 10 år: $1{,}04^{10}\approx1{,}48$, alltså +48 %.
- **Genomsnitt per år**: en bil går från 250 000 till 100 000 kr på 10 år: $a^{10}=0{,}4 \Rightarrow a=0{,}4^{1/10}\approx0{,}912$, ca −8,8 % per år.
- **Sparande och lån** – [[3.4 Sparande och ränta]], [[3.5 Lån och ränta]]: ränta på ränta ger $K\cdot1{,}025^x$. Rak amortering: lika stor avbetalning varje gång, räntan räknas på det som är kvar. 100 000 kr på 5 år kvartalsvis: amortering 5 000 kr, kvartalsränta $5{,}95/4=1{,}4875$ %, första betalningen $5000+1487{,}50=6487{,}50$ kr.

## 4. Samband och funktioner (kap 4)
- **Räta linjen** $y=kx+m$ – [[4.2 Linjära modeller]], [[4.6 Från graf till ekvation]]: m är där linjen skär y-axeln (startvärdet), k är lutningen (ändringen per steg), $k=\frac{\Delta y}{\Delta x}=\frac{y_2-y_1}{x_2-x_1}$. k > 0 stiger, k < 0 sjunker. Jämn ökning eller minskning ger ett linjärt samband. Punkter och kvadranter: [[4.1 Koordinatsystemet]].
- **Linjens ekvation** – [[4.7 k-form och enpunktsform]]: 1) räkna ut k 2) sätt in en känd punkt och lös ut m. Genom (−1, 5) och (2, −1): $k=\frac{-1-5}{2-(-1)}=-2$, $5=-2\cdot(-1)+m \Rightarrow m=3$, $y=-2x+3$. Enpunktsform: $y-y_1=k(x-x_1)$.
- **Parallella och vinkelräta** – [[4.8 Parallella och vinkelräta linjer]]: parallella ⇔ $k_1=k_2$, vinkelräta ⇔ $k_1\cdot k_2=-1$. Allmän form $ax+by+c=0$ beskriver alla linjer, även lodräta som $x=3$.
- **Proportionalitet** – [[4.3 Proportionaliteter]], [[4.4 Mer om proportionaliteter]]: $y=kx$ är en rät linje genom origo. Också $y=kx^2$ (proportionell mot x i kvadrat), $y=\frac kx$ (omvänt proportionell) och $y=k\sqrt x$. Tennisboll $s=kt^2$: $20=k\cdot2^2 \Rightarrow k=5$, efter 5,5 s: $5\cdot5{,}5^2\approx151$ m. Jämför med fritt fall: [[3.3 Fritt fall]].
- **Rita grafen** – [[4.5 Från ekvation till graf]]: värdetabell (välj x, räkna y), pricka in och dra linjen. Eller börja i m och gå k steg upp per steg åt höger.
- **Funktion** – [[4.9 Funktion och funktionsvärde]]: varje x ger exakt ett y. x är den oberoende och y den beroende variabeln. $f(5)$ är y-värdet när $x=5$. Taxi $f(x)=45+15x$: $f(5)=120$, alltså kostar 5 km 120 kr.
- **Grafisk lösning** – [[4.10 Grafisk lösning av ekvationer och olikheter]]: $f(x)=g(x)$ där graferna skär varandra (läs av x). $f(x)>g(x)$ där f ligger ovanför g. I Athena: lägg en Graf i ritblocket och slå på Skärningar.
- **Definitions- och värdemängd** – [[4.11 Definitionsmängd och värdemängd]]: $D_f$ är tillåtna x, $V_f$ är de y-värden funktionen får. Fylld ring = punkten ingår, öppen ring = ingår inte. $f(x)=x^2$: $D_f$ alla reella tal och $V_f: y\ge0$.
- **Exponentialfunktion** – [[4.12 Exponentialfunktioner]]: $y=C\cdot a^x$. a > 1 växer, 0 < a < 1 avtar. Fåglar $f(x)=300\cdot1{,}035^x$: $f(10)\approx423$, och antalet har fördubblats när $300\cdot1{,}035^x=600$, efter ca 20 år.
- **Potensfunktion** – [[4.13 Potensfunktioner]]: $y=C\cdot x^a$. a = 1 rät linje, a = 2 parabel, a = 3 tredjegradskurva, a = 0,5 rot, a = −1 hyperbel. Bromssträcka $y=kx^2$: 69 m vid 100 km/h ger $k=0{,}0069$ och ca 44 m vid 80 km/h.

## 6. Trigonometri och vektorer (kap 6)
I en rätvinklig triangel med vinkeln v – [[6.1 Tangens]], [[6.2 Sinus och cosinus]]:
$$\sin v=\frac{\text{motstående katet}}{\text{hypotenusan}}\qquad \cos v=\frac{\text{närliggande katet}}{\text{hypotenusan}}\qquad \tan v=\frac{\text{motstående katet}}{\text{närliggande katet}}$$
- **Hypotenusan** är den längsta sidan, mittemot den räta vinkeln. **Katetrarna** är de två andra sidorna.
- Söker du **en sida**: använd sin, cos eller tan. Söker du **en vinkel**: använd inversen $\sin^{-1}$, $\cos^{-1}$ eller $\tan^{-1}$ (2nd + knappen) – [[6.3 Vinklar med inversa funktioner]]. $\tan v=0{,}7 \Rightarrow v=\tan^{-1}(0{,}7)\approx35{,}0^\circ$.
- Räknaren ska stå i **grader** (DEG).
- **Pythagoras sats**: $a^2+b^2=c^2$, där c är hypotenusan. Katetrarna 5 och 12 ger $c=13$.
- **Avståndsformeln** – [[6.4 Sträckor och vinklar i koordinatsystem]]: $d=\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}$. Från (−1, 4) till (5, −5): $\sqrt{36+81}=\sqrt{117}\approx10{,}8$. Vinkeln mellan en linje och x-axeln: $\tan v=k$.
- **Vektorer** – [[6.5 Vektorer och skalärer]]: en skalär har bara storlek (massa, tid), en vektor har storlek och riktning (kraft, hastighet). Samma längd och riktning är samma vektor, $-\vec v$ är motsatt vektor. Längden: $|\vec v|=\sqrt{x^2+y^2}$. Som kraftpilarna i fysiken: [[4.2 Att beskriva en kraft]].

## Vanliga fällor
1. $x^2=25$ har **två** lösningar, $\pm5$.
2. Olikhetstecknet vänds när du multiplicerar eller dividerar med ett negativt tal.
3. +30 % och −30 % tar inte ut varandra: $1{,}3\cdot0{,}7=0{,}91$.
4. Minus framför en parentes byter tecken på **alla** termer inuti.
5. Räknaren i grader, och svara med rimligt antal värdesiffror.

## Öva
- [[Plugga inför prov 1 – matte]] – lärarens lista med uppgifter i boken
- Diagnoser med lösningar: [[Diagnos kap 1 – Tal]], [[Diagnos kap 2 – Algebra]], [[Diagnos kap 3 – Procent och trigonometri]], [[Diagnos kap 4 – Funktioner]]
- Lärarens repetition: [[Repetition – Algebra]] och [[Repetition – Procent, potenser och trigonometri]]
- Dina egna lösningar: [[Mina redovisade uppgifter]]

#matte1c`

notes.push({ key: 'ma-sammanfattning', title: 'Sammanfattning – Matte 1c', kind: 'sammanfattning', folder: '', tags: ['matte1c'], format: 'text', text: summary, links: [] })

const manifest = { format: 'athena-import', version: 1, vault: 'matte', notes }
writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1))
const pages = notes.reduce((s, n) => s + (n.pages?.length ?? 0), 0)
const missing = notes.filter((n) => n.format !== 'text' && !n.pages.length).map((n) => n.title)
console.log(`${notes.length} notes, ${pages} pages${missing.length ? ', MISSING: ' + missing.join('; ') : ''}`)

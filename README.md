# Ecovisão — experiência web

Site institucional da Ecovisão Consultoria: consultoria empresarial e soluções em
PGRSS. One-page construída em torno do conceito **"Seu negócio é um ecossistema.
Nós enxergamos o todo."**

A direção completa (conceito, estrutura de seções, paleta, metas de performance e
pendências de conteúdo) está em [PLANEJAMENTO.md](PLANEJAMENTO.md).

A avaliação da experiência implementada e as prioridades para elevar seu nível
estão em [AUDITORIA-AWWWARDS.md](AUDITORIA-AWWWARDS.md), registrada em 22/09/2026.
Consulte-a antes de propor novas mudanças visuais, de conteúdo ou navegação.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **three.js** + `@react-three/fiber` + `@react-three/drei` para a árvore 3D
- **GSAP** para as revelações tipográficas

## Rodando

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm run build      # build de produção
npm start          # serve o build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

## Estado atual

Em 22/09/2026, estão implementados o **hero**, **Manifesto — Nossa visão**,
**Nossa abordagem — A Lente**, **Soluções** (trilha horizontal), **PGRSS**,
**Yuri Elias**, **Clientes e parceiros**, **Contato** e **footer**, além de menu
de seções e alternativa com movimento reduzido. Implementado não significa
validado para entrega ou premiação: os achados e propostas estão na auditoria.

As notas técnicas abaixo documentam etapas da construção e podem conter
numeração, decisões e pendências históricas; confira a implementação atual e
o registro da auditoria antes de usá-las como descrição do estado presente.

### O que o hero faz

| Beat | Comportamento |
|---|---|
| Loading | Tela de carregamento própria, toca em toda carga. Diagrama pessoas → processos → estratégia → visão integrada |
| Saída do loading | Não é cortina: o **nó laranja** em que as três linhas convergiram sai pela linha de "Visão integrada", cruza a tela deixando um rastro em degradê e **pousa na copa da árvore**. Ali nasce o anel laranja com o mostrador de marcas (o mesmo da lente da seção 03) e cresce até a floresta escura ter se aberto sobre o hero. É o mesmo gesto que a onda, a íris e a lente fazem a partir da copa |
| Entrada | A árvore aparece com um fade simples, já dentro do anel; a tipografia sobe quando o anel passa por ela |
| Repouso | Tipografia à esquerda, árvore no espaço livre à direita (o mais à direita que o viewport permite; embaixo do texto no mobile). Câmera e tronco ficam parados: sem parallax do mouse, sem movimento de scroll. Só as folhas se mexem |

**Saída do loading (`loading-screen.tsx`).** Uma linha do tempo do GSAP de ~1,75 s a partir do
"100": o nó viaja 0,7 s (curva em S saindo na horizontal, ou na vertical em tela alta e
estreita como o celular), o anel abre em 1,05 s a partir do pouso. O hero começa a se revelar
quando o anel abre (`onComplete` é chamado nesse instante), e só os textos esperam 0,4 s
(`TEXT_DELAY` em `hero-experience.tsx`) para subirem quando o anel os alcança; árvore,
duração e movimento do hero são os mesmos de antes. A posição do pouso é a copa que a cena já
informa (`onFraming`), então acompanha o enquadramento de cada tela.

O fundo do loading é desenhado como um `path` SVG com furo (`fill-rule: evenodd`) por cima do
mesmo verde, e o brilho atrás do logo é uma camada própria que desaparece antes do anel. Assim
a troca de "fundo sólido" para "fundo com furo" não muda nada na tela. "Ir para o conteúdo"
pula a viagem e faz só um fade curto (320 ms). Movimento reduzido continua sem loading.

**Vento.** As folhas balançam por shader de vértice (`applyTreeShader` em
`hero-scene.tsx`), sem custo de CPU: uma rajada lenta curva a copa, ponderada pela
altura para o tronco não sair do lugar, e um tremular mais rápido, com fase derivada
da posição, faz folhas vizinhas nunca se moverem em sincronia. O tempo vem de um getter
no uniforme, então nada empurra o relógio para a GPU a cada frame.

**Volume.** As folhas são cartões planos sem oclusão baked, então o shader escurece as
de dentro e de baixo da copa e deixa as de fora e de cima na cor cheia. Tone mapping
Neutral (o ACES puxava o verde para o cinza), roughness baixo e um leve `sheen`
mantêm as folhas nítidas e vivas, não foscas. Não coloque grão, vinheta ou máscara
escura por cima da árvore: é o que a deixava fosca.

A cena renderiza continuamente enquanto o hero está na tela e para quando ele sai
(`RenderPolicy`). O pixel ratio é limitado a 2 no desktop e 1,5 no mobile.

### Scroll suave

[`components/smooth-scroll/`](components/smooth-scroll/) envolve a página com o
**Lenis** (1.3.26). Ele mantém o scroll nativo (barra, teclado, busca da página e
leitores de tela continuam funcionando) e só suaviza a posição até onde a roda mandou.
É movido pelo ticker do GSAP, para o ScrollTrigger (e todo pin) ler a mesma posição
suavizada no mesmo frame.

- Ajuste fino em duas constantes no topo do arquivo: `WHEEL_DURATION` (quanto tempo
  uma girada leva para assentar) e `WHEEL_MULTIPLIER` (quanto ela anda). Hoje 1,4 s e
  0,85, ou seja, cada girada anda 85 px em vez de 100, de forma mais lenta e contínua.
- Toque (celular) segue nativo; é o que o navegador faz melhor.
- `prefers-reduced-motion`: o Lenis nem é criado, o scroll fica 100% do navegador.
- A tela de carregamento trava o scroll escondendo o overflow do `body`; o Lenis
  respeita isso via `prevent` (senão a roda viraria scroll programático, que ignora
  `overflow: hidden`).
- Links de âncora não rolam mais sozinhos por CSS: `#top` é tratado no provider e
  `#visao` no Manifesto, ambos pelo Lenis (`useScrollTo`).

### Seção 02 — Manifesto ("Eco → Visão")

Código em [`components/manifesto/`](components/manifesto/). É uma sequência presa
(pin) de 3,4 telas de scroll, sem WebGL, que cresce a partir da árvore:

| Momento | O que acontece |
|---|---|
| Onda | Um círculo creme nasce na **copa da árvore** e engole o hero. Um anel laranja marca a frente da onda e cada anel deixado para trás é o "eco". O cabeçalho inverte de cor onde a onda passa |
| Eco | "Eco de ecossistema." em serifa gigante; os três nós (Pessoas, Processos, Estratégia) balançam devagar em anéis com marcações de mostrador |
| Alinhamento | A frase "Negócios crescem quando pessoas, processos e objetivos…" acende palavra por palavra. Cada palavra-chave acende o nó correspondente, que vai se alinhando ao eixo comum até formar a **Visão integrada** |
| Visão | "Visão de análise ampla e estratégica." e a câmera recua, revelando outros sistemas ao redor: "enxergamos o todo" |

**Como funciona.** `manifesto-engine.ts` é uma função pura do progresso do scroll:
`render(p)` só lê `p` e o relógio, então qualquer quadro é reproduzível e rolar para
trás toca ao contrário. O ScrollTrigger só fornece o alvo; o desenho é suavizado por
amortecimento próprio, independente de frame rate. Os tempos de cada momento ficam
todos no objeto `T`. O SVG usa coordenadas em pixels (viewBox = tamanho do frame) e
raios em frações de uma unidade, então escala com o viewport.

**Onde nasce o círculo.** A cena 3D informa a posição da copa (`onFraming`) e o hero
a repassa em fração do canvas. Se o enquadramento da árvore mudar, a onda segue.
Quando a onda cobre o hero por inteiro (`covered`), a cena 3D para de renderizar e o
hero vira `inert`.

**Detalhes que importam.**
- Os nós têm inércia própria: seguem o alvo com velocidade máxima (`NODE_MAX_SPEED`,
  55°/s), então nenhuma rolagem, por mais rápida, os faz girar depressa ou se
  embaralhar. O balanço parado é **limitado** (±14° a ±22°, períodos de 9 a 16 s). Antes
  era uma deriva contínua em °/s, que acumulava graus enquanto a página ficava aberta e
  precisava ser desfeita em poucas centenas de pixels de scroll; depois de um minuto
  parada, rolar fazia os nós darem voltas inteiras.
- Ao sair do pin o laço não salta para o estado final: continua até tudo assentar
  (`render` devolve `true` quando não há mais nada para animar) e só então para.
- O grão de papel é `background-blend-mode`, não uma camada com `mix-blend-mode`
  por cima: a segunda relê tudo que está abaixo e repinta a tela inteira a cada frame
  em que o diagrama se mexe (medido: 21 fps contra 60 fps em renderização por software).
- Os links `#visao` levam ao ponto em que o "Eco" está inteiro (`ANCHOR_PROGRESS`),
  porque a seção vive dentro de um pin.
- Se o hero for mais alto que a tela (janelas abaixo de 760px de altura), o pin usa a
  borda de baixo do palco para a seção sempre cair na parte visível.
- Reduced motion: sem pin e sem onda; a seção aparece em fluxo normal, com o desenho
  já alinhado e recuado e os três textos empilhados.
- O texto usa só frases que o site já tinha (Eco/Visão, pessoas–processos–estratégia,
  "visão integrada" da tela de carregamento). Nada de números ou promessas novas.

### A sequência presa (`components/stage/`)

Hero e seções 02 a 05 vivem no mesmo palco e compartilham **um pin e um progresso de
scroll**. `timeline.ts` corta esse progresso em sete trechos: manifesto 3,4, íris 0,6, método
3,4 e abertura 1 (8,4 telas fixas), a **trilha de soluções, cujo comprimento é medido** (ela é
tão longa quanto a trilha é larga, porque um celular e um monitor largo precisam de scroll muito
diferente para passar os mesmos cartões: em torno de 2,8 a 3,5 telas;
`createBeats(solutions.screens())`, recalculado a cada refresh), e por fim a subida do terreno
(1,1) e a história do Yuri (2,8). Cada motor só enxerga o seu
0..1, então um trecho pode ser retocado, ou uma nova seção encaixada, sem tocar nos outros.
`stage-sequence.tsx` é o único lugar que sabe que eles dividem o scroll: cria o pin e o laço
de animação amortecido e conduz os motores. `figure-geometry.ts` dá a todos o mesmo centro (a
copa da árvore) e a mesma unidade.

O alvo do laço lê a **posição do scroll** (`scroll` do `window`), não só os callbacks do
ScrollTrigger. Ele não avisa nada quando o scroll salta de antes do pin direto para depois
dele (tecla End, arrastar a barra), e como o pin termina no fim da página, esse salto deixava
o palco no primeiro quadro.

### Seção 03 — "A Lente" (`components/method/`)

Uma lente diagnostica o mapa de uma empresa e depois o desembaraça. Só usa frases do
documento institucional ("pontos de melhoria e as dores", "solução personalizada",
"processos otimizados e organizados, os resultados tornam-se uma consequência natural",
"tecnologias que cabem no negócio com baixo custo ou mesmo custo zero").

| Momento | O que acontece |
|---|---|
| Íris | O creme da seção 02 **fecha** em vez de rolar para cima: encolhe até o centro da figura enquanto o verde-floresta é descoberto por baixo. A frente laranja da onda vira a borda da lente; a lente é o creme que sobrou |
| Diagnóstico | Fora da lente o negócio está apagado e embaraçado. Dentro dela, o mesmo mapa aparece legível, e a lente para em cada **ponto de melhoria** (Processos, Custos, Fornecedores), que pulsa em laranja |
| Sob medida | A lente cresce até conter o mapa inteiro e as ligações se **desembaraçam**: curvas viram raios retos, os nós assentam num anel regular e cada dor vai ficando verde. O resultado sai em laranja. Quatro pílulas listam o que a solução traz |
| Inovação | Sobrava uma vaga aberta no anel. Um nó verde entra nela e se liga ao centro |

O mapa é desenhado **duas vezes a partir dos mesmos números** (`MapLayer`): uma cópia apagada
sobre o fundo escuro e outra em tinta sobre o papel, dentro da lente. O que muda entre elas
é só CSS. O desembaraço é geometria pura: a posição de cada nó e a curvatura de cada ligação
são interpoladas entre o estado embaraçado e o ordenado.

**Detalhes que importam.**
- O centro do mapa é a copa da árvore, exceto no celular, onde sobe para a lente grande não
  cobrir as etapas do rodapé; o centro da íris migra até lá enquanto fecha.
- Rótulos e etiquetas são assentados pela largura medida do texto e travados dentro da tela,
  então nada é cortado nas bordas.
- Desempenho (medido em renderização por software): dois escritores alternando o mesmo
  `clip-path` a cada frame derrubaram a íris para 5 fps, e as ondas de pulso da seção 02
  (animação CSS em SVG), dentro de uma camada recortada e esmaecida, forçavam repintar a tela
  inteira. Hoje o manifesto grava o recorte só quando ele muda, o método assume o recorte
  durante a íris e as ondas pausam quando ela começa: 47 fps na íris e 60 no resto.
- O recorte da íris é um `circle()` simples na camada creme, com a escura por baixo. Um recorte
  com furo (`evenodd`) ou uma máscara de gradiente exige uma superfície própria a cada frame
  e foi mais lento.
- Sem animação: a seção vira texto empilhado e um disco creme com o mapa já ordenado.
- **Faixa segura.** O tamanho da lente e do mapa sai de uma faixa entre o cabeçalho e as
  etapas do rodapé (e, no celular, abaixo do texto), não da altura da tela. Antes, numa
  janela baixa (notebook com barras, ~600px) a lente passava do topo e engolia a navbar.
  A unidade encolhe junto, então o mapa inteiro cabe.
- **Rótulos.** Os nós mais longos (LICENCIAMENTO, FORNECEDORES) ficam em cima e embaixo do
  anel, onde o rótulo só centraliza; os curtos ficam nas laterais (`SLOT_OF`). Com a lente
  cheia, rótulos e etiquetas são travados dentro do círculo, e a fonte deles escala com a
  lente (`--ls`, mínimo 0,78) para não se amontoarem num celular baixo.
- **Aberto: retângulo creme intermitente.** Em capturas do Chrome de teste (renderização
  por software) em janelas mais baixas que o hero, um bloco retangular creme apareceu
  ocasionalmente sobre o logo ou o mapa, em ~1 de cada 4 a 10 capturas, e some ao esconder
  qualquer camada. Nenhum elemento do DOM explica; trocar `visibility` por `display: none`
  na camada da seção 02 não mudou a frequência (2 de 10). Suspeita: tile de raster velho do
  compositor por software com `clip-path` animado. **Não confirmado em GPU real**; se
  aparecer no navegador, é o primeiro ponto a investigar.

### Seção 04 — Soluções (`components/solutions/`)

A seção 04 **não é um bloco separado**: ela é escrita no papel que a lente da seção 03 abriu,
dentro do mesmo palco e do mesmo pin. A versão anterior (título e, abaixo, três pilares num
acordeão, já fora do pin) foi descartada: eram dois blocos soltos e sem a força das outras.

A lente **se abre** até ser a tela toda, o título "Soluções" nasce nela e vira o **primeiro
painel de uma trilha horizontal**. Rolar para baixo desliza a trilha para o lado e os
**quatro grupos de serviço** passam, um por cartão, cada um parando no meio da tela o
bastante para ser lido.

**Os quatro cartões são os quatro títulos da página 7 do PDF**, com o que está sob cada um,
na ordem e nas palavras do documento: Planos de Gerenciamento de Resíduos Sólidos (PGRS),
Planejamento Estratégico (com RX Empresarial e ferramentas de gestão), Consultoria
Especializada (cinco itens) e Treinamentos e Desenvolvimento. A primeira versão tinha 14
cartões e três "pilares" agrupados por nós (do PLANEJAMENTO.md, não do PDF): eram muitos,
vazios, e ainda quebravam itens do próprio PDF ("Planos de desenvolvimento individual para
ajustar comportamentos e alinhar metas" virava dois) e traziam itens de outras páginas.
"Conformidade legal para a liberação de alvarás" (página 8) fica para a seção do PGRSS.

| Elemento | O que acontece |
|---|---|
| Abertura (`open`) | A lente cresce além do próprio quadro; o anel laranja vai junto e some; o mapa se dissolve. O cabeçalho vive dentro da lente, em tinta, e inverte de cor pela borda como na onda. O título entra por máscara e a régua do rodapé aparece |
| Trilha | `translate3d` do trilho inteiro. O título sai devagar (paralaxe, 0,42 da velocidade) para o primeiro cartão chegar por cima dele. Entre um cartão centrado e o próximo a trilha freia nas duas pontas (`place`, `DWELL`), então cada grupo "assenta" enquanto se lê |
| Cartão | Papel por padrão. É julgado por onde está na tela: sobe da direita (`clip-path`), cresce e **acende** ao cruzar o meio: a floresta o preenche por trás do desenho, como a lente abrindo, e os marcadores viram laranja em sequência |
| Desenho | Um por grupo, no vocabulário do site (anéis, nós, ligações, o nó laranja). PGRS: anéis fechando numa conferência. Planejamento: uma linha por pontos até um alvo. Consultoria: o mapa da seção 03 em miniatura, o negócio no centro e cinco áreas que voam de onde estavam e assentam no anel (o desembaraço, outra vez). Treinamentos: nós que crescem subindo uma curva. Cada um é desenhado **duas vezes**: uma cópia tênue sempre presente, para nenhum cartão ficar vazio, e uma viva que se traça sozinha ao acender (`stroke-dashoffset`, transições CSS) |
| Régua | Fixa embaixo, onde ficavam as etapas da seção 03: uma marca por grupo, rótulos, preenchimento e nó laranja que deslizam entre os cartões (índice fracionário lido das posições). No celular, só os números |
| Fecho | "Uma solução personalizada para você." (frase do documento) e o link "Fale com a Ecovisão", que só é focável quando está na tela |

O texto todo vem do documento (páginas 5 a 8), sem agrupar nem reescrever; só o "Role para
percorrer" é microcopy de interface. A etiqueta "PGRSS · Nosso diferencial no setor de saúde"
é o título da página 8 e antecipa a seção seguinte.

**Sem WebGL de propósito.** Só a árvore é 3D. Um ícone WebGL por cartão custaria um segundo
contexto de GL (pior em celular, e a tela já roda o da árvore) e destoaria do resto, que é
tinta e traço. As ilustrações são SVG com transição CSS: só trabalham quando o cartão acende.

**Como é feito.** `solutions-engine.ts` é uma função pura do progresso, como as outras:
`render(open, progresso)`. Nada depende de quanto tempo alguém demora: cada cartão e a régua
leem a posição em tela, então rolar para trás desfaz tudo. O comprimento do trecho vem da
largura medida da trilha e de `SPEED = 1` (mínimo de 2,8 telas). Escritas em cache
(`write()`), então um frame parado não toca o DOM.

Acessibilidade: a trilha é HTML real em ordem de leitura (`h2`, `ol` de cartões com `h3` e
lista). A régua e os desenhos são `aria-hidden`. Sem animação (`prefers-reduced-motion`) ou
sem script, a seção vira uma coluna: título, os quatro cartões em grade, com os desenhos já
traçados, e o fecho; nada fica preso.

**Medido no Chrome de teste (renderização por software):** 60 fps dentro da trilha em desktop
e celular; ida e volta dão exatamente o mesmo quadro; `#visao` continua caindo em ~826 px;
a roda do mouse move a trilha de forma monotônica. Não medido em GPU real nem em Safari/Firefox.

### Seção 05 — Yuri Elias, "Quem sou eu?" (`components/yuri/`)

A humanização e a prova de experiência. Também dentro do palco e do pin: a transição vem do
fecho da seção 04 e é uma **subida de terreno**, o vocabulário das ondas dos documentos da
marca (que o plano chama de "linhas topográficas") em vez de mais um círculo.

| Elemento | O que acontece |
|---|---|
| Subida (`rise`) | O fecho de Soluções fica parado um instante, para poder ser lido (e o link clicado). Depois o verde-floresta **sobe** cobrindo o creme, com a borda em ondas (`clip-path: polygon`, duas ondas de comprimentos diferentes) e cinco **curvas de nível** correndo à frente dela, abertas em leque e sem se cruzar. O cabeçalho vive nas duas camadas e inverte de cor **pela borda**, como na onda da seção 02 |
| Retrato | Um disco sálvia floresce (escala e opacidade) com o anel laranja se desenhando e o mostrador de marcas da lente da seção 03. A foto sobe por uma borda ondulada própria e passa do limite do disco (cabeça dentro, ombros fora) |
| Credenciais | Um trilho se enche e um nó acende em cada uma: "10+ anos de experiência em consultorias empresariais" (o 10 conta de 0 a 10 com o scroll), "MBA em Gestão Empresarial pela FGV", "Empretec do SEBRAE" |
| A fala | Os dados dão lugar à missão dele, lida **palavra por palavra amarrada ao scroll** (parar no meio para a frase no meio). As palavras que sustentam a frase vão na serifa itálica em lima |

**Todo o texto e a foto são da página 3 do PDF**, sem acréscimo: o retrato é a imagem embutida
no documento (recorte com transparência, extraída no tamanho original e reduzida para
`public/images/yuri-elias.webp`, 1200×1801, 85 KB). "Casado, pai de 3 filhos", que a página
também traz, ficou de fora de propósito: é uma decisão de tom para o Yuri, não minha.

**Desempenho.** A primeira versão redesenhava as curvas de nível a cada quadro num SVG do
tamanho da tela e derrubou a subida para ~5 fps (o resto rodava a 60). Hoje elas são desenhadas
**uma vez**, numa faixa mais larga que a tela, e só se movem por `transform`; a borda do recorte
usa a mesma onda deslocada pelo mesmo tanto, então as duas continuam casando. Quando o terreno
cobre tudo, a lente da seção 03 (que guarda a trilha) é escondida e fica `inert`.

Sem animação ou sem script a seção vira uma composição estática de duas colunas (retrato à
esquerda, credenciais e fala à direita; empilhada no celular), sem nada preso.

### Árvore

`public/models/ecovisao-tree.glb` — 908 KB, ~85 mil triângulos, comprimido com
Draco. Reconstruído a partir de um fonte de 188 MB / 2,5 milhões de polígonos
(`Gledista_Triacanthos.glb`, mantido fora do repositório pelo `.gitignore`).

Os materiais são re-graduados em runtime para a paleta da marca — o GLB traz as
cores assadas no `baseColorFactor` e elas renderizam como um verde genérico de
viveiro.

As **raízes não existem no modelo**. Havia um gerador procedural em
[`components/hero/tree-roots.ts`](components/hero/tree-roots.ts), mas a câmera fixa
nunca enquadra a base da árvore, então a cena não o usa mais. O arquivo foi mantido
caso as raízes voltem a aparecer.

### Degradação

- `prefers-reduced-motion`: nenhum WebGL é carregado; o pôster estático assume
- Falha de WebGL / perda de contexto: `SceneErrorBoundary` cai para o pôster
- Sem JavaScript: o conteúdo renderiza em estado final

Os dois pôsteres (`public/images/tree-poster*.webp`) são **quadros capturados da
própria cena**, um por breakpoint (1440×900 e 390×844), com fundo transparente e a
árvore na mesma posição da cena ao vivo — não aproximações desenhadas à parte. Se o
enquadramento ou o visual em `hero-scene.tsx` mudarem, eles precisam ser recapturados.

## Pendências conhecidas

- **Core Web Vitals não foram medidos.** O plano fixa LCP < 2,5s, INP < 200ms e
  CLS < 0,1; não há número para nenhum deles. A intro trava o scroll por 1,1s a
  4,5s em toda carga, o que está em tensão com essa meta
- Existe um único GLB para desktop e mobile; o plano pedia duas versões
- O loader espera o 3D ficar pronto antes de liberar o conteúdo — o plano pedia
  o inverso
- Dados de contato a validar: WhatsApp, telefone comercial, e substituição do QR
  que hoje aponta para `scanned.page`

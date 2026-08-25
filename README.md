# Ecovisão — experiência web

Site institucional da Ecovisão Consultoria: consultoria empresarial e soluções em
PGRSS. One-page construída em torno do conceito **"Seu negócio é um ecossistema.
Nós enxergamos o todo."**

A direção completa (conceito, estrutura de seções, paleta, metas de performance e
pendências de conteúdo) está em [PLANEJAMENTO.md](PLANEJAMENTO.md).

## Stack

- **Next.js 16** (App Router, Turbopack)
- **React 19**
- **three.js** + `@react-three/fiber` + `@react-three/drei` para a árvore 3D
- **GSAP** para as revelações tipográficas e o traçado das linhas topográficas

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

O **hero está implementado**. As demais seções previstas no plano (Manifesto,
Método, Soluções, PGRSS, Yuri Elias, prova social, CTA final, footer) ainda não.

### O que o hero faz

| Beat | Comportamento |
|---|---|
| Loading | Tela de carregamento própria, toca em toda carga. Diagrama pessoas → processos → estratégia → visão integrada |
| Entrada | Câmera nasce baixa, enquadrando as raízes. Pausa de 850ms, depois sobe até a pose de repouso |
| Repouso | Enquadramento composto: tipografia à esquerda, árvore à direita |
| Scroll | Câmera sobe e aproxima, entrando na copa. O scroll é lido, nunca sequestrado |

### Árvore

`public/models/ecovisao-tree.glb` — 908 KB, ~85 mil triângulos, comprimido com
Draco. Reconstruído a partir de um fonte de 188 MB / 2,5 milhões de polígonos
(`Gledista_Triacanthos.glb`, mantido fora do repositório pelo `.gitignore`).

Os materiais são re-graduados em runtime para a paleta da marca — o GLB traz as
cores assadas no `baseColorFactor` e elas renderizam como um verde genérico de
viveiro.

As **raízes não existem no modelo** e são geradas proceduralmente em
[`components/hero/tree-roots.ts`](components/hero/tree-roots.ts): tubos com
afunilamento ao longo de curvas, com gerador de números pseudoaleatórios de
semente fixa para que a cena seja idêntica entre execuções — o que mantém os
pôsteres de fallback válidos.

### Degradação

- `prefers-reduced-motion`: nenhum WebGL é carregado; o pôster estático assume
- Falha de WebGL / perda de contexto: `SceneErrorBoundary` cai para o pôster
- Sem JavaScript: conteúdo e linhas topográficas renderizam em estado final

Os dois pôsteres (`public/images/tree-poster*.webp`) são **quadros capturados da
própria cena**, um por breakpoint — não aproximações desenhadas à parte.

## Pendências conhecidas

- **Core Web Vitals não foram medidos.** O plano fixa LCP < 2,5s, INP < 200ms e
  CLS < 0,1; não há número para nenhum deles. A intro trava o scroll por 1,1s a
  4,5s em toda carga, o que está em tensão com essa meta
- Existe um único GLB para desktop e mobile; o plano pedia duas versões
- O loader espera o 3D ficar pronto antes de liberar o conteúdo — o plano pedia
  o inverso
- Dados de contato a validar: WhatsApp, telefone comercial, e substituição do QR
  que hoje aponta para `scanned.page`

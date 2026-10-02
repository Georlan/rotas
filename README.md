# Rotas

MVP web para restaurantes transformarem uma lista de pedidos em uma sequência simples de entregas.

## O que já funciona

- importação manual de CSV;
- validação das colunas `id`, `cliente` e `endereco`;
- endereço do restaurante como ponto inicial;
- integração com Google Maps;
- geocodificação dos endereços;
- ordenação automática por heurística de vizinho mais próximo;
- mapa com o trajeto;
- ajuste manual da sequência;
- abrir o trajeto no Google Maps;
- marcar entregas como concluídas;
- histórico local das últimas rotas;
- layout mobile-first;
- build estático compatível com Cloudflare Pages.

O MVP limita cada rota a 20 entregas para manter o fluxo simples nesta primeira fase.

## Stack

- React 19
- TypeScript
- Vite
- Google Maps JavaScript API
- Vitest
- Cloudflare Pages / Wrangler

Não existe backend, login ou banco de dados nesta fase. O histórico fica no `localStorage` do navegador.

## CSV

O arquivo precisa ter pelo menos:

```csv
id,cliente,endereco
1001,Ana Souza,"Rua Exemplo, 120 - Centro, Fortaleza - CE"
1002,Bruno Lima,"Av. Exemplo, 455 - Aldeota, Fortaleza - CE"
```

Também são aceitas as colunas opcionais `telefone` e `observacao`. Arquivos separados por vírgula ou ponto e vírgula são aceitos.

Há um modelo em `public/modelo-pedidos.csv`.

## Google Maps

Crie um projeto no Google Cloud, habilite a Maps JavaScript API e os serviços necessários para geocodificação/rotas utilizados pela aplicação.

Copie o arquivo de ambiente:

```bash
cp .env.example .env
```

Depois informe:

```env
VITE_GOOGLE_MAPS_API_KEY=sua_chave
```

A chave de uma aplicação web Vite chega ao navegador. Portanto, ela **não deve ser tratada como um segredo de servidor**. Restrinja a chave no Google Cloud por domínio/referrer e apenas às APIs necessárias.

Sem a variável, o app ainda permite importar o CSV, revisar/reordenar pedidos, usar histórico local e gerar o link externo do Google Maps na ordem atual. A otimização automática e o mapa embutido ficam desativados.

## Desenvolvimento

Requer Node.js 22.

```bash
npm install
npm run dev
```

O Vite escuta em `0.0.0.0`, facilitando uso em containers e ambientes remotos.

Validação completa:

```bash
npm run check
```

Build de produção:

```bash
npm run build
```

A saída é gerada em `dist/`.

## Cloudflare Pages

O projeto já inclui `wrangler.toml` com `pages_build_output_dir = "./dist"`.

### Opção 1 — conectar o GitHub ao Cloudflare Pages

Use:

- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node.js:** 22
- **Environment variable:** `VITE_GOOGLE_MAPS_API_KEY`

A variável precisa existir durante o build porque o Vite injeta valores `VITE_*` no bundle.

### Opção 2 — Wrangler

Depois de autenticar o Wrangler:

```bash
npm run deploy
```

## Como a ordenação funciona hoje

1. o Google geocodifica o restaurante e cada endereço;
2. o app parte do restaurante;
3. seleciona a entrega geograficamente mais próxima;
4. repete o processo a partir da última entrega escolhida;
5. desenha a sequência obtida no Google Maps.

É uma heurística de vizinho mais próximo. Ela é propositalmente simples para o MVP e não garante a solução ótima de TSP/VRP. Em uma fase posterior, o algoritmo pode considerar tempo real de deslocamento, múltiplos entregadores, capacidade, janelas de entrega e otimização global.

## CI

O workflow `.github/workflows/ci.yml` executa em cada push/PR:

1. instalação das dependências;
2. testes unitários;
3. `npm run build`;
4. inicialização real de `npm run dev` seguida de um request HTTP;
5. verificação de `dist/index.html` e `dist/assets`.

Isso evita considerar o projeto pronto para Cloudflare se o build ou o servidor de desenvolvimento estiverem quebrados.

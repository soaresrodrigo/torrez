# Torre Z

Calculadoras e guia para quem mora em condomínio. Astro 6 + Tailwind 4, interatividade em TypeScript puro.
Planejamento no Obsidian: `projetos/vizinhanca/`. O nome do produto fica em `src/site.ts`.

| Rota | O que é |
|---|---|
| `/` | Landing de pré-lançamento (fica livre para divulgação) |
| `/simulador-reforma` | Calculadora de reforma |

## Comandos
| Comando | |
|---|---|
| `npm run dev` | servidor local em `localhost:4321` (`-- --host` para abrir no celular pelo Wi-Fi) |
| `npm test` | testes das contas (`node --test`, sem dependência extra) |
| `npm run build` | build estático em `dist/`; valida `src/data/*` com Zod |

## Onde fica cada coisa
- `src/lib/calc/`: contas em TypeScript puro, sem Astro (`reforma.ts`, `medidas.ts`, `servicos.ts`, `url.ts`).
- `src/data/`: `planta-comum.json` (validada em `planta.ts`), `precos.ts` (preços de referência da Bahia, fixos), `regras-condominio.ts`. Tudo validado com Zod ao importar.
- `src/components/reforma/Planta.astro`: SVG da planta, um `<path data-comodo>` por cômodo.
- `src/scripts/calculadora.ts`: liga o formulário às contas, guarda o estado na URL e compartilha.
- `tests/`: conferência com os totais da planta padrão.

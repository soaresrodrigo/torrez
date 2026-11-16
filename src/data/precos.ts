import { z } from 'astro/zod';
import type { PrecoReferencia } from '../lib/calc/tipos.ts';

// Preços de referência para Salvador e região (BA). Tabela fixa, revista à mão:
// ao mudar um valor, atualize `atualizado` (AAAA-MM) e a fonte.
// Origem: busca rápida na internet. Onde não há preço por m² publicado para a Bahia,
// a faixa sai da diária local dividida pelo rendimento médio do serviço.
// unidade: m2 | m | unidade | apartamento

const SALVADOR_PEDREIRO = 'https://www.getninjas.com.br/reformas-e-reparos/pedreiro/ba/salvador';
const SALVADOR_PINTOR = 'https://www.getninjas.com.br/reformas-e-reparos/pintor/ba/salvador';
const SALVADOR_GESSO = 'https://www.getninjas.com.br/reformas-e-reparos/gesso-e-drywall/ba/salvador';

const dados: PrecoReferencia[] = [
	{
		id: 'piso',
		servico: 'piso-assentamento',
		descricao: 'Assentamento de piso ou porcelanato até 60×60, só mão de obra',
		unidade: 'm2',
		min: 30,
		max: 60,
		atualizado: '2026-11',
		fonte: 'Diária de pedreiro em Salvador (R$ 150–400) ÷ 6–10 m²/dia',
		url: SALVADOR_PEDREIRO,
	},
	{
		id: 'piso-vinilico',
		servico: 'piso-vinilico',
		descricao: 'Instalação de piso vinílico colado ou clicado, só mão de obra (material: R$ 70–180/m²; na cozinha, prefira colado ou SPC)',
		unidade: 'm2',
		min: 20,
		max: 50,
		atualizado: '2026-11',
		fonte: 'Monitor do Mercado (R$ 25–60/m², média nacional), ajustado para Salvador',
		url: 'https://monitordomercado.com.br/economia-2/385451-trocar-o-piso-sem-fazer-sujeira-e-possivel-entao-entenda-quanto-custa-instalar-laminado-novo-sobre-a-ceramica-velha/',
	},
	{
		id: 'rodape',
		servico: 'rodape-instalacao',
		descricao: 'Assentamento de rodapé, só mão de obra',
		unidade: 'm',
		min: 10,
		max: 20,
		atualizado: '2026-11',
		fonte: 'Diária de pedreiro em Salvador e tabelas de mão de obra',
		url: SALVADOR_PEDREIRO,
	},
	{
		id: 'pintura-parede',
		servico: 'pintura-parede',
		descricao: 'Massa corrida + tinta em 2 demãos, só mão de obra',
		unidade: 'm2',
		min: 15,
		max: 30,
		atualizado: '2026-11',
		fonte: 'Pintores em Salvador (média R$ 7,20/m² só tinta) + massa',
		url: SALVADOR_PINTOR,
	},
	{
		id: 'pintura-teto',
		servico: 'pintura-teto',
		descricao: 'Tinta em 2 demãos, superfície pronta, só mão de obra',
		unidade: 'm2',
		min: 7,
		max: 15,
		atualizado: '2026-11',
		fonte: 'Pintores em Salvador (média R$ 7,20/m²)',
		url: SALVADOR_PINTOR,
	},
	{
		id: 'gesso',
		servico: 'forro-gesso',
		descricao: 'Forro de gesso em placas, material + instalação',
		unidade: 'm2',
		min: 55,
		max: 85,
		atualizado: '2026-11',
		fonte: 'Gesseiros em Salvador (mão de obra ~R$ 31/m²) + placas e estrutura',
		url: SALVADOR_GESSO,
	},
	{
		id: 'revestimento',
		servico: 'revestimento-assentamento',
		descricao: 'Assentamento de cerâmica na parede, só mão de obra',
		unidade: 'm2',
		min: 30,
		max: 55,
		atualizado: '2026-11',
		fonte: 'Diária de pedreiro em Salvador (R$ 150–400) ÷ 6–10 m²/dia',
		url: SALVADOR_PEDREIRO,
	},
	{
		id: 'bancada',
		servico: 'bancada-granito',
		descricao: 'Bancada de granito com cuba, instalada (em L ou maior, sai mais cara)',
		unidade: 'unidade',
		min: 900,
		max: 2800,
		atualizado: '2026-11',
		fonte: 'Anúncios em Salvador (prontas a partir de ~R$ 500) e Monitor do Mercado',
		url: 'https://monitordomercado.com.br/economia-2/403279-quanto-um-marmorista-cobra-para-trocar-a-bancada-da-cozinha-por-granito-em-2026-e-por-que-cuba-recorte-e-rodabanca-encarecem-o-servico/',
	},
	{
		id: 'box',
		servico: 'box-vidro',
		descricao: 'Box de vidro temperado de correr, instalado',
		unidade: 'unidade',
		min: 600,
		max: 1500,
		atualizado: '2026-11',
		fonte: 'GetNinjas (instalação de box R$ 350–1.500) e anúncios em Salvador',
		url: 'https://www.getninjas.com.br/reformas-e-reparos/vidraceiro/preco/instalar-box-no-banheiro',
	},
];

const precoSchema = z
	.object({
		id: z.string(),
		servico: z.string(),
		descricao: z.string(),
		unidade: z.enum(['apartamento', 'm2', 'm', 'unidade']),
		min: z.number().nonnegative(),
		max: z.number().nonnegative(),
		atualizado: z.string().regex(/^\d{4}-\d{2}$/, 'use AAAA-MM'),
		fonte: z.string(),
		url: z.url().optional(),
	})
	.refine((p) => p.max >= p.min, { message: 'max menor que min' });

/** Validado ao importar: um preço errado quebra o build e o `astro dev` na hora. */
export const precos: PrecoReferencia[] = z.array(precoSchema).parse(dados);

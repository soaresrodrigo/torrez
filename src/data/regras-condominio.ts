import { z } from 'astro/zod';
import type { RegraCondominio } from '../lib/calc/tipos.ts';

// Itens para a pessoa conferir no regimento do próprio condomínio antes da obra.
// São lembretes genéricos (cada condomínio tem as suas regras), não regras afirmadas.
// `servicos` liga o item a serviços da calculadora; vazio = geral.

const dados: RegraCondominio[] = [
	{
		id: 'porta-soleira',
		texto: 'Cor da porta de entrada e da soleira, que muitos condomínios padronizam.',
		servicos: ['piso', 'piso-vinilico'],
	},
	{ id: 'horario-obra', texto: 'Dias e horários permitidos para obra e barulho.', servicos: [] },
	{ id: 'aviso-obra', texto: 'Se é preciso avisar a administração antes de começar, e com quais documentos.', servicos: [] },
	{ id: 'rede-protecao', texto: 'Cor e modelo da rede de proteção das janelas.', servicos: [] },
	{ id: 'pelicula', texto: 'Se película nas janelas é permitida, e em que cor.', servicos: [] },
	{ id: 'cortina', texto: 'Cor de cortina ou persiana vista da fachada.', servicos: [] },
	{ id: 'grade', texto: 'Se é permitido instalar grade nas janelas.', servicos: [] },
	{ id: 'gas', texto: 'Regras para o gás (botijão ou gás encanado) na cozinha.', servicos: ['bancada'] },
];

const regraSchema = z.object({ id: z.string(), texto: z.string(), servicos: z.array(z.string()) });

export const regrasCondominio: RegraCondominio[] = z.array(regraSchema).parse(dados);

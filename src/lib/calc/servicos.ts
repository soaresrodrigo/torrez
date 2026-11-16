import type { Categoria, Comodo, Planta, Selecao, TipoComodo } from './tipos.ts';

/** Qual medida do cômodo o serviço usa. "unidade" = 1 por cômodo. */
export type BaseServico = 'piso' | 'teto' | 'paredeLiquida' | 'rodape' | 'unidade';

export interface ServicoDef {
	id: string;
	nome: string;
	base: BaseServico;
	unidade: 'm²' | 'm' | 'un';
	/** aplica a perda de material (padrão 10%) */
	perda: boolean;
	/** tipos de cômodo onde o serviço faz sentido; ausente = todos */
	tipos?: TipoComodo[];
	/** categorias de cômodo onde o serviço existe (tem prioridade sobre `tipos`) */
	categorias?: Categoria[];
	/** `servico` em src/data/precos.ts que dá a faixa de preço deste serviço */
	precoRef?: string;
	/** serviços que não podem ser marcados junto no mesmo cômodo (ex.: dois tipos de piso) */
	exclui?: string[];
}

export const SERVICOS: ServicoDef[] = [
	{
		id: 'piso',
		nome: 'Piso cerâmico ou porcelanato',
		base: 'piso',
		unidade: 'm²',
		perda: true,
		precoRef: 'piso-assentamento',
		exclui: ['piso-vinilico'],
	},
	{
		// Cômodos secos e cozinha (com modelo colado ou SPC). Banheiro, serviço e varanda ficam de fora.
		id: 'piso-vinilico',
		nome: 'Piso vinílico',
		base: 'piso',
		unidade: 'm²',
		perda: true,
		categorias: ['quarto', 'sala', 'circulacao', 'outro', 'cozinha'],
		precoRef: 'piso-vinilico',
		exclui: ['piso'],
	},
	{ id: 'rodape', nome: 'Rodapé', base: 'rodape', unidade: 'm', perda: true, tipos: ['seca'], precoRef: 'rodape-instalacao' },
	{
		id: 'pintura-parede',
		nome: 'Pintura de parede (massa + tinta)',
		base: 'paredeLiquida',
		unidade: 'm²',
		perda: false,
		tipos: ['seca'],
		precoRef: 'pintura-parede',
	},
	{
		id: 'pintura-teto',
		nome: 'Pintura de teto',
		base: 'teto',
		unidade: 'm²',
		perda: false,
		precoRef: 'pintura-teto',
	},
	{ id: 'gesso-teto', nome: 'Gesso/forro no teto', base: 'teto', unidade: 'm²', perda: true, precoRef: 'forro-gesso' },
	{
		id: 'revestimento-parede',
		nome: 'Revestimento de parede (cerâmica)',
		base: 'paredeLiquida',
		unidade: 'm²',
		perda: true,
		tipos: ['molhada'],
		precoRef: 'revestimento-assentamento',
	},
	{ id: 'bancada', nome: 'Bancada da cozinha', base: 'unidade', unidade: 'un', perda: false, categorias: ['cozinha'], precoRef: 'bancada-granito' },
	{
		id: 'box-vidro',
		nome: 'Box de vidro',
		base: 'unidade',
		unidade: 'un',
		perda: false,
		categorias: ['banheiro'],
		precoRef: 'box-vidro',
	},
];

export function servicoPorId(id: string): ServicoDef | undefined {
	return SERVICOS.find((s) => s.id === id);
}

export function servicoSeAplica(servico: ServicoDef, comodo: Comodo): boolean {
	if (servico.categorias) return servico.categorias.includes(comodo.categoria);
	if (servico.tipos) return servico.tipos.includes(comodo.tipo);
	return true;
}

export function servicosDoComodo(comodo: Comodo): ServicoDef[] {
	return SERVICOS.filter((s) => servicoSeAplica(s, comodo));
}

export interface Pacote {
	id: 'basico' | 'medio' | 'completo';
	nome: string;
	descricao: string;
	servicos: string[];
}

const BASICO = ['piso', 'rodape', 'pintura-parede', 'pintura-teto'];
const MEDIO = [...BASICO, 'gesso-teto'];
const COMPLETO = [...MEDIO, 'bancada', 'box-vidro'];

export const PACOTES: Pacote[] = [
	{ id: 'basico', nome: 'Básico', descricao: 'Lixar e pintar + piso e rodapé', servicos: BASICO },
	{ id: 'medio', nome: 'Médio', descricao: 'Básico + gesso no teto', servicos: MEDIO },
	{ id: 'completo', nome: 'Completo', descricao: 'Médio + bancada + box', servicos: COMPLETO },
];

/** Marca os serviços do pacote em todos os cômodos onde eles se aplicam. */
export function aplicarPacote(planta: Planta, pacoteId: Pacote['id']): Selecao {
	const pacote = PACOTES.find((p) => p.id === pacoteId);
	if (!pacote) return {};
	const selecao: Selecao = {};
	for (const comodo of planta.comodos) {
		const ids = servicosDoComodo(comodo)
			.filter((s) => pacote.servicos.includes(s.id))
			.map((s) => s.id);
		if (ids.length) selecao[comodo.id] = ids;
	}
	return selecao;
}

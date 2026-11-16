/** Tipos compartilhados da calculadora de reforma. TypeScript puro, sem Astro. */

export type TipoComodo = 'seca' | 'molhada';

/** Que cômodo é: define o tipo (seca/molhada), portas e janelas padrão e os serviços possíveis. */
export type Categoria = 'quarto' | 'sala' | 'circulacao' | 'cozinha' | 'banheiro' | 'servico' | 'varanda' | 'outro';

export interface Comodo {
	id: string;
	nome: string;
	categoria: Categoria;
	/** metros, canto superior esquerdo na planta (sem espelhar) */
	x: number;
	y: number;
	/** metros */
	largura: number;
	/** metros */
	comprimento: number;
	tipo: TipoComodo;
	portas: number;
	janelas: number;
	/** metros lineares de perímetro sem parede (vão aberto para outro cômodo) */
	ladoAberto?: number;
}

export interface Abertura {
	largura: number;
	altura: number;
}

export interface Planta {
	id: string;
	nome: string;
	espelhada?: string;
	/** metros */
	peDireito: number;
	comodos: Comodo[];
	aberturasPadrao: { porta: Abertura; janela: Abertura };
	provisorio?: string[];
	fonte?: string;
}

export type UnidadePreco = 'apartamento' | 'm2' | 'm' | 'unidade';

/** Faixa de preço de referência (busca na internet), fixa e revista de tempos em tempos. */
export interface PrecoReferencia {
	id: string;
	/** chave usada em `ServicoDef.precoRef` */
	servico: string;
	descricao: string;
	unidade: UnidadePreco;
	min: number;
	max: number;
	/** AAAA-MM */
	atualizado: string;
	fonte: string;
	url?: string;
}

export interface RegraCondominio {
	id: string;
	texto: string;
	/** serviços a que a regra se aplica; vazio = regra geral */
	servicos: string[];
}

/** cômodo → serviços marcados nele */
export type Selecao = Record<string, string[]>;

import { arred, medidasComodo } from './medidas.ts';
import { SERVICOS, servicoSeAplica } from './servicos.ts';
import type { ServicoDef } from './servicos.ts';
import type { Planta, PrecoReferencia, RegraCondominio, Selecao, UnidadePreco } from './tipos.ts';

export const PERDA_PADRAO = 0.1;

export interface EntradaReforma {
	planta: Planta;
	selecao: Selecao;
	/** fração de perda de material; padrão 0,10 */
	perda?: number;
}

export interface DadosReforma {
	precos: PrecoReferencia[];
	regras: RegraCondominio[];
}

export interface ItemQuantidade {
	servico: string;
	nome: string;
	unidade: ServicoDef['unidade'];
	/** quantidade por cômodo, sem perda */
	porComodo: { comodo: string; nome: string; quantidade: number }[];
	quantidade: number;
	/** quantidade de material a comprar (com perda, quando o serviço tem perda) */
	comPerda: number;
}

export interface FaixaPreco {
	/** id do serviço da calculadora */
	servico: string;
	nome: string;
	descricao: string;
	min: number;
	max: number;
	unidade: UnidadePreco;
	/** AAAA-MM */
	atualizado: string;
	fonte: string;
	url?: string;
	/** fração do apartamento usada quando o preço é por apartamento (1 = inteiro) */
	fracao: number;
	proporcional: boolean;
}

export interface ResultadoReforma {
	itens: ItemQuantidade[];
	/** uma faixa por serviço marcado que tem preço de referência */
	precos: FaixaPreco[];
	/** soma das faixas */
	total: { min: number; max: number } | null;
	/** serviços marcados que ainda não têm preço de referência */
	semPreco: string[];
	regras: RegraCondominio[];
	regrasGerais: RegraCondominio[];
	avisos: string[];
}

function quantidadeBase(servico: ServicoDef, planta: Planta, comodoId: string): number {
	const comodo = planta.comodos.find((c) => c.id === comodoId);
	if (!comodo) return 0;
	if (servico.base === 'unidade') return 1;
	return medidasComodo(comodo, planta)[servico.base];
}

/** Remove cômodos e serviços desconhecidos ou que não se aplicam ao cômodo. */
export function normalizarSelecao(planta: Planta, selecao: Selecao): Selecao {
	const limpa: Selecao = {};
	for (const comodo of planta.comodos) {
		const ids = selecao[comodo.id] ?? [];
		const validos: string[] = [];
		for (const s of SERVICOS) {
			if (!ids.includes(s.id) || !servicoSeAplica(s, comodo)) continue;
			// Serviços que se excluem (dois tipos de piso): fica o primeiro do catálogo.
			if (s.exclui?.some((x) => validos.includes(x))) continue;
			validos.push(s.id);
		}
		if (validos.length) limpa[comodo.id] = validos;
	}
	return limpa;
}

const arredDezenaAbaixo = (v: number) => Math.floor(v / 10) * 10;
const arredDezenaAcima = (v: number) => Math.ceil(v / 10) * 10;

export function calcularReforma(entrada: EntradaReforma, dados: DadosReforma): ResultadoReforma {
	const { planta } = entrada;
	const perda = entrada.perda ?? PERDA_PADRAO;
	const selecao = normalizarSelecao(planta, entrada.selecao);
	const marcados = new Set(Object.values(selecao).flat());

	// 1. Quantidades por serviço, na ordem do catálogo.
	const itens: ItemQuantidade[] = [];
	for (const servico of SERVICOS) {
		if (!marcados.has(servico.id)) continue;
		const porComodo = planta.comodos
			.filter((c) => selecao[c.id]?.includes(servico.id))
			.map((c) => ({ comodo: c.id, nome: c.nome, quantidade: quantidadeBase(servico, planta, c.id) }));
		const quantidade = arred(porComodo.reduce((s, p) => s + p.quantidade, 0));
		const comPerda = servico.perda ? arred(quantidade * (1 + perda)) : quantidade;
		itens.push({ servico: servico.id, nome: servico.nome, unidade: servico.unidade, porComodo, quantidade, comPerda });
	}

	// 2. Uma faixa de preço por serviço, a partir de src/data/precos.ts.
	const precos: FaixaPreco[] = [];
	const semPreco: string[] = [];
	for (const item of itens) {
		const servico = SERVICOS.find((s) => s.id === item.servico)!;
		const ref = servico.precoRef ? dados.precos.find((p) => p.servico === servico.precoRef) : undefined;
		if (!ref) {
			semPreco.push(item.nome);
			continue;
		}

		let fator = item.quantidade;
		let fracao = 1;
		if (ref.unidade === 'apartamento') {
			// Preço dado para o apto inteiro: proporcional à quantidade marcada.
			const cheio = planta.comodos
				.filter((c) => servicoSeAplica(servico, c))
				.reduce((soma, c) => soma + quantidadeBase(servico, planta, c.id), 0);
			fracao = cheio > 0 ? Math.min(1, item.quantidade / cheio) : 1;
			fator = fracao;
		}
		const proporcional = ref.unidade === 'apartamento' && fracao < 0.995;
		// Faixa por m²/m (ou proporcional) é estimativa: arredonda para a dezena.
		const aproxima = proporcional || ref.unidade === 'm2' || ref.unidade === 'm';

		precos.push({
			servico: item.servico,
			nome: item.nome,
			descricao: ref.descricao,
			min: aproxima ? arredDezenaAbaixo(ref.min * fator) : Math.round(ref.min * fator),
			max: aproxima ? arredDezenaAcima(ref.max * fator) : Math.round(ref.max * fator),
			unidade: ref.unidade,
			atualizado: ref.atualizado,
			fonte: ref.fonte,
			url: ref.url,
			fracao: arred(fracao, 3),
			proporcional,
		});
	}

	const total = precos.length
		? { min: precos.reduce((s, p) => s + p.min, 0), max: precos.reduce((s, p) => s + p.max, 0) }
		: null;

	// 3. Itens para conferir no regimento do condomínio, ligados ao que foi marcado.
	const regras = dados.regras.filter((r) => r.servicos.some((s) => marcados.has(s)));
	const regrasGerais = dados.regras.filter((r) => r.servicos.length === 0);

	// 4. Avisos.
	const avisos: string[] = [];
	if (precos.some((p) => p.proporcional)) {
		avisos.push('Parte do preço vale para o apartamento inteiro e foi calculada proporcionalmente à área marcada.');
	}
	if (semPreco.length && precos.length) {
		avisos.push(`O total não inclui: ${semPreco.join(', ')} (ainda sem preço de referência).`);
	}

	return { itens, precos, total, semPreco, regras, regrasGerais, avisos };
}

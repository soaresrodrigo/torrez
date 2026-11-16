import { CATEGORIAS, categoriaPorId } from './categorias.ts';
import { LIMITES } from './edicao.ts';
import { normalizarSelecao, PERDA_PADRAO } from './reforma.ts';
import type { Categoria, Comodo, Planta, Selecao } from './tipos.ts';

export interface EstadoCalculadora {
	/** planta invertida (imagem no espelho), comum em apartamentos vizinhos de porta */
	espelhada: boolean;
	selecao: Selecao;
	perda: number;
	/** planta editada pela pessoa; ausente = planta padrão */
	planta?: Planta;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const ID_VALIDO = /^[a-z0-9]{1,8}$/;
const RESERVADOS = new Set(['p', 'pd', 'perda', 'espelhada']);

/** Campos que definem a forma da planta (o que vai no link). */
const assinatura = (c: Comodo) => [c.id, c.categoria, r2(c.x), r2(c.y), r2(c.largura), r2(c.comprimento), c.nome];

/** A planta editada difere da padrão em algo que vai no link? */
export function plantaMudou(padrao: Planta, planta: Planta): boolean {
	if (r2(padrao.peDireito) !== r2(planta.peDireito)) return true;
	return JSON.stringify(padrao.comodos.map(assinatura)) !== JSON.stringify(planta.comodos.map(assinatura));
}

/** `id~categoria~x~y~largura~comprimento~nome` por cômodo, separados por `;`. */
function codificarComodos(planta: Planta): string {
	return planta.comodos.map((c) => assinatura(c).join('~')).join(';');
}

function decodificarComodos(padrao: Planta, texto: string): Comodo[] | undefined {
	const comodos: Comodo[] = [];
	const ids = new Set<string>();
	for (const parte of texto.split(';')) {
		const [id, cat, xs, ys, ls, cs, ...resto] = parte.split('~');
		const nome = resto.join('~').replace(/\s+/g, ' ').trim().slice(0, LIMITES.nome.max);
		const [x, y, largura, comprimento] = [xs, ys, ls, cs].map(Number);
		const lado = (v: number) => Number.isFinite(v) && v >= LIMITES.lado.min && v <= LIMITES.lado.max;
		if (
			!id || !ID_VALIDO.test(id) || RESERVADOS.has(id) || ids.has(id) ||
			!CATEGORIAS.some((c) => c.id === cat) ||
			!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 100 || Math.abs(y) > 100 ||
			!lado(largura) || !lado(comprimento) || !nome
		) {
			continue;
		}
		ids.add(id);
		const categoria = cat as Categoria;
		// Cômodo da planta padrão com a mesma categoria mantém portas e janelas dela.
		const original = padrao.comodos.find((c) => c.id === id && c.categoria === categoria);
		const def = categoriaPorId(categoria);
		comodos.push({
			id,
			nome,
			categoria,
			x: r2(x),
			y: r2(y),
			largura: r2(largura),
			comprimento: r2(comprimento),
			tipo: def.tipo,
			portas: original?.portas ?? def.portas,
			janelas: original?.janelas ?? def.janelas,
			ladoAberto: original?.ladoAberto ?? 0,
		});
		if (comodos.length >= LIMITES.comodos.max) break;
	}
	return comodos.length ? comodos : undefined;
}

/**
 * Estado → query string. Um parâmetro por cômodo com os serviços separados por vírgula:
 * `?espelhada=1&sala=piso,pintura-parede&q1=piso&perda=15&p=…&pd=2.8`.
 * Planta normal, perda padrão e planta padrão ficam de fora para o link sair curto.
 */
export function serializarEstado(padrao: Planta, estado: EstadoCalculadora): string {
	const planta = estado.planta ?? padrao;
	const params = new URLSearchParams();
	if (estado.espelhada) params.set('espelhada', '1');
	const selecao = normalizarSelecao(planta, estado.selecao);
	for (const comodo of planta.comodos) {
		const ids = selecao[comodo.id];
		if (ids?.length) params.set(comodo.id, ids.join(','));
	}
	const pct = Math.round(estado.perda * 100);
	if (pct !== Math.round(PERDA_PADRAO * 100)) params.set('perda', String(pct));
	if (estado.planta && plantaMudou(padrao, planta)) {
		const formaMudou = JSON.stringify(padrao.comodos.map(assinatura)) !== JSON.stringify(planta.comodos.map(assinatura));
		if (formaMudou) params.set('p', codificarComodos(planta));
		if (r2(planta.peDireito) !== r2(padrao.peDireito)) params.set('pd', String(r2(planta.peDireito)));
	}
	// Vírgula, ponto e vírgula, til e dois-pontos são seguros na query e ficam mais legíveis.
	return params.toString().replaceAll('%2C', ',').replaceAll('%3B', ';').replaceAll('%7E', '~');
}

export function lerEstado(padrao: Planta, query: string): EstadoCalculadora {
	const params = new URLSearchParams(query);

	let planta: Planta = padrao;
	const comodos = params.has('p') ? decodificarComodos(padrao, params.get('p')!) : undefined;
	if (comodos) planta = { ...planta, comodos };
	const pd = Number(params.get('pd'));
	if (params.has('pd') && Number.isFinite(pd) && pd >= LIMITES.peDireito.min && pd <= LIMITES.peDireito.max) {
		planta = { ...planta, peDireito: r2(pd) };
	}

	const selecao: Selecao = {};
	for (const comodo of planta.comodos) {
		const valor = params.get(comodo.id);
		if (valor) selecao[comodo.id] = valor.split(',').filter(Boolean);
	}
	const pct = Number(params.get('perda'));
	const perda = Number.isFinite(pct) && pct >= 0 && pct <= 50 && params.has('perda') ? pct / 100 : PERDA_PADRAO;

	const estado: EstadoCalculadora = {
		espelhada: params.get('espelhada') === '1',
		selecao: normalizarSelecao(planta, selecao),
		perda,
	};
	if (plantaMudou(padrao, planta)) estado.planta = planta;
	return estado;
}

import { categoriaPorId } from './categorias.ts';
import type { Categoria, Comodo, Planta } from './tipos.ts';

// Operações de edição da planta. Todas puras: recebem uma planta e devolvem outra.

export const LIMITES = {
	lado: { min: 0.5, max: 15 },
	peDireito: { min: 2.2, max: 4 },
	comodos: { max: 20 },
	nome: { max: 30 },
} as const;

/** Grade de 5 cm. */
export const PASSO = 0.05;
/** Distância (m) em que a borda de um cômodo "gruda" na de outro ao arrastar. */
export const IMA = 0.2;

const arred2 = (v: number) => Math.round(v * 100) / 100;
const naGrade = (v: number) => arred2(Math.round(v / PASSO) * PASSO);
const limitarLado = (v: number) => Math.min(LIMITES.lado.max, Math.max(LIMITES.lado.min, naGrade(v)));
const EPS = 0.01;

function trocar(planta: Planta, id: string, f: (c: Comodo) => Comodo): Planta {
	return { ...planta, comodos: planta.comodos.map((c) => (c.id === id ? f(c) : c)) };
}

/** Próximo id livre: c1, c2… (nunca colide com os parâmetros do link). */
export function novoId(planta: Planta): string {
	const usados = new Set(planta.comodos.map((c) => c.id));
	let n = 1;
	while (usados.has(`c${n}`)) n++;
	return `c${n}`;
}

/** Nome para um cômodo novo: "Quarto 3", "Varanda", "Varanda 2"… */
export function novoNome(planta: Planta, categoria: Categoria): string {
	const base = categoriaPorId(categoria).nome;
	const mesmos = planta.comodos.filter((c) => c.categoria === categoria).length;
	const nomes = new Set(planta.comodos.map((c) => c.nome));
	let n = mesmos + 1;
	let nome = mesmos === 0 ? base : `${base} ${n}`;
	while (nomes.has(nome)) nome = `${base} ${++n}`;
	return nome;
}

/** Adiciona um cômodo da categoria, encostado embaixo da planta, à esquerda. */
export function adicionarComodo(planta: Planta, categoria: Categoria): { planta: Planta; id: string } {
	if (planta.comodos.length >= LIMITES.comodos.max) return { planta, id: '' };
	const def = categoriaPorId(categoria);
	const id = novoId(planta);
	const minX = planta.comodos.length ? Math.min(...planta.comodos.map((c) => c.x)) : 0;
	const baixo = planta.comodos.length ? Math.max(...planta.comodos.map((c) => c.y + c.comprimento)) : 0;
	const comodo: Comodo = {
		id,
		nome: novoNome(planta, categoria),
		categoria,
		x: arred2(minX),
		y: arred2(baixo),
		largura: def.largura,
		comprimento: def.comprimento,
		tipo: def.tipo,
		portas: def.portas,
		janelas: def.janelas,
		ladoAberto: 0,
	};
	return { planta: { ...planta, comodos: [...planta.comodos, comodo] }, id };
}

export function removerComodo(planta: Planta, id: string): Planta {
	if (planta.comodos.length <= 1) return planta;
	return { ...planta, comodos: planta.comodos.filter((c) => c.id !== id) };
}

export function renomearComodo(planta: Planta, id: string, nome: string): Planta {
	const limpo = nome.replace(/\s+/g, ' ').trim().slice(0, LIMITES.nome.max);
	if (!limpo) return planta;
	return trocar(planta, id, (c) => ({ ...c, nome: limpo }));
}

export function definirPeDireito(planta: Planta, peDireito: number): Planta {
	const { min, max } = LIMITES.peDireito;
	if (!Number.isFinite(peDireito) || peDireito < min || peDireito > max) return planta;
	return { ...planta, peDireito: arred2(peDireito) };
}

const sobrepoe = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0) > EPS;

/**
 * Muda o tamanho de um cômodo. Cômodos que estavam além da borda que se moveu
 * (e de frente para ela) são empurrados junto, para nada ficar por cima.
 * `base` é a planta antes da operação: no arraste, cada movimento parte dela.
 */
export function redimensionarComodo(base: Planta, id: string, largura: number, comprimento: number): Planta {
	const alvo = base.comodos.find((c) => c.id === id);
	if (!alvo || !Number.isFinite(largura) || !Number.isFinite(comprimento)) return base;
	const w = limitarLado(largura);
	const h = limitarLado(comprimento);
	const dx = arred2(w - alvo.largura);
	const dy = arred2(h - alvo.comprimento);
	const direita = alvo.x + alvo.largura;
	const baixo = alvo.y + alvo.comprimento;

	return {
		...base,
		comodos: base.comodos.map((c) => {
			if (c.id === id) return { ...c, largura: w, comprimento: h };
			let { x, y } = c;
			if (dx && c.x >= direita - EPS && sobrepoe(c.y, c.y + c.comprimento, alvo.y, baixo)) x = arred2(x + dx);
			if (dy && c.y >= baixo - EPS && sobrepoe(c.x, c.x + c.largura, alvo.x, direita)) y = arred2(y + dy);
			return x === c.x && y === c.y ? c : { ...c, x, y };
		}),
	};
}

/**
 * Leva um cômodo para (x, y), na grade de 5 cm. Se uma borda ficar a menos de
 * `IMA` de uma borda de outro cômodo, ela gruda nela (alinhamento fácil no dedo).
 */
export function moverComodo(base: Planta, id: string, x: number, y: number): Planta {
	const alvo = base.comodos.find((c) => c.id === id);
	if (!alvo || !Number.isFinite(x) || !Number.isFinite(y)) return base;
	const outros = base.comodos.filter((c) => c.id !== id);

	const grudar = (v: number, tamanho: number, bordas: number[]) => {
		let melhor = naGrade(v);
		let dist = IMA;
		for (const b of bordas) {
			for (const cand of [b, b - tamanho]) {
				const d = Math.abs(v - cand);
				if (d < dist) {
					dist = d;
					melhor = arred2(cand);
				}
			}
		}
		return melhor;
	};
	const bordasX = outros.flatMap((c) => [c.x, c.x + c.largura]);
	const bordasY = outros.flatMap((c) => [c.y, c.y + c.comprimento]);
	const nx = grudar(x, alvo.largura, bordasX);
	const ny = grudar(y, alvo.comprimento, bordasY);
	return trocar(base, id, (c) => ({ ...c, x: nx, y: ny }));
}

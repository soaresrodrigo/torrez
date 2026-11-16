import type { Planta } from './tipos.ts';

export interface RetanguloComodo {
	id: string;
	/** metros, canto superior esquerdo já no sistema do desenho */
	x: number;
	y: number;
	/** metros */
	w: number;
	h: number;
}

export interface LayoutPlanta {
	/** metros */
	largura: number;
	altura: number;
	/** quanto foi somado a x e y de cada cômodo para o desenho começar em 0 */
	origem: { x: number; y: number };
	comodos: RetanguloComodo[];
}

/**
 * Retângulos da planta a partir da posição (x, y) e do tamanho de cada cômodo.
 * O desenho começa em (0, 0): se a pessoa arrastar um cômodo para a esquerda ou para cima,
 * tudo se desloca. `espelhada` inverte a planta na horizontal.
 * `origem` fixa o deslocamento (usado durante o arraste, para o desenho não pular).
 */
export function layoutPlanta(
	planta: Planta,
	espelhada = false,
	origem?: { x: number; y: number },
): LayoutPlanta {
	const cs = planta.comodos;
	const minX = cs.length ? Math.min(...cs.map((c) => c.x)) : 0;
	const minY = cs.length ? Math.min(...cs.map((c) => c.y)) : 0;
	const o = origem ?? { x: -minX, y: -minY };
	const largura = cs.length ? Math.max(...cs.map((c) => c.x + c.largura)) + o.x : 0;
	const altura = cs.length ? Math.max(...cs.map((c) => c.y + c.comprimento)) + o.y : 0;

	return {
		largura,
		altura,
		origem: o,
		comodos: cs.map((c) => {
			const x = c.x + o.x;
			return { id: c.id, x: espelhada ? largura - x - c.largura : x, y: c.y + o.y, w: c.largura, h: c.comprimento };
		}),
	};
}

/** Pares de cômodos que se sobrepõem (mais de 5 cm nos dois eixos). */
export function sobreposicoes(planta: Planta): [string, string][] {
	const EPS = 0.05;
	const pares: [string, string][] = [];
	const cs = planta.comodos;
	for (let i = 0; i < cs.length; i++) {
		for (let j = i + 1; j < cs.length; j++) {
			const a = cs[i];
			const b = cs[j];
			const dx = Math.min(a.x + a.largura, b.x + b.largura) - Math.max(a.x, b.x);
			const dy = Math.min(a.y + a.comprimento, b.y + b.comprimento) - Math.max(a.y, b.y);
			if (dx > EPS && dy > EPS) pares.push([a.id, b.id]);
		}
	}
	return pares;
}

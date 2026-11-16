import type { Comodo, Planta } from './tipos.ts';

export interface Medidas {
	/** m² */
	piso: number;
	/** m² */
	teto: number;
	/** m, já sem os lados abertos */
	perimetro: number;
	/** m² */
	paredeBruta: number;
	/** m², parede bruta menos portas e janelas */
	paredeLiquida: number;
	/** m, perímetro menos as larguras de porta */
	rodape: number;
}

/** Arredonda para `casas` decimais (padrão 2), evitando 0.30000000000000004. */
export function arred(valor: number, casas = 2): number {
	const f = 10 ** casas;
	return Math.round((valor + Number.EPSILON) * f) / f;
}

/** Medidas de um cômodo conforme as regras da nota "07 Regras de cálculo". */
export function medidasComodo(comodo: Comodo, planta: Planta): Medidas {
	const { largura: L, comprimento: C } = comodo;
	const H = planta.peDireito;
	const { porta, janela } = planta.aberturasPadrao;

	const piso = L * C;
	const perimetro = Math.max(0, 2 * (L + C) - (comodo.ladoAberto ?? 0));
	const paredeBruta = perimetro * H;
	const aberturas =
		comodo.portas * porta.largura * porta.altura + comodo.janelas * janela.largura * janela.altura;

	return {
		piso: arred(piso),
		teto: arred(piso),
		perimetro: arred(perimetro),
		paredeBruta: arred(paredeBruta),
		paredeLiquida: arred(Math.max(0, paredeBruta - aberturas)),
		rodape: arred(Math.max(0, perimetro - comodo.portas * porta.largura)),
	};
}

export function comodoPorId(planta: Planta, id: string): Comodo | undefined {
	return planta.comodos.find((c) => c.id === id);
}

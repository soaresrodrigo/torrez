import { layoutPlanta, sobreposicoes } from '../calc/layout.ts';
import { medidasComodo } from '../calc/medidas.ts';
import type { Planta } from '../calc/tipos.ts';

export const ESCALA = 100; // px por metro
const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const esc = (s: string) =>
	s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

export interface Moldura {
	/** metros */
	largura: number;
	altura: number;
	origem: { x: number; y: number };
}

export interface OpcoesSvg {
	espelhada?: boolean;
	/** cômodos clicáveis (role=button), na página */
	interativo?: boolean;
	/** modo edição do modal: arrastar o cômodo move, arrastar a alça do canto redimensiona */
	editavel?: boolean;
	/** cômodo em destaque (sendo arrastado ou escolhido na tabela) */
	destaque?: string;
	/** fixa escala e origem do desenho durante um arraste */
	moldura?: Moldura;
	classe?: string;
}

/**
 * SVG da planta como texto, usado no servidor (primeira pintura) e no navegador.
 * Um <path data-comodo> por cômodo; no modo edição, uma alça por cômodo.
 */
export function svgPlanta(planta: Planta, opcoes: OpcoesSvg = {}): string {
	const { espelhada = false, interativo = true, editavel = false, destaque, moldura, classe = '' } = opcoes;
	const lay = layoutPlanta(planta, espelhada && !editavel, moldura?.origem);
	const W = (moldura?.largura ?? lay.largura) * ESCALA;
	const H = (moldura?.altura ?? lay.altura) * ESCALA;
	const sobrepostos = new Set(sobreposicoes(planta).flat());

	const paths: string[] = [];
	const rotulos: string[] = [];
	const extras: string[] = [];
	for (const r of lay.comodos) {
		const comodo = planta.comodos.find((c) => c.id === r.id)!;
		const [x, y, w, h] = [r.x, r.y, r.w, r.h].map((v) => Math.round(v * ESCALA * 10) / 10);
		const area = fmt.format(medidasComodo(comodo, planta).piso);
		const attrs = interativo
			? ` role="button" tabindex="0" aria-pressed="false" aria-label="${esc(comodo.nome)}, ${area} metros quadrados"`
			: '';
		const classes = ['comodo', comodo.tipo, sobrepostos.has(comodo.id) && 'sobreposto', destaque === comodo.id && 'destaque']
			.filter(Boolean)
			.join(' ');
		paths.push(`<path d="M${x} ${y}h${w}v${h}h${-w}Z" data-comodo="${esc(comodo.id)}" class="${classes}"${attrs}/>`);

		// Cômodo estreito e comprido (corredor): rótulo em pé.
		const empe = w < 130 && h > w * 2;
		const pequeno = w < 110 || h < 70;
		rotulos.push(
			`<g transform="translate(${x + w / 2} ${y + h / 2})${empe ? ' rotate(-90)' : ''}"><text text-anchor="middle">` +
				`<tspan class="nome" x="0" dy="${empe || pequeno ? '0.35em' : '-0.2em'}">${esc(comodo.nome)}</tspan>` +
				(empe || pequeno ? '' : `<tspan class="area" x="0" dy="1.3em">${area} m²</tspan>`) +
				`</text></g>`,
		);

		if (editavel) {
			const ativo = destaque === comodo.id;
			extras.push(
				`<g class="alca${ativo ? ' ativa' : ''}" data-alca="${esc(comodo.id)}">` +
					`<circle cx="${x + w}" cy="${y + h}" r="30" class="alca-toque"/>` +
					`<circle cx="${x + w}" cy="${y + h}" r="${ativo ? 14 : 11}" class="alca-ponto"/></g>`,
			);
			if (ativo) {
				const txt = `${fmt.format(comodo.largura)} × ${fmt.format(comodo.comprimento)} m`;
				extras.push(
					`<g class="medida-ativa" transform="translate(${x + w / 2} ${y - 14})"><rect x="-95" y="-26" width="190" height="34" rx="8"/>` +
						`<text text-anchor="middle" y="-3">${txt}</text></g>`,
				);
			}
		}
	}

	const topo = editavel ? 50 : 12;
	return (
		`<svg overflow="visible" viewBox="-12 ${-topo} ${W + 24 + (editavel ? 20 : 0)} ${H + topo + (editavel ? 32 : 12)}" ` +
		`class="planta-svg${editavel ? ' editavel' : ''} ${classe}" role="group" ` +
		`aria-label="Planta do apartamento${interativo ? '. Toque em um cômodo para escolher os serviços.' : ''}">` +
		`<g>${paths.join('')}</g><g class="rotulos" aria-hidden="true">${rotulos.join('')}</g>` +
		(extras.length ? `<g aria-hidden="true">${extras.join('')}</g>` : '') +
		`</svg>`
	);
}

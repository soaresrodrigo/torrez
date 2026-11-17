import { CATEGORIAS } from '../calc/categorias.ts';
import { LIMITES } from '../calc/edicao.ts';
import { medidasComodo } from '../calc/medidas.ts';
import { EXTRAS_ID, servicosDoApartamento, servicosDoComodo, type ServicoDef } from '../calc/servicos.ts';
import type { Planta } from '../calc/tipos.ts';

// HTML dos slides de serviços e das linhas do modal de medidas, gerado a partir da planta.
// Usado no servidor (primeira pintura) e no navegador (quando a pessoa adiciona,
// remove ou renomeia cômodos), para as duas versões nunca divergirem.

const fmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const esc = (s: string) =>
	s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
const UN = { 'm²': 'm²', m: 'm', un: '' } as const;

/** Uma linha de serviço: caixa de marcar, nome e medida. */
function caixa(campo: string, s: ServicoDef, dica: string): string {
	return (
		`<label class="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-1.5 text-sm hover:bg-slate-50">` +
		`<input type="checkbox" name="${esc(campo)}" value="${s.id}" class="size-5 shrink-0 accent-teal-600" />` +
		`<span class="flex-1 leading-tight">${esc(s.nome)}</span>` +
		`<span class="text-xs tabular-nums text-slate-500">${dica}</span></label>`
	);
}

/**
 * Um <fieldset> por cômodo, mais um último para os extras do apartamento inteiro.
 * Só o `ativo` fica visível.
 */
export function htmlSlides(planta: Planta, ativo = 0): string {
	const total = planta.comodos.length + 1;
	const comodos = planta.comodos.map((c, i) => {
		const med = medidasComodo(c, planta);
		const servicos = servicosDoComodo(c)
			.map((s) => caixa(c.id, s, s.base === 'unidade' ? '1 un.' : `${fmt.format(med[s.base])} ${UN[s.unidade]}`))
			.join('');
		return (
			`<fieldset data-painel="${esc(c.id)}" role="group" aria-roledescription="slide" ` +
			`aria-label="${esc(c.nome)}, ${i + 1} de ${total}" class="min-w-0${i === ativo ? '' : ' hidden'}">` +
			`<legend class="contents"><span class="block text-sm font-semibold text-slate-900">${esc(c.nome)} ` +
			`<span class="font-normal text-slate-500">· ${fmt.format(med.piso)} m²</span></span></legend>` +
			`<div class="mt-1 grid gap-x-3 sm:grid-cols-2">${servicos}</div></fieldset>`
		);
	});
	const extras = servicosDoApartamento().map((s) => caixa(EXTRAS_ID, s, '1 un.')).join('');
	const slideExtras =
		`<fieldset data-painel="${EXTRAS_ID}" role="group" aria-roledescription="slide" ` +
		`aria-label="Apartamento todo, ${total} de ${total}" class="min-w-0${total - 1 === ativo ? '' : ' hidden'}">` +
		`<legend class="contents"><span class="block text-sm font-semibold text-slate-900">Apartamento todo ` +
		`<span class="font-normal text-slate-500">· valem uma vez</span></span></legend>` +
		`<div class="mt-1 grid gap-x-3 sm:grid-cols-2">${extras}</div></fieldset>`;
	return [...comodos, slideExtras].join('');
}

/** Bolinhas de navegação entre os slides (uma por cômodo e a dos extras). */
export function htmlPontos(planta: Planta): string {
	const nomes = [...planta.comodos.map((c) => c.nome), 'Apartamento todo'];
	return nomes
		.map(
			(nome, i) =>
				`<button type="button" role="tab" data-ir="${i}" aria-label="${esc(nome)}" title="${esc(nome)}" ` +
				`class="flex size-6 items-center justify-center"><span class="size-2 rounded-full bg-slate-300 transition-colors"></span></button>`,
		)
		.join('');
}

const campo =
	'w-16 rounded-lg border border-slate-300 px-2 py-1.5 tabular-nums invalid:border-rose-400 sm:w-20';

/** Linhas da tabela do modal: nome editável, largura × comprimento, área e remover. */
export function htmlLinhasMedidas(planta: Planta): string {
	const unico = planta.comodos.length <= 1;
	return planta.comodos
		.map((c) => {
			const area = fmt.format(medidasComodo(c, planta).piso);
			const nomeCat = CATEGORIAS.find((k) => k.id === c.categoria)?.nome ?? '';
			return (
				`<tr class="border-t border-slate-100" data-linha="${esc(c.id)}">` +
				`<th scope="row" class="py-1.5 pr-2 text-left font-normal">` +
				`<input type="text" name="n-${esc(c.id)}" value="${esc(c.nome)}" maxlength="${LIMITES.nome.max}" ` +
				`aria-label="Nome do cômodo" class="w-full min-w-0 rounded-lg border border-transparent px-1.5 py-1 text-xs font-medium text-slate-900 hover:border-slate-200 focus:border-slate-300 sm:text-sm" />` +
				`<span class="block px-1.5 text-[11px] text-slate-400">${esc(nomeCat)}</span></th>` +
				`<td class="py-1.5"><input type="number" name="l-${esc(c.id)}" value="${c.largura}" min="${LIMITES.lado.min}" max="${LIMITES.lado.max}" step="0.05" inputmode="decimal" aria-label="Largura de ${esc(c.nome)} em metros" class="${campo}" /></td>` +
				`<td class="px-1 text-slate-400" aria-hidden="true">×</td>` +
				`<td class="py-1.5"><input type="number" name="c-${esc(c.id)}" value="${c.comprimento}" min="${LIMITES.lado.min}" max="${LIMITES.lado.max}" step="0.05" inputmode="decimal" aria-label="Comprimento de ${esc(c.nome)} em metros" class="${campo}" /></td>` +
				`<td class="hidden whitespace-nowrap py-1.5 pl-2 text-right text-xs tabular-nums text-slate-600 sm:table-cell sm:text-sm">${area} m²</td>` +
				`<td class="py-1.5 pl-1 text-right"><button type="button" data-remover="${esc(c.id)}" ${unico ? 'disabled' : ''} ` +
				`aria-label="Remover ${esc(c.nome)}" title="Remover" class="flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 disabled:hover:bg-transparent">` +
				`<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke-linecap="round" stroke-linejoin="round"></path></svg>` +
				`</button></td></tr>`
			);
		})
		.join('');
}

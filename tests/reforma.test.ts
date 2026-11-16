import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import plantaJson from '../src/data/planta-comum.json' with { type: 'json' };
import { arred, medidasComodo } from '../src/lib/calc/medidas.ts';
import { aplicarPacote } from '../src/lib/calc/servicos.ts';
import { calcularReforma } from '../src/lib/calc/reforma.ts';
import { lerEstado, serializarEstado } from '../src/lib/calc/url.ts';
import { layoutPlanta, sobreposicoes } from '../src/lib/calc/layout.ts';
import {
	adicionarComodo,
	definirPeDireito,
	moverComodo,
	redimensionarComodo,
	removerComodo,
	renomearComodo,
} from '../src/lib/calc/edicao.ts';
import type { Planta, PrecoReferencia, RegraCondominio } from '../src/lib/calc/tipos.ts';

const planta = plantaJson as Planta;
const m = (id: string) => medidasComodo(planta.comodos.find((c) => c.id === id)!, planta);
const soma = (ids: string[], campo: 'piso' | 'paredeBruta' | 'paredeLiquida') =>
	arred(ids.reduce((s, id) => s + m(id)[campo], 0));

const ref = (servico: string, unidade: PrecoReferencia['unidade'], min: number, max: number): PrecoReferencia => ({
	id: servico,
	servico,
	descricao: servico,
	unidade,
	min,
	max,
	atualizado: '2026-11',
	fonte: 'teste',
});
const precos: PrecoReferencia[] = [
	ref('pintura-parede', 'm2', 22, 45),
	ref('pintura-teto', 'm2', 12, 20),
	ref('box-vidro', 'unidade', 800, 1800),
];
const regras: RegraCondominio[] = [
	{ id: 'soleira', texto: 'Soleira branca', servicos: ['piso'] },
	{ id: 'grade', texto: 'Sem grade', servicos: [] },
];
const dados = { precos, regras };

// Totais esperados da planta padrão (ver nota 07 Regras de cálculo).
describe('conferência com os totais da planta', () => {
	it('piso total 34,92 m²', () => {
		assert.equal(arred(soma(planta.comodos.map((c) => c.id), 'piso'), 2), 34.92);
	});
	it('piso sem banheiro 32,61 m²', () => {
		assert.equal(soma(['q1', 'q2', 'sala', 'circ', 'coz'], 'piso'), 32.61);
	});
	it('banheiro até o teto 16,64 m² bruto', () => {
		assert.equal(m('ban').paredeBruta, 16.64);
	});
	it('cozinha 28,34 m² bruto', () => {
		assert.equal(m('coz').paredeBruta, 28.34);
	});
	it('paredes secas 110,2 m² bruto e ~100 m² líquido', () => {
		const secas = planta.comodos.filter((c) => c.tipo === 'seca').map((c) => c.id);
		assert.equal(arred(soma(secas, 'paredeBruta'), 1), 110.2);
		const liquida = soma(secas, 'paredeLiquida');
		assert.ok(liquida > 95 && liquida < 105, `parede seca líquida = ${liquida}`);
	});
});

describe('medidasComodo', () => {
	it('desconta porta 0,80 × 2,10 da parede e 0,80 do rodapé', () => {
		const q2 = m('q2'); // 2,00 × 3,05, 1 porta, 1 janela 1,20 × 1,00
		assert.equal(q2.perimetro, 10.1);
		assert.equal(q2.paredeBruta, 26.26);
		assert.equal(q2.paredeLiquida, arred(26.26 - 1.68 - 1.2));
		assert.equal(q2.rodape, 9.3);
	});
	it('lado aberto reduz perímetro, parede e rodapé', () => {
		const sala = planta.comodos.find((c) => c.id === 'sala')!;
		const aberta = medidasComodo({ ...sala, ladoAberto: 2.4 }, planta);
		assert.equal(aberta.perimetro, 12.9 - 2.4);
	});
});

describe('calcularReforma', () => {
	it('piso com 10% de perda', () => {
		const r = calcularReforma({ planta, selecao: { sala: ['piso'], q1: ['piso'] } }, dados);
		const piso = r.itens.find((i) => i.servico === 'piso')!;
		assert.equal(piso.quantidade, 17.16);
		assert.equal(piso.comPerda, 18.88);
		assert.equal(r.total, null);
		assert.deepEqual(r.semPreco, ['Piso cerâmico ou porcelanato']);
	});

	it('ignora serviço que não se aplica ao cômodo', () => {
		const r = calcularReforma({ planta, selecao: { ban: ['rodape', 'box-vidro'], xx: ['piso'] } }, dados);
		assert.deepEqual(r.itens.map((i) => i.servico), ['box-vidro']);
	});

	it('preço por m² multiplica a área sem perda e arredonda para a dezena', () => {
		const r = calcularReforma({ planta, selecao: { q2: ['pintura-parede'] } }, dados);
		// q2: 23,38 m² × 22 = 514,4 → 510; × 45 = 1052,1 → 1060
		assert.deepEqual([r.precos[0].min, r.precos[0].max], [510, 1060]);
		assert.equal(r.precos[0].servico, 'pintura-parede');
	});

	it('preço por apartamento é proporcional à área marcada e gera aviso', () => {
		const apto = [ref('pintura-parede', 'apartamento', 2000, 3000)];
		const inteiro = calcularReforma({ planta, selecao: aplicarPacote(planta, 'basico') }, { precos: apto, regras });
		const cheio = inteiro.precos.find((p) => p.servico === 'pintura-parede')!;
		assert.deepEqual([cheio.min, cheio.max, cheio.proporcional], [2000, 3000, false]);
		const parte = calcularReforma({ planta, selecao: { q2: ['pintura-parede'] } }, { precos: apto, regras });
		assert.ok(parte.precos[0].proporcional && parte.precos[0].fracao < 0.3);
		assert.ok(parte.avisos.some((a) => a.includes('proporcionalmente')));
	});

	it('pacote completo soma o que tem preço e lista o que falta', () => {
		const r = calcularReforma({ planta, selecao: aplicarPacote(planta, 'completo') }, dados);
		assert.deepEqual(
			r.precos.map((p) => p.servico),
			['pintura-parede', 'pintura-teto', 'box-vidro'],
		);
		assert.equal(r.total!.min, r.precos.reduce((s, p) => s + p.min, 0));
		assert.ok(r.semPreco.includes('Piso cerâmico ou porcelanato') && r.semPreco.includes('Bancada da cozinha'));
	});

	it('itens do condomínio: os do serviço marcado e os gerais à parte', () => {
		const r = calcularReforma({ planta, selecao: { sala: ['piso'] } }, dados);
		assert.deepEqual(r.regras.map((x) => x.id), ['soleira']);
		assert.deepEqual(r.regrasGerais.map((x) => x.id), ['grade']);
		const r2 = calcularReforma({ planta, selecao: { sala: ['pintura-teto'] } }, dados);
		assert.deepEqual(r2.regras, []);
	});

	it('perda editável', () => {
		const r = calcularReforma({ planta, selecao: { ban: ['piso'] }, perda: 0.15 }, dados);
		assert.equal(r.itens[0].comPerda, arred(2.31 * 1.15));
	});
});

describe('estado na URL', () => {
	it('ida e volta', () => {
		const estado = { espelhada: true, selecao: { sala: ['piso', 'pintura-parede'], q1: ['piso'] }, perda: 0.15 };
		const qs = serializarEstado(planta, estado);
		assert.equal(qs, 'espelhada=1&q1=piso&sala=piso,pintura-parede&perda=15');
		assert.deepEqual(lerEstado(planta, qs), estado);
	});
	it('padrões ficam fora do link e lixo é ignorado', () => {
		assert.equal(serializarEstado(planta, { espelhada: false, selecao: {}, perda: 0.1 }), '');
		const e = lerEstado(planta, '?espelhada=x&sala=piso,foo&q9=piso&perda=abc');
		assert.deepEqual(e, { espelhada: false, selecao: { sala: ['piso'] }, perda: 0.1 });
	});
});

describe('planta editada no link', () => {
	it('ida e volta com cômodo novo, medidas e pé-direito', () => {
		let editada = redimensionarComodo(planta, 'q1', 2.5, 3.2);
		editada = adicionarComodo(editada, 'varanda').planta;
		editada = definirPeDireito(editada, 2.7);
		const estado = { espelhada: false, selecao: { q1: ['piso'], c1: ['piso'] }, perda: 0.1, planta: editada };
		const qs = serializarEstado(planta, estado);
		assert.ok(qs.includes('p=') && qs.includes('pd=2.7') && qs.includes('c1=piso'), qs);
		assert.deepEqual(lerEstado(planta, qs), estado);
	});

	it('planta igual à padrão não vai no link', () => {
		const qs = serializarEstado(planta, { espelhada: false, selecao: {}, perda: 0.1, planta: { ...planta } });
		assert.equal(qs, '');
		assert.equal(lerEstado(planta, '?pd=2.6').planta, undefined);
	});

	it('cômodo inválido no link é descartado; nenhum válido = planta padrão', () => {
		const e = lerEstado(planta, '?p=q1~quarto~0~0~0.1~3~Q;xx~foguete~0~0~2~2~X;perda~sala~0~0~2~2~Y');
		assert.equal(e.planta, undefined);
		const e2 = lerEstado(planta, '?p=' + encodeURIComponent('a1~quarto~0~0~3~3~Meu quarto'));
		assert.deepEqual(e2.planta!.comodos.map((c) => [c.id, c.nome, c.tipo]), [['a1', 'Meu quarto', 'seca']]);
	});

	it('área e conta usam a planta editada', () => {
		const editada = redimensionarComodo(planta, 'q1', 3, 4);
		const r = calcularReforma({ planta: editada, selecao: { q1: ['piso'] } }, dados);
		assert.equal(r.itens[0].quantidade, 12);
	});
});

describe('edição da planta', () => {
	const pos = (p: typeof planta, id: string) => {
		const c = p.comodos.find((x) => x.id === id)!;
		return [c.x, c.y, c.largura, c.comprimento];
	};

	it('layout padrão bate com o desenho original e espelha', () => {
		const lay = layoutPlanta(planta);
		assert.equal(arred(lay.largura, 2), 5.5);
		assert.equal(arred(lay.altura, 2), 7.15);
		const q1 = layoutPlanta(planta, true).comodos.find((c) => c.id === 'q1')!;
		assert.equal(arred(q1.x + q1.w, 2), 5.5);
	});

	it('alargar um cômodo empurra os da direita que estão de frente para ele', () => {
		const p = redimensionarComodo(planta, 'q1', 3, 3.1);
		assert.deepEqual(pos(p, 'ban'), [3, 0, 1.1, 2.1]);
		assert.deepEqual(pos(p, 'q2'), [4.1, 0, 2, 3.05]);
		assert.deepEqual(pos(p, 'sala'), [0, 3.1, 2.4, 4.05]);
		assert.deepEqual(sobreposicoes(p), []);
	});

	it('crescer para baixo empurra só quem está embaixo dele', () => {
		const p = redimensionarComodo(planta, 'q2', 2, 3.55);
		assert.deepEqual(pos(p, 'coz'), [3.5, 3.55, 1.7, 3.75]);
		assert.deepEqual(pos(p, 'sala'), [0, 3.1, 2.4, 4.05]);
	});

	it('mover usa a grade de 5 cm e gruda na borda do vizinho', () => {
		const p = moverComodo(planta, 'ban', 2.47, 0.12);
		assert.deepEqual(pos(p, 'ban').slice(0, 2), [2.4, 0]);
		const longe = moverComodo(planta, 'ban', 10.03, 10.02);
		assert.deepEqual(pos(longe, 'ban').slice(0, 2), [10.05, 10]);
	});

	it('adicionar dá id e nome novos, embaixo da planta; remover tira', () => {
		const { planta: p, id } = adicionarComodo(planta, 'quarto');
		const novo = p.comodos.find((c) => c.id === id)!;
		assert.equal(id, 'c1');
		assert.equal(novo.nome, 'Quarto 3');
		assert.deepEqual([novo.x, novo.y], [0, 7.15]);
		assert.equal(adicionarComodo(p, 'quarto').id, 'c2');
		assert.equal(removerComodo(p, id).comodos.length, planta.comodos.length);
	});

	it('serviços seguem a categoria do cômodo novo', () => {
		const { planta: p, id } = adicionarComodo(planta, 'banheiro');
		const r = calcularReforma({ planta: p, selecao: { [id]: ['box-vidro', 'piso-vinilico', 'rodape'] } }, dados);
		assert.deepEqual(r.itens.map((i) => i.servico), ['box-vidro']);
	});

	it('renomear limpa espaços e ignora nome vazio', () => {
		assert.equal(renomearComodo(planta, 'q1', '  Suíte   master ').comodos[0].nome, 'Suíte master');
		assert.equal(renomearComodo(planta, 'q1', '   ').comodos[0].nome, 'Dormitório 01');
	});
});

describe('piso vinílico', () => {
	it('aparece nos cômodos secos e na cozinha, não no banheiro', () => {
		const r = calcularReforma(
			{ planta, selecao: { ban: ['piso-vinilico'], sala: ['piso-vinilico'], coz: ['piso-vinilico'] } },
			dados,
		);
		assert.deepEqual(r.itens.map((i) => [i.servico, i.porComodo.map((c) => c.comodo)]), [['piso-vinilico', ['sala', 'coz']]]);
	});

	it('não convive com o piso cerâmico no mesmo cômodo', () => {
		const r = calcularReforma({ planta, selecao: { sala: ['piso-vinilico', 'piso'], q1: ['piso-vinilico'] } }, dados);
		assert.deepEqual(r.itens.map((i) => [i.servico, i.porComodo.map((c) => c.comodo)]), [
			['piso', ['sala']],
			['piso-vinilico', ['q1']],
		]);
	});

	it('cada tipo de piso usa o próprio preço', () => {
		const precosPiso = [ref('piso-assentamento', 'm2', 30, 60), ref('piso-vinilico', 'm2', 20, 50)];
		const r = calcularReforma({ planta, selecao: { sala: ['piso'], q1: ['piso-vinilico'] } }, { precos: precosPiso, regras });
		// sala 9,72 m² × 30–60; q1 7,44 m² × 20–50
		assert.deepEqual(r.precos.map((p) => [p.servico, p.min, p.max]), [
			['piso', 290, 590],
			['piso-vinilico', 140, 380],
		]);
	});
});

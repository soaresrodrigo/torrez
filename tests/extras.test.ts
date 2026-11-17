import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import plantaJson from '../src/data/planta-comum.json' with { type: 'json' };
import { precos } from '../src/data/precos.ts';
import { regrasCondominio } from '../src/data/regras-condominio.ts';
import { calcularReforma, EXTRAS_ID, normalizarSelecao, SERVICOS, servicoSeAplica } from '../src/lib/calc/index.ts';
import type { Planta } from '../src/lib/calc/tipos.ts';

const plantaComum = plantaJson as Planta;

describe('extras do apartamento inteiro', () => {
	it('valem uma vez, com o valor exato do orçamento de referência', () => {
		const r = calcularReforma(
			{ planta: plantaComum, selecao: { [EXTRAS_ID]: ['limpeza-final', 'art'] } },
			{ precos, regras: regrasCondominio },
		);
		assert.equal(r.total?.min, 646);
		assert.equal(r.total?.max, 646);
	});

	it('não aparecem em nenhum cômodo', () => {
		const extra = SERVICOS.find((s) => s.id === 'limpeza-final')!;
		assert.ok(plantaComum.comodos.every((c) => !servicoSeAplica(extra, c)));
	});

	it('a normalização mantém só extras válidos', () => {
		const limpa = normalizarSelecao(plantaComum, { [EXTRAS_ID]: ['limpeza-final', 'nao-existe', 'piso'] });
		assert.deepEqual(limpa, { [EXTRAS_ID]: ['limpeza-final'] });
	});

	it('confecção do banheiro não vai junto com piso no mesmo banheiro', () => {
		const ban = plantaComum.comodos.find((c) => c.categoria === 'banheiro')!;
		const junto = normalizarSelecao(plantaComum, { [ban.id]: ['piso', 'confeccao-banheiro'] });
		assert.deepEqual(junto[ban.id], ['piso']);
		const sozinha = normalizarSelecao(plantaComum, { [ban.id]: ['confeccao-banheiro', 'box-vidro'] });
		assert.deepEqual(sozinha[ban.id], ['box-vidro', 'confeccao-banheiro']); // ordem do catálogo
	});
});

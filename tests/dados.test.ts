import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { precos } from '../src/data/precos.ts';
import { regrasCondominio } from '../src/data/regras-condominio.ts';
import { SERVICOS } from '../src/lib/calc/servicos.ts';

describe('dados do site', () => {
	it('todo serviço da calculadora tem preço de referência', () => {
		const semPreco = SERVICOS.filter((s) => !precos.some((p) => p.servico === s.precoRef)).map((s) => s.id);
		assert.deepEqual(semPreco, []);
	});

	it('itens do condomínio só citam serviços que existem', () => {
		const ids = new Set(SERVICOS.map((s) => s.id));
		for (const r of regrasCondominio) for (const s of r.servicos) assert.ok(ids.has(s), `${r.id} → ${s}`);
	});
});

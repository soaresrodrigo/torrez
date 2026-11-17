// Liga o formulário da calculadora às funções puras de src/lib/calc.
import {
	adicionarComodo,
	aplicarPacote,
	calcularReforma,
	definirPeDireito,
	layoutPlanta,
	lerEstado,
	medidasComodo,
	moverComodo,
	normalizarSelecao,
	PACOTES,
	plantaMudou,
	redimensionarComodo,
	removerComodo,
	renomearComodo,
	EXTRAS_ID,
	SERVICOS,
	serializarEstado,
	sobreposicoes,
} from '../lib/calc/index.ts';
import type {
	Categoria,
	EstadoCalculadora,
	FaixaPreco,
	ItemQuantidade,
	Pacote,
	Planta,
	PrecoReferencia,
	RegraCondominio,
	ResultadoReforma,
	Selecao,
} from '../lib/calc/index.ts';
import { htmlLinhasMedidas, htmlPontos, htmlSlides } from '../lib/ui/paineis.ts';
import { ESCALA, svgPlanta } from '../lib/ui/planta-svg.ts';
import type { Moldura } from '../lib/ui/planta-svg.ts';

const dados = JSON.parse(document.getElementById('dados-reforma')!.textContent!) as {
	planta: Planta;
	precos: PrecoReferencia[];
	regras: RegraCondominio[];
};
const plantaPadrao = dados.planta;
/** Planta em uso (a padrão ou a editada pela pessoa): entra na conta, no desenho e nos slides. */
let planta: Planta = plantaPadrao;

const form = document.querySelector<HTMLFormElement>('#calc')!;
const saida = document.querySelector<HTMLOutputElement>('#resultado')!;
const previa = document.querySelector<HTMLElement>('#previa-valor')!;
const botaoCompartilhar = document.querySelector<HTMLButtonElement>('#compartilhar')!;
const desenho = document.querySelector<HTMLElement>('#planta-desenho')!;
const legenda = document.querySelector<HTMLElement>('#planta-legenda')!;
const legendaPadrao = legenda.textContent!.trim();
const classeSvg = desenho.querySelector('svg')!.getAttribute('class')!.replace('planta-svg', '').trim();
const slides = document.querySelector<HTMLElement>('#slides')!;
const pontosEl = document.querySelector<HTMLElement>('#pontos')!;
const contador = document.querySelector<HTMLElement>('#contador')!;
const MAX_PONTOS = 8;

const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const reais = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const esc = (s: string) =>
	s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Reinicia uma animação de CSS no elemento (remove a classe, força o reflow, põe de novo). */
function animar(el: Element | undefined, classe: string) {
	if (!el) return;
	el.classList.remove('anima-direita', 'anima-esquerda', 'anima-pulso', classe);
	void (el as HTMLElement).offsetWidth;
	el.classList.add(classe);
}

const faixa = (min: number, max: number) => (min === max ? reais.format(min) : `${reais.format(min)} a ${reais.format(max)}`);
const paineis = () => [...slides.querySelectorAll<HTMLFieldSetElement>('[data-painel]')];
// Um slide por cômodo e o último para os extras do apartamento inteiro.
const slideIds = () => [...planta.comodos.map((c) => c.id), EXTRAS_ID];
const pontos = () => [...pontosEl.querySelectorAll<HTMLButtonElement>('[data-ir]')];

// ---------- form ↔ estado ----------

function lerSelecao(): Selecao {
	const fd = new FormData(form);
	const selecao: Selecao = {};
	for (const id of slideIds()) {
		const ids = fd.getAll(id).map(String);
		if (ids.length) selecao[id] = ids;
	}
	return selecao;
}

function lerForm(): EstadoCalculadora {
	const fd = new FormData(form);
	const pct = Number(fd.get('perda'));
	const estado: EstadoCalculadora = {
		espelhada: fd.get('espelhada') === '1',
		selecao: lerSelecao(),
		perda: Number.isFinite(pct) && pct >= 0 && pct <= 50 ? pct / 100 : 0.1,
	};
	if (plantaMudou(plantaPadrao, planta)) estado.planta = planta;
	return estado;
}

function marcarSelecao(selecao: Selecao) {
	for (const input of slides.querySelectorAll<HTMLInputElement>('input[type=checkbox]')) {
		input.checked = selecao[input.name]?.includes(input.value) ?? false;
	}
}

function escreverForm(estado: EstadoCalculadora) {
	definirPlanta(estado.planta ?? plantaPadrao, { linhas: true, selecao: {} });
	marcarSelecao(estado.selecao);
	form.querySelector<HTMLInputElement>('input[name=espelhada]')!.checked = estado.espelhada;
	form.querySelector<HTMLInputElement>('input[name=perda]')!.value = String(Math.round(estado.perda * 100));
}

/**
 * Troca a planta em uso: refaz os slides (mantendo o que estava marcado) e,
 * se pedido, as linhas do modal. Durante a digitação/arraste as linhas não são
 * refeitas, para não tirar o foco do campo; só as áreas e os valores mudam.
 */
function definirPlanta(nova: Planta, opcoes: { linhas?: boolean; selecao?: Selecao } = {}) {
	const selecao = opcoes.selecao ?? lerSelecao();
	const idAtivo = paineis()[ativo]?.dataset.painel;
	planta = nova;
	const i = idAtivo ? slideIds().indexOf(idAtivo) : -1;
	ativo = i >= 0 ? i : Math.min(ativo, slideIds().length - 1);
	slides.innerHTML = htmlSlides(planta, ativo);
	pontosEl.innerHTML = htmlPontos(planta);
	marcarSelecao(selecao);
	if (opcoes.linhas) linhas.innerHTML = htmlLinhasMedidas(planta);
	else atualizarLinhas();
}

// ---------- planta ----------

let desenhoAtual = '';

/** Redesenha a planta só quando ela ou o espelhamento mudam. */
function desenharPlanta(espelhada: boolean) {
	const chave = JSON.stringify([planta.comodos, espelhada]);
	if (chave === desenhoAtual) return;
	desenhoAtual = chave;
	desenho.innerHTML = svgPlanta(planta, { espelhada, classe: classeSvg });
	const piso = planta.comodos.reduce((t, c) => t + medidasComodo(c, planta).piso, 0);
	legenda.textContent = plantaMudou(plantaPadrao, planta)
		? `Planta editada por você · ${num.format(piso)} m² de piso`
		: legendaPadrao;
}

function marcarPlanta(selecao: Selecao) {
	for (const path of desenho.querySelectorAll<SVGPathElement>('[data-comodo]')) {
		path.dataset.marcado = String(Boolean(selecao[path.dataset.comodo!]?.length));
	}
	pontos().forEach((p, i) => {
		const marcado = Boolean(selecao[slideIds()[i]]?.length);
		p.firstElementChild!.classList.toggle('bg-teal-500', marcado);
	});
}

// ---------- slides (um cômodo por vez) ----------

let ativo = 0;

function irPara(indice: number, foco = false) {
	const total = slideIds().length;
	const anterior = ativo;
	ativo = (indice + total) % total;
	marcarAtivo();
	if (ativo !== anterior) animar(paineis()[ativo], indice > anterior ? 'anima-direita' : 'anima-esquerda');
	if (foco) paineis()[ativo]?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true });
}

function marcarAtivo() {
	const id = slideIds()[ativo];
	paineis().forEach((p, i) => p.classList.toggle('hidden', i !== ativo));
	for (const path of desenho.querySelectorAll<SVGPathElement>('[data-comodo]')) {
		path.setAttribute('aria-pressed', String(path.dataset.comodo === id));
	}
	const muitos = slideIds().length > MAX_PONTOS;
	pontosEl.classList.toggle('hidden', muitos);
	contador.classList.toggle('hidden', !muitos);
	contador.textContent = `${ativo + 1}/${slideIds().length}`;
	pontos().forEach((p, i) => {
		p.setAttribute('aria-selected', String(i === ativo));
		p.firstElementChild!.classList.toggle('ring-2', i === ativo);
		p.firstElementChild!.classList.toggle('ring-teal-700', i === ativo);
	});
}

// Arrastar o dedo para o lado troca de cômodo.
let inicioX: number | null = null;
slides.addEventListener('pointerdown', (e) => {
	if (e.pointerType !== 'mouse') inicioX = e.clientX;
});
slides.addEventListener('pointerup', (e) => {
	if (inicioX === null) return;
	const dx = e.clientX - inicioX;
	inicioX = null;
	if (Math.abs(dx) > 50) irPara(ativo + (dx < 0 ? 1 : -1));
});
slides.addEventListener('pointercancel', () => (inicioX = null));

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-slide]')) {
	b.addEventListener('click', () => irPara(ativo + Number(b.dataset.slide)));
}
pontosEl.addEventListener('click', (e) => {
	const b = (e.target as Element).closest<HTMLButtonElement>('[data-ir]');
	if (b) irPara(Number(b.dataset.ir));
});

// Clique/teclado na planta (delegado: o SVG é redesenhado).
const indiceDoAlvo = (alvo: EventTarget | null) => {
	const id = (alvo as Element | null)?.closest<SVGPathElement>('[data-comodo]')?.dataset.comodo;
	return id ? planta.comodos.findIndex((c) => c.id === id) : -1;
};
desenho.addEventListener('click', (e) => {
	const i = indiceDoAlvo(e.target);
	if (i >= 0) irPara(i);
});
desenho.addEventListener('keydown', (e) => {
	const i = indiceDoAlvo(e.target);
	if (i >= 0 && (e.key === 'Enter' || e.key === ' ')) {
		e.preventDefault();
		irPara(i, true);
	}
});

// ---------- modal: editar a planta ----------

const dialogo = document.querySelector<HTMLDialogElement>('#medidas')!;
const formMedidas = document.querySelector<HTMLFormElement>('#form-medidas')!;
const previaMedidas = document.querySelector<HTMLElement>('#medidas-previa')!;
const totalMedidas = document.querySelector<HTMLElement>('#medidas-total')!;
const linhas = document.querySelector<HTMLElement>('#linhas-medidas')!;
const avisoSobreposicao = document.querySelector<HTMLElement>('#aviso-sobreposicao')!;
const botaoAdicionar = document.querySelector<HTMLButtonElement>('#adicionar-comodo')!;
const novaCategoria = document.querySelector<HTMLSelectElement>('#nova-categoria')!;

/** Arraste em andamento na prévia: mover o cômodo ou redimensionar pela alça. */
let arraste:
	| { modo: 'mover' | 'tamanho'; id: string; base: Planta; dx: number; dy: number; moldura: Moldura; x0: number; y0: number; andou: boolean }
	| null = null;
/** Cômodo em destaque na prévia (o último tocado). */
let destaque: string | undefined;

function desenharModal() {
	// A prévia fica sempre sem espelhar: é onde se edita.
	previaMedidas.innerHTML = svgPlanta(planta, {
		interativo: false,
		editavel: true,
		destaque: arraste?.id ?? destaque,
		moldura: arraste?.moldura,
		classe: 'h-auto w-full max-h-[45dvh]',
	});
	const piso = planta.comodos.reduce((t, c) => t + medidasComodo(c, planta).piso, 0);
	totalMedidas.textContent = `${num.format(piso)} m²`;
	const pares = sobreposicoes(planta);
	const nome = (id: string) => planta.comodos.find((c) => c.id === id)?.nome ?? id;
	avisoSobreposicao.classList.toggle('hidden', pares.length === 0);
	avisoSobreposicao.textContent = pares.length
		? `Cômodos sobrepostos: ${pares.map(([a, b]) => `${nome(a)} e ${nome(b)}`).join('; ')}. A área de cada um continua sendo somada.`
		: '';
	botaoAdicionar.disabled = planta.comodos.length >= 20;
}

/** Áreas e valores das linhas sem refazer a tabela (o foco fica onde está). */
function atualizarLinhas() {
	for (const c of planta.comodos) {
		const tr = linhas.querySelector<HTMLTableRowElement>(`[data-linha="${c.id}"]`);
		if (!tr) continue;
		tr.cells[4].textContent = `${num.format(medidasComodo(c, planta).piso)} m²`;
		for (const [nome, valor] of [[`l-${c.id}`, c.largura], [`c-${c.id}`, c.comprimento]] as const) {
			const campo = tr.querySelector<HTMLInputElement>(`[name="${nome}"]`)!;
			if (campo !== document.activeElement) campo.value = String(valor);
		}
	}
	for (const tr of linhas.querySelectorAll<HTMLTableRowElement>('[data-linha]')) {
		tr.classList.toggle('bg-teal-50', tr.dataset.linha === (arraste?.id ?? destaque));
	}
}

function aplicarEdicao(nova: Planta, linhasTambem = false) {
	definirPlanta(nova, { linhas: linhasTambem });
	desenharModal();
	atualizar();
}

formMedidas.addEventListener('input', (e) => {
	const campo = e.target as HTMLInputElement;
	const [prefixo, ...resto] = campo.name.split('-');
	const id = resto.join('-');
	const valor = Number(campo.value.replace(',', '.'));
	if (campo.name === 'pd') return aplicarEdicao(definirPeDireito(planta, valor));
	if (prefixo === 'n') return aplicarEdicao(renomearComodo(planta, id, campo.value));
	const c = planta.comodos.find((x) => x.id === id);
	if (!c || !campo.checkValidity()) return;
	destaque = id;
	if (prefixo === 'l') aplicarEdicao(redimensionarComodo(planta, id, valor, c.comprimento));
	if (prefixo === 'c') aplicarEdicao(redimensionarComodo(planta, id, c.largura, valor));
});
// Nome apagado volta ao que estava quando sai do campo.
formMedidas.addEventListener('focusout', (e) => {
	const campo = e.target as HTMLInputElement;
	if (!campo.name?.startsWith('n-')) return;
	const c = planta.comodos.find((x) => x.id === campo.name.slice(2));
	if (c && !campo.value.trim()) campo.value = c.nome;
});

linhas.addEventListener('click', (e) => {
	const id = (e.target as Element).closest<HTMLButtonElement>('[data-remover]')?.dataset.remover;
	if (!id) return;
	if (destaque === id) destaque = undefined;
	aplicarEdicao(removerComodo(planta, id), true);
});

botaoAdicionar.addEventListener('click', () => {
	const { planta: nova, id } = adicionarComodo(planta, novaCategoria.value as Categoria);
	if (!id) return;
	destaque = id;
	aplicarEdicao(nova, true);
	ativo = planta.comodos.findIndex((c) => c.id === id);
	marcarAtivo();
	linhas.querySelector<HTMLInputElement>(`[name="n-${id}"]`)?.focus();
});

document.querySelector('#abrir-medidas')!.addEventListener('click', () => {
	destaque = undefined;
	linhas.innerHTML = htmlLinhasMedidas(planta);
	formMedidas.querySelector<HTMLInputElement>('[name=pd]')!.value = String(planta.peDireito);
	desenharModal();
	dialogo.showModal();
});
document.querySelector('#medidas-padrao')!.addEventListener('click', () => {
	destaque = undefined;
	formMedidas.querySelector<HTMLInputElement>('[name=pd]')!.value = String(plantaPadrao.peDireito);
	aplicarEdicao(plantaPadrao, true);
});
// Clique fora do conteúdo fecha.
dialogo.addEventListener('click', (e) => {
	if (e.target === dialogo) dialogo.close();
});

// Arrastar na prévia: o cômodo muda de lugar; a bolinha do canto muda o tamanho.
function pontoEmMetros(e: PointerEvent, origem: { x: number; y: number }) {
	const svg = previaMedidas.querySelector('svg')!;
	const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM()!.inverse());
	return { x: p.x / ESCALA - origem.x, y: p.y / ESCALA - origem.y };
}

previaMedidas.addEventListener('pointerdown', (e) => {
	const alvo = e.target as Element;
	const idAlca = alvo.closest<SVGGElement>('[data-alca]')?.dataset.alca;
	const idComodo = alvo.closest<SVGPathElement>('[data-comodo]')?.dataset.comodo;
	const id = idAlca ?? idComodo;
	if (!id) return;
	e.preventDefault();
	const lay = layoutPlanta(planta);
	const moldura: Moldura = { largura: lay.largura, altura: lay.altura, origem: lay.origem };
	const c = planta.comodos.find((x) => x.id === id)!;
	const p = pontoEmMetros(e, lay.origem);
	arraste = {
		modo: idAlca ? 'tamanho' : 'mover',
		id,
		base: planta,
		dx: p.x - c.x,
		dy: p.y - c.y,
		moldura,
		x0: e.clientX,
		y0: e.clientY,
		andou: false,
	};
	destaque = id;
	previaMedidas.setPointerCapture(e.pointerId);
	desenharModal();
	atualizarLinhas();
});

previaMedidas.addEventListener('pointermove', (e) => {
	if (!arraste) return;
	if (!arraste.andou && Math.hypot(e.clientX - arraste.x0, e.clientY - arraste.y0) < 4) return;
	arraste.andou = true;
	const p = pontoEmMetros(e, arraste.moldura.origem);
	const c = arraste.base.comodos.find((x) => x.id === arraste!.id)!;
	const nova =
		arraste.modo === 'mover'
			? moverComodo(arraste.base, arraste.id, p.x - arraste.dx, p.y - arraste.dy)
			: redimensionarComodo(arraste.base, arraste.id, p.x - c.x, p.y - c.y);
	if (JSON.stringify(nova.comodos) === JSON.stringify(planta.comodos)) return;
	aplicarEdicao(nova);
});

const soltar = () => {
	if (!arraste) return;
	const tocou = !arraste.andou;
	const id = arraste.id;
	arraste = null;
	desenharModal();
	atualizarLinhas();
	// Toque sem arrastar: leva até a linha do cômodo na tabela.
	if (tocou) linhas.querySelector(`[data-linha="${id}"]`)?.scrollIntoView({ block: 'nearest' });
};
previaMedidas.addEventListener('pointerup', soltar);
previaMedidas.addEventListener('pointercancel', soltar);

// ---------- resultado ----------

function htmlItem(i: ItemQuantidade, p: FaixaPreco | undefined): string {
	const un = i.unidade === 'un' ? '' : ` ${i.unidade}`;
	const medida =
		i.unidade === 'un'
			? ''
			: `${num.format(i.quantidade)}${un}${i.comPerda !== i.quantidade ? ` · comprar ${num.format(i.comPerda)}${un}` : ''}`;
	const comodos = i.porComodo.map((c) => c.nome).join(', ');
	const preco = p
		? `<span class="font-semibold tabular-nums text-slate-900">${faixa(p.min, p.max)}</span>`
		: '<span class="text-xs text-slate-400">sem preço</span>';
	const detalhe = p
		? `<span class="block text-[11px] text-slate-400">${esc(p.descricao)}${
				p.url ? ` · <a class="underline underline-offset-2" href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.fonte)}</a>` : ''
			}</span>`
		: '';
	return `<li class="flex items-start justify-between gap-3 py-2">
		<div class="min-w-0"><p class="text-sm font-medium text-slate-900">${esc(i.nome)}</p>
			<p class="truncate text-xs text-slate-500">${[medida, esc(comodos)].filter(Boolean).join(' · ')}</p>${detalhe}</div>
		<div class="shrink-0 text-right text-sm">${preco}</div></li>`;
}

/** Itens já mostrados no resultado: só os novos entram animados. */
let itensMostrados = new Set<string>();

function render(r: ResultadoReforma) {
	const textoTotal = r.total ? faixa(r.total.min, r.total.max) : 'R$ 0';
	if (previa.textContent !== textoTotal && previa.textContent !== '') animar(previa.parentElement!, 'anima-pulso');
	previa.textContent = textoTotal;
	previa.parentElement!.classList.toggle('opacity-70', !r.total);

	if (!r.itens.length) {
		itensMostrados = new Set();
		saida.innerHTML = '<p class="text-sm text-slate-500">Toque em um cômodo da planta ou escolha um pacote.</p>';
		return;
	}

	let novos = 0;
	const itens = r.itens
		.map((i) => {
			const html = htmlItem(i, r.precos.find((p) => p.servico === i.servico));
			if (itensMostrados.has(i.servico)) return html;
			return html.replace('<li class="', `<li style="--atraso: ${novos++ * 50}ms" class="anima-entrar `);
		})
		.join('');
	itensMostrados = new Set(r.itens.map((i) => i.servico));
	const avisos = r.avisos
		.filter((a) => !a.startsWith('O total não inclui'))
		.map((a) => `<p class="mt-2 text-xs text-amber-800">${esc(a)}</p>`)
		.join('');

	const regra = (x: RegraCondominio) => `<li>${esc(x.texto)}</li>`;
	const regras =
		r.regras.length || r.regrasGerais.length
			? `<details class="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950" ${r.regras.length ? 'open' : ''}>
				<summary class="cursor-pointer font-semibold text-amber-900">Confira no seu condomínio${r.regras.length ? ` (${r.regras.length > 1 ? `${r.regras.length} itens ligados` : '1 item ligado'} ao que você marcou)` : ''}</summary>
				<ul class="mt-1 list-disc space-y-0.5 pl-5">${[...r.regras, ...r.regrasGerais].map(regra).join('')}</ul></details>`
			: '';

	saida.innerHTML = `<ul class="divide-y divide-slate-100">${itens}</ul>${avisos}${regras}`;
}

// ---------- ciclo ----------

function atualizar() {
	const estado = lerForm();
	const r = calcularReforma({ planta, selecao: estado.selecao, perda: estado.perda }, dados);
	render(r);
	desenharPlanta(estado.espelhada);
	marcarPlanta(estado.selecao);
	marcarAtivo();
	const qs = serializarEstado(plantaPadrao, estado);
	history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
	botaoCompartilhar.disabled = r.itens.length === 0;
	marcarPacote(estado.selecao);
}

// ---------- pacotes ----------

const botoesPacote = [...document.querySelectorAll<HTMLButtonElement>('[data-pacote]')];
const statusPacote = document.querySelector<HTMLElement>('#pacote-status')!;
const botaoLimpar = document.querySelector<HTMLButtonElement>('#limpar')!;

/** Pacote cuja seleção é exatamente a atual (ou nenhum, se a pessoa mexeu cômodo a cômodo). */
function pacoteAtual(selecao: Selecao): Pacote | undefined {
	const atual = JSON.stringify(normalizarSelecao(planta, selecao));
	return PACOTES.find((p) => JSON.stringify(aplicarPacote(planta, p.id)) === atual);
}

function marcarPacote(selecao: Selecao) {
	const vazio = Object.keys(normalizarSelecao(planta, selecao)).length === 0;
	const ativo = vazio ? undefined : pacoteAtual(selecao);
	for (const b of botoesPacote) b.setAttribute('aria-pressed', String(b.dataset.pacote === ativo?.id));
	botaoLimpar.disabled = vazio;
	statusPacote.textContent = ativo
		? `Pacote ${ativo.nome} marcado no apartamento todo.`
		: vazio
			? ''
			: 'Seleção personalizada, cômodo a cômodo.';
}

form.addEventListener('change', (e) => {
	// Dois tipos de piso no mesmo cômodo não fazem sentido: marcar um desmarca o outro.
	const alvo = e.target as HTMLInputElement;
	if (alvo.type === 'checkbox' && alvo.checked) {
		for (const id of SERVICOS.find((s) => s.id === alvo.value)?.exclui ?? []) {
			const outro = form.querySelector<HTMLInputElement>(`input[name="${alvo.name}"][value="${id}"]`);
			if (outro) outro.checked = false;
		}
	}
	atualizar();
});
form.addEventListener('input', (e) => {
	if ((e.target as HTMLInputElement).name === 'perda') atualizar();
});

for (const botao of botoesPacote) {
	botao.addEventListener('click', () => {
		// Clicar no pacote que já está marcado desmarca tudo.
		const jaMarcado = botao.getAttribute('aria-pressed') === 'true';
		marcarSelecao(jaMarcado ? {} : aplicarPacote(planta, botao.dataset.pacote as Pacote['id']));
		atualizar();
	});
}

botaoLimpar.addEventListener('click', () => {
	marcarSelecao({});
	atualizar();
});

botaoCompartilhar.addEventListener('click', async () => {
	const url = location.href;
	try {
		if (navigator.share) {
			await navigator.share({ title: document.title, text: 'Fiz a conta da reforma do meu apê:', url });
			return;
		}
		await navigator.clipboard.writeText(url);
		botaoCompartilhar.title = 'Link copiado';
		botaoCompartilhar.classList.add('ring-2', 'ring-teal-500');
		setTimeout(() => {
			botaoCompartilhar.title = 'Compartilhar resultado';
			botaoCompartilhar.classList.remove('ring-2', 'ring-teal-500');
		}, 2000);
	} catch (erro) {
		// Usuário cancelou o compartilhamento: nada a fazer.
		if ((erro as DOMException).name !== 'AbortError') console.error(erro);
	}
});

// Estado inicial vindo do link compartilhado.
escreverForm(lerEstado(plantaPadrao, location.search));
atualizar();

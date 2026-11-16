import type { Categoria, TipoComodo } from './tipos.ts';

export interface CategoriaDef {
	id: Categoria;
	/** nome no seletor e base do nome de um cômodo novo */
	nome: string;
	tipo: TipoComodo;
	portas: number;
	janelas: number;
	/** tamanho de um cômodo novo, em metros */
	largura: number;
	comprimento: number;
}

export const CATEGORIAS: CategoriaDef[] = [
	{ id: 'quarto', nome: 'Quarto', tipo: 'seca', portas: 1, janelas: 1, largura: 2.5, comprimento: 3 },
	{ id: 'sala', nome: 'Sala', tipo: 'seca', portas: 1, janelas: 1, largura: 3, comprimento: 3.5 },
	{ id: 'circulacao', nome: 'Circulação', tipo: 'seca', portas: 0, janelas: 0, largura: 0.9, comprimento: 2 },
	{ id: 'cozinha', nome: 'Cozinha', tipo: 'molhada', portas: 0, janelas: 1, largura: 1.8, comprimento: 3 },
	{ id: 'banheiro', nome: 'Banheiro', tipo: 'molhada', portas: 1, janelas: 1, largura: 1.2, comprimento: 2.2 },
	{ id: 'servico', nome: 'Área de serviço', tipo: 'molhada', portas: 0, janelas: 1, largura: 1.2, comprimento: 1.5 },
	{ id: 'varanda', nome: 'Varanda', tipo: 'molhada', portas: 1, janelas: 0, largura: 2.5, comprimento: 1.2 },
	{ id: 'outro', nome: 'Cômodo', tipo: 'seca', portas: 1, janelas: 0, largura: 2, comprimento: 2 },
];

export function categoriaPorId(id: Categoria): CategoriaDef {
	return CATEGORIAS.find((c) => c.id === id) ?? CATEGORIAS[CATEGORIAS.length - 1];
}

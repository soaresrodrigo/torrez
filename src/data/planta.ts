import { z } from 'astro/zod';
import type { Planta } from '../lib/calc/tipos.ts';
import json from './planta-comum.json';

// A planta é importada direto (não por Content Collection) para não depender do cache
// de conteúdo do `astro dev`. A validação acontece aqui: JSON errado quebra o build.

const abertura = z.object({ largura: z.number().positive(), altura: z.number().positive() });

export const plantaSchema = z.object({
	id: z.string(),
	nome: z.string(),
	espelhada: z.string().optional(),
	peDireito: z.number().min(2).max(4),
	comodos: z
		.array(
			z.object({
				id: z.string(),
				nome: z.string(),
				categoria: z.enum(['quarto', 'sala', 'circulacao', 'cozinha', 'banheiro', 'servico', 'varanda', 'outro']),
				x: z.number(),
				y: z.number(),
				largura: z.number().positive(),
				comprimento: z.number().positive(),
				tipo: z.enum(['seca', 'molhada']),
				portas: z.number().int().min(0),
				janelas: z.number().int().min(0),
				ladoAberto: z.number().min(0).default(0),
			}),
		)
		.min(1),
	aberturasPadrao: z.object({ porta: abertura, janela: abertura }),
	provisorio: z.array(z.string()).default([]),
	fonte: z.string().optional(),
});

export const plantaComum: Planta = plantaSchema.parse(json);

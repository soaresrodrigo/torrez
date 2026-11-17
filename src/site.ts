// Nome do produto e contato, num lugar só: menu, rodapé, títulos das páginas e WhatsApp.
export const NOME_SITE = 'Torre Z';

export const WHATSAPP = '5571987784959';
export const WHATSAPP_VISIVEL = '(71) 98778-4959';

/** Link para abrir conversa no WhatsApp com uma mensagem pronta. */
export function linkWhatsapp(mensagem = `Olá! Vim pelo site ${NOME_SITE}.`): string {
	return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(mensagem)}`;
}

// Caminho base do site: '/' em desenvolvimento e '/torrez/' no GitHub Pages.
export const BASE = import.meta.env.BASE_URL;
export const caminho = (rota: string) => `${BASE.replace(/\/$/, '')}/${rota.replace(/^\//, '')}`;

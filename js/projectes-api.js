(function () {
    'use strict';

    const CATEGORIES = {
        'obra-nova': 'Obra nova',
        'reformes': 'Reformes integrals',
        'piscines': 'Piscines',
        'pedra': 'Treballs amb pedra'
    };

    const cfg = window.SITE_CONFIG || {};
    const configured = Boolean(
        cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes('PENDENT') &&
        cfg.SUPABASE_ANON_KEY && cfg.SUPABASE_ANON_KEY !== 'PENDENT' &&
        window.supabase
    );

    const client = configured
        ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
        : null;

    const BUCKET = 'projectes';

    function imageUrl(path) {
        if (!path) return '';
        return `${cfg.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
    }

    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function slugify(text) {
        return String(text)
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .replace(/l·l/gi, 'll')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 70) || 'projecte';
    }

    function videoEmbedUrl(url) {
        if (!url) return null;
        let u;
        try { u = new URL(url); } catch { return null; }
        const host = u.hostname.replace(/^www\./, '');
        if (host === 'youtu.be') {
            const id = u.pathname.slice(1);
            return /^[\w-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
        }
        if (host === 'youtube.com' || host === 'm.youtube.com') {
            const id = u.searchParams.get('v') || (u.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)/) || [])[1];
            return id && /^[\w-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
        }
        if (host === 'vimeo.com' || host === 'player.vimeo.com') {
            const id = (u.pathname.match(/(\d{6,})/) || [])[1];
            return id ? `https://player.vimeo.com/video/${id}` : null;
        }
        return null;
    }

    async function llistarPublicats({ categoria, limit } = {}) {
        let q = client
            .from('projectes')
            .select('id, slug, titol, categoria, resum, ubicacio, any_projecte, portada')
            .eq('publicat', true)
            .order('ordre', { ascending: true })
            .order('created_at', { ascending: false });
        if (categoria) q = q.eq('categoria', categoria);
        if (limit) q = q.limit(limit);
        const { data, error } = await q;
        if (error) throw error;
        return data;
    }

    async function obtenirPerSlug(slug) {
        const { data, error } = await client
            .from('projectes')
            .select('*')
            .eq('slug', slug)
            .maybeSingle();
        if (error) throw error;
        return data;
    }

    window.ProjectesAPI = {
        CATEGORIES, configured, client, BUCKET,
        imageUrl, escapeHtml, slugify, videoEmbedUrl,
        llistarPublicats, obtenirPerSlug
    };
})();

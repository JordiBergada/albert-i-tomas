(function () {
    'use strict';

    const API = window.ProjectesAPI;
    if (!API || !API.configured) return;

    const { CATEGORIES, escapeHtml: e, imageUrl } = API;
    const base = document.body.dataset.base || '';

    function urlProjecte(slug) {
        return `${base}projecte.html?p=${encodeURIComponent(slug)}`;
    }

    function thumb(p) {
        return imageUrl(p.portada && (p.portada.thumb || p.portada.full));
    }

    function skeleton(n, cls) {
        return Array.from({ length: n }, () => `<div class="${cls} skeleton" aria-hidden="true"></div>`).join('');
    }

    // ---------- Home: últims 4 projectes ----------
    async function renderHome() {
        const gallery = document.querySelector('#projectes .gallery');
        if (!gallery) return;
        gallery.innerHTML = skeleton(4, 'project-card');
        try {
            const items = await API.llistarPublicats({ limit: 4 });
            if (!items.length) {
                gallery.innerHTML = '<p class="projects-empty">Aviat hi publicarem els nostres projectes.</p>';
                return;
            }
            gallery.innerHTML = items.map((p, i) => `
                <a class="project-card${i % 4 === 0 || i % 4 === 3 ? ' project-large' : ''}" href="${urlProjecte(p.slug)}">
                    <div class="project-image" style="background-image: url('${e(thumb(p))}');"></div>
                    <div class="project-info">
                        <span class="project-tag">${e(CATEGORIES[p.categoria])}</span>
                        <h3>${e(p.titol)}</h3>
                        ${p.resum ? `<p>${e(p.resum)}</p>` : ''}
                    </div>
                </a>`).join('');
        } catch (err) {
            console.error(err);
            gallery.innerHTML = '<p class="projects-empty">No s\'han pogut carregar els projectes.</p>';
        }
    }

    // ---------- Casos d'èxit: tots els projectes ----------
    async function renderLlistat() {
        const grid = document.getElementById('projectsGrid');
        if (!grid) return;
        grid.innerHTML = skeleton(6, 'project-item');
        try {
            const items = await API.llistarPublicats();
            if (!items.length) {
                grid.innerHTML = '';
                const empty = document.getElementById('filterEmpty');
                if (empty) { empty.textContent = 'Aviat hi publicarem els nostres projectes.'; empty.hidden = false; }
                return;
            }
            grid.innerHTML = items.map(p => `
                <a class="project-item" data-category="${e(p.categoria)}" href="${urlProjecte(p.slug)}">
                    <div class="project-item-image" style="background-image: url('${e(thumb(p))}');"></div>
                    <div class="project-item-body">
                        <span class="project-tag-light">${e(CATEGORIES[p.categoria])}</span>
                        <h3>${e(p.titol)}</h3>
                        ${p.resum ? `<p>${e(p.resum)}</p>` : ''}
                        ${p.ubicacio || p.any_projecte ? `<span class="project-item-meta">${e([p.ubicacio, p.any_projecte].filter(Boolean).join(' · '))}</span>` : ''}
                    </div>
                </a>`).join('');
            if (window.aplicarFiltreProjectes) window.aplicarFiltreProjectes();
        } catch (err) {
            console.error(err);
            grid.innerHTML = '<p class="projects-empty">No s\'han pogut carregar els projectes.</p>';
        }
    }

    // ---------- Fitxa individual ----------
    async function renderFitxa() {
        const root = document.getElementById('projecteRoot');
        if (!root) return;
        const slug = new URLSearchParams(location.search).get('p');
        const notFound = () => {
            root.innerHTML = `
                <section class="page-hero">
                    <div class="container page-hero-content">
                        <span class="eyebrow">Casos d'èxit</span>
                        <h1>No hem trobat aquest projecte.</h1>
                        <p class="page-hero-subtitle">Pot ser que s'hagi retirat o que l'enllaç no sigui correcte.</p>
                        <div class="hero-actions" style="margin-top:32px">
                            <a href="${base}casos-exit.html" class="btn btn-primary">Veure tots els projectes</a>
                        </div>
                    </div>
                </section>`;
        };
        if (!slug) return notFound();

        try {
            const p = await API.obtenirPerSlug(slug);
            if (!p) return notFound();

            document.title = `${p.titol} · Construccions i Reformes Albert i Tomàs`;
            const meta = document.querySelector('meta[name="description"]');
            if (meta && p.resum) meta.setAttribute('content', p.resum);

            const imatges = [p.portada, ...(p.imatges || [])].filter(Boolean);
            const video = API.videoEmbedUrl(p.video_url);
            const paragrafs = (p.descripcio || '').split(/\n\s*\n/).map(t => t.trim()).filter(Boolean);
            const cat = CATEGORIES[p.categoria];

            const dades = [
                ['Categoria', cat],
                ['Ubicació', p.ubicacio],
                ['Any', p.any_projecte]
            ].filter(([, v]) => v);

            const galeria = imatges.map((img, i) => `
                <button type="button" class="pg-item pg-item-${(i % 6) + 1}" data-index="${i}" aria-label="Ampliar imatge ${i + 1}">
                    <span style="background-image: url('${e(imageUrl(img.thumb || img.full))}');"></span>
                </button>`).join('');

            root.innerHTML = `
                <section class="project-hero">
                    <div class="hero-bg" style="background-image: url('${e(imageUrl(p.portada && p.portada.full))}');" aria-hidden="true"></div>
                    <div class="hero-overlay" aria-hidden="true"></div>
                    <div class="container project-hero-content">
                        <nav class="breadcrumb" aria-label="Ruta">
                            <a href="${base}index.html">Inici</a><span class="breadcrumb-sep">/</span>
                            <a href="${base}casos-exit.html">Casos d'èxit</a><span class="breadcrumb-sep">/</span>
                            <span>${e(p.titol)}</span>
                        </nav>
                        <a class="project-hero-tag" href="${base}casos-exit.html?cat=${e(p.categoria)}">${e(cat)}</a>
                        <h1>${e(p.titol)}</h1>
                    </div>
                </section>

                <section class="section project-body">
                    <div class="container project-layout">
                        <aside class="project-aside">
                            <span class="eyebrow">Sobre el projecte</span>
                            ${p.resum ? `<p class="project-aside-lead">${e(p.resum)}</p>` : ''}
                            ${paragrafs.map(t => `<p class="project-aside-text">${e(t)}</p>`).join('')}
                            ${dades.length ? `<dl class="project-facts">${dades.map(([k, v]) => `<div><dt>${e(k)}</dt><dd>${e(v)}</dd></div>`).join('')}</dl>` : ''}
                            <a href="${base}contacte.html" class="btn btn-primary btn-full">
                                Vull un projecte com aquest
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                            </a>
                        </aside>

                        <div class="project-media">
                            ${video ? `<div class="project-video"><iframe src="${e(video)}" title="Vídeo del projecte" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>` : ''}
                            <div class="project-gallery">${galeria}</div>
                        </div>
                    </div>
                </section>`;

            initLightbox(imatges.map(img => imageUrl(img.full || img.thumb)), p.titol);
            renderRelacionats(p);
        } catch (err) {
            console.error(err);
            notFound();
        }
    }

    async function renderRelacionats(actual) {
        const wrap = document.getElementById('projectesRelacionats');
        if (!wrap) return;
        try {
            const items = (await API.llistarPublicats({ categoria: actual.categoria, limit: 4 }))
                .filter(p => p.id !== actual.id).slice(0, 3);
            if (!items.length) return;
            wrap.hidden = false;
            wrap.querySelector('.projects-grid').innerHTML = items.map(p => `
                <a class="project-item" href="${urlProjecte(p.slug)}">
                    <div class="project-item-image" style="background-image: url('${e(thumb(p))}');"></div>
                    <div class="project-item-body">
                        <span class="project-tag-light">${e(CATEGORIES[p.categoria])}</span>
                        <h3>${e(p.titol)}</h3>
                        ${p.resum ? `<p>${e(p.resum)}</p>` : ''}
                    </div>
                </a>`).join('');
        } catch (err) {
            console.error(err);
        }
    }

    // ---------- Lightbox ----------
    function initLightbox(urls, titol) {
        if (!urls.length) return;
        const box = document.createElement('div');
        box.className = 'lightbox';
        box.hidden = true;
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('aria-label', `Galeria: ${titol}`);
        box.innerHTML = `
            <button type="button" class="lightbox-close" aria-label="Tancar">&times;</button>
            <button type="button" class="lightbox-nav lightbox-prev" aria-label="Anterior">&#8249;</button>
            <img class="lightbox-img" alt="">
            <button type="button" class="lightbox-nav lightbox-next" aria-label="Següent">&#8250;</button>
            <span class="lightbox-count"></span>`;
        document.body.appendChild(box);

        const img = box.querySelector('.lightbox-img');
        const count = box.querySelector('.lightbox-count');
        let idx = 0;
        let lastFocus = null;

        const show = (i) => {
            idx = (i + urls.length) % urls.length;
            img.src = urls[idx];
            img.alt = `${titol} · imatge ${idx + 1}`;
            count.textContent = `${idx + 1} / ${urls.length}`;
        };
        const open = (i) => {
            lastFocus = document.activeElement;
            show(i);
            box.hidden = false;
            document.body.style.overflow = 'hidden';
            box.querySelector('.lightbox-close').focus();
        };
        const close = () => {
            box.hidden = true;
            document.body.style.overflow = '';
            if (lastFocus) lastFocus.focus();
        };

        const multi = urls.length > 1;
        box.querySelectorAll('.lightbox-nav').forEach(b => { b.hidden = !multi; });

        document.querySelector('.project-gallery').addEventListener('click', (ev) => {
            const item = ev.target.closest('.pg-item');
            if (item) open(Number(item.dataset.index));
        });
        box.querySelector('.lightbox-close').addEventListener('click', close);
        box.querySelector('.lightbox-prev').addEventListener('click', () => show(idx - 1));
        box.querySelector('.lightbox-next').addEventListener('click', () => show(idx + 1));
        box.addEventListener('click', (ev) => { if (ev.target === box) close(); });
        document.addEventListener('keydown', (ev) => {
            if (box.hidden) return;
            if (ev.key === 'Escape') close();
            if (ev.key === 'ArrowLeft' && multi) show(idx - 1);
            if (ev.key === 'ArrowRight' && multi) show(idx + 1);
        });
    }

    renderHome();
    renderLlistat();
    renderFitxa();
})();

/* ===========================
   Construccions i Reformes Albert i Tomàs
   Script principal
   =========================== */

(function () {
    'use strict';

    // Any al footer
    const yearEl = document.getElementById('year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    // Navbar amb ombra/contracció en scroll
    const navbar = document.getElementById('navbar');
    const onScroll = () => {
        if (window.scrollY > 20) navbar.classList.add('scrolled');
        else navbar.classList.remove('scrolled');
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Menú mòbil
    const navToggle = document.getElementById('navToggle');
    const nav = document.getElementById('nav');

    if (navToggle && nav) {
        navToggle.addEventListener('click', () => {
            const isOpen = nav.classList.toggle('open');
            navToggle.classList.toggle('active', isOpen);
            navToggle.setAttribute('aria-expanded', String(isOpen));
        });

        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('open');
                navToggle.classList.remove('active');
                navToggle.setAttribute('aria-expanded', 'false');
            });
        });
    }


    // Submenú de serveis
    document.querySelectorAll('.nav-has-sub').forEach(item => {
        const btn = item.querySelector('.nav-sub-toggle');
        btn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const open = item.classList.toggle('is-open');
            btn.setAttribute('aria-expanded', String(open));
        });
    });

    document.addEventListener('click', (ev) => {
        document.querySelectorAll('.nav-has-sub.is-open').forEach(item => {
            if (item.contains(ev.target)) return;
            item.classList.remove('is-open');
            item.querySelector('.nav-sub-toggle').setAttribute('aria-expanded', 'false');
        });
    });

    document.addEventListener('keydown', (ev) => {
        if (ev.key !== 'Escape') return;
        document.querySelectorAll('.nav-has-sub.is-open').forEach(item => {
            item.classList.remove('is-open');
            item.querySelector('.nav-sub-toggle').setAttribute('aria-expanded', 'false');
        });
    });

    // FAQ: tanca els altres quan se n'obre un
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        item.addEventListener('toggle', () => {
            if (item.open) {
                faqItems.forEach(other => {
                    if (other !== item) other.removeAttribute('open');
                });
            }
        });
    });

    // Reveal en scroll
    if ('IntersectionObserver' in window) {
        const revealSelectors = [
            '.section-header',
            '.service-card',
            '.project-card',
            '.reel-card',
            '.testimonial-card',
            '.faq-item',
            '.about-text',
            '.about-images',
            '.contact-info',
            '.contact-form',
            '.cta-banner-inner > *',
            '.hero-content > *',
            '.stat',
            '.team-card',
            '.value-card',
            '.story-text',
            '.story-image',
            '.stat-block'
        ];

        const elements = document.querySelectorAll(revealSelectors.join(','));
        elements.forEach((el, i) => {
            el.classList.add('reveal');
            el.style.transitionDelay = `${Math.min(i * 40, 240)}ms`;
        });

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        elements.forEach(el => observer.observe(el));
    }

    // Reels: arrossegar amb el ratolí
    const reels = document.querySelector('.reels-track');
    if (reels) {
        let isDown = false;
        let startX = 0;
        let scrollLeft = 0;

        reels.addEventListener('mousedown', (e) => {
            isDown = true;
            reels.classList.add('dragging');
            startX = e.pageX - reels.offsetLeft;
            scrollLeft = reels.scrollLeft;
        });
        ['mouseleave', 'mouseup'].forEach(ev =>
            reels.addEventListener(ev, () => { isDown = false; reels.classList.remove('dragging'); })
        );
        reels.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - reels.offsetLeft;
            reels.scrollLeft = scrollLeft - (x - startX) * 1.4;
        });
    }


    // Filtre de projectes (pàgina Casos d'èxit)
    const filterBar = document.getElementById('filterBar');
    const projectsGrid = document.getElementById('projectsGrid');
    const filterEmpty = document.getElementById('filterEmpty');

    function aplicarFiltre(filter) {
        if (!filterBar || !projectsGrid) return;
        const valid = filterBar.querySelector(`.filter-btn[data-filter="${filter}"]`);
        if (!valid) filter = 'all';

        filterBar.querySelectorAll('.filter-btn').forEach(b => {
            const active = b.dataset.filter === filter;
            b.classList.toggle('is-active', active);
            b.setAttribute('aria-selected', String(active));
        });

        let visible = 0;
        projectsGrid.querySelectorAll('.project-item').forEach(item => {
            const match = filter === 'all' || item.dataset.category === filter;
            item.classList.toggle('is-hidden', !match);
            if (match) visible++;
        });

        if (filterEmpty) filterEmpty.hidden = visible > 0;
    }

    if (filterBar && projectsGrid) {
        filterBar.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-btn');
            if (!btn) return;
            aplicarFiltre(btn.dataset.filter);
            const url = new URL(location.href);
            if (btn.dataset.filter === 'all') url.searchParams.delete('cat');
            else url.searchParams.set('cat', btn.dataset.filter);
            history.replaceState(null, '', url);
        });
        aplicarFiltre(new URLSearchParams(location.search).get('cat') || 'all');
    }

    window.aplicarFiltreProjectes = () =>
        aplicarFiltre(new URLSearchParams(location.search).get('cat') || 'all');

    // Formulari de contacte
    const form = document.getElementById('contactForm');
    const feedback = document.getElementById('formFeedback');

    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = form.name.value.trim();
            const phone = form.phone.value.trim();
            const email = form.email.value.trim();
            const message = form.message.value.trim();

            if (!name || !phone || !email || !message) {
                feedback.textContent = 'Si us plau, omple tots els camps.';
                feedback.style.color = '#C25B3F';
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                feedback.textContent = 'Si us plau, introdueix un correu electrònic vàlid.';
                feedback.style.color = '#C25B3F';
                return;
            }

            feedback.textContent = 'Gràcies! Hem rebut el teu missatge i et contactarem aviat.';
            feedback.style.color = '#1F7A3A';
            form.reset();
        });
    }
})();

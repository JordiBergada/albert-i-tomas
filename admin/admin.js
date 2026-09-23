(function () {
    'use strict';

    const API = window.ProjectesAPI;
    const $ = (sel, root = document) => root.querySelector(sel);
    const e = API ? API.escapeHtml : (s) => s;

    const views = {
        login: $('#viewLogin'),
        reset: $('#viewReset'),
        app: $('#viewApp'),
        list: $('#viewList'),
        editor: $('#viewEditor')
    };

    let recoveryMode = /type=recovery/.test(location.hash);
    let projects = [];
    let filterCat = '';
    let editor = null;
    let dirty = false;

    // ---------- Utilitats ----------
    function show(view) {
        ['login', 'reset', 'app'].forEach(v => { views[v].hidden = v !== view; });
    }

    const panels = {
        list: '#viewList', editor: '#viewEditor',
        destacats: '#viewDestacats', destacatEditor: '#viewDestacatEditor'
    };

    function showPanel(panel) {
        Object.entries(panels).forEach(([k, sel]) => { $(sel).hidden = k !== panel; });
        $('#sectionTabs').hidden = panel !== 'list' && panel !== 'destacats';
        window.scrollTo({ top: 0 });
    }

    let toastTimer;
    function toast(msg, isError = false) {
        const t = $('#toast');
        t.textContent = msg;
        t.classList.toggle('is-error', isError);
        t.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { t.hidden = true; }, isError ? 6000 : 3500);
    }

    function setError(el, msg) {
        el.textContent = msg || '';
        el.hidden = !msg;
    }

    const client = API && API.client;

    // ---------- Arrencada ----------
    async function init() {
        if (!API || !API.configured) {
            show('login');
            setError($('#loginError'), 'Falta configurar Supabase a js/config.js.');
            $('#loginForm button').disabled = true;
            return;
        }

        client.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                recoveryMode = true;
                show('reset');
            }
            if (event === 'SIGNED_OUT') show('login');
        });

        const { data: { session } } = await client.auth.getSession();
        if (recoveryMode && session) { show('reset'); return; }
        route(session);
    }

    async function route(session) {
        if (!session) { show('login'); return; }
        const { data: ok, error } = await client.rpc('is_admin');
        if (error || !ok) {
            await client.auth.signOut();
            show('login');
            setError($('#loginError'), 'Aquest usuari no té permisos per gestionar projectes.');
            return;
        }
        $('#userEmail').textContent = session.user.email;
        show('app');
        showPanel('list');
        loadList();
    }

    // ---------- Accés ----------
    $('#loginForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const form = ev.currentTarget;
        const email = form.email.value.trim();
        const password = form.password.value;
        const err = $('#loginError');
        if (!email || !password) { setError(err, 'Escriu el correu i la contrasenya.'); return; }
        setError(err, '');
        const btn = form.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Entrant…';
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        btn.disabled = false;
        btn.textContent = 'Entrar';
        if (error) {
            setError(err, /invalid/i.test(error.message)
                ? 'El correu o la contrasenya no són correctes.'
                : 'No s\'ha pogut entrar. Torna-ho a provar d\'aquí a una estona.');
            return;
        }
        form.reset();
        route(data.session);
    });

    $('#forgotBtn').addEventListener('click', async () => {
        const email = $('#loginForm').email.value.trim();
        const err = $('#loginError');
        if (!email) { setError(err, 'Escriu primer el teu correu i torna a clicar «He oblidat la contrasenya».'); return; }
        setError(err, '');
        await client.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        toast('Si el correu és correcte, rebràs un enllaç per canviar la contrasenya.');
    });

    $('#resetForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const pw = ev.currentTarget.password.value;
        const err = $('#resetError');
        if (pw.length < 8) { setError(err, 'Ha de tenir almenys 8 caràcters.'); return; }
        const { error } = await client.auth.updateUser({ password: pw });
        if (error) { setError(err, 'No s\'ha pogut canviar. Demana un enllaç nou.'); return; }
        recoveryMode = false;
        history.replaceState(null, '', location.pathname);
        toast('Contrasenya canviada.');
        const { data: { session } } = await client.auth.getSession();
        route(session);
    });

    $('#logoutBtn').addEventListener('click', async () => {
        if (dirty && !confirm('Tens canvis sense desar. Vols sortir igualment?')) return;
        dirty = false;
        await client.auth.signOut();
    });

    // ---------- Llistat ----------
    async function loadList() {
        $('#listCount').textContent = 'Carregant…';
        const { data, error } = await client
            .from('projectes')
            .select('id, slug, titol, categoria, any_projecte, ubicacio, portada, publicat, ordre, created_at')
            .order('ordre', { ascending: true })
            .order('created_at', { ascending: false });
        if (error) {
            console.error(error);
            $('#listCount').textContent = 'No s\'han pogut carregar els projectes.';
            return;
        }
        projects = data;
        renderList();
    }

    function renderList() {
        const visible = filterCat ? projects.filter(p => p.categoria === filterCat) : projects;
        const publicats = projects.filter(p => p.publicat).length;
        $('#listCount').textContent = projects.length
            ? `${projects.length} projecte${projects.length === 1 ? '' : 's'} · ${publicats} publicat${publicats === 1 ? '' : 's'}`
            : 'Cap projecte encara';
        $('#emptyState').hidden = projects.length > 0;
        $('#listFilter').hidden = projects.length === 0;

        const canReorder = !filterCat;
        $('#rows').innerHTML = visible.map((p) => {
            const i = projects.indexOf(p);
            const thumb = p.portada ? API.imageUrl(p.portada.thumb || p.portada.full) : '';
            const meta = [p.any_projecte, p.ubicacio].filter(Boolean).map(e).join(' · ');
            return `
            <li class="row${p.publicat ? '' : ' is-draft'}" data-id="${e(p.id)}">
                <div class="row-thumb" style="background-image:url('${e(thumb)}')"></div>
                <div class="row-main">
                    <button type="button" class="row-title" data-action="edit">${e(p.titol)}</button>
                    <div class="row-meta">
                        <span class="pill">${e(API.CATEGORIES[p.categoria])}</span>
                        ${p.publicat ? '' : '<span class="pill pill-draft">Esborrany</span>'}
                        ${meta ? `<span>${meta}</span>` : ''}
                    </div>
                </div>
                <div class="row-order">
                    <button type="button" class="icon-btn" data-action="up" aria-label="Pujar" ${canReorder && i > 0 ? '' : 'disabled'} title="${canReorder ? 'Pujar' : 'Treu el filtre per reordenar'}">▲</button>
                    <button type="button" class="icon-btn" data-action="down" aria-label="Baixar" ${canReorder && i < projects.length - 1 ? '' : 'disabled'} title="${canReorder ? 'Baixar' : 'Treu el filtre per reordenar'}">▼</button>
                </div>
                <div class="row-actions">
                    <button type="button" class="icon-btn" data-action="edit" aria-label="Editar" title="Editar">✎</button>
                    ${p.publicat ? `<a class="icon-btn" href="/projecte?p=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener" aria-label="Veure a la web" title="Veure a la web">↗</a>` : ''}
                    <button type="button" class="icon-btn danger" data-action="delete" aria-label="Esborrar" title="Esborrar">🗑</button>
                </div>
            </li>`;
        }).join('');
    }

    $('#listFilter').addEventListener('click', (ev) => {
        const chip = ev.target.closest('.chip');
        if (!chip) return;
        filterCat = chip.dataset.cat;
        $('#listFilter').querySelectorAll('.chip').forEach(c => c.classList.toggle('is-active', c === chip));
        renderList();
    });

    $('#rows').addEventListener('click', async (ev) => {
        const btn = ev.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.closest('.row').dataset.id;
        const p = projects.find(x => x.id === id);
        if (!p) return;
        const action = btn.dataset.action;
        if (action === 'edit') openEditor(id);
        if (action === 'up' || action === 'down') move(p, action === 'up' ? -1 : 1);
        if (action === 'delete') deleteProject(p);
    });

    async function move(p, dir) {
        const i = projects.indexOf(p);
        const j = i + dir;
        if (j < 0 || j >= projects.length) return;
        [projects[i], projects[j]] = [projects[j], projects[i]];
        const updates = [];
        projects.forEach((x, k) => {
            const ordre = k * 10;
            if (x.ordre !== ordre) { x.ordre = ordre; updates.push(x); }
        });
        renderList();
        const results = await Promise.all(updates.map(x =>
            client.from('projectes').update({ ordre: x.ordre }).eq('id', x.id)));
        if (results.some(r => r.error)) {
            toast('No s\'ha pogut desar l\'ordre.', true);
            loadList();
        }
    }

    async function deleteProject(p) {
        if (!confirm(`Segur que vols esborrar «${p.titol}»?\n\nEs treurà de la web i no es pot desfer.`)) return;
        const { error } = await client.from('projectes').delete().eq('id', p.id);
        if (error) { console.error(error); toast('No s\'ha pogut esborrar.', true); return; }
        await removeFolder(p.id);
        toast('Projecte esborrat.');
        if (!views.editor.hidden) { dirty = false; showPanel('list'); }
        loadList();
    }

    async function removeFolder(id) {
        const bucket = client.storage.from(API.BUCKET);
        const { data } = await bucket.list(id, { limit: 1000 });
        if (data && data.length) await bucket.remove(data.map(f => `${id}/${f.name}`));
    }

    $('#newBtn').addEventListener('click', () => openEditor(null));
    $('#emptyState [data-action="new"]').addEventListener('click', () => openEditor(null));
    $('#backBtn').addEventListener('click', () => {
        if (dirty && !confirm('Tens canvis sense desar. Vols tornar igualment?')) return;
        closeEditor();
    });

    window.addEventListener('beforeunload', (ev) => {
        if (dirty) { ev.preventDefault(); ev.returnValue = ''; }
    });

    // ---------- Editor ----------
    const form = $('#projectForm');

    function existingItem(img) {
        return img ? { kind: 'existing', full: img.full, thumb: img.thumb, preview: API.imageUrl(img.thumb || img.full) } : null;
    }

    async function openEditor(id) {
        form.reset();
        form.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; });
        form.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
        setError($('#saveError'), '');

        let p = null;
        if (id) {
            const { data, error } = await client.from('projectes').select('*').eq('id', id).single();
            if (error) { toast('No s\'ha pogut obrir el projecte.', true); return; }
            p = data;
        }

        editor = {
            id: p ? p.id : null,
            slug: p ? p.slug : null,
            cover: p ? existingItem(p.portada) : null,
            gallery: p ? (p.imatges || []).map(existingItem) : [],
            removed: []
        };

        $('#editorTitle').textContent = p ? 'Editar projecte' : 'Nou projecte';
        $('#deleteBtn').hidden = !p;
        const link = $('#viewLink');
        link.hidden = !(p && p.publicat);
        if (p) link.href = `/projecte?p=${encodeURIComponent(p.slug)}`;

        if (p) {
            form.titol.value = p.titol || '';
            const radio = form.querySelector(`input[name="categoria"][value="${p.categoria}"]`);
            if (radio) radio.checked = true;
            form.resum.value = p.resum || '';
            form.descripcio.value = p.descripcio || '';
            form.ubicacio.value = p.ubicacio || '';
            form.any_projecte.value = p.any_projecte || '';
            form.video_url.value = p.video_url || '';
            form.publicat.checked = p.publicat;
        }
        updateCounter();
        updateSaveLabel();
        renderCover();
        renderGallery();
        dirty = false;
        showPanel('editor');
        form.titol.focus();
    }

    function closeEditor() {
        [editor && editor.cover, ...(editor ? editor.gallery : [])]
            .filter(it => it && it.kind === 'new')
            .forEach(it => URL.revokeObjectURL(it.preview));
        editor = null;
        dirty = false;
        showPanel('list');
        loadList();
    }

    function updateCounter() {
        $('[data-counter="resum"]').textContent = `${form.resum.value.length} / 220`;
    }

    function updateSaveLabel() {
        const publish = form.publicat.checked;
        $('#saveBtn').textContent = editor && editor.id
            ? 'Desar canvis'
            : (publish ? 'Publicar projecte' : 'Desar esborrany');
        $('#publishHint').textContent = publish
            ? 'Es mostrarà a la web tan bon punt el desis.'
            : 'Es desarà com a esborrany i no sortirà a la web.';
    }

    form.addEventListener('input', (ev) => {
        dirty = true;
        if (ev.target.name === 'resum') updateCounter();
        const field = ev.target.closest('.field');
        if (field) {
            field.classList.remove('has-error');
            const fe = form.querySelector(`.field-error[data-for="${ev.target.name}"]`);
            if (fe) fe.textContent = '';
        }
    });
    form.publicat.addEventListener('change', updateSaveLabel);

    // ---------- Imatges ----------
    function newItem(file) {
        return { kind: 'new', file, preview: URL.createObjectURL(file) };
    }

    function acceptImages(fileList) {
        const files = Array.from(fileList || []);
        const ok = files.filter(f => f.type.startsWith('image/'));
        if (ok.length < files.length) toast('Alguns fitxers no eren imatges i s\'han ignorat.', true);
        return ok;
    }

    function discard(item) {
        if (!item) return;
        if (item.kind === 'existing') editor.removed.push(item.full, item.thumb);
        else URL.revokeObjectURL(item.preview);
    }

    function setCover(file) {
        discard(editor.cover);
        editor.cover = newItem(file);
        const fe = form.querySelector('.field-error[data-for="portada"]');
        if (fe) fe.textContent = '';
        dirty = true;
        renderCover();
    }

    function renderCover() {
        const box = $('#coverBox');
        const drop = $('#coverDrop');
        box.querySelectorAll('.cover-preview').forEach(n => n.remove());
        if (!editor.cover) { drop.hidden = false; return; }
        drop.hidden = true;
        const prev = document.createElement('div');
        prev.className = 'cover-preview';
        prev.style.backgroundImage = `url("${editor.cover.preview}")`;
        prev.innerHTML = `
            <div class="tile-actions">
                <button type="button" data-cover="change" title="Canviar portada" aria-label="Canviar portada">⟳</button>
                <button type="button" data-cover="remove" title="Treure portada" aria-label="Treure portada">✕</button>
            </div>`;
        box.prepend(prev);
    }

    $('#coverBox').addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-cover]');
        if (!b) return;
        if (b.dataset.cover === 'change') $('#coverInput').click();
        if (b.dataset.cover === 'remove') {
            discard(editor.cover);
            editor.cover = null;
            dirty = true;
            renderCover();
        }
    });

    $('#coverInput').addEventListener('change', (ev) => {
        const [file] = acceptImages(ev.target.files);
        if (file) setCover(file);
        ev.target.value = '';
    });

    $('#galleryInput').addEventListener('change', (ev) => {
        addToGallery(acceptImages(ev.target.files));
        ev.target.value = '';
    });

    function addToGallery(files) {
        if (!files.length) return;
        editor.gallery.push(...files.map(newItem));
        dirty = true;
        renderGallery();
    }

    function renderGallery() {
        const grid = $('#galleryGrid');
        grid.innerHTML = editor.gallery.map((it, i) => `
            <div class="tile" draggable="true" data-index="${i}" style="background-image:url('${e(it.preview)}')">
                <span class="tile-badge">${i + 1}</span>
                <div class="tile-actions">
                    ${i > 0 ? `<button type="button" data-tile="left" title="Moure a l'esquerra" aria-label="Moure a l'esquerra">◀</button>` : ''}
                    ${i < editor.gallery.length - 1 ? `<button type="button" data-tile="right" title="Moure a la dreta" aria-label="Moure a la dreta">▶</button>` : ''}
                    <button type="button" data-tile="cover" class="mk-cover" title="Fer-la portada" aria-label="Fer-la portada">★</button>
                    <button type="button" data-tile="remove" title="Treure" aria-label="Treure foto">✕</button>
                </div>
            </div>`).join('');
    }

    $('#galleryGrid').addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-tile]');
        if (!b) return;
        const i = Number(b.closest('.tile').dataset.index);
        const g = editor.gallery;
        const action = b.dataset.tile;
        if (action === 'remove') { discard(g[i]); g.splice(i, 1); }
        if (action === 'left' && i > 0) [g[i - 1], g[i]] = [g[i], g[i - 1]];
        if (action === 'right' && i < g.length - 1) [g[i + 1], g[i]] = [g[i], g[i + 1]];
        if (action === 'cover') {
            const nova = g.splice(i, 1)[0];
            if (editor.cover) g.splice(i, 0, editor.cover);
            editor.cover = nova;
            renderCover();
        }
        dirty = true;
        renderGallery();
    });

    // Arrossegar per reordenar (escriptori)
    let dragFrom = null;
    const grid = $('#galleryGrid');
    grid.addEventListener('dragstart', (ev) => {
        const t = ev.target.closest('.tile');
        if (!t) return;
        dragFrom = Number(t.dataset.index);
        t.classList.add('is-dragging');
        ev.dataTransfer.effectAllowed = 'move';
    });
    grid.addEventListener('dragover', (ev) => {
        if (dragFrom === null) return;
        ev.preventDefault();
        grid.querySelectorAll('.is-drop-target').forEach(n => n.classList.remove('is-drop-target'));
        const t = ev.target.closest('.tile');
        if (t) t.classList.add('is-drop-target');
    });
    grid.addEventListener('drop', (ev) => {
        if (dragFrom === null) return;
        ev.preventDefault();
        const t = ev.target.closest('.tile');
        if (t) {
            const to = Number(t.dataset.index);
            const [it] = editor.gallery.splice(dragFrom, 1);
            editor.gallery.splice(to, 0, it);
            dirty = true;
        }
        dragFrom = null;
        renderGallery();
    });
    grid.addEventListener('dragend', () => { dragFrom = null; renderGallery(); });

    // Deixar anar fitxers a les zones
    [['#coverDrop', (files) => files[0] && setCover(files[0])], ['#galleryDrop', addToGallery]].forEach(([sel, fn]) => {
        const zone = $(sel);
        zone.addEventListener('dragover', (ev) => { if (ev.dataTransfer.types.includes('Files')) { ev.preventDefault(); zone.classList.add('is-over'); } });
        zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
        zone.addEventListener('drop', (ev) => {
            if (!ev.dataTransfer.files.length) return;
            ev.preventDefault();
            zone.classList.remove('is-over');
            fn(acceptImages(ev.dataTransfer.files));
        });
    });

    // ---------- Compressió i pujada ----------
    async function toBlob(bitmap, max, quality) {
        const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
        const w = Math.round(bitmap.width * scale);
        const h = Math.round(bitmap.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
        let blob = await new Promise(r => canvas.toBlob(r, 'image/webp', quality));
        if (!blob || blob.type !== 'image/webp') {
            blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality));
        }
        return blob;
    }

    async function uploadItem(item, id) {
        let bitmap;
        try {
            bitmap = await createImageBitmap(item.file, { imageOrientation: 'from-image' });
        } catch {
            throw new Error(`No s'ha pogut llegir «${item.file.name}». Prova-ho amb una foto en JPG o PNG.`);
        }
        const full = await toBlob(bitmap, 2000, 0.82);
        const thumb = await toBlob(bitmap, 900, 0.78);
        if (bitmap.close) bitmap.close();

        const key = crypto.randomUUID();
        const ext = full.type === 'image/webp' ? 'webp' : 'jpg';
        const paths = { full: `${id}/${key}.${ext}`, thumb: `${id}/${key}-thumb.${ext}` };
        const bucket = client.storage.from(API.BUCKET);
        for (const [k, blob] of [['full', full], ['thumb', thumb]]) {
            const { error } = await bucket.upload(paths[k], blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
            if (error) throw new Error('No s\'ha pogut pujar una de les fotos. Revisa la connexió.');
        }
        return paths;
    }

    async function uniqueSlug(base) {
        const { data } = await client.from('projectes').select('slug').like('slug', `${base}%`);
        const taken = new Set((data || []).map(r => r.slug));
        if (!taken.has(base)) return base;
        let n = 2;
        while (taken.has(`${base}-${n}`)) n++;
        return `${base}-${n}`;
    }

    // ---------- Validació i desat ----------
    function fieldError(name, msg) {
        const fe = form.querySelector(`.field-error[data-for="${name}"]`);
        if (fe) fe.textContent = msg;
        const input = form.elements[name];
        const field = (input && input.closest ? input.closest('.field') : null) || (fe && fe.closest('.field'));
        if (field) field.classList.add('has-error');
    }

    function validate() {
        const errors = [];
        const titol = form.titol.value.trim();
        if (titol.length < 2) { fieldError('titol', 'Escriu un títol.'); errors.push('titol'); }
        if (!form.querySelector('input[name="categoria"]:checked')) { fieldError('categoria', 'Tria una categoria.'); errors.push('categoria'); }
        const any = form.any_projecte.value.trim();
        if (any && (!/^\d{4}$/.test(any) || +any < 1990 || +any > 2100)) { fieldError('any_projecte', 'Escriu un any entre 1990 i 2100.'); errors.push('any_projecte'); }
        const video = form.video_url.value.trim();
        if (video && !API.videoEmbedUrl(video)) { fieldError('video_url', 'Enganxa un enllaç de YouTube o Vimeo.'); errors.push('video_url'); }
        if (!editor.cover) { fieldError('portada', 'Afegeix una foto de portada.'); errors.push('portada'); }
        return errors;
    }

    form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        setError($('#saveError'), '');
        const errors = validate();
        if (errors.length) {
            const first = form.querySelector('.has-error') || $('#coverBox');
            first.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        const btn = $('#saveBtn');
        const label = btn.textContent;
        btn.disabled = true;

        const isNew = !editor.id;
        const id = editor.id || crypto.randomUUID();
        const uploaded = [];

        try {
            const pending = [editor.cover, ...editor.gallery].filter(it => it.kind === 'new');
            let done = 0;
            const resolve = async (it) => {
                if (it.kind === 'existing') return { full: it.full, thumb: it.thumb };
                btn.textContent = `Pujant fotos ${++done} / ${pending.length}…`;
                const paths = await uploadItem(it, id);
                uploaded.push(paths.full, paths.thumb);
                return paths;
            };

            const portada = await resolve(editor.cover);
            const imatges = [];
            for (const it of editor.gallery) imatges.push(await resolve(it));

            btn.textContent = 'Desant…';
            const payload = {
                titol: form.titol.value.trim(),
                categoria: form.querySelector('input[name="categoria"]:checked').value,
                resum: form.resum.value.trim() || null,
                descripcio: form.descripcio.value.trim() || null,
                ubicacio: form.ubicacio.value.trim() || null,
                any_projecte: form.any_projecte.value ? Number(form.any_projecte.value) : null,
                video_url: form.video_url.value.trim() || null,
                portada,
                imatges,
                publicat: form.publicat.checked
            };

            let error;
            if (isNew) {
                const minOrdre = projects.length ? Math.min(...projects.map(p => p.ordre)) : 10;
                const slug = await uniqueSlug(API.slugify(payload.titol));
                ({ error } = await client.from('projectes').insert({ id, slug, ordre: minOrdre - 10, ...payload }));
            } else {
                ({ error } = await client.from('projectes').update(payload).eq('id', id));
            }
            if (error) throw error;

            if (editor.removed.length) {
                await client.storage.from(API.BUCKET).remove(editor.removed.filter(Boolean));
            }

            dirty = false;
            toast(isNew
                ? (payload.publicat ? 'Projecte publicat a la web.' : 'Esborrany desat.')
                : 'Canvis desats.');
            closeEditor();
        } catch (err) {
            console.error(err);
            if (uploaded.length) client.storage.from(API.BUCKET).remove(uploaded);
            setError($('#saveError'), err && err.message && !err.code
                ? err.message
                : 'No s\'ha pogut desar. Revisa la connexió i torna-ho a provar.');
        } finally {
            btn.disabled = false;
            if (editor) btn.textContent = label;
        }
    });

    $('#deleteBtn').addEventListener('click', () => {
        const p = projects.find(x => x.id === editor.id) || { id: editor.id, titol: form.titol.value };
        deleteProject(p);
    });

    // ================= A obra (destacats) =================
    let destacats = [];
    let editorD = null;

    $('#sectionTabs').addEventListener('click', (ev) => {
        const tab = ev.target.closest('.tab');
        if (!tab) return;
        $('#sectionTabs').querySelectorAll('.tab').forEach(t => t.classList.toggle('is-active', t === tab));
        if (tab.dataset.section === 'destacats') { showPanel('destacats'); loadDestacats(); }
        else { showPanel('list'); loadList(); }
    });

    async function loadDestacats() {
        $('#dCount').textContent = 'Carregant…';
        try {
            destacats = await API.llistarDestacats({ nomesPublicats: false });
            renderDestacatsList();
        } catch (err) {
            console.error(err);
            $('#dCount').textContent = 'No s\'ha pogut carregar. Has executat el SQL del bloc 2?';
        }
    }

    function renderDestacatsList() {
        const publicats = destacats.filter(d => d.publicat).length;
        $('#dCount').textContent = destacats.length
            ? `${destacats.length} element${destacats.length === 1 ? '' : 's'} · ${publicats} visible${publicats === 1 ? '' : 's'}`
            : 'Cap element encara';
        $('#dEmpty').hidden = destacats.length > 0;
        $('#dRows').innerHTML = destacats.map((d, i) => `
            <li class="row vertical${d.publicat ? '' : ' is-draft'}" data-id="${e(d.id)}">
                <div class="row-thumb vertical" style="background-image:url('${e(API.imageUrl(d.imatge && (d.imatge.thumb || d.imatge.full)))}')"></div>
                <div class="row-main">
                    <button type="button" class="row-title" data-action="edit">${e(d.titol)}</button>
                    <div class="row-meta">
                        ${d.etiqueta ? `<span class="pill">${e(d.etiqueta)}</span>` : ''}
                        ${d.publicat ? '' : '<span class="pill pill-draft">Amagat</span>'}
                        ${d.video_url ? '<span>Amb vídeo</span>' : '<span>Només foto</span>'}
                    </div>
                </div>
                <div class="row-order">
                    <button type="button" class="icon-btn" data-action="up" aria-label="Pujar" ${i > 0 ? '' : 'disabled'}>▲</button>
                    <button type="button" class="icon-btn" data-action="down" aria-label="Baixar" ${i < destacats.length - 1 ? '' : 'disabled'}>▼</button>
                </div>
                <div class="row-actions">
                    <button type="button" class="icon-btn" data-action="edit" aria-label="Editar" title="Editar">✎</button>
                    <button type="button" class="icon-btn danger" data-action="delete" aria-label="Esborrar" title="Esborrar">🗑</button>
                </div>
            </li>`).join('');
    }

    $('#dRows').addEventListener('click', async (ev) => {
        const btn = ev.target.closest('[data-action]');
        if (!btn) return;
        const d = destacats.find(x => x.id === btn.closest('.row').dataset.id);
        if (!d) return;
        const a = btn.dataset.action;
        if (a === 'edit') openDestacat(d);
        if (a === 'up' || a === 'down') await moveDestacat(d, a === 'up' ? -1 : 1);
        if (a === 'delete') deleteDestacat(d);
    });

    async function moveDestacat(d, dir) {
        const i = destacats.indexOf(d), j = i + dir;
        if (j < 0 || j >= destacats.length) return;
        [destacats[i], destacats[j]] = [destacats[j], destacats[i]];
        const updates = [];
        destacats.forEach((x, k) => { if (x.ordre !== k * 10) { x.ordre = k * 10; updates.push(x); } });
        renderDestacatsList();
        const res = await Promise.all(updates.map(x => client.from('destacats').update({ ordre: x.ordre }).eq('id', x.id)));
        if (res.some(r => r.error)) { toast('No s\'ha pogut desar l\'ordre.', true); loadDestacats(); }
    }

    async function deleteDestacat(d) {
        if (!confirm(`Segur que vols esborrar «${d.titol}»?`)) return;
        const { error } = await client.from('destacats').delete().eq('id', d.id);
        if (error) { console.error(error); toast('No s\'ha pogut esborrar.', true); return; }
        if (d.imatge) await client.storage.from(API.BUCKET).remove([d.imatge.full, d.imatge.thumb].filter(Boolean));
        toast('Esborrat.');
        showPanel('destacats');
        loadDestacats();
    }

    $('#dNewBtn').addEventListener('click', () => openDestacat(null));
    $('#dEmpty [data-action="dnew"]').addEventListener('click', () => openDestacat(null));
    $('#dBackBtn').addEventListener('click', () => {
        if (dirty && !confirm('Tens canvis sense desar. Vols tornar igualment?')) return;
        dirty = false;
        showPanel('destacats');
        loadDestacats();
    });

    const dForm = $('#destacatForm');

    function openDestacat(d) {
        dForm.reset();
        dForm.querySelectorAll('.field-error').forEach(el => { el.textContent = ''; });
        dForm.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
        setError($('#dSaveError'), '');
        editorD = {
            id: d ? d.id : null,
            imatge: d && d.imatge ? { kind: 'existing', full: d.imatge.full, thumb: d.imatge.thumb, preview: API.imageUrl(d.imatge.thumb || d.imatge.full) } : null,
            removed: []
        };
        $('#dEditorTitle').textContent = d ? 'Editar destacat' : 'Nou destacat';
        $('#dDeleteBtn').hidden = !d;
        if (d) {
            dForm.titol.value = d.titol || '';
            dForm.etiqueta.value = d.etiqueta || '';
            dForm.video_url.value = d.video_url || '';
            dForm.publicat.checked = d.publicat;
        }
        renderDImg();
        dirty = false;
        showPanel('destacatEditor');
        dForm.titol.focus();
    }

    function renderDImg() {
        const box = $('#dImgBox');
        box.querySelectorAll('.cover-preview').forEach(n => n.remove());
        const drop = $('#dImgDrop');
        if (!editorD.imatge) { drop.hidden = false; return; }
        drop.hidden = true;
        const prev = document.createElement('div');
        prev.className = 'cover-preview';
        prev.style.cssText = `aspect-ratio:9/16;background-image:url("${editorD.imatge.preview}")`;
        prev.innerHTML = `<div class="tile-actions">
            <button type="button" data-dimg="change" title="Canviar" aria-label="Canviar foto">⟳</button>
            <button type="button" data-dimg="remove" title="Treure" aria-label="Treure foto">✕</button>
        </div>`;
        box.prepend(prev);
    }

    $('#dImgBox').addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-dimg]');
        if (!b) return;
        if (b.dataset.dimg === 'change') $('#dImgInput').click();
        if (b.dataset.dimg === 'remove') {
            if (editorD.imatge.kind === 'existing') editorD.removed.push(editorD.imatge.full, editorD.imatge.thumb);
            else URL.revokeObjectURL(editorD.imatge.preview);
            editorD.imatge = null;
            dirty = true;
            renderDImg();
        }
    });

    function setDImg(file) {
        if (editorD.imatge) {
            if (editorD.imatge.kind === 'existing') editorD.removed.push(editorD.imatge.full, editorD.imatge.thumb);
            else URL.revokeObjectURL(editorD.imatge.preview);
        }
        editorD.imatge = { kind: 'new', file, preview: URL.createObjectURL(file) };
        const fe = dForm.querySelector('.field-error[data-for="imatge"]');
        if (fe) fe.textContent = '';
        dirty = true;
        renderDImg();
    }

    $('#dImgInput').addEventListener('change', (ev) => {
        const [file] = acceptImages(ev.target.files);
        if (file) setDImg(file);
        ev.target.value = '';
    });

    (() => {
        const zone = $('#dImgDrop');
        zone.addEventListener('dragover', (ev) => { if (ev.dataTransfer.types.includes('Files')) { ev.preventDefault(); zone.classList.add('is-over'); } });
        zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
        zone.addEventListener('drop', (ev) => {
            if (!ev.dataTransfer.files.length) return;
            ev.preventDefault();
            zone.classList.remove('is-over');
            const [file] = acceptImages(ev.dataTransfer.files);
            if (file) setDImg(file);
        });
    })();

    dForm.addEventListener('input', (ev) => {
        dirty = true;
        const field = ev.target.closest('.field');
        if (field) {
            field.classList.remove('has-error');
            const fe = dForm.querySelector(`.field-error[data-for="${ev.target.name}"]`);
            if (fe) fe.textContent = '';
        }
    });

    dForm.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        setError($('#dSaveError'), '');
        const errors = [];
        const titol = dForm.titol.value.trim();
        const setFE = (name, msg) => {
            const fe = dForm.querySelector(`.field-error[data-for="${name}"]`);
            if (fe) fe.textContent = msg;
            const inp = dForm.elements[name];
            const f = (inp && inp.closest) ? inp.closest('.field') : null;
            if (f) f.classList.add('has-error');
            errors.push(name);
        };
        if (titol.length < 2) setFE('titol', 'Escriu un títol.');
        const video = dForm.video_url.value.trim();
        if (video && !API.videoEmbedUrl(video)) setFE('video_url', 'Enganxa un enllaç de YouTube o Vimeo.');
        if (!editorD.imatge) setFE('imatge', 'Afegeix una foto.');
        if (errors.length) return;

        const btn = $('#dSaveBtn');
        const label = btn.textContent;
        btn.disabled = true;
        const isNew = !editorD.id;
        const id = editorD.id || crypto.randomUUID();
        const pujades = [];

        try {
            let imatge;
            if (editorD.imatge.kind === 'existing') {
                imatge = { full: editorD.imatge.full, thumb: editorD.imatge.thumb };
            } else {
                btn.textContent = 'Pujant la foto…';
                imatge = await uploadItem(editorD.imatge, `destacats/${id}`);
                pujades.push(imatge.full, imatge.thumb);
            }

            btn.textContent = 'Desant…';
            const payload = {
                titol,
                etiqueta: dForm.etiqueta.value.trim() || null,
                video_url: video || null,
                imatge,
                publicat: dForm.publicat.checked
            };
            let error;
            if (isNew) {
                const minOrdre = destacats.length ? Math.min(...destacats.map(d => d.ordre)) : 10;
                ({ error } = await client.from('destacats').insert({ id, ordre: minOrdre - 10, ...payload }));
            } else {
                ({ error } = await client.from('destacats').update(payload).eq('id', id));
            }
            if (error) throw error;

            if (editorD.removed.length) await client.storage.from(API.BUCKET).remove(editorD.removed.filter(Boolean));
            dirty = false;
            toast(isNew ? 'Afegit a «A obra».' : 'Canvis desats.');
            showPanel('destacats');
            loadDestacats();
        } catch (err) {
            console.error(err);
            if (pujades.length) client.storage.from(API.BUCKET).remove(pujades);
            setError($('#dSaveError'), err && err.message && !err.code
                ? err.message
                : 'No s\'ha pogut desar. Revisa la connexió i torna-ho a provar.');
        } finally {
            btn.disabled = false;
            btn.textContent = label;
        }
    });

    $('#dDeleteBtn').addEventListener('click', () => {
        const d = destacats.find(x => x.id === editorD.id) || { id: editorD.id, titol: dForm.titol.value };
        deleteDestacat(d);
    });

    init();
})();

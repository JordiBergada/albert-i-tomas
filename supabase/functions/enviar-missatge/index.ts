// =====================================================================
// Construccions i Reformes Albert i Tomàs
// Edge Function: desa el missatge del formulari i l'envia per correu (Resend)
//
// OPCIONAL i ARA MATEIX NO S'UTILITZA. El web envia els avisos amb FormSubmit
// (js/config.js → FORM_AVIS_ENDPOINT), que no demana cap domini verificat.
// Aquesta funció és el pas següent per quan el client tingui domini propi:
// remitent amb el seu domini, millor entrega i sense passar per tercers.
//
// Desplegament: Supabase → Edge Functions → Deploy a new function →
//   nom: enviar-missatge · enganxa aquest fitxer sencer,
//   i canvia enviarMissatge() de js/projectes-api.js perquè hi cridi.
//
// Secrets necessaris (Edge Functions → Secrets):
//   RESEND_API_KEY     clau d'API de Resend (re_...)
//   MAIL_DESTINATARI   correu on han d'arribar els avisos
//   MAIL_REMITENT      remitent verificat a Resend, p. ex. "Web <web@eldomini.com>"
// =====================================================================

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const SERVEIS: Record<string, string> = {
    'obra-nova': 'Obra nova',
    'reformes': 'Reformes integrals',
    'piscines': 'Piscines',
    'pedra': 'Treballs amb pedra',
    'altres': 'Altres'
};

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' }
    });
}

function net(valor: unknown, max: number) {
    return typeof valor === 'string' ? valor.trim().slice(0, max) : '';
}

function escapa(text: string) {
    return text.replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
    ));
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ error: 'Mètode no permès' }, 405);

    let dades: Record<string, unknown>;
    try {
        dades = await req.json();
    } catch {
        return json({ error: 'Contingut no vàlid' }, 400);
    }

    // Parany per a robots: si omplen el camp ocult, fem veure que tot ha anat bé.
    if (net(dades.empresa, 200)) return json({ ok: true });

    const nom = net(dades.nom, 100);
    const telefon = net(dades.telefon, 30);
    const email = net(dades.email, 120);
    const missatge = net(dades.missatge, 2000);
    const serveiCodi = net(dades.servei, 40);
    const servei = SERVEIS[serveiCodi] ? serveiCodi : null;

    if (nom.length < 2 || telefon.length < 6 || missatge.length < 5) {
        return json({ error: 'Falten dades del formulari' }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json({ error: 'Correu electrònic no vàlid' }, 400);
    }

    // ---------- 1. Desa el missatge (sempre, encara que el correu falli) ----------
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const desat = await fetch(`${SUPABASE_URL}/rest/v1/missatges`, {
        method: 'POST',
        headers: {
            apikey: SERVICE_KEY,
            Authorization: `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
        },
        body: JSON.stringify({ nom, telefon, email, servei, missatge })
    });

    if (!desat.ok) {
        console.error('No s\'ha pogut desar el missatge:', await desat.text());
        return json({ error: 'No s\'ha pogut desar el missatge' }, 500);
    }

    // ---------- 2. Avisa per correu ----------
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const DESTINATARI = Deno.env.get('MAIL_DESTINATARI');
    const REMITENT = Deno.env.get('MAIL_REMITENT') || 'Web Albert i Tomàs <onboarding@resend.dev>';

    if (!RESEND_API_KEY || !DESTINATARI) {
        console.warn('Falta RESEND_API_KEY o MAIL_DESTINATARI: el missatge queda només al panell.');
        return json({ ok: true, correu: false });
    }

    const files = [
        ['Nom', nom],
        ['Telèfon', telefon],
        ['Correu', email],
        ['Servei', servei ? SERVEIS[servei] : '—']
    ].map(([k, v]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#8A7766;">${k}</td>` +
        `<td style="padding:6px 0;color:#2B1F18;font-weight:600;">${escapa(v)}</td></tr>`
    ).join('');

    const html = `
        <div style="font-family:Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
            <p style="margin:0 0 4px;color:#C25B3F;font-size:12px;letter-spacing:.08em;text-transform:uppercase;">Formulari del web</p>
            <h1 style="margin:0 0 20px;font-size:20px;color:#2B1F18;">Nova consulta de ${escapa(nom)}</h1>
            <table style="border-collapse:collapse;font-size:14px;margin-bottom:20px;">${files}</table>
            <div style="background:#FAF6EF;border-left:3px solid #C25B3F;padding:14px 16px;font-size:14px;color:#2B1F18;white-space:pre-wrap;">${escapa(missatge)}</div>
            <p style="margin:20px 0 0;font-size:13px;color:#8A7766;">
                Respon directament aquest correu per contestar a ${escapa(nom)},
                o truca al <a href="tel:${escapa(telefon.replace(/\s/g, ''))}" style="color:#C25B3F;">${escapa(telefon)}</a>.
            </p>
        </div>`;

    const correu = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from: REMITENT,
            to: [DESTINATARI],
            reply_to: email,
            subject: `Nova consulta del web · ${nom}`,
            html
        })
    });

    if (!correu.ok) {
        // El missatge ja està desat: no fem fallar el formulari per un error de correu.
        console.error('Resend ha fallat:', await correu.text());
        return json({ ok: true, correu: false });
    }

    return json({ ok: true, correu: true });
});

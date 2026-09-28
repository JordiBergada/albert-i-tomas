// Dades públiques del projecte de Supabase (Settings → API).
// La clau "anon" és pública per disseny: la seguretat la fan les polítiques RLS.
// MAI posis aquí la clau "service_role".
window.SITE_CONFIG = {
    SUPABASE_URL: 'https://arudvyxqfsvptyvhdikb.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydWR2eXhxZnN2cHR5dmhkaWtiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwODgzMDcsImV4cCI6MjEwNTY2NDMwN30.vcEKAXHxjR-kwqO5os-dPLKzn7pdQe3ZYp3qQVMrw2c',

    // Avís per correu de cada consulta del formulari (FormSubmit, gratuït).
    // El correu ja és públic a tot el web. Cal activar-lo una sola vegada:
    // al primer enviament, FormSubmit escriu a aquesta adreça amb un botó
    // «Activate Form»; fins que no es clica, no entrega res.
    // Encara que falli, el missatge sempre queda desat al panell.
    FORM_AVIS_ENDPOINT: 'https://formsubmit.co/ajax/jordibergada05@gmail.com'   // TEMPORAL: passar a construccionsalbertomas@gmail.com quan hi hagi domini propi
};

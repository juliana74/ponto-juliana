/**
 * SUPABASECLIENT.JS - Inicialização do Cliente Supabase
 * Gerencia a conexão com o Supabase via CDN script `@supabase/supabase-js`.
 */

// Configurações Padrão (Substitua pela URL e Key do seu projeto Supabase se necessário)
const SUPABASE_URL = window.ENV_SUPABASE_URL || 'https://sua-url-supabase.supabase.co';
const SUPABASE_ANON_KEY = window.ENV_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlc3RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDA0MDAwMDAsImV4cCI6MTkwMDA0MDAwMH0.fake_anon_key_for_kiosk';

let supabaseClient = null;

function initSupabaseClient() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            console.log('Cliente Supabase inicializado com sucesso.');
        } catch (err) {
            console.warn('Erro ao inicializar cliente Supabase com URL real:', err.message);
        }
    } else {
        console.warn('Biblioteca Supabase JS não encontrada. O sistema utilizará o modo fallback/mock se necessário.');
    }
    return supabaseClient;
}

// Inicializar na carga do script
initSupabaseClient();

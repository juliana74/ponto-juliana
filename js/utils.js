/**
 * UTILS.JS - Funções Utilitárias do Kiosk
 * Cálculo de Hash SHA-256 de arquivo fisicamente no navegador,
 * formatação de datas e validações de formulário.
 */

const Utils = {
    /**
     * Calcula o Hash SHA-256 de um arquivo File/Blob fisicamente no navegador
     * usando a Web Crypto API (SubtleCrypto) nativa do navegador.
     * @param {File} file - Arquivo selecionado no input
     * @returns {Promise<string>} Retorna o hash em hexadecimal de 64 caracteres
     */
    calculateFileSHA256: async function(file) {
        if (!file) return null;

        try {
            const arrayBuffer = await file.arrayBuffer();
            // Utiliza crypto.subtle se disponível
            if (window.crypto && window.crypto.subtle) {
                const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                return hashHex;
            } else if (typeof CryptoJS !== 'undefined') {
                // Fallback com CryptoJS
                const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
                return CryptoJS.SHA256(wordArray).toString(CryptoJS.enc.Hex);
            } else {
                throw new Error('Nenhum mecanismo de criptografia (Web Crypto API / CryptoJS) disponível no navegador.');
            }
        } catch (error) {
            console.error('Erro ao calcular hash SHA-256 do arquivo:', error);
            throw error;
        }
    },

    /**
     * Formata data e hora para o padrão brasileiro (DD/MM/AAAA HH:MM:SS)
     * @param {Date|string} dateInput
     * @returns {string}
     */
    formatDateTime: function(dateInput) {
        const d = dateInput ? new Date(dateInput) : new Date();
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');

        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    },

    /**
     * Formata apenas a data extensa para exibição no cabeçalho
     * @param {Date} d
     * @returns {string} Ex: "Segunda-feira, 15 de Outubro de 2025"
     */
    formatDateLong: function(d = new Date()) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        return d.toLocaleDateString('pt-BR', options);
    },

    /**
     * Valida se o formato do PIN numérico atende os requisitos básicos
     * @param {string} pin
     * @returns {boolean}
     */
    isValidPin: function(pin) {
        return /^\d{4,8}$/.test(pin);
    },

    /**
     * Valida se a matrícula é numérica e preenchida
     * @param {string} matricula
     * @returns {boolean}
     */
    isValidMatricula: function(matricula) {
        return /^\d{1,10}$/.test(matricula);
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Utils;
}

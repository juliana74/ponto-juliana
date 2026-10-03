/**
 * APP.JS - Lógica de Controle de UI, Teclado Virtual, Relógio e Modais
 */

// Estado da Aplicação
const state = {
    activeField: 'matricula', // 'matricula' | 'pin'
    matriculaVal: '',
    pinVal: '',
    userCoords: null,
    cameraStream: null,
    currentSelectedFileHash: null
};

// Inicialização após o DOM estar pronto
document.addEventListener('DOMContentLoaded', () => {
    initClock();
    initLucideIcons();
    initCamera();
    initGeolocation();
    updateDisplayFields();
});

/**
 * Inicializa e atualiza o relógio digital em tempo real com segundos
 */
function initClock() {
    const clockEl = document.getElementById('liveClock');
    const dateEl = document.getElementById('liveDate');

    function tick() {
        const now = new Date();
        if (clockEl) {
            clockEl.textContent = now.toLocaleTimeString('pt-BR');
        }
        if (dateEl) {
            dateEl.textContent = Utils.formatDateLong(now);
        }
    }

    tick();
    setInterval(tick, 1000);
}

/**
 * Inicializa os ícones da biblioteca Lucide
 */
function initLucideIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

/**
 * Tenta inicializar a câmera do dispositivo via getUserMedia
 */
async function initCamera() {
    const videoEl = document.getElementById('webcam');
    const statusTextEl = document.getElementById('camStatusText');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (statusTextEl) statusTextEl.textContent = 'Câmera indisponível';
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        state.cameraStream = stream;
        if (videoEl) {
            videoEl.srcObject = stream;
        }
        if (statusTextEl) statusTextEl.textContent = 'Câmera Ativa';
    } catch (err) {
        console.warn('Câmera não permitida ou indisponível:', err.message);
        if (statusTextEl) statusTextEl.textContent = 'Modo de segurança sem vídeo';
    }
}

/**
 * Tenta capturar a geolocalização do dispositivo
 */
function initGeolocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                state.userCoords = `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`;
                console.log('Geolocalização obtida:', state.userCoords);
            },
            (err) => {
                console.warn('Geolocalização não obtida:', err.message);
                state.userCoords = 'SEM_GPS';
            }
        );
    }
}

/**
 * Alterna o foco do PinPad entre Matrícula e PIN
 */
function switchInputFocus(target) {
    state.activeField = target;

    const tabMatricula = document.getElementById('tabMatricula');
    const tabPin = document.getElementById('tabPin');
    const fieldMatriculaWrapper = document.getElementById('fieldMatriculaWrapper');
    const fieldPinWrapper = document.getElementById('fieldPinWrapper');

    if (target === 'matricula') {
        tabMatricula?.classList.add('active');
        tabPin?.classList.remove('active');
        fieldMatriculaWrapper?.classList.add('focused');
        fieldPinWrapper?.classList.remove('focused');
    } else {
        tabPin?.classList.add('active');
        tabMatricula?.classList.remove('active');
        fieldPinWrapper?.classList.add('focused');
        fieldMatriculaWrapper?.classList.remove('focused');
    }
}

/**
 * Atualiza os textos dos campos de entrada na tela
 */
function updateDisplayFields() {
    const valMatriculaEl = document.getElementById('valMatricula');
    const valPinEl = document.getElementById('valPin');

    if (valMatriculaEl) {
        valMatriculaEl.textContent = state.matriculaVal || '---';
    }

    if (valPinEl) {
        // Exibir bolinhas '•' para esconder o PIN
        valPinEl.textContent = state.pinVal ? '•'.repeat(state.pinVal.length) : '••••';
    }
}

/**
 * Evento de pressionar botão numérico no PinPad
 */
function pressNum(numStr) {
    if (state.activeField === 'matricula') {
        if (state.matriculaVal.length < 10) {
            state.matriculaVal += numStr;
        }
        // Se a matrícula atingiu 4 dígitos, altera o foco para o PIN automaticamente
        if (state.matriculaVal.length === 4) {
            switchInputFocus('pin');
        }
    } else {
        if (state.pinVal.length < 6) {
            state.pinVal += numStr;
        }
    }
    updateDisplayFields();
}

/**
 * Limpa o campo ativo
 */
function pressClear() {
    if (state.activeField === 'matricula') {
        state.matriculaVal = '';
    } else {
        state.pinVal = '';
    }
    updateDisplayFields();
}

/**
 * Apaga o último caractere digitado
 */
function pressBackspace() {
    if (state.activeField === 'matricula') {
        state.matriculaVal = state.matriculaVal.slice(0, -1);
    } else {
        state.pinVal = state.pinVal.slice(0, -1);
    }
    updateDisplayFields();
}

/**
 * Handler para registrar Entrada ou Saída
 */
async function handleRegistrarPonto(tipo) {
    if (!state.matriculaVal || !state.pinVal) {
        alert('Por favor, informe a Matrícula e o PIN antes de continuar.');
        return;
    }

    try {
        let response;
        if (tipo === 'ENTRADA') {
            response = await KioskService.registrarEntrada(
                state.matriculaVal,
                state.pinVal,
                state.userCoords
            );
        } else {
            response = await KioskService.registrarSaida(
                state.matriculaVal,
                state.pinVal,
                state.userCoords
            );
        }

        if (!response.sucesso) {
            alert(`Atenção: ${response.mensagem}`);
            return;
        }

        // Sucesso: Exibir Modal com Ticket HMAC
        openTicketModal(response);

        // Limpar PIN para segurança do próximo usuário
        state.pinVal = '';
        updateDisplayFields();

    } catch (err) {
        console.error('Erro no registro de ponto:', err);
        alert('Erro ao se comunicar com o sistema. Tente novamente.');
    }
}

/**
 * Exibe o Modal do Ticket / Comprovante Digital HMAC
 */
function openTicketModal(data) {
    const ticketModal = document.getElementById('ticketModal');
    const receiptNome = document.getElementById('receiptNome');
    const receiptMatricula = document.getElementById('receiptMatricula');
    const receiptTipo = document.getElementById('receiptTipo');
    const receiptDataHora = document.getElementById('receiptDataHora');
    const receiptHMAC = document.getElementById('receiptHMAC');
    const receiptHorasRow = document.getElementById('receiptHorasRow');
    const receiptHoras = document.getElementById('receiptHoras');
    const receiptAlertRow = document.getElementById('receiptAlertRow');
    const receiptAlertMsg = document.getElementById('receiptAlertMsg');

    if (receiptNome) receiptNome.textContent = data.funcionario_nome;
    if (receiptMatricula) receiptMatricula.textContent = data.matricula;
    if (receiptTipo) receiptTipo.textContent = data.tipo;
    if (receiptDataHora) receiptDataHora.textContent = Utils.formatDateTime(data.data_hora);
    if (receiptHMAC) receiptHMAC.textContent = data.comprovante_hmac;

    // Se houve cálculo de horas trabalhadas na Saída
    if (data.horas_trabalhadas !== undefined && receiptHorasRow) {
        receiptHorasRow.style.display = 'flex';
        receiptHoras.textContent = `${data.horas_trabalhadas} hrs`;
    } else if (receiptHorasRow) {
        receiptHorasRow.style.display = 'none';
    }

    // Se houver mensagem de aviso (Ex: Atraso ou Atestado)
    if ((data.codigo === 'ATRASO_DETECTADO' || data.codigo === 'ATESTADO_DETECTADO') && receiptAlertRow) {
        receiptAlertRow.style.display = 'flex';
        receiptAlertMsg.textContent = data.mensagem;
    } else if (receiptAlertRow) {
        receiptAlertRow.style.display = 'none';
    }

    ticketModal?.classList.add('active');
    initLucideIcons();
}

/**
 * Fecha o Modal do Ticket
 */
function closeTicketModal() {
    const ticketModal = document.getElementById('ticketModal');
    ticketModal?.classList.remove('active');
}

/**
 * Gerenciamento do Modal de Justificativas / Atestados
 */
function openJustificationModal() {
    const justModal = document.getElementById('justificationModal');
    const justMatricula = document.getElementById('justMatricula');
    const justPin = document.getElementById('justPin');

    // Preencher matricula/pin automaticamente se digitado no kiosk
    if (justMatricula && state.matriculaVal) justMatricula.value = state.matriculaVal;
    if (justPin && state.pinVal) justPin.value = state.pinVal;

    // Resetar campos de arquivo e hash preview
    state.currentSelectedFileHash = null;
    const hashPreviewBox = document.getElementById('hashPreviewBox');
    if (hashPreviewBox) hashPreviewBox.style.display = 'none';

    justModal?.classList.add('active');
    initLucideIcons();
}

function closeJustificationModal() {
    const justModal = document.getElementById('justificationModal');
    justModal?.classList.remove('active');
}

/**
 * Handler disparado quando o usuário seleciona um arquivo no Modal
 */
async function onJustificationFileSelected(event) {
    const file = event.target.files[0];
    const hashPreviewBox = document.getElementById('hashPreviewBox');
    const computedHashDisplay = document.getElementById('computedHashDisplay');

    if (!file) {
        state.currentSelectedFileHash = null;
        if (hashPreviewBox) hashPreviewBox.style.display = 'none';
        return;
    }

    try {
        if (computedHashDisplay) computedHashDisplay.textContent = 'Calculando SHA-256 no navegador...';
        if (hashPreviewBox) hashPreviewBox.style.display = 'block';

        const hash = await Utils.calculateFileSHA256(file);
        state.currentSelectedFileHash = hash;

        if (computedHashDisplay) computedHashDisplay.textContent = hash;
        console.log('Hash SHA-256 do arquivo gerado com sucesso:', hash);
    } catch (err) {
        console.error('Erro ao calcular hash do arquivo:', err);
        if (computedHashDisplay) computedHashDisplay.textContent = 'Erro no cálculo do hash';
    }
}

/**
 * Submissão do formulário de justificativa com Antifraude
 */
async function handleSendJustification(event) {
    event.preventDefault();

    const matricula = document.getElementById('justMatricula').value;
    const pin = document.getElementById('justPin').value;
    const dataInicio = document.getElementById('justDataInicio').value;
    const dataFim = document.getElementById('justDataFim').value;
    const motivo = document.getElementById('justMotivo').value;
    const fileInput = document.getElementById('justFile');
    const file = fileInput.files[0];

    if (!file || !state.currentSelectedFileHash) {
        alert('Por favor, selecione um arquivo válido para o atestado.');
        return;
    }

    const btnSubmit = document.getElementById('btnSubmitJustification');
    if (btnSubmit) btnSubmit.disabled = true;

    try {
        const response = await KioskService.cadastrarJustificativaAntifraude(
            matricula,
            pin,
            dataInicio,
            dataFim,
            motivo,
            file.name,
            state.currentSelectedFileHash
        );

        if (!response.sucesso) {
            if (response.codigo === 'FRAUDE_HASH_DUPLICADO') {
                alert(`🚨 ALERTA DE SEGURANÇA E ANTIFRAUDE!\n\n${response.mensagem}\n\nOperação rejeitada.`);
            } else {
                alert(`Erro: ${response.mensagem}`);
            }
            return;
        }

        alert(`✅ ${response.mensagem}\n\nHash Antifraude Validado: ${response.arquivo_hash.substring(0, 16)}...`);
        closeJustificationModal();

    } catch (err) {
        console.error('Erro ao enviar justificativa:', err);
        alert('Falha ao processar atestado. Verifique os dados e tente novamente.');
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

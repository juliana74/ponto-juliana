/**
 * CADASTRO.JS - Lógica da Página de Cadastro de Funcionário com Captura Facial
 */

const cadastroState = {
    cameraStream: null,
    capturedFacialPhotoUrl: null
};

document.addEventListener('DOMContentLoaded', () => {
    initLucideIcons();
    initCadastroCamera();
});

function initLucideIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
        window.lucide.createIcons();
    }
}

/**
 * Inicializa a câmera do dispositivo para o cadastro facial
 */
async function initCadastroCamera() {
    const videoEl = document.getElementById('webcamCadastro');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Câmera não suportada neste navegador.');
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
        cadastroState.cameraStream = stream;
        if (videoEl) {
            videoEl.srcObject = stream;
        }
    } catch (err) {
        console.warn('Erro ao acessar a câmera no cadastro:', err.message);
        alert('Não foi possível acessar a câmera. Verifique as permissões.');
    }
}

/**
 * Captura um snapshot do video na tag canvas e gera uma Data URL
 */
function captureFacialPhoto() {
    const videoEl = document.getElementById('webcamCadastro');
    const canvasEl = document.getElementById('photoCanvasCadastro');
    const previewImgEl = document.getElementById('photoSnapshotPreview');
    const statusTextEl = document.getElementById('facialPhotoStatusText');
    const btnRetake = document.getElementById('btnRetakePhoto');

    if (!videoEl || !canvasEl) return;

    canvasEl.width = videoEl.videoWidth || 640;
    canvasEl.height = videoEl.videoHeight || 480;

    const ctx = canvasEl.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

    const dataUrl = canvasEl.toDataURL('image/jpeg', 0.85);
    cadastroState.capturedFacialPhotoUrl = dataUrl;

    if (previewImgEl) {
        previewImgEl.src = dataUrl;
        previewImgEl.style.display = 'block';
    }

    if (statusTextEl) {
        statusTextEl.textContent = 'Foto Facial Capturada com Sucesso!';
        statusTextEl.style.color = 'var(--color-success)';
    }

    if (btnRetake) {
        btnRetake.style.display = 'flex';
    }
}

/**
 * Reseta a captura facial e reexibe a câmera ao vivo
 */
function resetFacialPhoto() {
    const previewImgEl = document.getElementById('photoSnapshotPreview');
    const statusTextEl = document.getElementById('facialPhotoStatusText');
    const btnRetake = document.getElementById('btnRetakePhoto');

    cadastroState.capturedFacialPhotoUrl = null;

    if (previewImgEl) {
        previewImgEl.style.display = 'none';
        previewImgEl.src = '';
    }

    if (statusTextEl) {
        statusTextEl.textContent = 'Pendente (Capture a foto ao lado)';
        statusTextEl.style.color = 'var(--text-primary)';
    }

    if (btnRetake) {
        btnRetake.style.display = 'none';
    }
}

/**
 * Handler de submissão do formulário de cadastro de funcionário
 */
async function handleCadastrarFuncionario(event) {
    event.preventDefault();

    const matricula = document.getElementById('cadMatricula').value.trim();
    const nome = document.getElementById('cadNome').value.trim();
    const pin = document.getElementById('cadPin').value.trim();

    if (!matricula || !nome || !pin) {
        alert('Por favor, preencha todos os campos obrigatórios.');
        return;
    }

    if (!cadastroState.capturedFacialPhotoUrl) {
        alert('A foto facial é obrigatória para realizar o cadastro. Clique em "Capturar Foto".');
        return;
    }

    const btnSubmit = document.getElementById('btnSubmitCadastro');
    if (btnSubmit) btnSubmit.disabled = true;

    try {
        const response = await KioskService.cadastrarFuncionario(
            matricula,
            nome,
            pin,
            cadastroState.capturedFacialPhotoUrl
        );

        if (!response.sucesso) {
            alert(`Erro no cadastro: ${response.mensagem}`);
            return;
        }

        alert(`✅ Funcionário ${nome} (Matrícula: ${matricula}) cadastrado com sucesso com foto facial!`);
        window.location.href = 'index.html';

    } catch (err) {
        console.error('Erro ao cadastrar funcionário:', err);
        alert('Falha ao processar cadastro. Tente novamente.');
    } finally {
        if (btnSubmit) btnSubmit.disabled = false;
    }
}

(() => {
    // YouTube's chat lives in its own frame. Do not add UI to the watch page.
    const youtubeHost = ["www.youtube.com", "youtube.com"].includes(window.location.hostname);
    if (youtubeHost && !/^\/live_chat(?:_replay)?\/?$/.test(window.location.pathname)) return;
    if (!["kick.com", "www.twitch.tv", "twitch.tv", "www.youtube.com", "youtube.com"].includes(window.location.hostname)) return;
    if (globalThis.__CALVOSHOT_CONTENT_SCRIPT_STARTED__) return;
    if (!globalThis.CalvoShotMediaCodes) {
        throw new Error("CalvoShot: módulo de códigos de mídia não foi carregado.");
    }
    const { codificarImagem, decodificarCodigoImagem, codificarCodigoGiphy, decodificarCodigoGiphy, montarMensagemComMidia, separarMensagemComMidia } = globalThis.CalvoShotMediaCodes;
    globalThis.__CALVOSHOT_CONTENT_SCRIPT_STARTED__ = true;
const SELETOR_CAMPO_EDITAVEL = 'textarea, input, [contenteditable]:not([contenteditable="false"]), [role="textbox"]';
const E_TWITCH_KMC = ["www.twitch.tv", "twitch.tv"].includes(window.location.hostname);
const E_YOUTUBE_KMC = ["www.youtube.com", "youtube.com"].includes(window.location.hostname);
const CHAT_ADAPTADO_KMC = E_TWITCH_KMC || E_YOUTUBE_KMC;
const SELETOR_MENSAGEM_YOUTUBE_KMC = 'yt-live-chat-text-message-renderer #message, yt-live-chat-paid-message-renderer #message, yt-live-chat-membership-item-renderer #message';
const SELETOR_MENSAGEM_TWITCH_KMC = '[data-a-target="chat-message-text"], .chat-line__message .text-fragment, .seventv-message .text-token';

// Search normal DOM and open component roots. Do not touch cross-origin frames.
function consultarChatKMC(seletor, raiz = document) {
    const encontrados = [...raiz.querySelectorAll(seletor)];
    if (E_YOUTUBE_KMC) {
        for (const elemento of raiz.querySelectorAll("*")) {
            if (elemento.shadowRoot) encontrados.push(...consultarChatKMC(seletor, elemento.shadowRoot));
        }
    }
    return encontrados;
}

function visivelChatKMC(elemento) {
    if (!elemento || elemento.closest?.('#kmc-panel, #kmc-gif-panel, #kmc-button')) return false;
    const rect = elemento.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

function editorChatKMC(candidatos) {
    for (const candidato of candidatos) {
        const editor = candidato.matches('textarea, input, [contenteditable]:not([contenteditable="false"])')
            ? candidato : candidato.querySelector('textarea, [contenteditable]:not([contenteditable="false"])');
        if (visivelChatKMC(editor)) return editor;
    }
    return null;
}

function encontrarCampoYoutubeKMC() {
    return editorChatKMC(consultarChatKMC(
        'yt-live-chat-text-input-field-renderer #input, ' +
        'yt-live-chat-message-input-renderer [contenteditable], ' +
        '#input.yt-live-chat-text-input-field-renderer, ' +
        '[contenteditable][role="textbox"], #input[contenteditable]'
    ));
}

function encontrarCampoAdaptadoKMC() {
    return E_YOUTUBE_KMC ? encontrarCampoYoutubeKMC() : encontrarCampoTwitchKMC();
}

function seletorMensagemAdaptadaKMC() {
    return E_YOUTUBE_KMC ? SELETOR_MENSAGEM_YOUTUBE_KMC : SELETOR_MENSAGEM_TWITCH_KMC;
}

function encontrarBotaoEnviarAdaptadoKMC(campo) {
    const seletor = E_YOUTUBE_KMC
        ? '#send-button button, #send-button [role="button"], #send-button yt-icon-button, yt-button-renderer#send-button'
        : '[data-a-target="chat-send-button"], [data-test-selector="chat-send-button"]';
    // Twitch can render the send controls outside .chat-input.
    const candidatos = consultarChatKMC(seletor).filter(visivelChatKMC);
    const contexto = campo.closest(E_YOUTUBE_KMC ? 'yt-live-chat-message-input-renderer' : '.chat-input');
    return candidatos.find(botao => contexto?.contains(botao)) ||
        (candidatos.length === 1 ? candidatos[0] : null);
}

function encontrarCampoTwitchKMC() {
    return editorChatKMC(consultarChatKMC(
        '[data-a-target="chat-input-text"], [data-a-target="chat-input"], ' +
        '.chat-input__textarea textarea, .chat-input__textarea [contenteditable], ' +
        '.chat-input [data-slate-editor="true"], .chat-input [role="textbox"]'
    ));
}

function textoEditorKMC(campo) {
    return String(campo.value ?? campo.innerText ?? campo.textContent ?? "").replace(/[\u200B\uFEFF]/g, "").trim();
}

function botaoDisponivelKMC(botao) {
    return botao && !botao.disabled && botao.getAttribute("aria-disabled") !== "true" &&
        !botao.closest('[disabled], [aria-disabled="true"]');
}

async function aguardarChatKMC(condicao, limite = 2500) {
    const fim = Date.now() + limite;
    do {
        const resultado = condicao();
        if (resultado) return resultado;
        await new Promise(resolve => setTimeout(resolve, 100));
    } while (Date.now() < fim);
    return null;
}

async function enviarMensagemAdaptadaKMC(mensagem) {
    const campo = encontrarCampoAdaptadoKMC();
    if (!campo) {
        alert("CalvoShot: não encontrei o editor do chat. Confirme que o chat está aberto e você está conectado. Você também pode copiar o código do painel.");
        return false;
    }
    if (campo.disabled || campo.getAttribute('aria-disabled') === 'true') {
        alert("CalvoShot: o editor do chat está desabilitado pelo site.");
        return false;
    }
    const texto = String(mensagem).trim();
    if (E_YOUTUBE_KMC && [...texto].length > 200) {
        alert("No YouTube, reduza a legenda: a mensagem com o código deve ter até 200 caracteres.");
        return false;
    }
    const atual = textoEditorKMC(campo);
    if (atual && atual !== texto) {
        alert("CalvoShot: há um rascunho no chat. Envie ou apague esse texto antes de enviar a imagem.");
        return false;
    }
    if (atual !== texto) {
        campo.focus();
        if (E_TWITCH_KMC && campo.tagName !== 'TEXTAREA' && campo.tagName !== 'INPUT') {
            // Slate must receive its paste handler; direct DOM edits desynchronize its model.
            const dados = new DataTransfer();
            dados.setData('text/plain', texto);
            campo.dispatchEvent(new ClipboardEvent('paste', {
                bubbles: true, cancelable: true, composed: true, clipboardData: dados
            }));
        } else {
            colocarTextoNoCampo(campo, texto);
        }
    }
    const pronto = await aguardarChatKMC(() => {
        const editorAtual = encontrarCampoAdaptadoKMC();
        if (!editorAtual || textoEditorKMC(editorAtual) !== texto) return null;
        const enviar = encontrarBotaoEnviarAdaptadoKMC(editorAtual);
        return botaoDisponivelKMC(enviar) ? { campo: editorAtual, enviar } : null;
    });
    if (!pronto) {
        alert("CalvoShot: o site não confirmou o texto ou não habilitou Enviar. O código foi preservado no painel; copie e cole manualmente. Nenhum envio automático foi feito.");
        return false;
    }
    liberarCodigosColadosKMC(pronto.campo);
    pronto.enviar.click(); // Only one click: never retry a potentially successful send.
    const saiu = await aguardarChatKMC(() => {
        const editorAtual = encontrarCampoAdaptadoKMC();
        return editorAtual && textoEditorKMC(editorAtual) === '';
    });
    if (!saiu) {
        alert("CalvoShot: não consegui confirmar o envio. Confira o chat antes de tentar novamente.");
    }
    return !!saiu;
}

function mensagemAdaptadaKMC(elemento) {
    return elemento.matches?.(seletorMensagemAdaptadaKMC()) ||
        !!elemento.closest?.(seletorMensagemAdaptadaKMC());
}

const codigosColadosRecentementeKMC = new Map();
let codigoColadoAguardandoEnvioKMC = false;
let campoCodigoColadoKMC = null;

function inserirTextoColadoKMC(campo, texto) {
    if (!campo) return false;
    campo.focus();

    if (campo instanceof HTMLTextAreaElement || campo instanceof HTMLInputElement) {
        const inicio = campo.selectionStart ?? campo.value.length;
        const fim = campo.selectionEnd ?? inicio;
        campo.setRangeText(texto, inicio, fim, "end");
        campo.dispatchEvent(new InputEvent("input", {
            bubbles: true,
            inputType: "insertText",
            data: texto
        }));
        return true;
    }

    // Reaproveita o cursor do editor para inserir texto simples, sem HTML/link.
    if (document.execCommand("insertText", false, texto)) return true;

    const selecao = window.getSelection();
    const intervalo = selecao && selecao.rangeCount > 0
        ? selecao.getRangeAt(0)
        : document.createRange();
    if (!campo.contains(intervalo.commonAncestorContainer)) {
        intervalo.selectNodeContents(campo);
        intervalo.collapse(false);
    }
    intervalo.deleteContents();
    const noTexto = document.createTextNode(texto);
    intervalo.insertNode(noTexto);
    intervalo.setStartAfter(noTexto);
    intervalo.collapse(true);
    selecao?.removeAllRanges();
    selecao?.addRange(intervalo);
    campo.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: texto
    }));
    return true;
}

// Protege também o instante entre colar o texto e a Kick atualizar o editor.
document.addEventListener("paste", evento => {
    const alvo = evento.target instanceof Element
        ? evento.target.closest(SELETOR_CAMPO_EDITAVEL)
        : null;
    if (alvo) alvo.setAttribute("data-kmc-chat-input", "true");

    const textoOriginal = evento.clipboardData?.getData("text/plain") || "";
    const texto = textoOriginal;

    if (alvo && texto !== textoOriginal) {
        evento.preventDefault();
        inserirTextoColadoKMC(alvo, texto);
    }

    const codigos = texto.match(/(?:KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF)|KMCIMG_[A-Za-z0-9_.-]+|KMCGIF_TNR_[A-Za-z0-9_.-]+|gph:[A-Za-z0-9_.-]+|tnr:[A-Za-z0-9_.-]+)/gi) || [];
    if (codigos.length) {
        codigoColadoAguardandoEnvioKMC = true;
        campoCodigoColadoKMC = alvo;
    }

    for (const codigo of codigos) {
        // Infinity significa: aguarde até o código sair do editor (envio).
        codigosColadosRecentementeKMC.set(codigo.toLowerCase(), Infinity);
    }
}, true);

// Marca o editor pelo próprio foco/entrada de texto da pessoa, sem depender
// de placeholder ou das mudanças de estrutura que a Kick faz na página.
document.addEventListener("focusin", evento => {
    const alvo = evento.target instanceof Element
        ? evento.target.closest(SELETOR_CAMPO_EDITAVEL)
        : null;
    if (alvo) alvo.setAttribute("data-kmc-chat-input", "true");
}, true);

document.addEventListener("input", evento => {
    const elementoEvento = evento.target instanceof Element
        ? evento.target
        : null;
    const alvo = elementoEvento?.closest(SELETOR_CAMPO_EDITAVEL) || elementoEvento;
    if (alvo) {
        if (alvo.matches?.(SELETOR_CAMPO_EDITAVEL)) {
            alvo.setAttribute("data-kmc-chat-input", "true");
        }
        const conteudo = alvo.value ?? alvo.innerText ?? alvo.textContent ?? "";
        const codigos = String(conteudo).match(/(?:KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF)|KMCIMG_[A-Za-z0-9_.-]+|KMCGIF_TNR_[A-Za-z0-9_.-]+|gph:[A-Za-z0-9_.-]+|tnr:[A-Za-z0-9_.-]+)/gi) || [];
        if (codigos.length) {
            codigoColadoAguardandoEnvioKMC = true;
            campoCodigoColadoKMC = alvo;
        } else if (alvo === campoCodigoColadoKMC) {
            codigoColadoAguardandoEnvioKMC = false;
            campoCodigoColadoKMC = null;
        }
        for (const codigo of codigos) {
            codigosColadosRecentementeKMC.set(codigo.toLowerCase(), Infinity);
        }
    }
}, true);

function liberarCodigosColadosKMC(campo) {
    if (!campo) return;
    const conteudo = campo.value ?? campo.innerText ?? campo.textContent ?? "";
    const codigos = String(conteudo).match(/(?:KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF)|KMCIMG_[A-Za-z0-9_.-]+|KMCGIF_TNR_[A-Za-z0-9_.-]+|gph:[A-Za-z0-9_.-]+|tnr:[A-Za-z0-9_.-]+)/gi) || [];
    if (!codigos.length) return;
    codigoColadoAguardandoEnvioKMC = false;
    campoCodigoColadoKMC = null;
    for (const codigo of codigos) {
        const chave = codigo.toLowerCase();
        if (codigosColadosRecentementeKMC.has(chave)) {
            // Marca como liberado pelo envio. A mensagem publicada no chat
            // será convertida assim que a Kick a inserir na página.
            codigosColadosRecentementeKMC.set(chave, 0);
        }
    }
    agendarBuscaDeMidiaDepoisDoEnvioKMC();
}

function reconciliarProtecaoDeCodigoColadoKMC() {
    if (!codigoColadoAguardandoEnvioKMC) return;

    const campo = campoCodigoColadoKMC;
    const texto = campo?.isConnected
        ? String(campo.value ?? campo.innerText ?? campo.textContent ?? "")
        : "";
    const aindaNoCampo = /(?:KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF)|KMCIMG_[A-Za-z0-9_.-]+|KMCGIF_TNR_[A-Za-z0-9_.-]+|gph:[A-Za-z0-9_.-]+|tnr:[A-Za-z0-9_.-]+)/i.test(texto);
    if (aindaNoCampo) return;

    codigoColadoAguardandoEnvioKMC = false;
    campoCodigoColadoKMC = null;
    for (const [codigo, expiraEm] of codigosColadosRecentementeKMC) {
        if (expiraEm === Infinity) codigosColadosRecentementeKMC.set(codigo, 0);
    }
}

function agendarBuscaDeMidiaDepoisDoEnvioKMC() {
    for (const atraso of [150, 450, 900, 1600]) {
        setTimeout(() => {
            reconciliarProtecaoDeCodigoColadoKMC();
            procurarGifsNoChat();
        }, atraso);
    }
}

function liberarProtecaoAoDetectarMensagemKMC(elemento) {
    if (!codigoColadoAguardandoEnvioKMC || !elemento) return false;
    if (
        elemento.closest?.(SELETOR_CAMPO_EDITAVEL) ||
        elemento.closest?.('[data-kmc-chat-input="true"]') ||
        elemento.closest?.("#kmc-button, #kmc-panel, #kmc-gif-panel")
    ) return false;

    const texto = elemento.textContent || "";
    const codigos = texto.match(/(?:KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF)|KMCIMG_[A-Za-z0-9_.-]+|KMCGIF_TNR_[A-Za-z0-9_.-]+|gph:[A-Za-z0-9_.-]+|tnr:[A-Za-z0-9_.-]+)/gi) || [];
    const codigoEnviado = codigos.find(codigo =>
        codigosColadosRecentementeKMC.has(codigo.toLowerCase())
    );
    if (!codigoEnviado) return false;

    for (const codigo of codigos) {
        if (codigosColadosRecentementeKMC.has(codigo.toLowerCase())) {
            codigosColadosRecentementeKMC.set(codigo.toLowerCase(), 0);
        }
    }
    codigoColadoAguardandoEnvioKMC = false;
    campoCodigoColadoKMC = null;
    agendarBuscaDeMidiaDepoisDoEnvioKMC();
    return true;
}

document.addEventListener("keydown", evento => {
    if (evento.key !== "Enter" || evento.shiftKey || evento.isComposing) return;
    const alvo = evento.target instanceof Element ? evento.target : null;
    const campo = alvo
        ? (alvo.closest(SELETOR_CAMPO_EDITAVEL) || (alvo === campoCodigoColadoKMC ? alvo : null))
        : null;
    liberarCodigosColadosKMC(campo);
}, true);

document.addEventListener("submit", evento => {
    const formulario = evento.target;
    const campo = formulario instanceof Element
        ? formulario.querySelector(SELETOR_CAMPO_EDITAVEL)
        : null;
    liberarCodigosColadosKMC(campo);
}, true);

document.addEventListener("click", evento => {
    const botao = evento.target instanceof Element
        ? evento.target.closest('button, [role="button"]')
        : null;
    const rotulo = botao
        ? `${botao.getAttribute("aria-label") || ""} ${botao.getAttribute("title") || ""} ${botao.textContent || ""}`.toLowerCase()
        : "";
    if (!botao || !/(send|enviar)/i.test(rotulo)) return;
    liberarCodigosColadosKMC(encontrarCampoChat());
}, true);

const botao = document.createElement("button");

botao.id = "kmc-button";
botao.innerHTML = `<svg width="24" height="24" viewBox="0 0 48 48" aria-hidden="true"><image width="48" height="48" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAIAAADYYG7QAAAG1klEQVR4nMVYzW8URxZ/9aq6x+NhRuAZyeZAvMYeKd4IgZCFsuICt43ENSAkAn8BPnBAnCwOSJw4wyIfkLghQSKLwIEIJQeyWSQTkkgwH5Y3KE6QwBaaD2xPd1W9HGqmp/rLNiDgHWaqu6rfe/V7n1UMesQYg49HRPQRpW9EXVQYY4VCgTGmtY6sIKJNwdvKmrRPEJGIms2mAUkwxoioUCg8fPiwVCq5rvshbUdEnuctLy8fOHCg0WgwxoSZYIyNjIzk8/l6vR5RiDF4f/YlonK5LIToCzWjQqHQarUqlcr7kpxOlaeVdrtdKBSMMhhMMMbwAxorkMSQ2TYRSWv6KSBwPSJiAJCicWhZb2D4BAP7ZSAvHu22QvZcf2UwIoANvMmo0hcWG0A01fUYh1mK0JMFZHThFuiNkhtjPRFh0CMKUWzwBpTL5RzHsdUKTBZRZX19vbO+nigq2YfeFCHOuVLqP1eu/PuLL3zf55ynrVRSOa5z8eLFS5cuCSGklKkIvXuA7RgaKhaLW1m5bdu2tKm+QpQCCSKm5W6ttW0RKaXWWvqSiwSEDBMppeM4SqnNFUrDKF7d0ohzjoiu6yZyCmLeDsaNFIp7jXHJcrk8MjKitba5EBEiPnnyZGVlJSjJ09PTMzMzZiURGUzMuFQqffP1N4O5QerR5gpFTMYYc11XSjkzM3PixInEj48dO3bz5k2O6Pk+ACwuLqaJyWazUsmAsxCR6O5jGp2wMeh0OgDQarW01r7v21yUUkKIRqOhlAocAhFtDgYbx3GGhoaGh4c5cvOy0Wg0m01LUvATVcjKrURjY2N79uzpdLzx8XFEFELYwcyAIeLBgwc550tLf/z662/xXgoRtdbDw8OPHj0aGBjIZrNKKcdxTp06dffu3W7MQ8x1g2rfbr+uVWsAYJA4d+5cYG+ttEwiM3v16tXgK5s450KIiYkJ3/eJSCnldTzf9w8dOmSvr1aqr1+/Dqp9WqaGTqejlOp0Otls9qf//XTy5EnOucHA2AIR7927t2vXrrQwNKZcWVmRUhrxjusAwGA2G4Yk9BRSyPZqxpgJY8ZYu91eWFiIi/zh+x/Gx3ebLipeMYrF4pEjR4rFIudcK82Q3blz58GDB9VaDdKzSVq1D+8hJW18dfKrYGznOqPQ6OjotWvXjK7Slw53bt++ffny5a4w6im0QS0LF7P+02B2cGxszDipLfXFixerq6uJecW07lJKIOJcEJCUMpfLmW7V9/1+4ks3WQJCnHMi+vxfn1cqFbNvBoyAtNLCEUePHp2bm+Oc+74f+VBr3Wq1hBBEBESu6wJAxnUDf0prrVJ9KJInTY4xtjMxL4Qwjp9QmIimpqb27dtHRFprRKzX6j/+98efH/8Mgbel9RPhsK9CLyDPnDljziimgsZJaz0/P//dve+mp6cNlmBZfaG+YEzmeR4Rzc7OJsoFgGp1g7CPOa+x0bNnz27cuMGRG9i0pqNffvnJ6Cf79+8HgN9//78lgCEyxtja+lrgcCYfCiEQ0fO8JFj6FO6HYhhqrYHB06dPz549a7//7LN/jv5jdHV1NZPJrK6tRT/pVV9jTc55Pp/ve0900ykKEVBaS+S6rtmfcQittXFSRDS5qrslxgBo9+7dk5OT+XweCBgAR379+vVv73ybeE7vIZGkEKTnG6Duvvu/STHCOZdSHj9+/MKFC6ZZA8YQ8fz584uLixxRbaG1suszswEybquUIiKllda62xCaX6UAQKvuApuj8WIAQI4GPJOsYzvYPOxDJnNdFxFzuRwATE1N3b9/vxfzoIn27t0LAIO5QQAYGBiwORqlfd8zDoSIvu8rpSLNSVrc207dP60CwNLS0vz8vOd5k59O7tix4/Dhw5EvlVSPf3lMRPV6HXqIAsDs7OytW7cC2BiDP//8CxKKF0X+e3r081C7Wq3aLw3Nzc0ppdZW17wemXzYbDZLpVJ8i1ukQMJG7UfEpYUQSqlMJoOIA9mB8CRkMplMJmM69kiNiwRHSmHfzGQQmzcOe/r06e3btxPp8G0EKKVfvnxJsVyxcQ+fLi1JoQhChm+tVtuM8dvdZ23BqRMZpx0UAy9+S+qjGBK7EUKG3knqligkNnouS7zXeb+KhE0XyUMJtycfmPrZU5N+W/d8JyIdCtQuQqaGl8vlWq1mGcsMkrXsLqPYGRwYARlL2ONkbYgmJiZarVZQWEQw8fz5cynlzp07e9de3QtqE32MQe8lEBADBt3762AcOQZBsJmeWrEtASPSr169Wl5e7peagEU+nw9u4KxKFLrx6EpiFnTh+9fIPetmHskACBEBqNlsfXT3Taa0O9sPTQE8fwP/dzDdohNH6AAAAABJRU5ErkJggg=="/></svg>`;
botao.title = "CalvoShot";
botao.setAttribute("aria-label", "Abrir o CalvoShot");

Object.assign(botao.style, {
    position: "fixed",
    zIndex: "999996",
    width: "34px",
    height: "34px",
    padding: "0",
    border: "none",
    borderRadius: "0",
    background: "transparent",
    color: "#fff",
    cursor: "pointer",
    boxShadow: "none",
    display: "none",
    alignItems: "center",
    justifyContent: "center"
});

document.body.appendChild(botao);

const estilosKMC = document.createElement("style");
estilosKMC.textContent = `
    #kmc-panel, #kmc-gif-panel {
        transform-origin: bottom right;
        outline: 1px solid transparent;
        outline-offset: 0;
    }
    #kmc-button svg { transition: transform .18s ease; }
    #kmc-button:hover svg { transform: scale(1.12); }
    #kmc-panel, #kmc-gif-panel {
        box-sizing: border-box !important;
        font-family: Inter, system-ui, sans-serif !important;
        color: #f4f4f5 !important;
        background: #18181b !important;
        border: 1px solid #34343a !important;
        box-shadow: 0 12px 36px rgba(0,0,0,.48) !important;
        backdrop-filter: blur(10px);
    }
    #kmc-panel {
        width: min(320px, calc(100vw - 24px)) !important;
        max-height: calc(100vh - 24px);
        overflow-y: auto;
        padding: 18px !important;
    }
    #kmc-gif-panel {
        width: min(440px, calc(100vw - 24px)) !important;
        height: min(540px, calc(100vh - 24px)) !important;
        padding: 18px !important;
    }
    #kmc-gif-scroll-area {
        height: min(365px, calc(100vh - 220px)) !important;
        scrollbar-width: thin;
        scrollbar-color: #555 #222;
    }
    #kmc-panel h3, #kmc-gif-panel h3 {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin: 0 0 16px !important;
        font-size: 17px;
        font-weight: 700;
    }
    #kmc-panel button, #kmc-gif-panel button {
        box-sizing: border-box;
        border: 1px solid #3b3b42 !important;
        border-radius: 8px !important;
        background: #27272a !important;
        color: #f4f4f5 !important;
        font: inherit !important;
        font-weight: 600 !important;
        transition: background .15s ease, border-color .15s ease, transform .15s ease;
    }
    #kmc-panel button:hover, #kmc-gif-panel button:hover {
        background: #35353b !important;
        border-color: #53fc18 !important;
    }
    #kmc-panel button:active, #kmc-gif-panel button:active { transform: scale(.98); }
    #kmc-panel #kmc-send {
        border-color: #53fc18 !important;
        background: #53fc18 !important;
        color: #101010 !important;
        position: sticky;
        bottom: 0;
        z-index: 5;
        margin-top: 4px;
    }
    #kmc-panel #kmc-send:hover { background: #71ff45 !important; }
    #kmc-panel input, #kmc-gif-panel input {
        box-sizing: border-box;
        min-width: 0;
        border: 1px solid #3b3b42 !important;
        border-radius: 8px !important;
        outline: none;
        background-color: #202024 !important;
        color: #fff !important;
        caret-color: #fff !important;
        -webkit-text-fill-color: #fff !important;
        color-scheme: dark;
        font: inherit !important;
    }
    #kmc-panel input::selection, #kmc-gif-panel input::selection {
        background: #53fc18;
        color: #101010;
        -webkit-text-fill-color: #101010;
    }
    #kmc-panel input:-webkit-autofill, #kmc-gif-panel input:-webkit-autofill,
    #kmc-panel input:-webkit-autofill:hover, #kmc-gif-panel input:-webkit-autofill:hover,
    #kmc-panel input:-webkit-autofill:focus, #kmc-gif-panel input:-webkit-autofill:focus {
        -webkit-box-shadow: 0 0 0 1000px #202024 inset !important;
        -webkit-text-fill-color: #fff !important;
        caret-color: #fff !important;
    }
    #kmc-panel #kmc-gif-query:focus {
        background-color: #202024 !important;
        color: #fff !important;
        -webkit-text-fill-color: #fff !important;
    }
    #kmc-panel input:focus, #kmc-gif-panel input:focus {
        border-color: #53fc18 !important;
        box-shadow: 0 0 0 2px rgba(83,252,24,.16);
    }
    #kmc-panel #kmc-drop { transition: border-color .15s ease, background .15s ease; }
    #kmc-panel #kmc-drop:hover { border-color: #53fc18 !important; background: #202a1d; color: #fff !important; }
    #kmc-panel #kmc-close, #kmc-gif-panel #kmc-gif-close {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex: 0 0 30px;
        width: 30px !important;
        height: 30px;
        padding: 0 !important;
        border-radius: 50% !important;
        font-family: Arial, sans-serif !important;
        font-size: 20px !important;
        color: #fff !important;
        text-align: center;
        line-height: 1 !important;
    }
    #kmc-gif-query::-webkit-search-cancel-button,
    #kmc-gif-query::-moz-search-clear-button {
        -webkit-appearance: none;
        appearance: none;
        width: 14px;
        height: 14px;
        cursor: pointer;
        background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 4l8 8M12 4l-8 8' stroke='%23fff' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E") center / contain no-repeat;
    }
    #kmc-panel #kmc-image-preview .kmc-remove {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 !important;
        line-height: 1 !important;
        border: 1px solid rgba(255,255,255,.35) !important;
        border-radius: 50% !important;
        background: rgba(20,20,22,.88) !important;
        color: #fff !important;
        font-size: 21px !important;
        font-weight: 400 !important;
    }
    #kmc-panel #kmc-image-preview .kmc-remove:hover {
        background: #53fc18 !important;
        color: #101010 !important;
    }
    #kmc-panel .kmc-edit-toolbar {
        display: flex;
        gap: 6px;
        margin-top: 7px;
    }
    #kmc-panel .kmc-edit-toolbar button {
        flex: 1;
        padding: 6px 4px;
        font-size: 12px !important;
    }
    #kmc-panel .kmc-restore-image {
        width: 100%;
        margin-top: 6px;
        padding: 6px;
        font-size: 12px !important;
    }
    #kmc-gif-results img {
        aspect-ratio: 1 / 1;
        border: 1px solid transparent;
        transition: transform .15s ease, border-color .15s ease;
    }
    #kmc-gif-results img:hover { transform: scale(1.03); border-color: #53fc18; }
    @media (prefers-reduced-motion: reduce) {
        #kmc-panel *, #kmc-gif-panel *, #kmc-button * { transition: none !important; }
    }
`;
document.head.appendChild(estilosKMC);

const painel = document.createElement("div");

painel.id = "kmc-panel";

Object.assign(painel.style, {
    position: "fixed",
    width: "300px",
    padding: "20px",
    background: "#18181b",
    borderRadius: "12px",
    zIndex: "999998",
    color: "#fff",
    display: "none",
    boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
});

painel.innerHTML = `
    <h3>CalvoShot <button id="kmc-close" type="button" aria-label="Fechar">×</button></h3>

        <button
        id="kmc-open-gifs"
        type="button"
        style="width:100%; padding:10px; margin-bottom:10px; cursor:pointer;"
    >
        🔎 Buscar GIFs
    </button>

    <button id="kmc-image"
        style="width:100%; padding:10px; margin-bottom:10px; cursor:pointer;">
        🖼️ Escolher imagem
    </button>

    <input
        id="kmc-file"
        type="file"
        accept="image/*"
        style="display:none;"
    >

    <div
        id="kmc-drop"
        style="
            box-sizing:border-box;
            width:100%;
            min-height:80px;
            margin-bottom:10px;
            padding:12px;
            border:2px dashed #555;
            border-radius:8px;
            display:flex;
            align-items:center;
            justify-content:center;
            text-align:center;
            line-height:1.4;
            color:#aaa;
            cursor:pointer;
        "
    >
        🖼️ Arraste uma imagem aqui
    </div>

    <div
        id="kmc-image-preview"
        style="
            display:none;
            margin-bottom:10px;
            text-align:center;
        "
    >
        <div
            id="kmc-message-preview"
            style="
                display:none;
                margin-bottom:6px;
                color:#fff;
                font-size:13px;
                line-height:1.4;
                text-align:left;
                white-space:pre-wrap;
                overflow-wrap:anywhere;
            "
        ></div>
        <div id="kmc-image-preview-media"></div>
    </div>

    <input
        id="kmc-url"
        placeholder="Cole um link... ou Ctrl+V uma imagem"
        title="Para colar uma imagem, deixe este campo selecionado e use Ctrl+V."
        style="box-sizing:border-box; width:100%; padding:10px; margin-bottom:10px;"
    >

    <input
        id="kmc-caption"
        type="text"
        maxlength="500"
        placeholder="Mensagem (opcional)"
        aria-label="Mensagem para enviar junto da imagem ou GIF"
        style="box-sizing:border-box; width:100%; padding:10px; margin-bottom:10px;"
    >

    <button
        id="kmc-copy-code"
        type="button"
        style="display:none; width:100%; padding:8px; margin-bottom:10px; cursor:pointer;"
    >
        📋 Copiar código
    </button>


    <button
        id="kmc-send"
        style="width:100%; padding:10px; cursor:pointer;"
    >
        📤 Enviar
    </button>
`;

document.body.appendChild(painel);

const avisoPrivacidade = document.createElement("p");
avisoPrivacidade.textContent = "Enviar publica a imagem no Catbox e compartilha o código no chat. Busca e GIFs são carregados diretamente do GIPHY.";
avisoPrivacidade.style.cssText = "font-size:11px;color:#aaa;line-height:1.4;margin:10px 0 0";
painel.appendChild(avisoPrivacidade);

// Apoio voluntário: imagens locais, sem consulta a serviços de pagamento.
const coffeeButton = document.createElement("button");
coffeeButton.id = "calvoshot-coffee-button";
coffeeButton.type = "button";
coffeeButton.setAttribute("aria-haspopup", "dialog");
coffeeButton.style.cssText = "display:flex!important;align-items:center!important;justify-content:center!important;gap:4px!important;margin:8px auto 0!important;padding:3px!important;border:0!important;background:transparent!important;color:#bbb!important;font:11px/1.4 system-ui,sans-serif!important;cursor:pointer!important;width:auto!important;box-shadow:none!important;";
coffeeButton.innerHTML = '<span>Pague um Café</span><img alt="" src="data:image/png;base64,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" style="width:1em!important;height:1em!important;object-fit:contain!important;display:inline-block!important;margin:0!important;">';
painel.appendChild(coffeeButton);

const coffeeHost = document.createElement("div");
coffeeHost.id = "calvoshot-coffee";
const coffeeRoot = coffeeHost.attachShadow({mode: "closed"});
coffeeRoot.innerHTML = `
<style>
:host { all: initial; }
dialog { box-sizing:border-box; width:288px; max-width:calc(100vw - 24px); max-height:calc(100dvh - 24px); overflow:auto; padding:36px 16px 16px; border:1px solid #45454b; border-radius:12px; margin:auto; color:#eee; background:#18181b; box-shadow:0 8px 32px #0008; font:14px/1.5 system-ui,sans-serif; text-align:center; }
dialog::backdrop { background:rgba(0,0,0,.55); }
a { display:block; margin:0 0 12px; color:#dedee6; text-decoration:underline; overflow-wrap:anywhere; }
a:hover { color:white; }
button { position:absolute; top:5px; right:7px; width:28px; height:28px; padding:0; border:0; border-radius:5px; background:transparent; color:#ddd; font:22px/1 system-ui,sans-serif; cursor:pointer; }
button:hover { background:#333; }
:focus-visible { outline:2px solid #a8d8af; outline-offset:2px; }
img { display:block; width:100%; height:auto; background:white; border-radius:4px; }
</style>
<dialog aria-label="Pague um Café" closedby="any">
<button type="button" aria-label="Fechar" autofocus>×</button>
<a href="https://livepix.gg/trazendo" target="_blank" rel="noopener noreferrer">livepix.gg/trazendo</a>
<img src="data:image/png;base64,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tc1W2wC0f7b9s0WPVeXjPyzVracGjg0bST1x3UhL1HqZKy1Rc0UVtV7mSou5tH7sb6gVdZ7feT7A888+/yzAwzc8fAPAXV++68sA1x98/cEA9295/5ZFj1V9591L3r0E4LZ5t80DYBd2KXpMajVunKskFn504UcBjv3hsT8EN9AlybPzhrjw0psmXrB599dTTzx85mmLix6VepI33HI22Motar3MlZaouaKev6yXyiBqvTy+0mK99Maib5xL0rrkG+ZX/s2VfwMw4qoRVxU9JrUqN85VNtkV6Nd845pvgLdwl9S6PDs3wise0mK90mK90mK90mK90mK90mK90mK90mK9epsb55Ja1epbsn/xmC8CXmGuEnDjXCW34EcLfgRw7FnHngVw+6LbFxU9JknqC56d14efsZcW65UW65UW65UW65UW65UW65UW65UW69UsbpxLahUHDT9oOMCV51x5DsDIT438VNFjktbmxrlS8XN+DnDlJ678BMBxy45bVvSQJKmZPDu/kfVt2NSzgVMM65UW65UW65UW65UW65UW65UW65UW69VsbpxLiu6KwVcMBjj2J8f+BIAP8sGixyS9PjfOlaj5M+bPADjm8GMOB7j7ybufLHpMktSbPDu/ng1t2NSzgdM3rFdarFdarFdarFdarFdarFdarFdarFdfceNcUjT7bb/f9gDX3HTNTQCjJ42eVPSYpPXTVvQApA2TL7R3HX3X0QA/+a+f/FfRY5IkNUtvNWxy+c/Jf656l/VKi/VKi/VKi/VKi/VKi/VKi/VKi/WSJG2YfJ8m37dxw1zp8YpzBTO3c24nwAd3+OAOAPfNvW9u0WOSpA3h2Rl6v2HTE6+A6B3WKy3WKy3WKy3WKy3WKy3WKy3WKy3WqyhecS4pVXuN3WsswM+f+PkTAGPbx7YXPSZp43jFuYLJF+Z7B907COCyN1/25qLHJElqVF81bHJeAbFxrFdarFdarFdarFdarFdarFdarFdarJckqTH5vku+D+OGueLwinO1iKdHPD0C4P3L378c4E/L/rSs6DFJ0htpzbNzXzdseuIVEOvHeqXFeqXFeqXFeqXFeqXFeqXFeqXFepWFV5xLKru3Dn7rYIDrB10/CGDbhdsuLHpMUnN4xblaRL6QP/C7B34H8IOrf3B10WOSJOXK0rDJeQXEG7NeabFeabFeabFeabFe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" alt="QR code para apoiar Trazendo pelo Livepix">
</dialog>`;
document.body.appendChild(coffeeHost);
const coffeeDialog = coffeeRoot.querySelector("dialog");
coffeeButton.addEventListener("click", evento => {
    evento.stopPropagation();
    if (!coffeeDialog.open) coffeeDialog.showModal();
});
coffeeRoot.querySelector("button").addEventListener("click", () => coffeeDialog.close());
coffeeDialog.addEventListener("close", () => coffeeButton.focus());
coffeeDialog.addEventListener("click", evento => {
    evento.stopPropagation();
    if (evento.target !== coffeeDialog) return;
    const rect = coffeeDialog.getBoundingClientRect();
    if (evento.clientX < rect.left || evento.clientX > rect.right || evento.clientY < rect.top || evento.clientY > rect.bottom) coffeeDialog.close();
});


const gifPainel = document.createElement("div");

gifPainel.id = "kmc-gif-panel";

Object.assign(gifPainel.style, {
    position: "fixed",
    width: "300px",
    padding: "15px",
    background: "#18181b",
    borderRadius: "12px",
    zIndex: "999997",
    color: "#fff",
    display: "none",
    boxShadow: "0 4px 20px rgba(0,0,0,0.5)"
});

gifPainel.innerHTML = `
    <h3>GIFs <button id="kmc-gif-close" type="button" aria-label="Fechar">×</button></h3>
`;

document.body.appendChild(gifPainel);
gifPainel.insertAdjacentHTML("beforeend", '<div style="display:flex; gap:8px; margin-bottom:10px;"><div style="position:relative; flex:1;"><input id="kmc-gif-query" type="text" maxlength="80" placeholder="O que você quer encontrar?" aria-label="Buscar GIFs" style="width:100%; padding:10px 34px 10px 10px;"><button id="kmc-gif-clear" type="button" aria-label="Limpar busca" style="display:none; position:absolute; right:6px; top:50%; transform:translateY(-50%); width:24px; height:24px; padding:0 !important; border:0 !important; border-radius:50% !important; background:transparent !important; color:#fff !important; font-size:18px !important; line-height:1; align-items:center; justify-content:center; cursor:pointer;">×</button></div><button id="kmc-gif-search" type="button" style="padding:8px 12px; cursor:pointer;">Buscar</button></div><p id="kmc-gif-status" role="status" aria-live="polite" style="min-height:20px; margin:0 0 10px; color:#c4c4cc; font-size:13px;"></p><div id="kmc-gif-results" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(100px,1fr)); gap:8px;"></div><p style="margin:12px 0 0; text-align:right; font-size:12px; color:#c4c4cc;">Powered by GIPHY</p>');

function fecharPainelAnimado(painelAlvo) {
    if (painelAlvo.style.display === "none") return;

    const animacoes = painelAlvo.getAnimations();
    animacoes.forEach(animacao => animacao.cancel());

    if (
        !painelAlvo.animate ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
        painelAlvo.style.display = "none";
        return;
    }

    const saida = painelAlvo.animate(
        [
            { opacity: 1, transform: "translateY(0) scale(1)" },
            { opacity: 0, transform: "translateY(10px) scale(.97)" }
        ],
        { duration: 240, easing: "cubic-bezier(.4,0,1,1)" }
    );
    saida.onfinish = () => {
        // Animações concluídas sem fill saem de getAnimations().
        // Uma saída cancelada ao reabrir não deve ocultar o painel.
        if (saida.playState === "finished") {
            painelAlvo.style.display = "none";
        }
    };
}

function abrirPainelAnimado(painelAlvo) {
    painelAlvo.getAnimations().forEach(animacao => animacao.cancel());
    painelAlvo.style.display = "block";
    painelAlvo.animate(
        [
            {
                opacity: 0,
                transform: "translateY(12px) scale(.97)"
            },
            {
                opacity: 1,
                transform: "translateY(-1px) scale(1.01)",
                offset: 0.72
            },
            {
                opacity: 1,
                transform: "translateY(0) scale(1)"
            }
        ],
        { duration: 560, easing: "cubic-bezier(.22,.61,.36,1)" }
    );
    painelAlvo.animate(
        [
            { outlineColor: "rgba(83,252,24,0)", outlineOffset: "0px" },
            { outlineColor: "rgba(83,252,24,.8)", outlineOffset: "2px", offset: 0.48 },
            { outlineColor: "rgba(83,252,24,.22)", outlineOffset: "1px" }
        ],
        { duration: 900, easing: "ease-out" }
    );

    const iconeBotao = botao.querySelector("svg");
    iconeBotao?.getAnimations().forEach(animacao => animacao.cancel());
    iconeBotao?.animate(
        [
            { transform: "rotate(-90deg) scale(.65)" },
            { transform: "rotate(24deg) scale(1.2)", offset: 0.62 },
            { transform: "rotate(0deg) scale(1)" }
        ],
        { duration: 560, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
}

let imagemSelecionada = null;
let imagemOriginalSelecionada = null;
let imagemFoiEditada = false;
let previewImagemUrl = null;
let enviandoMensagem = false;
let fazendoUpload = false;
let erroUltimoUploadImagem = "";

let linksOriginais = {};

try {
    linksOriginais =
        JSON.parse(
            localStorage.getItem(
                "kmc_links_originais"
            ) || "{}"
        );
} catch (erro) {
    linksOriginais = {};
}

for (const tag of Object.keys(linksOriginais)) {
    if (/^gph:/i.test(tag)) delete linksOriginais[tag];
}
try { localStorage.setItem("kmc_links_originais", JSON.stringify(linksOriginais)); } catch {}

function salvarLinkOriginal(tag, url) {
    // GIPHY media URLs must be resolved from its API, not persisted.
    if (/^gph:/i.test(tag || "")) return;
    if (!tag || !url) {
        return;
    }

    linksOriginais[tag] = url;

    try {
        localStorage.setItem(
            "kmc_links_originais",
            JSON.stringify(linksOriginais)
        );
    } catch (erro) {
        console.warn(
            "CalvoShot - não conseguiu salvar link:",
            erro
        );
    }
}

function obterLinkOriginal(tag) {
    const value = linksOriginais[tag];
    try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password &&
            ["media.tenor.com", "c.tenor.com", "files.catbox.moe"].includes(url.hostname) ? url.href : null;
    } catch { return null; }
}


// ========================================
// POSICIONAMENTO
// ========================================

function posicionarPainel() {
    const rect = botao.style.display === "none"
        ? null
        : botao.getBoundingClientRect();
    const viewport = window.visualViewport;
    const margem = 12;
    const esquerdaVisivel = viewport?.offsetLeft || 0;
    const topoVisivel = viewport?.offsetTop || 0;
    const larguraVisivel = viewport?.width || window.innerWidth;
    const alturaVisivel = viewport?.height || window.innerHeight;

    const limitarPosicao = (elemento, larguraBase, topoDesejado, larguraMaxima, alturaMaxima) => {
        const largura = Math.max(120, Math.min(larguraMaxima, larguraVisivel - margem * 2));
        const alturaDisponivel = Math.max(80, alturaVisivel - margem * 2);

        elemento.style.setProperty("width", `${largura}px`, "important");
        elemento.style.setProperty("max-height", `${alturaDisponivel}px`, "important");
        elemento.style.overflowY = "auto";

        if (elemento === gifPainel) {
            elemento.style.setProperty(
                "height",
                `${Math.min(alturaMaxima, alturaDisponivel)}px`,
                "important"
            );
            const areaGifs = document.getElementById("kmc-gif-scroll-area");
            if (areaGifs) {
                areaGifs.style.setProperty(
                    "height",
                    `${Math.max(80, Math.min(365, alturaDisponivel - 175))}px`,
                    "important"
                );
            }
        }

        const altura = elemento.getBoundingClientRect().height || alturaMaxima;
        const esquerdaDesejada = rect
            ? rect.left - (largura - larguraBase)
            : (parseFloat(elemento.style.left) || esquerdaVisivel + margem);
        const maxEsquerda = esquerdaVisivel + larguraVisivel - largura - margem;
        const maxTopo = topoVisivel + alturaVisivel - altura - margem;
        const esquerda = Math.max(esquerdaVisivel + margem, Math.min(esquerdaDesejada, maxEsquerda));
        const topoPreferido = rect
            ? topoDesejado
            : (parseFloat(elemento.style.top) || topoVisivel + margem);
        const topo = Math.max(topoVisivel + margem, Math.min(topoPreferido, maxTopo));

        elemento.style.left = `${esquerda}px`;
        elemento.style.top = `${topo}px`;
    };

    limitarPosicao(painel, 62, rect ? rect.top - 540 : 12, 320, 420);
    limitarPosicao(gifPainel, 2, rect ? rect.top - 520 : 12, 440, 540);
}

function posicionarBotaoYoutubeKMC() {
    const area = consultarChatKMC('yt-live-chat-message-input-renderer #picker-buttons').find(visivelChatKMC) ||
        consultarChatKMC('yt-live-chat-message-input-renderer #buttons').find(visivelChatKMC);
    if (area) {
        if (botao.parentElement !== area) area.appendChild(botao);
        Object.assign(botao.style, {
            position: "relative", left: "auto", right: "auto", top: "auto", bottom: "auto",
            display: "inline-flex", verticalAlign: "middle", marginLeft: "6px", flexShrink: "0"
        });
    } else {
        if (botao.parentElement !== document.body) document.body.appendChild(botao);
        Object.assign(botao.style, {
            position: "fixed", left: "auto", right: "12px", top: "auto", bottom: "12px",
            display: "flex", marginLeft: "0"
        });
    }
}

function posicionarBotao() {
    if (E_YOUTUBE_KMC) {
        posicionarBotaoYoutubeKMC();
        return;
    }

    if (CHAT_ADAPTADO_KMC) {
        const campo = encontrarCampoAdaptadoKMC();
        if (!campo) {
            if (E_YOUTUBE_KMC) {
                // Always expose the panel in the live-chat frame, even before the editor mounts.
                botao.style.left = "auto";
                botao.style.right = "12px";
                botao.style.top = Math.max(12, window.innerHeight - 54) + "px";
                botao.style.display = "flex";
            } else botao.style.display = "none";
            return;
        }
        const container = campo.closest('.chat-input') || campo.parentElement;
        // Usa o espaço do cabeçalho, sem cobrir o editor nem o botão Enviar.
        const controles = container?.querySelectorAll('[data-a-target="chat-settings"], [data-a-target="chat-settings-button"]');
        const ancora = [...(controles || [])].find(el => el.getBoundingClientRect().width > 0);
        const rect = (ancora || campo).getBoundingClientRect();
        botao.style.left = Math.max(8, ancora ? rect.left - 40 : rect.right - 38) + "px";
        botao.style.top = Math.max(8, ancora ? rect.top : rect.top - 38) + "px";
        botao.style.right = "auto";
        botao.style.display = "flex";
        return;
    }


    const engrenagens = [
        ...document.querySelectorAll(
            'svg[data-ds-icon="Settings"]'
        )
    ];

    if (!engrenagens.length) {
        botao.style.display = "none";
        return;
    }

    const botoes =
        engrenagens
            .map(svg => svg.closest("button"))
            .filter(Boolean)
            .filter(button => {

                const rect =
                    button.getBoundingClientRect();

                return (
                    rect.width > 0 &&
                    rect.height > 0 &&
                    rect.bottom > 0 &&
                    rect.top < window.innerHeight
                );
            });

    if (!botoes.length) {
        botao.style.display = "none";
        return;
    }

    const campos = [
        ...document.querySelectorAll(SELETOR_CAMPO_EDITAVEL)
    ].filter(elemento => {

        const rect =
            elemento.getBoundingClientRect();

        if (
            rect.width === 0 ||
            rect.height === 0
        ) {
            return false;
        }

        const texto = (
            elemento.getAttribute("placeholder") || ""
        ).toLowerCase();

        return (
            texto.includes("message") ||
            texto.includes("mensagem") ||
            texto.includes("chat") ||
            elemento.isContentEditable ||
            elemento.getAttribute("role") === "textbox"
        );
    });

    let botaoEngrenagem = null;
    let campoChat = null;

    if (campos.length) {

        campoChat =
            campos.sort((a, b) => {

                const ra =
                    a.getBoundingClientRect();

                const rb =
                    b.getBoundingClientRect();

                const distanciaA =
                    Math.abs(
                        window.innerWidth - ra.right
                    ) +
                    Math.abs(
                        window.innerHeight - ra.bottom
                    );

                const distanciaB =
                    Math.abs(
                        window.innerWidth - rb.right
                    ) +
                    Math.abs(
                        window.innerHeight - rb.bottom
                    );

                return distanciaA - distanciaB;

            })[0];

        const campoRect =
            campoChat.getBoundingClientRect();

        botaoEngrenagem =
            botoes.sort((a, b) => {

                const ra =
                    a.getBoundingClientRect();

                const rb =
                    b.getBoundingClientRect();

                const distanciaA =
                    Math.abs(
                        ra.left - campoRect.right
                    ) +
                    Math.abs(
                        ra.top - campoRect.top
                    );

                const distanciaB =
                    Math.abs(
                        rb.left - campoRect.right
                    ) +
                    Math.abs(
                        rb.top - campoRect.top
                    );

                return distanciaA - distanciaB;

            })[0];

    } else {

        botaoEngrenagem =
            botoes.sort((a, b) => {

                return (
                    b.getBoundingClientRect().top -
                    a.getBoundingClientRect().top
                );

            })[0];
    }

    if (!botaoEngrenagem) {
        botao.style.display = "none";
        return;
    }

    const rect =
        botaoEngrenagem.getBoundingClientRect();

    botao.style.left =
        (rect.left - 42) + "px";

    botao.style.top =
        (rect.top + rect.height / 2 - 17) + "px";

    botao.style.right = "auto";

    botao.style.display = "flex";

    if (
        painel.style.display === "none" &&
        gifPainel.style.display === "none"
    ) {
        posicionarPainel();
    }
}


// ========================================
// PÁGINA
// ========================================

function verificarPagina() {
    if (CHAT_ADAPTADO_KMC) {
        posicionarBotao();
        if (!E_YOUTUBE_KMC && !encontrarCampoAdaptadoKMC()) {
            fecharPainelAnimado(painel);
            fecharPainelAnimado(gifPainel);
        }
        return;
    }


    const caminho =
        window.location.pathname;

    const paginaDeCanal =
        caminho !== "/" &&
        !caminho.startsWith("/categories") &&
        !caminho.startsWith("/search") &&
        !caminho.startsWith("/browse") &&
        !caminho.startsWith("/directory") &&
        !caminho.startsWith("/video");

    if (!paginaDeCanal) {

        botao.style.display = "none";
        painel.style.display = "none";
        gifPainel.style.display = "none";

        return;
    }

    posicionarBotao();
}


// ========================================
// BOTÃO
// ========================================

botao.addEventListener(
    "click",
    evento => {

        evento.stopPropagation();

        if (
            painel.style.display === "none"
        ) {

            gifPainel.style.display =
                "none";

            abrirPainelAnimado(painel);

            posicionarPainel();

        } else {

            fecharPainelAnimado(painel);
            fecharPainelAnimado(gifPainel);
        }
    }
);

painel.addEventListener(
    "click",
    evento => {
        evento.stopPropagation();
    }
);

painel.addEventListener("paste", evento => {
    const areaTransferencia = evento.clipboardData;
    if (!areaTransferencia) return;

    const itemImagem = Array.from(areaTransferencia.items || []).find(
        item => item.kind === "file" && item.type.startsWith("image/")
    );
    const arquivoImagem =
        itemImagem?.getAsFile() ||
        Array.from(areaTransferencia.files || []).find(
            arquivo => arquivo.type.startsWith("image/")
        );

    if (!arquivoImagem) return;

    evento.preventDefault();
    evento.stopPropagation();
    selecionarImagem(arquivoImagem);
}, true);

document.getElementById("kmc-close").addEventListener("click", evento => {
    evento.stopPropagation();
    fecharPainelAnimado(painel);
});

gifPainel.addEventListener(
    "click",
    evento => {
        evento.stopPropagation();
    }
);

document.getElementById("kmc-gif-close").addEventListener("click", evento => {
    evento.stopPropagation();
    fecharPainelAnimado(gifPainel);
});

const campoBuscaGifsKMC = document.getElementById("kmc-gif-query");
const resultadosGifsKMC = document.getElementById("kmc-gif-results");
const statusBuscaGifsKMC = document.getElementById("kmc-gif-status");
const botaoBuscarGifsKMC = document.getElementById("kmc-gif-search");
const botaoLimparBuscaGifsKMC = document.getElementById("kmc-gif-clear");
campoBuscaGifsKMC.addEventListener("input", () => {
    botaoLimparBuscaGifsKMC.style.display = campoBuscaGifsKMC.value ? "flex" : "none";
});
botaoLimparBuscaGifsKMC.addEventListener("click", evento => {
    evento.stopPropagation();
    campoBuscaGifsKMC.value = "";
    campoBuscaGifsKMC.dispatchEvent(new Event("input", { bubbles: true }));
    campoBuscaGifsKMC.focus();
    buscarGifsKMC();
});

function solicitarGifsKMC(consulta, populares = false) {
    const runtime = (typeof chrome !== "undefined" ? chrome.runtime : null);
    if (!runtime || typeof runtime.sendMessage !== "function") {
        return Promise.reject(new Error("Recarregue a extensão e a página do chat."));
    }

    return new Promise((resolve, reject) => {
        runtime.sendMessage({ tipo: "KMC_BUSCAR_GIFS", consulta, populares }, resposta => {
            const erro = runtime.lastError;
            if (erro) return reject(new Error("Falha ao acessar a busca de GIFs."));
            if (!resposta || !resposta.sucesso) {
                return reject(new Error(resposta && resposta.erro || "Não foi possível buscar GIFs."));
            }
            resolve(Array.isArray(resposta.gifs) ? resposta.gifs : []);
        });
    });
}

async function buscarGifsKMC() {
    if (botaoBuscarGifsKMC.disabled) return;
    const consulta = campoBuscaGifsKMC.value.trim() || "trending";
    resultadosGifsKMC.replaceChildren();

    botaoBuscarGifsKMC.disabled = true;
    statusBuscaGifsKMC.textContent = campoBuscaGifsKMC.value.trim()
        ? "Buscando GIFs…"
        : "Carregando GIFs populares…";
    try {
        const gifs = await solicitarGifsKMC(consulta, !campoBuscaGifsKMC.value.trim());
        if (!gifs.length) {
            statusBuscaGifsKMC.textContent = "Nenhum GIF encontrado.";
            return;
        }

        statusBuscaGifsKMC.textContent = campoBuscaGifsKMC.value.trim()
            ? "Clique em um GIF para preparar o envio."
            : "GIFs populares — clique em um para preparar o envio.";
        for (const gif of gifs) {
            if (!gif || typeof gif.url !== "string" || !/^https:\/\/media[0-9]*\.giphy\.com\//i.test(gif.url)) continue;
            const escolha = document.createElement("button");
            escolha.type = "button";
            escolha.title = gif.title || "Selecionar GIF";
            escolha.setAttribute("aria-label", gif.title || "Selecionar GIF");
            escolha.style.cssText = "padding:4px; cursor:pointer; min-height:100px;";

            const imagem = document.createElement("img");
            const preview = gif.preview || gif.url;
            if (!/^https:\/\/media[0-9]*\.giphy\.com\//i.test(preview)) continue;
            imagem.referrerPolicy = "no-referrer";
            imagem.src = preview;
            imagem.alt = gif.title || "GIF do GIPHY";
            imagem.loading = "lazy";
            imagem.style.cssText = "display:block; width:100%; height:100px; object-fit:cover; border-radius:5px;";
            escolha.appendChild(imagem);
            escolha.addEventListener("click", evento => {
                evento.stopPropagation();
                const campoUrl = document.getElementById("kmc-url");
                campoUrl.value = codificarCodigoGiphy(gif.id);
                campoUrl.dispatchEvent(new Event("input", { bubbles: true }));
                fecharPainelAnimado(gifPainel);
                abrirPainelAnimado(painel);
                posicionarPainel();
            });
            resultadosGifsKMC.appendChild(escolha);
        }
    } catch (erro) {
        statusBuscaGifsKMC.textContent = erro.message || "Erro ao buscar GIFs.";
    } finally {
        botaoBuscarGifsKMC.disabled = false;
    }
}

document.getElementById("kmc-open-gifs").addEventListener("click", evento => {
    evento.stopPropagation();
    fecharPainelAnimado(painel);
    abrirPainelAnimado(gifPainel);
    posicionarPainel();
    if (!resultadosGifsKMC.childElementCount) buscarGifsKMC();
    campoBuscaGifsKMC.focus();
});

botaoBuscarGifsKMC.addEventListener("click", evento => {
    evento.stopPropagation();
    buscarGifsKMC();
});

campoBuscaGifsKMC.addEventListener("keydown", evento => {
    if (evento.key === "Enter") {
        evento.preventDefault();
        buscarGifsKMC();
    }
});

document.addEventListener(
    "click",
    () => {

        if (enviandoMensagem) {
            return;
        }

        fecharPainelAnimado(painel);
        fecharPainelAnimado(gifPainel);
    }
);


// ========================================
// CONVERSÃO DE LINKS
// ========================================

function converterEnderecoParaTag(valor) {

    if (!valor) {
        return null;
    }

    valor =
        valor.trim();

    if (
        /^gph:[A-Za-z0-9_.-]+$/i.test(valor)
    ) {
        return valor;
    }

    if (
        /^tnr:[A-Za-z0-9_.-]+$/i.test(valor)
    ) {
        return valor;
    }

    if (
        /^KMCGIF_TNR_[A-Za-z0-9_.-]+$/i.test(valor)
    ) {
        return valor;
    }

    if (
        /^(?:KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF)|KMCIMG_[A-Za-z0-9_.-]+)$/i.test(valor)
    ) {
        return valor;
    }

    if (
        /^img:https%3A/i.test(valor)
    ) {
        return valor;
    }

    let resultado =
        valor.match(
            /giphy\.com\/media\/([A-Za-z0-9_-]+)(?:[/?#]|$)/i
        );

    if (resultado) {

        const id =
            resultado[1];

        const tag =
            codificarCodigoGiphy(id);

        salvarLinkOriginal(
            tag,
            valor
        );

        return tag;
    }

    resultado =
        valor.match(
            /giphy\.com\/gifs\/[^/?#]+-([A-Za-z0-9_-]+)(?:[/?#]|$)/i
        );

    if (resultado) {

        const id =
            resultado[1];

        const tag =
            codificarCodigoGiphy(id);

        salvarLinkOriginal(
            tag,
            valor
        );

        return tag;
    }

    resultado =
        valor.match(
            /(?:https?:\/\/)?(?:media|i)\.giphy\.com\/(?:media\/)?([A-Za-z0-9_-]+)(?:\/|$)/i
        );

    if (resultado) {

        const id =
            resultado[1];

        const tag =
            codificarCodigoGiphy(id);

        salvarLinkOriginal(
            tag,
            valor
        );

        return tag;
    }

    resultado =
        valor.match(
            /giphy\.com\/media\/v1\.[^/?#]+\/([A-Za-z0-9_-]+)(?:\/|$)/i
        );

    if (resultado) {

        const id =
            resultado[1];

        const tag =
            codificarCodigoGiphy(id);

        salvarLinkOriginal(
            tag,
            valor
        );

        return tag;
    }

    resultado =
        valor.match(
            /(?:https?:\/\/)?media\.tenor\.com\/([A-Za-z0-9_-]+)(?:\/|$)/i
        );

    if (resultado) {

        const id =
            resultado[1];

        const tag =
            "tnr:" + id;

        salvarLinkOriginal(
            tag,
            valor
        );

        return tag;
    }

    resultado =
        valor.match(
            /(?:https?:\/\/)?media1\.tenor\.com\/m\/([A-Za-z0-9_-]+)(?:\/|$)/i
        );

    if (resultado) {

        const id =
            resultado[1];

        const tag =
            "tnr:" + id;

        salvarLinkOriginal(
            tag,
            valor
        );

        return tag;
    }

    resultado =
        valor.match(
            /(?:https?:\/\/)?media1\.tenor\.com\/([A-Za-z0-9_-]+)(?:\/|$)/i
        );

    if (resultado) {

        const id =
            resultado[1];

        const tag =
            "tnr:" + id;

        salvarLinkOriginal(
            tag,
            valor
        );

        return tag;
    }

    resultado =
        valor.match(
            /tenor\.com\/view\/[^/?#]+-([A-Za-z0-9_-]+)(?:[/?#]|$)/i
        );

    if (resultado) {

        const tag =
            "tnr:" + resultado[1];

        salvarLinkOriginal(
            tag,
            valor
        );

        return tag;
    }

    // Links diretos do Catbox podem ser preparados como imagem/vídeo também.
    try {
        const endereco = new URL(valor);
        const extensao = endereco.pathname.match(/\.(gif|png|jpe?g|webp|avif|mp4|webm|mov)$/i);
        if (
            endereco.protocol === "https:" &&
            endereco.hostname.toLowerCase() === "files.catbox.moe" &&
            extensao
        ) {
            return "img:" + encodeURIComponent(endereco.href);
        }
    } catch (erro) {
        // A entrada ainda pode estar incompleta enquanto a pessoa digita.
    }

    return null;
}


// ========================================
// IMAGEM
// ========================================

function limparPreviewImagem() {
    if (previewImagemUrl) {
        URL.revokeObjectURL(previewImagemUrl);
        previewImagemUrl = null;
    }

    const previewMedia = document.getElementById("kmc-image-preview-media");
    if (previewMedia) {
        previewMedia.replaceChildren();
    }
    document.getElementById("kmc-image-preview").style.display = "none";
}

function atualizarPreviaMensagemKMC() {
    const preview = document.getElementById("kmc-image-preview");
    const previewMedia = document.getElementById("kmc-image-preview-media");
    const previewMensagem = document.getElementById("kmc-message-preview");
    const mensagem = document.getElementById("kmc-caption").value.trim();
    const temMidia = previewMedia.hasChildNodes();

    previewMensagem.textContent = mensagem;
    previewMensagem.style.display = mensagem && temMidia ? "block" : "none";
    preview.style.display = temMidia ? "block" : "none";
}

function limparImagemOriginalSelecionada() {
    imagemOriginalSelecionada = null;
    imagemFoiEditada = false;
}

function mostrarPreviewImagem(file) {
    if (!file || !file.type || !file.type.startsWith("image/")) {
        alert("Escolha um arquivo de imagem.");
        return false;
    }

    limparPreviewImagem();
    imagemSelecionada = file;

    const preview = document.getElementById("kmc-image-preview-media");
    const moldura = document.createElement("div");
    moldura.style.position = "relative";
    moldura.style.display = "inline-block";
    moldura.style.maxWidth = "100%";

    const img = document.createElement("img");
    previewImagemUrl = URL.createObjectURL(file);
    img.src = previewImagemUrl;
    img.style.maxWidth = "180px";
    img.style.maxHeight = "120px";
    img.style.borderRadius = "8px";
    img.style.display = "block";

    const remover = document.createElement("button");
    remover.className = "kmc-remove";
    remover.type = "button";
    remover.title = "Remover imagem selecionada";
    remover.setAttribute("aria-label", "Remover imagem selecionada");
    Object.assign(remover.style, {
        position: "absolute",
        top: "5px",
        right: "5px",
        width: "28px",
        height: "28px",
        padding: "0",
        border: "1px solid rgba(255,255,255,.35)",
        borderRadius: "50%",
        background: "rgba(20,20,22,.88)",
        color: "#fff",
        fontSize: "21px",
        lineHeight: "1",
        cursor: "pointer",
        zIndex: "1"
    });

    const iconeX = document.createElement("span");
    Object.assign(iconeX.style, {
        position: "absolute",
        inset: "0",
        pointerEvents: "none"
    });
    for (const angulo of [45, -45]) {
        const linha = document.createElement("span");
        Object.assign(linha.style, {
            position: "absolute",
            left: "50%",
            top: "50%",
            width: "12px",
            height: "2px",
            borderRadius: "2px",
            background: "#fff",
            transform: `translate(-50%, -50%) rotate(${angulo}deg)`
        });
        iconeX.appendChild(linha);
    }
    remover.appendChild(iconeX);

    remover.addEventListener("click", evento => {
        evento.preventDefault();
        evento.stopPropagation();
        imagemSelecionada = null;
        limparImagemOriginalSelecionada();
        document.getElementById("kmc-file").value = "";
        limparPreviewImagem();
    });

    const camadaCorte = document.createElement("div");
    Object.assign(camadaCorte.style, {
        position: "absolute",
        inset: "0",
        display: "none",
        overflow: "hidden",
        cursor: "crosshair",
        touchAction: "none",
        zIndex: "1"
    });

    const caixaCorte = document.createElement("div");
    Object.assign(caixaCorte.style, {
        position: "absolute",
        border: "2px solid #53fc18",
        background: "rgba(83,252,24,.16)",
        boxSizing: "border-box",
        boxShadow: "0 0 0 9999px rgba(0,0,0,.48)",
        pointerEvents: "auto",
        cursor: "move"
    });

    for (const [nome, topo, esquerda, cursor] of [
        ["nw", "0", "0", "nwse-resize"],
        ["ne", "0", "100%", "nesw-resize"],
        ["sw", "100%", "0", "nesw-resize"],
        ["se", "100%", "100%", "nwse-resize"]
    ]) {
        const alca = document.createElement("div");
        alca.dataset.canto = nome;
        Object.assign(alca.style, {
            position: "absolute",
            top: topo,
            left: esquerda,
            width: "12px",
            height: "12px",
            transform: "translate(-50%, -50%)",
            border: "2px solid #53fc18",
            borderRadius: "2px",
            boxSizing: "border-box",
            background: "#fff",
            cursor,
            pointerEvents: "auto"
        });
        caixaCorte.appendChild(alca);
    }
    camadaCorte.appendChild(caixaCorte);

    remover.style.zIndex = "2";
    moldura.append(img, camadaCorte, remover);

    const barraEdicao = document.createElement("div");
    barraEdicao.className = "kmc-edit-toolbar";

    const criarBotaoEdicao = (rotulo, dica) => {
        const botaoEdicao = document.createElement("button");
        botaoEdicao.type = "button";
        botaoEdicao.textContent = rotulo;
        botaoEdicao.title = dica;
        botaoEdicao.addEventListener("click", evento => {
            evento.preventDefault();
            evento.stopPropagation();
        });
        return botaoEdicao;
    };

    const podeEditar = ["image/png", "image/jpeg", "image/webp", "image/avif", "image/bmp"].includes(file.type);
    const girarEsquerda = criarBotaoEdicao("↶ 90°", "Girar para a esquerda");
    const girarDireita = criarBotaoEdicao("↷ 90°", "Girar para a direita");
    const botaoCorte = criarBotaoEdicao("✂ Cortar", "Selecionar uma área para cortar");
    const aplicarCorte = criarBotaoEdicao("Aplicar", "Aplicar o corte selecionado");
    const voltarOriginal = criarBotaoEdicao("↩ Voltar ao original", "Desfazer cortes e giros");
    voltarOriginal.className = "kmc-restore-image";
    voltarOriginal.textContent = "↩ Voltar ao original";
    voltarOriginal.style.display = imagemFoiEditada ? "block" : "none";
    aplicarCorte.disabled = true;

    for (const botaoEdicao of [girarEsquerda, girarDireita, botaoCorte, aplicarCorte]) {
        botaoEdicao.disabled = !podeEditar;
    }

    const orientacaoCorte = document.createElement("div");
    orientacaoCorte.textContent = podeEditar
        ? "Gire a imagem ou selecione uma área para cortar."
        : (file.type === "image/gif" ? "GIFs animados não podem ser editados sem perder a animação." : "Use PNG, JPG, WebP, AVIF ou BMP para cortar e girar.");
    Object.assign(orientacaoCorte.style, {
        marginTop: "5px",
        color: "#aaa",
        fontSize: "11px",
        lineHeight: "1.35"
    });

    barraEdicao.append(girarEsquerda, girarDireita, botaoCorte, aplicarCorte);
    preview.append(moldura, barraEdicao, voltarOriginal, orientacaoCorte);

    voltarOriginal.addEventListener("click", () => {
        if (!imagemOriginalSelecionada) return;
        imagemFoiEditada = false;
        mostrarPreviewImagem(imagemOriginalSelecionada);
    });

    girarEsquerda.addEventListener("click", async () => {
        const editada = await transformarImagemSelecionada(-90);
        if (editada) {
            imagemFoiEditada = true;
            mostrarPreviewImagem(editada);
        }
    });

    girarDireita.addEventListener("click", async () => {
        const editada = await transformarImagemSelecionada(90);
        if (editada) {
            imagemFoiEditada = true;
            mostrarPreviewImagem(editada);
        }
    });

    let pontoInicial = null;
    let recorteSelecionado = null;
    let modoArraste = "novo";
    let cantoAtivo = null;
    let retanguloInicial = null;
    const atualizarCaixaCorte = (x1, y1, x2, y2) => {
        caixaCorte.style.left = `${Math.min(x1, x2)}px`;
        caixaCorte.style.top = `${Math.min(y1, y2)}px`;
        caixaCorte.style.width = `${Math.abs(x2 - x1)}px`;
        caixaCorte.style.height = `${Math.abs(y2 - y1)}px`;
    };
    const lerRetanguloCorte = () => ({
        x: parseFloat(caixaCorte.style.left) || 0,
        y: parseFloat(caixaCorte.style.top) || 0,
        largura: parseFloat(caixaCorte.style.width) || 0,
        altura: parseFloat(caixaCorte.style.height) || 0
    });

    botaoCorte.addEventListener("click", () => {
        const iniciando = camadaCorte.style.display === "none";
        img.style.maxWidth = iniciando ? "280px" : "180px";
        img.style.maxHeight = iniciando ? "280px" : "120px";
        camadaCorte.style.display = iniciando ? "block" : "none";
        botaoCorte.textContent = iniciando ? "Cancelar" : "✂ Cortar";
        orientacaoCorte.textContent = iniciando
            ? "Arraste para marcar; ajuste pelos quadrados ou arraste dentro para mover."
            : "Gire a imagem ou selecione uma área para cortar.";
        aplicarCorte.disabled = true;
        recorteSelecionado = null;
        modoArraste = "novo";
        cantoAtivo = null;
        retanguloInicial = null;
        caixaCorte.style.left = "0px";
        caixaCorte.style.top = "0px";
        caixaCorte.style.width = "0";
        caixaCorte.style.height = "0";
        requestAnimationFrame(() => {
            if (painel.style.display !== "none") posicionarPainel();
        });
    });

    const pontoNaImagem = evento => {
        const limites = img.getBoundingClientRect();
        return {
            x: Math.max(0, Math.min(limites.width, evento.clientX - limites.left)),
            y: Math.max(0, Math.min(limites.height, evento.clientY - limites.top)),
            largura: limites.width,
            altura: limites.height
        };
    };

    camadaCorte.addEventListener("pointerdown", evento => {
        evento.preventDefault();
        evento.stopPropagation();
        pontoInicial = pontoNaImagem(evento);
        const alca = evento.target.closest?.("[data-canto]");

        if (alca && recorteSelecionado) {
            modoArraste = "redimensionar";
            cantoAtivo = alca.dataset.canto;
            retanguloInicial = lerRetanguloCorte();
        } else if (evento.target === caixaCorte && recorteSelecionado) {
            modoArraste = "mover";
            retanguloInicial = lerRetanguloCorte();
        } else {
            modoArraste = "novo";
            cantoAtivo = null;
            retanguloInicial = null;
            recorteSelecionado = null;
            aplicarCorte.disabled = true;
            atualizarCaixaCorte(pontoInicial.x, pontoInicial.y, pontoInicial.x, pontoInicial.y);
        }
        camadaCorte.setPointerCapture(evento.pointerId);
    });

    camadaCorte.addEventListener("pointermove", evento => {
        if (!pontoInicial) return;
        const ponto = pontoNaImagem(evento);

        if (modoArraste === "novo") {
            atualizarCaixaCorte(pontoInicial.x, pontoInicial.y, ponto.x, ponto.y);
            return;
        }
        if (!retanguloInicial) return;

        if (modoArraste === "mover") {
            const x = Math.max(0, Math.min(
                ponto.largura - retanguloInicial.largura,
                retanguloInicial.x + ponto.x - pontoInicial.x
            ));
            const y = Math.max(0, Math.min(
                ponto.altura - retanguloInicial.altura,
                retanguloInicial.y + ponto.y - pontoInicial.y
            ));
            atualizarCaixaCorte(x, y, x + retanguloInicial.largura, y + retanguloInicial.altura);
            return;
        }

        let { x, y, largura, altura } = retanguloInicial;
        let direita = x + largura;
        let baixo = y + altura;
        const minimo = 12;
        if (cantoAtivo.includes("w")) x = Math.max(0, Math.min(direita - minimo, ponto.x));
        if (cantoAtivo.includes("e")) direita = Math.min(ponto.largura, Math.max(x + minimo, ponto.x));
        if (cantoAtivo.includes("n")) y = Math.max(0, Math.min(baixo - minimo, ponto.y));
        if (cantoAtivo.includes("s")) baixo = Math.min(ponto.altura, Math.max(y + minimo, ponto.y));
        atualizarCaixaCorte(x, y, direita, baixo);
    });

    camadaCorte.addEventListener("pointerup", evento => {
        if (!pontoInicial) return;
        const ponto = pontoNaImagem(evento);
        if (modoArraste === "novo") {
            atualizarCaixaCorte(pontoInicial.x, pontoInicial.y, ponto.x, ponto.y);
        }
        const retangulo = lerRetanguloCorte();
        if (retangulo.largura >= 12 && retangulo.altura >= 12 && ponto.largura && ponto.altura) {
            recorteSelecionado = {
                x: retangulo.x / ponto.largura,
                y: retangulo.y / ponto.altura,
                largura: retangulo.largura / ponto.largura,
                altura: retangulo.altura / ponto.altura
            };
            aplicarCorte.disabled = false;
        }
        pontoInicial = null;
        cantoAtivo = null;
        retanguloInicial = null;
    });

    camadaCorte.addEventListener("pointercancel", () => {
        pontoInicial = null;
        cantoAtivo = null;
        retanguloInicial = null;
    });

    aplicarCorte.addEventListener("click", async () => {
        if (!recorteSelecionado) return;
        const editada = await transformarImagemSelecionada(0, recorteSelecionado);
        if (editada) {
            imagemFoiEditada = true;
            mostrarPreviewImagem(editada);
        }
    });

    atualizarPreviaMensagemKMC();
    if (painel.style.display !== "none") posicionarPainel();
    document.getElementById("kmc-url").value = "";
    document.getElementById("kmc-copy-code").style.display = "none";
    return true;
}

async function transformarImagemSelecionada(rotacao, recorte = null) {
    const arquivoOriginal = imagemSelecionada;
    if (!arquivoOriginal || !["image/png", "image/jpeg", "image/webp", "image/avif", "image/bmp"].includes(arquivoOriginal.type)) {
        return null;
    }

    try {
        const urlTemporaria = URL.createObjectURL(arquivoOriginal);
        let imagem;
        try {
            imagem = new Image();
            imagem.src = urlTemporaria;
            await imagem.decode();
        } finally {
            URL.revokeObjectURL(urlTemporaria);
        }

        const canvas = document.createElement("canvas");
        const contexto = canvas.getContext("2d");
        if (!contexto) throw new Error("Canvas indisponível");

        if (recorte) {
            const origemX = Math.round(recorte.x * imagem.naturalWidth);
            const origemY = Math.round(recorte.y * imagem.naturalHeight);
            const largura = Math.max(1, Math.round(recorte.largura * imagem.naturalWidth));
            const altura = Math.max(1, Math.round(recorte.altura * imagem.naturalHeight));
            canvas.width = Math.min(largura, imagem.naturalWidth - origemX);
            canvas.height = Math.min(altura, imagem.naturalHeight - origemY);
            contexto.drawImage(
                imagem,
                origemX,
                origemY,
                canvas.width,
                canvas.height,
                0,
                0,
                canvas.width,
                canvas.height
            );
        } else {
            const trocaLados = Math.abs(rotacao) === 90;
            canvas.width = trocaLados ? imagem.naturalHeight : imagem.naturalWidth;
            canvas.height = trocaLados ? imagem.naturalWidth : imagem.naturalHeight;
            contexto.translate(canvas.width / 2, canvas.height / 2);
            contexto.rotate((rotacao * Math.PI) / 180);
            contexto.drawImage(
                imagem,
                -imagem.naturalWidth / 2,
                -imagem.naturalHeight / 2
            );
        }

        const tipoSaida = arquivoOriginal.type === "image/jpeg" ? "image/jpeg" : "image/png";
        const blob = await new Promise(resolve =>
            canvas.toBlob(resolve, tipoSaida, tipoSaida === "image/jpeg" ? 0.92 : undefined)
        );
        if (!blob) throw new Error("Não foi possível gerar a imagem editada");
        const extensao = tipoSaida === "image/jpeg" ? "jpg" : "png";
        return new File([blob], `kickmedia-editada-${Date.now()}.${extensao}`, {
            type: tipoSaida,
            lastModified: Date.now()
        });
    } catch (erro) {
        console.error("CalvoShot - erro ao editar imagem:", erro);
        alert("Não foi possível editar essa imagem.");
        return null;
    }
}

function selecionarImagem(file) {

    if (fazendoUpload) {
        return;
    }

    imagemOriginalSelecionada = file;
    imagemFoiEditada = false;
    mostrarPreviewImagem(file);
}

document.getElementById(
    "kmc-image"
).addEventListener(
    "click",
    evento => {

        evento.stopPropagation();

        document.getElementById(
            "kmc-file"
        ).click();
    }
);

document.getElementById(
    "kmc-file"
).addEventListener(
    "change",
    evento => {

        const file =
            evento.target.files[0];

        if (file) {
            selecionarImagem(file);
        }
        evento.target.value = "";
    }
);

function atualizarLinkColado() {
    const campo = document.getElementById("kmc-url");
    const botaoCopiar = document.getElementById("kmc-copy-code");
    const valor = campo.value.trim();

    imagemSelecionada = null;
    limparImagemOriginalSelecionada();
    document.getElementById("kmc-file").value = "";
    limparPreviewImagem();

    if (!valor) {
        botaoCopiar.style.display = "none";
        return;
    }

    const tag = converterEnderecoParaTag(valor);
    if (!tag) {
        botaoCopiar.style.display = "none";
        return;
    }

    campo.value = tag;
    botaoCopiar.style.display = "block";

    let media = null;
    if (/^gph:/i.test(tag)) {
        media = criarImagemGiphy(decodificarCodigoGiphy(tag) || tag.slice(4));
    } else if (/^tnr:/i.test(tag)) {
        media = criarImagemTenor(tag.slice(4));
    } else if (/^KMCGIF_TNR_/i.test(tag)) {
        media = criarImagemTenor(tag.replace(/^KMCGIF_TNR_/i, ""));
    } else if (/^(?:KMC_|KMCIMG_)/i.test(tag)) {
        const url = decodificarCodigoImagem(tag);
        if (url) media = criarImagemEnviada(url);
    } else if (/^img:https%3A/i.test(tag)) {
        try {
            const url = decodeURIComponent(tag.slice(4));
            if (/^https:\/\/files\.catbox\.moe\//i.test(url)) {
                media = criarImagemEnviada(url);
            }
        } catch (erro) {
            media = null;
        }
    }

    if (!media) return;

    media.style.maxWidth = "180px";
    media.style.maxHeight = "120px";
    media.style.borderRadius = "8px";
    media.style.display = "block";

    const preview = document.getElementById("kmc-image-preview-media");
    preview.replaceChildren(media);
    atualizarPreviaMensagemKMC();
}

document.getElementById("kmc-url").addEventListener("input", atualizarLinkColado);
document.getElementById("kmc-caption").addEventListener("input", atualizarPreviaMensagemKMC);

document.getElementById("kmc-copy-code").addEventListener("click", async evento => {
    evento.preventDefault();
    evento.stopPropagation();

    const campo = document.getElementById("kmc-url");
    const botao = evento.currentTarget;
    const codigo = campo.value.trim();
    if (!codigo || !converterEnderecoParaTag(codigo)) return;

    let copiado = false;
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(codigo);
            copiado = true;
        }
    } catch (erro) {
        // Tenta o método compatível com navegadores que bloqueiam Clipboard API.
    }

    if (!copiado) {
        const auxiliar = document.createElement("textarea");
        auxiliar.value = codigo;
        auxiliar.style.position = "fixed";
        auxiliar.style.opacity = "0";
        document.body.appendChild(auxiliar);
        auxiliar.select();
        try {
            copiado = document.execCommand("copy");
        } catch (erro) {
            copiado = false;
        }
        auxiliar.remove();
    }

    botao.textContent = copiado ? "✅ Código copiado!" : "Não foi possível copiar";
    setTimeout(() => { botao.textContent = "📋 Copiar código"; }, 1500);
});

const areaDrop =
    document.getElementById(
        "kmc-drop"
    );

areaDrop.addEventListener(
    "click",
    evento => {

        evento.stopPropagation();

        document.getElementById(
            "kmc-file"
        ).click();
    }
);

areaDrop.addEventListener(
    "dragenter",
    evento => {

        evento.preventDefault();
        evento.stopPropagation();

        areaDrop.style.borderColor =
            "#53fc18";

        areaDrop.style.color =
            "#53fc18";
    }
);

areaDrop.addEventListener(
    "dragover",
    evento => {

        evento.preventDefault();
        evento.stopPropagation();

        areaDrop.style.borderColor =
            "#53fc18";

        areaDrop.style.color =
            "#53fc18";
    }
);

areaDrop.addEventListener(
    "dragleave",
    evento => {

        evento.preventDefault();
        evento.stopPropagation();

        areaDrop.style.borderColor =
            "#555";

        areaDrop.style.color =
            "#aaa";
    }
);

areaDrop.addEventListener(
    "drop",
    evento => {

        evento.preventDefault();
        evento.stopPropagation();

        areaDrop.style.borderColor =
            "#555";

        areaDrop.style.color =
            "#aaa";

        const arquivos =
            evento.dataTransfer.files;

        if (
            arquivos &&
            arquivos.length
        ) {

            selecionarImagem(
                arquivos[0]
            );
        }
    }
);


// ========================================
// UPLOAD PELO BACKGROUND
// ========================================

async function enviarImagemParaBackground(file) {
    erroUltimoUploadImagem = "";
    if (!file || !file.type || !file.type.startsWith("image/")) {
        erroUltimoUploadImagem = "O arquivo precisa ser uma imagem válida.";
        alert("O arquivo precisa ser uma imagem.");
        return null;
    }

    // O content.js precisa estar carregado pela extensão para acessar chrome.runtime.
    const runtime = (typeof chrome !== "undefined" ? chrome.runtime : null);
    if (!runtime || typeof runtime.sendMessage !== "function") {
        erroUltimoUploadImagem = "A extensão não conseguiu iniciar o envio. Recarregue-a e atualize a página.";
        console.error("CalvoShot: chrome.runtime indisponível. Recarregue a extensão e confirme que content.js está declarado no manifest.json.");
        alert("A extensão não conseguiu se comunicar com o processo de envio. Recarregue a extensão e a página.");
        return null;
    }

    let dadosBase64;
    try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binario = "";
        const tamanhoBloco = 0x8000;
        for (let inicio = 0; inicio < bytes.length; inicio += tamanhoBloco) {
            binario += String.fromCharCode(...bytes.subarray(inicio, inicio + tamanhoBloco));
        }
        dadosBase64 = btoa(binario);
    } catch (erro) {
        erroUltimoUploadImagem = "Não foi possível preparar a imagem.";
        console.error("CalvoShot: não foi possível preparar a imagem:", erro);
        return null;
    }

    return new Promise(resolve => {
        try {
            runtime.sendMessage(
                {
                    tipo: "KMC_UPLOAD_IMAGEM",
                    dadosBase64,
                    mime: file.type || "application/octet-stream",
                    nome: file.name || "imagem.png"
                },
                resposta => {
                    const erro = runtime.lastError;
                    if (erro) {
                        erroUltimoUploadImagem = erro.message || "Falha de comunicação com a extensão.";
                        console.error("CalvoShot: erro de comunicação:", erro.message);
                        resolve(null);
                        return;
                    }

                    if (!resposta || !resposta.sucesso || !resposta.url) {
                        erroUltimoUploadImagem = resposta && resposta.erro
                            ? resposta.erro
                            : "O serviço de hospedagem não retornou um link.";
                        console.error("CalvoShot: erro ao enviar imagem:", resposta && resposta.erro ? resposta.erro : "Sem resposta válida.");
                        resolve(null);
                        return;
                    }

                    resolve(resposta.url);
                }
            );
        } catch (erro) {
            erroUltimoUploadImagem = erro && erro.message
                ? erro.message
                : "Falha de comunicação com o serviço de hospedagem.";
            console.error("CalvoShot: falha ao chamar o processo de envio:", erro);
            resolve(null);
        }
    });
}


// ========================================
// CAMPO DO CHAT
// ========================================

function encontrarCampoChat() {
    if (CHAT_ADAPTADO_KMC) return encontrarCampoAdaptadoKMC();


    const campos = [
        ...document.querySelectorAll(SELETOR_CAMPO_EDITAVEL)
    ].filter(elemento => {

        const rect =
            elemento.getBoundingClientRect();

        if (
            rect.width === 0 ||
            rect.height === 0
        ) {
            return false;
        }

        const texto = (
            elemento.getAttribute(
                "placeholder"
            ) || ""
        ).toLowerCase();

        return (
            texto.includes("message") ||
            texto.includes("mensagem") ||
            texto.includes("chat") ||
            elemento.isContentEditable ||
            elemento.getAttribute("role") === "textbox"
        );
    });

    if (!campos.length) {
        return null;
    }

    return campos.sort((a, b) => {

        const ra =
            a.getBoundingClientRect();

        const rb =
            b.getBoundingClientRect();

        const distanciaA =
            Math.abs(
                window.innerWidth - ra.right
            ) +
            Math.abs(
                window.innerHeight - ra.bottom
            );

        const distanciaB =
            Math.abs(
                window.innerWidth - rb.right
            ) +
            Math.abs(
                window.innerHeight - rb.bottom
            );

        return distanciaA - distanciaB;

    })[0];
}

// Mantém marcado o editor real da Kick. O leitor de códigos deve ignorar
// qualquer conteúdo digitado ou colado dentro da caixa de mensagem.
function marcarCampoChatKMC() {
    const campo = encontrarCampoChat();

    if (campo) {
        campo.setAttribute("data-kmc-chat-input", "true");
    }

    const ativo = document.activeElement;
    if (ativo instanceof Element) {
        const campoAtivo = ativo.closest(SELETOR_CAMPO_EDITAVEL);
        if (campoAtivo) campoAtivo.setAttribute("data-kmc-chat-input", "true");
    }

    return campo;
}

function estaDentroDoCampoChatKMC(elemento) {
    if (!elemento || elemento.nodeType !== Node.ELEMENT_NODE) {
        return false;
    }

    if (
        elemento.closest('[data-kmc-chat-input="true"]') ||
        elemento.matches(SELETOR_CAMPO_EDITAVEL) ||
        elemento.closest(SELETOR_CAMPO_EDITAVEL)
    ) {
        return true;
    }

    return false;
}

// Se o mesmo código ainda está escrito em uma caixa editável, ele ainda não
// foi enviado. Isso evita converter a prévia do texto colado no compositor.
function codigoAindaEstaSendoDigitadoKMC(codigo) {
    const procurado = String(codigo || "").trim();
    if (!procurado) return false;

    const chave = procurado.toLowerCase();
    const expiraEm = codigosColadosRecentementeKMC.get(chave);
    const aindaNoEditor = [...document.querySelectorAll(SELETOR_CAMPO_EDITAVEL)].some(campo => {
        const conteudo = campo.value ?? campo.innerText ?? campo.textContent ?? "";
        return String(conteudo).includes(procurado);
    });

    if (expiraEm === Infinity) {
        // Só libera depois de detectar Enter, envio do formulário ou clique
        // em Enviar. Assim, esperar ou tirar o foco não libera o GIF.
        return true;
    }

    if (expiraEm && expiraEm > Date.now()) return true;
    if (expiraEm) codigosColadosRecentementeKMC.delete(chave);

    return aindaNoEditor;
}


// ========================================
// COLOCAR TEXTO PURO
// ========================================

function colocarTextoNoCampo(
    campo,
    mensagem
) {
    campo.focus();
    const texto = String(mensagem);

    if (campo.tagName === "TEXTAREA" || campo.tagName === "INPUT") {
        const prototype = campo.tagName === "TEXTAREA"
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");

        if (descriptor && descriptor.set) {
            descriptor.set.call(campo, texto);
        } else {
            campo.value = texto;
        }

        campo.dispatchEvent(new Event("input", { bubbles: true }));
        return;
    }

    const selecao = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(campo);

    if (selecao) {
        selecao.removeAllRanges();
        selecao.addRange(range);
    }

    // insertText já dispara o evento input no contenteditable.
    // Um segundo InputEvent repetia a tag enviada na Kick.
    document.execCommand("insertText", false, texto);
}


// ========================================
// ENVIAR SOMENTE TEXTO
// ========================================

function enviarMensagemChat(
    mensagem
) {
    if (CHAT_ADAPTADO_KMC) return enviarMensagemAdaptadaKMC(mensagem);

    return new Promise(resolve => {

        const campo =
            encontrarCampoChat();

        if (!campo) {

            alert(
                "Não encontrei a caixa de mensagem do chat."
            );

            resolve(false);
            return;
        }

        const texto =
            String(mensagem);

        colocarTextoNoCampo(campo, texto);

        setTimeout(() => {

            campo.focus();

            // IMPORTANTE:
            // Enviamos SOMENTE keydown.
            // O keyup antigo podia fazer a Kick
            // interpretar a mensagem duas vezes.

            const eventoEnter =
                new KeyboardEvent(
                    "keydown",
                    {
                        key: "Enter",
                        code: "Enter",
                        keyCode: 13,
                        which: 13,
                        bubbles: true,
                        cancelable: true
                    }
                );

            campo.dispatchEvent(eventoEnter);

            setTimeout(() => {

                resolve(true);

            }, 700);

        }, 300);
    });
}


// ========================================
// ENVIAR
// ========================================

document.getElementById(
    "kmc-send"
).addEventListener(
    "click",
    async evento => {

        evento.stopPropagation();

        if (
            enviandoMensagem ||
            fazendoUpload
        ) {
            return;
        }

        const campoUrl =
            document.getElementById(
                "kmc-url"
            );

        let valor =
            campoUrl.value.trim();

        if (imagemSelecionada) {

            fazendoUpload =
                true;

            const botaoEnviar =
                document.getElementById(
                    "kmc-send"
                );

            botaoEnviar.disabled =
                true;

            botaoEnviar.textContent =
                "⏳ Enviando imagem...";

            try {

                const url =
                    await enviarImagemParaBackground(
                        imagemSelecionada
                    );

                if (!url) {

                    alert(
                        "Não foi possível enviar a imagem." +
                        (erroUltimoUploadImagem ? "\n" + erroUltimoUploadImagem : "")
                    );

                    botaoEnviar.disabled =
                        false;

                    botaoEnviar.textContent =
                        "📤 Enviar";

                    fazendoUpload =
                        false;

                    return;
                }

                const codigo =
                    codificarImagem(url);

                if (!codigo) {

                    alert(
                        "Não foi possível preparar a imagem."
                    );

                    botaoEnviar.disabled =
                        false;

                    botaoEnviar.textContent =
                        "📤 Enviar";

                    fazendoUpload =
                        false;

                    return;
                }

                valor = codigo;
                campoUrl.value = valor;
                document.getElementById("kmc-copy-code").style.display = "block";

                imagemSelecionada =
                    null;
                limparImagemOriginalSelecionada();

                limparPreviewImagem();
                const arquivo =
                    document.getElementById(
                        "kmc-file"
                    );

                arquivo.value = "";

            } catch (erro) {

                console.error(
                    "CalvoShot - erro ao enviar imagem:",
                    erro
                );

                alert(
                    "Erro ao enviar a imagem."
                );

                botaoEnviar.disabled =
                    false;

                botaoEnviar.textContent =
                    "📤 Enviar";

                fazendoUpload =
                    false;

                return;
            }

            fazendoUpload =
                false;
        }

        if (!valor) {

            alert(
                "Escolha um GIF, imagem ou cole um link primeiro!"
            );

            return;
        }

        let mensagem = null;
        const tag = converterEnderecoParaTag(valor);
        if (tag) mensagem = tag;

        if (!mensagem) {

            alert(
                "Selecione um GIF, imagem ou cole um link válido."
            );

            return;
        }

        mensagem = montarMensagemComMidia(
            document.getElementById("kmc-caption").value,
            mensagem
        );

        enviandoMensagem =
            true;

        const botaoEnviar =
            document.getElementById(
                "kmc-send"
            );

        botaoEnviar.disabled =
            true;

        botaoEnviar.textContent =
            "⏳ Enviando...";

        const enviado =
            await enviarMensagemChat(
                mensagem
            );

        if (enviado) {

            setTimeout(() => {

                campoUrl.value =
                    "";
                document.getElementById("kmc-caption").value = "";
                document.getElementById("kmc-copy-code").style.display = "none";

                imagemSelecionada =
                    null;
                limparImagemOriginalSelecionada();

                document.getElementById(
                    "kmc-file"
                ).value = "";

                limparPreviewImagem();

                fecharPainelAnimado(painel);
                fecharPainelAnimado(gifPainel);

                botaoEnviar.disabled =
                    false;

                botaoEnviar.textContent =
                    "📤 Enviar";

                enviandoMensagem =
                    false;

            }, 200);

        } else {

            botaoEnviar.disabled =
                false;

            botaoEnviar.textContent =
                "📤 Enviar";

            enviandoMensagem =
                false;
        }
    }
);


// ========================================
// GIPHY
// ========================================

function abrirMidiaAmpliadaKMC(midia) {
    if (!midia || !midia.src) return;

    let visualizador = document.getElementById("kmc-media-viewer");
    if (!visualizador) {
        visualizador = document.createElement("div");
        visualizador.id = "kmc-media-viewer";
        Object.assign(visualizador.style, {
            position: "fixed",
            inset: "0",
            zIndex: "2147483647",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            boxSizing: "border-box",
            background: "rgba(0, 0, 0, 0.88)",
            cursor: "zoom-out"
        });

        visualizador.addEventListener("click", () => visualizador.remove());
        document.body.appendChild(visualizador);
    }

    visualizador.replaceChildren();
    const ampliada = document.createElement("img");
    ampliada.src = midia.currentSrc || midia.src;
    ampliada.alt = midia.alt || "Imagem ampliada";
    Object.assign(ampliada.style, {
        display: "block",
        maxWidth: "min(96vw, 1400px)",
        maxHeight: "92vh",
        objectFit: "contain",
        borderRadius: "8px",
        cursor: "zoom-out"
    });
    ampliada.addEventListener("click", evento => {
        evento.stopPropagation();
        visualizador.remove();
    });
    visualizador.appendChild(ampliada);
}

document.addEventListener("keydown", evento => {
    if (evento.key === "Escape") {
        document.getElementById("kmc-media-viewer")?.remove();
    }
});

document.addEventListener("click", evento => {
    const midia = evento.target.closest?.('img[data-kmc-media="true"]');
    if (!midia || midia.closest("#kmc-panel, #kmc-gif-panel, #kmc-media-viewer")) return;
    evento.preventDefault();
    evento.stopPropagation();
    abrirMidiaAmpliadaKMC(midia);
}, true);

function prepararCliqueParaAmpliarKMC(imagem) {
    imagem.style.cursor = "zoom-in";
    imagem.title = "Clique para ampliar";
    return imagem;
}

const consultasGiphyPendentesKMC = new Map();
function criarImagemGiphy(id) {
    const imagem = document.createElement("img");
    imagem.dataset.kmcMedia = "true";
    imagem.alt = "Carregando GIF…";
    imagem.referrerPolicy = "no-referrer";
    imagem.style.cssText = "max-width:220px;max-height:220px;border-radius:8px;display:block";
    if (!consultasGiphyPendentesKMC.has(id)) {
        const consulta = new Promise(resolve => {
            chrome.runtime.sendMessage({ tipo: "KMC_OBTER_GIF", id }, resposta => {
                if (chrome.runtime.lastError) resolve(null);
                else resolve(resposta?.sucesso ? resposta.gif : null);
            });
        }).finally(() => consultasGiphyPendentesKMC.delete(id));
        consultasGiphyPendentesKMC.set(id, consulta);
    }
    consultasGiphyPendentesKMC.get(id).then(gif => {
        if (!gif || !/^https:\/\/media[0-9]*\.giphy\.com\//i.test(gif.url)) {
            imagem.alt = "GIF indisponível — tente recarregar mais tarde";
            return;
        }
        imagem.src = gif.url;
    });
    return prepararCliqueParaAmpliarKMC(imagem);
}

function criarImagemTenor(id) {

    const imagem =
        document.createElement("img");

    imagem.dataset.kmcMedia =
        "true";

    const tag =
        "tnr:" + id;

    const linkOriginal =
        obterLinkOriginal(tag) || obterLinkOriginal("KMCGIF_TNR_" + id);

    if (linkOriginal) {

        let url =
            linkOriginal;

        const convertido =
            url.match(
                /media1\.tenor\.com\/m\/([A-Za-z0-9_-]+)(?:\/[^/?#]+)?/i
            );

        if (convertido) {

            url =
                "https://media.tenor.com/" +
                convertido[1] +
                "/tenor.gif";
        }

        imagem.src =
            url;

    } else {

        imagem.src =
            "https://media.tenor.com/" +
            encodeURIComponent(id) +
            "/tenor.gif";
    }

    imagem.alt =
        "GIF";

    imagem.style.maxWidth =
        "220px";

    imagem.style.maxHeight =
        "220px";

    imagem.style.borderRadius =
        "8px";

    imagem.style.display =
        "block";

    imagem.onerror =
        () => {

            const alternativa =
                "https://c.tenor.com/" +
                encodeURIComponent(id) +
                "/tenor.gif";

            if (
                imagem.src !==
                alternativa
            ) {

                imagem.src =
                    alternativa;
            }
        };

    return prepararCliqueParaAmpliarKMC(imagem);
}


// ========================================
// IMAGEM ENVIADA
// ========================================

function criarImagemEnviada(url) {

    const urlLimpa =
        String(url).split("?")[0].toLowerCase();

    // Se for vídeo, cria vídeo.
    if (
        urlLimpa.endsWith(".mp4") ||
        urlLimpa.endsWith(".webm") ||
        urlLimpa.endsWith(".mov")
    ) {

        const video =
            document.createElement("video");

        video.dataset.kmcMedia =
            "true";

        video.src =
            url;

        video.controls =
            true;

        video.autoplay =
            false;

        video.loop =
            true;

        video.muted =
            true;

        video.style.maxWidth =
            "220px";

        video.style.maxHeight =
            "220px";

        video.style.borderRadius =
            "8px";

        video.style.display =
            "block";

        return video;
    }

    const imagem =
        document.createElement("img");

    imagem.dataset.kmcMedia =
        "true";

    imagem.src =
        url;

    imagem.alt =
        "Imagem";

    imagem.style.maxWidth =
        "220px";

    imagem.style.maxHeight =
        "220px";

    imagem.style.borderRadius =
        "8px";

    imagem.style.display =
        "block";

    return prepararCliqueParaAmpliarKMC(imagem);
}


// ========================================
// PROCESSAR KMCIMG
// ========================================

function encontrarNomeUsuarioDaMensagemKMC(elemento) {
    let contexto = elemento?.parentElement || null;
    const padraoNome = /^(?!\d+$)[A-Za-z0-9_-]{2,32}:?$/;

    for (let nivel = 0; contexto && nivel < 5; nivel++, contexto = contexto.parentElement) {
        const candidatos = [...contexto.querySelectorAll("span, a, strong, b, div")]
            .filter(candidato => {
                const nome = (candidato.textContent || "").trim().replace(/:$/, "");
                const estilo = getComputedStyle(candidato);
                return padraoNome.test(nome) &&
                    candidato.getClientRects().length > 0 &&
                    estilo.display !== "none" &&
                    estilo.visibility !== "hidden";
            })
            .sort((a, b) => a.contains(b) ? 1 : b.contains(a) ? -1 : 0);

        for (const candidato of candidatos) {
            if (candidato === elemento || candidato.contains(elemento) || elemento.contains(candidato)) {
                continue;
            }
            return candidato;
        }
    }

    return null;
}

function carregarMidiasBloqueadasKMC() {
    try {
        const salvas = JSON.parse(localStorage.getItem("kmc_midias_bloqueadas") || "[]");
        return Array.isArray(salvas) ? salvas.filter(item => typeof item === "string") : [];
    } catch (erro) {
        return [];
    }
}

let midiasBloqueadasKMC = carregarMidiasBloqueadasKMC();

function normalizarChaveMidiaKMC(codigo) {
    return String(codigo || "").trim().toLowerCase();
}

function salvarMidiasBloqueadasKMC() {
    try {
        localStorage.setItem("kmc_midias_bloqueadas", JSON.stringify(midiasBloqueadasKMC));
    } catch (erro) {
        console.warn("CalvoShot: não foi possível salvar as mídias bloqueadas.", erro);
    }
}

function criarBotaoBloqueioKMC(texto, titulo, aoClicar) {
    const botao = document.createElement("button");
    botao.type = "button";
    botao.textContent = texto;
    botao.title = titulo;
    botao.setAttribute("aria-label", titulo);
    Object.assign(botao.style, {
        flex: "0 0 auto",
        padding: "2px 5px",
        border: "0",
        borderRadius: "4px",
        background: "transparent",
        color: "#b9b9b9",
        fontSize: "13px",
        lineHeight: "1.2",
        cursor: "pointer"
    });
    botao.addEventListener("click", evento => {
        evento.preventDefault();
        evento.stopPropagation();
        aoClicar();
    });
    return botao;
}

function renderizarCodigoComMidia(elemento, codigo, url, midia, clicavel = true, legenda = "") {
    const legendaAntes = typeof legenda === "string" ? legenda : legenda.antes;
    const legendaDepois = typeof legenda === "string" ? "" : legenda.depois;
    const chaveBloqueio = normalizarChaveMidiaKMC(codigo);
    const bloco = document.createElement("div");
    bloco.dataset.kmcMedia = "true";
    Object.assign(bloco.style, {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "4px"
    });

    if (midiasBloqueadasKMC.includes(chaveBloqueio)) {
        const aviso = document.createElement("span");
        aviso.textContent = "🚫 Mídia bloqueada";
        const botaoDesbloquear = criarBotaoBloqueioKMC("Desbloquear", "Desbloquear esta imagem ou GIF", () => {
            midiasBloqueadasKMC = midiasBloqueadasKMC.filter(item => item !== chaveBloqueio);
            salvarMidiasBloqueadasKMC();
            renderizarCodigoComMidia(elemento, codigo, url, midia, clicavel, legenda);
        });
        bloco.append(aviso, botaoDesbloquear);
        elemento.dataset.kmcProcessed = "true";
        elemento.replaceChildren(bloco);
        return;
    }

    const linkCodigo = document.createElement("span");
    linkCodigo.textContent = codigo;
    Object.assign(linkCodigo.style, {
        display: "inline-block",
        maxWidth: "100%",
        color: clicavel ? "#53fc18" : "#f1f1f1",
        fontSize: "11px",
        lineHeight: "1.4",
        textDecoration: clicavel ? "underline" : "none",
        overflowWrap: "anywhere",
        cursor: clicavel ? "pointer" : "text",
        userSelect: "text"
    });

    if (clicavel) {
        linkCodigo.setAttribute("role", "link");
        linkCodigo.tabIndex = 0;
        linkCodigo.title = "Abrir arquivo original";
        linkCodigo.addEventListener("click", evento => {
            evento.preventDefault();
            evento.stopPropagation();
            window.open(url, "_blank", "noopener,noreferrer");
        });
        linkCodigo.addEventListener("keydown", evento => {
            if (evento.key === "Enter" || evento.key === " ") {
                evento.preventDefault();
                window.open(url, "_blank", "noopener,noreferrer");
            }
        });
    } else {
        linkCodigo.addEventListener("copy", evento => {
            evento.preventDefault();
            evento.clipboardData?.setData("text/plain", codigo);
        });
    }

    if (legendaAntes) {
        const textoLegenda = document.createElement("div");
        textoLegenda.textContent = legendaAntes;
        Object.assign(textoLegenda.style, {
            maxWidth: "100%",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            color: "inherit"
        });
        bloco.append(textoLegenda);
    }

    const linhaCodigo = document.createElement("div");
    Object.assign(linhaCodigo.style, {
        display: "flex",
        alignItems: "center",
        gap: "5px",
        maxWidth: "100%"
    });
    const botaoBloquear = criarBotaoBloqueioKMC("🚫", "Bloquear esta imagem ou GIF", () => {
        if (!midiasBloqueadasKMC.includes(chaveBloqueio)) {
            midiasBloqueadasKMC.push(chaveBloqueio);
            salvarMidiasBloqueadasKMC();
        }
        renderizarCodigoComMidia(elemento, codigo, url, midia, clicavel, legenda);
    });
    linhaCodigo.append(linkCodigo, botaoBloquear);
    bloco.append(linhaCodigo, midia);

    if (legendaDepois) {
        const textoLegendaDepois = document.createElement("div");
        textoLegendaDepois.textContent = legendaDepois;
        Object.assign(textoLegendaDepois.style, {
            maxWidth: "100%",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            color: "inherit"
        });
        bloco.append(textoLegendaDepois);
    }

    elemento.dataset.kmcProcessed = "true";
    elemento.replaceChildren(bloco);
}

function processarCodigoKMC(
    elemento,
    texto,
    legenda = ""
) {

    if (
        !elemento ||
        !texto
    ) {
        return false;
    }

    const encontrado =
        texto.match(
            /(KMCIMG_[A-Za-z0-9_.-]+|KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF))/i
        );

    if (!encontrado) {
        return false;
    }

    const url =
        decodificarCodigoImagem(encontrado[0]);

    if (
        !url ||
        !/^https:\/\/files\.catbox\.moe\//i.test(
            url
        )
    ) {
        return false;
    }

    if (
        elemento.dataset &&
        elemento.dataset.kmcProcessed === "true"
    ) {
        return true;
    }

    const media =
        criarImagemEnviada(url);

    renderizarCodigoComMidia(elemento, encontrado[0], url, media, true, legenda);

    return true;
}


// ========================================
// PROCESSAR MENSAGEM
// ========================================

function processarElementoGif(elemento) {
    if (CHAT_ADAPTADO_KMC && (!elemento || !mensagemAdaptadaKMC(elemento))) return false;
    // YouTube reuses #message and replaces its children after optimistic sends.
    // The dataset flag survives that replacement, but the rendered media does not.
    if (E_YOUTUBE_KMC && elemento?.dataset?.kmcProcessed === "true" &&
        !elemento.querySelector('[data-kmc-media="true"]')) {
        delete elemento.dataset.kmcProcessed;
    }



    if (codigoColadoAguardandoEnvioKMC) {
        return false;
    }

    if (
        !elemento ||
        elemento.nodeType !== 1
    ) {
        return false;
    }

    if (
        elemento.dataset &&
        elemento.dataset.kmcProcessed ===
            "true"
    ) {
        return false;
    }

    if (
        elemento.dataset &&
        elemento.dataset.kmcMedia ===
            "true"
    ) {
        return false;
    }

    if (
        elemento.closest &&
        elemento.closest('[data-kmc-media="true"]')
    ) {
        return false;
    }

    if (
        elemento.closest &&
        elemento.closest(
            "#kmc-button, #kmc-panel, #kmc-gif-panel"
        )
    ) {
        return false;
    }

    if (
        elemento.matches &&
        elemento.matches(SELETOR_CAMPO_EDITAVEL)
    ) {
        return false;
    }

    if (
        elemento.closest &&
        elemento.closest(SELETOR_CAMPO_EDITAVEL)
    ) {
        return false;
    }

    if (estaDentroDoCampoChatKMC(elemento)) {
        return false;
    }

    if (
        elemento.querySelector &&
        elemento.querySelector(
            "img, video, picture, source"
        )
    ) {
        return false;
    }

    let texto =
        (elemento.textContent || "")
            .trim();

    let legenda = { antes: "", depois: "" };

    // A legenda só pode ser lida no span do conteúdo da mensagem da Kick.
    // Em divs maiores o texto também contém o nome do usuário e outras mensagens.
    const podeTerLegenda = CHAT_ADAPTADO_KMC ? mensagemAdaptadaKMC(elemento) : elemento.tagName === "SPAN" && elemento.classList.contains("font-normal");
    const mensagemComMidia = podeTerLegenda ? separarMensagemComMidia(texto) : null;
    if (mensagemComMidia) {
        legenda = { antes: mensagemComMidia.antes, depois: mensagemComMidia.depois };
        texto = mensagemComMidia.codigo;
    }

    if (!texto) {
        return false;
    }

    if (
        /^(?:KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF)|KMCIMG_[A-Za-z0-9_.-]+|KMCGIF_TNR_[A-Za-z0-9_.-]+|gph:[A-Za-z0-9_.-]+|tnr:[A-Za-z0-9_.-]+|img:https%3A%2F%2F.+)$/i.test(texto) &&
        codigoAindaEstaSendoDigitadoKMC(texto)
    ) {
        return false;
    }


    // ====================================
    // KMCIMG
    // ====================================

    if (
        /^(?:KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF)|KMCIMG_[A-Za-z0-9_.-]+)$/i.test(texto)
    ) {

        return processarCodigoKMC(
            elemento,
            texto,
            legenda
        );
    }

    const codigoTenorNovo = texto.match(/^KMCGIF_TNR_([A-Za-z0-9_.-]+)$/i);
    if (codigoTenorNovo) {
        const id = codigoTenorNovo[1];
        const imagem = criarImagemTenor(id);
        renderizarCodigoComMidia(elemento, "tnr:" + id, imagem.src, imagem, true, legenda);
        return true;
    }


    // ====================================
    // GIPHY
    // ====================================

    const idGiphy = decodificarCodigoGiphy(texto);

    if (idGiphy) {

        const imagem =
            criarImagemGiphy(idGiphy);

        renderizarCodigoComMidia(elemento, texto, "https://giphy.com/gifs/" + encodeURIComponent(idGiphy), imagem, true, legenda);

        return true;
    }


    // ====================================
    // TENOR
    // ====================================

    let resultado =
        texto.match(
            /^tnr:([A-Za-z0-9_.-]+)$/
        );

    if (resultado) {

        const id =
            resultado[1];

        const imagem =
            criarImagemTenor(id);

        renderizarCodigoComMidia(elemento, "tnr:" + id, imagem.src, imagem, true, legenda);

        return true;
    }


    // ====================================
    // COMPATIBILIDADE ANTIGA
    // ====================================

    resultado =
        texto.match(
            /^img:(https%3A%2F%2F.+)$/i
        );

    if (resultado) {

        const url =
            decodeURIComponent(
                resultado[1]
            );

        if (
            !/^https:\/\/files\.catbox\.moe\//i.test(
                url
            )
        ) {
            return false;
        }

        const imagem =
            criarImagemEnviada(
                url
            );

        renderizarCodigoComMidia(elemento, "img:" + resultado[1], url, imagem, true, legenda);

        return true;
    }

    return false;
}


// ========================================
// PROCURAR DENTRO
// ========================================

function procurarGifDentroElemento(
    elemento
) {

    if (codigoColadoAguardandoEnvioKMC) {
        return;
    }

    if (
        !elemento ||
        elemento.nodeType !== 1
    ) {
        return;
    }

    if (
        elemento.closest &&
        elemento.closest(
            "#kmc-button, #kmc-panel, #kmc-gif-panel"
        )
    ) {
        return;
    }

    if (
        elemento.closest &&
        elemento.closest('[data-kmc-media="true"]')
    ) {
        return;
    }

    if (
        elemento.matches?.(SELETOR_CAMPO_EDITAVEL) ||
        elemento.closest?.(SELETOR_CAMPO_EDITAVEL)
    ) {
        return;
    }

    if (estaDentroDoCampoChatKMC(elemento)) {
        return;
    }

    if (
        processarElementoGif(
            elemento
        )
    ) {
        return;
    }

    const filhos =
        elemento.querySelectorAll
            ? elemento.querySelectorAll(
                CHAT_ADAPTADO_KMC ? seletorMensagemAdaptadaKMC() : "span, p, div"
            )
            : [];

    for (
        const filho of filhos
    ) {

        if (
            processarElementoGif(
                filho
            )
        ) {
            return;
        }
    }

    // Na Twitch e no YouTube, o processamento fica restrito ao conteúdo das mensagens.
    if (CHAT_ADAPTADO_KMC) return;

    // Procura também diretamente nos textos.
    // Isso resolve quando a Kick separa o KMCIMG
    // em nós de texto diferentes.

    const walker =
        document.createTreeWalker(
            elemento,
            NodeFilter.SHOW_TEXT
        );

    const textos = [];

    let no;

    while (
        (no = walker.nextNode())
    ) {

        if (
            no.parentElement &&
            no.parentElement.closest &&
            (no.parentElement.closest("#kmc-button, #kmc-panel, #kmc-gif-panel") ||
                no.parentElement.closest('[data-kmc-media="true"]') ||
                no.parentElement.closest(SELETOR_CAMPO_EDITAVEL) ||
                no.parentElement.closest('[data-kmc-chat-input="true"]'))
        ) {
            continue;
        }

        const texto =
            (no.nodeValue || "").trim();

        if (
            /^(?:KMC_[A-Za-z0-9_.-]+[._](?:IMG|GIF)|KMCIMG_[A-Za-z0-9_.-]+|KMCGIF_TNR_[A-Za-z0-9_.-]+)$/i.test(
                texto
            )
        ) {
            if (codigoAindaEstaSendoDigitadoKMC(texto)) {
                continue;
            }
            textos.push(no);
        }
    }

    for (
        const textoNode of textos
    ) {

        const codigo =
            textoNode.nodeValue.trim();

        if (/^KMCGIF_TNR_/i.test(codigo)) {
            const pai = textoNode.parentElement;
            if (pai && pai.dataset.kmcProcessed !== "true") {
                const id = codigo.replace(/^KMCGIF_TNR_/i, "");
                const imagem = criarImagemTenor(id);
                renderizarCodigoComMidia(pai, "tnr:" + id, imagem.src, imagem, true);
            }
            continue;
        }

        const url =
            decodificarCodigoImagem(codigo);

        if (
            !url ||
            !/^https:\/\/files\.catbox\.moe\//i.test(
                url
            )
        ) {
            continue;
        }

        const pai =
            textoNode.parentElement;

        if (
            !pai ||
            pai.dataset.kmcProcessed ===
                "true"
        ) {
            continue;
        }

        renderizarCodigoComMidia(
            pai,
            codigo,
            url,
            criarImagemEnviada(url)
        );
    }
}


// ========================================
// OBSERVADOR
// ========================================

const observadorChat =
    new MutationObserver(
        mutations => {

            marcarCampoChatKMC();

            for (
                const mutation of mutations
            ) {

                // A removal or replacement may have no added element nodes.
                // Reconcile the enclosing message, not only its inserted descendants.
                if (E_YOUTUBE_KMC) {
                    const alvo = mutation.target.nodeType === Node.ELEMENT_NODE
                        ? mutation.target : mutation.target.parentElement;
                    const mensagem = alvo?.closest?.(SELETOR_MENSAGEM_YOUTUBE_KMC);
                    if (mensagem) processarElementoGif(mensagem);
                }

                const novosNos = mutation.type === "childList"
                    ? [...mutation.addedNodes]
                    : mutation.type === "characterData" && mutation.target.parentElement
                        ? [mutation.target.parentElement]
                        : [];

                for (const noAdicionado of novosNos) {
                    const node = noAdicionado.nodeType === Node.TEXT_NODE
                        ? noAdicionado.parentElement
                        : noAdicionado;

                    if (
                        !node ||
                        node.nodeType !== Node.ELEMENT_NODE
                    ) {
                        continue;
                    }

                    if (
                        node.dataset &&
                        (
                            node.dataset.kmcMedia ===
                                "true" ||
                            node.id ===
                                "kmc-button" ||
                            node.id ===
                                "kmc-panel" ||
                            node.id ===
                                "kmc-gif-panel"
                        )
                    ) {
                        continue;
                    }

                    const liberouAposEnvio = liberarProtecaoAoDetectarMensagemKMC(node);
                    procurarGifDentroElemento(
                        node
                    );

                    if (liberouAposEnvio) {
                        // A Kick pode recriar a linha logo após inseri-la.
                        // Revarre quando o chat terminar essa atualização.
                        agendarBuscaDeMidiaDepoisDoEnvioKMC();
                    }
                }
            }
        }
    );

observadorChat.observe(
    document.body,
    {
        childList: true,
        characterData: true,
        subtree: true
    }
);


// ========================================
// BUSCA DE SEGURANÇA
// ========================================

function procurarGifsNoChat() {

    reconciliarProtecaoDeCodigoColadoKMC();
    if (codigoColadoAguardandoEnvioKMC) {
        return;
    }

    marcarCampoChatKMC();

    if (enviandoMensagem) {
        return;
    }

    const elementos =
        (E_YOUTUBE_KMC ? consultarChatKMC(seletorMensagemAdaptadaKMC()) : document.querySelectorAll(
            CHAT_ADAPTADO_KMC ? seletorMensagemAdaptadaKMC() : "span, p, div"
        ));

    for (
        const elemento of elementos
    ) {

        if (
            elemento.dataset &&
            elemento.dataset.kmcMedia ===
                "true"
        ) {
            continue;
        }

        processarElementoGif(
            elemento
        );
    }
}


// ========================================
// LOOP
// ========================================

let ultimaPagina =
    window.location.href;

setInterval(() => {

    verificarPagina();

    procurarGifsNoChat();

    if (
        window.location.href !==
        ultimaPagina
    ) {

        ultimaPagina =
            window.location.href;

        fecharPainelAnimado(painel);
        fecharPainelAnimado(gifPainel);

        imagemSelecionada =
            null;
        limparImagemOriginalSelecionada();
        limparPreviewImagem();

        enviandoMensagem =
            false;
    }

}, 1500);


// ========================================
// RESIZE
// ========================================

let quadroReposicionamento = 0;
function reposicionarPainelVisivel() {
    if (quadroReposicionamento) return;
    quadroReposicionamento = requestAnimationFrame(() => {
        quadroReposicionamento = 0;
        posicionarBotao();
        if (
            painel.style.display !== "none" ||
            gifPainel.style.display !== "none"
        ) {
            posicionarPainel();
        }
    });
}

window.addEventListener("resize", reposicionarPainelVisivel);
window.addEventListener("scroll", reposicionarPainelVisivel, { capture: true, passive: true });
window.visualViewport?.addEventListener("resize", reposicionarPainelVisivel);
window.visualViewport?.addEventListener("scroll", reposicionarPainelVisivel);

if (typeof ResizeObserver !== "undefined") {
    const observadorTamanhoPainel = new ResizeObserver(reposicionarPainelVisivel);
    observadorTamanhoPainel.observe(painel);
    observadorTamanhoPainel.observe(gifPainel);
}

verificarPagina();








})();

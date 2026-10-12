const CALVOSHOT_GIPHY_API_KEY = "l5RBgsJw3vM5RtDiOuPoGB6UV83Wsi9P";

function calvoshotIsSupportedPage(url) {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:") return false;
        if (["kick.com", "www.twitch.tv", "twitch.tv"].includes(parsed.hostname)) return true;
        return ["www.youtube.com", "youtube.com"].includes(parsed.hostname) &&
            /^\/live_chat(?:_replay)?\/?$/.test(parsed.pathname);
    } catch (erro) {
        return false;
    }
}

chrome.runtime.onMessage.addListener((mensagem, remetente, responder) => {
    if (!mensagem || mensagem.tipo !== "KMC_UPLOAD_IMAGEM") {
        return false;
    }

    // Aceita uploads apenas das páginas de chat da Kick, Twitch e YouTube onde o content script roda.
    try {
        if (!calvoshotIsSupportedPage(remetente?.url)) {
            return false;
        }
    } catch (erro) {
        return false;
    }

    (async () => {
        try {
            const dadosBase64 = mensagem.dadosBase64;
            if (
                typeof dadosBase64 !== "string" ||
                !dadosBase64 ||
                dadosBase64.length % 4 !== 0 ||
                !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(dadosBase64)
            ) {
                throw new Error("Os dados da imagem estão inválidos.");
            }

            const mime = String(mensagem.mime || "").toLowerCase();
            if (!/^image\/[a-z0-9.+-]+$/.test(mime)) {
                throw new Error("O arquivo precisa ser uma imagem válida.");
            }

            const nomeOriginal = String(mensagem.nome || "imagem.png").split(/[\\/]/).pop();
            const nomeSeguro = nomeOriginal.replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 120) || "imagem.png";

            const binario = atob(dadosBase64);
            const bytes = new Uint8Array(binario.length);
            for (let i = 0; i < binario.length; i++) {
                bytes[i] = binario.charCodeAt(i);
            }

            const dados = new FormData();
            dados.append("reqtype", "fileupload");
            dados.append("fileToUpload", new Blob([bytes], { type: mime }), nomeSeguro);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);
            let resposta;
            try {
                resposta = await fetch("https://catbox.moe/user/api.php", {
                    method: "POST",
                    body: dados,
                    signal: controller.signal
                });
            } finally {
                clearTimeout(timeout);
            }

            if (!resposta.ok) {
                throw new Error("Catbox respondeu HTTP " + resposta.status + ".");
            }

            const texto = (await resposta.text()).trim();
            let url;
            try {
                url = new URL(texto);
            } catch (erro) {
                throw new Error("Catbox não retornou um link válido.");
            }

            if (
                url.protocol !== "https:" ||
                url.hostname !== "files.catbox.moe" ||
                url.pathname === "/"
            ) {
                throw new Error("Catbox retornou um endereço inesperado.");
            }

            responder({ sucesso: true, url: url.href });
        } catch (erro) {
            console.error("CalvoShot - erro no upload:", erro);
            responder({
                sucesso: false,
                erro: erro && erro.name === "AbortError"
                    ? "O upload demorou demais. Tente novamente."
                    : (erro && erro.message ? erro.message : String(erro))
            });
        }
    })();

    return true;
});

// Direct client-side GIPHY requests. No third-party proxy or remote code.
function calvoshotMediaUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password &&
            /^media[0-9]*\.giphy\.com$/.test(url.hostname) ? url.href : null;
    } catch { return null; }
}
function calvoshotGif(item) {
    const url = calvoshotMediaUrl(item?.images?.original?.url);
    const preview = calvoshotMediaUrl(item?.images?.fixed_width?.url) || url;
    if (!url || !preview || !/^[A-Za-z0-9_-]+$/.test(item?.id || "")) {
        throw new Error("O GIPHY retornou uma mídia inválida.");
    }
    return { id: item.id, title: String(item.title || "GIF"), url, preview };
}
chrome.runtime.onMessage.addListener((mensagem, remetente, responder) => {
    if (!["KMC_BUSCAR_GIFS", "KMC_OBTER_GIF"].includes(mensagem?.tipo)) return false;
    if (!calvoshotIsSupportedPage(remetente?.url)) return false;
    const single = mensagem.tipo === "KMC_OBTER_GIF";
    const consulta = typeof mensagem.consulta === "string" ? mensagem.consulta.trim().slice(0, 80) : "";
    if ((single && !/^[A-Za-z0-9_-]{1,100}$/.test(mensagem.id || "")) || (!single && !consulta)) {
        responder({ sucesso: false, erro: "Informe um código ou uma busca válida." });
        return false;
    }
    (async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
            const endpoint = single ? encodeURIComponent(mensagem.id) : mensagem.populares ? "trending" : "search";
            const url = new URL("https://api.giphy.com/v1/gifs/" + endpoint);
            url.searchParams.set("api_key", CALVOSHOT_GIPHY_API_KEY);
            if (!single) {
                if (!mensagem.populares) url.searchParams.set("q", consulta);
                url.searchParams.set("limit", "12");
                url.searchParams.set("rating", "pg-13");
                url.searchParams.set("lang", "pt");
            }
            const resposta = await fetch(url, { signal: controller.signal, credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" });
            if (resposta.status === 429) throw new Error("Limite de consultas do GIPHY atingido. Tente mais tarde.");
            if (resposta.status === 401 || resposta.status === 403) throw new Error("O GIPHY recusou a chave de acesso.");
            if (!resposta.ok) throw new Error("O GIPHY está indisponível (HTTP " + resposta.status + ").");
            const dados = await resposta.json();
            if (single) responder({ sucesso: true, gif: calvoshotGif(dados.data) });
            else {
                if (!Array.isArray(dados.data)) throw new Error("Resposta inválida do GIPHY.");
                responder({ sucesso: true, gifs: dados.data.map(calvoshotGif) });
            }
        } catch (erro) {
            // Do not log request URLs: they contain the API key and search terms.
            responder({ sucesso: false, erro: erro.name === "AbortError" ? "O GIPHY demorou para responder." : erro.message || "Não foi possível carregar os GIFs." });
        } finally { clearTimeout(timeout); }
    })();
    return true;
});

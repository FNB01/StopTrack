
// ============================================================
// STOPTRACK - REGISTRO DE PARADAS
// BLOCO 1
// ============================================================

let usuario = "";
let salaAtual = "";
let intervaloCronometro = null;

// ============================================================
// SUPABASE - CONFIGURAÇÃO
// ============================================================

const SUPABASE_URL = "https://zrywqzqakvhhsqjpinxt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_iMyyjCrM14cAiSX2Ul0pew_qzGKYMw0";

let supabaseClient = null;

if (window.supabase) {
    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );
}

// ============================================================
// MOTIVOS
// ============================================================

const motivosParada = [
    "Manutenção preventiva/corretiva",
    "Falta de insumos",
    "Operador ausente",
    "Ajuste de processo / qualidade",
    "Limpeza / higienização",
    "Setup/ configuração",
    "Outros"
];

// ============================================================
// SALAS POR RESPONSÁVEL
// ============================================================

const salasPorResponsavel = {

    "Raul Fonseca": [
        "Sala de Envase de Blister",
        "Sala de Rotulagem",
        "Sala de Conferência",
        "Sala de Encartuchamento"
    ],

    "Brunelly Marvila": [
        "Sala de Envase de Pó",
        "Sala de Envase de Sachê",
        "Sala de Envase de Cápsulas",
        "Sala de Datação"
    ],

    "Cleyton Candal": [
        "Encapsulamento 1",
        "Encapsulamento 2",
        "Encapsulamento 3",
        "Encapsulamento 4",
        "Encapsulamento 5",
        "Polimento"
    ],

    "Luiz Claudio": [
        "Sala de Datação de Líquidos",
        "Sala de Rotulagem de Cápsulas",
        "Sala de Envase de Líquidos"
    ],

    "Kaio Bizone": [
        "Sala de Formulação"
    ]
};

// ============================================================
// UTILITÁRIOS
// ============================================================

function obterDataAtual() {

    const d = new Date();

    return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
}


function obterHoraAtual() {

    const d = new Date();

    return String(d.getHours()).padStart(2, "0") + ":" +
        String(d.getMinutes()).padStart(2, "0");
}


function preencherHorarioAtual() {

    const data = document.getElementById("novaData");
    const hora = document.getElementById("novaHoraInicio");

    if (data) data.value = obterDataAtual();
    if (hora) hora.value = obterHoraAtual();
}


function obterHoraComSegundos() {

    const d = new Date();

    return String(d.getHours()).padStart(2, "0") + ":" +
        String(d.getMinutes()).padStart(2, "0") + ":" +
        String(d.getSeconds()).padStart(2, "0");
}


function carregarParadas() {

    try {
        return JSON.parse(
            localStorage.getItem("paradas")
        ) || [];
    } catch (e) {
        console.error("Erro ao carregar paradas do localStorage:", e);
        return [];
    }
}


function salvarTodasParadas(lista) {

    localStorage.setItem(
        "paradas",
        JSON.stringify(lista)
    );
}


// ============================================================
// SUPABASE - SINCRONIZAÇÃO
// ============================================================

const NOME_TABELA = "paradas";


function carregarFilaSync() {

    try {
        return JSON.parse(
            localStorage.getItem("filaSync")
        ) || [];
    } catch (e) {
        return [];
    }
}


function salvarFilaSync(fila) {

    localStorage.setItem(
        "filaSync",
        JSON.stringify(fila)
    );
}


function enqueueSync(operacao) {

    const fila = carregarFilaSync();

    fila.push(operacao);

    salvarFilaSync(fila);

    if (navigator.onLine) {
        syncEnviarPendentes();
    }
}


function paradaParaSupabase(parada) {

    return {
        id: parada.id,
        usuario: parada.usuario,
        sala: parada.sala,
        motivo: parada.motivo,
        observacao: parada.observacao,
        data: parada.data,
        horainicio: parada.horaInicio,
        horafim: parada.horaFim || null,
        ativa: parada.ativa
    };
}


async function syncEnviarPendentes() {

    if (!supabaseClient || !navigator.onLine) {
        return;
    }

    const fila = carregarFilaSync();

    const pendentes = fila.filter(function(op) {
        return !op.enviado;
    });

    if (pendentes.length === 0) {
        return;
    }

    for (let i = 0; i < pendentes.length; i++) {

        const op = pendentes[i];

        try {

            let resultado;

            if (op.tipo === "criar") {

                resultado = await supabaseClient
                    .from(NOME_TABELA)
                    .upsert(
                        paradaParaSupabase(op.dados),
                        { onConflict: "id" }
                    );

            } else if (op.tipo === "editar") {

                resultado = await supabaseClient
                    .from(NOME_TABELA)
                    .update(paradaParaSupabase(op.dados))
                    .eq("id", op.dados.id);

            } else if (op.tipo === "excluir") {

                resultado = await supabaseClient
                    .from(NOME_TABELA)
                    .delete()
                    .eq("id", op.id);

            }

            if (resultado && resultado.error) {

                console.error(
                    "Erro do Supabase ao sincronizar:",
                    "| tipo:", op.tipo,
                    "| id:", op.dados ? op.dados.id : op.id,
                    "| mensagem:", resultado.error.message,
                    "| código:", resultado.error.code,
                    "| detalhes:", resultado.error.details,
                    "| hint:", resultado.error.hint,
                    "| operação completa:", JSON.stringify(op)
                );

            } else {

                op.enviado = true;

                recentementeEnviados.add(
                    op.dados ? op.dados.id : op.id
                );

            }

        } catch (e) {

            console.error(
                "Exceção ao sincronizar:",
                "| tipo:", op.tipo,
                "| id:", op.dados ? op.dados.id : op.id,
                "| erro:", e.message,
                "| stack:", e.stack,
                "| operação completa:", JSON.stringify(op)
            );

        }
    }

    const novaFila = fila.filter(function(op) {
        return !op.enviado;
    });

    salvarFilaSync(novaFila);
}


function syncIniciar() {

    window.addEventListener("online", function() {

        console.log(
            "Online detectado. Sincronizando..."
        );

        syncEnviarPendentes();
    });

    if (navigator.onLine) {
        syncEnviarPendentes();
    }
}


// ============================================================
// SUPABASE - REALTIME
// ============================================================

let recentementeEnviados = new Set();

let realtimeAtivo = false;


function supabaseParaLocal(registro) {

    return {
        id: registro.id,
        usuario: registro.usuario,
        sala: registro.sala,
        motivo: registro.motivo,
        observacao: registro.observacao,
        data: registro.data,
        horaInicio: registro.horainicio,
        horaFim: registro.horafim,
        ativa: registro.ativa
    };
}


function realtimeIniciar() {

    if (!supabaseClient) {
        return;
    }

    if (realtimeAtivo) {
        return;
    }

    realtimeAtivo = true;

    console.log("Realtime: inscrevendo na tabela paradas...");

    const canal = supabaseClient
        .channel("paradas-realtime")
        .on(
            "postgres_changes",
            {
                event: "*",
                schema: "public",
                table: NOME_TABELA
            },
            function(payload) {

                console.log(
                    "Realtime: evento recebido:",
                    payload.eventType
                );

                var tipo = payload.eventType;
                var dados = payload.new;
                var antigo = payload.old;

                if (tipo === "INSERT" || tipo === "UPDATE") {

                    if (!dados || !dados.id) {
                        return;
                    }

                    if (recentementeEnviados.has(dados.id)) {
                        recentementeEnviados.delete(dados.id);
                        console.log(
                            "Realtime: ignorado eco local, id:",
                            dados.id
                        );
                        return;
                    }

                    var paradaLocal = supabaseParaLocal(dados);

                    var paradas = carregarParadas();

                    var index = paradas.findIndex(function(p) {
                        return p.id === paradaLocal.id;
                    });

                    if (tipo === "INSERT") {

                        if (index === -1) {
                            paradas.push(paradaLocal);
                        } else {
                            paradas[index] = paradaLocal;
                        }

                    } else {

                        if (index !== -1) {
                            paradas[index] = paradaLocal;
                        } else {
                            paradas.push(paradaLocal);
                        }
                    }

                    salvarTodasParadas(paradas);

                    console.log(
                        "Realtime: " + tipo +
                        " processado, id:", paradaLocal.id
                    );

                } else if (tipo === "DELETE") {

                    if (!antigo || !antigo.id) {
                        return;
                    }

                    if (recentementeEnviados.has(antigo.id)) {
                        recentementeEnviados.delete(antigo.id);
                        console.log(
                            "Realtime: ignorado eco local (delete), id:",
                            antigo.id
                        );
                        return;
                    }

                    var paradasDel = carregarParadas();

                    var paradasFiltradas = paradasDel.filter(function(p) {
                        return p.id !== antigo.id;
                    });

                    salvarTodasParadas(paradasFiltradas);

                    console.log(
                        "Realtime: DELETE processado, id:",
                        antigo.id
                    );
                }

                realtimeAtualizarTela();
            }
        )
        .subscribe(function(status) {
            console.log("Realtime: status do canal:", status);

            if (status === "SUBSCRIBED") {

                console.log("Realtime: conectado e recebendo eventos.");

                return;
            }

            if (
                status === "CHANNEL_ERROR" ||
                status === "TIMED_OUT" ||
                status === "CLOSED"
            ) {

                supabaseClient.removeChannel(canal);

                realtimeAtivo = false;

                setTimeout(realtimeIniciar, 5000);
            }
        });
}


function realtimeAtualizarTela() {

    if (!salaAtual) {
        return;
    }

    var paradas = carregarParadas();

    var temAtiva = paradas.some(function(p) {
        return (
            p.sala === salaAtual &&
            p.ativa === true
        );
    });

    var salaNaTela = false;

    var app = document.getElementById("app");

    if (app && app.innerHTML.indexOf(salaAtual) !== -1) {
        salaNaTela = true;
    }

    if (!salaNaTela) {
        return;
    }

    if (typeof abrirSala === "function") {
        abrirSala(salaAtual);
    }
}


async function testeConexaoSupabase() {

    if (!supabaseClient) {

        alert(
            "Cliente Supabase não inicializado."
        );

        return;
    }

    const { data, error } = await supabaseClient
        .from(NOME_TABELA)
        .select("id")
        .limit(1);

    if (error) {

        alert(
            "Erro de conexão: " + error.message
        );

    } else {

        alert(
            "Conexão OK! Registros na tabela: " +
            (data ? data.length : 0)
        );
    }
}


function formatarData(data) {

    if (!data) return "";

    return data
        .split("-")
        .reverse()
        .join("/");
}


// ============================================================
// CALCULAR DURAÇÃO
// ============================================================

function calcularDuracao(inicio, fim) {

    if (!inicio || !fim) {
        return null;
    }

    const a = inicio.split(":");
    const b = fim.split(":");

    let inicioMin =
        Number(a[0]) * 60 +
        Number(a[1]);

    let fimMin =
        Number(b[0]) * 60 +
        Number(b[1]);

    if (fimMin < inicioMin) {
        fimMin += 1440;
    }

    return fimMin - inicioMin;
}


// ============================================================
// FORMATAR DURAÇÃO
// ============================================================

function formatarDuracao(minutos) {

    if (
        minutos === null ||
        minutos === undefined
    ) {
        return "Em andamento";
    }

    const horas =
        Math.floor(minutos / 60);

    const mins =
        minutos % 60;

    if (horas > 0) {

        return horas +
            "h " +
            mins +
            "min";
    }

    return mins + " min";
}


// ============================================================
// CALCULAR CRONÔMETRO EM SEGUNDOS
// ============================================================

function calcularCronometro(data, horaInicio) {

    if (!data || !horaInicio) {
        return 0;
    }

    const inicio =
        new Date(
            data + "T" + horaInicio + ":00"
        );

    if (isNaN(inicio.getTime())) {
        return 0;
    }

    const agora =
        new Date();

    let segundos =
        Math.floor(
            (agora - inicio) / 1000
        );

    if (segundos < 0) {
        segundos = 0;
    }

    return segundos;
}


// ============================================================
// FORMATAR CRONÔMETRO
// ============================================================

function formatarCronometro(segundos) {

    if (isNaN(segundos) || segundos === null || segundos === undefined) {
        return "00:00:00";
    }

    const horas =
        Math.floor(segundos / 3600);

    const minutos =
        Math.floor(
            (segundos % 3600) / 60
        );

    const segundosRestantes =
        segundos % 60;

    return (
        String(horas).padStart(2, "0") +
        ":" +
        String(minutos).padStart(2, "0") +
        ":" +
        String(segundosRestantes).padStart(2, "0")
    );
}


// ============================================================
// PARAR CRONÔMETRO
// ============================================================

function pararCronometro() {

    if (intervaloCronometro) {

        clearInterval(
            intervaloCronometro
        );

        intervaloCronometro = null;
    }
}


// ============================================================
// INICIAR CRONÔMETRO
// ============================================================

function iniciarCronometro(parada) {

    pararCronometro();

    function atualizar() {

        const elemento =
            document.getElementById(
                "cronometroParada"
            );

        if (!elemento) {

            pararCronometro();

            return;
        }

        const segundos =
            calcularCronometro(
                parada.data,
                parada.horaInicio
            );

        elemento.innerText =
            formatarCronometro(
                segundos
            );
    }

    atualizar();

    intervaloCronometro =
        setInterval(
            atualizar,
            1000
        );
}


// ============================================================
// TELA INICIAL
// ============================================================

function telaInicial() {

    pararCronometro();

    document.getElementById("app").innerHTML = `

        <h1>STOPTRACK</h1>

        <h3>
            Registro de Paradas
        </h3>

        <button onclick="entrar('Raul Fonseca')">
            Raul Fonseca
        </button>

        <button onclick="entrar('Brunelly Marvila')">
            Brunelly Marvila
        </button>

        <button onclick="entrar('Cleyton Candal')">
            Cleyton Candal
        </button>

        <button onclick="entrar('Luiz Claudio')">
            Luiz Claudio
        </button>

        <button onclick="entrar('Kaio Bizone')">
            Kaio Bizone
        </button>

        <br><br>

        <button onclick="abrirRelatorios()">
            📊 RELATÓRIOS
        </button>
        <br><br>

        <button onclick="abrirConfiguracoes()">
            ⚙️ CONFIGURAÇÕES
        </button>



    `;
}


// ============================================================
// CONFIGURAÇÕES
// ============================================================

function abrirConfiguracoes() {

    pararCronometro();

    let configuracoes = {};
    try {
        configuracoes = JSON.parse(
            localStorage.getItem("configuracoesEnvioRelatorio")
        ) || {};
    } catch (e) {
        console.error("Erro ao carregar configuracoes do localStorage:", e);
    }

    document.getElementById("app").innerHTML = `

        <h1>CONFIGURAÇÕES</h1>

        <div class="card configuracoes-envio">

            <h2>Configurações de envio do relatório</h2>

            <label for="emailDestinatarioRelatorio">
                E-mail do destinatário do relatório
            </label>

            <input
                type="email"
                id="emailDestinatarioRelatorio"
                placeholder="email@exemplo.com"
                required
            >

            <label for="emailAdicionalRelatorio">
                E-mail adicional do destinatário (opcional)
            </label>

            <input
                type="email"
                id="emailAdicionalRelatorio"
                placeholder="email@exemplo.com"
            >

            <label for="nomeResponsavelRecebimento">
                Nome do responsável pelo recebimento (opcional)
            </label>

            <input
                type="text"
                id="nomeResponsavelRecebimento"
                placeholder="Nome do responsável"
            >

            <label class="configuracao-checkbox" for="envioRelatorioAtivo">
                <input
                    type="checkbox"
                    id="envioRelatorioAtivo"
                >
                Ativar envio do relatório
            </label>

        </div>

        <button onclick="salvarConfiguracoesEnvio()">
            Salvar configurações
        </button>

        <button onclick="telaInicial()">
            Voltar
        </button>

    `;

    document.getElementById("emailDestinatarioRelatorio").value =
        configuracoes.emailDestinatario || "";
    document.getElementById("emailAdicionalRelatorio").value =
        configuracoes.emailAdicional || "";
    document.getElementById("nomeResponsavelRecebimento").value =
        configuracoes.nomeResponsavel || "";
    document.getElementById("envioRelatorioAtivo").checked =
        configuracoes.envioAtivo === true;
}


function salvarConfiguracoesEnvio() {

    const emailDestinatario = document
        .getElementById("emailDestinatarioRelatorio")
        .value
        .trim();

    const emailAdicional = document
        .getElementById("emailAdicionalRelatorio")
        .value
        .trim();

    const nomeResponsavel = document
        .getElementById("nomeResponsavelRecebimento")
        .value
        .trim();

    if (!emailDestinatario) {
        alert("Informe o e-mail do destinatário do relatório.");
        return;
    }

    const configuracoes = {
        emailDestinatario: emailDestinatario,
        emailAdicional: emailAdicional,
        nomeResponsavel: nomeResponsavel,
        envioAtivo: document
            .getElementById("envioRelatorioAtivo")
            .checked
    };

    localStorage.setItem(
        "configuracoesEnvioRelatorio",
        JSON.stringify(configuracoes)
    );

    alert("Configurações salvas com sucesso!");
}


// ============================================================
// ENTRAR COMO RESPONSÁVEL
// ============================================================

function entrar(nome) {

    pararCronometro();

    usuario = nome;

    const salas =
        salasPorResponsavel[nome] || [];

    let html = `

        <h2>
            Olá, ${usuario}
        </h2>

        <h3>
            Escolha a sala
        </h3>

    `;

    salas.forEach(function(sala) {

        html += `

            <div class="card">

                <button
                    onclick="abrirSala('${sala}')"
                >
                    🏭 ${sala}
                </button>

            </div>

        `;

    });

    html += `

        <br>

        <button onclick="telaInicial()">
            ↩️ Voltar
        </button>

    `;

    document.getElementById("app").innerHTML =
        html;
}


// ============================================================
// ABRIR SALA
// ============================================================

function abrirSala(sala) {

    pararCronometro();

    salaAtual = sala;

    const paradas =
        carregarParadas();

    const ativa =
        paradas.find(function(p) {

            return (
                p.sala === sala &&
                p.ativa === true
            );

        });


    // ========================================================
    // MÁQUINA PARADA
    // ========================================================

    if (ativa) {

        document.getElementById("app").innerHTML = `

            <h2>
                🏭 ${salaAtual}
            </h2>

            <p>
                <b>Responsável:</b>
                ${usuario}
            </p>

            <div class="card">

                <h2 style="color:red;">
                    🔴 MÁQUINA PARADA
                </h2>

                <hr>

                <p>
                    <b>📅 Data:</b>
                    ${formatarData(ativa.data)}
                </p>

                <p>
                    <b>🕒 Início:</b>
                    ${ativa.horaInicio}
                </p>

                <p>
                    <b>⚠️ Motivo:</b>
                    ${ativa.motivo}
                </p>

                <p>
                    <b>📝 Observação:</b>
                    ${ativa.observacao || "Nenhuma"}
                </p>

                <hr>

                <p>
                    <b>⏱️ TEMPO DE PARADA</b>
                </p>

                <h1
                    id="cronometroParada"
                    style="
                        font-size:40px;
                        letter-spacing:2px;
                    "
                >
                    00:00:00
                </h1>

                <button
                    onclick="finalizarParada(${ativa.id})"
                >
                    ⏹️ FINALIZAR PARADA
                </button>

            </div>

            <br>

            <button
                onclick="abrirHistoricoIndividual('${salaAtual}')"
            >
                📋 Histórico da Sala
            </button>

            <br><br>

            <button
                onclick="entrar('${usuario}')"
            >
                ↩️ Voltar pras Salas
            </button>

        `;

        iniciarCronometro(ativa);

        return;
    }


    // ========================================================
    // MÁQUINA OPERANDO
    // ========================================================

    document.getElementById("app").innerHTML = `

        <h2>
            🏭 ${salaAtual}
        </h2>

        <p>
            <b>Responsável:</b>
            ${usuario}
        </p>

        <div class="card">

            <h2 style="color:green;">
                🟢 OPERANDO
            </h2>

            <hr>

            <button
                onclick="mostrarTelaRegistro()"
            >
                🔴 REGISTRAR PARADA
            </button>

        </div>

        <br>

        <button
            onclick="abrirHistoricoIndividual('${salaAtual}')"
        >
            📋 Histórico da Sala
        </button>

        <br><br>

        <button
            onclick="entrar('${usuario}')"
        >
            ↩️ Voltar pras Salas
        </button>

    `;
}



// ============================================================
// STOPTRACK - BLOCO 2
// TELA DE REGISTRO + SALVAR PARADA + FINALIZAR
// ============================================================


// ============================================================
// TELA DE REGISTRO
// ============================================================

function mostrarTelaRegistro() {

    pararCronometro();

    document.getElementById("app").innerHTML = `

        <h2>
            🔴 Registrar Parada
        </h2>

        <div class="card">

            <p>
                <b>🏭 Sala:</b>
                ${salaAtual}
            </p>

            <label>
                <b>📅 Data:</b>
            </label>

            <input
                type="date"
                id="novaData"
                value="${obterDataAtual()}"
            >

            <br><br>

            <label>
                <b>🕒 Horário de início:</b>
            </label>

            <br>

            <input
                type="time"
                id="novaHoraInicio"
                value="${obterHoraAtual()}"
            >

            <button type="button" onclick="preencherHorarioAtual()">
                ⏱️ AGORA
            </button>

            <br><br>

            <label>
                <b>⚠️ Motivo:</b>
            </label>

            <br>

            <select id="novoMotivo">

                ${motivosParada.map(function(m) {

                    return `
                        <option value="${m}">
                            ${m}
                        </option>
                    `;

                }).join("")}

            </select>

            <br><br>

            <label>
                <b>📝 Observação:</b>
            </label>

            <br>

            <textarea
                id="novaObservacao"
                rows="4"
                placeholder="Digite uma observação..."
            ></textarea>

            <br><br>

            <button
                onclick="salvarNovaParada()"
            >
                🔴 CONFIRMAR PARADA
            </button>

        </div>

        <br>

        <button
            onclick="abrirSala('${salaAtual}')"
        >
            ↩️ Cancelar
        </button>

    `;
}


// ============================================================
// SALVAR NOVA PARADA
// ============================================================

function salvarNovaParada() {

    const data =
        document.getElementById(
            "novaData"
        ).value;

    const hora =
        document.getElementById(
            "novaHoraInicio"
        ).value;

    const motivo =
        document.getElementById(
            "novoMotivo"
        ).value;

    const observacao =
        document.getElementById(
            "novaObservacao"
        ).value.trim();


    // --------------------------------------------------------
    // VALIDAÇÃO
    // --------------------------------------------------------

    if (!data || !hora || !motivo) {

        alert(
            "Preencha a data, horário e motivo."
        );

        return;
    }


    const paradas =
        carregarParadas();


    // --------------------------------------------------------
    // VERIFICAR SE JÁ EXISTE PARADA ATIVA
    // --------------------------------------------------------

    const existeAtiva =
        paradas.some(function(p) {

            return (
                p.sala === salaAtual &&
                p.ativa === true
            );

        });


    if (existeAtiva) {

        alert(
            "Esta sala já possui uma parada em andamento."
        );

        abrirSala(salaAtual);

        return;
    }


    // --------------------------------------------------------
    // CRIAR NOVA PARADA
    // --------------------------------------------------------

    const nova = {

        id: Date.now(),

        usuario: usuario,

        sala: salaAtual,

        motivo: motivo,

        observacao: observacao,

        data: data,

        horaInicio: hora,

        horaFim: "",

        ativa: true

    };


    // --------------------------------------------------------
    // SALVAR
    // --------------------------------------------------------

    paradas.push(nova);

    salvarTodasParadas(paradas);

    enqueueSync({
        tipo: "criar",
        dados: nova,
        enviado: false
    });

    alert(
        "🔴 Parada registrada!"
    );


    // --------------------------------------------------------
    // VOLTAR PARA A SALA
    // --------------------------------------------------------

    abrirSala(salaAtual);
}


// ============================================================
// FINALIZAR PARADA
// ============================================================

function finalizarParada(id) {

    const paradas =
        carregarParadas();


    const index =
        paradas.findIndex(function(p) {

            return p.id === id;

        });


    // --------------------------------------------------------
    // VERIFICAR SE EXISTE
    // --------------------------------------------------------

    if (index === -1) {

        alert(
            "Parada não encontrada."
        );

        return;
    }


    // --------------------------------------------------------
    // CONFIRMAÇÃO
    // --------------------------------------------------------

    if (
        !confirm(
            "Finalizar a parada da máquina?"
        )
    ) {

        return;
    }


    // --------------------------------------------------------
    // REGISTRAR HORÁRIO FINAL
    // --------------------------------------------------------

    paradas[index].horaFim =
        obterHoraAtual();

    paradas[index].dataFim =
        obterDataAtual();


    paradas[index].ativa =
        false;


    // --------------------------------------------------------
    // SALVAR
    // --------------------------------------------------------

    salvarTodasParadas(paradas);

    enqueueSync({
        tipo: "editar",
        dados: paradas[index],
        enviado: false
    });


    // --------------------------------------------------------
    // PARAR CRONÔMETRO
    // --------------------------------------------------------

    pararCronometro();


    alert(
        "🟢 Parada finalizada!"
    );


    // --------------------------------------------------------
    // VOLTAR PARA SALA
    // --------------------------------------------------------

    abrirSala(
        paradas[index].sala
    );
}

// ============================================================
// STOPTRACK - BLOCO 3
// HISTÓRICO INDIVIDUAL + EDIÇÃO + EXCLUSÃO
// ============================================================


// ============================================================
// HISTÓRICO INDIVIDUAL
// ============================================================

function abrirHistoricoIndividual(sala) {

    pararCronometro();

    salaAtual = sala;

    const paradas =
        carregarParadas()
            .filter(function(p) {

                return p.sala === sala;

            })
            .sort(function(a, b) {

                if (a.data !== b.data) {

                    return b.data.localeCompare(
                        a.data
                    );
                }

                return (
                    b.horaInicio || ""
                ).localeCompare(
                    a.horaInicio || ""
                );

            });


    let html = `

        <h2>
            📋 Histórico
        </h2>

        <h3>
            🏭 ${sala}
        </h3>

    `;


    // ========================================================
    // NENHUM REGISTRO
    // ========================================================

    if (paradas.length === 0) {

        html += `

            <div class="card">

                <p>
                    Nenhuma parada registrada
                    nesta sala.
                </p>

            </div>

        `;

    }


    // ========================================================
    // LISTAR PARADAS
    // ========================================================

    else {

        paradas.forEach(function(parada) {

            const duracao =
                calcularDuracao(
                    parada.horaInicio,
                    parada.horaFim
                );


            html += `

                <div
                    class="card"
                    style="
                        text-align:left;
                        margin-bottom:12px;
                    "
                >

                    <p>
                        <b>📅 Data:</b>
                        ${formatarData(parada.data)}
                    </p>

                    <p>
                        <b>⚠️ Motivo:</b>
                        ${parada.motivo}
                    </p>

                    <p>
                        <b>🕒 Início:</b>
                        ${parada.horaInicio || "--:--"}
                    </p>

                    <p>
                        <b>⏹️ Fim:</b>
                        ${
                            parada.horaFim ||
                            "Em andamento"
                        }
                    </p>

                    <p>
                        <b>⏱️ Duração:</b>
                        ${formatarDuracao(duracao)}
                    </p>

                    <p>
                        <b>👤 Responsável:</b>
                        ${parada.usuario}
                    </p>

                    <p>
                        <b>📝 Observação:</b>
                        ${
                            parada.observacao ||
                            "Nenhuma"
                        }
                    </p>

                    <br>

                    <button
                        onclick="editarParada(${parada.id})"
                    >
                        ✏️ EDITAR
                    </button>

                    <button
                        onclick="excluirParada(${parada.id})"
                    >
                        🗑️ EXCLUIR
                    </button>

                </div>

            `;

        });

    }


    // ========================================================
    // UM ÚNICO BOTÃO DE VOLTAR
    // ========================================================

    html += `

        <br>

        <button
            onclick="abrirSala('${sala}')"
        >
            ↩️ Voltar para Sala
        </button>

    `;


    document.getElementById("app").innerHTML =
        html;
}


// ============================================================
// EDITAR PARADA
// ============================================================

function editarParada(id) {

    pararCronometro();

    const paradas =
        carregarParadas();


    const parada =
        paradas.find(function(p) {

            return p.id === id;

        });


    if (!parada) {

        alert(
            "Parada não encontrada."
        );

        return;
    }


    document.getElementById("app").innerHTML = `

        <h2>
            ✏️ Editar Parada
        </h2>

        <div class="card">

            <p>
                <b>🏭 Sala:</b>
                ${parada.sala}
            </p>

            <p>
                <b>👤 Responsável:</b>
                ${parada.usuario}
            </p>

            <hr>

            <label>
                <b>📅 Data:</b>
            </label>

            <br>

            <input
                type="date"
                id="editarData"
                value="${parada.data || ""}"
            >

            <br><br>


            <label>
                <b>🕒 Horário de início:</b>
            </label>

            <br>

            <input
                type="time"
                id="editarInicio"
                value="${parada.horaInicio || ""}"
            >

            <br><br>


            <label>
                <b>⏹️ Horário de fim:</b>
            </label>

            <br>

            <input
                type="time"
                id="editarFim"
                value="${parada.horaFim || ""}"
            >

            <br><br>


            <label>
                <b>⚠️ Motivo:</b>
            </label>

            <br>

            <select id="editarMotivo">

                ${motivosParada.map(function(m) {

                    return `
                        <option
                            value="${m}"
                            ${
                                parada.motivo === m
                                ? "selected"
                                : ""
                            }
                        >
                            ${m}
                        </option>
                    `;

                }).join("")}

            </select>

            <br><br>


            <label>
                <b>📝 Observação:</b>
            </label>

            <br>

            <textarea
                id="editarObservacao"
                rows="5"
                placeholder="Digite uma observação..."
            >${parada.observacao || ""}</textarea>

            <br><br>


            <button
                onclick="salvarEdicao(${id})"
            >
                💾 SALVAR ALTERAÇÕES
            </button>

        </div>

        <br>

        <button
            onclick="abrirHistoricoIndividual('${parada.sala}')"
        >
            ↩️ Cancelar
        </button>

    `;
}


// ============================================================
// SALVAR EDIÇÃO
// ============================================================

function salvarEdicao(id) {

    const paradas = carregarParadas();

    const index = paradas.findIndex(function(p) {
        return p.id === id;
    });

    if (index === -1) {

        alert("Parada não encontrada.");

        return;
    }

    const data =
        document.getElementById("editarData").value;

    const inicio =
        document.getElementById("editarInicio").value;

    const fim =
        document.getElementById("editarFim").value;

    const motivo =
        document.getElementById("editarMotivo").value;

    const observacao =
        document.getElementById("editarObservacao")
        .value
        .trim();


    // --------------------------------------------------------
    // VALIDAÇÃO
    // --------------------------------------------------------

    if (!data || !inicio || !motivo) {

        alert(
            "Data, horário inicial e motivo são obrigatórios."
        );

        return;
    }


    // --------------------------------------------------------
    // AVISO SOBRE MEIA-NOITE
    // --------------------------------------------------------

    if (fim && fim < inicio) {

        const confirmar = confirm(
            "O horário final é menor que o horário inicial.\n\n" +
            "Isso será considerado como uma parada que " +
            "atravessou a meia-noite.\n\n" +
            "Deseja continuar?"
        );

        if (!confirmar) {
            return;
        }
    }


    // --------------------------------------------------------
    // ATUALIZA DADOS
    // --------------------------------------------------------

    paradas[index].data = data;

    paradas[index].horaInicio = inicio;

    paradas[index].horaFim = fim;

    paradas[index].motivo = motivo;

    paradas[index].observacao = observacao;


    // --------------------------------------------------------
    // STATUS
    // --------------------------------------------------------

    if (fim === "") {

        paradas[index].ativa = true;

    } else {

        paradas[index].ativa = false;
    }


    // --------------------------------------------------------
    // SALVAR
    // --------------------------------------------------------

    salvarTodasParadas(paradas);

    enqueueSync({
        tipo: "editar",
        dados: paradas[index],
        enviado: false
    });


    alert(
        "✅ Parada atualizada com sucesso!"
    );


    abrirHistoricoIndividual(
        paradas[index].sala
    );
}


// ============================================================
// EXCLUIR PARADA
// ============================================================

function excluirParada(id) {

    const paradas = carregarParadas();

    const parada =
        paradas.find(function(p) {
            return p.id === id;
        });


    if (!parada) {

        alert(
            "Parada não encontrada."
        );

        return;
    }


    const confirmar = confirm(
        "Tem certeza que deseja excluir esta parada?\n\n" +
        "Sala: " + parada.sala + "\n" +
        "Data: " + formatarData(parada.data) + "\n" +
        "Motivo: " + parada.motivo
    );


    if (!confirmar) {
        return;
    }


    const novasParadas =
        paradas.filter(function(p) {

            return p.id !== id;

        });


    salvarTodasParadas(
        novasParadas
    );

    enqueueSync({
        tipo: "excluir",
        id: id,
        enviado: false
    });


    alert(
        "🗑️ Parada excluída."
    );


    abrirHistoricoIndividual(
        parada.sala
    );
}


// ============================================================
// RELATÓRIOS
// ============================================================

function abrirRelatorios() {

    pararCronometro();

    const hoje = new Date();
    const diaDaSemana = hoje.getDay();
    const deslocamentoParaSegunda = (diaDaSemana + 6) % 7;
    const inicioSemana = new Date(hoje);
    inicioSemana.setDate(hoje.getDate() - deslocamentoParaSegunda);
    const fimSemana = new Date(inicioSemana);
    fimSemana.setDate(inicioSemana.getDate() + 6);

    const formatarParaInput = function(data) {
        return data.getFullYear() + "-" +
            String(data.getMonth() + 1).padStart(2, "0") + "-" +
            String(data.getDate()).padStart(2, "0");
    };

    document.getElementById("app").innerHTML = `

        <h2>
            📊 RELATÓRIO SEMANAL
        </h2>

        <div class="card">

            <h3>
                Selecione a semana/período
            </h3>

            <p>
                <b>📅 Data inicial:</b>
            </p>

            <input
                type="date"
                id="dataInicial"
                value="${formatarParaInput(inicioSemana)}"
            >

            <br><br>

            <p>
                <b>📅 Data final:</b>
            </p>

            <input
                type="date"
                id="dataFinal"
                value="${formatarParaInput(fimSemana)}"
            >

            <br><br>

            <button
                onclick="gerarRelatorio()"
            >
                📊 GERAR RELATÓRIO
            </button>

        </div>

        <br>

        <button
            onclick="telaInicial()"
        >
            ↩️ Voltar
        </button>

    `;
}


// ============================================================
// ENCONTRAR CAMPEÃO
// ============================================================

function encontrarCampeao(objeto) {

    const nomes =
        Object.keys(objeto);


    if (nomes.length === 0) {
        return null;
    }


    let nome =
        nomes[0];

    let valor =
        objeto[nome];


    nomes.forEach(function(n) {

        if (objeto[n] > valor) {

            nome = n;

            valor = objeto[n];
        }

    });


    return {

        nome: nome,

        valor: valor

    };
}


// ============================================================
// RANKING DOS MOTIVOS
// ============================================================

function gerarRankingMotivos(motivos) {

    const lista =
        Object.keys(motivos)
        .map(function(nome) {

            return {

                nome: nome,

                valor: motivos[nome]

            };

        });


    lista.sort(function(a, b) {

        return b.valor - a.valor;

    });


    if (lista.length === 0) {

        return `
            <p>
                Nenhum motivo registrado.
            </p>
        `;
    }


    let html = "";


    lista.forEach(function(item, index) {

        let posicao;


        if (index === 0) {

            posicao = "🥇";

        } else if (index === 1) {

            posicao = "🥈";

        } else if (index === 2) {

            posicao = "🥉";

        } else {

            posicao =
                (index + 1) + "º";
        }


        html += `

            <div
                class="card"
                style="
                    text-align:left;
                    margin-bottom:8px;
                "
            >

                <p>
                    <b>
                        ${posicao}
                        ${item.nome}
                    </b>
                </p>

                <p>
                    ⏱️
                    ${formatarDuracao(item.valor)}
                </p>

            </div>

        `;

    });


    return html;
}


// ============================================================
// CRIAR GRÁFICO DE PIZZA
// ============================================================

function criarGraficoPizza(dados) {

    const canvas =
        document.getElementById(
            "graficoPizza"
        );


    if (!canvas) {
        return;
    }


    const ctx =
        canvas.getContext("2d");


    const total =
        dados.reduce(
            function(soma, item) {

                return soma + item.valor;

            },
            0
        );


    if (total <= 0) {

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );

        return;
    }


    let inicio =
        -Math.PI / 2;


    const centroX =
        canvas.width / 2;

    const centroY =
        canvas.height / 2;


    const raio =
        Math.min(
            centroX,
            centroY
        ) - 10;


    dados.forEach(function(item, index) {

        const porcentagem =
            item.valor / total;


        const fim =
            inicio +
            porcentagem *
            Math.PI * 2;


        // ----------------------------------------------------
        // FATIA
        // ----------------------------------------------------

        ctx.beginPath();

        ctx.moveTo(
            centroX,
            centroY
        );

        ctx.arc(
            centroX,
            centroY,
            raio,
            inicio,
            fim
        );

        ctx.closePath();

        ctx.fillStyle =
            obterCorGrafico(index);

        ctx.fill();


        // ----------------------------------------------------
        // BORDA
        // ----------------------------------------------------

        ctx.strokeStyle =
            "#ffffff";

        ctx.lineWidth = 2;

        ctx.stroke();


        // ----------------------------------------------------
        // PORCENTAGEM
        // ----------------------------------------------------

        if (porcentagem >= 0.04) {

            const meio =
                (inicio + fim) / 2;


            const textoX =
                centroX +
                Math.cos(meio) *
                raio *
                0.62;


            const textoY =
                centroY +
                Math.sin(meio) *
                raio *
                0.62;


            const percentual =
                (porcentagem * 100)
                .toFixed(1);


            ctx.fillStyle =
                "#ffffff";

            ctx.font =
                "bold 14px Arial";

            ctx.textAlign =
                "center";

            ctx.textBaseline =
                "middle";


            ctx.fillText(
                percentual + "%",
                textoX,
                textoY
            );
        }


        inicio = fim;

    });

}


// ============================================================
// CORES DO GRÁFICO
// ============================================================

function obterCorGrafico(index) {

    const cores = [

        "#3498db",
        "#e74c3c",
        "#2ecc71",
        "#f1c40f",
        "#9b59b6",
        "#e67e22",
        "#1abc9c",
        "#34495e",
        "#95a5a6",
        "#d35400"

    ];


    return cores[
        index % cores.length
    ];
}


// ============================================================
// LEGENDA DO GRÁFICO
// ============================================================

function criarLegendaGrafico(dados) {

    const total =
        dados.reduce(
            function(soma, item) {

                return soma + item.valor;

            },
            0
        );


    if (total <= 0) {

        return `
            <p>
                Nenhum dado para exibir.
            </p>
        `;
    }


    let html = "";


    dados.forEach(function(item, index) {

        const percentual =
            (
                item.valor /
                total *
                100
            ).toFixed(1);


        html += `

            <div
                style="
                    display:flex;
                    align-items:center;
                    margin:8px 0;
                    text-align:left;
                "
            >

                <span
                    style="
                        width:18px;
                        height:18px;
                        background:${obterCorGrafico(index)};
                        display:inline-block;
                        margin-right:8px;
                        border-radius:4px;
                    "
                ></span>

                <span>

                    <b>
                        ${item.nome}
                    </b>

                    — ${percentual}%

                    (${formatarDuracao(item.valor)})

                </span>

            </div>

        `;

    });


    return html;
}


// ============================================================
// RESUMO DO RELATÓRIO POR SALA
// ============================================================

function gerarResumoPorSala(paradasPeriodo) {

    const dadosPorSala = {};

    Object.keys(salasPorResponsavel).forEach(function(responsavel) {

        salasPorResponsavel[responsavel].forEach(function(sala) {

            dadosPorSala[sala] = {
                responsavel: responsavel,
                paradas: [],
                totalMinutos: 0,
                motivos: {}
            };

        });

    });

    paradasPeriodo.forEach(function(parada) {

        if (!dadosPorSala[parada.sala]) {
            dadosPorSala[parada.sala] = {
                responsavel: parada.usuario || "Não informado",
                paradas: [],
                totalMinutos: 0,
                motivos: {}
            };
        }

        const grupo = dadosPorSala[parada.sala];
        const duracao = calcularDuracao(parada.horaInicio, parada.horaFim);

        grupo.paradas.push(parada);

        if (duracao !== null) {
            grupo.totalMinutos += duracao;
        }

        if (!grupo.motivos[parada.motivo]) {
            grupo.motivos[parada.motivo] = {
                quantidade: 0,
                minutos: 0
            };
        }

        grupo.motivos[parada.motivo].quantidade += 1;
        grupo.motivos[parada.motivo].minutos += duracao || 0;

    });

    return Object.keys(dadosPorSala).map(function(sala) {

        const grupo = dadosPorSala[sala];
        const responsaveisDosRegistros = [];

        grupo.paradas.forEach(function(parada) {
            if (parada.usuario && !responsaveisDosRegistros.includes(parada.usuario)) {
                responsaveisDosRegistros.push(parada.usuario);
            }
        });

        const motivos = Object.keys(grupo.motivos)
            .sort(function(a, b) {
                return grupo.motivos[b].minutos - grupo.motivos[a].minutos;
            })
            .map(function(motivo) {
                const dados = grupo.motivos[motivo];
                return `<li>${motivo}: ${dados.quantidade} registro(s) — ${formatarDuracao(dados.minutos)}</li>`;
            })
            .join("");

        return `
            <div class="card" style="text-align:left; margin-bottom:12px;">
                <h3>🏭 ${sala}</h3>
                <p><b>Responsável:</b> ${grupo.responsavel}</p>
                <p><b>Responsável(is) nos registros:</b> ${responsaveisDosRegistros.join(", ") || "Sem registros no período"}</p>
                <p><b>Tempo total de parada:</b> ${formatarDuracao(grupo.totalMinutos)}</p>
                <p><b>Paradas no período:</b> ${grupo.paradas.length}</p>
                <p><b>Motivos:</b></p>
                ${motivos ? `<ul>${motivos}</ul>` : "<p>Nenhuma parada registrada nesta sala no período.</p>"}
            </div>
        `;
    }).join("");
}

// ============================================================
// COMPARTILHAR RELATÓRIO EM PDF
// ============================================================

async function salvarRelatorioPDF() {

    const app = document.getElementById("app");

    if (!app) {
        alert("Não foi possível localizar o relatório.");
        return;
    }

    if (
        typeof html2canvas === "undefined" ||
        !window.jspdf ||
        !window.jspdf.jsPDF
    ) {
        alert(
            "Bibliotecas de PDF não carregadas. Verifique a conexão com a internet."
        );
        return;
    }

    try {

        const botoes = app.querySelectorAll("button");

        botoes.forEach(function(botao) {
            botao.style.display = "none";
        });

        const canvas = await html2canvas(app, {
            scale: 2,
            backgroundColor: "#ffffff",
            useCORS: true,
            height: app.scrollHeight,
            windowHeight: app.scrollHeight
        });

        botoes.forEach(function(botao) {
            botao.style.display = "";
        });

        const jsPDF = window.jspdf.jsPDF;

        const pdf = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4"
        });

        const margem = 10;
        const larguraPagina = 210;
        const alturaPagina = 297;

        const largura = larguraPagina - (margem * 2);
        const alturaUtil = alturaPagina - (margem * 2);

        const fatiaPaginaPx =
            Math.floor(alturaUtil * canvas.width / largura);

        const totalPaginas =
            Math.ceil(canvas.height / fatiaPaginaPx);

        for (let i = 0; i < totalPaginas; i++) {

            const yOrigem = i * fatiaPaginaPx;

            const alturaFatia =
                Math.min(fatiaPaginaPx, canvas.height - yOrigem);

            const fatiaCanvas =
                document.createElement("canvas");

            fatiaCanvas.width = canvas.width;
            fatiaCanvas.height = alturaFatia;

            const ctx = fatiaCanvas.getContext("2d");

            ctx.drawImage(
                canvas,
                0,
                yOrigem,
                canvas.width,
                alturaFatia,
                0,
                0,
                canvas.width,
                alturaFatia
            );

            const imagemFatia =
                fatiaCanvas.toDataURL("image/jpeg", 0.95);

            const alturaFatiaMM =
                alturaFatia * largura / canvas.width;

            if (i > 0) {
                pdf.addPage();
            }

            pdf.addImage(
                imagemFatia,
                "JPEG",
                margem,
                margem,
                largura,
                alturaFatiaMM
            );
        }

        const blob = pdf.output("blob");

        const file = new File([blob], "STOPTRACK-Relatorio.pdf", { type: "application/pdf" });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: "STOPTRACK - Relatório de Paradas",
                    text: "Segue em anexo o relatório de paradas gerado pelo STOPTRACK."
                });
            } catch (shareError) {
                if (shareError.name === "AbortError") {
                    console.log("Compartilhamento cancelado pelo usuário.");
                } else {
                    throw shareError;
                }
            }
        } else {
            alert("O seu dispositivo não suporta compartilhamento de arquivos. Acesse esta página em um navegador moderno (Chrome, Safari) para compartilhar o relatório.");
        }

    } catch (erro) {

        console.error(
            "Erro ao gerar PDF:",
            erro
        );

        alert(
            "Erro ao gerar o PDF: " +
            erro.message
        );

        const botoes =
            app.querySelectorAll("button");

        botoes.forEach(function(botao) {
            botao.style.display = "";
        });
    }
}

function gerarRelatorio() {

    const inicio =
        document.getElementById("dataInicial").value;

    const fim =
        document.getElementById("dataFinal").value;


    // --------------------------------------------------------
    // VALIDAÇÃO
    // --------------------------------------------------------

    if (!inicio || !fim) {

        alert(
            "Escolha a data inicial e a data final."
        );

        return;
    }


    if (inicio > fim) {

        alert(
            "A data inicial não pode ser maior " +
            "que a data final."
        );

        return;
    }


    // --------------------------------------------------------
    // CARREGAR PARADAS
    // --------------------------------------------------------

    const todasParadas =
        carregarParadas();


    const paradasPeriodo =
        todasParadas.filter(function(parada) {

            return (
                parada.data >= inicio &&
                parada.data <= fim
            );

        });


    // --------------------------------------------------------
    // VARIÁVEIS
    // --------------------------------------------------------

    let totalMinutos = 0;

    let motivos = {};

    let salas = {};


    // --------------------------------------------------------
    // PROCESSAR PARADAS
    // --------------------------------------------------------

    paradasPeriodo.forEach(function(parada) {

        const duracao =
            calcularDuracao(
                parada.horaInicio,
                parada.horaFim
            );


        // Paradas ainda abertas
        // não entram no relatório

        if (duracao === null) {
            return;
        }


        totalMinutos += duracao;


        // ----------------------------------------------------
        // MOTIVOS
        // ----------------------------------------------------

        if (!motivos[parada.motivo]) {

            motivos[parada.motivo] = 0;

        }


        motivos[parada.motivo] +=
            duracao;


        // ----------------------------------------------------
        // SALAS
        // ----------------------------------------------------

        if (!salas[parada.sala]) {

            salas[parada.sala] = 0;

        }


        salas[parada.sala] +=
            duracao;

    });


    // --------------------------------------------------------
    // CAMPEÕES
    // --------------------------------------------------------

    const motivoCampeao =
        encontrarCampeao(
            motivos
        );


    const salaCampea =
        encontrarCampeao(
            salas
        );


    // --------------------------------------------------------
    // RANKING
    // --------------------------------------------------------

    const rankingMotivos =
        gerarRankingMotivos(
            motivos
        );


    // --------------------------------------------------------
    // DADOS DO GRÁFICO
    // --------------------------------------------------------

    const dadosGrafico =
        Object.keys(motivos)
        .map(function(nome) {

            return {

                nome: nome,

                valor: motivos[nome]

            };

        });


    const resumoPorSala =
        gerarResumoPorSala(
            paradasPeriodo
        );


    // --------------------------------------------------------
    // DATAS BRASILEIRAS
    // --------------------------------------------------------

    const inicioBR =
        inicio
        .split("-")
        .reverse()
        .join("/");


    const fimBR =
        fim
        .split("-")
        .reverse()
        .join("/");


    // ========================================================
    // HISTÓRICO
    // ========================================================

    let historico = "";


    if (paradasPeriodo.length === 0) {

        historico = `

            <div class="card">

                <p>
                    Nenhuma parada encontrada
                    neste período.
                </p>

            </div>

        `;

    } else {

        historico = `

            <h3>
                📋 Histórico das Paradas
            </h3>

        `;


        // ----------------------------------------------------
        // ORDENAR
        // ----------------------------------------------------

        paradasPeriodo
        .sort(function(a, b) {

            if (a.data !== b.data) {

                return b.data.localeCompare(
                    a.data
                );

            }


            return (
                b.horaInicio || ""
            ).localeCompare(
                a.horaInicio || ""
            );

        });


        // ----------------------------------------------------
        // MONTAR HISTÓRICO
        // ----------------------------------------------------

        paradasPeriodo.forEach(
            function(item) {

                const dataBR =
                    formatarData(
                        item.data
                    );


                const duracao =
                    calcularDuracao(
                        item.horaInicio,
                        item.horaFim
                    );


                historico += `

                    <div
                        class="card"
                        style="
                            text-align:left;
                            margin-bottom:12px;
                        "
                    >

                        <p>
                            <b>📅 Data:</b>
                            ${dataBR}
                        </p>


                        <p>
                            <b>🏭 Sala:</b>
                            ${item.sala}
                        </p>


                        <p>
                            <b>⚠️ Motivo:</b>
                            ${item.motivo}
                        </p>


                        <p>
                            <b>👤 Responsável:</b>
                            ${item.usuario}
                        </p>


                        <p>
                            <b>🕒 Início:</b>
                            ${item.horaInicio || "--:--"}
                        </p>


                        <p>
                            <b>⏹️ Fim:</b>
                            ${item.horaFim || "Em andamento"}
                        </p>


                        <p>
                            <b>⏱️ Duração:</b>
                            ${formatarDuracao(duracao)}
                        </p>


                        <p>
                            <b>📝 Observação:</b>
                            ${item.observacao || "Nenhuma"}
                        </p>

                    </div>

                `;

            }
        );

    }


    // ========================================================
    // TELA DO RELATÓRIO
    // ========================================================

    document.getElementById("app").innerHTML = `

        <h2>
            📊 RELATÓRIO
        </h2>


        <div class="card">

            <p>
                <b>📅 Período:</b>
                ${inicioBR}
                até
                ${fimBR}
            </p>


            <hr>


            <h2>
                ⏱️
                ${formatarDuracao(
                    totalMinutos
                )}
            </h2>


            <p>
                <b>
                    Tempo total de máquina parada
                </b>
            </p>


            <hr>


            <h3>
                🏆 Motivo Campeão
            </h3>


            <p>
                ${
                    motivoCampeao
                    ? motivoCampeao.nome
                    : "Nenhum"
                }
            </p>


            ${
                motivoCampeao
                ? `

                    <p>
                        ⏱️
                        ${formatarDuracao(
                            motivoCampeao.valor
                        )}
                    </p>

                `
                : ""
            }


            <hr>


            <h3>
                🏭 Sala com Maior Tempo de Parada
            </h3>


            <p>
                ${
                    salaCampea
                    ? salaCampea.nome
                    : "Nenhuma"
                }
            </p>


            ${
                salaCampea
                ? `

                    <p>
                        ⏱️
                        ${formatarDuracao(
                            salaCampea.valor
                        )}
                    </p>

                `
                : ""
            }


            <hr>


            <h3>
                🥧 Distribuição das Paradas
            </h3>


            ${
                dadosGrafico.length > 0
                ? `

                    <canvas
                        id="graficoPizza"
                        width="320"
                        height="320"
                        style="
                            max-width:100%;
                            margin:auto;
                            display:block;
                        "
                    ></canvas>

                    <br>

                    <div
                        id="legendaGrafico"
                    ></div>

                `
                : `

                    <p>
                        Nenhum dado disponível
                        para o gráfico.
                    </p>

                `
            }


            <hr>


            <h3>
                🏆 Ranking dos Motivos
            </h3>


            ${rankingMotivos}


            <hr>


            <h3>
                📊 Total de Registros
            </h3>


            <h2>
                ${paradasPeriodo.length}
            </h2>

        </div>


        <h3>🏭 Paradas por Sala</h3>

        ${resumoPorSala}


        ${historico}


        <br>


        <button
            onclick="abrirRelatorios()"
        >
            🔄 Alterar período
        </button>


        <br><br>


        <button
            onclick="salvarRelatorioPDF()"
        >
            📤 COMPARTILHAR RELATÓRIO
        </button>


        <br><br>


        <button
            onclick="telaInicial()"
        >
            🏠 Início
        </button>

    `;


    // ========================================================
    // DESENHAR GRÁFICO
    // ========================================================

    if (dadosGrafico.length > 0) {

        criarGraficoPizza(
            dadosGrafico
        );


        const legenda =
            document.getElementById(
                "legendaGrafico"
            );


        if (legenda) {

            legenda.innerHTML =
                criarLegendaGrafico(
                    dadosGrafico
                );

        }

    }

}


// ============================================================
// INICIALIZAÇÃO DO STOPTRACK
// ============================================================

telaInicial();
syncIniciar();
realtimeIniciar();

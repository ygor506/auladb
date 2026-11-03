/* ==========================================================
   CONFIGURAÇÃO
   ----------------------------------------------------------
   USAR_BANCO_DE_DADOS = false -> os contatos ficam guardados no
     navegador (localStorage). Serve só para testar a tela.
   USAR_BANCO_DE_DADOS = true  -> a tela conversa com o servidor
     Node.js (arquivo rotas/contatos.js), que usa o MySQL. Nesse caso
     abra a página pelo servidor (http://localhost:3000), nunca com
     duplo clique no arquivo.
   ========================================================== */
const USAR_BANCO_DE_DADOS = false;
const ENDERECO_API = '/api/contatos';
const CHAVE_ARMAZENAMENTO = 'contatos_atividade';
const MAXIMO_LINHAS_NA_TABELA = 300; // mantém a tabela rápida mesmo com muitos contatos

/* ==========================================================
   ELEMENTOS DA PÁGINA
   ========================================================== */
const formulario = document.getElementById('formulario-contato');
const botaoEnviar = formulario.querySelector('.botao-enviar');
const campoMensagem = document.getElementById('mensagem');
const contador = document.getElementById('contador');
const aviso = document.getElementById('aviso');
const janela = document.getElementById('janela-sucesso');
const janelaTexto = document.getElementById('janela-texto');
const campoBusca = document.getElementById('campo-busca');
const resumoResultados = document.getElementById('resumo-resultados');
const corpoTabela = document.getElementById('corpo-tabela');
const cabecalhoTabela = document.querySelector('#tabela-contatos thead');

/* ==========================================================
   ESTADO DA TELA
   ========================================================== */
let contatosAtuais = [];
let termoBusca = '';
let ordenacao = { coluna: 'cadastrado_em', sentido: -1 }; // 1 = A-Z, -1 = Z-A
let idDestacado = null;
let numeroRequisicao = 0;
let temporizadorAviso;
let temporizadorBusca;

/* ==========================================================
   CAMADA DE DADOS
   Toda a comunicação com o banco passa por aqui. Cada função
   chama uma rota do servidor (quando USAR_BANCO_DE_DADOS é true)
   ou usa o localStorage (quando é false).
   ========================================================== */
const pausa = (milissegundos) => new Promise((resolver) => setTimeout(resolver, milissegundos));

async function chamarApi(caminho, opcoes) {
  let resposta;
  try {
    resposta = await fetch(ENDERECO_API + caminho, opcoes);
  } catch (erro) {
    throw new Error('Não foi possível falar com o servidor.');
  }

  let dados;
  try {
    dados = await resposta.json();
  } catch (erro) {
    throw new Error('O servidor devolveu uma resposta inválida.');
  }

  if (!resposta.ok || !dados.sucesso) {
    throw new Error(dados.mensagem || 'Erro ao processar o pedido.');
  }
  return dados;
}

function enviarJson(dados, metodo) {
  return {
    method: metodo || 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados)
  };
}

function lerContatosLocais() {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_ARMAZENAMENTO) || '[]');
  } catch (erro) {
    return [];
  }
}

function salvarContatosLocais(contatos) {
  localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(contatos));
}

const repositorio = {
  // Devolve todos os contatos. Rota: GET /api/contatos
  async listar() {
    if (USAR_BANCO_DE_DADOS) {
      return (await chamarApi('')).dados;
    }
    return lerContatosLocais();
  },

  // Devolve só os contatos que combinam com o termo. Rota: GET /api/contatos/busca
  async buscar(termo) {
    if (USAR_BANCO_DE_DADOS) {
      return (await chamarApi('/busca?termo=' + encodeURIComponent(termo))).dados;
    }
    return lerContatosLocais().filter((contato) => contatoCombinaComBusca(contato, termo));
  },

  // Grava um contato novo e devolve o id dele. Rota: POST /api/contatos
  async cadastrar(contato) {
    if (USAR_BANCO_DE_DADOS) {
      return (await chamarApi('', enviarJson(contato))).id;
    }
    await pausa(900); // só para mostrar o efeito de carregando
    const contatos = lerContatosLocais();
    const novo = Object.assign({ id: Date.now(), cadastrado_em: new Date().toISOString() }, contato);
    contatos.push(novo);
    salvarContatosLocais(contatos);
    return novo.id;
  },

  // Apaga um contato pelo id. Rota: DELETE /api/contatos/:id
  async excluir(id) {
    if (USAR_BANCO_DE_DADOS) {
      await chamarApi('/' + encodeURIComponent(id), { method: 'DELETE' });
      return;
    }
    salvarContatosLocais(lerContatosLocais().filter((contato) => String(contato.id) !== String(id)));
  }
};

/* ==========================================================
   TEXTO: normalização, busca e destaque
   ========================================================== */
function normalizar(texto) {
  return String(texto == null ? '' : texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

const SUBSTITUTOS_HTML = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escaparHtml(texto) {
  return String(texto == null ? '' : texto).replace(/[&<>"']/g, (letra) => SUBSTITUTOS_HTML[letra]);
}

// Quebra o que foi digitado em palavras (sem acento e em minúsculas).
function separarTermos(texto) {
  return normalizar(texto).split(/\s+/).filter(Boolean);
}

// Só usado quando não há banco: todas as palavras precisam aparecer em algum campo.
function contatoCombinaComBusca(contato, termo) {
  const texto = normalizar([
    contato.nome, contato.email, contato.telefone, contato.cidade, contato.estado,
    contato.assunto, contato.preferencia, contato.mensagem
  ].join(' '));
  return separarTermos(termo).every((palavra) => texto.includes(palavra));
}

// Devolve o texto em HTML com as palavras buscadas dentro de <mark>.
function destacar(texto, termos) {
  texto = String(texto == null ? '' : texto);
  if (termos.length === 0) return escaparHtml(texto);

  // Caminho rápido: se nenhuma palavra aparece neste texto, não há nada a destacar.
  const textoNormalizado = normalizar(texto);
  if (!termos.some((termo) => textoNormalizado.includes(termo))) return escaparHtml(texto);

  let normalizado = '';
  const mapa = []; // posição no texto normalizado -> posição no texto original
  for (let i = 0; i < texto.length; i++) {
    const parte = normalizar(texto[i]);
    for (let j = 0; j < parte.length; j++) mapa.push(i);
    normalizado += parte;
  }

  const marcado = new Array(texto.length).fill(false);
  termos.forEach((termo) => {
    let posicao = normalizado.indexOf(termo);
    while (posicao !== -1) {
      for (let k = posicao; k < posicao + termo.length; k++) marcado[mapa[k]] = true;
      posicao = normalizado.indexOf(termo, posicao + termo.length);
    }
  });

  let html = '';
  let dentro = false;
  for (let i = 0; i < texto.length; i++) {
    if (marcado[i] && !dentro) { html += '<mark>'; dentro = true; }
    if (!marcado[i] && dentro) { html += '</mark>'; dentro = false; }
    html += escaparHtml(texto[i]);
  }
  if (dentro) html += '</mark>';
  return html;
}

function formatarData(dataIso) {
  if (!dataIso) return '—';
  const partes = String(dataIso).slice(0, 10).split('-');
  return partes[2] + '/' + partes[1] + '/' + partes[0];
}

/* ==========================================================
   TABELA DE CONTATOS
   ========================================================== */
// Compara textos ignorando acento e maiúsculas, e números pelo valor (2 antes de 10).
const comparador = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

function ordenarContatos(contatos) {
  const { coluna, sentido } = ordenacao;
  return contatos.slice().sort(function (a, b) {
    return comparador.compare(String(a[coluna] == null ? '' : a[coluna]), String(b[coluna] == null ? '' : b[coluna])) * sentido;
  });
}

function atualizarCabecalho() {
  cabecalhoTabela.querySelectorAll('th[data-coluna]').forEach(function (th) {
    const ativa = th.dataset.coluna === ordenacao.coluna;
    th.setAttribute('aria-sort', ativa ? (ordenacao.sentido === 1 ? 'ascending' : 'descending') : 'none');
  });
}

function atualizarResumo() {
  const total = contatosAtuais.length;
  const palavra = total === 1 ? 'contato' : 'contatos';
  if (termoBusca) {
    resumoResultados.textContent = total + ' ' + palavra + ' encontrado' + (total === 1 ? '' : 's') + ' para "' + termoBusca + '"';
  } else {
    resumoResultados.textContent = total + ' ' + palavra + ' cadastrado' + (total === 1 ? '' : 's');
  }
}

function mostrarLinhaUnica(texto) {
  corpoTabela.innerHTML = '<tr class="linha-vazia"><td colspan="8">' + escaparHtml(texto) + '</td></tr>';
}

function desenharTabela() {
  atualizarCabecalho();
  atualizarResumo();

  if (contatosAtuais.length === 0) {
    mostrarLinhaUnica(termoBusca
      ? 'Nenhum contato encontrado para essa busca.'
      : 'Nenhum contato cadastrado ainda.');
    return;
  }

  const termos = separarTermos(termoBusca);
  const ordenados = ordenarContatos(contatosAtuais);
  const linhas = ordenados.slice(0, MAXIMO_LINHAS_NA_TABELA).map(function (contato) {
    const classeNova = String(contato.id) === String(idDestacado) ? ' class="linha-nova"' : '';
    return '<tr' + classeNova + '>' +
      '<td class="celula-nome" title="' + escaparHtml(contato.mensagem) + '">' + destacar(contato.nome, termos) + '</td>' +
      '<td>' + destacar(contato.email, termos) + '</td>' +
      '<td class="nao-quebra col-telefone">' + destacar(contato.telefone, termos) + '</td>' +
      '<td>' + destacar((contato.cidade || '') + ' - ' + (contato.estado || ''), termos) + '</td>' +
      '<td class="nao-quebra">' + destacar(contato.assunto, termos) + '</td>' +
      '<td class="nao-quebra col-retorno">' + formatarData(contato.data_retorno) + '</td>' +
      '<td class="col-preferencia"><span class="etiqueta">' + destacar(contato.preferencia, termos) + '</span></td>' +
      '<td class="nao-quebra"><button type="button" class="botao-excluir" data-id="' + escaparHtml(contato.id) + '">Excluir</button></td>' +
      '</tr>';
  }).join('');

  const linhaLimite = ordenados.length > MAXIMO_LINHAS_NA_TABELA
    ? '<tr class="linha-vazia"><td colspan="8">Mostrando ' + MAXIMO_LINHAS_NA_TABELA + ' de ' + ordenados.length + '. Use a busca para encontrar os outros.</td></tr>'
    : '';
  corpoTabela.innerHTML = linhas + linhaLimite;
  idDestacado = null;
}

async function carregarContatos() {
  const minhaRequisicao = ++numeroRequisicao;
  try {
    const lista = termoBusca ? await repositorio.buscar(termoBusca) : await repositorio.listar();
    if (minhaRequisicao !== numeroRequisicao) return; // chegou uma busca mais nova, ignora esta
    contatosAtuais = lista;
    desenharTabela();
  } catch (erro) {
    if (minhaRequisicao !== numeroRequisicao) return;
    contatosAtuais = [];
    resumoResultados.textContent = 'Erro ao carregar';
    mostrarLinhaUnica('Não foi possível carregar os contatos.');
    mostrarAviso(erro.message);
  }
}

// Busca enquanto digita, esperando uma pequena pausa para não sobrecarregar.
campoBusca.addEventListener('input', function () {
  clearTimeout(temporizadorBusca);
  temporizadorBusca = setTimeout(function () {
    termoBusca = campoBusca.value.trim();
    carregarContatos();
  }, 250);
});

campoBusca.addEventListener('keydown', function (evento) {
  if (evento.key === 'Escape' && campoBusca.value !== '') {
    campoBusca.value = '';
    termoBusca = '';
    carregarContatos();
  }
});

// Clique no título da coluna ordena; clicar de novo inverte.
cabecalhoTabela.addEventListener('click', function (evento) {
  const botao = evento.target.closest('.ordenar');
  if (!botao) return;
  const coluna = botao.closest('th').dataset.coluna;
  if (ordenacao.coluna === coluna) {
    ordenacao.sentido = -ordenacao.sentido;
  } else {
    ordenacao = { coluna: coluna, sentido: 1 };
  }
  desenharTabela();
});

// Excluir pede uma segunda confirmação no próprio botão.
corpoTabela.addEventListener('click', async function (evento) {
  const botao = evento.target.closest('.botao-excluir');
  if (!botao) return;

  if (!botao.classList.contains('confirmando')) {
    botao.classList.add('confirmando');
    botao.textContent = 'Confirmar?';
    setTimeout(function () {
      botao.classList.remove('confirmando');
      botao.textContent = 'Excluir';
    }, 3000);
    return;
  }

  botao.disabled = true;
  try {
    await repositorio.excluir(botao.dataset.id);
    mostrarAviso('Contato excluído.', 'sucesso');
    await carregarContatos();
  } catch (erro) {
    botao.disabled = false;
    mostrarAviso(erro.message);
  }
});

/* ==========================================================
   FORMULÁRIO
   ========================================================== */
// Máscara do telefone: (00) 00000-0000
formulario.telefone.addEventListener('input', function () {
  let numeros = this.value.replace(/\D/g, '').slice(0, 11);
  if (numeros.length > 6) {
    numeros = '(' + numeros.slice(0, 2) + ') ' + numeros.slice(2, 7) + '-' + numeros.slice(7);
  } else if (numeros.length > 2) {
    numeros = '(' + numeros.slice(0, 2) + ') ' + numeros.slice(2);
  }
  this.value = numeros;
});

campoMensagem.addEventListener('input', function () {
  contador.textContent = this.value.length + '/300';
});

function mostrarAviso(texto, tipo) {
  aviso.textContent = texto;
  aviso.className = 'aviso visivel' + (tipo === 'sucesso' ? ' sucesso' : '');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(function () {
    aviso.classList.remove('visivel');
  }, 3500);
}

function marcarErro(campo, texto) {
  const caixa = campo.closest('.campo');
  caixa.classList.remove('invalido');
  void caixa.offsetWidth; // reinicia a animação de tremor
  caixa.classList.add('invalido');
  caixa.querySelector('.erro-campo').textContent = texto;
}

function limparErros() {
  formulario.querySelectorAll('.campo.invalido').forEach(function (caixa) {
    caixa.classList.remove('invalido');
  });
}

// Limpa o erro do campo assim que o usuário mexe nele.
['input', 'change'].forEach(function (tipoEvento) {
  formulario.addEventListener(tipoEvento, function (evento) {
    const caixa = evento.target.closest('.campo');
    if (caixa) caixa.classList.remove('invalido');
  });
});

function validar() {
  limparErros();
  let primeiroErro = null;

  function falhar(campo, texto) {
    marcarErro(campo, texto);
    if (!primeiroErro) primeiroErro = campo;
  }

  if (formulario.nome.value.trim().split(/\s+/).length < 2) {
    falhar(formulario.nome, 'Informe nome e sobrenome.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formulario.email.value.trim())) {
    falhar(formulario.email, 'Informe um e-mail válido.');
  }
  if (formulario.telefone.value.replace(/\D/g, '').length < 10) {
    falhar(formulario.telefone, 'Informe um telefone com DDD.');
  }
  if (formulario.cidade.value.trim().length < 2) {
    falhar(formulario.cidade, 'Informe a cidade.');
  }
  if (formulario.estado.value === '') {
    falhar(formulario.estado, 'Selecione o estado.');
  }
  if (formulario.assunto.value === '') {
    falhar(formulario.assunto, 'Selecione o assunto.');
  }
  if (formulario.data_retorno.value === '') {
    falhar(formulario.data_retorno, 'Escolha uma data.');
  }
  if (formulario.mensagem.value.trim().length < 10) {
    falhar(formulario.mensagem, 'Escreva ao menos 10 caracteres.');
  }
  if (!formulario.aceite.checked) {
    falhar(formulario.aceite, 'É preciso concordar para enviar.');
  }

  if (primeiroErro) primeiroErro.focus();
  return primeiroErro === null;
}

/* ==========================================================
   JANELA DE SUCESSO E CONFETE
   ========================================================== */
function lancarConfete() {
  const area = document.getElementById('confete');
  const cores = ['#f5a524', '#34d399', '#e7e9ee', '#8b93a7', '#f87171'];
  for (let i = 0; i < 70; i++) {
    const pedaco = document.createElement('i');
    pedaco.style.left = Math.random() * 100 + 'vw';
    pedaco.style.background = cores[i % cores.length];
    pedaco.style.animationDuration = 2 + Math.random() * 2 + 's';
    pedaco.style.animationDelay = Math.random() * 0.6 + 's';
    area.appendChild(pedaco);
  }
  setTimeout(function () { area.innerHTML = ''; }, 5000);
}

function abrirJanela(contato, total) {
  const primeiroNome = contato.nome.split(' ')[0];
  janelaTexto.textContent =
    'Obrigado, ' + primeiroNome + '! Recebemos sua mensagem e retornaremos por ' +
    contato.preferencia + '. Total de contatos cadastrados: ' + total + '.';
  janela.classList.add('aberto');
  janela.setAttribute('aria-hidden', 'false');
  lancarConfete();
}

function fecharJanela() {
  janela.classList.remove('aberto');
  janela.setAttribute('aria-hidden', 'true');
}

document.getElementById('janela-fechar').addEventListener('click', fecharJanela);
janela.addEventListener('click', function (evento) {
  if (evento.target === janela) fecharJanela();
});
document.addEventListener('keydown', function (evento) {
  if (evento.key === 'Escape') fecharJanela();
});

/* ==========================================================
   ENVIO DO FORMULÁRIO
   ========================================================== */
formulario.addEventListener('submit', async function (evento) {
  evento.preventDefault();

  if (!validar()) {
    mostrarAviso('Revise os campos destacados.');
    return;
  }

  // Os nomes das chaves são os mesmos usados no PHP e nas colunas da tabela.
  const contato = {
    nome: formulario.nome.value.trim(),
    email: formulario.email.value.trim(),
    telefone: formulario.telefone.value,
    cidade: formulario.cidade.value.trim(),
    estado: formulario.estado.value,
    assunto: formulario.assunto.value,
    data_retorno: formulario.data_retorno.value,
    preferencia: formulario.preferencia.value,
    mensagem: formulario.mensagem.value.trim()
  };

  botaoEnviar.classList.add('carregando');
  botaoEnviar.disabled = true;

  try {
    const idNovo = await repositorio.cadastrar(contato);
    formulario.reset();
    contador.textContent = '0/300';

    // Limpa a busca para o contato novo aparecer na tabela.
    campoBusca.value = '';
    termoBusca = '';
    idDestacado = idNovo;
    await carregarContatos();

    abrirJanela(contato, contatosAtuais.length);
  } catch (erro) {
    mostrarAviso(erro.message);
  } finally {
    botaoEnviar.classList.remove('carregando');
    botaoEnviar.disabled = false;
  }
});

carregarContatos();

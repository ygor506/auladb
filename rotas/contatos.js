// Rotas dos contatos. Cada rota tem um lugar marcado com ">>> ALUNO"
// onde você escreve o comando SQL. Enquanto estiver vazio, a página
// mostra um aviso pedindo o comando.
const express = require('express');
const conexao = require('../conexao');

const roteador = express.Router();

// Responde com aviso se o aluno ainda não escreveu o SQL. Devolve true se respondeu.
function sqlVazio(sql, resposta, rota) {
  if (sql.trim() !== '') return false;
  resposta.status(501).json({
    sucesso: false,
    mensagem: 'Escreva o comando SQL em rotas/contatos.js (' + rota + ').'
  });
  return true;
}

function erroNoBanco(resposta, erro) {
  console.error(erro);
  resposta.status(500).json({ sucesso: false, mensagem: 'Erro no banco: ' + erro.message });
}

/* ----------------------------------------------------------
   LISTAR  ->  GET /api/contatos
   ---------------------------------------------------------- */
roteador.get('/', async function (requisicao, resposta) {
  // >>> ALUNO: escreva o comando SQL que traz todos os contatos.
  // As colunas devolvidas precisam ter exatamente estes nomes (use AS se for preciso):
  //   id, nome, email, telefone, cidade, estado, assunto,
  //   data_retorno, preferencia, mensagem, cadastrado_em
  const sql = '';

  if (sqlVazio(sql, resposta, 'listar')) return;

  try {
    const [linhas] = await conexao.execute(sql);
    resposta.json({ sucesso: true, dados: linhas });
  } catch (erro) {
    erroNoBanco(resposta, erro);
  }
});

/* ----------------------------------------------------------
   BUSCAR  ->  GET /api/contatos/busca?termo=maria
   ---------------------------------------------------------- */
roteador.get('/busca', async function (requisicao, resposta) {
  const termo = String(requisicao.query.termo || '').trim();

  // O parâmetro :termo já chega com % nas pontas (ex.: %maria%), pronto para
  // comparar com parte do texto. Pode usar :termo mais de uma vez no comando.
  // Dica: o MySQL costuma ignorar maiúsculas e acentos nessa comparação.
  // Buscar por várias palavras ao mesmo tempo é um desafio extra.
  const parametros = { termo: '%' + termo.replace(/[\\%_]/g, '\\$&') + '%' };

  // >>> ALUNO: escreva o comando SQL da busca. Procure o termo nos campos
  // nome, email, telefone, cidade, assunto e mensagem.
  // As colunas devolvidas são as mesmas da rota de listar.
  const sql = '';

  if (sqlVazio(sql, resposta, 'buscar')) return;

  try {
    const [linhas] = await conexao.execute(sql, parametros);
    resposta.json({ sucesso: true, dados: linhas });
  } catch (erro) {
    erroNoBanco(resposta, erro);
  }
});

/* ----------------------------------------------------------
   CADASTRAR  ->  POST /api/contatos   (corpo em JSON)
   ---------------------------------------------------------- */
roteador.post('/', async function (requisicao, resposta) {
  const dados = requisicao.body || {};

  // Validação no servidor (a da página pode ser burlada, esta não).
  const obrigatorios = ['nome', 'email', 'telefone', 'cidade', 'estado', 'assunto', 'data_retorno', 'preferencia', 'mensagem'];
  for (const campo of obrigatorios) {
    if (String(dados[campo] || '').trim() === '') {
      return resposta.status(422).json({ sucesso: false, mensagem: 'O campo "' + campo + '" é obrigatório.' });
    }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(dados.email).trim())) {
    return resposta.status(422).json({ sucesso: false, mensagem: 'E-mail inválido.' });
  }

  // Valores prontos para o comando SQL. Use estes nomes como parâmetros (:nome, :email...).
  const parametros = {
    nome: String(dados.nome).trim(),
    email: String(dados.email).trim(),
    telefone: String(dados.telefone).trim(),
    cidade: String(dados.cidade).trim(),
    estado: String(dados.estado).trim(),
    assunto: String(dados.assunto).trim(),
    data_retorno: String(dados.data_retorno).trim(),
    preferencia: String(dados.preferencia).trim(),
    mensagem: String(dados.mensagem).trim()
  };

  // >>> ALUNO: escreva o comando SQL que grava o contato, usando os parâmetros
  // acima. A data e hora do cadastro (cadastrado_em) pode ser preenchida
  // pelo próprio banco.
  const sql = '';

  if (sqlVazio(sql, resposta, 'cadastrar')) return;

  try {
    const [resultado] = await conexao.execute(sql, parametros);
    resposta.status(201).json({ sucesso: true, id: resultado.insertId });
  } catch (erro) {
    erroNoBanco(resposta, erro);
  }
});

/* ----------------------------------------------------------
   EXCLUIR  ->  DELETE /api/contatos/5
   ---------------------------------------------------------- */
roteador.delete('/:id', async function (requisicao, resposta) {
  const id = parseInt(requisicao.params.id, 10);
  if (!(id > 0)) {
    return resposta.status(422).json({ sucesso: false, mensagem: 'Informe o id do contato.' });
  }

  // Use o parâmetro :id no comando SQL.
  const parametros = { id: id };

  // >>> ALUNO: escreva o comando SQL que apaga o contato com esse id.
  const sql = '';

  if (sqlVazio(sql, resposta, 'excluir')) return;

  try {
    await conexao.execute(sql, parametros);
    resposta.json({ sucesso: true });
  } catch (erro) {
    erroNoBanco(resposta, erro);
  }
});

module.exports = roteador;

// Servidor da atividade. Entrega a página (pasta publico/) e a API (/api/contatos).
// Para rodar: npm install (só na primeira vez) e depois npm start.
const express = require('express');
const path = require('path');
const conexao = require('./conexao');
const rotasContatos = require('./rotas/contatos');

const aplicacao = express();
const PORTA = 3000;

aplicacao.use(express.json({ limit: '100kb' }));
aplicacao.use(express.static(path.join(__dirname, 'publico')));
aplicacao.use('/api/contatos', rotasContatos);

// Qualquer outro endereço /api/... não existe.
aplicacao.use('/api', function (requisicao, resposta) {
  resposta.status(404).json({ sucesso: false, mensagem: 'Rota não encontrada: ' + requisicao.originalUrl });
});

// Corpo da requisição com JSON quebrado.
aplicacao.use(function (erro, requisicao, resposta, proximo) {
  resposta.status(400).json({ sucesso: false, mensagem: 'Requisição inválida.' });
});

aplicacao.listen(PORTA, function () {
  console.log('Servidor rodando em http://localhost:' + PORTA);

  // Testa a conexão com o MySQL já na partida, para o aluno saber logo se os dados estão certos.
  conexao.getConnection()
    .then(function (ligacao) {
      ligacao.release();
      console.log('MySQL: conectado.');
    })
    .catch(function (erro) {
      console.log('MySQL: sem conexão (' + (erro.code || erro.message || 'erro desconhecido') + ').');
      console.log('Tudo bem enquanto USAR_BANCO_DE_DADOS for false. Para usar o banco, confira o conexao.js.');
    });
});

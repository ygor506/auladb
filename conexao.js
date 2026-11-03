// Conexão com o MySQL local. Usada pelo arquivo rotas/contatos.js.
const mysql = require('mysql2/promise');

// >>> ALUNO: preencha com os dados do seu MySQL.
const configuracao = {
  host: 'localhost',
  port: 3306,
  database: '',
  user: '',
  password: ''
};

// Conjunto de conexões reaproveitadas. Para executar um comando use:
//   const [linhas] = await conexao.execute(sql, parametros);
const conexao = mysql.createPool({
  ...configuracao,
  charset: 'utf8mb4',
  namedPlaceholders: true, // permite parâmetros com nome, como :nome
  dateStrings: true        // datas voltam como texto (2025-12-31), sem mudança de fuso
});

module.exports = conexao;

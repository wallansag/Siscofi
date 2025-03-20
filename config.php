<?php

$servername = 'Localhost';
$useername = 'root';
$password = '';
$dbName = 'formulaio-siscofi';

$conn = new mysqli($servername, $username, $password, $dbName
);
if ($conexao->connect_error) {
    die('Erro'. $conexao->connect_error);
}
$nome = $_POST['nome'];
$cpf = $_POST['cpf'];
$email = $_POST['email'];
$telefone = $_POST['telefone'];
$genero = $_POST['genero'];
$data_nascimento = $_POST['data_nascimento'];
$senha = $_POST['senha'];
$confirmar_senha = $_POST['confirmar_senha'];
if ($senha !== $confirmar_senha) {
    echo "As senhas não coincidem!";
    exit;
}

$sql = "INSERT INTO usuarios (nome, cpf, email, telefone, genero, data_nascimento, senha) 
        VALUES ('$nome', '$cpf', '$email', '$telefone', '$genero', '$data_nascimento', '$senha')";


if ($conn->query($sql) === TRUE) {
    echo "Usuário cadastrado";
} else {
    echo "Erro: " . $sql . "<br>" . $conn->error;
}


$conn->close();
<?php

$servername = 'Localhost';
$username = 'root';
$password = 'Genesis@614';
$dbName = 'formulario-si';
try{

$conn = new mysqli($servername, $username, $password, $dbName
);
if ($conn->connect_error) {
    die('Erro'. $conn->connect_error);
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
    throw new Exception( "As senhas não coincidem!");
    
}
$senha_hash = password_hash($senha, PASSWORD_DEFAULT);

$sql = "INSERT INTO usuarios (nome, cpf, email, telefone, genero, data_nascimento, senha) 
            VALUES (?, ?, ?, ?, ?, ?, ?)";

    $stmt = $conn->prepare($sql);
    $stmt->bind_param("sssssss", $nome, $cpf, $email, $telefone, $genero, $data_nascimento, $senha_hash);
    $stmt->execute();


    if ($stmt->affected_rows > 0) {
        echo "Usuário cadastrado";
    } else {
        throw new Exception("Erro ao cadastrar usuário");
    }

    $stmt->close();
    $conn->close();
} catch (Exception $e) {
    echo "Erro: " . $e->getMessage();
}

?>
import { storeToken, storeUserData } from './auth.js';

const API_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterButton = document.getElementById('showRegister');
    const showLoginButton = document.getElementById('showLogin');
    const loginContainer = document.getElementById('loginContainer');
    const registerContainer = document.getElementById('registerContainer');

    showRegisterButton.addEventListener('click', (e) => {
        e.preventDefault();
        loginContainer.classList.add('hidden');
        registerContainer.classList.remove('hidden');
    });

    showLoginButton.addEventListener('click', (e) => {
        e.preventDefault();
        registerContainer.classList.add('hidden');
        loginContainer.classList.remove('hidden');
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const cpf = document.getElementById('cpfLogin').value;
        const senha = document.getElementById('senhaLogin').value;

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cpf, senha })
            });
            const data = await response.json();
            if (response.ok) {
                storeToken(data.token);
                storeUserData(data);
                window.location.href = 'tela-inicial.html';
            } else {
                alert(data.message);
            }
        } catch (error) {
            alert('Erro ao tentar fazer login. Tente novamente mais tarde.');
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = {
            nome: document.getElementById('nome').value,
            cpf: document.getElementById('cpf').value,
            email: document.getElementById('email').value,
            telefone: document.getElementById('telefone').value,
            genero: document.getElementById('genero').value,
            data_nascimento: document.getElementById('data_nascimento').value,
            senha: document.getElementById('senha').value,
        };
        const confirmar_senha = document.getElementById('confirmar_senha').value;
        if (formData.senha !== confirmar_senha) return alert('As senhas não coincidem!');
        
        try {
            const response = await fetch(`${API_URL}/cadastrar-usuario`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await response.json();
            alert(data.message);
            if (response.ok) {
                registerForm.reset();
                showLoginButton.click();
            }
        } catch (error) {
            alert('Erro ao tentar cadastrar. Tente novamente mais tarde.');
        }
    });
});
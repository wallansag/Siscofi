const API_URL = 'http://localhost:3000';

export function storeToken(token) {
    localStorage.setItem('authToken', token);
}

export function getToken() {
    return localStorage.getItem('authToken');
}

export function storeUserData(data) {
    localStorage.setItem('userId', data.userId);
    localStorage.setItem('userName', data.userName);
}

export function getUserName() {
    return localStorage.getItem('userName');
}

export function getUserId() {
    return localStorage.getItem('userId');
}

export function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    window.location.href = 'index.html';
}

export function redirectToLoginIfNotAuthenticated() {
    if (!getToken()) {
        alert('Sua sessão expirou ou você não está logado. Por favor, faça login novamente.');
        logout();
    }
}

export async function fetchWithAuth(url, options = {}) {
    const token = getToken();
    if (!token && !url.includes('/login') && !url.includes('/cadastrar-usuario') && !url.includes('/solicitar-recuperacao-senha')) {
        redirectToLoginIfNotAuthenticated();
        throw new Error('Token de autenticação não encontrado.');
    }

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${url}`, { ...options, headers });

    if ((response.status === 401 || response.status === 403) && !url.includes('/login')) {
        redirectToLoginIfNotAuthenticated();
        throw new Error('Acesso não autorizado ou token inválido.');
    }

    return response;
}

export const formatCurrency = (value) => {
    const numericValue = Number(value) || 0;
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(numericValue);
};
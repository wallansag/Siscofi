import { getUserName, getToken, logout, fetchWithAuth, getUserRole } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
        logout();
        return;
    }
    
    const logoutButton = document.getElementById('logoutButton');
    if(logoutButton) logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });
    
    const userRole = getUserRole();
    if (userRole === 'ADMIN') {
        const mainNav = document.querySelector('.main-nav');
        const logoutBtn = document.getElementById('logoutButton');
        if (mainNav && logoutBtn && !document.querySelector('a[href="admin-usuarios.html"]')) {
            const adminLink = document.createElement('a');
            adminLink.href = 'admin-usuarios.html';
            adminLink.textContent = 'Admin';
            mainNav.insertBefore(adminLink, logoutBtn);
        }
    }
    
    loadDicas();
});

async function loadDicas() {
    const container = document.getElementById('dicasContainer');
    if (!container) return;
    container.innerHTML = '<p>Carregando dicas personalizadas...</p>';

    try {
        const response = await fetchWithAuth('/api/dicas');
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'Falha ao carregar dicas.' }));
            throw new Error(errorData.message);
        }
        
        const dicas = await response.json();
        container.innerHTML = '';

        if (dicas.length === 0) {
            container.innerHTML = '<p>Não encontramos dicas específicas para você no momento, mas lembre-se de sempre revisar seus gastos e focar nas suas metas!</p>';
            return;
        }

        dicas.forEach(dica => {
            const dicaCard = document.createElement('div');
            dicaCard.className = 'dica-card';
            
            dicaCard.innerHTML = `
                <h4><i class="fas fa-lightbulb"></i> ${dica.titulo}</h4>
                <p>${dica.descricao}</p>
            `;
            container.appendChild(dicaCard);
        });

    } catch (error) {
        container.innerHTML = `<p style="color: red;">Erro ao carregar dicas: ${error.message}</p>`;
    }
}
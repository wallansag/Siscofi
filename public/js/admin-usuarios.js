import { redirectToLoginIfNotAuthenticated, logout, fetchWithAuth, getUserRole, getUserId } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    redirectToLoginIfNotAuthenticated();

    if (getUserRole() !== 'ADMIN') {
        alert('Acesso negado. Esta página é restrita a administradores.');
        window.location.href = 'tela-inicial.html';
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
            adminLink.className = 'active';
            mainNav.insertBefore(adminLink, logoutBtn);
        }
    }
    
    setupEventListeners();
    loadUsers();
});

function setupEventListeners() {
    const userListBody = document.getElementById('userListBody');
    const editUserModal = document.getElementById('editUserModal');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const editUserForm = document.getElementById('editUserForm');

    if (userListBody) {
        userListBody.addEventListener('click', (e) => {
            const target = e.target;
            const editButton = target.closest('.btn-edit-user');
            const deleteButton = target.closest('.btn-delete-user');
            
            if (editButton) {
                const userId = editButton.dataset.id;
                const userName = editButton.dataset.name;
                const userRole = editButton.dataset.role;
                openEditModal(userId, userName, userRole);
            }
            if (deleteButton) {
                const userId = deleteButton.dataset.id;
                const userName = deleteButton.dataset.name;
                if (confirm(`Tem certeza que deseja excluir o usuário "${userName}" (ID: ${userId})? Esta ação não pode ser desfeita.`)) {
                    deleteUser(userId);
                }
            }
        });
    }

    if(cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => editUserModal.classList.add('hidden'));
    }

    if(editUserForm) {
        editUserForm.addEventListener('submit', handleEditUserSubmit);
    }
}

async function loadUsers() {
    const tableBody = document.getElementById('userListBody');
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 1rem;">Carregando usuários...</td></tr>`;

    try {
        const response = await fetchWithAuth('/api/admin/usuarios');
        if (!response.ok) throw new Error('Falha ao buscar a lista de usuários.');

        const users = await response.json();
        tableBody.innerHTML = '';
        
        const currentAdminId = parseInt(getUserId(), 10);

        if (users.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 1rem;">Nenhum usuário encontrado.</td></tr>`;
            return;
        }

        users.forEach(user => {
            const row = document.createElement('tr');
            const dataCadastroFormatada = new Date(user.data_cadastro).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
            const isCurrentUserAdmin = user.id === currentAdminId;
            
            row.innerHTML = `
                <td>${user.id}</td>
                <td>${user.nome}</td>
                <td>${user.email}</td>
                <td>${user.cpf}</td>
                <td><span class="role-${user.role.toLowerCase()}">${user.role}</span></td>
                <td>${dataCadastroFormatada}</td>
                <td class="action-buttons">
                    <button class="btn-edit-user" data-id="${user.id}" data-name="${user.nome}" data-role="${user.role}" title="Editar Cargo">
                        <i class="fas fa-user-shield"></i>
                    </button>
                    <button class="btn-delete-user" data-id="${user.id}" data-name="${user.nome}" title="Excluir Usuário" ${isCurrentUserAdmin ? 'disabled' : ''}>
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });

    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 1rem; color: red;">${error.message}</td></tr>`;
    }
}

function openEditModal(userId, userName, userRole) {
    document.getElementById('editUserId').value = userId;
    document.getElementById('editingUserName').textContent = userName;
    document.getElementById('editUserRole').value = userRole;
    document.getElementById('editUserModal').classList.remove('hidden');
}

async function handleEditUserSubmit(e) {
    e.preventDefault();
    const userId = document.getElementById('editUserId').value;
    const newRole = document.getElementById('editUserRole').value;

    try {
        const response = await fetchWithAuth(`/api/admin/usuarios/${userId}`, {
            method: 'PUT',
            body: JSON.stringify({ role: newRole })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        alert(result.message);
        document.getElementById('editUserModal').classList.add('hidden');
        loadUsers();
    } catch (error) {
        alert(`Erro ao atualizar usuário: ${error.message}`);
    }
}

async function deleteUser(userId) {
    try {
        const response = await fetchWithAuth(`/api/admin/usuarios/${userId}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message);

        alert(result.message);
        loadUsers();
    } catch (error) {
        alert(`Erro ao excluir usuário: ${error.message}`);
    }
}
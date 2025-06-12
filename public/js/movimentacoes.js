import { getUserName, getToken, logout, fetchWithAuth, formatCurrency, getUserRole } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    if (!getToken()) {
        logout();
        return;
    }

    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

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
    
    setupEventListeners();
    loadMovimentacoes();
    loadContasRecorrentes();
});

async function loadContasRecorrentes() {
    const select = document.getElementById('movContaRecorrente');
    if (!select) return;
    try {
        const response = await fetchWithAuth('/api/contas-recorrentes');
        const contas = await response.json();
        select.innerHTML = '<option value="">Nenhuma</option>';
        contas.forEach(conta => {
            const option = document.createElement('option');
            option.value = conta.id;
            option.textContent = conta.nome;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erro ao carregar contas recorrentes:', error);
    }
}

function setupEventListeners() {
    const openModalBtn = document.getElementById('openAddMovimentacaoModalBtn');
    const modal = document.getElementById('movimentacaoModal');
    const cancelBtn = document.getElementById('cancelMovimentacaoBtn');
    const form = document.getElementById('movimentacaoForm');
    const tableBody = document.getElementById('movimentacoesTableBody');

    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            form.reset();
            document.getElementById('movimentacaoId').value = '';
            document.getElementById('movimentacaoModalTitle').textContent = 'Adicionar Novo Registro';
            modal.classList.remove('hidden');
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
    }

    if (form) {
        form.addEventListener('submit', handleFormSubmit);
    }

    if (tableBody) {
        tableBody.addEventListener('click', handleTableActions);
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    const modal = document.getElementById('movimentacaoModal');
    const id = document.getElementById('movimentacaoId').value;

    const movimentacaoData = {
        descricao: document.getElementById('movDescricao').value,
        valor: parseFloat(document.getElementById('movValor').value),
        data: document.getElementById('movData').value,
        tipo: document.getElementById('movTipo').value,
        categoria: document.getElementById('movCategoria').value || null,
        tipo_recorrencia: document.getElementById('movTipoRecorrencia').value,
        conta_recorrente_id: document.getElementById('movContaRecorrente').value || null
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/movimentacoes/${id}` : '/movimentacoes';

    try {
        const response = await fetchWithAuth(url, { method, body: JSON.stringify(movimentacaoData) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Falha ao salvar movimentação.');
        
        alert(result.message || 'Movimentação salva com sucesso!');
        modal.classList.add('hidden');
        loadMovimentacoes();
    } catch (error) {
        alert(`Erro: ${error.message}`);
    }
}

async function loadMovimentacoes() {
    const tableBody = document.getElementById('movimentacoesTableBody');
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 1rem;">Carregando...</td></tr>`;
    try {
        const response = await fetchWithAuth('/movimentacoes');
        if (!response.ok) throw new Error('Falha ao carregar movimentações.');
        
        const movimentacoes = await response.json();
        tableBody.innerHTML = '';

        if (movimentacoes.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 1rem;">Nenhuma movimentação encontrada.</td></tr>`;
            return;
        }

        movimentacoes.forEach(mov => {
            const row = document.createElement('tr');
            row.dataset.id = mov.id;
            const tipoClass = mov.tipo === 'ganho' ? 'type-ganho' : 'type-gasto';
            const dataFormatada = new Date(mov.data).toLocaleDateString('pt-BR', {timeZone: 'UTC'});

            row.innerHTML = `
                <td data-label="Data">${dataFormatada}</td>
                <td data-label="Descrição">${mov.descricao}</td>
                <td data-label="Tipo" class="capitalize ${tipoClass}">${mov.tipo}</td>
                <td data-label="Valor" class="${tipoClass}">${formatCurrency(mov.valor)}</td>
                <td data-label="Categoria" class="capitalize">${mov.categoria || '-'}</td>
                <td data-label="Recorrência" class="capitalize">${(mov.tipo_recorrencia || '-').toLowerCase()}</td>
                <td data-label="Ações" class="action-buttons">
                    <button class="btn-edit" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="btn-delete" title="Excluir"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 1rem; color: red;">${error.message}</td></tr>`;
    }
}

async function handleTableActions(e) {
    const target = e.target;
    const movimentacaoRow = target.closest('tr');
    if (!movimentacaoRow || !movimentacaoRow.dataset.id) return;
    
    const movimentacaoId = movimentacaoRow.dataset.id;
    if (target.closest('.btn-delete')) {
        if (confirm('Tem certeza que deseja excluir esta movimentação?')) {
            deleteMovimentacao(movimentacaoId);
        }
    } else if (target.closest('.btn-edit')) {
        loadMovimentacaoForEdit(movimentacaoId); 
    }
}

async function deleteMovimentacao(id) {
    try {
        const response = await fetchWithAuth(`/movimentacoes/${id}`, { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Falha ao excluir.');
        alert(result.message || 'Movimentação excluída!');
        loadMovimentacoes();
    } catch (error) {
        alert(`Erro: ${error.message}`);
    }
}

async function loadMovimentacaoForEdit(id) {
    try {
        const response = await fetchWithAuth(`/movimentacoes/${id}`);
        if (!response.ok) {
            const errorData = await response.json().catch(()=>({message: 'Movimentação não encontrada.'}));
            throw new Error(errorData.message);
        }
        const mov = await response.json();

        document.getElementById('movimentacaoId').value = mov.id;
        document.getElementById('movDescricao').value = mov.descricao;
        document.getElementById('movValor').value = mov.valor;
        document.getElementById('movData').value = new Date(mov.data).toISOString().split('T')[0];
        document.getElementById('movTipo').value = mov.tipo;
        document.getElementById('movCategoria').value = mov.categoria || '';
        document.getElementById('movTipoRecorrencia').value = mov.tipo_recorrencia;
        document.getElementById('movContaRecorrente').value = mov.conta_recorrente_id || '';

        document.getElementById('movimentacaoModalTitle').textContent = 'Editar Registro';
        document.getElementById('movimentacaoModal').classList.remove('hidden');
    } catch (error) {
        alert(`Erro ao carregar movimentação: ${error.message}`);
    }
}
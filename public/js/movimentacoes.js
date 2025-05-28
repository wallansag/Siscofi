import { getUserName, redirectToLoginIfNotAuthenticated, logout, fetchWithAuth, formatCurrency } from './auth.js';

const API_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', () => {
    redirectToLoginIfNotAuthenticated();
    
    const logoutButton = document.getElementById('logoutButton');
    if(logoutButton) logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
    });

    const userNameDisplay = document.querySelector('.app-header .user-info span');
    if (userNameDisplay && getUserName()) {
        userNameDisplay.textContent = getUserName();
    }
    
    setupEventListeners();
    loadMovimentacoes();
});

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
            document.getElementById('movimentacaoModalTitle').textContent = 'Adicionar Nova Movimentação';
            modal.classList.remove('hidden');
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            modal.classList.add('hidden');
        });
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
        tipo_recorrencia: document.getElementById('movTipoRecorrencia').value
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/movimentacoes/${id}` : '/movimentacoes';

    try {
        const response = await fetchWithAuth(url, {
            method: method,
            body: JSON.stringify(movimentacaoData)
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'Falha ao salvar movimentação.');
        }
        
        alert(result.message || 'Movimentação salva com sucesso!');
        modal.classList.add('hidden');
        loadMovimentacoes();

    } catch (error) {
        alert(`Erro: ${error.message}`);
        console.error('Erro ao salvar movimentação:', error);
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
        console.error('Erro ao carregar movimentações:', error);
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
        const response = await fetchWithAuth(`/movimentacoes/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || 'Falha ao excluir movimentação.');
        }
        alert(result.message || 'Movimentação excluída com sucesso!');
        loadMovimentacoes();
    } catch (error) {
        alert(`Erro: ${error.message}`);
        console.error('Erro ao excluir movimentação:', error);
    }
}

async function loadMovimentacaoForEdit(id) {
    try {
        const response = await fetchWithAuth(`/movimentacoes/${id}`);
        if (!response.ok) {
            const errorData = await response.json().catch(()=>({message: 'Movimentação não encontrada para edição.'}));
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

        document.getElementById('movimentacaoModalTitle').textContent = 'Editar Movimentação';
        document.getElementById('movimentacaoModal').classList.remove('hidden');
    } catch (error) {
        alert(`Erro ao carregar movimentação para edição: ${error.message}`);
        console.error('Erro ao carregar para edição:', error);
    }
}
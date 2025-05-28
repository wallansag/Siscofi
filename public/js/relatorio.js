import { getUserId, getUserName, redirectToLoginIfNotAuthenticated, setupLogoutButton, formatCurrency } from './auth.js';

const API_URL = 'http://localhost:3000';
let chartInstances = {};

document.addEventListener('DOMContentLoaded', () => {
    redirectToLoginIfNotAuthenticated();
    setupLogoutButton();

    const userNameDisplay = document.querySelector('.app-header .user-info span');
    if (userNameDisplay) {
        userNameDisplay.textContent = getUserName() || 'Usuário';
    }

    const applyFilterBtn = document.getElementById('applyFilterBtn');
    if(applyFilterBtn) {
        applyFilterBtn.addEventListener('click', loadRelatorioData);
    }

    loadRelatorioData();
});

async function loadRelatorioData() {
    const userId = getUserId();
    const startDate = document.getElementById('startDate')?.value;
    const endDate = document.getElementById('endDate')?.value;

    let url = `${API_URL}/api/relatorios?userId=${userId}`;
    if (startDate) url += `&data_inicio=${startDate}`;
    if (endDate) url += `&data_fim=${endDate}`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha ao carregar dados do relatório.');

        const data = await response.json();
        
        updateSummary(data.resumo);
        renderPieChart('despesasChart', 'Gastos por Categoria', data.gastos_por_categoria);
        renderBarChart('receitasDespesasChart', 'Receitas vs. Despesas', data.resumo_mensal);

    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}

function updateSummary(resumo) {
    if (!resumo) return;
    document.getElementById('totalReceitas').textContent = formatCurrency(resumo.total_ganhos || 0);
    document.getElementById('totalDespesas').textContent = formatCurrency(resumo.total_gastos || 0);
    document.getElementById('saldoRelatorio').textContent = formatCurrency(resumo.saldo || 0);
}

function renderPieChart(canvasId, title, data) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const labels = data.map(d => d.categoria);
    const values = data.map(d => d.total);
    
    chartInstances[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: ['#4299e1', '#f6ad55', '#48bb78', '#ed8936', '#a0aec0', '#ecc94b'],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: title },
                legend: { position: 'top' }
            }
        }
    });
}

function renderBarChart(canvasId, title, data) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    if (chartInstances[canvasId]) chartInstances[canvasId].destroy();

    const labels = data?.map(d => d.mes) || [];
    const receitas = data?.map(d => d.total_ganhos) || [];
    const despesas = data?.map(d => d.total_gastos) || [];

    chartInstances[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Receitas',
                    data: receitas,
                    backgroundColor: '#48bb78',
                },
                {
                    label: 'Despesas',
                    data: despesas,
                    backgroundColor: '#f56565',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: { display: true, text: title }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}
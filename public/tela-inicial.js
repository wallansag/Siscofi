document.addEventListener('DOMContentLoaded', () => {
    const userNameSpan = document.getElementById('userName');
    const ganhosMesSpan = document.getElementById('ganhosMes');
    const gastosMesSpan = document.getElementById('gastosMes');
    const saldoAtualSpan = document.getElementById('saldoAtual');
    const listaUltimasMovimentacoes = document.getElementById('listaUltimasMovimentacoes');
    const logoutButton = document.getElementById('logoutButton');

    // Inicializa os gráficos
    let lineChart;
    let pieChart;

    // Lógica para o botão de logout
    logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        // Em um sistema real, você limparia tokens de sessão (JWT) aqui.
        localStorage.removeItem('userId'); // Exemplo se você estiver armazenando userId
        window.location.href = '/login.html';
    });

    // Função para carregar dados da dashboard
    async function carregarDadosDashboard() {
        try {
            // Em um sistema real, você enviaria um token JWT no cabeçalho Authorization
            // const token = localStorage.getItem('jwtToken');
            // if (!token) {
            //     window.location.href = '/login.html'; // Redireciona se não houver token
            //     return;
            // }

            // Por enquanto, usaremos o userId do localStorage para simular (não seguro para produção)
            const userId = localStorage.getItem('userId'); // Onde você deveria guardar o userId após o login

            if (!userId) {
                console.warn('userId não encontrado no localStorage. Redirecionando para login.');
                window.location.href = '/login.html';
                return;
            }

            // Requisição para os dados de resumo
            const resumoResponse = await fetch(`/api/dashboard/resumo?userId=${userId}`);
            const resumoData = await resumoResponse.json();

            if (resumoResponse.ok) {
                ganhosMesSpan.textContent = `R$ ${resumoData.ganhosMes.toFixed(2).replace('.', ',')}`;
                gastosMesSpan.textContent = `R$ ${resumoData.gastosMes.toFixed(2).replace('.', ',')}`;
                saldoAtualSpan.textContent = `R$ ${resumoData.saldoAtual.toFixed(2).replace('.', ',')}`;

                // Mudar cor do saldo
                if (resumoData.saldoAtual < 0) {
                    saldoAtualSpan.style.color = '#dc3545'; // Vermelho
                } else {
                    saldoAtualSpan.style.color = '#28a745'; // Verde
                }

            } else {
                console.error('Erro ao carregar resumo:', resumoData.message);
                // Tratar erro, talvez mostrar mensagem na tela
            }

            // Requisição para últimas movimentações
            const ultimasMovsResponse = await fetch(`/api/dashboard/ultimas-movimentacoes?userId=${userId}`);
            const ultimasMovsData = await ultimasMovsResponse.json();

            if (ultimasMovsResponse.ok) {
                listaUltimasMovimentacoes.innerHTML = ''; // Limpa a lista existente
                if (ultimasMovsData.length > 0) {
                    ultimasMovsData.forEach(mov => {
                        const row = document.createElement('tr');
                        row.innerHTML = `
                            <td>${new Date(mov.data).toLocaleDateString('pt-BR')}</td>
                            <td style="color: ${mov.tipo === 'ganho' ? 'green' : 'red'};">${mov.tipo.toUpperCase()}</td>
                            <td>${mov.descricao}</td>
                            <td>R$ ${mov.valor.toFixed(2).replace('.', ',')}</td>
                            <td>${mov.categoria || '-'}</td>
                        `;
                        listaUltimasMovimentacoes.appendChild(row);
                    });
                } else {
                    listaUltimasMovimentacoes.innerHTML = '<tr><td colspan="5">Nenhuma movimentação recente.</td></tr>';
                }
            } else {
                console.error('Erro ao carregar últimas movimentações:', ultimasMovsData.message);
            }

            // Requisição para dados do gráfico de linha (Ganhos vs. Gastos ao longo do tempo)
            const lineChartResponse = await fetch(`/api/dashboard/historico-movimentacoes?userId=${userId}`);
            const lineChartData = await lineChartResponse.json();

            if (lineChartResponse.ok && lineChartData.labels && lineChartData.datasets) {
                renderizarGraficoLinha(lineChartData);
            } else {
                console.error('Erro ao carregar dados do gráfico de linha:', lineChartData.message);
            }

            // Requisição para dados do gráfico de pizza (Gastos por Categoria)
            const pieChartResponse = await fetch(`/api/dashboard/gastos-por-categoria?userId=${userId}`);
            const pieChartData = await pieChartResponse.json();

            if (pieChartResponse.ok && pieChartData.labels && pieChartData.datasets) {
                renderizarGraficoPizza(pieChartData);
            } else {
                console.error('Erro ao carregar dados do gráfico de pizza:', pieChartData.message);
            }

            // Carregar nome do usuário (assumindo que a API de login retorna o nome)
            // Ou fazer uma nova requisição se necessário
            // Ex: fetch(`/api/usuario/${userId}`) ...
            userNameSpan.textContent = localStorage.getItem('userName') || 'Usuário'; // Exemplo
            
        } catch (error) {
            console.error('Erro geral ao carregar dados da dashboard:', error);
            // Redirecionar para login ou mostrar mensagem de erro
            // window.location.href = '/login.html';
        }
    }

    // Função para renderizar o gráfico de linha (Ganhos vs. Gastos ao longo do tempo)
    function renderizarGraficoLinha(data) {
        const ctx = document.getElementById('lineChart').getContext('2d');
        if (lineChart) {
            lineChart.destroy(); // Destrói o gráfico anterior se ele existir
        }
        lineChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels, // Meses: ['Jan 2024', 'Fev 2024', ...]
                datasets: [
                    {
                        label: 'Ganhos',
                        data: data.datasets.ganhos,
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        tension: 0.1,
                        fill: false
                    },
                    {
                        label: 'Gastos',
                        data: data.datasets.gastos,
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        tension: 0.1,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: false,
                        text: 'Ganhos e Gastos por Mês'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Valor (R$)'
                        }
                    }
                }
            }
        });
    }

    // Função para renderizar o gráfico de pizza (Gastos por Categoria)
    function renderizarGraficoPizza(data) {
        const ctx = document.getElementById('pieChart').getContext('2d');
        if (pieChart) {
            pieChart.destroy(); // Destrói o gráfico anterior se ele existir
        }
        pieChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.labels, // Nomes das categorias: ['Alimentação', 'Transporte', ...]
                datasets: [{
                    data: data.datasets[0].data, // Valores dos gastos por categoria
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.8)', // Red
                        'rgba(54, 162, 235, 0.8)', // Blue
                        'rgba(255, 206, 86, 0.8)', // Yellow
                        'rgba(75, 192, 192, 0.8)', // Green
                        'rgba(153, 102, 255, 0.8)', // Purple
                        'rgba(255, 159, 64, 0.8)',  // Orange
                        'rgba(199, 199, 199, 0.8)'  // Gray
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 159, 64, 1)',
                        'rgba(199, 199, 199, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    title: {
                        display: false,
                        text: 'Gastos por Categoria'
                    }
                }
            }
        });
    }

    // Carregar os dados quando a página for carregada
    carregarDadosDashboard();
});
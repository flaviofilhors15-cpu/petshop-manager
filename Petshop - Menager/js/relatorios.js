// ==========================================
// PetShop Manager - Relatórios (relatorios.js)
// Métricas gerenciais, KPIs e visualização analítica
// ==========================================

// Instâncias ativas do Chart.js
let chartFaturamentoInstance = null;
let chartReceitasDespesasRelInstance = null;
let chartServicosTipoInstance = null;
let chartVendasPagamentoInstance = null;

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Sincronizar receitas antes de calcular relatórios
    syncAutoRevenues();

    // Inicializar datas padrão no filtro personalizado
    initCustomDates();

    // Carregar todos os relatórios com o período padrão (Mês Atual)
    updateAllReports();

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});

// Sincronização auxiliar com vendas e agendamentos
function syncAutoRevenues() {
    let revenues = DB.get(STORAGE_KEYS.REVENUES) || [];
    const sales = DB.get(STORAGE_KEYS.SALES) || [];
    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];

    let hasChanges = false;
    const existingRefs = new Set(revenues.map(r => r.referencia).filter(Boolean));

    sales.forEach(sale => {
        if (!existingRefs.has(sale.id)) {
            const client = clients.find(c => c.id === sale.clienteId);
            revenues.push({
                id: DB.generateId(),
                data: sale.data || new Date().toISOString().split('T')[0],
                descricao: `Venda #${sale.id.slice(-4)} - ${client ? client.nome : 'Cliente'}`,
                categoria: 'Produto',
                valor: Number(sale.total) || 0,
                formaPagamento: sale.formaPagamento || 'Pix',
                referencia: sale.id
            });
            existingRefs.add(sale.id);
            hasChanges = true;
        }
    });

    appointments.forEach(apt => {
        if (apt.status === 'concluido' && !existingRefs.has(apt.id)) {
            const client = clients.find(c => c.id === apt.clienteId);
            revenues.push({
                id: DB.generateId(),
                data: apt.data || new Date().toISOString().split('T')[0],
                descricao: `${apt.servico} - ${client ? client.nome : 'Cliente'}`,
                categoria: 'Serviço',
                valor: Number(apt.valor) || 0,
                formaPagamento: 'Dinheiro',
                referencia: apt.id
            });
            existingRefs.add(apt.id);
            hasChanges = true;
        }
    });

    if (hasChanges) {
        DB.save(STORAGE_KEYS.REVENUES, revenues);
    }
}

function initCustomDates() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const elStart = document.getElementById('rel-data-inicio');
    const elEnd = document.getElementById('rel-data-fim');

    if (elStart) elStart.value = firstDay.toISOString().split('T')[0];
    if (elEnd) elEnd.value = lastDay.toISOString().split('T')[0];
}

function onReportPeriodChange() {
    const periodo = document.getElementById('rel-periodo').value;
    const customDiv = document.getElementById('rel-custom-dates');
    if (customDiv) {
        customDiv.style.display = periodo === 'personalizado' ? 'inline-flex' : 'none';
    }
    updateAllReports();
}

/**
 * Retorna intervalo de datas [startDate, endDate] e rótulo descritivo
 */
function getReportDateRange(tipo) {
    const today = new Date();
    let startDate = null;
    let endDate = null;
    let label = '';

    switch (tipo) {
        case 'mes_atual': {
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
            const mesNome = startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            label = mesNome.charAt(0).toUpperCase() + mesNome.slice(1);
            break;
        }
        case 'mes_anterior': {
            startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
            const mesNome = startDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
            label = mesNome.charAt(0).toUpperCase() + mesNome.slice(1);
            break;
        }
        case 'ultimos_90': {
            endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 90);
            label = 'Últimos 90 Dias';
            break;
        }
        case 'ano_atual': {
            startDate = new Date(today.getFullYear(), 0, 1);
            endDate = new Date(today.getFullYear(), 11, 31, 23, 59, 59);
            label = `Ano de ${today.getFullYear()}`;
            break;
        }
        case 'personalizado': {
            const startVal = document.getElementById('rel-data-inicio')?.value;
            const endVal = document.getElementById('rel-data-fim')?.value;
            if (startVal) startDate = new Date(startVal + 'T00:00:00');
            if (endVal) endDate = new Date(endVal + 'T23:59:59');
            label = `${startDate ? formatDate(startDate.toISOString().split('T')[0]) : 'Início'} até ${endDate ? formatDate(endDate.toISOString().split('T')[0]) : 'Hoje'}`;
            break;
        }
        case 'todos':
        default: {
            startDate = null;
            endDate = null;
            label = 'Todo o Histórico Cadastrado';
            break;
        }
    }

    return { startDate, endDate, label };
}

// ==========================================
// CÁLCULO E ATUALIZAÇÃO GERAL
// ==========================================
function updateAllReports() {
    const periodoTipo = document.getElementById('rel-periodo')?.value || 'mes_atual';
    const { startDate, endDate, label } = getReportDateRange(periodoTipo);

    const labelEl = document.getElementById('rel-periodo-label');
    if (labelEl) labelEl.textContent = label;

    const revenues = DB.get(STORAGE_KEYS.REVENUES) || [];
    const expenses = DB.get(STORAGE_KEYS.EXPENSES) || [];
    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const sales = DB.get(STORAGE_KEYS.SALES) || [];

    // 1. Filtrar receitas e despesas pelo período
    const periodRevenues = revenues.filter(r => {
        if (!r.data) return false;
        const d = new Date(r.data + 'T00:00:00');
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
    });

    const periodExpenses = expenses.filter(e => {
        if (!e.data) return false;
        const d = new Date(e.data + 'T00:00:00');
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
    });

    const periodAppointments = appointments.filter(a => {
        if (!a.data) return false;
        const d = new Date(a.data + 'T00:00:00');
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
    });

    // 2. Calcular os 6 KPIs principais
    calculateKPIs(periodRevenues, periodExpenses, periodAppointments, sales);

    // 3. Renderizar os 4 Gráficos
    renderChartFaturamentoMensal(revenues);
    renderChartReceitasDespesas(revenues, expenses);
    renderChartServicosTipo(periodAppointments);
    renderChartVendasPagamento(periodRevenues);

    // 4. Renderizar Tabela Consolidada de Desempenho
    renderConsolidatedMonthlyTable(revenues, expenses, appointments);

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// ==========================================
// CÁLCULO DOS KPIS
// ==========================================
function calculateKPIs(periodRevenues, periodExpenses, periodAppointments, allSales) {
    // 1. Faturamento
    const totalFaturamento = periodRevenues.reduce((sum, r) => sum + (Number(r.valor) || 0), 0);

    // 2. Lucro Líquido
    const totalDespesas = periodExpenses.reduce((sum, e) => sum + (Number(e.valor) || 0), 0);
    const lucroLiquido = totalFaturamento - totalDespesas;

    // 3. Margem %
    const margem = totalFaturamento > 0 ? (lucroLiquido / totalFaturamento) * 100 : 0;

    // 4. Ticket Médio
    const transacoesCount = periodRevenues.length;
    const ticketMedio = transacoesCount > 0 ? (totalFaturamento / transacoesCount) : 0;

    // 5. Total Atendimentos Concluídos
    const atendimentosConcluidos = periodAppointments.filter(a => a.status === 'concluido').length;

    // 6. Taxa de Retorno de Clientes
    // Mapear interações de clientes (agendamentos e compras)
    const clientInteractions = {};
    const allAppointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];

    allAppointments.forEach(apt => {
        if (apt.clienteId) {
            clientInteractions[apt.clienteId] = (clientInteractions[apt.clienteId] || 0) + 1;
        }
    });

    allSales.forEach(sale => {
        if (sale.clienteId) {
            clientInteractions[sale.clienteId] = (clientInteractions[sale.clienteId] || 0) + 1;
        }
    });

    const activeClients = Object.keys(clientInteractions);
    const repeatClients = activeClients.filter(cId => clientInteractions[cId] >= 2);
    const taxaRetorno = activeClients.length > 0 ? (repeatClients.length / activeClients.length) * 100 : 0;

    // Atualização nos elementos HTML
    const elFat = document.getElementById('rep-kpi-faturamento');
    const elLucro = document.getElementById('rep-kpi-lucro');
    const cardLucro = document.getElementById('rep-card-lucro');
    const elMargem = document.getElementById('rep-kpi-margem');
    const elTicket = document.getElementById('rep-kpi-ticket');
    const elAtendimentos = document.getElementById('rep-kpi-atendimentos');
    const elRetorno = document.getElementById('rep-kpi-retorno');

    if (elFat) elFat.textContent = formatCurrency(totalFaturamento);
    if (elLucro) {
        elLucro.textContent = formatCurrency(lucroLiquido);
        if (lucroLiquido >= 0) {
            elLucro.className = 'stat-value text-success';
            if (cardLucro) cardLucro.className = 'stat-card success';
        } else {
            elLucro.className = 'stat-value text-danger';
            if (cardLucro) cardLucro.className = 'stat-card danger';
        }
    }
    if (elMargem) elMargem.textContent = `${margem.toFixed(1).replace('.', ',')}%`;
    if (elTicket) elTicket.textContent = formatCurrency(ticketMedio);
    if (elAtendimentos) elAtendimentos.textContent = atendimentosConcluidos;
    if (elRetorno) elRetorno.textContent = `${taxaRetorno.toFixed(1).replace('.', ',')}%`;
}

// ==========================================
// RENDERIZAÇÃO DOS 4 GRÁFICOS (CHART.JS)
// ==========================================

// Helper para obter os últimos 6 meses
function getLastSixMonths() {
    const list = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        list.push({
            year: d.getFullYear(),
            month: d.getMonth(),
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase() + '/' + String(d.getFullYear()).slice(-2),
            fullLabel: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        });
    }
    return list;
}

// 1. Gráfico de Linha: Evolução do Faturamento Mensal
function renderChartFaturamentoMensal(allRevenues) {
    const canvas = document.getElementById('chartFaturamentoMensal');
    if (!canvas) return;

    const months = getLastSixMonths();
    const dataValues = months.map(m => {
        return allRevenues
            .filter(r => r.data && r.data.startsWith(m.key))
            .reduce((sum, r) => sum + (Number(r.valor) || 0), 0);
    });

    if (chartFaturamentoInstance) {
        chartFaturamentoInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    chartFaturamentoInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months.map(m => m.label),
            datasets: [{
                label: 'Faturamento Total (R$)',
                data: dataValues,
                borderColor: '#5BA4E6',
                backgroundColor: 'rgba(91, 164, 230, 0.12)',
                borderWidth: 3,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: '#1E3A5F',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            return ` Faturamento: ${formatCurrency(ctx.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: val => 'R$ ' + val.toLocaleString('pt-BR')
                    }
                }
            }
        }
    });
}

// 2. Gráfico de Barras: Comparativo Receitas vs Despesas
function renderChartReceitasDespesas(allRevenues, allExpenses) {
    const canvas = document.getElementById('chartReceitasDespesasRel');
    if (!canvas) return;

    const months = getLastSixMonths();
    const receitasData = months.map(m => {
        return allRevenues
            .filter(r => r.data && r.data.startsWith(m.key))
            .reduce((sum, r) => sum + (Number(r.valor) || 0), 0);
    });

    const despesasData = months.map(m => {
        return allExpenses
            .filter(e => e.data && e.data.startsWith(m.key))
            .reduce((sum, e) => sum + (Number(e.valor) || 0), 0);
    });

    if (chartReceitasDespesasRelInstance) {
        chartReceitasDespesasRelInstance.destroy();
    }

    const ctx = canvas.getContext('2d');
    chartReceitasDespesasRelInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months.map(m => m.label),
            datasets: [
                {
                    label: 'Receitas (R$)',
                    data: receitasData,
                    backgroundColor: '#4CAF82',
                    borderRadius: 5
                },
                {
                    label: 'Despesas (R$)',
                    data: despesasData,
                    backgroundColor: '#E74C6F',
                    borderRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 12 } },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: val => 'R$ ' + val.toLocaleString('pt-BR')
                    }
                }
            }
        }
    });
}

// 3. Gráfico de Pizza: Serviços por Tipo
function renderChartServicosTipo(periodAppointments) {
    const canvas = document.getElementById('chartServicosTipo');
    if (!canvas) return;

    const servicosCount = {};
    periodAppointments.forEach(apt => {
        const s = apt.servico || 'Outro';
        servicosCount[s] = (servicosCount[s] || 0) + 1;
    });

    let labels = Object.keys(servicosCount);
    let data = Object.values(servicosCount);

    if (labels.length === 0) {
        labels = ['Nenhum serviço'];
        data = [1];
    }

    if (chartServicosTipoInstance) {
        chartServicosTipoInstance.destroy();
    }

    const colors = ['#5BA4E6', '#F5A623', '#4CAF82', '#9C27B0', '#E74C6F', '#00BCD4'];

    const ctx = canvas.getContext('2d');
    chartServicosTipoInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            if (ctx.label === 'Nenhum serviço') return ' Sem dados no período';
                            return ` ${ctx.label}: ${ctx.parsed} atendimento(s)`;
                        }
                    }
                }
            }
        }
    });
}

// 4. Gráfico de Rosca: Vendas/Recebimentos por Forma de Pagamento
function renderChartVendasPagamento(periodRevenues) {
    const canvas = document.getElementById('chartVendasPagamento');
    if (!canvas) return;

    const pgtoTotals = {};
    periodRevenues.forEach(r => {
        const forma = r.formaPagamento || 'Outros';
        pgtoTotals[forma] = (pgtoTotals[forma] || 0) + (Number(r.valor) || 0);
    });

    let labels = Object.keys(pgtoTotals);
    let data = Object.values(pgtoTotals);

    if (labels.length === 0) {
        labels = ['Sem recebimentos'];
        data = [1];
    }

    if (chartVendasPagamentoInstance) {
        chartVendasPagamentoInstance.destroy();
    }

    const colors = ['#4CAF82', '#5BA4E6', '#F5A623', '#E74C6F', '#8A9BB5'];

    const ctx = canvas.getContext('2d');
    chartVendasPagamentoInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: function (ctx) {
                            if (ctx.label === 'Sem recebimentos') return ' Sem dados no período';
                            return ` ${ctx.label}: ${formatCurrency(ctx.parsed)}`;
                        }
                    }
                }
            },
            cutout: '60%'
        }
    });
}

// ==========================================
// TABELA MENSAL CONSOLIDADA
// ==========================================
function renderConsolidatedMonthlyTable(revenues, expenses, appointments) {
    const tbody = document.getElementById('rel-tabela-desempenho');
    if (!tbody) return;

    const months = getLastSixMonths();

    tbody.innerHTML = months.map(m => {
        const monthRevenues = revenues.filter(r => r.data && r.data.startsWith(m.key));
        const monthExpenses = expenses.filter(e => e.data && e.data.startsWith(m.key));
        const monthApts = appointments.filter(a => a.data && a.data.startsWith(m.key) && a.status === 'concluido');

        const totRec = monthRevenues.reduce((sum, r) => sum + (Number(r.valor) || 0), 0);
        const totDesp = monthExpenses.reduce((sum, e) => sum + (Number(e.valor) || 0), 0);
        const lucro = totRec - totDesp;
        const margem = totRec > 0 ? (lucro / totRec) * 100 : 0;
        const ticket = monthRevenues.length > 0 ? (totRec / monthRevenues.length) : 0;

        return `
            <tr>
                <td><strong>${m.fullLabel.charAt(0).toUpperCase() + m.fullLabel.slice(1)}</strong></td>
                <td style="text-align: right; color: var(--success); font-weight: 600;">${formatCurrency(totRec)}</td>
                <td style="text-align: right; color: var(--danger); font-weight: 600;">${formatCurrency(totDesp)}</td>
                <td style="text-align: right; font-weight: 700; color: ${lucro >= 0 ? 'var(--success)' : 'var(--danger)'};">
                    ${formatCurrency(lucro)}
                </td>
                <td style="text-align: center;">
                    <span class="badge ${lucro >= 0 ? 'badge-success' : 'badge-danger'}">
                        ${margem.toFixed(1).replace('.', ',')}%
                    </span>
                </td>
                <td style="text-align: center; font-weight: 600;">${monthApts.length}</td>
                <td style="text-align: right;">${formatCurrency(ticket)}</td>
            </tr>
        `;
    }).join('');
}

// ==========================================
// EXPORTAÇÃO CSV E IMPRESSÃO
// ==========================================
function exportReportCSV() {
    const periodoTipo = document.getElementById('rel-periodo')?.value || 'mes_atual';
    const { label } = getReportDateRange(periodoTipo);

    const revenues = DB.get(STORAGE_KEYS.REVENUES) || [];
    const expenses = DB.get(STORAGE_KEYS.EXPENSES) || [];
    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];

    const months = getLastSixMonths();

    // Montar conteúdo CSV com separador ponto-e-vírgula (padrão Brasil)
    let csvContent = `Relatório de Desempenho - PetShop Manager\r\n`;
    csvContent += `Período Analisado:;${label}\r\n`;
    csvContent += `Data de Exportação:;${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}\r\n\r\n`;

    csvContent += `Mês / Ano;Receitas (R$);Despesas (R$);Lucro Líquido (R$);Margem (%);Atendimentos Concluídos;Ticket Médio (R$)\r\n`;

    months.forEach(m => {
        const monthRevenues = revenues.filter(r => r.data && r.data.startsWith(m.key));
        const monthExpenses = expenses.filter(e => e.data && e.data.startsWith(m.key));
        const monthApts = appointments.filter(a => a.data && a.data.startsWith(m.key) && a.status === 'concluido');

        const totRec = monthRevenues.reduce((sum, r) => sum + (Number(r.valor) || 0), 0);
        const totDesp = monthExpenses.reduce((sum, e) => sum + (Number(e.valor) || 0), 0);
        const lucro = totRec - totDesp;
        const margem = totRec > 0 ? (lucro / totRec) * 100 : 0;
        const ticket = monthRevenues.length > 0 ? (totRec / monthRevenues.length) : 0;

        csvContent += `"${m.fullLabel}";"${totRec.toFixed(2).replace('.', ',')}";"${totDesp.toFixed(2).replace('.', ',')}";"${lucro.toFixed(2).replace('.', ',')}";"${margem.toFixed(1).replace('.', ',')}%";"${monthApts.length}";"${ticket.toFixed(2).replace('.', ',')}"\r\n`;
    });

    // Criar Blob com BOM para compatibilidade com Excel
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_petshop_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Relatório exportado em CSV com sucesso!', 'success');
}

function printReport() {
    window.print();
}

// ==========================================
// PetShop Manager - Dashboard (dashboard.js)
// Lógica da página inicial com indicadores,
// gráficos Chart.js e alertas em tempo real.
// ==========================================

// Variáveis globais para armazenar as instâncias dos gráficos Chart.js
let chartFaturamentoInstance = null;
let chartServicosInstance = null;
let chartProdutosInstance = null;

/**
 * Inicialização da página de Dashboard
 */
function initDashboard() {
    // 1. Exibir a data atual por extenso no cabeçalho
    exibirDataAtual();

    // 2. Carregar indicadores financeiros e operacionais
    carregarEstatisticas();

    // 3. Renderizar gráficos Chart.js
    renderizarGraficoFaturamento();
    renderizarGraficoServicos();
    renderizarGraficoProdutos();

    // 4. Carregar listas de agendamentos e alertas de estoque
    renderizarAgendamentosHoje();
    renderizarAlertasEstoque();
    renderizarKanbanDashboard();

    // 5. Atualizar ícones do Lucide
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Exibe a data atual em formato brasileiro por extenso
 */
function exibirDataAtual() {
    const el = document.getElementById('data-atual-extenso');
    if (!el) return;

    const agora = new Date();
    const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

    const diaSemana = diasSemana[agora.getDay()];
    const dia = agora.getDate();
    const mes = meses[agora.getMonth()];
    const ano = agora.getFullYear();

    el.textContent = `${diaSemana}, ${dia} de ${mes} de ${ano} • Painel Operacional`;
}

/**
 * Utilitário para converter string de data em objeto Date local
 */
function converterParaDataLocal(dataStr) {
    if (!dataStr) return null;
    const d = new Date(dataStr.includes('T') ? dataStr : `${dataStr}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Verifica se a data pertence ao mesmo mês e ano da data alvo
 */
function isMesAnoIgual(dataStr, dataAlvo) {
    const d = converterParaDataLocal(dataStr);
    if (!d) return false;
    return d.getFullYear() === dataAlvo.getFullYear() && d.getMonth() === dataAlvo.getMonth();
}

/**
 * Verifica se a data corresponde ao dia de hoje
 */
function isDataHoje(dataStr) {
    const d = converterParaDataLocal(dataStr);
    if (!d) return false;
    const agora = new Date();
    return d.getFullYear() === agora.getFullYear() &&
           d.getMonth() === agora.getMonth() &&
           d.getDate() === agora.getDate();
}

/**
 * Calcula e atualiza os 4 cards de estatísticas principais
 */
function carregarEstatisticas() {
    const agora = new Date();
    const receitas = DB.get(STORAGE_KEYS.REVENUES) || [];
    const despesas = DB.get(STORAGE_KEYS.EXPENSES) || [];
    const agendamentos = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];

    // 1. Faturamento do Mês: soma de todas as receitas do mês atual
    const faturamentoMes = receitas
        .filter(r => isMesAnoIgual(r.data, agora))
        .reduce((soma, r) => soma + (parseFloat(r.valor) || 0), 0);

    // 2. Despesas do Mês: soma de todas as despesas do mês atual
    const despesasMes = despesas
        .filter(e => isMesAnoIgual(e.data, agora))
        .reduce((soma, e) => soma + (parseFloat(e.valor) || 0), 0);

    // 3. Lucro Líquido: faturamento - despesas
    const lucroLiquido = faturamentoMes - despesasMes;

    // 4. Margem de Lucro (%): (lucro / faturamento) * 100
    const margemLucro = faturamentoMes > 0 ? ((lucroLiquido / faturamentoMes) * 100) : 0;

    // 5. Agendamentos de Hoje
    const agendamentosHoje = agendamentos.filter(a => isDataHoje(a.data));
    const pendentes = agendamentosHoje.filter(a => a.status === 'agendado' || a.status === 'em_andamento').length;
    const concluidos = agendamentosHoje.filter(a => a.status === 'concluido').length;

    // Atualização dos elementos no DOM
    const elFaturamento = document.getElementById('stat-faturamento');
    const elFaturamentoSub = document.getElementById('stat-faturamento-sub');
    if (elFaturamento) elFaturamento.textContent = formatCurrency(faturamentoMes);
    if (elFaturamentoSub) {
        const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        elFaturamentoSub.textContent = `Receitas em ${nomesMeses[agora.getMonth()]}/${agora.getFullYear()}`;
    }

    // Card de Lucro Líquido
    const elLucro = document.getElementById('stat-lucro');
    const elLucroSub = document.getElementById('stat-lucro-sub');
    const cardLucro = document.getElementById('card-lucro');
    const iconLucro = document.getElementById('icon-lucro');

    if (elLucro) elLucro.textContent = formatCurrency(lucroLiquido);
    if (elLucroSub) elLucroSub.textContent = `Despesas: ${formatCurrency(despesasMes)}`;
    
    if (cardLucro && iconLucro) {
        if (lucroLiquido >= 0) {
            cardLucro.className = 'stat-card success';
            iconLucro.innerHTML = '<i data-lucide="trending-up"></i>';
        } else {
            cardLucro.className = 'stat-card danger';
            iconLucro.innerHTML = '<i data-lucide="trending-down"></i>';
        }
    }

    // Card de Margem de Lucro
    const elMargem = document.getElementById('stat-margem');
    const cardMargem = document.getElementById('card-margem');
    const iconMargem = document.getElementById('icon-margem');
    const elMargemSub = document.getElementById('stat-margem-sub');

    if (elMargem) {
        elMargem.textContent = `${margemLucro.toFixed(1).replace('.', ',')}%`;
    }
    if (elMargemSub) {
        elMargemSub.textContent = lucroLiquido >= 0 ? 'Rentabilidade positiva' : 'Atenção aos custos';
    }

    if (cardMargem && iconMargem) {
        if (margemLucro >= 20) {
            cardMargem.className = 'stat-card success';
            iconMargem.innerHTML = '<i data-lucide="check-circle-2"></i>';
        } else if (margemLucro >= 0) {
            cardMargem.className = 'stat-card warning';
            iconMargem.innerHTML = '<i data-lucide="percent"></i>';
        } else {
            cardMargem.className = 'stat-card danger';
            iconMargem.innerHTML = '<i data-lucide="alert-circle"></i>';
        }
    }

    // Card de Agendamentos de Hoje
    const elAgendamentos = document.getElementById('stat-agendamentos');
    const elAgendamentosSub = document.getElementById('stat-agendamentos-sub');
    if (elAgendamentos) elAgendamentos.textContent = agendamentosHoje.length;
    if (elAgendamentosSub) {
        elAgendamentosSub.textContent = `${pendentes} pendente(s) • ${concluidos} concluído(s)`;
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Gráfico 1: Linha - Faturamento dos últimos 6 meses
 */
function renderizarGraficoFaturamento() {
    const canvas = document.getElementById('chart-faturamento');
    if (!canvas) return;

    if (typeof Chart === 'undefined') {
        console.warn('Biblioteca Chart.js não encontrada.');
        return;
    }

    if (chartFaturamentoInstance) {
        chartFaturamentoInstance.destroy();
    }

    const receitas = DB.get(STORAGE_KEYS.REVENUES) || [];
    const agora = new Date();
    const mesesAbrev = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    const labels = [];
    const dados = [];

    // Obter os últimos 6 meses cronologicamente (do mais antigo para o atual)
    for (let i = 5; i >= 0; i--) {
        const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        const rotulo = `${mesesAbrev[d.getMonth()]}/${String(d.getFullYear()).slice(-2)}`;
        labels.push(rotulo);

        const totalMes = receitas
            .filter(r => isMesAnoIgual(r.data, d))
            .reduce((soma, r) => soma + (parseFloat(r.valor) || 0), 0);
        dados.push(totalMes);
    }

    const ctx = canvas.getContext('2d');
    const gradiente = ctx.createLinearGradient(0, 0, 0, 240);
    gradiente.addColorStop(0, 'rgba(91, 164, 230, 0.45)');
    gradiente.addColorStop(1, 'rgba(91, 164, 230, 0.02)');

    chartFaturamentoInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Faturamento',
                data: dados,
                borderColor: '#5BA4E6',
                backgroundColor: gradiente,
                borderWidth: 2.5,
                pointBackgroundColor: '#1E3A5F',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 5,
                pointHoverRadius: 7,
                fill: true,
                tension: 0.35
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1E3A5F',
                    titleFont: { family: 'Poppins', size: 12 },
                    bodyFont: { family: 'Inter', size: 12 },
                    padding: 10,
                    callbacks: {
                        label: function(context) {
                            return ' Faturamento: ' + formatCurrency(context.raw);
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#5a6f85',
                        font: { family: 'Inter', size: 11 }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: '#f0f4f8' },
                    ticks: {
                        color: '#5a6f85',
                        font: { family: 'Inter', size: 11 },
                        callback: function(val) {
                            return 'R$ ' + val.toLocaleString('pt-BR');
                        }
                    }
                }
            }
        }
    });
}

/**
 * Gráfico 2: Torta (Pie) - Serviços mais realizados
 */
function renderizarGraficoServicos() {
    const canvas = document.getElementById('chart-servicos');
    if (!canvas) return;

    if (typeof Chart === 'undefined') {
        console.warn('Biblioteca Chart.js não encontrada.');
        return;
    }

    if (chartServicosInstance) {
        chartServicosInstance.destroy();
    }

    const agendamentos = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];

    // Contabilizar serviços realizados:
    // Prioriza agendamentos concluídos; se não houver concluídos, conta todos não cancelados
    let listaFonte = agendamentos.filter(a => a.status === 'concluido');
    if (listaFonte.length === 0) {
        listaFonte = agendamentos.filter(a => a.status !== 'cancelado');
    }
    if (listaFonte.length === 0) {
        listaFonte = agendamentos;
    }

    const contagem = {};
    listaFonte.forEach(item => {
        const servico = item.servico || 'Outros';
        contagem[servico] = (contagem[servico] || 0) + 1;
    });

    let labels = Object.keys(contagem);
    let data = Object.values(contagem);

    // Se ainda não houver nenhum agendamento
    if (labels.length === 0) {
        labels = ['Nenhum serviço registrado'];
        data = [1];
    }

    const cores = ['#5BA4E6', '#4CAF82', '#F5A623', '#D4A84B', '#9C27B0', '#E74C6F', '#2a4f7a'];
    const coresFundo = labels.map((_, i) => cores[i % cores.length]);

    const ctx = canvas.getContext('2d');
    chartServicosInstance = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: coresFundo,
                borderColor: '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: { family: 'Inter', size: 11 },
                        color: '#1E3A5F',
                        padding: 12,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    backgroundColor: '#1E3A5F',
                    padding: 10,
                    titleFont: { family: 'Poppins', size: 12 },
                    bodyFont: { family: 'Inter', size: 12 },
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const val = context.raw;
                            const pct = total > 0 ? ((val / total) * 100).toFixed(1) : '0';
                            return ` ${context.label}: ${val} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

/**
 * Gráfico 3: Barra - Top 5 produtos mais vendidos
 */
function renderizarGraficoProdutos() {
    const canvas = document.getElementById('chart-produtos');
    if (!canvas) return;

    if (typeof Chart === 'undefined') {
        console.warn('Biblioteca Chart.js não encontrada.');
        return;
    }

    if (chartProdutosInstance) {
        chartProdutosInstance.destroy();
    }

    const vendas = DB.get(STORAGE_KEYS.SALES) || [];

    // Contabilizar produtos das vendas registradas
    const mapaProdutos = {};

    vendas.forEach(venda => {
        (venda.itens || []).forEach(item => {
            const nome = item.nome || 'Produto';
            if (!mapaProdutos[nome]) {
                mapaProdutos[nome] = {
                    nome: nome,
                    quantidade: 0,
                    valorTotal: 0
                };
            }
            mapaProdutos[nome].quantidade += (Number(item.quantidade) || 0);
            mapaProdutos[nome].valorTotal += (Number(item.subtotal) || 0);
        });
    });

    // Ordenar decrescente pela quantidade e selecionar os 5 primeiros
    const top5 = Object.values(mapaProdutos)
        .sort((a, b) => b.quantidade - a.quantidade)
        .slice(0, 5);

    let labels = top5.map(p => p.nome.length > 25 ? p.nome.substring(0, 22) + '...' : p.nome);
    let dados = top5.map(p => p.quantidade);

    // Se não houver vendas cadastradas
    if (top5.length === 0) {
        labels = ['Sem vendas no momento'];
        dados = [0];
    }

    const ctx = canvas.getContext('2d');
    chartProdutosInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Unidades Vendidas',
                data: dados,
                backgroundColor: ['#5BA4E6', '#4CAF82', '#F5A623', '#2a4f7a', '#D4A84B'],
                borderRadius: 6,
                maxBarThickness: 45
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1E3A5F',
                    padding: 10,
                    titleFont: { family: 'Poppins', size: 12 },
                    bodyFont: { family: 'Inter', size: 12 },
                    callbacks: {
                        title: function(items) {
                            const idx = items[0].dataIndex;
                            return top5[idx] ? top5[idx].nome : items[0].label;
                        },
                        label: function(context) {
                            const idx = context.dataIndex;
                            const totalVal = top5[idx] ? formatCurrency(top5[idx].valorTotal) : 'R$ 0,00';
                            return ` Vendidos: ${context.raw} un. | Faturado: ${totalVal}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: '#5a6f85',
                        font: { family: 'Inter', size: 11 }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: '#f0f4f8' },
                    ticks: {
                        stepSize: 1,
                        precision: 0,
                        color: '#5a6f85',
                        font: { family: 'Inter', size: 11 }
                    }
                }
            }
        }
    });
}

/**
 * Renderiza a lista de agendamentos previstos para hoje
 */
function renderizarAgendamentosHoje() {
    const container = document.getElementById('lista-agendamentos-hoje');
    const badgeTotal = document.getElementById('badge-total-hoje');
    if (!container) return;

    const agendamentos = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const clientes = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const pets = DB.get(STORAGE_KEYS.PETS) || [];
    const funcionarios = DB.get(STORAGE_KEYS.EMPLOYEES) || [];

    const agendamentosHoje = agendamentos.filter(a => isDataHoje(a.data));
    if (badgeTotal) badgeTotal.textContent = agendamentosHoje.length;

    if (agendamentosHoje.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 2.5rem 1rem;">
                <i data-lucide="calendar-check" style="color: var(--primary); opacity: 0.5;"></i>
                <p>Nenhum agendamento para hoje</p>
                <span>Utilize o botão "Novo Agendamento" para incluir serviços no dia de hoje.</span>
            </div>
        `;
        return;
    }

    // Ordenar agendamentos por horário
    agendamentosHoje.sort((a, b) => (a.horario || '').localeCompare(b.horario || ''));

    const clientesMap = Object.fromEntries(clientes.map(c => [c.id, c]));
    const petsMap = Object.fromEntries(pets.map(p => [p.id, p]));
    const funcionariosMap = Object.fromEntries(funcionarios.map(f => [f.id, f]));

    const statusConfig = {
        agendado: {
            classe: 'badge-warning',
            dot: 'agendado',
            texto: 'Agendado'
        },
        em_andamento: {
            classe: 'badge-info',
            dot: 'em_andamento',
            texto: 'Em Andamento'
        },
        concluido: {
            classe: 'badge-success',
            dot: 'concluido',
            texto: 'Concluído'
        },
        cancelado: {
            classe: 'badge-danger',
            dot: 'cancelado',
            texto: 'Cancelado'
        }
    };

    const html = agendamentosHoje.map(item => {
        const pet = petsMap[item.petId] || { nome: 'Pet não informado', especie: 'Pet', raca: '' };
        const cliente = clientesMap[item.clienteId] || { nome: 'Cliente não informado', telefone: '' };
        const funcionario = funcionariosMap[item.funcionarioId] || { nome: 'Atendente' };
        const status = statusConfig[item.status] || statusConfig.agendado;

        return `
            <div class="agenda-item" style="cursor: default; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.65rem;">
                <div style="display: flex; align-items: center; gap: 0.85rem; flex: 1;">
                    <div class="agenda-time" style="background: var(--info-light); color: var(--primary); font-weight: 700; padding: 0.5rem 0.65rem; border-radius: var(--radius-sm); text-align: center; min-width: 55px;">
                        ${item.horario || '--:--'}
                    </div>
                    <div class="agenda-info" style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            <span class="pet-name" style="font-size: 0.95rem; font-weight: 600; color: var(--text-primary);">🐾 ${pet.nome}</span>
                            <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 400;">(${pet.especie}${pet.raca ? ' - ' + pet.raca : ''})</span>
                        </div>
                        <div class="service-name" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">
                            <strong>${item.servico}</strong> • Tutor(a): ${cliente.nome} ${cliente.telefone ? `• ${cliente.telefone}` : ''}
                        </div>
                        <div style="font-size: 0.78rem; color: var(--text-light); margin-top: 2px; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            <span>Profissional: ${funcionario.nome} • Valor: <strong style="color: var(--primary);">${formatCurrency(item.valor)}</strong></span>
                            <span class="badge ${item.tipoEntrega === 'entregar' ? 'badge-delivery' : 'badge-pickup'}" style="font-size: 0.72rem; padding: 0.15rem 0.45rem;">
                                ${item.tipoEntrega === 'entregar' ? '🚗 Leva & Traz' : '🐾 Tutor Busca'}
                            </span>
                        </div>
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 0.4rem;">
                    <span class="badge ${status.classe}">
                        <span class="status-dot ${status.dot}"></span>${status.texto}
                    </span>
                    <div class="btn-group" style="gap: 0.35rem;">
                        <button class="btn btn-sm btn-secondary" onclick="abrirFichaBaia('${item.id}')" title="Imprimir Ficha de Baia / Gaiola">
                            <i data-lucide="printer"></i> Ficha
                        </button>
                        <button class="btn btn-sm btn-whatsapp" onclick="abrirModalWhatsApp('${item.id}')" title="Avisar tutor no WhatsApp">
                            <i data-lucide="message-circle"></i> WhatsApp
                        </button>
                        ${item.status === 'agendado' ? `
                            <button class="btn btn-sm btn-primary" onclick="alterarStatusAgendamento('${item.id}', 'em_andamento')" title="Iniciar atendimento agora">
                                <i data-lucide="play"></i> Iniciar
                            </button>
                        ` : ''}
                        ${item.status === 'em_andamento' ? `
                            <button class="btn btn-sm btn-success" onclick="alterarStatusAgendamento('${item.id}', 'concluido')" title="Concluir serviço e registrar receita">
                                <i data-lucide="check"></i> Concluir
                            </button>
                        ` : ''}
                        <button class="btn-icon" onclick="abrirModalStatus('${item.id}')" title="Alterar status do agendamento">
                            <i data-lucide="edit-3"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

/**
 * Renderiza o card de alertas de estoque baixo
 */
function renderizarAlertasEstoque() {
    const container = document.getElementById('lista-alertas-estoque');
    const badgeTotal = document.getElementById('badge-total-estoque-baixo');
    if (!container) return;

    const produtos = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    const produtosCriticos = produtos.filter(p => Number(p.estoque) <= Number(p.estoqueMinimo));

    if (badgeTotal) badgeTotal.textContent = produtosCriticos.length;

    if (produtosCriticos.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 2.5rem 1rem;">
                <i data-lucide="check-circle" style="color: var(--success); opacity: 0.6;"></i>
                <p>Estoque regularizado!</p>
                <span>Nenhum produto está abaixo do estoque mínimo estabelecido.</span>
            </div>
        `;
        return;
    }

    // Ordenar: produtos com estoque zero primeiro, depois menor estoque
    produtosCriticos.sort((a, b) => a.estoque - b.estoque);

    const html = produtosCriticos.map(prod => {
        const estoqueAtual = parseFloat(prod.estoque) || 0;
        const estoqueMin = parseFloat(prod.estoqueMinimo) || 5;
        const esgotado = estoqueAtual <= 0;
        const unidade = prod.unidade || 'un';
        const saldoFmt = unidade === 'kg' ? estoqueAtual.toFixed(1) : Math.round(estoqueAtual);
        const minFmt = unidade === 'kg' ? estoqueMin.toFixed(1) : Math.round(estoqueMin);

        return `
            <div class="alert-item" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 0; border-bottom: 1px solid var(--border-light);">
                <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1;">
                    <div style="width: 38px; height: 38px; border-radius: var(--radius-sm); background: ${esgotado ? 'var(--danger-light)' : 'var(--warning-light)'}; color: ${esgotado ? 'var(--danger)' : 'var(--warning)'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <i data-lucide="${esgotado ? 'alert-octagon' : 'alert-triangle'}" style="width: 18px; height: 18px;"></i>
                    </div>
                    <div>
                        <div style="font-weight: 600; color: var(--text-primary); font-size: 0.95rem;">${prod.nome}</div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 1px;">
                            SKU: <strong>${prod.sku || '-'}</strong> • Categoria: ${prod.categoria || 'Geral'}
                        </div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="text-align: right;">
                        <div>
                            <span class="badge ${esgotado ? 'badge-danger' : 'badge-warning'}">
                                ${esgotado ? 'Esgotado (0)' : `${saldoFmt} ${unidade}`}
                            </span>
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-light); margin-top: 2px;">
                            Mínimo: ${minFmt} ${unidade}
                        </div>
                    </div>
                    <button class="btn btn-sm btn-primary" onclick="abrirModalRepor('${prod.id}')" title="Repor estoque deste produto">
                        <i data-lucide="plus-circle"></i> Repor
                    </button>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = html;
}

/**
 * Atualiza o status de um agendamento diretamente
 */
function alterarStatusAgendamento(agendamentoId, novoStatus) {
    const agendamentos = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const index = agendamentos.findIndex(a => a.id === agendamentoId);

    if (index === -1) {
        showToast('Agendamento não encontrado.', 'error');
        return;
    }

    agendamentos[index].status = novoStatus;
    DB.save(STORAGE_KEYS.APPOINTMENTS, agendamentos);

    // Se concluiu o atendimento, registrar receita caso ainda não exista para esse agendamento
    if (novoStatus === 'concluido') {
        registrarReceitaDeAgendamento(agendamentos[index]);
    }

    const mensagens = {
        em_andamento: 'Atendimento iniciado com sucesso!',
        concluido: 'Agendamento concluído e receita registrada!',
        cancelado: 'Agendamento cancelado.',
        agendado: 'Status alterado para agendado.'
    };

    showToast(mensagens[novoStatus] || 'Status atualizado com sucesso!', 'success');
    recarregarDashboard();
}

/**
 * Registra receita financeira automaticamente quando um agendamento é concluído
 */
function registrarReceitaDeAgendamento(agendamento) {
    const receitas = DB.get(STORAGE_KEYS.REVENUES) || [];
    const jaRegistrado = receitas.some(r => r.referencia === agendamento.id);

    if (jaRegistrado) return;

    const pets = DB.get(STORAGE_KEYS.PETS) || [];
    const clientes = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const pet = pets.find(p => p.id === agendamento.petId);
    const cliente = clientes.find(c => c.id === agendamento.clienteId);

    const desc = `${agendamento.servico} - ${pet ? pet.nome : 'Pet'} (${cliente ? cliente.nome : 'Cliente'})`;

    const novaReceita = {
        id: DB.generateId(),
        data: agendamento.data || new Date().toISOString().split('T')[0],
        descricao: desc,
        categoria: 'Serviço',
        valor: parseFloat(agendamento.valor) || 0,
        formaPagamento: 'Dinheiro',
        referencia: agendamento.id
    };

    receitas.push(novaReceita);
    DB.save(STORAGE_KEYS.REVENUES, receitas);
}

/**
 * Abre o modal de alteração detalhada de status
 */
function abrirModalStatus(agendamentoId) {
    const agendamentos = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const item = agendamentos.find(a => a.id === agendamentoId);
    if (!item) return;

    const pets = DB.get(STORAGE_KEYS.PETS) || [];
    const clientes = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const pet = pets.find(p => p.id === item.petId);
    const cliente = clientes.find(c => c.id === item.clienteId);

    document.getElementById('status-agendamento-id').value = item.id;
    document.getElementById('status-agendamento-pet').value = `${pet ? pet.nome : 'Pet'} (Tutor: ${cliente ? cliente.nome : 'Cliente'})`;
    document.getElementById('status-agendamento-servico').value = `${item.servico} às ${item.horario || '--:--'} (${formatCurrency(item.valor)})`;
    document.getElementById('status-agendamento-novo').value = item.status || 'agendado';

    openModal('modalStatusAgendamento');
}

/**
 * Confirma a alteração de status através do modal
 */
function confirmarAtualizacaoStatus() {
    const id = document.getElementById('status-agendamento-id').value;
    const novoStatus = document.getElementById('status-agendamento-novo').value;

    closeModal('modalStatusAgendamento');
    alterarStatusAgendamento(id, novoStatus);
}

/**
 * Abre o modal para reposição rápida de estoque
 */
function abrirModalRepor(produtoId) {
    const produtos = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    const prod = produtos.find(p => p.id === produtoId);
    if (!prod) return;

    document.getElementById('repor-produto-id').value = prod.id;
    document.getElementById('repor-produto-nome').value = prod.nome;
    document.getElementById('repor-estoque-atual').value = `${prod.estoque} un.`;
    document.getElementById('repor-estoque-minimo').value = `${prod.estoqueMinimo} un.`;
    document.getElementById('repor-quantidade').value = Math.max(10, (prod.estoqueMinimo * 2) - prod.estoque);

    openModal('modalReporEstoque');
}

/**
 * Salva a entrada de reposição no estoque e registra movimentação
 */
function salvarReposicaoEstoque() {
    const produtoId = document.getElementById('repor-produto-id').value;
    const qtdInput = document.getElementById('repor-quantidade');
    const quantidade = parseInt(qtdInput.value, 10);

    if (isNaN(quantidade) || quantidade <= 0) {
        showToast('Informe uma quantidade válida superior a zero.', 'warning');
        return;
    }

    const produtos = DB.get(STORAGE_KEYS.PRODUCTS) || [];
    const prodIndex = produtos.findIndex(p => p.id === produtoId);

    if (prodIndex === -1) {
        showToast('Produto não encontrado.', 'error');
        return;
    }

    // Atualizar quantidade de estoque
    produtos[prodIndex].estoque = Number(produtos[prodIndex].estoque) + quantidade;
    DB.save(STORAGE_KEYS.PRODUCTS, produtos);

    // Registrar movimentação de estoque
    const movimentacoes = DB.get(STORAGE_KEYS.STOCK_MOVEMENTS) || [];
    movimentacoes.push({
        id: DB.generateId(),
        produtoId: produtoId,
        tipo: 'entrada',
        quantidade: quantidade,
        motivo: 'Reposição rápida via Dashboard',
        data: new Date().toISOString()
    });
    DB.save(STORAGE_KEYS.STOCK_MOVEMENTS, movimentacoes);

    closeModal('modalReporEstoque');
    showToast(`Entrada de ${quantidade} un. registrada para "${produtos[prodIndex].nome}"!`, 'success');

    // Atualizar alerta no header (bolinha vermelha)
    if (typeof checkStockAlerts === 'function') {
        checkStockAlerts();
    }

    recarregarDashboard();
}

/**
 * Renderiza o Quadro Kanban de Banho & Tosa no Dashboard
 */
function renderizarKanbanDashboard() {
    const container = document.getElementById('kanban-dashboard-board');
    if (!container) return;

    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const pets = DB.get(STORAGE_KEYS.PETS) || [];
    const employees = DB.get(STORAGE_KEYS.EMPLOYEES) || [];

    // Filtrar apenas agendamentos de hoje
    const apptsHoje = appointments.filter(a => isDataHoje(a.data));

    // Categorias Kanban
    const colunas = [
        { id: 'agendado', label: '🕒 Aguardando Chegada', classe: 'esperando', itens: [] },
        { id: 'em_andamento', label: '🚿 No Banho / Tosa', classe: 'andamento', itens: [] },
        { id: 'pronto', label: '🐾 Pronto p/ Buscar', classe: 'pronto', itens: [] },
        { id: 'concluido', label: '✅ Entregue / Concluído', classe: 'concluido', itens: [] }
    ];

    apptsHoje.forEach(a => {
        let status = a.status || 'agendado';
        // Mapeia se tiver status diferente
        if (status === 'cancelado') return; // não exibe cancelados no kanban de fluxo ativo
        if (status === 'pronto') {
            colunas[2].itens.push(a);
        } else if (status === 'em_andamento') {
            colunas[1].itens.push(a);
        } else if (status === 'concluido') {
            colunas[3].itens.push(a);
        } else {
            colunas[0].itens.push(a);
        }
    });

    let html = '';

    colunas.forEach(col => {
        html += `
            <div class="kanban-dash-col ${col.classe}">
                <div class="kanban-dash-col-header">
                    <span>${col.label}</span>
                    <span class="badge" style="background:#fff; border:1px solid currentColor;">${col.itens.length}</span>
                </div>
                <div class="kanban-dash-cards-list">
        `;

        if (col.itens.length === 0) {
            html += `<div style="text-align:center; padding:1.5rem 0.5rem; color:#94a3b8; font-size:0.78rem;">Nenhum pet nesta etapa</div>`;
        } else {
            col.itens.forEach(item => {
                const pet = pets.find(p => p.id === item.petId) || { nome: 'Pet', porte: 'M' };
                const client = clients.find(c => c.id === item.clienteId) || { nome: 'Cliente', telefone: '' };
                const emp = employees.find(e => e.id === item.funcionarioId) || { nome: 'Equipe' };

                html += `
                    <div class="kanban-dash-card">
                        <div class="kanban-dash-card-title">
                            <span>🐾 ${escapeHtml(pet.nome)}</span>
                            <span style="font-size:0.75rem; color:#2563eb; font-weight:700;">${item.horario || '--:--'}</span>
                        </div>
                        <div class="kanban-dash-card-sub">
                            <div><strong>${escapeHtml(item.servico || 'Banho')}</strong> • Porte ${pet.porte || 'M'}</div>
                            <div style="font-size:0.72rem; color:#64748b;">Tutor: ${escapeHtml(client.nome)} (${emp.nome})</div>
                        </div>

                        <div class="kanban-dash-actions">
                            ${col.id === 'agendado' ? `
                                <button class="btn btn-sm btn-primary" style="flex:1; padding:3px 6px; font-size:0.72rem;" onclick="moverKanbanStatus('${item.id}', 'em_andamento')">
                                    Iniciar Banho 🚿
                                </button>
                            ` : ''}

                            ${col.id === 'em_andamento' ? `
                                <button class="btn btn-sm btn-success" style="flex:1; padding:3px 6px; font-size:0.72rem; background:#10b981;" onclick="moverKanbanStatus('${item.id}', 'pronto')">
                                    Ficou Pronto ✨
                                </button>
                            ` : ''}

                            ${col.id === 'pronto' ? `
                                <button class="btn btn-sm btn-success" style="flex:1; padding:3px 6px; font-size:0.72rem; background:#16a34a;" onclick="abrirModalWhatsApp('${item.id}', 'pronto_buscar')">
                                    <i data-lucide="message-circle" style="width:12px;height:12px;"></i> Avisar Tutor
                                </button>
                                <button class="btn btn-sm btn-secondary" style="padding:3px 6px; font-size:0.72rem;" onclick="moverKanbanStatus('${item.id}', 'concluido')">
                                    Entregue ✅
                                </button>
                            ` : ''}

                            ${col.id === 'concluido' ? `
                                <span style="font-size:0.72rem; color:#10b981; font-weight:600; text-align:center; width:100%;">Finalizado & Pago</span>
                            ` : ''}

                            <button class="btn-icon" style="padding:2px 4px;" onclick="abrirFichaBaia('${item.id}')" title="Imprimir Ficha de Baia/Gaiola">
                                <i data-lucide="printer" style="width:13px;height:13px;"></i>
                            </button>
                        </div>
                    </div>
                `;
            });
        }

        html += `
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}
window.renderizarKanbanDashboard = renderizarKanbanDashboard;

/**
 * Move o status do pet no Kanban
 */
function moverKanbanStatus(apptId, novoStatus) {
    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const index = appointments.findIndex(a => a.id === apptId);
    if (index === -1) return;

    appointments[index].status = novoStatus;

    // Se concluiu, registra receita se ainda não tiver sido paga
    if (novoStatus === 'concluido') {
        const revenues = DB.get(STORAGE_KEYS.REVENUES) || [];
        const jaRegistrado = revenues.some(r => r.referencia === apptId);
        if (!jaRegistrado) {
            const pet = (DB.get(STORAGE_KEYS.PETS) || []).find(p => p.id === appointments[index].petId);
            const client = (DB.get(STORAGE_KEYS.CLIENTS) || []).find(c => c.id === appointments[index].clienteId);
            revenues.push({
                id: 'rec_' + DB.generateId(),
                data: appointments[index].data || new Date().toISOString().split('T')[0],
                descricao: `${appointments[index].servico || 'Serviço'} - ${pet ? pet.nome : 'Pet'} (${client ? client.nome : 'Cliente'})`,
                categoria: 'Serviço',
                valor: parseFloat(appointments[index].valor) || 0,
                formaPagamento: 'Dinheiro',
                referencia: apptId
            });
            DB.save(STORAGE_KEYS.REVENUES, revenues);
        }
    }

    DB.save(STORAGE_KEYS.APPOINTMENTS, appointments);
    showToast(`Status atualizado com sucesso!`, 'success');

    // Se ficou pronto, pergunta se quer abrir o WhatsApp para avisar o tutor
    if (novoStatus === 'pronto') {
        setTimeout(() => {
            abrirModalWhatsApp(apptId, 'pronto_buscar');
        }, 300);
    }

    recarregarDashboard();
}
window.moverKanbanStatus = moverKanbanStatus;

/**
 * Recarrega todas as informações do Dashboard
 */
function recarregarDashboard() {
    carregarEstatisticas();
    renderizarGraficoFaturamento();
    renderizarGraficoServicos();
    renderizarGraficoProdutos();
    renderizarAgendamentosHoje();
    renderizarAlertasEstoque();
    renderizarKanbanDashboard();

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

// Iniciar Dashboard assim que o documento estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

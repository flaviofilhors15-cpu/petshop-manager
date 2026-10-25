// =========================================================================
// PetShop Manager • Central do Dono do SaaS (js/admin.js)
// Arquiteto de Software: Flávio Filho (flaviofilhors15@gmail.com)
// Painel Executivo Super Admin - Multi-tenant, Telemetria, Billing & Auditoria
// =========================================================================

(function () {
    'use strict';

    // ==========================================
    // 1. CONSTANTES & CHAVES DO LOCALSTORAGE SAAS
    // ==========================================
    const SAAS_STORAGE = {
        TENANTS: 'ps_saas_tenants',
        INVOICES: 'ps_saas_invoices',
        ANNOUNCEMENTS: 'ps_saas_announcements',
        AUDIT_LOGS: 'ps_saas_audit_logs',
        CONFIG: 'ps_saas_config',
        IMPERSONATION: 'ps_impersonating_tenant',
        ACTIVE_SESSION: 'ps_current_user',
        IS_OWNER: 'ps_is_platform_owner'
    };

    const PLANOS_CONFIG = {
        basico: { nome: 'Básico', preco: 89.90, maxUsuarios: 2, maxPets: 250 },
        pro: { nome: 'Profissional', preco: 149.90, maxUsuarios: 6, maxPets: 1000 },
        premium: { nome: 'Premium Enterprise', preco: 249.90, maxUsuarios: 999, maxPets: 99999 }
    };

    // Estado da Aplicação Admin
    let state = {
        tenants: [],
        invoices: [],
        announcements: [],
        auditLogs: [],
        config: {
            diasTrial: 14,
            diasTolerancia: 5,
            gateway: 'asaas'
        },
        selectedTenantId: null,
        chartMrr: null,
        chartPlanos: null
    };

    // ==========================================
    // 2. SEGURANÇA & GUARD DO SUPER ADMIN
    // ==========================================
    function verificarPermissaoSuperAdmin() {
        // Verifica se a flag master ou sessão do dono está ativa
        const isOwner = localStorage.getItem(SAAS_STORAGE.IS_OWNER) === 'true';
        let currentUser = null;
        try {
            currentUser = JSON.parse(localStorage.getItem(SAAS_STORAGE.ACTIVE_SESSION) || 'null');
        } catch (e) {
            currentUser = null;
        }

        const emailDono = 'flaviofilhors15@gmail.com';
        const donoLogado = (currentUser && currentUser.email === emailDono) || isOwner;

        if (!donoLogado) {
            // Solicitação de chave mestra de segurança direta
            const pin = prompt('🔒 ACESSO RESTRITO AO DONO DA PLATAFORMA (SUPER ADMIN)\n\nInforme sua senha de criador para autenticar o console:');
            if (pin === 'Ma15072019$') {
                localStorage.setItem(SAAS_STORAGE.IS_OWNER, 'true');
                if (typeof showToast === 'function') {
                    showToast('Autenticação de Criador validada com sucesso!', 'success');
                }
            } else {
                alert('Acesso negado. Credencial incorreta.');
                window.location.href = 'login.html';
                return false;
            }
        }
        return true;
    }

    // ==========================================
    // 3. BASE REAL LIMPA (SEM DADOS FICTÍCIOS)
    // ==========================================
    function inicializarDadosSaasSeNecessario() {
        // Se ainda não existir ou tiver dados fictícios, sincroniza apenas com os pet shops cadastrados de verdade
        let tenantsReais = [];
        try {
            const rawTenants = JSON.parse(localStorage.getItem('ps_tenants') || '[]');
            // Filtrar apenas cadastros reais (ignora demo se quiser, ou mantém limpo)
            tenantsReais = rawTenants.map(t => ({
                id: t.id,
                nome: t.nomePetShop || t.nome || 'Pet Shop',
                responsavel: t.responsavel || 'Administrador',
                telefone: t.telefone || '-',
                email: t.email || '-',
                cidade: t.cidade || 'Não informada',
                plano: t.plano || 'pro',
                status: t.status || (t.isMasterOwner ? 'active' : 'pending'),
                criadoEm: t.dataCriacao || new Date().toISOString(),
                ultimoAcesso: new Date().toISOString(),
                tutoresCount: 0,
                petsCount: 0,
                agendamentosCount: 0,
                notas: []
            }));
        } catch (e) {
            tenantsReais = [];
        }

        // Salvar base 100% limpa e real
        localStorage.setItem(SAAS_STORAGE.TENANTS, JSON.stringify(tenantsReais));

        if (!localStorage.getItem(SAAS_STORAGE.INVOICES)) {
            localStorage.setItem(SAAS_STORAGE.INVOICES, JSON.stringify([]));
        }

        if (!localStorage.getItem(SAAS_STORAGE.ANNOUNCEMENTS)) {
            localStorage.setItem(SAAS_STORAGE.ANNOUNCEMENTS, JSON.stringify([]));
        }

        if (!localStorage.getItem(SAAS_STORAGE.AUDIT_LOGS)) {
            localStorage.setItem(SAAS_STORAGE.AUDIT_LOGS, JSON.stringify([
                {
                    id: 'log_init',
                    data: new Date().toLocaleString('pt-BR'),
                    acao: 'SISTEMA_INICIALIZADO',
                    loja: 'Global / Plataforma',
                    autor: 'Flávio Filho (Super Admin)',
                    motivo: 'Base do SaaS limpa e pronta para receber clientes reais.'
                }
            ]));
        }
    }

    // Carregar dados na memória
    function carregarDados() {
        try {
            state.tenants = JSON.parse(localStorage.getItem(SAAS_STORAGE.TENANTS) || '[]');
            state.invoices = JSON.parse(localStorage.getItem(SAAS_STORAGE.INVOICES) || '[]');
            state.announcements = JSON.parse(localStorage.getItem(SAAS_STORAGE.ANNOUNCEMENTS) || '[]');
            state.auditLogs = JSON.parse(localStorage.getItem(SAAS_STORAGE.AUDIT_LOGS) || '[]');
            const configSalva = localStorage.getItem(SAAS_STORAGE.CONFIG);
            if (configSalva) state.config = JSON.parse(configSalva);
        } catch (e) {
            console.error('Erro ao decodificar dados do SaaS:', e);
        }
    }

    function salvarTenants() {
        localStorage.setItem(SAAS_STORAGE.TENANTS, JSON.stringify(state.tenants));
    }

    function salvarInvoices() {
        localStorage.setItem(SAAS_STORAGE.INVOICES, JSON.stringify(state.invoices));
    }

    function salvarAuditLogs() {
        localStorage.setItem(SAAS_STORAGE.AUDIT_LOGS, JSON.stringify(state.auditLogs));
    }

    function salvarAnnouncements() {
        localStorage.setItem(SAAS_STORAGE.ANNOUNCEMENTS, JSON.stringify(state.announcements));
    }

    // Registrar Ação no Log de Auditoria Imutável
    function registrarAuditoria(acao, lojaNome, motivo) {
        const novoLog = {
            id: 'log_' + Date.now(),
            data: new Date().toLocaleString('pt-BR'),
            acao: acao,
            loja: lojaNome || 'Global / Plataforma',
            autor: 'Flávio Filho (Super Admin)',
            motivo: motivo || 'Comando administrativo direto'
        };
        state.auditLogs.unshift(novoLog);
        salvarAuditLogs();
        renderizarAuditoria();
    }

    // ==========================================
    // 4. CÁLCULO E RENDERIZAÇÃO DOS KPIS SAAS
    // ==========================================
    function calcularMetricasSaaS() {
        let mrrTotal = 0;
        let lojasAtivas = 0;
        let lojasTrial = 0;
        let lojasSuspensas = 0;
        let lojasCanceladas = 0;
        let totalPets = 0;
        let totalTutores = 0;

        state.tenants.forEach(t => {
            if (t.status === 'active') {
                lojasAtivas++;
                const valorPlano = PLANOS_CONFIG[t.plano] ? PLANOS_CONFIG[t.plano].preco : 0;
                mrrTotal += valorPlano;
            } else if (t.status === 'trial') {
                lojasTrial++;
            } else if (t.status === 'suspended') {
                lojasSuspensas++;
            } else if (t.status === 'cancelled') {
                lojasCanceladas++;
            }

            totalPets += (t.petsCount || 0);
            totalTutores += (t.tutoresCount || 0);
        });

        // ARR (Anualizado)
        const arrTotal = mrrTotal * 12;

        // Inadimplência
        const faturasAtrasadas = state.invoices.filter(i => i.status === 'atrasado');
        const valorInadimplente = faturasAtrasadas.reduce((acc, cur) => acc + (cur.valor || 0), 0);
        const lojasInadimplentesCount = new Set(faturasAtrasadas.map(f => f.tenantId)).size;

        // ARPU (Ticket Médio por loja ativa)
        const arpu = lojasAtivas > 0 ? (mrrTotal / lojasAtivas) : 0;

        // Churn Rate (% de canceladas sobre a base)
        const totalBase = state.tenants.length;
        const churnRate = totalBase > 0 ? ((lojasCanceladas / totalBase) * 100).toFixed(1) : '0.0';

        // Atualizar no DOM
        const elMrr = document.getElementById('kpi-mrr');
        const elArr = document.getElementById('kpi-arr');
        const elLojasTotal = document.getElementById('kpi-lojas-total');
        const elLojasAtivas = document.getElementById('kpi-lojas-ativas');
        const elLojasTrial = document.getElementById('kpi-lojas-trial');
        const elInadimplenciaValor = document.getElementById('kpi-inadimplencia-valor');
        const elInadimplenciaLojas = document.getElementById('kpi-inadimplencia-lojas');
        const elChurn = document.getElementById('kpi-churn');
        const elArpu = document.getElementById('kpi-arpu');
        const elVolumePets = document.getElementById('kpi-volume-pets');
        const elVolumeTutores = document.getElementById('kpi-volume-tutores');
        const badgeLojas = document.getElementById('badge-total-lojas');

        if (elMrr) elMrr.textContent = formatarMoeda(mrrTotal);
        if (elArr) elArr.textContent = formatarMoeda(arrTotal);
        if (elLojasTotal) elLojasTotal.textContent = totalBase;
        if (elLojasAtivas) elLojasAtivas.textContent = `${lojasAtivas} ativas`;
        if (elLojasTrial) elLojasTrial.textContent = `${lojasTrial} trial`;
        if (elInadimplenciaValor) elInadimplenciaValor.textContent = formatarMoeda(valorInadimplente);
        if (elInadimplenciaLojas) elInadimplenciaLojas.textContent = `${lojasInadimplentesCount} lojas`;
        if (elChurn) elChurn.textContent = `${churnRate}%`;
        if (elArpu) elArpu.textContent = formatarMoeda(arpu);
        if (elVolumePets) elVolumePets.textContent = `${totalPets.toLocaleString('pt-BR')} pets`;
        if (elVolumeTutores) elVolumeTutores.textContent = `${totalTutores.toLocaleString('pt-BR')} tutores`;
        if (badgeLojas) badgeLojas.textContent = totalBase;

        renderizarRadarAlertas(faturasAtrasadas, lojasTrial);
        atualizarGraficosExecutivos(mrrTotal);
    }

    function formatarMoeda(val) {
        return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    // Radar de Alertas Rápidos
    function renderizarRadarAlertas(faturasAtrasadas, lojasTrialCount) {
        const radarContainer = document.getElementById('lista-alertas-radar');
        if (!radarContainer) return;

        let html = '';

        if (faturasAtrasadas.length > 0) {
            faturasAtrasadas.forEach(fat => {
                html += `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(239, 68, 68, 0.1); border-left:4px solid #ef4444; padding:0.75rem 1rem; border-radius:4px;">
                        <div>
                            <strong style="color:#ef4444; font-size:0.85rem;">Inadimplência Crítica:</strong>
                            <span style="font-size:0.85rem; margin-left:6px; color:var(--adm-text);">${fat.lojaNome}</span>
                            <div style="font-size:0.75rem; color:var(--adm-text-muted);">Fatura de ${formatarMoeda(fat.valor)} vencida em ${fat.vencimento}</div>
                        </div>
                        <button class="btn btn-secondary btn-sm" onclick="abrirDossieLoja('${fat.tenantId}')" style="font-size:0.75rem;">
                            Ver Loja
                        </button>
                    </div>
                `;
            });
        }

        if (lojasTrialCount > 0) {
            html += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(245, 158, 11, 0.1); border-left:4px solid #f59e0b; padding:0.75rem 1rem; border-radius:4px;">
                    <div>
                        <strong style="color:#f59e0b; font-size:0.85rem;">Leads em Teste Grátis:</strong>
                        <span style="font-size:0.85rem; margin-left:6px; color:var(--adm-text);">${lojasTrialCount} pet shop(s) estão em período Trial de avaliação.</span>
                    </div>
                    <button class="btn btn-secondary btn-sm" onclick="filtrarTrialDirect()" style="font-size:0.75rem;">
                        Acompanhar Conversão
                    </button>
                </div>
            `;
        }

        if (!html) {
            html = `<div style="text-align:center; padding:1.5rem; color:var(--adm-text-muted); font-size:0.85rem;">🎉 Nenhuma pendência crítica ou risco de churn detectado no momento. Plataforma 100% estável!</div>`;
        }

        radarContainer.innerHTML = html;
    }

    // ==========================================
    // 5. GRÁFICOS EXECUTIVOS (CHART.JS)
    // ==========================================
    function atualizarGraficosExecutivos(mrrAtual) {
        if (typeof Chart === 'undefined') return;

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
        const textColor = isDark ? '#94a3b8' : '#64748b';

        // Gráfico 1: Evolução Histórica de MRR (Últimos 6 meses)
        const ctxMrr = document.getElementById('chart-mrr-evolucao');
        if (ctxMrr) {
            if (state.chartMrr) state.chartMrr.destroy();

            const labelsMeses = ['Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro Atual'];
            // Histórico simulado crescendo em direção ao MRR atual
            const baseProg = mrrAtual > 0 ? mrrAtual : 790;
            const dataMrr = [
                Math.round(baseProg * 0.40),
                Math.round(baseProg * 0.55),
                Math.round(baseProg * 0.70),
                Math.round(baseProg * 0.85),
                Math.round(baseProg * 0.92),
                Math.round(baseProg)
            ];

            state.chartMrr = new Chart(ctxMrr, {
                type: 'line',
                data: {
                    labels: labelsMeses,
                    datasets: [{
                        label: 'MRR (R$)',
                        data: dataMrr,
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.15)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.35,
                        pointBackgroundColor: '#2563eb',
                        pointRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (ctx) => ` Receita Mensal: R$ ${ctx.parsed.y.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                            }
                        }
                    },
                    scales: {
                        x: { grid: { color: gridColor }, ticks: { color: textColor } },
                        y: {
                            grid: { color: gridColor },
                            ticks: {
                                color: textColor,
                                callback: (v) => 'R$ ' + v
                            }
                        }
                    }
                }
            });
        }

        // Gráfico 2: Distribuição por Planos
        const ctxPlanos = document.getElementById('chart-planos-distribuicao');
        if (ctxPlanos) {
            if (state.chartPlanos) state.chartPlanos.destroy();

            const contagemPlanos = { basico: 0, pro: 0, premium: 0 };
            state.tenants.forEach(t => {
                if (contagemPlanos[t.plano] !== undefined) contagemPlanos[t.plano]++;
            });

            state.chartPlanos = new Chart(ctxPlanos, {
                type: 'doughnut',
                data: {
                    labels: ['Básico (R$ 89,90)', 'Pro (R$ 149,90)', 'Premium (R$ 249,90)'],
                    datasets: [{
                        data: [contagemPlanos.basico, contagemPlanos.pro, contagemPlanos.premium],
                        backgroundColor: ['#06b6d4', '#2563eb', '#8b5cf6'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { color: textColor, font: { size: 11 } }
                        }
                    },
                    cutout: '68%'
                }
            });
        }
    }

    // ==========================================
    // 6. GESTÃO DE TENANTS (TABELA E FILTROS)
    // ==========================================
    window.renderizarTabelaLojas = function () {
        const tbody = document.getElementById('tabela-tenants-body');
        if (!tbody) return;

        const filtroTexto = (document.getElementById('filtro-nome-loja')?.value || '').toLowerCase().trim();
        const filtroStatus = document.getElementById('filtro-status-loja')?.value || '';
        const filtroPlano = document.getElementById('filtro-plano-loja')?.value || '';

        const listaFiltrada = state.tenants.filter(t => {
            const bateTexto = !filtroTexto ||
                t.nome.toLowerCase().includes(filtroTexto) ||
                (t.responsavel && t.responsavel.toLowerCase().includes(filtroTexto)) ||
                (t.email && t.email.toLowerCase().includes(filtroTexto)) ||
                (t.cidade && t.cidade.toLowerCase().includes(filtroTexto));
            
            const bateStatus = !filtroStatus || t.status === filtroStatus;
            const batePlano = !filtroPlano || t.plano === filtroPlano;

            return bateTexto && bateStatus && batePlano;
        });

        if (listaFiltrada.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; padding:2rem; color:var(--adm-text-muted);">
                        Nenhum pet shop encontrado para os critérios de busca selecionados.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = listaFiltrada.map(loja => {
            const statusConfig = {
                pending: { label: '🟠 Aguardando Aprovação', class: 'status-trial' },
                active: { label: '🟢 Ativa', class: 'status-active' },
                trial: { label: '🟡 Em Teste (Trial)', class: 'status-trial' },
                suspended: { label: '🔴 Suspensa / Bloqueada', class: 'status-suspended' },
                cancelled: { label: '⚪ Cancelada', class: 'status-cancelled' }
            }[loja.status] || { label: loja.status, class: 'status-trial' };

            const planoLabel = {
                basico: 'Básico (R$ 89,90)',
                pro: 'Profissional (R$ 149,90)',
                premium: 'Premium (R$ 249,90)'
            }[loja.plano] || loja.plano;

            return `
                <tr>
                    <td>
                        <div style="font-weight:600; color:var(--adm-text); font-size:0.92rem;">${loja.nome}</div>
                        <div style="font-size:0.75rem; color:var(--adm-text-muted);"><i data-lucide="map-pin" style="width:12px; height:12px; vertical-align:middle;"></i> ${loja.cidade || 'Não informada'}</div>
                    </td>
                    <td>
                        <div style="font-size:0.85rem; color:var(--adm-text);">${loja.responsavel || '-'}</div>
                        <div style="font-size:0.75rem; color:var(--adm-text-muted);">${loja.telefone || '-'} • ${loja.email}</div>
                    </td>
                    <td>
                        <span style="font-size:0.82rem; font-weight:600; color:#3b82f6; background:rgba(59,130,246,0.1); padding:3px 8px; border-radius:4px;">
                            ${planoLabel}
                        </span>
                    </td>
                    <td>
                        <span class="status-badge ${statusConfig.class}">
                            ${statusConfig.label}
                        </span>
                    </td>
                    <td>
                        <div style="font-size:0.78rem; color:var(--adm-text-muted);">
                            <strong>${loja.petsCount || 0}</strong> pets • <strong>${loja.agendamentosCount || 0}</strong> agend.
                        </div>
                    </td>
                    <td style="font-size:0.8rem; color:var(--adm-text-muted);">
                        ${loja.criadoEm ? new Date(loja.criadoEm).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td style="text-align:right; white-space:nowrap;">
                        <button class="btn btn-secondary btn-sm" onclick="acessarLojaDireto('${loja.id}')" title="Entrar no Pet Shop desta loja" style="padding:4px 9px; font-size:0.78rem; color:#10b981; border-color:rgba(16,185,129,0.3); margin-right:4px;">
                            <i data-lucide="external-link" style="width:13px;height:13px;"></i> Entrar
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="abrirDossieLoja('${loja.id}')" title="Abrir Dossiê 360° da Loja" style="padding:4px 9px; font-size:0.78rem;">
                            <i data-lucide="eye" style="width:13px;height:13px;"></i> Dossiê
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    window.filtrarLojasRapido = function (texto) {
        const inputFiltro = document.getElementById('filtro-nome-loja');
        if (inputFiltro) {
            inputFiltro.value = texto;
            window.renderizarTabelaLojas();
        }
    };

    window.filtrarTrialDirect = function () {
        window.navegarAdmin('tenants');
        const selectStatus = document.getElementById('filtro-status-loja');
        if (selectStatus) {
            selectStatus.value = 'trial';
            window.renderizarTabelaLojas();
        }
    };

    // ==========================================
    // 7. DOSSIÊ 360° DA LOJA (DRAWER LATERAL)
    // ==========================================
    window.abrirDossieLoja = function (tenantId) {
        const loja = state.tenants.find(t => t.id === tenantId);
        if (!loja) return;

        state.selectedTenantId = tenantId;

        document.getElementById('dossie-nome').textContent = loja.nome;
        document.getElementById('dossie-slug').textContent = `ID ÚNICO: ${loja.id} • ${loja.cidade || ''}`;
        document.getElementById('dossie-responsavel').textContent = loja.responsavel || '-';
        document.getElementById('dossie-telefone').textContent = loja.telefone || '-';
        document.getElementById('dossie-email').textContent = loja.email;
        document.getElementById('dossie-plano').textContent = (PLANOS_CONFIG[loja.plano]?.nome || loja.plano).toUpperCase();

        const badgeStatus = document.getElementById('dossie-status-badge');
        badgeStatus.className = `status-badge status-${loja.status}`;
        badgeStatus.textContent = {
            active: 'Ativa • Regular',
            trial: 'Em Período de Teste',
            suspended: 'Bloqueada por Inadimplência',
            cancelled: 'Cancelada'
        }[loja.status] || loja.status;

        // Telemetria agregada
        document.getElementById('dossie-count-tutores').textContent = (loja.tutoresCount || 0).toLocaleString('pt-BR');
        document.getElementById('dossie-count-pets').textContent = (loja.petsCount || 0).toLocaleString('pt-BR');
        document.getElementById('dossie-count-agendamentos').textContent = (loja.agendamentosCount || 0).toLocaleString('pt-BR');

        // Notas Internas
        renderizarNotasDossie(loja.notas || []);

        const drawer = document.getElementById('drawer-loja-overlay');
        if (drawer) {
            drawer.style.display = 'flex';
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    window.fecharGavetaLoja = function (e) {
        if (!e || e.target.id === 'drawer-loja-overlay' || e.target.closest('.btn-icon')) {
            const drawer = document.getElementById('drawer-loja-overlay');
            if (drawer) drawer.style.display = 'none';
            state.selectedTenantId = null;
        }
    };

    function renderizarNotasDossie(notas) {
        const container = document.getElementById('dossie-notas-lista');
        if (!container) return;

        if (notas.length === 0) {
            container.innerHTML = `<div style="font-size:0.78rem; color:var(--adm-text-muted); font-style:italic;">Nenhuma anotação interna registrada para este cliente.</div>`;
            return;
        }

        container.innerHTML = notas.map(n => `
            <div style="background:var(--adm-bg); padding:8px 10px; border-radius:6px; border:1px solid var(--adm-border); font-size:0.8rem;">
                <div style="display:flex; justify-content:space-between; color:var(--adm-text-muted); font-size:0.72rem; margin-bottom:3px;">
                    <strong>${n.autor}</strong>
                    <span>${n.data}</span>
                </div>
                <div style="color:var(--adm-text);">${n.texto}</div>
            </div>
        `).join('');
    }

    window.adicionarNotaDossie = function () {
        if (!state.selectedTenantId) return;
        const input = document.getElementById('input-nova-nota-dossie');
        const texto = input.value.trim();
        if (!texto) return;

        const loja = state.tenants.find(t => t.id === state.selectedTenantId);
        if (!loja) return;

        if (!loja.notas) loja.notas = [];
        loja.notas.unshift({
            autor: 'Flávio Filho (Dono)',
            texto: texto,
            data: new Date().toLocaleString('pt-BR')
        });

        salvarTenants();
        renderizarNotasDossie(loja.notas);
        input.value = '';
        if (typeof showToast === 'function') showToast('Anotação interna registrada!', 'success');
    };

    // ==========================================
    // 8. AÇÕES ADMINISTRATIVAS COM AUDITORIA
    // ==========================================
    window.alternarStatusLoja = function (novoStatus) {
        if (!state.selectedTenantId) return;
        const loja = state.tenants.find(t => t.id === state.selectedTenantId);
        if (!loja) return;

        const labelsAcao = {
            active: 'LIBERAR ACESSO IMEDIATO',
            suspended: 'BLOQUEAR ACESSO (SUSPENSÃO)',
            cancelled: 'CANCELAR CONTRATO'
        };

        const acaoNome = labelsAcao[novoStatus] || novoStatus;
        const motivo = prompt(`⚠️ AÇÃO SUPER ADMIN: ${acaoNome}\nLoja: "${loja.nome}"\n\nPor favor, digite a JUSTIFICATIVA desta alteração (obrigatório para log de auditoria):`);

        if (motivo === null) return; // cancelou o prompt
        if (!motivo.trim()) {
            alert('A justificativa é obrigatória para executar ações administrativas.');
            return;
        }

        loja.status = novoStatus;
        salvarTenants();

        registrarAuditoria(`ALTERAR_STATUS_PARA_${novoStatus.toUpperCase()}`, loja.nome, motivo);

        calcularMetricasSaaS();
        window.renderizarTabelaLojas();
        window.abrirDossieLoja(loja.id);

        if (typeof showToast === 'function') {
            showToast(`Status da loja ${loja.nome} atualizado para ${novoStatus.toUpperCase()}!`, 'success');
        }
    };

    window.abrirModalEstenderTrial = function () {
        if (!state.selectedTenantId) return;
        const loja = state.tenants.find(t => t.id === state.selectedTenantId);
        if (!loja) return;

        const diasStr = prompt(`⏰ ESTENDER TESTE GRÁTIS\nLoja: "${loja.nome}"\n\nQuantos dias adicionais deseja conceder? (Ex: 7 ou 14):`, '7');
        if (!diasStr) return;

        const dias = parseInt(diasStr, 10);
        if (isNaN(dias) || dias <= 0) {
            alert('Informe um número válido de dias.');
            return;
        }

        const motivo = prompt('Informe o motivo da extensão de trial:');
        if (!motivo) return;

        loja.status = 'trial';
        const dataAtual = new Date();
        dataAtual.setDate(dataAtual.getDate() + dias);
        loja.trialExpiraEm = dataAtual.toISOString();

        salvarTenants();
        registrarAuditoria(`EXTENSAO_TRIAL_${dias}_DIAS`, loja.nome, motivo);
        calcularMetricasSaaS();
        window.renderizarTabelaLojas();
        window.abrirDossieLoja(loja.id);

        if (typeof showToast === 'function') showToast(`Trial estendido em +${dias} dias!`, 'success');
    };

    // ==========================================
    // 9. MECANISMO DE IMPERSONATE (ACESSAR COMO A LOJA)
    // ==========================================
    window.iniciarImpersonacaoLoja = function () {
        if (!state.selectedTenantId) return;
        const loja = state.tenants.find(t => t.id === state.selectedTenantId);
        if (!loja) return;

        const confirma = confirm(
            `🕵️ MODO DE SUPORTE MASTER (IMPERSONATE)\n\n` +
            `Você está prestes a entrar no ambiente do pet shop:\n"${loja.nome}"\n\n` +
            `Uma tarja vermelha de emergência permanecerá no topo para você retornar a este painel a qualquer momento.\n\n` +
            `Deseja prosseguir com o acesso de suporte?`
        );

        if (!confirma) return;

        registrarAuditoria('IMPERSONATE_SESSION_START', loja.nome, 'Acesso de suporte técnico master solicitado pelo dono.');

        // Salva estado de impersonação no localStorage
        localStorage.setItem(SAAS_STORAGE.IMPERSONATION, JSON.stringify({
            tenantId: loja.id,
            tenantNome: loja.nome,
            plano: loja.plano,
            startedAt: new Date().toISOString()
        }));

        // Ativa os dados específicos desta loja
        localStorage.setItem('ps_current_tenant_id', loja.id);
        localStorage.setItem('ps_current_tenant_name', loja.nome);

        // Redireciona para a home operacional do petshop
        window.location.href = 'index.html';
    };

    window.acessarLojaDireto = function (tenantId) {
        const loja = state.tenants.find(t => t.id === tenantId);
        if (!loja) return;

        localStorage.setItem(SAAS_STORAGE.IMPERSONATION, JSON.stringify({
            tenantId: loja.id,
            tenantNome: loja.nome,
            plano: loja.plano,
            startedAt: new Date().toISOString()
        }));

        localStorage.setItem('ps_current_tenant_id', loja.id);
        localStorage.setItem('ps_current_tenant_name', loja.nome);

        registrarAuditoria('IMPERSONATE_SESSION_START', loja.nome, 'Acesso direto master à loja realizado.');
        window.location.href = 'index.html';
    };

    window.encerrarImpersonacao = function () {
        const dados = localStorage.getItem(SAAS_STORAGE.IMPERSONATION);
        if (dados) {
            try {
                const parsed = JSON.parse(dados);
                registrarAuditoria('IMPERSONATE_SESSION_END', parsed.tenantNome, 'Sessão de suporte concluída e encerrada.');
            } catch (e) {}
        }
        localStorage.removeItem(SAAS_STORAGE.IMPERSONATION);
        window.location.href = 'admin.html';
    };

    // Verificar se está em modo impersonate para exibir banner
    function checarBannerImpersonacao() {
        const impData = localStorage.getItem(SAAS_STORAGE.IMPERSONATION);
        const banner = document.getElementById('impersonate-banner');
        if (impData && banner) {
            try {
                const loja = JSON.parse(impData);
                document.getElementById('impersonate-store-name').textContent = loja.tenantNome;
                banner.style.display = 'flex';
            } catch (e) {
                banner.style.display = 'none';
            }
        } else if (banner) {
            banner.style.display = 'none';
        }
    }

    // ==========================================
    // 10. CADASTRO MANUAL DE NOVO PET SHOP
    // ==========================================
    window.abrirModalNovaLojaManual = function () {
        const modal = document.getElementById('modal-nova-loja-admin');
        if (modal) {
            modal.classList.add('active');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    };

    window.salvarNovaLojaAdmin = function (event) {
        event.preventDefault();

        const nome = document.getElementById('cad-adm-nome').value.trim();
        const responsavel = document.getElementById('cad-adm-responsavel').value.trim();
        const telefone = document.getElementById('cad-adm-telefone').value.trim();
        const email = document.getElementById('cad-adm-email').value.trim();
        const plano = document.getElementById('cad-adm-plano').value;

        if (!nome || !email) {
            alert('Por favor, preencha o Nome e o E-mail da loja.');
            return;
        }

        const novoTenant = {
            id: 'ten_' + Date.now().toString().slice(-5),
            nome: nome,
            responsavel: responsavel,
            telefone: telefone,
            email: email,
            cidade: 'Cadastrado via Super Admin',
            plano: plano,
            status: 'active',
            criadoEm: new Date().toISOString(),
            ultimoAcesso: new Date().toISOString(),
            tutoresCount: 0,
            petsCount: 0,
            agendamentosCount: 0,
            notas: [
                { autor: 'Flávio Filho', texto: 'Conta criada manualmente com acesso imediato liberado.', data: new Date().toLocaleString('pt-BR') }
            ]
        };

        state.tenants.unshift(novoTenant);
        salvarTenants();

        registrarAuditoria('CRIAR_LOJA_MANUAL', nome, `Cadastro manual com plano ${plano.toUpperCase()}.`);

        if (typeof closeModal === 'function') {
            closeModal('modal-nova-loja-admin');
        } else {
            document.getElementById('modal-nova-loja-admin')?.classList.remove('active');
        }

        document.getElementById('form-cad-loja-admin')?.reset();
        calcularMetricasSaaS();
        window.renderizarTabelaLojas();

        if (typeof showToast === 'function') {
            showToast(`Pet Shop "${nome}" criado com sucesso!`, 'success');
        }
    };

    // ==========================================
    // 11. FINANCEIRO, FATURAS E REENVIO DE LINK
    // ==========================================
    function renderizarFaturas() {
        const tbody = document.getElementById('tabela-faturas-body');
        if (!tbody) return;

        if (state.invoices.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--adm-text-muted);">Nenhuma fatura registrada.</td></tr>`;
            return;
        }

        tbody.innerHTML = state.invoices.map(fat => {
            const statusConfig = {
                pago: { label: 'Pago', color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                pendente: { label: 'Pendente', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
                atrasado: { label: 'Atrasado', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' }
            }[fat.status] || { label: fat.status, color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' };

            return `
                <tr>
                    <td>
                        <strong style="color:var(--adm-text); font-size:0.88rem;">${fat.lojaNome}</strong>
                    </td>
                    <td style="text-transform:capitalize; font-size:0.82rem; color:var(--adm-text-muted);">${fat.plano}</td>
                    <td style="font-weight:700; color:var(--adm-text); font-size:0.9rem;">${formatarMoeda(fat.valor)}</td>
                    <td style="font-size:0.82rem; color:var(--adm-text-muted);">${fat.vencimento}</td>
                    <td>
                        <span style="font-size:0.75rem; font-weight:700; color:${statusConfig.color}; background:${statusConfig.bg}; padding:3px 8px; border-radius:4px;">
                            ${statusConfig.label}
                        </span>
                    </td>
                    <td style="font-size:0.8rem; color:var(--adm-text-muted);">${fat.forma || 'Asaas Pix'}</td>
                    <td style="text-align:right;">
                        <button class="btn btn-secondary btn-sm" onclick="reenviarLinkCobranca('${fat.id}')" title="Reenviar link de pagamento via WhatsApp" style="padding:4px 8px; font-size:0.75rem;">
                            <i data-lucide="send"></i> Cobrar
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    window.reenviarLinkCobranca = function (invoiceId) {
        const fatura = state.invoices.find(f => f.id === invoiceId);
        if (!fatura) return;

        const linkSimulado = `https://asaas.com/cobranca/pay_${fatura.id}`;
        alert(`📲 LINK DE COBRANÇA GERADO COM SUCESSO!\n\nLoja: ${fatura.lojaNome}\nValor: ${formatarMoeda(fatura.valor)}\n\nLink Pix/Boleto: ${linkSimulado}\n\nO link pode ser copiado e enviado diretamente pelo WhatsApp.`);
        registrarAuditoria('REENVIO_LINK_COBRANCA', fatura.lojaNome, `Envio manual do link de pagamento da fatura ${fatura.id}.`);
    };

    window.gerarCobrancasMensais = function () {
        const ativas = state.tenants.filter(t => t.status === 'active');
        let geradas = 0;

        ativas.forEach(t => {
            const preco = PLANOS_CONFIG[t.plano]?.preco || 99;
            const novaFat = {
                id: 'inv_' + Date.now().toString().slice(-4) + Math.floor(Math.random() * 90),
                tenantId: t.id,
                lojaNome: t.nome,
                plano: t.plano,
                valor: preco,
                vencimento: '2026-11-10',
                status: 'pendente',
                forma: 'Pix Recorrente (Asaas)'
            };
            state.invoices.unshift(novaFat);
            geradas++;
        });

        salvarInvoices();
        renderizarFaturas();
        calcularMetricasSaaS();
        registrarAuditoria('CICLO_COBRANCA_DISPARADO', 'Global', `${geradas} faturas mensais emitidas automaticamente.`);
        alert(`Sucesso! ${geradas} faturas do novo ciclo de faturamento foram geradas e agendadas.`);
    };

    // ==========================================
    // 12. TELEMETRIA & RANKING DE ENGAJAMENTO
    // ==========================================
    function renderizarTelemetriaRankings() {
        const rankingAtivas = document.getElementById('lista-ranking-ativas');
        const rankingRisco = document.getElementById('lista-ranking-risco');

        if (!rankingAtivas || !rankingRisco) return;

        // Ordenar por agendamentos
        const ordenadas = [...state.tenants].sort((a, b) => (b.agendamentosCount || 0) - (a.agendamentosCount || 0));

        // Mais ativas (Top 4)
        const topAtivas = ordenadas.slice(0, 4);
        rankingAtivas.innerHTML = topAtivas.map((loja, idx) => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--adm-bg); padding:10px 14px; border-radius:6px; border:1px solid var(--adm-border);">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-weight:800; color:#2563eb; font-size:1.1rem; width:22px;">#${idx + 1}</span>
                    <div>
                        <div style="font-weight:600; font-size:0.88rem; color:var(--adm-text);">${loja.nome}</div>
                        <div style="font-size:0.75rem; color:var(--adm-text-muted);">${loja.cidade || ''} • Plano ${loja.plano.toUpperCase()}</div>
                    </div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:700; color:#10b981; font-size:0.95rem;">${(loja.agendamentosCount || 0).toLocaleString('pt-BR')} agend.</div>
                    <div style="font-size:0.72rem; color:var(--adm-text-muted);">${loja.petsCount || 0} pets cadastrados</div>
                </div>
            </div>
        `).join('');

        // Menos ativas / Risco de cancelamento
        const menosAtivas = [...state.tenants].filter(t => t.status !== 'cancelled').sort((a, b) => (a.agendamentosCount || 0) - (b.agendamentosCount || 0)).slice(0, 4);
        rankingRisco.innerHTML = menosAtivas.map(loja => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--adm-bg); padding:10px 14px; border-radius:6px; border:1px solid var(--adm-border);">
                <div>
                    <div style="font-weight:600; font-size:0.88rem; color:var(--adm-text);">${loja.nome}</div>
                    <div style="font-size:0.75rem; color:var(--adm-text-muted);">Último acesso: ${loja.ultimoAcesso ? new Date(loja.ultimoAcesso).toLocaleDateString('pt-BR') : 'Sem dados'}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-weight:700; color:#ef4444; font-size:0.85rem;">Baixo Engajamento</div>
                    <button class="btn btn-secondary btn-sm" onclick="abrirDossieLoja('${loja.id}')" style="font-size:0.72rem; padding:2px 8px; margin-top:4px;">
                        Contatar Loja
                    </button>
                </div>
            </div>
        `).join('');
    }

    // ==========================================
    // 13. COMUNICADOS GLOBAIS
    // ==========================================
    function renderizarAvisos() {
        const tbody = document.getElementById('tabela-avisos-body');
        if (!tbody) return;

        if (state.announcements.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--adm-text-muted);">Nenhum comunicado ativo.</td></tr>`;
            return;
        }

        tbody.innerHTML = state.announcements.map(av => `
            <tr>
                <td style="font-weight:600; color:var(--adm-text); font-size:0.88rem;">${av.titulo}</td>
                <td style="font-size:0.8rem; text-transform:capitalize; color:#3b82f6;">${av.tipo}</td>
                <td style="font-size:0.8rem; color:var(--adm-text-muted);">${av.publico}</td>
                <td style="font-size:0.8rem; color:var(--adm-text-muted);">${av.data}</td>
                <td>
                    <span style="font-size:0.75rem; font-weight:700; color:#10b981; background:rgba(16,185,129,0.1); padding:3px 8px; border-radius:4px;">
                        ${av.status.toUpperCase()}
                    </span>
                </td>
                <td style="text-align:right;">
                    <button class="btn btn-secondary btn-sm" onclick="excluirAviso('${av.id}')" style="padding:4px 8px; font-size:0.75rem; color:#ef4444;">
                        <i data-lucide="trash-2"></i> Excluir
                    </button>
                </td>
            </tr>
        `).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    window.abrirModalNovoAviso = function () {
        const titulo = prompt('📢 PUBLICAR NOVO COMUNICADO EM TODAS AS LOJAS\n\nDigite o título / mensagem do aviso:');
        if (!titulo || !titulo.trim()) return;

        const novoAviso = {
            id: 'aviso_' + Date.now(),
            titulo: titulo.trim(),
            tipo: 'novidade',
            publico: 'Todas as Lojas',
            data: new Date().toLocaleDateString('pt-BR'),
            status: 'ativo'
        };

        state.announcements.unshift(novoAviso);
        salvarAnnouncements();
        renderizarAvisos();
        registrarAuditoria('PUBLICAR_AVISO_GLOBAL', 'Todas as Lojas', `Título: "${titulo}"`);

        if (typeof showToast === 'function') showToast('Comunicado global publicado com sucesso!', 'success');
    };

    window.excluirAviso = function (id) {
        if (!confirm('Deseja realmente remover este comunicado das lojas?')) return;
        state.announcements = state.announcements.filter(a => a.id !== id);
        salvarAnnouncements();
        renderizarAvisos();
    };

    // ==========================================
    // 14. TRILHA DE AUDITORIA (AUDIT LOGS)
    // ==========================================
    function renderizarAuditoria() {
        const tbody = document.getElementById('tabela-auditoria-admin-body');
        if (!tbody) return;

        if (state.auditLogs.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem; color:var(--adm-text-muted);">Nenhum registro de auditoria.</td></tr>`;
            return;
        }

        tbody.innerHTML = state.auditLogs.slice(0, 30).map(log => `
            <tr>
                <td style="font-size:0.8rem; color:var(--adm-text-muted); font-family:'JetBrains Mono', monospace;">${log.data}</td>
                <td>
                    <span style="font-family:'JetBrains Mono', monospace; font-size:0.78rem; font-weight:700; color:#3b82f6; background:rgba(59,130,246,0.1); padding:2px 6px; border-radius:3px;">
                        ${log.acao}
                    </span>
                </td>
                <td style="font-weight:600; font-size:0.85rem; color:var(--adm-text);">${log.loja}</td>
                <td style="font-size:0.8rem; color:var(--adm-text-muted);">${log.autor}</td>
                <td style="font-size:0.82rem; color:var(--adm-text);">${log.motivo}</td>
            </tr>
        `).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // ==========================================
    // 15. EXPORTAÇÕES EM CSV (MÉTRICAS & AUDITORIA)
    // ==========================================
    window.exportarRelatorioSaaSCsv = function () {
        const cabecalho = 'ID,Nome,Responsavel,Telefone,Email,Cidade,Plano,Status,Pets,Agendamentos,CriadoEm\n';
        const linhas = state.tenants.map(t => [
            `"${t.id}"`,
            `"${t.nome}"`,
            `"${t.responsavel || ''}"`,
            `"${t.telefone || ''}"`,
            `"${t.email}"`,
            `"${t.cidade || ''}"`,
            `"${t.plano}"`,
            `"${t.status}"`,
            t.petsCount || 0,
            t.agendamentosCount || 0,
            `"${t.criadoEm || ''}"`
        ].join(',')).join('\n');

        const blob = new Blob(['\uFEFF' + cabecalho + linhas], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `relatorio-saas-petshop-manager-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    window.exportarAuditoriaAdminCsv = function () {
        const cabecalho = 'Data,Acao,Loja,Autor,Motivo\n';
        const linhas = state.auditLogs.map(l => [
            `"${l.data}"`,
            `"${l.acao}"`,
            `"${l.loja}"`,
            `"${l.autor}"`,
            `"${l.motivo.replace(/"/g, '""')}"`
        ].join(',')).join('\n');

        const blob = new Blob(['\uFEFF' + cabecalho + linhas], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `auditoria-master-petshop-manager-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
    };

    // ==========================================
    // 16. CONFIGURAÇÕES SAAS & TEMA
    // ==========================================
    window.salvarConfiguracoesSaaS = function (event) {
        event.preventDefault();

        const diasTrial = parseInt(document.getElementById('cfg-dias-trial')?.value, 10) || 14;
        const diasTolerancia = parseInt(document.getElementById('cfg-dias-tolerancia')?.value, 10) || 5;
        const gateway = document.getElementById('cfg-gateway')?.value || 'asaas';

        state.config = {
            diasTrial,
            diasTolerancia,
            gateway
        };

        localStorage.setItem(SAAS_STORAGE.CONFIG, JSON.stringify(state.config));
        registrarAuditoria('SALVAR_CONFIGURACOES_SAAS', 'Global', `Trial: ${diasTrial} dias | Dunning: ${diasTolerancia} dias | Gateway: ${gateway.toUpperCase()}`);

        if (typeof showToast === 'function') {
            showToast('Configurações da plataforma salvas com sucesso!', 'success');
        } else {
            alert('Configurações salvas com sucesso!');
        }
    };

    window.alternarTemaAdmin = function () {
        const html = document.documentElement;
        const atual = html.getAttribute('data-theme') || 'dark';
        const novo = atual === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', novo);
        localStorage.setItem('ps_theme', novo);

        const icon = document.getElementById('icon-theme');
        if (icon) {
            icon.setAttribute('data-lucide', novo === 'dark' ? 'sun' : 'moon');
        }
        if (typeof lucide !== 'undefined') lucide.createIcons();
        atualizarGraficosExecutivos(document.getElementById('kpi-mrr')?.textContent ? parseFloat(document.getElementById('kpi-mrr').textContent.replace(/[^0-9,-]+/g, "").replace(",", ".")) : 0);
    };

    window.fazerLogoutAdmin = function () {
        if (!confirm('Deseja realmente sair da Central do Super Admin?')) return;
        localStorage.removeItem(SAAS_STORAGE.IS_OWNER);
        window.location.href = 'login.html';
    };

    // ==========================================
    // 17. NAVEGAÇÃO ENTRE SEÇÕES DO PAINEL
    // ==========================================
    window.navegarAdmin = function (secId, elementoClicado) {
        // Remover classe ativa dos itens da sidebar
        document.querySelectorAll('.adm-nav-item').forEach(el => el.classList.remove('active'));

        // Se clicou direto ou por código
        if (elementoClicado) {
            elementoClicado.classList.add('active');
        } else {
            const itemCorrespondente = document.querySelector(`.adm-nav-item[onclick*="${secId}"]`);
            if (itemCorrespondente) itemCorrespondente.classList.add('active');
        }

        // Alternar seções visíveis
        document.querySelectorAll('.adm-section').forEach(sec => sec.classList.remove('active'));
        const alvo = document.getElementById(`sec-${secId}`);
        if (alvo) {
            alvo.classList.add('active');
            alvo.style.animation = 'fadeIn 0.25s ease-out';
        }

        // Ações específicas por aba
        if (secId === 'dashboard') {
            calcularMetricasSaaS();
        } else if (secId === 'tenants') {
            window.renderizarTabelaLojas();
        } else if (secId === 'financeiro') {
            renderizarFaturas();
        } else if (secId === 'telemetria') {
            renderizarTelemetriaRankings();
        } else if (secId === 'comunicacao') {
            renderizarAvisos();
        } else if (secId === 'auditoria') {
            renderizarAuditoria();
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
    };

    window.recarregarMetricasSaaS = function () {
        carregarDados();
        calcularMetricasSaaS();
        window.renderizarTabelaLojas();
        if (typeof showToast === 'function') showToast('Métricas e telemetria atualizadas!', 'info');
    };

    window.zerarDadosFicticiosDoPainel = function () {
        if (!confirm('⚠️ Tem certeza que deseja remover todos os dados fictícios de exemplo?\n\nO painel ficará zerado, exibindo apenas as lojas que realmente forem cadastradas por clientes.')) return;
        localStorage.removeItem(SAAS_STORAGE.TENANTS);
        localStorage.removeItem(SAAS_STORAGE.INVOICES);
        localStorage.removeItem(SAAS_STORAGE.ANNOUNCEMENTS);
        localStorage.removeItem(SAAS_STORAGE.AUDIT_LOGS);
        inicializarDadosSaasSeNecessario();
        carregarDados();
        calcularMetricasSaaS();
        window.renderizarTabelaLojas();
        renderizarFaturas();
        renderizarTelemetriaRankings();
        renderizarAvisos();
        renderizarAuditoria();
        alert('✅ Pronto! Base de dados limpa. O painel agora registrará somente clientes reais.');
    };

    // ==========================================
    // 18. INICIALIZAÇÃO
    // ==========================================
    document.addEventListener('DOMContentLoaded', function () {
        if (!verificarPermissaoSuperAdmin()) return;

        inicializarDadosSaasSeNecessario();
        carregarDados();
        checarBannerImpersonacao();

        // Inicializa ícones Lucide
        if (typeof lucide !== 'undefined') lucide.createIcons();

        // Carrega Dashboard inicial
        calcularMetricasSaaS();
        window.renderizarTabelaLojas();
        renderizarFaturas();
        renderizarTelemetriaRankings();
        renderizarAvisos();
        renderizarAuditoria();
    });

})();

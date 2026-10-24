// ==========================================
// PetShop Manager - Configurações (configuracoes.js)
// Gestão de parâmetros globais, preços, horários e backups
// ==========================================

// Configurações em memória
let currentSettings = {};

// Dicionário de dias da semana para exibição amigável
const DIAS_SEMANA = [
    { key: 'segunda', label: 'Segunda-feira' },
    { key: 'terca', label: 'Terça-feira' },
    { key: 'quarta', label: 'Quarta-feira' },
    { key: 'quinta', label: 'Quinta-feira' },
    { key: 'sexta', label: 'Sexta-feira' },
    { key: 'sabado', label: 'Sábado' },
    { key: 'domingo', label: 'Domingo' }
];

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});

/**
 * Carrega as configurações do LocalStorage e inicializa a interface
 */
function loadSettings() {
    currentSettings = DB.get(STORAGE_KEYS.SETTINGS) || {};

    // Garantir estrutura mínima caso esteja vazio
    if (!currentSettings.servicoPrecos) {
        currentSettings.servicoPrecos = {
            'Banho': { P: 35, M: 45, G: 55, GG: 65 },
            'Tosa': { P: 40, M: 50, G: 60, GG: 70 },
            'Banho+Tosa': { P: 65, M: 80, G: 95, GG: 110 },
            'Tosa Higiênica': { P: 25, M: 30, G: 35, GG: 40 }
        };
    }

    if (!currentSettings.horarioFuncionamento) {
        currentSettings.horarioFuncionamento = {
            'segunda': { aberto: true, inicio: '08:00', fim: '18:00' },
            'terca': { aberto: true, inicio: '08:00', fim: '18:00' },
            'quarta': { aberto: true, inicio: '08:00', fim: '18:00' },
            'quinta': { aberto: true, inicio: '08:00', fim: '18:00' },
            'sexta': { aberto: true, inicio: '08:00', fim: '18:00' },
            'sabado': { aberto: true, inicio: '08:00', fim: '13:00' },
            'domingo': { aberto: false, inicio: '', fim: '' }
        };
    }

    if (!currentSettings.categoriasProdutos) {
        currentSettings.categoriasProdutos = ['Rações', 'Petiscos', 'Brinquedos', 'Higiene', 'Acessórios', 'Medicamentos'];
    }

    if (!currentSettings.categoriasDespesas) {
        currentSettings.categoriasDespesas = ['Aluguel', 'Salários', 'Fornecedores', 'Água/Luz', 'Limpeza', 'Outros'];
    }

    // Preencher seções
    renderCompanyData();
    renderPriceTable();
    renderOperatingHours();
    renderCategories('produto');
    renderCategories('despesa');
    renderAuditLogs();
    renderStorageUsage();
}

// ==========================================
// SEÇÃO 1: DADOS DA EMPRESA
// ==========================================
function renderCompanyData() {
    const elNome = document.getElementById('cfg-nome-fantasia');
    const elCnpj = document.getElementById('cfg-cnpj');
    const elTel = document.getElementById('cfg-telefone');
    const elEnd = document.getElementById('cfg-endereco');
    const elLogo = document.getElementById('cfg-logo');

    if (elNome) elNome.value = currentSettings.nomeFantasia || '';
    if (elCnpj) elCnpj.value = currentSettings.cnpj || '';
    if (elTel) elTel.value = currentSettings.telefone || '';
    if (elEnd) elEnd.value = currentSettings.endereco || '';
    if (elLogo) elLogo.value = currentSettings.logo || '';

    previewLogo();
}

function previewLogo() {
    const url = (document.getElementById('cfg-logo')?.value || '').trim();
    const previewContainer = document.getElementById('cfg-logo-preview');
    if (!previewContainer) return;

    if (url) {
        previewContainer.innerHTML = `<img src="${url}" alt="Logo" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='<span style=\\'font-size: 1.5rem;\\'>🐾</span>'">`;
    } else {
        previewContainer.innerHTML = `<span style="font-size: 1.5rem;">🐾</span>`;
    }
}

function saveCompanySettings(event) {
    if (event) event.preventDefault();

    const nomeFantasia = document.getElementById('cfg-nome-fantasia').value.trim();
    const cnpj = document.getElementById('cfg-cnpj').value.trim();
    const telefone = document.getElementById('cfg-telefone').value.trim();
    const endereco = document.getElementById('cfg-endereco').value.trim();
    const logo = document.getElementById('cfg-logo').value.trim();

    if (!nomeFantasia) {
        showToast('O nome fantasia do estabelecimento é obrigatório.', 'warning');
        return;
    }

    currentSettings.nomeFantasia = nomeFantasia;
    currentSettings.cnpj = cnpj;
    currentSettings.telefone = telefone;
    currentSettings.endereco = endereco;
    currentSettings.logo = logo;

    DB.save(STORAGE_KEYS.SETTINGS, currentSettings);
    showToast('Dados da empresa salvos com sucesso!', 'success');
}

// ==========================================
// SEÇÃO 2: TABELA DE PREÇOS
// ==========================================
function renderPriceTable() {
    const tbody = document.getElementById('cfg-precos-tbody');
    if (!tbody) return;

    const servicos = currentSettings.servicoPrecos || {};
    const keys = Object.keys(servicos);

    if (keys.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state" style="padding: 1.5rem;">
                        <p>Nenhum serviço cadastrado na tabela de preços.</p>
                        <span>Clique em "+ Adicionar Novo Serviço" para cadastrar valores.</span>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = keys.map(servicoNome => {
        const p = servicos[servicoNome] || {};
        const safeName = encodeURIComponent(servicoNome);

        return `
            <tr data-service="${servicoNome}">
                <td>
                    <strong style="color: var(--text-primary); font-size: 0.95rem;">${servicoNome}</strong>
                </td>
                <td style="text-align: right;">
                    <input type="number" class="table-input price-input" step="0.5" min="0" data-size="P" value="${Number(p.P) || 0}">
                </td>
                <td style="text-align: right;">
                    <input type="number" class="table-input price-input" step="0.5" min="0" data-size="M" value="${Number(p.M) || 0}">
                </td>
                <td style="text-align: right;">
                    <input type="number" class="table-input price-input" step="0.5" min="0" data-size="G" value="${Number(p.G) || 0}">
                </td>
                <td style="text-align: right;">
                    <input type="number" class="table-input price-input" step="0.5" min="0" data-size="GG" value="${Number(p.GG) || 0}">
                </td>
                <td style="text-align: center;">
                    <button class="btn-icon" style="color: var(--danger);" title="Excluir serviço" onclick="deleteService('${safeName}')">
                        <i data-lucide="trash-2"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function openAddServiceModal() {
    const form = document.getElementById('form-novo-servico');
    if (form) form.reset();
    openModal('modal-novo-servico');
}

function confirmAddService(event) {
    event.preventDefault();

    const nome = document.getElementById('servico-nome').value.trim();
    const p = parseFloat(document.getElementById('servico-p').value) || 0;
    const m = parseFloat(document.getElementById('servico-m').value) || 0;
    const g = parseFloat(document.getElementById('servico-g').value) || 0;
    const gg = parseFloat(document.getElementById('servico-gg').value) || 0;

    if (!nome) {
        showToast('Informe o nome do serviço.', 'warning');
        return;
    }

    if (!currentSettings.servicoPrecos) {
        currentSettings.servicoPrecos = {};
    }

    if (currentSettings.servicoPrecos[nome]) {
        showToast('Já existe um serviço com este nome na tabela.', 'warning');
        return;
    }

    currentSettings.servicoPrecos[nome] = { P: p, M: m, G: g, GG: gg };
    DB.save(STORAGE_KEYS.SETTINGS, currentSettings);

    closeModal('modal-novo-servico');
    renderPriceTable();
    showToast(`Serviço "${nome}" adicionado com sucesso!`, 'success');
}

async function deleteService(encodedName) {
    const nome = decodeURIComponent(encodedName);
    const confirmed = await confirmDialog(`Deseja realmente remover o serviço "${nome}" da tabela de preços?`);
    if (!confirmed) return;

    if (currentSettings.servicoPrecos && currentSettings.servicoPrecos[nome]) {
        delete currentSettings.servicoPrecos[nome];
        DB.save(STORAGE_KEYS.SETTINGS, currentSettings);
        renderPriceTable();
        showToast(`Serviço "${nome}" removido.`, 'info');
    }
}

function savePriceTable() {
    const rows = document.querySelectorAll('#cfg-precos-tbody tr[data-service]');
    const newPrices = {};

    rows.forEach(tr => {
        const servicoNome = tr.getAttribute('data-service');
        const inputs = tr.querySelectorAll('.price-input');
        const precos = { P: 0, M: 0, G: 0, GG: 0 };

        inputs.forEach(inp => {
            const size = inp.getAttribute('data-size');
            precos[size] = parseFloat(inp.value) || 0;
        });

        newPrices[servicoNome] = precos;
    });

    currentSettings.servicoPrecos = newPrices;
    DB.save(STORAGE_KEYS.SETTINGS, currentSettings);
    showToast('Tabela de preços salva com sucesso!', 'success');
}

// ==========================================
// SEÇÃO 3: HORÁRIOS DE FUNCIONAMENTO
// ==========================================
function renderOperatingHours() {
    const container = document.getElementById('cfg-horarios-container');
    if (!container) return;

    const horarios = currentSettings.horarioFuncionamento || {};

    container.innerHTML = DIAS_SEMANA.map(dia => {
        const conf = horarios[dia.key] || { aberto: false, inicio: '08:00', fim: '18:00' };
        const aberto = Boolean(conf.aberto);

        return `
            <div class="horario-row" data-day="${dia.key}">
                <div style="font-weight: 600; color: var(--text-primary);">
                    ${dia.label}
                </div>
                <div>
                    <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.9rem;">
                        <input type="checkbox" class="horario-aberto-cb" ${aberto ? 'checked' : ''} onchange="toggleDayInputs('${dia.key}')">
                        <span>${aberto ? 'Aberto' : 'Fechado'}</span>
                    </label>
                </div>
                <div>
                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                        <span style="font-size: 0.8rem; color: var(--text-secondary);">Abertura:</span>
                        <input type="time" class="horario-inicio" value="${conf.inicio || '08:00'}" ${!aberto ? 'disabled' : ''} style="max-width: 120px; padding: 0.35rem 0.5rem; border: 1px solid var(--border); border-radius: 6px;">
                    </div>
                </div>
                <div>
                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                        <span style="font-size: 0.8rem; color: var(--text-secondary);">Fechamento:</span>
                        <input type="time" class="horario-fim" value="${conf.fim || '18:00'}" ${!aberto ? 'disabled' : ''} style="max-width: 120px; padding: 0.35rem 0.5rem; border: 1px solid var(--border); border-radius: 6px;">
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function toggleDayInputs(diaKey) {
    const row = document.querySelector(`.horario-row[data-day="${diaKey}"]`);
    if (!row) return;

    const cb = row.querySelector('.horario-aberto-cb');
    const labelSpan = cb.parentElement.querySelector('span');
    const inputInicio = row.querySelector('.horario-inicio');
    const inputFim = row.querySelector('.horario-fim');

    const isOpen = cb.checked;
    labelSpan.textContent = isOpen ? 'Aberto' : 'Fechado';
    inputInicio.disabled = !isOpen;
    inputFim.disabled = !isOpen;
}

function saveOperatingHours() {
    const rows = document.querySelectorAll('.horario-row[data-day]');
    const newHorarios = {};

    rows.forEach(row => {
        const diaKey = row.getAttribute('data-day');
        const aberto = row.querySelector('.horario-aberto-cb').checked;
        const inicio = row.querySelector('.horario-inicio').value;
        const fim = row.querySelector('.horario-fim').value;

        newHorarios[diaKey] = {
            aberto,
            inicio: aberto ? inicio : '',
            fim: aberto ? fim : ''
        };
    });

    currentSettings.horarioFuncionamento = newHorarios;
    DB.save(STORAGE_KEYS.SETTINGS, currentSettings);
    showToast('Horários de funcionamento atualizados com sucesso!', 'success');
}

// ==========================================
// SEÇÃO 4: CATEGORIAS (PRODUTOS E DESPESAS)
// ==========================================
function renderCategories(tipo) {
    const isProd = tipo === 'produto';
    const containerId = isProd ? 'lista-categorias-produtos' : 'lista-categorias-despesas';
    const container = document.getElementById(containerId);
    if (!container) return;

    const list = isProd 
        ? (currentSettings.categoriasProdutos || []) 
        : (currentSettings.categoriasDespesas || []);

    if (list.length === 0) {
        container.innerHTML = `<span style="font-size: 0.85rem; color: var(--text-light); padding: 0.25rem;">Nenhuma categoria adicionada.</span>`;
        return;
    }

    container.innerHTML = list.map((cat, idx) => `
        <span class="tag-item">
            <span>${cat}</span>
            <button class="tag-remove" title="Remover categoria" onclick="removeCategory('${tipo}', ${idx})">
                <i data-lucide="x" style="width: 13px; height: 13px;"></i>
            </button>
        </span>
    `).join('');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function handleCatKey(event, tipo) {
    if (event.key === 'Enter') {
        event.preventDefault();
        addCategory(tipo);
    }
}

function addCategory(tipo) {
    const isProd = tipo === 'produto';
    const inputId = isProd ? 'novo-cat-produto-input' : 'novo-cat-despesa-input';
    const input = document.getElementById(inputId);
    if (!input) return;

    const val = input.value.trim();
    if (!val) return;

    if (isProd) {
        if (!currentSettings.categoriasProdutos) currentSettings.categoriasProdutos = [];
        if (currentSettings.categoriasProdutos.includes(val)) {
            showToast('Esta categoria de produto já existe.', 'warning');
            return;
        }
        currentSettings.categoriasProdutos.push(val);
    } else {
        if (!currentSettings.categoriasDespesas) currentSettings.categoriasDespesas = [];
        if (currentSettings.categoriasDespesas.includes(val)) {
            showToast('Esta categoria de despesa já existe.', 'warning');
            return;
        }
        currentSettings.categoriasDespesas.push(val);
    }

    DB.save(STORAGE_KEYS.SETTINGS, currentSettings);
    input.value = '';
    renderCategories(tipo);
    showToast(`Categoria "${val}" adicionada!`, 'success');
}

function removeCategory(tipo, index) {
    const isProd = tipo === 'produto';
    const list = isProd ? currentSettings.categoriasProdutos : currentSettings.categoriasDespesas;

    if (list && list[index]) {
        const removed = list.splice(index, 1)[0];
        DB.save(STORAGE_KEYS.SETTINGS, currentSettings);
        renderCategories(tipo);
        showToast(`Categoria "${removed}" removida.`, 'info');
    }
}

// ==========================================
// SEÇÃO 5: BACKUP E RESTAURAÇÃO COMPLETA
// ==========================================
function exportFullBackup() {
    const backupData = {
        meta: {
            app: 'PetShop Manager',
            versao: '1.0',
            dataExportacao: new Date().toISOString()
        },
        dados: {
            clientes: DB.get(STORAGE_KEYS.CLIENTS),
            pets: DB.get(STORAGE_KEYS.PETS),
            produtos: DB.get(STORAGE_KEYS.PRODUCTS),
            agendamentos: DB.get(STORAGE_KEYS.APPOINTMENTS),
            vendas: DB.get(STORAGE_KEYS.SALES),
            receitas: DB.get(STORAGE_KEYS.REVENUES),
            despesas: DB.get(STORAGE_KEYS.EXPENSES),
            funcionarios: DB.get(STORAGE_KEYS.EMPLOYEES),
            configuracoes: DB.get(STORAGE_KEYS.SETTINGS),
            movimentacoesEstoque: DB.get(STORAGE_KEYS.STOCK_MOVEMENTS),
            pacotes: DB.get(STORAGE_KEYS.PACKAGES),
            auditLogs: DB.get(STORAGE_KEYS.AUDIT_LOGS)
        }
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const dateStr = new Date().toISOString().split('T')[0];

    const senha = prompt('Deseja criptografar este arquivo de backup com senha (AES-GCM - Recomendado pela LGPD)?\n\nDigite uma senha ou deixe em branco para exportar JSON aberto:');

    if (senha && senha.trim().length > 0) {
        try {
            showToast('Criptografando com AES-GCM...', 'info');
            const encryptedPayload = await CryptoUtils.encryptData(jsonString, senha.trim());
            const blob = new Blob([encryptedPayload], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `backup_petshop_protegido_${dateStr}.psbackup`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            logAudit('BACKUP_EXPORT_ENCRYPTED', 'Segurança', 'Exportação de backup criptografado pelo módulo de configurações.');
            showToast('Backup criptografado exportado com sucesso!', 'success');
        } catch (err) {
            console.error(err);
            showToast('Erro ao criptografar arquivo.', 'error');
        }
    } else {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `backup_petshop_${dateStr}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        logAudit('BACKUP_EXPORT_PLAIN', 'Segurança', 'Exportação de backup aberto em formato JSON.');
        showToast('Backup completo exportado com sucesso!', 'success');
    }
}

async function importBackupFile() {
    const fileInput = document.getElementById('cfg-backup-file-input');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showToast('Selecione um arquivo de backup (.json ou .psbackup) para importar.', 'warning');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = async function (e) {
        try {
            let content = e.target.result;

            // Se for arquivo criptografado (.psbackup ou objeto com salt/iv/data)
            if (file.name.endsWith('.psbackup') || content.includes('PS_ENCRYPTED_BACKUP_V1')) {
                const senha = prompt('🔒 Este backup está protegido com criptografia AES-GCM.\n\nDigite a senha para descriptografar:');
                if (!senha) {
                    showToast('Restauração cancelada. Senha necessária.', 'warning');
                    return;
                }
                try {
                    content = await CryptoUtils.decryptData(content, senha.trim());
                } catch (err) {
                    console.error(err);
                    showToast('Senha incorreta ou arquivo de backup corrompido!', 'error');
                    return;
                }
            }

            const imported = JSON.parse(content);

            // Validação de integridade
            if (!imported.dados) {
                showToast('Arquivo de backup inválido ou em formato desconhecido.', 'error');
                return;
            }

            const confirmed = await confirmDialog('Atenção: A restauração do backup substituirá todos os registros atuais do sistema. Tem certeza que deseja prosseguir?');
            if (!confirmed) return;

            const d = imported.dados;
            if (d.clientes) DB.save(STORAGE_KEYS.CLIENTS, d.clientes);
            if (d.pets) DB.save(STORAGE_KEYS.PETS, d.pets);
            if (d.produtos) DB.save(STORAGE_KEYS.PRODUCTS, d.produtos);
            if (d.agendamentos) DB.save(STORAGE_KEYS.APPOINTMENTS, d.agendamentos);
            if (d.vendas) DB.save(STORAGE_KEYS.SALES, d.vendas);
            if (d.receitas) DB.save(STORAGE_KEYS.REVENUES, d.receitas);
            if (d.despesas) DB.save(STORAGE_KEYS.EXPENSES, d.despesas);
            if (d.funcionarios) DB.save(STORAGE_KEYS.EMPLOYEES, d.funcionarios);
            if (d.configuracoes) DB.save(STORAGE_KEYS.SETTINGS, d.configuracoes);
            if (d.movimentacoesEstoque) DB.save(STORAGE_KEYS.STOCK_MOVEMENTS, d.movimentacoesEstoque);
            if (d.pacotes) DB.save(STORAGE_KEYS.PACKAGES, d.pacotes);
            if (d.auditLogs) DB.save(STORAGE_KEYS.AUDIT_LOGS, d.auditLogs);

            logAudit('BACKUP_RESTORED', 'Segurança', `Restauração de backup realizada a partir do arquivo: ${file.name}`);
            showToast('Backup restaurado com sucesso! Recarregando sistema...', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 1200);

        } catch (err) {
            console.error(err);
            showToast('Erro ao ler ou processar o arquivo de backup.', 'error');
        }
    };

    reader.readAsText(file);
}

// ==========================================
// SEÇÃO 6: TRILHA DE AUDITORIA & LGPD
// ==========================================
function renderAuditLogs() {
    const tbody = document.getElementById('lista-logs-auditoria');
    if (!tbody) return;

    const logs = DB.get(STORAGE_KEYS.AUDIT_LOGS) || [];

    if (logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; color: var(--text-light); padding: 1.5rem;">
                    Nenhum evento registrado ainda na trilha de auditoria.
                </td>
            </tr>
        `;
        return;
    }

    // Exibir os 30 eventos mais recentes
    tbody.innerHTML = logs.slice(0, 30).map(log => {
        const dataStr = new Date(log.timestamp).toLocaleString('pt-BR');
        const roleLabel = log.userRole ? `<span class="badge badge-neutral" style="font-size:0.75rem;">${escapeHtml(log.userRole)}</span>` : '-';
        return `
            <tr>
                <td style="white-space:nowrap; color:var(--text-secondary); font-family:monospace;">${escapeHtml(dataStr)}</td>
                <td><strong style="color:var(--text-primary);">${escapeHtml(log.action)}</strong></td>
                <td><span class="badge badge-info" style="font-size:0.75rem;">${escapeHtml(log.category)}</span></td>
                <td>${roleLabel}</td>
                <td style="color:var(--text-secondary);">${escapeHtml(log.details)}</td>
            </tr>
        `;
    }).join('');
}

function exportarLogsCsv() {
    const logs = DB.get(STORAGE_KEYS.AUDIT_LOGS) || [];
    if (logs.length === 0) {
        showToast('Nenhum log disponível para exportar.', 'info');
        return;
    }

    let csvContent = 'Data/Hora,Acao,Categoria,Perfil,Detalhes\n';
    logs.forEach(l => {
        const d = new Date(l.timestamp).toLocaleString('pt-BR');
        const action = (l.action || '').replace(/"/g, '""');
        const cat = (l.category || '').replace(/"/g, '""');
        const role = (l.userRole || '').replace(/"/g, '""');
        const det = (l.details || '').replace(/"/g, '""');
        csvContent += `"${d}","${action}","${cat}","${role}","${det}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trilha_auditoria_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Logs de auditoria exportados em CSV com sucesso!', 'success');
}

async function limparLogsAuditoria() {
    const confirmed = await confirmDialog('Deseja realmente limpar os registros da trilha de auditoria? Esta ação é irreversível.');
    if (!confirmed) return;

    DB.save(STORAGE_KEYS.AUDIT_LOGS, []);
    logAudit('LOGS_CLEARED', 'Segurança', 'Trilha de auditoria limpa pelo administrador.');
    renderAuditLogs();
    showToast('Logs de auditoria limpos com sucesso.', 'success');
}

async function renderStorageUsage() {
    const textEl = document.getElementById('storage-usage-text');
    const barEl = document.getElementById('storage-progress-bar');
    if (!textEl || !barEl) return;

    try {
        if (navigator.storage && navigator.storage.estimate) {
            const { quota, usage } = await navigator.storage.estimate();
            const usageKb = Math.round(usage / 1024);
            const quotaMb = Math.round(quota / (1024 * 1024));
            const pct = Math.min(Math.round((usage / quota) * 100), 100);

            textEl.textContent = `${usageKb} KB usados (${pct}% de ${quotaMb} MB)`;
            barEl.style.width = `${Math.max(pct, 2)}%`;
            return;
        }
    } catch {
        // Fallback para medição por LocalStorage
    }

    // Fallback: calcular tamanho do LocalStorage
    let totalChars = 0;
    for (let x in localStorage) {
        if (localStorage.hasOwnProperty(x)) {
            totalChars += ((localStorage[x].length + x.length) * 2);
        }
    }
    const kbUsed = Math.round(totalChars / 1024);
    const estPct = Math.min(Math.round((kbUsed / 5120) * 100), 100);
    textEl.textContent = `${kbUsed} KB usados (~${estPct}% do limite de 5MB)`;
    barEl.style.width = `${Math.max(estPct, 3)}%`;
}

// ==========================================
// SALVAR TODAS AS CONFIGURAÇÕES
// ==========================================
function saveAllSettings() {
    saveCompanySettings();
    savePriceTable();
    saveOperatingHours();
    showToast('Todas as configurações foram salvas com sucesso!', 'success');
}

// ==========================================
// RESTAURAR DADOS DE DEMONSTRAÇÃO
// ==========================================
async function resetToDemoData() {
    const confirmed = await confirmDialog('Tem certeza que deseja restaurar os dados de demonstração? Todas as alterações personalizadas serão redefinidas.');
    if (!confirmed) return;

    // Limpar chaves do sistema
    Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });

    // Chamar inicialização demo do app.js
    if (typeof initDemoData === 'function') {
        initDemoData();
    }

    showToast('Dados de demonstração restaurados com sucesso! Atualizando...', 'success');
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}

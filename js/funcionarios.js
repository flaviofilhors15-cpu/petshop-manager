// ==========================================
// PetShop Manager - Funcionários (funcionarios.js)
// Gestão de equipe, cálculo de comissões e histórico
// ==========================================

// Estado da página
let funcCurrentPage = 1;
const funcPerPage = 10;
let currentProfileEmployeeId = null;

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // Carregar e renderizar tabela e KPIs
    renderEmployees();

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});

// ==========================================
// CÁLCULO DE COMISSÃO
// ==========================================
/**
 * Calcula a comissão de um único agendamento concluído
 */
function calculateAppointmentCommission(appointment, employee) {
    if (!employee || !appointment) return 0;
    const valor = Number(appointment.valor) || 0;
    const taxa = Number(employee.comissaoValor) || 0;

    if (employee.comissaoTipo === 'percentual') {
        return (valor * taxa) / 100;
    } else if (employee.comissaoTipo === 'fixo') {
        return taxa;
    }
    return 0;
}

/**
 * Retorna os agendamentos concluídos de um funcionário dentro do período selecionado
 */
function getEmployeeCompletedAppointments(employeeId, periodFilter = 'mes_atual') {
    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const today = new Date();

    let startDate = null;
    let endDate = null;

    if (periodFilter === 'mes_atual') {
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    } else if (periodFilter === 'mes_anterior') {
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59);
    } // 'todos' leaves startDate and endDate as null

    return appointments.filter(apt => {
        if (apt.funcionarioId !== employeeId) return false;
        if (apt.status !== 'concluido') return false;
        if (!apt.data) return false;

        if (startDate || endDate) {
            const aptDate = new Date(apt.data + 'T00:00:00');
            if (startDate && aptDate < startDate) return false;
            if (endDate && aptDate > endDate) return false;
        }

        return true;
    });
}

// ==========================================
// RENDERIZAÇÃO E FILTROS
// ==========================================
function onFilterEmployees() {
    funcCurrentPage = 1;
    renderEmployees();
}

function clearEmployeeFilters() {
    const elSearch = document.getElementById('func-search');
    const elCargo = document.getElementById('func-filtro-cargo');
    const elMes = document.getElementById('func-filtro-mes');

    if (elSearch) elSearch.value = '';
    if (elCargo) elCargo.value = '';
    if (elMes) elMes.value = 'mes_atual';

    funcCurrentPage = 1;
    renderEmployees();
}

function changeFuncPage(page) {
    funcCurrentPage = page;
    renderEmployees();
}

function renderEmployees() {
    const tbody = document.getElementById('func-table-body');
    if (!tbody) return;

    const employees = DB.get(STORAGE_KEYS.EMPLOYEES) || [];
    const search = (document.getElementById('func-search')?.value || '').toLowerCase().trim();
    const cargoFiltro = document.getElementById('func-filtro-cargo')?.value || '';
    const mesFiltro = document.getElementById('func-filtro-mes')?.value || 'mes_atual';

    // 1. Filtragem da lista
    let filtered = employees.filter(emp => {
        if (search) {
            const matchNome = (emp.nome || '').toLowerCase().includes(search);
            const matchEmail = (emp.email || '').toLowerCase().includes(search);
            const matchTel = (emp.telefone || '').toLowerCase().includes(search);
            if (!matchNome && !matchEmail && !matchTel) return false;
        }
        if (cargoFiltro && emp.cargo !== cargoFiltro) return false;
        return true;
    });

    // 2. Atualizar KPIs do Topo
    updateKPIs(employees, mesFiltro);

    // 3. Atualizar contador de registros
    const countBadge = document.getElementById('func-total-count');
    if (countBadge) countBadge.textContent = `${filtered.length} funcionário(s)`;

    // 4. Paginação
    const paginated = paginate(filtered, funcCurrentPage, funcPerPage);
    funcCurrentPage = paginated.currentPage;

    if (paginated.data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state">
                        <i data-lucide="users"></i>
                        <p>Nenhum funcionário encontrado</p>
                        <span>Tente ajustar seus filtros ou cadastre um novo membro da equipe.</span>
                    </div>
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = paginated.data.map(emp => {
            const appointments = getEmployeeCompletedAppointments(emp.id, mesFiltro);
            const servicosCount = appointments.length;

            const totalComissao = appointments.reduce((sum, apt) => {
                return sum + calculateAppointmentCommission(apt, emp);
            }, 0);

            // Regra descritiva
            const regraTexto = emp.comissaoTipo === 'percentual' 
                ? `${emp.comissaoValor || 0}% por serviço` 
                : `${formatCurrency(emp.comissaoValor || 0)} fixo/serviço`;

            // Badge de cargo
            const cargoClasses = {
                'Tosador': 'badge-primary',
                'Banhista': 'badge-info',
                'Atendente': 'badge-warning',
                'Gerente': 'badge-success'
            };
            const badgeClass = cargoClasses[emp.cargo] || 'badge-neutral';

            // Iniciais do nome para avatar
            const initials = (emp.nome || 'F')
                .split(' ')
                .map(n => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

            return `
                <tr>
                    <td>
                        <div class="employee-cell">
                            <div class="employee-avatar">${initials}</div>
                            <div>
                                <div style="font-weight: 600; color: var(--text-primary);">${emp.nome || 'Sem Nome'}</div>
                                <div style="font-size: 0.75rem; color: var(--text-light);">${emp.email || 'Sem e-mail'}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="badge ${badgeClass}">${emp.cargo || 'Funcionário'}</span>
                    </td>
                    <td style="color: var(--text-secondary); font-size: 0.9rem;">
                        ${formatPhone(emp.telefone) || '-'}
                    </td>
                    <td style="text-align: center;">
                        <span class="badge ${servicosCount > 0 ? 'badge-success' : 'badge-neutral'}" style="font-size: 0.85rem; padding: 0.25rem 0.65rem;">
                            ${servicosCount} serviço${servicosCount !== 1 ? 's' : ''}
                        </span>
                    </td>
                    <td style="text-align: right;">
                        <div style="font-weight: 700; color: var(--success); font-size: 0.95rem;">
                            ${formatCurrency(totalComissao)}
                        </div>
                        <div style="font-size: 0.72rem; color: var(--text-light);">
                            ${regraTexto}
                        </div>
                    </td>
                    <td>
                        <div class="table-actions" style="justify-content: center;">
                            <button class="btn-icon" title="Ver Perfil e Histórico" onclick="openEmployeeProfile('${emp.id}')">
                                <i data-lucide="eye"></i>
                            </button>
                            <button class="btn-icon" title="Editar Funcionário" onclick="openEmployeeModal('${emp.id}')">
                                <i data-lucide="edit-2"></i>
                            </button>
                            <button class="btn-icon" style="color: var(--danger);" title="Excluir Funcionário" onclick="deleteEmployee('${emp.id}')">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // Informação de paginação e renderização dos botões
    const infoEl = document.getElementById('func-pagination-info');
    if (infoEl) {
        const startItem = filtered.length === 0 ? 0 : (paginated.currentPage - 1) * funcPerPage + 1;
        const endItem = Math.min(filtered.length, paginated.currentPage * funcPerPage);
        infoEl.textContent = `Mostrando ${startItem}-${endItem} de ${filtered.length} funcionários`;
    }

    renderPagination('funcionarios-pagination', paginated.currentPage, paginated.totalPages, 'changeFuncPage');

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function updateKPIs(employees, mesFiltro) {
    const elTotal = document.getElementById('kpi-total-funcionarios');
    const elOperacionais = document.getElementById('kpi-operacionais');
    const elServicos = document.getElementById('kpi-servicos-mes');
    const elComissoes = document.getElementById('kpi-comissoes-mes');

    if (elTotal) elTotal.textContent = employees.length;

    const operacionais = employees.filter(e => e.cargo === 'Tosador' || e.cargo === 'Banhista').length;
    if (elOperacionais) elOperacionais.textContent = operacionais;

    let totalServicosGeral = 0;
    let totalComissoesGeral = 0;

    employees.forEach(emp => {
        const apts = getEmployeeCompletedAppointments(emp.id, mesFiltro);
        totalServicosGeral += apts.length;
        apts.forEach(apt => {
            totalComissoesGeral += calculateAppointmentCommission(apt, emp);
        });
    });

    if (elServicos) elServicos.textContent = totalServicosGeral;
    if (elComissoes) elComissoes.textContent = formatCurrency(totalComissoesGeral);
}

// ==========================================
// MODAL DE CADASTRO E EDIÇÃO
// ==========================================
function updateCommissionLabel() {
    const tipo = document.getElementById('func-comissao-tipo').value;
    const label = document.getElementById('label-comissao-valor');
    const input = document.getElementById('func-comissao-valor');

    if (tipo === 'percentual') {
        if (label) label.textContent = 'Taxa de Comissão (%)';
        if (input) input.placeholder = 'Ex: 15';
    } else {
        if (label) label.textContent = 'Valor Fixo por Serviço (R$)';
        if (input) input.placeholder = 'Ex: 20,00';
    }
}

function openEmployeeModal(employeeId = null) {
    const form = document.getElementById('form-funcionario');
    if (!form) return;

    form.reset();
    document.getElementById('func-id').value = '';

    const titleEl = document.getElementById('modal-func-titulo');
    const saveBtn = document.getElementById('btn-salvar-func');

    if (employeeId) {
        const employees = DB.get(STORAGE_KEYS.EMPLOYEES) || [];
        const emp = employees.find(e => e.id === employeeId);
        if (emp) {
            document.getElementById('func-id').value = emp.id;
            document.getElementById('func-nome').value = emp.nome || '';
            document.getElementById('func-cargo').value = emp.cargo || 'Tosador';
            document.getElementById('func-telefone').value = emp.telefone || '';
            document.getElementById('func-email').value = emp.email || '';
            document.getElementById('func-comissao-tipo').value = emp.comissaoTipo || 'percentual';
            document.getElementById('func-comissao-valor').value = emp.comissaoValor || 0;

            if (titleEl) titleEl.textContent = 'Editar Funcionário';
            if (saveBtn) saveBtn.textContent = 'Salvar Alterações';
        }
    } else {
        if (titleEl) titleEl.textContent = 'Novo Funcionário';
        if (saveBtn) saveBtn.textContent = 'Salvar Funcionário';
        document.getElementById('func-comissao-tipo').value = 'percentual';
        document.getElementById('func-comissao-valor').value = '15';
    }

    updateCommissionLabel();
    openModal('modal-funcionario');
}

function saveEmployee(event) {
    event.preventDefault();

    const id = document.getElementById('func-id').value;
    const nome = document.getElementById('func-nome').value.trim();
    const cargo = document.getElementById('func-cargo').value;
    const telefone = document.getElementById('func-telefone').value.trim();
    const email = document.getElementById('func-email').value.trim();
    const comissaoTipo = document.getElementById('func-comissao-tipo').value;
    const comissaoValor = parseFloat(document.getElementById('func-comissao-valor').value);

    if (!nome || isNaN(comissaoValor) || comissaoValor < 0) {
        showToast('Preencha os campos obrigatórios corretamente.', 'warning');
        return;
    }

    let employees = DB.get(STORAGE_KEYS.EMPLOYEES) || [];

    if (id) {
        // Atualizar existente
        const index = employees.findIndex(e => e.id === id);
        if (index !== -1) {
            employees[index] = {
                ...employees[index],
                nome,
                cargo,
                telefone,
                email,
                comissaoTipo,
                comissaoValor
            };
            showToast('Funcionário atualizado com sucesso!', 'success');
        }
    } else {
        // Novo funcionário
        const newEmployee = {
            id: DB.generateId(),
            nome,
            cargo,
            telefone,
            email,
            comissaoTipo,
            comissaoValor
        };
        employees.push(newEmployee);
        showToast('Funcionário cadastrado com sucesso!', 'success');
    }

    DB.save(STORAGE_KEYS.EMPLOYEES, employees);
    closeModal('modal-funcionario');
    renderEmployees();
}

async function deleteEmployee(employeeId) {
    const confirmed = await confirmDialog('Deseja realmente excluir este funcionário? Todos os dados associados a ele serão mantidos no histórico.');
    if (!confirmed) return;

    let employees = DB.get(STORAGE_KEYS.EMPLOYEES) || [];
    employees = employees.filter(e => e.id !== employeeId);
    DB.save(STORAGE_KEYS.EMPLOYEES, employees);

    showToast('Funcionário excluído com sucesso.', 'info');
    renderEmployees();
}

// ==========================================
// MODAL DE PERFIL E HISTÓRICO DE SERVIÇOS
// ==========================================
function openEmployeeProfile(employeeId) {
    currentProfileEmployeeId = employeeId;
    const employees = DB.get(STORAGE_KEYS.EMPLOYEES) || [];
    const emp = employees.find(e => e.id === employeeId);
    if (!emp) return;

    const modalContent = document.getElementById('perfil-modal-content');
    if (!modalContent) return;

    // Buscar agendamentos concluídos
    const appointments = getEmployeeCompletedAppointments(employeeId, 'todos');
    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const pets = DB.get(STORAGE_KEYS.PETS) || [];

    // Totais acumulados
    const totalServicos = appointments.length;
    const totalFaturado = appointments.reduce((sum, apt) => sum + (Number(apt.valor) || 0), 0);
    const totalComissao = appointments.reduce((sum, apt) => sum + calculateAppointmentCommission(apt, emp), 0);

    // Iniciais
    const initials = (emp.nome || 'F')
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    const regraTexto = emp.comissaoTipo === 'percentual' 
        ? `${emp.comissaoValor}% sobre o valor bruto do serviço`
        : `${formatCurrency(emp.comissaoValor)} fixo por atendimento realizado`;

    modalContent.innerHTML = `
        <!-- Cabeçalho do Perfil -->
        <div class="profile-card">
            <div class="profile-avatar-large">${initials}</div>
            <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                    <h3 style="font-size: 1.3rem; color: var(--text-primary); margin: 0;">${emp.nome}</h3>
                    <span class="badge badge-info">${emp.cargo}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.35rem; display: flex; gap: 1.5rem; flex-wrap: wrap;">
                    <span><i data-lucide="phone" style="width: 14px; height: 14px; vertical-align: middle;"></i> ${formatPhone(emp.telefone) || 'Sem telefone'}</span>
                    <span><i data-lucide="mail" style="width: 14px; height: 14px; vertical-align: middle;"></i> ${emp.email || 'Sem e-mail'}</span>
                </div>
                <div style="font-size: 0.85rem; color: var(--text-primary); margin-top: 0.5rem; background: var(--bg-card); padding: 0.35rem 0.75rem; border-radius: 6px; display: inline-block;">
                    <strong>Regra de Comissão:</strong> ${regraTexto}
                </div>
            </div>
        </div>

        <!-- 3 Cards de Resumo -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
            <div class="stat-card" style="padding: 1rem;">
                <div class="stat-info">
                    <div class="stat-value" style="font-size: 1.4rem;">${totalServicos}</div>
                    <div class="stat-label">Serviços Concluídos</div>
                </div>
            </div>
            <div class="stat-card success" style="padding: 1rem;">
                <div class="stat-info">
                    <div class="stat-value text-success" style="font-size: 1.4rem;">${formatCurrency(totalFaturado)}</div>
                    <div class="stat-label">Faturamento Gerado</div>
                </div>
            </div>
            <div class="stat-card accent" style="padding: 1rem;">
                <div class="stat-info">
                    <div class="stat-value" style="font-size: 1.4rem; color: var(--accent);">${formatCurrency(totalComissao)}</div>
                    <div class="stat-label">Comissão Total a Pagar</div>
                </div>
            </div>
        </div>

        <!-- Tabela de Histórico de Serviços -->
        <div class="table-container">
            <div class="table-header">
                <h4 style="font-size: 0.95rem; color: var(--text-primary); margin: 0;">Histórico Detalhado de Atendimentos</h4>
                <span class="badge badge-neutral">${appointments.length} serviços registrados</span>
            </div>

            <div style="max-height: 280px; overflow-y: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Data</th>
                            <th>Pet / Cliente</th>
                            <th>Serviço Realizado</th>
                            <th style="text-align: right;">Valor Serviço</th>
                            <th style="text-align: right;">Comissão</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${appointments.length === 0 ? `
                            <tr>
                                <td colspan="5">
                                    <div class="empty-state" style="padding: 1.5rem;">
                                        <p style="font-size: 0.95rem;">Nenhum serviço concluído registrado para este profissional.</p>
                                    </div>
                                </td>
                            </tr>
                        ` : appointments.map(apt => {
                            const pet = pets.find(p => p.id === apt.petId);
                            const petNome = pet ? pet.nome : 'Pet';
                            const client = clients.find(c => c.id === apt.clienteId);
                            const clientNome = client ? client.nome : 'Cliente';
                            const comissaoItem = calculateAppointmentCommission(apt, emp);

                            return `
                                <tr>
                                    <td>
                                        <strong>${formatDate(apt.data)}</strong>
                                        <div style="font-size: 0.75rem; color: var(--text-light);">${apt.horario || ''}</div>
                                    </td>
                                    <td>
                                        <div style="font-weight: 500;">🐾 ${petNome}</div>
                                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${clientNome}</div>
                                    </td>
                                    <td>
                                        <span class="badge badge-info">${apt.servico || 'Serviço'}</span>
                                    </td>
                                    <td style="text-align: right; font-weight: 600;">
                                        ${formatCurrency(apt.valor)}
                                    </td>
                                    <td style="text-align: right; font-weight: 700; color: var(--success);">
                                        + ${formatCurrency(comissaoItem)}
                                    </td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    openModal('modal-perfil-funcionario');
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function printEmployeeStatement() {
    if (!currentProfileEmployeeId) return;
    const employees = DB.get(STORAGE_KEYS.EMPLOYEES) || [];
    const emp = employees.find(e => e.id === currentProfileEmployeeId);
    if (!emp) return;

    window.print();
}

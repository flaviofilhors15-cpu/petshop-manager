// ==========================================
// PetShop Manager - Lógica da Agenda (agenda.js)
// Gerenciamento completo de calendário, agendamentos,
// cálculos automáticos, regras de status e receitas.
// ==========================================

// Estado global da página de Agenda
const AgendaState = {
    currentDate: new Date(),
    currentView: 'mensal', // 'mensal' | 'semanal' | 'diario'
    filters: {
        search: '',
        employeeId: '',
        status: ''
    },
    activeAppointmentId: null
};

// === Constantes e Configurações de Apoio ===
const DIAS_SEMANA_NOMES = [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
    'Quinta-feira', 'Sexta-feira', 'Sábado'
];

const DIAS_SEMANA_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const MESES_NOMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Preços padrão para serviços e portes (caso as configurações não estejam presentes)
const PRECOS_SERVICOS_PADRAO = {
    'Banho': { P: 35, M: 45, G: 55, GG: 65 },
    'Tosa': { P: 40, M: 50, G: 60, GG: 70 },
    'Banho+Tosa': { P: 65, M: 80, G: 95, GG: 110 },
    'Tosa Higiênica': { P: 25, M: 30, G: 35, GG: 40 }
};

// === Funções Auxiliares de Datas ===

/**
 * Converte um objeto Date para o formato ISO YYYY-MM-DD em horário local.
 * Evita desvios provocados por fuso horário.
 */
function formatDateToISO(date) {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Retorna a data ISO do dia atual.
 */
function currentISODate() {
    return formatDateToISO(new Date());
}

/**
 * Converte string YYYY-MM-DD para objeto Date em horário local (à meia-noite).
 */
function parseISODate(isoStr) {
    if (!isoStr) return new Date();
    const [year, month, day] = isoStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}

/**
 * Retorna true se duas datas representam o mesmo dia civil.
 */
function isSameDay(date1, date2) {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
}

/**
 * Retorna o primeiro dia (domingo) da semana de uma data de referência.
 */
function getStartOfWeek(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
}

// === Inicialização da Página ===
document.addEventListener('DOMContentLoaded', () => {
    initAgenda();
});

function initAgenda() {
    // Carregar opções dos filtros
    populateFilterEmployees();

    // Configurar eventos de navegação e filtros
    setupEventListeners();

    // Renderizar o calendário e as estatísticas iniciais
    renderCalendar();
}

/**
 * Configura listeners de eventos da interface.
 */
function setupEventListeners() {
    // Botões de navegação temporal
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnToday = document.getElementById('btn-today');

    if (btnPrev) btnPrev.addEventListener('click', () => navigateCalendar(-1));
    if (btnNext) btnNext.addEventListener('click', () => navigateCalendar(1));
    if (btnToday) btnToday.addEventListener('click', () => goToToday());

    // Abas de visualização (Mensal, Semanal, Diário)
    document.querySelectorAll('.calendar-views .tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.getAttribute('data-view');
            switchCalendarView(view);
        });
    });

    // Filtros de busca, profissional e status
    const searchInput = document.getElementById('agenda-search-input');
    const filterEmployee = document.getElementById('agenda-filter-employee');
    const filterStatus = document.getElementById('agenda-filter-status');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            AgendaState.filters.search = e.target.value.trim().toLowerCase();
            renderActiveView();
        });
    }

    if (filterEmployee) {
        filterEmployee.addEventListener('change', (e) => {
            AgendaState.filters.employeeId = e.target.value;
            renderActiveView();
        });
    }

    if (filterStatus) {
        filterStatus.addEventListener('change', (e) => {
            AgendaState.filters.status = e.target.value;
            renderActiveView();
        });
    }
}

/**
 * Preenche o select de profissionais no filtro da barra superior.
 */
function populateFilterEmployees() {
    const select = document.getElementById('agenda-filter-employee');
    if (!select) return;

    const employees = DB.get(STORAGE_KEYS.EMPLOYEES) || [];
    select.innerHTML = '<option value="">Todos os profissionais</option>';

    employees.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = `${emp.nome} (${emp.cargo})`;
        select.appendChild(option);
    });
}

// === Navegação e Troca de Visualização ===

/**
 * Altera a data de referência dependendo da visualização atual.
 */
function navigateCalendar(direction) {
    const current = AgendaState.currentDate;

    if (AgendaState.currentView === 'mensal') {
        current.setMonth(current.getMonth() + direction);
    } else if (AgendaState.currentView === 'semanal') {
        current.setDate(current.getDate() + (direction * 7));
    } else if (AgendaState.currentView === 'diario') {
        current.setDate(current.getDate() + direction);
    }

    renderCalendar();
}

/**
 * Redefine o foco para a data de hoje.
 */
function goToToday() {
    AgendaState.currentDate = new Date();
    renderCalendar();
}

/**
 * Alterna entre as abas Mensal, Semanal e Diário.
 */
function switchCalendarView(viewName) {
    if (!['mensal', 'semanal', 'diario', 'kanban'].includes(viewName)) return;

    AgendaState.currentView = viewName;

    // Atualizar classes dos botões de abas
    document.querySelectorAll('.calendar-views .tab-btn').forEach(btn => {
        if (btn.getAttribute('data-view') === viewName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Alternar visibilidade dos contêineres
    document.getElementById('calendar-view-mensal').style.display = viewName === 'mensal' ? 'block' : 'none';
    document.getElementById('calendar-view-semanal').style.display = viewName === 'semanal' ? 'block' : 'none';
    document.getElementById('calendar-view-diario').style.display = viewName === 'diario' ? 'block' : 'none';
    const kanbanPane = document.getElementById('calendar-view-kanban');
    if (kanbanPane) kanbanPane.style.display = viewName === 'kanban' ? 'block' : 'none';

    renderCalendar();
}

// === Renderização Principal ===

/**
 * Renderiza o calendário completo: título, estatísticas do dia e a visão ativa.
 */
function renderCalendar() {
    updateCalendarTitle();
    updateStatsCards();
    renderActiveView();
}

/**
 * Atualiza o título do calendário conforme o modo e a data de referência.
 */
function updateCalendarTitle() {
    const titleEl = document.getElementById('calendar-title');
    if (!titleEl) return;

    const current = AgendaState.currentDate;
    const mes = MESES_NOMES[current.getMonth()];
    const ano = current.getFullYear();

    if (AgendaState.currentView === 'kanban') {
        titleEl.textContent = `Fila Operacional (${String(current.getDate()).padStart(2, '0')}/${String(current.getMonth()+1).padStart(2, '0')})`;
    } else if (AgendaState.currentView === 'mensal') {
        titleEl.textContent = `${mes} de ${ano}`;
    } else if (AgendaState.currentView === 'semanal') {
        const startOfWeek = getStartOfWeek(current);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);

        const diaInicio = String(startOfWeek.getDate()).padStart(2, '0');
        const diaFim = String(endOfWeek.getDate()).padStart(2, '0');

        if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
            titleEl.textContent = `${diaInicio} a ${diaFim} de ${MESES_NOMES[startOfWeek.getMonth()]} de ${startOfWeek.getFullYear()}`;
        } else {
            const mesInicio = MESES_NOMES[startOfWeek.getMonth()].slice(0, 3);
            const mesFim = MESES_NOMES[endOfWeek.getMonth()].slice(0, 3);
            titleEl.textContent = `${diaInicio} ${mesInicio} - ${diaFim} ${mesFim} de ${endOfWeek.getFullYear()}`;
        }
    } else if (AgendaState.currentView === 'diario') {
        const diaSemana = DIAS_SEMANA_NOMES[current.getDay()];
        const diaMes = String(current.getDate()).padStart(2, '0');
        titleEl.textContent = `${diaSemana}, ${diaMes} de ${mes} de ${ano}`;
    }
}

/**
 * Atualiza os cards superiores de métricas (Hoje).
 */
function updateStatsCards() {
    const todayISO = currentISODate();
    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];

    const todayAppointments = appointments.filter(a => a.data === todayISO);
    const agendados = todayAppointments.filter(a => a.status === 'agendado').length;
    const andamento = todayAppointments.filter(a => a.status === 'em_andamento').length;
    const concluidos = todayAppointments.filter(a => a.status === 'concluido').length;

    const elTotal = document.getElementById('stat-total-today');
    const elAgendados = document.getElementById('stat-agendados-today');
    const elAndamento = document.getElementById('stat-andamento-today');
    const elConcluidos = document.getElementById('stat-concluidos-today');

    if (elTotal) elTotal.textContent = todayAppointments.length;
    if (elAgendados) elAgendados.textContent = agendados;
    if (elAndamento) elAndamento.textContent = andamento;
    if (elConcluidos) elConcluidos.textContent = concluidos;
}

/**
 * Renderiza a visualização atualmente ativa.
 */
function renderActiveView() {
    if (AgendaState.currentView === 'mensal') {
        renderMonthlyView();
    } else if (AgendaState.currentView === 'semanal') {
        renderWeeklyView();
    } else if (AgendaState.currentView === 'diario') {
        renderDailyView();
    } else if (AgendaState.currentView === 'kanban') {
        renderKanbanView();
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

/**
 * Aplica os filtros ativos (busca, profissional e status) a uma lista de agendamentos.
 */
function filterAppointments(appointments) {
    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const pets = DB.get(STORAGE_KEYS.PETS) || [];
    const { search, employeeId, status } = AgendaState.filters;

    return appointments.filter(appt => {
        // Filtro por profissional
        if (employeeId && appt.funcionarioId !== employeeId) {
            return false;
        }

        // Filtro por status
        if (status && appt.status !== status) {
            return false;
        }

        // Filtro de busca textual (cliente, pet ou serviço)
        if (search) {
            const client = clients.find(c => c.id === appt.clienteId);
            const pet = pets.find(p => p.id === appt.petId);

            const clientName = (client ? client.nome : '').toLowerCase();
            const petName = (pet ? pet.nome : '').toLowerCase();
            const serviceName = (appt.servico || '').toLowerCase();

            const matchesSearch =
                clientName.includes(search) ||
                petName.includes(search) ||
                serviceName.includes(search);

            if (!matchesSearch) return false;
        }

        return true;
    });
}

// === 1. VISUALIZAÇÃO MENSAL ===

/**
 * Renderiza a grade mensal de 7 colunas com dias e eventos coloridos.
 */
function renderMonthlyView() {
    const container = document.getElementById('month-grid-cells');
    if (!container) return;

    container.innerHTML = '';

    const current = AgendaState.currentDate;
    const year = current.getFullYear();
    const month = current.getMonth();

    const today = new Date();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Domingo
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const allAppointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const pets = DB.get(STORAGE_KEYS.PETS) || [];

    // Mapeamento rápido de clientes e pets
    const clientMap = new Map(clients.map(c => [c.id, c]));
    const petMap = new Map(pets.map(p => [p.id, p]));

    // Total de células na grade mensal (35 ou 42)
    const totalSlots = Math.ceil((firstDayIndex + totalDaysInMonth) / 7) * 7;

    for (let i = 0; i < totalSlots; i++) {
        let cellDate;
        let isOtherMonth = false;

        if (i < firstDayIndex) {
            // Dias do mês anterior
            const prevDayNum = prevMonthDays - (firstDayIndex - i - 1);
            cellDate = new Date(year, month - 1, prevDayNum);
            isOtherMonth = true;
        } else if (i >= firstDayIndex + totalDaysInMonth) {
            // Dias do próximo mês
            const nextDayNum = i - (firstDayIndex + totalDaysInMonth) + 1;
            cellDate = new Date(year, month + 1, nextDayNum);
            isOtherMonth = true;
        } else {
            // Dias do mês atual
            const currentDayNum = i - firstDayIndex + 1;
            cellDate = new Date(year, month, currentDayNum);
        }

        const cellISODate = formatDateToISO(cellDate);
        const isTodayCell = isSameDay(cellDate, today);

        // Obter e filtrar agendamentos para este dia
        const dayAppointments = allAppointments.filter(a => a.data === cellISODate);
        const filteredAppointments = filterAppointments(dayAppointments);

        // Ordenar por horário
        filteredAppointments.sort((a, b) => (a.horario || '').localeCompare(b.horario || ''));

        // Criação da célula
        const cell = document.createElement('div');
        cell.className = `calendar-cell ${isOtherMonth ? 'other-month' : ''} ${isTodayCell ? 'today' : ''}`;
        cell.setAttribute('data-date', cellISODate);

        // Ao clicar no espaço vazio da célula, abre o modal pré-preenchido com esta data
        cell.addEventListener('click', (e) => {
            if (e.target.closest('.cal-event-pill') || e.target.closest('.cal-more-events')) return;
            openNewAppointmentModal(cellISODate);
        });

        // Cabeçalho da célula (número do dia + botão adicionar)
        const header = document.createElement('div');
        header.className = 'calendar-cell-header';

        const numSpan = document.createElement('span');
        numSpan.className = 'calendar-cell-num';
        numSpan.textContent = cellDate.getDate();

        const addBtn = document.createElement('button');
        addBtn.className = 'calendar-cell-add-btn';
        addBtn.title = 'Novo agendamento neste dia';
        addBtn.innerHTML = '+ Agendar';
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openNewAppointmentModal(cellISODate);
        });

        header.appendChild(numSpan);
        header.appendChild(addBtn);
        cell.appendChild(header);

        // Lista de eventos da célula
        const eventsContainer = document.createElement('div');
        eventsContainer.className = 'calendar-cell-events';

        const maxVisibleEvents = 3;
        const visibleEvents = filteredAppointments.slice(0, maxVisibleEvents);
        const extraCount = filteredAppointments.length - maxVisibleEvents;

        visibleEvents.forEach(appt => {
            const pet = petMap.get(appt.petId);
            const petName = pet ? pet.nome : 'Pet';

            const pill = document.createElement('div');
            pill.className = `cal-event-pill ${appt.status || 'agendado'}`;
            pill.title = `${appt.horario} - ${petName} (${appt.servico || 'Serviço'})`;
            pill.innerHTML = `<strong>${appt.horario || '--:--'}</strong> ${escapeHTML(petName)} - ${escapeHTML(appt.servico || '')}`;

            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                openAppointmentDetails(appt.id);
            });

            eventsContainer.appendChild(pill);
        });

        // Link para ver mais agendamentos caso ultrapasse o limite
        if (extraCount > 0) {
            const moreLink = document.createElement('div');
            moreLink.className = 'cal-more-events';
            moreLink.textContent = `+${extraCount} mais`;
            moreLink.addEventListener('click', (e) => {
                e.stopPropagation();
                AgendaState.currentDate = parseISODate(cellISODate);
                switchCalendarView('diario');
            });
            eventsContainer.appendChild(moreLink);
        }

        cell.appendChild(eventsContainer);
        container.appendChild(cell);
    }
}

// === 2. VISUALIZAÇÃO SEMANAL ===

/**
 * Renderiza a grade semanal com 7 colunas (Domingo a Sábado) e seus respectivos agendamentos.
 */
function renderWeeklyView() {
    const container = document.getElementById('week-grid-cells');
    if (!container) return;

    container.innerHTML = '';

    const current = AgendaState.currentDate;
    const startOfWeek = getStartOfWeek(current);
    const today = new Date();

    const allAppointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const pets = DB.get(STORAGE_KEYS.PETS) || [];
    const employees = DB.get(STORAGE_KEYS.EMPLOYEES) || [];

    const clientMap = new Map(clients.map(c => [c.id, c]));
    const petMap = new Map(pets.map(p => [p.id, p]));
    const employeeMap = new Map(employees.map(e => [e.id, e]));

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const colDate = new Date(startOfWeek);
        colDate.setDate(startOfWeek.getDate() + dayOffset);

        const colISODate = formatDateToISO(colDate);
        const isTodayCol = isSameDay(colDate, today);

        const col = document.createElement('div');
        col.className = 'calendar-week-col';

        // Cabeçalho da coluna
        const header = document.createElement('div');
        header.className = `calendar-week-header ${isTodayCol ? 'today' : ''}`;
        header.innerHTML = `
            <div class="week-day-title">${DIAS_SEMANA_ABREV[dayOffset]}</div>
            <div class="week-day-num">${colDate.getDate()}</div>
        `;
        col.appendChild(header);

        // Corpo da coluna
        const body = document.createElement('div');
        body.className = 'calendar-week-body';

        // Agendamentos deste dia
        const dayAppointments = allAppointments.filter(a => a.data === colISODate);
        const filtered = filterAppointments(dayAppointments);
        filtered.sort((a, b) => (a.horario || '').localeCompare(b.horario || ''));

        if (filtered.length === 0) {
            const emptyEl = document.createElement('div');
            emptyEl.className = 'week-col-empty';
            emptyEl.textContent = 'Sem agendamentos';
            body.appendChild(emptyEl);
        } else {
            filtered.forEach(appt => {
                const pet = petMap.get(appt.petId);
                const client = clientMap.get(appt.clienteId);
                const emp = employeeMap.get(appt.funcionarioId);

                const petName = pet ? pet.nome : 'Pet';
                const clientName = client ? client.nome : 'Cliente';
                const empName = emp ? emp.nome : 'Geral';

                const card = document.createElement('div');
                card.className = `week-card ${appt.status || 'agendado'}`;
                card.innerHTML = `
                    <div class="week-card-time">
                        <span><i data-lucide="clock" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i> ${appt.horario || '--:--'}</span>
                        <span class="badge ${getStatusBadgeClass(appt.status)}">${formatStatusLabel(appt.status)}</span>
                    </div>
                    <div class="week-card-pet">${escapeHTML(petName)}</div>
                    <div class="week-card-service">${escapeHTML(appt.servico || '')}</div>
                    <div class="week-card-footer">
                        <span>${escapeHTML(empName)}</span>
                        <strong>${formatCurrency(appt.valor)}</strong>
                    </div>
                `;

                card.addEventListener('click', () => {
                    openAppointmentDetails(appt.id);
                });

                body.appendChild(card);
            });
        }

        // Botão para agendar no final da coluna
        const colAddBtn = document.createElement('button');
        colAddBtn.className = 'btn btn-secondary btn-sm';
        colAddBtn.style.marginTop = 'auto';
        colAddBtn.style.width = '100%';
        colAddBtn.style.justifyContent = 'center';
        colAddBtn.innerHTML = '<i data-lucide="plus" style="width:14px;height:14px;"></i> Agendar';
        colAddBtn.addEventListener('click', () => {
            openNewAppointmentModal(colISODate);
        });
        body.appendChild(colAddBtn);

        col.appendChild(body);
        container.appendChild(col);
    }
}

// === 3. VISUALIZAÇÃO DIÁRIA ===

/**
 * Renderiza a lista de agendamentos do dia selecionado, ordenada por horário.
 */
function renderDailyView() {
    const listContainer = document.getElementById('daily-appointments-list');
    const bannerTitle = document.getElementById('daily-banner-title');
    const bannerCount = document.getElementById('daily-banner-count');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    const current = AgendaState.currentDate;
    const currentISO = formatDateToISO(current);

    const diaSemana = DIAS_SEMANA_NOMES[current.getDay()];
    const diaMes = String(current.getDate()).padStart(2, '0');
    const mes = MESES_NOMES[current.getMonth()];
    const ano = current.getFullYear();

    if (bannerTitle) {
        bannerTitle.textContent = `${diaSemana}, ${diaMes} de ${mes} de ${ano}`;
    }

    const allAppointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const pets = DB.get(STORAGE_KEYS.PETS) || [];
    const employees = DB.get(STORAGE_KEYS.EMPLOYEES) || [];

    const clientMap = new Map(clients.map(c => [c.id, c]));
    const petMap = new Map(pets.map(p => [p.id, p]));
    const employeeMap = new Map(employees.map(e => [e.id, e]));

    const dayAppointments = allAppointments.filter(a => a.data === currentISO);
    const filtered = filterAppointments(dayAppointments);
    filtered.sort((a, b) => (a.horario || '').localeCompare(b.horario || ''));

    if (bannerCount) {
        bannerCount.textContent = `${filtered.length} agendamento${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-state">
                <i data-lucide="calendar-x"></i>
                <p>Nenhum agendamento encontrado para este dia</p>
                <span>Utilize o botão acima para agendar um novo serviço ou navegue para outras datas.</span>
                <div style="margin-top: 1.5rem;">
                    <button class="btn btn-primary" onclick="openNewAppointmentModal('${currentISO}')">
                        <i data-lucide="plus"></i> Novo Agendamento
                    </button>
                </div>
            </div>
        `;
        return;
    }

    filtered.forEach(appt => {
        const pet = petMap.get(appt.petId);
        const client = clientMap.get(appt.clienteId);
        const emp = employeeMap.get(appt.funcionarioId);

        const petName = pet ? pet.nome : 'Pet';
        const petDesc = pet ? `${pet.especie || 'Pet'} • ${pet.raca || 'SRD'} (Porte ${pet.porte || 'M'})` : '';
        const clientName = client ? client.nome : 'Cliente Desconhecido';
        const clientPhone = client && client.telefone ? formatPhone(client.telefone) : '';
        const empName = emp ? emp.nome : 'Profissional não atribuído';

        const card = document.createElement('div');
        card.className = `daily-card ${appt.status || 'agendado'}`;

        card.innerHTML = `
            <div class="daily-card-time">
                <i data-lucide="clock" style="width:18px;height:18px;"></i>
                <span>${appt.horario || '--:--'}</span>
            </div>

            <div class="daily-card-main">
                <div class="daily-card-pet">
                    <span>${escapeHTML(petName)}</span>
                    <span class="badge badge-neutral" style="font-size:0.75rem;font-weight:normal;">${escapeHTML(petDesc)}</span>
                    <span class="badge ${getStatusBadgeClass(appt.status)}">
                        <span class="status-dot ${appt.status}"></span>
                        ${formatStatusLabel(appt.status)}
                    </span>
                    <span class="badge ${appt.tipoEntrega === 'entregar' ? 'badge-delivery' : 'badge-pickup'}">
                        ${appt.tipoEntrega === 'entregar' ? '🚗 Leva & Traz' : '🐾 Tutor Busca'}
                    </span>
                </div>
                <div class="daily-card-client">
                    <strong>Tutor:</strong> ${escapeHTML(clientName)} ${clientPhone ? `• ${clientPhone}` : ''}
                </div>
                <div class="daily-card-meta">
                    <span><i data-lucide="scissors" style="width:14px;height:14px;"></i> ${escapeHTML(appt.servico || 'Serviço')}</span>
                    <span><i data-lucide="user" style="width:14px;height:14px;"></i> ${escapeHTML(empName)}</span>
                    ${appt.observacoes ? `<span><i data-lucide="file-text" style="width:14px;height:14px;"></i> ${escapeHTML(appt.observacoes)}</span>` : ''}
                </div>
            </div>

            <div class="daily-card-price">
                ${formatCurrency(appt.valor)}
            </div>

            <div class="daily-card-actions">
                <button class="btn btn-secondary btn-sm" title="Imprimir Ficha de Baia / Gaiola" onclick="event.stopPropagation(); abrirFichaBaia('${appt.id}')">
                    <i data-lucide="printer" style="width:14px;height:14px;color:var(--primary);"></i> Ficha
                </button>
                <button class="btn btn-whatsapp btn-sm" title="Enviar WhatsApp com mensagem personalizada" onclick="event.stopPropagation(); abrirModalWhatsApp('${appt.id}')">
                    <i data-lucide="message-circle" style="width:14px;height:14px;"></i> WhatsApp
                </button>
                ${appt.status === 'agendado' ? `
                    <button class="btn btn-secondary btn-sm" title="Iniciar Atendimento" onclick="event.stopPropagation(); updateAppointmentStatus('${appt.id}', 'em_andamento')">
                        <i data-lucide="play" style="width:14px;height:14px;color:var(--primary);"></i> Iniciar
                    </button>
                ` : ''}
                ${appt.status === 'em_andamento' ? `
                    <button class="btn btn-success btn-sm" title="Concluir Atendimento" onclick="event.stopPropagation(); completeAppointmentPrompt('${appt.id}')">
                        <i data-lucide="check" style="width:14px;height:14px;"></i> Concluir
                    </button>
                ` : ''}
                <button class="btn btn-secondary btn-sm" title="Ver Detalhes" onclick="event.stopPropagation(); openAppointmentDetails('${appt.id}')">
                    <i data-lucide="eye" style="width:14px;height:14px;"></i>
                </button>
                <button class="btn btn-secondary btn-sm" title="Editar" onclick="event.stopPropagation(); openEditAppointmentModal('${appt.id}')">
                    <i data-lucide="edit-2" style="width:14px;height:14px;"></i>
                </button>
            </div>
        `;

        card.addEventListener('click', () => {
            openAppointmentDetails(appt.id);
        });

        listContainer.appendChild(card);
    });
}

// === 4. VISUALIZAÇÃO KANBAN (BANHO & TOSA OPERACIONAL) ===

function renderKanbanView() {
    const container = document.getElementById('kanban-board-container');
    if (!container) return;

    container.innerHTML = '';

    const current = AgendaState.currentDate;
    const currentISO = formatDateToISO(current);

    const allAppointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const pets = DB.get(STORAGE_KEYS.PETS) || [];
    const employees = DB.get(STORAGE_KEYS.EMPLOYEES) || [];

    const clientMap = new Map(clients.map(c => [c.id, c]));
    const petMap = new Map(pets.map(p => [p.id, p]));
    const employeeMap = new Map(employees.map(e => [e.id, e]));

    const dayAppointments = allAppointments.filter(a => a.data === currentISO && a.status !== 'cancelado');

    // 4 Etapas do Fluxo Operacional:
    const colunas = [
        { id: 'aguardando', title: '🐾 Aguardando / Chegou', icon: 'clock', color: '#F5A623', statusFilter: (a) => a.status === 'agendado' && !a.etapaBanho },
        { id: 'banho', title: '🧼 Na Banheira / Lavando', icon: 'droplet', color: '#5BA4E6', statusFilter: (a) => a.etapaBanho === 'banho' || (a.status === 'em_andamento' && !a.etapaBanho) },
        { id: 'secando_tosa', title: '✂️ Secando / Tosa', icon: 'scissors', color: '#9333ea', statusFilter: (a) => a.etapaBanho === 'secando_tosa' },
        { id: 'prontinho', title: '✨ Prontinho / Cheiroso', icon: 'sparkles', color: '#4CAF82', statusFilter: (a) => a.status === 'concluido' || a.etapaBanho === 'prontinho' }
    ];

    colunas.forEach(col => {
        const colDiv = document.createElement('div');
        colDiv.className = 'kanban-column';
        colDiv.setAttribute('data-etapa', col.id);

        const items = dayAppointments.filter(col.statusFilter);
        items.sort((a, b) => (a.horario || '').localeCompare(b.horario || ''));

        colDiv.innerHTML = `
            <div class="kanban-column-header">
                <div class="kanban-column-title" style="color: ${col.color};">
                    <i data-lucide="${col.icon}" style="width:16px;height:16px;"></i>
                    ${col.title}
                </div>
                <span class="badge" style="background:#fff; border:1px solid var(--border); font-weight:700;">${items.length}</span>
            </div>
            <div class="kanban-cards-list" id="kanban-list-${col.id}"></div>
        `;

        const listDiv = colDiv.querySelector(`#kanban-list-${col.id}`);

        if (items.length === 0) {
            listDiv.innerHTML = `
                <div style="text-align:center; padding:2rem 0.5rem; color:var(--text-light); font-size:0.8rem;">
                    Nenhum pet nesta etapa
                </div>
            `;
        } else {
            items.forEach(appt => {
                const pet = petMap.get(appt.petId);
                const client = clientMap.get(appt.clienteId);
                const emp = employeeMap.get(appt.funcionarioId);

                const petName = pet ? pet.nome : 'Pet';
                const petDesc = pet ? `${pet.especie || 'Pet'} • Porte ${pet.porte || 'M'}` : '';
                const clientName = client ? client.nome : 'Cliente';
                const empName = emp ? emp.nome : 'Geral';

                const card = document.createElement('div');
                card.className = 'kanban-card';
                card.setAttribute('draggable', 'true');
                card.setAttribute('data-id', appt.id);
                card.style.borderLeftColor = col.color;

                card.innerHTML = `
                    <div class="kanban-card-top">
                        <span class="kanban-card-time">
                            <i data-lucide="clock" style="width:13px;height:13px;"></i> ${appt.horario || '--:--'}
                        </span>
                        <span class="badge ${appt.tipoEntrega === 'entregar' ? 'badge-delivery' : 'badge-pickup'}" style="font-size:0.7rem; padding:0.15rem 0.4rem;">
                            ${appt.tipoEntrega === 'entregar' ? '🚗 Entrega' : '🐾 Busca'}
                        </span>
                    </div>
                    <div class="kanban-card-pet">🐾 ${escapeHTML(petName)}</div>
                    <div class="kanban-card-service">${escapeHTML(appt.servico || 'Banho')} (${escapeHTML(petDesc)})</div>
                    <div class="kanban-card-footer">
                        <span>👤 ${escapeHTML(empName)}</span>
                        <div style="display:flex; gap:0.25rem;">
                            <button class="btn-icon" style="padding:2px;" title="Imprimir Ficha de Baia / Gaiola" onclick="event.stopPropagation(); abrirFichaBaia('${appt.id}')">
                                <i data-lucide="printer" style="color:var(--primary); width:15px; height:15px;"></i>
                            </button>
                            <button class="btn-icon" style="padding:2px;" title="WhatsApp" onclick="event.stopPropagation(); abrirModalWhatsApp('${appt.id}')">
                                <i data-lucide="message-circle" style="color:#25D366; width:15px; height:15px;"></i>
                            </button>
                            <button class="btn-icon" style="padding:2px;" title="Avançar etapa" onclick="event.stopPropagation(); avancarEtapaKanban('${appt.id}', '${col.id}')">
                                <i data-lucide="arrow-right-circle" style="color:var(--primary); width:15px; height:15px;"></i>
                            </button>
                        </div>
                    </div>
                `;

                // Drag and Drop
                card.addEventListener('dragstart', (e) => {
                    card.classList.add('dragging');
                    e.dataTransfer.setData('text/plain', appt.id);
                });
                card.addEventListener('dragend', () => {
                    card.classList.remove('dragging');
                });

                card.addEventListener('click', () => {
                    openAppointmentDetails(appt.id);
                });

                listDiv.appendChild(card);
            });
        }

        // Drop zone
        colDiv.addEventListener('dragover', (e) => {
            e.preventDefault();
            colDiv.classList.add('drag-over');
        });
        colDiv.addEventListener('dragleave', () => {
            colDiv.classList.remove('drag-over');
        });
        colDiv.addEventListener('drop', (e) => {
            e.preventDefault();
            colDiv.classList.remove('drag-over');
            const appointmentId = e.dataTransfer.getData('text/plain');
            if (appointmentId) {
                moverParaEtapaKanban(appointmentId, col.id);
            }
        });

        container.appendChild(colDiv);
    });
}

function avancarEtapaKanban(appointmentId, etapaAtual) {
    const proximas = {
        'aguardando': 'banho',
        'banho': 'secando_tosa',
        'secando_tosa': 'prontinho',
        'prontinho': 'prontinho'
    };
    moverParaEtapaKanban(appointmentId, proximas[etapaAtual] || 'banho');
}

function moverParaEtapaKanban(appointmentId, novaEtapa) {
    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const index = appointments.findIndex(a => a.id === appointmentId);
    if (index === -1) return;

    const appt = appointments[index];
    appt.etapaBanho = novaEtapa;

    if (novaEtapa === 'banho' || novaEtapa === 'secando_tosa') {
        appt.status = 'em_andamento';
    } else if (novaEtapa === 'prontinho') {
        appt.status = 'concluido';
        registerRevenueForAppointment(appt);
    } else if (novaEtapa === 'aguardando') {
        appt.status = 'agendado';
    }

    DB.save(STORAGE_KEYS.APPOINTMENTS, appointments);

    if (novaEtapa === 'prontinho') {
        showToast('Pet pronto e cheiroso! Notifique o tutor.', 'success');
        setTimeout(() => abrirModalWhatsApp(appointmentId), 300);
    } else {
        showToast(`Pet movido para: ${novaEtapa.replace('_', ' ')}`, 'info');
    }

    renderCalendar();
}

// === GESTÃO DE PACOTES MENSAIS DE BANHO ===

function abrirModalPacotes() {
    switchPacotesModalTab('ativos');
    populatePacoteClientes();
    openModal('modal-pacotes');
}

function switchPacotesModalTab(tab) {
    const btnAtivos = document.getElementById('tab-btn-pacotes-ativos');
    const btnNovo = document.getElementById('tab-btn-novo-pacote');
    const paneAtivos = document.getElementById('pane-pacotes-ativos');
    const paneNovo = document.getElementById('pane-novo-pacote');

    if (tab === 'ativos') {
        if (btnAtivos) btnAtivos.classList.add('active');
        if (btnNovo) btnNovo.classList.remove('active');
        if (paneAtivos) paneAtivos.style.display = 'block';
        if (paneNovo) paneNovo.style.display = 'none';
        renderListaPacotesAtivos();
    } else {
        if (btnAtivos) btnAtivos.classList.remove('active');
        if (btnNovo) btnNovo.classList.add('active');
        if (paneAtivos) paneAtivos.style.display = 'none';
        if (paneNovo) paneNovo.style.display = 'block';
    }
}

function populatePacoteClientes() {
    const select = document.getElementById('pacote-cliente');
    if (!select) return;
    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    select.innerHTML = '<option value="">Selecione o cliente...</option>';
    clients.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.nome} ${c.telefone ? `(${formatPhone(c.telefone)})` : ''}`;
        select.appendChild(opt);
    });
}

function handlePacoteClientChange() {
    const clientSelect = document.getElementById('pacote-cliente');
    const petSelect = document.getElementById('pacote-pet');
    if (!clientSelect || !petSelect) return;

    const clientId = clientSelect.value;
    if (!clientId) {
        petSelect.innerHTML = '<option value="">Selecione um cliente primeiro...</option>';
        petSelect.disabled = true;
        return;
    }

    const pets = DB.get(STORAGE_KEYS.PETS) || [];
    const clientPets = pets.filter(p => p.clienteId === clientId);

    petSelect.innerHTML = '<option value="">Selecione o pet...</option>';
    clientPets.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.nome} (${p.especie || 'Pet'} • Porte ${p.porte || 'M'})`;
        petSelect.appendChild(opt);
    });
    petSelect.disabled = false;
    if (clientPets.length === 1) petSelect.value = clientPets[0].id;
}

function handlePacoteTipoChange() {
    const tipo = document.getElementById('pacote-tipo').value;
    const sessoesInput = document.getElementById('pacote-sessoes');
    const valorInput = document.getElementById('pacote-valor');
    if (!sessoesInput || !valorInput) return;

    if (tipo === '4_banhos') {
        sessoesInput.value = 4;
        valorInput.value = '140.00';
    } else if (tipo === '4_banhos_1_tosa') {
        sessoesInput.value = 5;
        valorInput.value = '190.00';
    } else if (tipo === '2_banhos_quinzenal') {
        sessoesInput.value = 2;
        valorInput.value = '80.00';
    }
}

function salvarNovoPacote(e) {
    e.preventDefault();
    const clienteId = document.getElementById('pacote-cliente').value;
    const petId = document.getElementById('pacote-pet').value;
    const tipo = document.getElementById('pacote-tipo').value;
    const sessoes = parseInt(document.getElementById('pacote-sessoes').value) || 4;
    const valor = parseFloat(document.getElementById('pacote-valor').value) || 0;
    const formaPagamento = document.getElementById('pacote-pagamento').value;

    if (!clienteId || !petId) {
        showToast('Selecione cliente e pet para o pacote.', 'warning');
        return;
    }

    const packages = DB.get(STORAGE_KEYS.PACKAGES) || [];
    const newPkg = {
        id: DB.generateId(),
        clienteId,
        petId,
        tipo,
        sessoesTotal: sessoes,
        sessoesRestantes: sessoes,
        valorTotal: valor,
        formaPagamento,
        dataInicio: currentISODate(),
        status: 'ativo',
        historicoUso: []
    };

    packages.push(newPkg);
    DB.save(STORAGE_KEYS.PACKAGES, packages);

    // Lança a receita do pacote vendido no financeiro
    const revenues = DB.get(STORAGE_KEYS.REVENUES) || [];
    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const pets = DB.get(STORAGE_KEYS.PETS) || [];
    const c = clients.find(cl => cl.id === clienteId);
    const p = pets.find(pt => pt.id === petId);

    revenues.push({
        id: DB.generateId(),
        data: currentISODate(),
        descricao: `Venda Pacote de Banhos (${sessoes}x) - ${p ? p.nome : 'Pet'} (${c ? c.nome : 'Cliente'})`,
        categoria: 'Serviço',
        valor: valor,
        formaPagamento: formaPagamento,
        referencia: newPkg.id
    });
    DB.save(STORAGE_KEYS.REVENUES, revenues);

    showToast('Pacote vendido e ativado com sucesso!', 'success');
    switchPacotesModalTab('ativos');
}

function renderListaPacotesAtivos() {
    const container = document.getElementById('lista-pacotes-ativos');
    if (!container) return;

    const packages = DB.get(STORAGE_KEYS.PACKAGES) || [];
    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const pets = DB.get(STORAGE_KEYS.PETS) || [];
    const clientMap = new Map(clients.map(c => [c.id, c]));
    const petMap = new Map(pets.map(p => [p.id, p]));

    const ativos = packages.filter(p => p.status === 'ativo');

    if (ativos.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding:2rem;">
                <i data-lucide="award" style="color:var(--accent);"></i>
                <p>Nenhum pacote mensal ativo</p>
                <span>Venda pacotes de banho na aba "+ Vender Novo Pacote" para garantir receita recorrente!</span>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    container.innerHTML = ativos.map(pkg => {
        const pet = petMap.get(pkg.petId);
        const client = clientMap.get(pkg.clienteId);
        const petName = pet ? pet.nome : 'Pet';
        const clientName = client ? client.nome : 'Cliente';
        const pctUsado = ((pkg.sessoesTotal - pkg.sessoesRestantes) / pkg.sessoesTotal) * 100;

        return `
            <div style="background:var(--bg); border:1px solid var(--border-light); border-radius:var(--radius); padding:1rem 1.25rem; margin-bottom:0.75rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem;">
                <div>
                    <div style="font-weight:700; font-size:1.05rem; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
                        🐾 ${escapeHTML(petName)}
                        <span class="badge badge-success" style="font-size:0.75rem;">Ativo</span>
                    </div>
                    <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:2px;">
                        Tutor: <strong>${escapeHTML(clientName)}</strong> • Início: ${formatDate(pkg.dataInicio)}
                    </div>
                    <div style="font-size:0.8rem; color:var(--primary); font-weight:600; margin-top:4px;">
                        Saldo: ${pkg.sessoesRestantes} de ${pkg.sessoesTotal} banhos restantes
                    </div>
                    <div style="width:200px; height:6px; background:#e2e8f0; border-radius:10px; margin-top:6px; overflow:hidden;">
                        <div style="width:${pctUsado}%; height:100%; background:var(--primary);"></div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:0.75rem;">
                    <button class="btn btn-primary btn-sm" onclick="usarBanhoPacote('${pkg.id}')" ${pkg.sessoesRestantes <= 0 ? 'disabled' : ''}>
                        <i data-lucide="check"></i> Dar Baixa em 1 Banho
                    </button>
                    <button class="btn-icon" title="Cancelar pacote" onclick="cancelarPacote('${pkg.id}')">
                        <i data-lucide="trash-2" style="color:var(--danger);"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    lucide.createIcons();
}

function usarBanhoPacote(pkgId) {
    const packages = DB.get(STORAGE_KEYS.PACKAGES) || [];
    const index = packages.findIndex(p => p.id === pkgId);
    if (index === -1) return;

    if (packages[index].sessoesRestantes <= 0) {
        showToast('Este pacote já utilizou todos os banhos!', 'warning');
        return;
    }

    packages[index].sessoesRestantes -= 1;
    if (packages[index].sessoesRestantes === 0) {
        packages[index].status = 'concluido';
    }
    DB.save(STORAGE_KEYS.PACKAGES, packages);

    showToast(`1 banho debitado do pacote! Restam ${packages[index].sessoesRestantes}.`, 'success');
    renderListaPacotesAtivos();
}

async function cancelarPacote(pkgId) {
    const conf = await confirmDialog('Deseja realmente cancelar este pacote?');
    if (!conf) return;

    const packages = DB.get(STORAGE_KEYS.PACKAGES) || [];
    const filtrados = packages.filter(p => p.id !== pkgId);
    DB.save(STORAGE_KEYS.PACKAGES, filtrados);
    showToast('Pacote removido com sucesso.', 'info');
    renderListaPacotesAtivos();
}

// === Modal de Detalhes do Agendamento ===

/**
 * Abre o modal exibindo detalhes completos do agendamento e botões de fluxo de status.
 */
function openAppointmentDetails(appointmentId) {
    AgendaState.activeAppointmentId = appointmentId;

    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const appt = appointments.find(a => a.id === appointmentId);

    if (!appt) {
        showToast('Agendamento não encontrado.', 'error');
        return;
    }

    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const pets = DB.get(STORAGE_KEYS.PETS) || [];
    const employees = DB.get(STORAGE_KEYS.EMPLOYEES) || [];

    const client = clients.find(c => c.id === appt.clienteId);
    const pet = pets.find(p => p.id === appt.petId);
    const employee = employees.find(e => e.id === appt.funcionarioId);

    const clientName = client ? client.nome : 'Cliente não informado';
    const clientPhone = client ? formatPhone(client.telefone) : '-';
    const clientEmail = client && client.email ? client.email : '-';

    const petName = pet ? pet.nome : 'Pet não informado';
    const petInfo = pet ? `${pet.especie || 'Pet'} • ${pet.raca || 'SRD'} • Porte ${pet.porte || 'M'} (${pet.peso ? pet.peso + 'kg' : ''})` : '-';
    const petAlergias = pet && pet.alergias ? pet.alergias : 'Nenhuma';

    const empName = employee ? employee.nome : 'Não definido';
    const empCargo = employee ? employee.cargo : '';

    const modalBody = document.getElementById('details-modal-body');
    if (!modalBody) return;

    modalBody.innerHTML = `
        <div class="detail-badge-header">
            <div>
                <span class="badge ${getStatusBadgeClass(appt.status)}" style="font-size:0.9rem;padding:0.4rem 0.85rem;">
                    <span class="status-dot ${appt.status}"></span>
                    ${formatStatusLabel(appt.status)}
                </span>
            </div>
            <div style="font-size:0.85rem;color:var(--text-secondary);">
                ID: <code>${appt.id}</code>
            </div>
        </div>

        <div class="detail-info-grid">
            <div class="detail-item">
                <span class="detail-item-label">Tutor / Cliente</span>
                <span class="detail-item-value"><strong>${escapeHTML(clientName)}</strong></span>
                <span style="font-size:0.85rem;color:var(--text-secondary);">${clientPhone} • ${clientEmail}</span>
            </div>

            <div class="detail-item">
                <span class="detail-item-label">Pet</span>
                <span class="detail-item-value"><strong>${escapeHTML(petName)}</strong></span>
                <span style="font-size:0.85rem;color:var(--text-secondary);">${escapeHTML(petInfo)}</span>
                ${petAlergias !== 'Nenhuma' ? `<span style="font-size:0.8rem;color:var(--danger);">⚠️ Alergias: ${escapeHTML(petAlergias)}</span>` : ''}
            </div>

            <div class="detail-item">
                <span class="detail-item-label">Serviço</span>
                <span class="detail-item-value">${escapeHTML(appt.servico || '-')}</span>
            </div>

            <div class="detail-item">
                <span class="detail-item-label">Profissional Responsável</span>
                <span class="detail-item-value">${escapeHTML(empName)} ${empCargo ? `(${escapeHTML(empCargo)})` : ''}</span>
            </div>

            <div class="detail-item">
                <span class="detail-item-label">Data e Horário</span>
                <span class="detail-item-value">${formatDate(appt.data)} às ${appt.horario || '--:--'}</span>
            </div>

            <div class="detail-item">
                <span class="detail-item-label">Retirada / Entrega</span>
                <span class="detail-item-value">
                    <span class="badge ${appt.tipoEntrega === 'entregar' ? 'badge-delivery' : 'badge-pickup'}" style="font-size:0.85rem;">
                        ${appt.tipoEntrega === 'entregar' ? '🚗 Leva & Traz (Pet Shop entrega)' : '🐾 Tutor vem buscar'}
                    </span>
                </span>
            </div>

            <div class="detail-item">
                <span class="detail-item-label">Valor Total</span>
                <span class="detail-item-value highlight">${formatCurrency(appt.valor)}</span>
            </div>
        </div>

        ${appt.observacoes ? `
            <div class="detail-notes-box">
                <strong>Observações:</strong> ${escapeHTML(appt.observacoes)}
            </div>
        ` : ''}

        <!-- Seção de Notificação WhatsApp -->
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:var(--radius); padding:1rem 1.25rem; margin-top:1.25rem; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem;">
            <div>
                <div style="font-weight:700; color:#166534; font-size:0.95rem; display:flex; align-items:center; gap:0.4rem;">
                    <i data-lucide="message-circle" style="color:#25D366; width:18px; height:18px;"></i>
                    Notificar Tutor no WhatsApp
                </div>
                <div style="font-size:0.8rem; color:#15803d; margin-top:2px;">
                    Envie mensagem avisando que o pet está pronto para buscar ou a caminho da entrega!
                </div>
            </div>
            <button class="btn btn-whatsapp btn-sm" onclick="abrirModalWhatsApp('${appt.id}')">
                <i data-lucide="send"></i> Enviar Mensagem
            </button>
        </div>

        <!-- Seção de Gerenciamento de Status -->
        <div class="detail-actions-box">
            <div class="detail-actions-title">
                <i data-lucide="activity" style="width:16px;height:16px;"></i>
                Alterar Status do Agendamento
            </div>

            <div class="detail-status-buttons" id="status-buttons-container">
                ${renderStatusButtons(appt)}
            </div>
        </div>
    `;

    // Configurar botões de rodapé (Imprimir Ficha, Editar e Excluir)
    const btnPrintFicha = document.getElementById('btn-details-print-ficha');
    const btnEdit = document.getElementById('btn-details-edit');
    const btnDelete = document.getElementById('btn-details-delete');

    if (btnPrintFicha) {
        btnPrintFicha.onclick = () => {
            abrirFichaBaia(appt.id);
        };
    }

    if (btnEdit) {
        btnEdit.onclick = () => {
            closeModal('modal-details');
            openEditAppointmentModal(appt.id);
        };
    }

    if (btnDelete) {
        btnDelete.onclick = () => deleteAppointment(appt.id);
    }

    openModal('modal-details');
    lucide.createIcons();
}

/**
 * Gera os botões de ação de status com base no status atual do agendamento.
 */
function renderStatusButtons(appt) {
    if (appt.status === 'agendado') {
        return `
            <button class="btn btn-primary btn-sm" onclick="updateAppointmentStatus('${appt.id}', 'em_andamento')">
                <i data-lucide="play"></i> Iniciar Atendimento
            </button>
            <div class="payment-method-box" style="width: 100%;">
                <label for="detail-payment-method" style="font-size:0.85rem;font-weight:600;">Forma de Pagamento:</label>
                <select id="detail-payment-method" class="filter-select" style="padding:0.4rem 0.6rem;">
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Pix" selected>Pix</option>
                    <option value="Cartão Crédito">Cartão de Crédito</option>
                    <option value="Cartão Débito">Cartão de Débito</option>
                </select>
                <button class="btn btn-success btn-sm" onclick="completeAppointmentWithSelectedMethod('${appt.id}')">
                    <i data-lucide="check-circle-2"></i> Concluir Atendimento
                </button>
            </div>
            <button class="btn btn-secondary btn-sm" style="color:var(--danger);border-color:var(--danger-light);margin-top:0.5rem;" onclick="cancelAppointment('${appt.id}')">
                <i data-lucide="x-circle"></i> Cancelar Agendamento
            </button>
        `;
    }

    if (appt.status === 'em_andamento') {
        return `
            <div class="payment-method-box" style="width: 100%; margin-top: 0; padding-top: 0; border-top: none;">
                <label for="detail-payment-method" style="font-size:0.85rem;font-weight:600;">Forma de Pagamento:</label>
                <select id="detail-payment-method" class="filter-select" style="padding:0.4rem 0.6rem;">
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Pix" selected>Pix</option>
                    <option value="Cartão Crédito">Cartão de Crédito</option>
                    <option value="Cartão Débito">Cartão de Débito</option>
                </select>
                <button class="btn btn-success btn-sm" onclick="completeAppointmentWithSelectedMethod('${appt.id}')">
                    <i data-lucide="check-circle-2"></i> Concluir e Registrar Receita
                </button>
            </div>
            <div style="display:flex;gap:0.5rem;margin-top:0.6rem;">
                <button class="btn btn-secondary btn-sm" onclick="updateAppointmentStatus('${appt.id}', 'agendado')">
                    <i data-lucide="rotate-ccw"></i> Voltar para Agendado
                </button>
                <button class="btn btn-secondary btn-sm" style="color:var(--danger);border-color:var(--danger-light);" onclick="cancelAppointment('${appt.id}')">
                    <i data-lucide="x-circle"></i> Cancelar Agendamento
                </button>
            </div>
        `;
    }

    if (appt.status === 'concluido') {
        return `
            <div style="display:flex;flex-direction:column;gap:0.75rem;width:100%;">
                <div class="revenue-registered-badge">
                    <i data-lucide="check-check"></i>
                    Atendimento concluído! A receita foi lançada no Financeiro.
                </div>
                <div>
                    <button class="btn btn-secondary btn-sm" onclick="reopenAppointment('${appt.id}')">
                        <i data-lucide="rotate-ccw"></i> Reabrir Agendamento
                    </button>
                </div>
            </div>
        `;
    }

    if (appt.status === 'cancelado') {
        return `
            <div style="display:flex;flex-direction:column;gap:0.75rem;width:100%;">
                <div style="color:var(--danger);font-size:0.85rem;font-weight:600;">
                    Este agendamento encontra-se cancelado.
                </div>
                <div>
                    <button class="btn btn-secondary btn-sm" onclick="updateAppointmentStatus('${appt.id}', 'agendado')">
                        <i data-lucide="refresh-cw"></i> Reativar Agendamento
                    </button>
                </div>
            </div>
        `;
    }

    return '';
}

// === Gerenciamento de Status e Receitas ===

/**
 * Atualiza o status de um agendamento diretamente no banco local.
 */
function updateAppointmentStatus(appointmentId, newStatus) {
    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const index = appointments.findIndex(a => a.id === appointmentId);

    if (index === -1) {
        showToast('Agendamento não encontrado.', 'error');
        return;
    }

    appointments[index].status = newStatus;
    DB.save(STORAGE_KEYS.APPOINTMENTS, appointments);

    showToast(`Status atualizado para "${formatStatusLabel(newStatus)}".`, 'info');

    renderCalendar();

    // Se o modal de detalhes estiver aberto com este agendamento, recarrega o conteúdo
    const modalDetails = document.getElementById('modal-details');
    if (modalDetails && modalDetails.classList.contains('active')) {
        openAppointmentDetails(appointmentId);
    }
}

/**
 * Conclui o agendamento capturando a forma de pagamento selecionada na tela.
 */
function completeAppointmentWithSelectedMethod(appointmentId) {
    const selectMethod = document.getElementById('detail-payment-method');
    const paymentMethod = selectMethod ? selectMethod.value : 'Dinheiro';
    completeAppointment(appointmentId, paymentMethod);
}

/**
 * Pergunta a forma de pagamento rápida e conclui o agendamento.
 */
function completeAppointmentPrompt(appointmentId) {
    openAppointmentDetails(appointmentId);
}

/**
 * Conclui o agendamento e registra a entrada de receita no Financeiro.
 */
function completeAppointment(appointmentId, paymentMethod = 'Pix') {
    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const index = appointments.findIndex(a => a.id === appointmentId);

    if (index === -1) {
        showToast('Agendamento não encontrado.', 'error');
        return;
    }

    const appt = appointments[index];
    appt.status = 'concluido';
    DB.save(STORAGE_KEYS.APPOINTMENTS, appointments);

    // Registrar receita correspondente
    registerRevenueForAppointment(appt, paymentMethod);

    showToast('Agendamento concluído com sucesso! Receita registrada no financeiro.', 'success');

    renderCalendar();

    const modalDetails = document.getElementById('modal-details');
    if (modalDetails && modalDetails.classList.contains('active')) {
        openAppointmentDetails(appointmentId);
    }
}

/**
 * Registra uma entrada na tabela de Receitas vinculada ao agendamento.
 */
function registerRevenueForAppointment(appointment, formaPagamento = 'Dinheiro') {
    const revenues = DB.get(STORAGE_KEYS.REVENUES) || [];

    // Evita duplicar a receita se já existir para este agendamento
    const existingIndex = revenues.findIndex(r => r.referencia === appointment.id);
    if (existingIndex !== -1) {
        return;
    }

    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const pets = DB.get(STORAGE_KEYS.PETS) || [];

    const client = clients.find(c => c.id === appointment.clienteId);
    const pet = pets.find(p => p.id === appointment.petId);

    const clientName = client ? client.nome : 'Cliente';
    const petName = pet ? pet.nome : 'Pet';

    const newRevenue = {
        id: DB.generateId(),
        data: appointment.data || currentISODate(),
        descricao: `${appointment.servico || 'Serviço'} - ${petName} (${clientName})`,
        categoria: 'Serviço',
        valor: parseFloat(appointment.valor) || 0,
        formaPagamento: formaPagamento || 'Dinheiro',
        referencia: appointment.id
    };

    revenues.push(newRevenue);
    DB.save(STORAGE_KEYS.REVENUES, revenues);
}

/**
 * Cancela o agendamento com confirmação prévia e estorna eventual receita.
 */
async function cancelAppointment(appointmentId) {
    const confirmed = await confirmDialog('Deseja realmente cancelar este agendamento?');
    if (!confirmed) return;

    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const index = appointments.findIndex(a => a.id === appointmentId);

    if (index === -1) return;

    appointments[index].status = 'cancelado';
    DB.save(STORAGE_KEYS.APPOINTMENTS, appointments);

    // Remover receita associada caso já tenha sido registrada
    removeRevenueForAppointment(appointmentId);

    showToast('Agendamento cancelado.', 'info');
    renderCalendar();

    const modalDetails = document.getElementById('modal-details');
    if (modalDetails && modalDetails.classList.contains('active')) {
        openAppointmentDetails(appointmentId);
    }
}

/**
 * Reabre um agendamento concluído, voltando-o para 'agendado' e removendo a receita associada.
 */
async function reopenAppointment(appointmentId) {
    const confirmed = await confirmDialog('Reabrir este agendamento removerá o lançamento da receita no financeiro. Continuar?');
    if (!confirmed) return;

    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const index = appointments.findIndex(a => a.id === appointmentId);

    if (index === -1) return;

    appointments[index].status = 'agendado';
    DB.save(STORAGE_KEYS.APPOINTMENTS, appointments);

    // Remover receita vinculada
    removeRevenueForAppointment(appointmentId);

    showToast('Agendamento reaberto como "Agendado".', 'info');
    renderCalendar();

    const modalDetails = document.getElementById('modal-details');
    if (modalDetails && modalDetails.classList.contains('active')) {
        openAppointmentDetails(appointmentId);
    }
}

/**
 * Remove eventual receita vinculada a um agendamento.
 */
function removeRevenueForAppointment(appointmentId) {
    const revenues = DB.get(STORAGE_KEYS.REVENUES) || [];
    const filtered = revenues.filter(r => r.referencia !== appointmentId);

    if (filtered.length !== revenues.length) {
        DB.save(STORAGE_KEYS.REVENUES, filtered);
    }
}

// === CRUD de Agendamentos (Criar, Editar, Excluir) ===

/**
 * Abre o modal para cadastro de novo agendamento.
 * @param {string|null} prefillDate Data opcional no formato YYYY-MM-DD para pré-preenchimento
 */
function openNewAppointmentModal(prefillDate = null) {
    const form = document.getElementById('appointment-form');
    if (form) form.reset();

    const titleEl = document.getElementById('modal-appointment-title');
    if (titleEl) titleEl.textContent = 'Novo Agendamento';

    document.getElementById('appointment-id').value = '';

    // Carregar selects de clientes e funcionários
    populateFormClients();
    populateFormEmployees();

    // Data padrão: data fornecida ou data atual
    const targetDate = prefillDate || formatDateToISO(AgendaState.currentDate) || currentISODate();
    document.getElementById('appointment-date').value = targetDate;

    // Horário sugerido padrão
    document.getElementById('appointment-time').value = '09:00';

    // Status padrão: agendado
    document.getElementById('appointment-status').value = 'agendado';

    // Desabilitar o select de pets até que o cliente seja escolhido
    const petSelect = document.getElementById('appointment-pet');
    if (petSelect) {
        petSelect.innerHTML = '<option value="">Selecione um cliente primeiro...</option>';
        petSelect.disabled = true;
    }

    // Limpar o valor e a dica de preço
    document.getElementById('appointment-value').value = '';
    const hint = document.getElementById('service-price-hint');
    if (hint) hint.textContent = '';

    openModal('modal-appointment');
}

/**
 * Abre o modal preenchido para edição de um agendamento existente.
 */
function openEditAppointmentModal(appointmentId) {
    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const appt = appointments.find(a => a.id === appointmentId);

    if (!appt) {
        showToast('Agendamento não encontrado para edição.', 'error');
        return;
    }

    const titleEl = document.getElementById('modal-appointment-title');
    if (titleEl) titleEl.textContent = 'Editar Agendamento';

    document.getElementById('appointment-id').value = appt.id;

    // Preencher clientes e funcionários
    populateFormClients(appt.clienteId);
    populateFormEmployees(appt.funcionarioId);

    // Carregar pets do cliente e selecionar o pet correto
    populateFormPets(appt.clienteId, appt.petId);

    // Preencher demais campos
    document.getElementById('appointment-service').value = appt.servico || 'Banho';
    document.getElementById('appointment-date').value = appt.data || currentISODate();
    document.getElementById('appointment-time').value = appt.horario || '09:00';
    document.getElementById('appointment-status').value = appt.status || 'agendado';
    if (document.getElementById('appointment-delivery')) {
        document.getElementById('appointment-delivery').value = appt.tipoEntrega || 'buscar';
    }
    if (document.getElementById('appointment-payment-status')) {
        document.getElementById('appointment-payment-status').value = appt.statusPagamento || 'pendente';
    }
    document.getElementById('appointment-value').value = appt.valor != null ? appt.valor : '';
    document.getElementById('appointment-notes').value = appt.observacoes || '';

    updateServicePriceHint();

    openModal('modal-appointment');
}

/**
 * Gerencia o campo digitável com busca e autocompletar de clientes.
 */
function populateFormClients(selectedClientId = '') {
    const hiddenInput = document.getElementById('appointment-client');
    const textInput = document.getElementById('appointment-client-input');
    if (!hiddenInput) return;

    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];

    if (selectedClientId) {
        const found = clients.find(c => c.id === selectedClientId);
        if (found) {
            hiddenInput.value = found.id;
            if (textInput) textInput.value = `${found.nome} ${found.telefone ? `(${formatPhone(found.telefone)})` : ''}`;
        }
    } else {
        hiddenInput.value = '';
        if (textInput) textInput.value = '';
    }

    renderDropdownClientes(clients);
}

function abrirDropdownClientes() {
    const dropdown = document.getElementById('dropdown-clientes-list');
    const textInput = document.getElementById('appointment-client-input');
    if (!dropdown) return;
    filtrarDropdownClientes(textInput ? textInput.value : '');
    dropdown.classList.add('active');
}

function fecharDropdownClientes() {
    const dropdown = document.getElementById('dropdown-clientes-list');
    if (dropdown) dropdown.classList.remove('active');
}

// Fecha o dropdown ao clicar fora
document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('combobox-client-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
        fecharDropdownClientes();
    }
});

function filtrarDropdownClientes(termo) {
    const dropdown = document.getElementById('dropdown-clientes-list');
    if (!dropdown) return;

    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const t = (termo || '').toLowerCase().trim();

    const filtrados = clients.filter(c => {
        const nome = (c.nome || '').toLowerCase();
        const tel = (c.telefone || '').replace(/\D/g, '');
        const termoNumerico = t.replace(/\D/g, '');
        return nome.includes(t) || (termoNumerico && tel.includes(termoNumerico));
    });

    renderDropdownClientes(filtrados);
    dropdown.classList.add('active');
}

function renderDropdownClientes(lista) {
    const dropdown = document.getElementById('dropdown-clientes-list');
    if (!dropdown) return;

    if (lista.length === 0) {
        dropdown.innerHTML = `
            <div style="padding:0.75rem; color:var(--text-light); text-align:center; font-size:0.85rem;">
                Nenhum cliente encontrado
            </div>
        `;
        return;
    }

    const currentSelectedId = document.getElementById('appointment-client')?.value;

    dropdown.innerHTML = lista.map(c => `
        <div class="combobox-item ${c.id === currentSelectedId ? 'selected' : ''}" onclick="selecionarClienteCombobox('${c.id}')">
            <div>
                <strong>${escapeHTML(c.nome)}</strong>
                ${c.cpf ? `<span class="item-sub" style="margin-left:6px;">CPF: ${escapeHTML(c.cpf)}</span>` : ''}
            </div>
            <span class="item-sub">${c.telefone ? formatPhone(c.telefone) : ''}</span>
        </div>
    `).join('');
}

function selecionarClienteCombobox(clienteId) {
    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const found = clients.find(c => c.id === clienteId);
    if (!found) return;

    const hiddenInput = document.getElementById('appointment-client');
    const textInput = document.getElementById('appointment-client-input');

    if (hiddenInput) hiddenInput.value = found.id;
    if (textInput) textInput.value = `${found.nome} ${found.telefone ? `(${formatPhone(found.telefone)})` : ''}`;

    fecharDropdownClientes();

    // Dispara a atualização dos pets vinculados e cálculo automático de preço
    handleClientSelectChange();
}

/**
 * Preenche o select de funcionários no formulário.
 */
function populateFormEmployees(selectedEmployeeId = '') {
    const select = document.getElementById('appointment-employee');
    if (!select) return;

    const employees = DB.get(STORAGE_KEYS.EMPLOYEES) || [];
    select.innerHTML = '<option value="">Selecione o profissional...</option>';

    employees.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = `${emp.nome} (${emp.cargo})`;
        if (emp.id === selectedEmployeeId) option.selected = true;
        select.appendChild(option);
    });
}

/**
 * Preenche o select de pets de acordo com o cliente escolhido.
 */
function populateFormPets(clientId, selectedPetId = '') {
    const select = document.getElementById('appointment-pet');
    if (!select) return;

    const btnQuickPet = document.getElementById('btn-quick-add-pet');

    if (!clientId) {
        select.innerHTML = '<option value="">Selecione um cliente primeiro...</option>';
        select.disabled = true;
        if (btnQuickPet) btnQuickPet.style.display = 'none';
        return;
    }

    if (btnQuickPet) btnQuickPet.style.display = 'inline-flex';

    const allPets = DB.get(STORAGE_KEYS.PETS) || [];
    const clientPets = allPets.filter(p => p.clienteId === clientId);

    if (clientPets.length === 0) {
        select.innerHTML = '<option value="">Nenhum pet encontrado - clique em "+ Cadastrar Pet" acima</option>';
        select.disabled = true;
        return;
    }

    select.innerHTML = '<option value="">Selecione um pet...</option>';
    clientPets.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.setAttribute('data-porte', p.porte || 'M');
        option.textContent = `${p.nome} (${p.especie || 'Pet'} • Porte ${p.porte || 'M'})`;
        if (p.id === selectedPetId) option.selected = true;
        select.appendChild(option);
    });

    select.disabled = false;

    // Se houver apenas 1 pet ou se nenhum estiver selecionado, seleciona o primeiro por conveniência
    if (!selectedPetId && clientPets.length === 1) {
        select.value = clientPets[0].id;
    }
}

// Funções para cadastrar Pet rapidamente sem sair da Agenda
function abrirModalRapidoNovoPet() {
    const clientId = document.getElementById('appointment-client')?.value;
    if (!clientId) {
        showToast('Selecione um cliente primeiro!', 'warning');
        return;
    }

    const clients = DB.get(STORAGE_KEYS.CLIENTS) || [];
    const client = clients.find(c => c.id === clientId);

    const tutorInfo = document.getElementById('quick-pet-tutor-info');
    if (tutorInfo) {
        tutorInfo.innerHTML = `Tutor: <strong>${client ? escapeHTML(client.nome) : 'Cliente'}</strong>`;
    }

    const form = document.getElementById('form-quick-pet');
    if (form) form.reset();

    openModal('modal-quick-pet');
}

function salvarQuickPet(e) {
    e.preventDefault();
    const clientId = document.getElementById('appointment-client')?.value;
    if (!clientId) return;

    const nome = document.getElementById('quick-pet-nome')?.value.trim();
    const especie = document.getElementById('quick-pet-especie')?.value || 'Cão';
    const porte = document.getElementById('quick-pet-porte')?.value || 'M';
    const raca = document.getElementById('quick-pet-raca')?.value.trim() || 'SRD';

    if (!nome) {
        showToast('Informe o nome do pet.', 'warning');
        return;
    }

    const pets = DB.get(STORAGE_KEYS.PETS) || [];
    const novoPet = {
        id: DB.generateId(),
        clienteId: clientId,
        nome,
        especie,
        raca,
        porte,
        dataNascimento: '',
        peso: null,
        alergias: '',
        observacoes: '',
        foto: ''
    };

    pets.push(novoPet);
    DB.save(STORAGE_KEYS.PETS, pets);

    closeModal('modal-quick-pet');
    showToast(`Pet "${nome}" cadastrado com sucesso!`, 'success');

    // Recarrega o select de pets e já seleciona o pet recém-criado
    populateFormPets(clientId, novoPet.id);
    autoCalculateServicePrice();
}

/**
 * Listener disparado ao trocar o cliente selecionado.
 */
function handleClientSelectChange() {
    const clientSelect = document.getElementById('appointment-client');
    const clientId = clientSelect.value;

    populateFormPets(clientId);
    autoCalculateServicePrice();
}

/**
 * Listener disparado ao trocar o pet selecionado.
 */
function handlePetSelectChange() {
    autoCalculateServicePrice();
}

/**
 * Listener disparado ao trocar o serviço selecionado.
 */
function handleServiceSelectChange() {
    autoCalculateServicePrice();
}

/**
 * Calcula automaticamente o valor sugerido com base no serviço e no porte do pet.
 * Valor obtido de settings.servicoPrecos[servico][pet.porte].
 */
function autoCalculateServicePrice() {
    const petSelect = document.getElementById('appointment-pet');
    const serviceSelect = document.getElementById('appointment-service');
    const valueInput = document.getElementById('appointment-value');
    const hintEl = document.getElementById('service-price-hint');

    if (!petSelect || !serviceSelect || !valueInput) return;

    const selectedPetOption = petSelect.selectedOptions[0];
    const service = serviceSelect.value;

    if (!selectedPetOption || !selectedPetOption.value || !service) {
        if (hintEl) hintEl.textContent = '';
        return;
    }

    const porte = selectedPetOption.getAttribute('data-porte') || 'M';

    // Obter tabela de preços das configurações locais
    const settings = DB.get(STORAGE_KEYS.SETTINGS) || {};
    const servicoPrecos = settings.servicoPrecos || PRECOS_SERVICOS_PADRAO;

    let price = null;
    if (servicoPrecos[service] && servicoPrecos[service][porte] != null) {
        price = servicoPrecos[service][porte];
    } else if (PRECOS_SERVICOS_PADRAO[service] && PRECOS_SERVICOS_PADRAO[service][porte] != null) {
        price = PRECOS_SERVICOS_PADRAO[service][porte];
    }

    if (price != null) {
        valueInput.value = Number(price).toFixed(2);
        if (hintEl) {
            hintEl.textContent = `Preço tabelado para ${service} (Porte ${porte}): ${formatCurrency(price)}`;
            hintEl.style.color = 'var(--text-secondary)';
        }
    } else {
        if (hintEl) {
            hintEl.textContent = 'Informe o valor manualmente para este serviço/porte.';
            hintEl.style.color = 'var(--warning)';
        }
    }
}

/**
 * Atualiza o texto da dica de preço sem sobrescrever valor digitado manualmente.
 */
function updateServicePriceHint() {
    const petSelect = document.getElementById('appointment-pet');
    const serviceSelect = document.getElementById('appointment-service');
    const hintEl = document.getElementById('service-price-hint');

    if (!petSelect || !serviceSelect || !hintEl) return;

    const selectedPetOption = petSelect.selectedOptions[0];
    const service = serviceSelect.value;

    if (!selectedPetOption || !selectedPetOption.value || !service) {
        hintEl.textContent = '';
        return;
    }

    const porte = selectedPetOption.getAttribute('data-porte') || 'M';
    const settings = DB.get(STORAGE_KEYS.SETTINGS) || {};
    const servicoPrecos = settings.servicoPrecos || PRECOS_SERVICOS_PADRAO;

    const price = (servicoPrecos[service] && servicoPrecos[service][porte]) ||
                  (PRECOS_SERVICOS_PADRAO[service] && PRECOS_SERVICOS_PADRAO[service][porte]);

    if (price != null) {
        hintEl.textContent = `Preço tabelado para ${service} (Porte ${porte}): ${formatCurrency(price)}`;
        hintEl.style.color = 'var(--text-secondary)';
    }
}

/**
 * Trata o envio do formulário de agendamento (Criação e Edição).
 */
function handleAppointmentSubmit(event) {
    event.preventDefault();

    const id = document.getElementById('appointment-id').value;
    const clienteId = document.getElementById('appointment-client').value;
    const petId = document.getElementById('appointment-pet').value;
    const servico = document.getElementById('appointment-service').value;
    const funcionarioId = document.getElementById('appointment-employee').value;
    const data = document.getElementById('appointment-date').value;
    const horario = document.getElementById('appointment-time').value;
    const status = document.getElementById('appointment-status').value || 'agendado';
    const tipoEntrega = document.getElementById('appointment-delivery') ? document.getElementById('appointment-delivery').value : 'buscar';
    const statusPagamento = document.getElementById('appointment-payment-status') ? document.getElementById('appointment-payment-status').value : 'pendente';
    const valor = parseFloat(document.getElementById('appointment-value').value);
    const observacoes = document.getElementById('appointment-notes').value.trim();

    // Validações obrigatórias
    if (!clienteId) {
        showToast('Selecione o cliente.', 'warning');
        return;
    }
    if (!petId) {
        showToast('Selecione o pet.', 'warning');
        return;
    }
    if (!servico) {
        showToast('Selecione o serviço.', 'warning');
        return;
    }
    if (!funcionarioId) {
        showToast('Selecione o profissional.', 'warning');
        return;
    }
    if (!data) {
        showToast('Informe a data do agendamento.', 'warning');
        return;
    }
    if (!horario) {
        showToast('Informe o horário do agendamento.', 'warning');
        return;
    }
    if (isNaN(valor) || valor < 0) {
        showToast('Informe um valor válido para o serviço.', 'warning');
        return;
    }

    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];

    if (id) {
        // --- Atualização de Agendamento Existente ---
        const index = appointments.findIndex(a => a.id === id);
        if (index === -1) {
            showToast('Agendamento não encontrado para atualização.', 'error');
            return;
        }

        const previousStatus = appointments[index].status;

        appointments[index] = {
            ...appointments[index],
            clienteId,
            petId,
            servico,
            funcionarioId,
            data,
            horario,
            status,
            tipoEntrega,
            statusPagamento,
            valor,
            observacoes
        };

        DB.save(STORAGE_KEYS.APPOINTMENTS, appointments);

        // Se o status mudou para concluído, gera o lançamento financeiro
        if (status === 'concluido' && previousStatus !== 'concluido') {
            registerRevenueForAppointment(appointments[index]);
        } else if (status === 'cancelado' && previousStatus !== 'cancelado') {
            removeRevenueForAppointment(id);
        }

        showToast('Agendamento atualizado com sucesso!', 'success');
    } else {
        // --- Criação de Novo Agendamento ---
        const newAppointment = {
            id: DB.generateId(),
            clienteId,
            petId,
            servico,
            funcionarioId,
            data,
            horario,
            status,
            tipoEntrega,
            statusPagamento,
            valor,
            observacoes
        };

        appointments.push(newAppointment);
        DB.save(STORAGE_KEYS.APPOINTMENTS, appointments);

        // Se já for criado como concluído, lança a receita
        if (status === 'concluido') {
            registerRevenueForAppointment(newAppointment);
        }

        showToast('Agendamento cadastrado com sucesso!', 'success');
    }

    closeModal('modal-appointment');
    renderCalendar();

    // Se o modal de detalhes estiver aberto e foi editado, atualiza
    if (id && document.getElementById('modal-details').classList.contains('active')) {
        openAppointmentDetails(id);
    }
}

/**
 * Exclui permanentemente um agendamento após confirmação do usuário.
 */
async function deleteAppointment(appointmentId) {
    const confirmed = await confirmDialog('Tem certeza que deseja excluir permanentemente este agendamento?');
    if (!confirmed) return;

    const appointments = DB.get(STORAGE_KEYS.APPOINTMENTS) || [];
    const filtered = appointments.filter(a => a.id !== appointmentId);

    DB.save(STORAGE_KEYS.APPOINTMENTS, filtered);

    // Remove eventual receita vinculada
    removeRevenueForAppointment(appointmentId);

    closeModal('modal-details');
    showToast('Agendamento excluído com sucesso.', 'info');
    renderCalendar();
}

// === Formatação Visual e Utilitários ===

/**
 * Retorna o rótulo legível em português para cada status.
 */
function formatStatusLabel(status) {
    switch (status) {
        case 'agendado': return 'Agendado';
        case 'em_andamento': return 'Em Andamento';
        case 'concluido': return 'Concluído';
        case 'cancelado': return 'Cancelado';
        default: return 'Pendente';
    }
}

/**
 * Retorna a classe de badge correspondente ao status.
 */
function getStatusBadgeClass(status) {
    switch (status) {
        case 'agendado': return 'badge-warning';
        case 'em_andamento': return 'badge-info';
        case 'concluido': return 'badge-success';
        case 'cancelado': return 'badge-danger';
        default: return 'badge-neutral';
    }
}

/**
 * Função utilitária para sanitização simples de textos contra XSS no DOM.
 */
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

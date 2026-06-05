// ========================================================
// CONFIGURACIÓN MAESTRA GLOBAL (MODIFICABLE PARA GITHUB)
// ========================================================
const MASTER_ADMIN_USER = "admin";
const MASTER_ADMIN_PASS = "buscador2026";
const DEFAULT_GUEST_USER = "usuario";
const DEFAULT_GUEST_PASS = "usuario2026"; 
const DEFAULT_DESCRIPTION = "Bienvenido al Sistema de Gestión de Personal. Esta plataforma de indexación permite realizar búsquedas fluidas sobre los escalafones y registros internos vigentes."; 

let rawData = [];
let grid = null;
let currentUserRole = "guest"; 

const visibleHeaders = ["Grado", "Apellidos y Nombres", "Codigo Funcionario"];

document.addEventListener('DOMContentLoaded', () => {
    initSettings();
    renderLiveDescription();
    setupLoginHandler();
    initGrid();
    setupEventListeners();
});

function initSettings() {
    if (!localStorage.getItem('sys_guest_pass')) {
        localStorage.setItem('sys_guest_pass', DEFAULT_GUEST_PASS);
    }
    if (!localStorage.getItem('sys_page_description')) {
        localStorage.setItem('sys_page_description', DEFAULT_DESCRIPTION);
    }
}

function renderLiveDescription() {
    const descText = localStorage.getItem('sys_page_description') || DEFAULT_DESCRIPTION;
    document.getElementById('live-description-text').textContent = descText;
}

function setupLoginHandler() {
    const loginForm = document.getElementById('login-form');
    const loginScreen = document.getElementById('login-screen');
    const mainApplication = document.getElementById('main-application');
    const loginError = document.getElementById('login-error');
    const roleBadge = document.getElementById('user-role-badge');
    const adminTools = document.getElementById('admin-tools');

    const savedAuth = sessionStorage.getItem('sys_is_auth');
    const savedRole = sessionStorage.getItem('sys_user_role');

    if (savedAuth === 'true' && savedRole) {
        currentUserRole = savedRole;
        loginScreen.style.display = 'none';
        mainApplication.style.display = 'block';
        
        roleBadge.textContent = currentUserRole === 'admin' ? 'Administrador' : 'Invitado';
        roleBadge.style.color = currentUserRole === 'admin' ? '#eab308' : '#60a5fa';
        
        if (currentUserRole === 'admin') {
            adminTools.style.display = 'flex';
        } else {
            adminTools.style.display = 'none';
        }
        loadDefaultData();
    }

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const userIn = document.getElementById('username').value.trim().toLowerCase();
        const passIn = document.getElementById('password').value;

        const currentLocalPass = localStorage.getItem('sys_guest_pass') || DEFAULT_GUEST_PASS;

        if (userIn === MASTER_ADMIN_USER && passIn === MASTER_ADMIN_PASS) {
            currentUserRole = "admin";
            sessionStorage.setItem('sys_is_auth', 'true');
            sessionStorage.setItem('sys_user_role', 'admin');
            loginError.style.display = 'none';
            
            roleBadge.textContent = 'Administrador';
            roleBadge.style.color = '#eab308';
            adminTools.style.display = 'flex';
            
            loginScreen.style.display = 'none';
            mainApplication.style.display = 'block';
            loadDefaultData();
        } else if (userIn === DEFAULT_GUEST_USER && (passIn === currentLocalPass || passIn === DEFAULT_GUEST_PASS)) {
            currentUserRole = "guest";
            sessionStorage.setItem('sys_is_auth', 'true');
            sessionStorage.setItem('sys_user_role', 'guest');
            loginError.style.display = 'none';
            
            roleBadge.textContent = 'Invitado';
            roleBadge.style.color = '#60a5fa';
            adminTools.style.display = 'none';
            
            loginScreen.style.display = 'none';
            mainApplication.style.display = 'block';
            loadDefaultData();
        } else {
            loginError.style.display = 'block';
            document.getElementById('password').value = '';
        }
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        sessionStorage.clear();
        window.location.reload();
    });
}

function initGrid() {
    grid = new gridjs.Grid({
        columns: visibleHeaders,
        data: [],
        pagination: { limit: 15 },
        sort: true,
        resizable: true,
        language: {
            'pagination': { 'previous': 'Anterior', 'next': 'Siguiente', 'showing': 'Mostrando', 'results': () => 'registros' }
        }
    }).render(document.getElementById("gridjs-wrapper"));

    grid.on('rowClick', (url, row) => {
        const clickedCode = row.cells[2].data; 
        openDetailedProfile(clickedCode);
    });
}

async function loadDefaultData() {
    try {
        const response = await fetch('datos.json');
        if (!response.ok) throw new Error();
        rawData = await response.json();
        processNewDataset(rawData, false);
    } catch (e) {
        updateRecordCountDisplay("<i class='fa-solid fa-circle-exclamation' style='color:#eab308'></i> Sin datos iniciales cargados en datos.json.");
    }
}

function strictNormalize(obj, allowedKeywords, forbiddenKeywords = []) {
    for (let key in obj) {
        const cleanKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
        let hasForbidden = forbiddenKeywords.some(forbidden => cleanKey.includes(forbidden));
        if (hasForbidden) continue; 
        let hasAllowed = allowedKeywords.some(allowed => cleanKey.includes(allowed));
        if (hasAllowed) return obj[key];
    }
    return "";
}

function formatExcelDate(excelValue) {
    if (!excelValue) return "";
    if (isNaN(excelValue)) return String(excelValue).trim();
    const serial = parseFloat(excelValue);
    const utc_days  = Math.floor(serial - 25569);
    const utc_value = utc_days * 86400;                                        
    const date_info = new Date(utc_value * 1000);
    const baseDate = new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate() + 1);
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    return (year > 1900 && year < 2100) ? `${year}-${month}-${day}` : String(excelValue);
}

function processNewDataset(data, parseDates = false) {
    rawData = data.map(item => {
        let codigoOriginal = strictNormalize(item, ["codigofuncionario", "codfunc", "codigo", "cod"], []);
        let nombreOriginal = strictNormalize(item, ["apellidosynombres", "apellidos", "nombres", "nombre", "personal"], ["codigo", "cod", "func"]);
        
        let finalNombre = String(nombreOriginal).trim();
        let finalCodigo = String(codigoOriginal).trim();

        const codeRegex = /\b(\d{5,8}[A-Z]?|\d{3,6}-\d|[A-Z\d]{6,8})\b\s*$/i;
        const match = finalNombre.match(codeRegex);

        if (match) {
            const detectedCode = match[1];
            if (!finalCodigo || finalCodigo === "" || finalNombre.includes(finalCodigo)) {
                finalCodigo = detectedCode;
            }
            finalNombre = finalNombre.replace(codeRegex, "").trim();
        }
        finalNombre = finalNombre.replace(/[\s\-\,\/]+$/, "").trim();

        const numOrd = strictNormalize(item, ["nord", "num", "numero", "orden"]);
        const escalafon = strictNormalize(item, ["escalafon", "esc"]);
        const grado = strictNormalize(item, ["grado", "grad"]);
        const estadoCivil = strictNormalize(item, ["estadocivil", "ecivil", "civil", "est"]);
        const fNac = strictNormalize(item, ["nacimiento", "fnac", "nac"]);
        const fIng = strictNormalize(item, ["ingreso", "fing", "ing"]);
        const fAsc = strictNormalize(item, ["ascenso", "fasc", "asc"]);
        const obs = strictNormalize(item, ["observaciones", "obs"]);

        return {
            "N.Ord": numOrd,
            "Escalafon": String(escalafon).toUpperCase(),
            "Grado": String(grado).toUpperCase(),
            "Apellidos y Nombres": finalNombre.toUpperCase(),
            "Codigo Funcionario": finalCodigo.toUpperCase(),
            "Estado Civil": String(estadoCivil).toUpperCase(),
            "Fecha Nacimiento": parseDates ? formatExcelDate(fNac) : fNac,
            "Fecha Ingreso": parseDates ? formatExcelDate(fIng) : fIng,
            "Fecha Ascenso": parseDates ? formatExcelDate(fAsc) : fAsc,
            "Observaciones": String(obs).toUpperCase()
        };
    });

    const btnDownload = document.getElementById('btn-download-json');
    if(btnDownload && rawData.length > 0) {
        btnDownload.disabled = false;
    }
    executeAdvancedSearch();
}

function openDetailedProfile(codigoFuncionario) {
    const funcionario = rawData.find(item => item["Codigo Funcionario"] === codigoFuncionario);
    if (!funcionario) return;

    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = `
        <div class="info-profile-grid">
            <div class="info-item highlight" style="grid-column: span 2;">
                <div class="info-label"><i class="fa-solid fa-user"></i> Apellidos y Nombres</div>
                <div class="info-value" style="font-size: 1.2rem;">${funcionario["Apellidos y Nombres"]}</div>
            </div>
            <div class="info-item">
                <div class="info-label"><i class="fa-solid fa-barcode"></i> Código Funcionario</div>
                <div class="info-value">${funcionario["Codigo Funcionario"]}</div>
            </div>
            <div class="info-item">
                <div class="info-label"><i class="fa-solid fa-medal"></i> Grado</div>
                <div class="info-value">${funcionario["Grado"]}</div>
            </div>
            <div class="info-item">
                <div class="info-label"><i class="fa-solid fa-layer-group"></i> Escalafón</div>
                <div class="info-value">${funcionario["Escalafon"]}</div>
            </div>
            <div class="info-item">
                <div class="info-label"><i class="fa-solid fa-heart"></i> Estado Civil</div>
                <div class="info-value">${funcionario["Estado Civil"]}</div>
            </div>
            <div class="info-item">
                <div class="info-label"><i class="fa-solid fa-cake-candles"></i> Fecha Nacimiento</div>
                <div class="info-value">${funcionario["Fecha Nacimiento"] || 'NO REGISTRA'}</div>
            </div>
            <div class="info-item">
                <div class="info-label"><i class="fa-solid fa-calendar-check"></i> Fecha Ingreso</div>
                <div class="info-value">${funcionario["Fecha Ingreso"] || 'NO REGISTRA'}</div>
            </div>
            <div class="info-item">
                <div class="info-label"><i class="fa-solid fa-arrow-up-right-dots"></i> Fecha Ascenso</div>
                <div class="info-value">${funcionario["Fecha Ascenso"] || 'NO REGISTRA'}</div>
            </div>
            <div class="info-item">
                <div class="info-label"><i class="fa-solid fa-list-ol"></i> N° de Orden</div>
                <div class="info-value">${funcionario["N.Ord"] || 'N/A'}</div>
            </div>
            <div class="info-item full-width">
                <div class="info-label"><i class="fa-solid fa-eye"></i> Observaciones Institucionales</div>
                <div class="info-value">${funcionario["Observaciones"] || 'SIN OBSERVACIONES PARTICULARES'}</div>
            </div>
        </div>
    `;
    document.getElementById('details-modal').style.display = 'flex';
}

function setupEventListeners() {
    const inputs = ['search-name', 'search-grado', 'search-escalafon', 'search-codigo'];
    inputs.forEach(id => document.getElementById(id).addEventListener('input', executeAdvancedSearch));

    document.getElementById('btn-clear-all').addEventListener('click', () => {
        inputs.forEach(id => document.getElementById(id).value = '');
        executeAdvancedSearch();
    });

    document.getElementById('btn-close-modal').addEventListener('click', () => {
        document.getElementById('details-modal').style.display = 'none';
    });

    const adminSettingsModal = document.getElementById('admin-settings-modal');
    
    document.getElementById('btn-manage-settings').addEventListener('click', () => {
        document.getElementById('admin-input-description').value = localStorage.getItem('sys_page_description') || DEFAULT_DESCRIPTION;
        document.getElementById('admin-input-guest-pass').value = localStorage.getItem('sys_guest_pass') || DEFAULT_GUEST_PASS;
        adminSettingsModal.style.display = 'flex';
    });

    document.getElementById('btn-close-admin-modal').addEventListener('click', () => {
        adminSettingsModal.style.display = 'none';
    });

    document.getElementById('btn-save-admin-settings').addEventListener('click', () => {
        const newDesc = document.getElementById('admin-input-description').value.trim();
        const newPass = document.getElementById('admin-input-guest-pass').value.trim();

        if(!newDesc || !newPass) {
            alert("Los campos no pueden quedar vacíos.");
            return;
        }

        localStorage.setItem('sys_page_description', newDesc);
        localStorage.setItem('sys_guest_pass', newPass);
        
        renderLiveDescription();
        adminSettingsModal.style.display = 'none';
        alert("Configuraciones aplicadas localmente de manera exitosa.");
    });

    window.addEventListener('click', (e) => {
        if(e.target.className === 'modal-overlay') {
            e.target.style.display = 'none';
        }
    });

    document.getElementById('excel-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        updateRecordCountDisplay("<i class='fa-solid fa-spinner fa-spin'></i> Procesando archivo Excel...");
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
            processNewDataset(json, true);
            e.target.value = ""; 
        };
        reader.readAsArrayBuffer(file);
    });

    document.getElementById('btn-download-json').addEventListener('click', () => {
        if (rawData.length === 0) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(rawData, null, 2));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "datos.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    });
}

function executeAdvancedSearch() {
    const valName = document.getElementById('search-name').value.toLowerCase().trim();
    const valGrado = document.getElementById('search-grado').value.toLowerCase().trim();
    const valEscalafon = document.getElementById('search-escalafon').value.toLowerCase().trim();
    const valCodigo = document.getElementById('search-codigo').value.toLowerCase().trim();

    if (!valName && !valGrado && !valEscalafon && !valCodigo) {
        updateTable(rawData);
        updateRecordCountDisplay(`<i class='fa-solid fa-database'></i> Base de Datos: ${rawData.length} registros.`);
        return;
    }

    const filtered = rawData.filter(item => {
        const matchName = !valName || fuseMatch(item["Apellidos y Nombres"], valName, 0.4);
        const matchGrado = !valGrado || item["Grado"].toLowerCase().includes(valGrado);
        const matchEscalafon = !valEscalafon || item["Escalafon"].toLowerCase().includes(valEscalafon);
        const matchCodigo = !valCodigo || item["Codigo Funcionario"].toLowerCase().includes(valCodigo);
        return matchName && matchGrado && matchEscalafon && matchCodigo;
    });

    updateTable(filtered);
    updateRecordCountDisplay(`<i class='fa-solid fa-filter'></i> Encontrados: ${filtered.length} registros.`);
}

function fuseMatch(text, query, thresholdValue) {
    if (!text) return false;
    if (text.toLowerCase().includes(query)) return true;
    const tempFuse = new Fuse([{ t: text }], { keys: ['t'], threshold: thresholdValue });
    return tempFuse.search(query).length > 0;
}

function updateTable(dataList) {
    const matrix = dataList.map(row => visibleHeaders.map(col => row[col] || ""));
    grid.updateConfig({ data: matrix }).forceRender();
}

function updateRecordCountDisplay(text) {
    document.getElementById('record-count').innerHTML = text;
}
// electricity.js
const electricity = {
    currentPage: 1,
    pageSize: 10,
    totalItems: 0,
    allData: [],
    chartInstance: null,

    // ELECTRICITY FUNCTIONALITY
    async loadElectricityData() {
        try {
            showElectricityLoading();
            const response = await fetch(`${API_BASE_URL}/electricity`, { headers: authHeaders() });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const electricityData = await response.json();
            this.displayElectricityData(electricityData);
            this.setupChart(electricityData);
            hideElectricityLoading();
        } catch (error) {
            console.error('Error loading electricity data:', error);
            showError('Failed to load electricity data. Please check if the server is running on port 2992.');
            hideElectricityLoading();
        }
    },

    displayElectricityData(electricityData) {
        this.allData = electricityData;
        this.totalItems = electricityData.length;

        const tableBody = document.getElementById('electricityTableBody');
        const table     = document.getElementById('electricityTable');
        const pagination= document.getElementById('electricityPagination');

        tableBody.innerHTML = '';

        if (electricityData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;">No electricity readings found. Add your first reading!</td></tr>';
            pagination.classList.add('hidden');
        } else {
            const startIndex = (this.currentPage - 1) * this.pageSize;
            const pageData   = electricityData.slice(startIndex, startIndex + this.pageSize);
            pageData.forEach(r => tableBody.appendChild(this.createElectricityRow(r)));
            this.updatePagination();
            pagination.classList.remove('hidden');
        }
        table.classList.remove('hidden');
    },

    createElectricityRow(reading) {
        const row = document.createElement('tr');
        const consumptionClass = reading.kulutus_sahko > 0 ? 'consumption-highlight-electricity' : '';
        const deleteDescription = escapeHtml(`${reading.kiinteisto || reading.kiinteistotunnus} - ${reading.kuukausi} ${reading.vuosi}`);

        // Meter change badge
        const meterBadge = reading.mittarinvaihto
            ? `<span style="background:#fef3c7;color:#b45309;border:1px solid #fde68a;
                            font-size:0.72rem;padding:1px 7px;border-radius:50px;
                            font-weight:600;margin-left:4px" title="Vanhan mittarin lukema: ${reading.vanha_lukema} kWh">
                🔄 Vaihto</span>`
            : '';

        row.innerHTML = `
            <td>${reading.kiinteisto || reading.kiinteistotunnus}${meterBadge}</td>
            <td>${reading.osoite || '-'}</td>
            <td>${reading.vuosi}</td>
            <td>${reading.kuukausi}</td>
            <td>${new Date(reading.lukemapva).toLocaleDateString('fi-FI')}</td>
            <td>${reading.sahkolukema} kWh
                ${reading.mittarinvaihto
                    ? `<br><small style="color:var(--text-3)">Vanha: ${reading.vanha_lukema} kWh</small>`
                    : ''}</td>
            <td><span class="${consumptionClass}">${reading.kulutus_sahko > 0 ? reading.kulutus_sahko + ' kWh' : '-'}</span></td>
            <td>${reading.muuta || '-'}</td>
            <td class="actions-cell">
                <button onclick="electricity.editElectricityReading(${reading.id})" class="success">✏️ Edit</button>
                <button onclick="showDeleteModal('electricity', ${reading.id}, '${deleteDescription}')" class="danger">🗑️ Delete</button>
            </td>
        `;
        return row;
    },

    async loadPropertiesForSelect() {
        try {
            const response = await fetch(`${API_BASE_URL}/property`, { headers: authHeaders() });
            const properties = await response.json();
            const select = document.getElementById('electricity_kiinteistotunnus');
            select.innerHTML = '<option value="">Select Property...</option>';
            properties.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.kiinteistotunnus;
                opt.textContent = `${p.kiinteisto || p.kiinteistotunnus} - ${p.osoite}`;
                select.appendChild(opt);
            });
        } catch (error) {
            console.error('Error loading properties for electricity select:', error);
        }
    },

    showAddElectricityForm() {
        document.getElementById('addElectricityForm').classList.remove('hidden');
        document.getElementById('electricityForm').reset();
        currentEditId = null;
        document.querySelector('#addElectricityForm h2').textContent = 'Add Electricity Reading';
        document.querySelector('#addElectricityForm button[type="submit"]').innerHTML = '💾 Save Reading';
        document.getElementById('electricity_vuosi').value = new Date().getFullYear();
        this.toggleMeterChangeFields(); // make sure fields are hidden on open
    },

    hideAddElectricityForm() {
        document.getElementById('addElectricityForm').classList.add('hidden');
        document.getElementById('electricityForm').reset();
        currentEditId = null;
        document.querySelector('#addElectricityForm h2').textContent = 'Add Electricity Reading';
        document.querySelector('#addElectricityForm button[type="submit"]').innerHTML = '💾 Save Reading';
        this.toggleMeterChangeFields();
    },

    // Show/hide meter change extra fields based on checkbox
    toggleMeterChangeFields() {
        const cb     = document.getElementById('electricity_mittarinvaihto');
        const fields = document.getElementById('electricityMeterChangeFields');
        if (!cb || !fields) return;
        fields.style.display = cb.checked ? 'block' : 'none';
        if (!cb.checked) {
            const vanhaInput = document.getElementById('electricity_vanha_lukema');
            if (vanhaInput) vanhaInput.value = '';
        }
    },

    async editElectricityReading(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/electricity`, { headers: authHeaders() });
            const electricityData = await response.json();
            const reading = electricityData.find(r => r.id === id);

            if (reading) {
                await this.loadPropertiesForSelect();
                document.getElementById('electricity_kiinteistotunnus').value = reading.kiinteistotunnus;
                document.getElementById('electricity_vuosi').value            = reading.vuosi;
                document.getElementById('electricity_kuukausi').value         = reading.kuukausi;
                document.getElementById('electricity_lukemapva').value        = reading.lukemapva;
                document.getElementById('electricity_sahkolukema').value      = reading.sahkolukema;
                document.getElementById('electricity_muuta').value            = reading.muuta || '';

                // Restore meter change state
                const cb = document.getElementById('electricity_mittarinvaihto');
                if (cb) {
                    cb.checked = !!reading.mittarinvaihto;
                    this.toggleMeterChangeFields();
                    if (reading.mittarinvaihto && reading.vanha_lukema !== null) {
                        document.getElementById('electricity_vanha_lukema').value = reading.vanha_lukema;
                    }
                }

                currentEditId = id;
                document.querySelector('#addElectricityForm h2').textContent = 'Edit Electricity Reading';
                document.querySelector('#addElectricityForm button[type="submit"]').innerHTML = '✏️ Update Reading';
                document.getElementById('addElectricityForm').classList.remove('hidden');
                document.getElementById('addElectricityForm').scrollIntoView({ behavior: 'smooth' });
            }
        } catch (error) {
            console.error('Error loading electricity reading for edit:', error);
            showError('Failed to load electricity reading data for editing');
        }
    },

    async handleElectricityFormSubmit() {
        const formData = new FormData(document.getElementById('electricityForm'));
        const electricityData = {};

        for (let [key, value] of formData.entries()) {
            if (key === 'sahkolukema' || key === 'vanha_lukema') {
                electricityData[key] = value !== '' ? parseFloat(value) : null;
            } else if (key === 'vuosi') {
                electricityData[key] = parseInt(value);
            } else {
                electricityData[key] = value || null;
            }
        }

        // Checkbox: FormData only includes it if checked
        const cb = document.getElementById('electricity_mittarinvaihto');
        electricityData.mittarinvaihto = cb && cb.checked ? 1 : 0;

        // Validate meter change
        if (electricityData.mittarinvaihto && !electricityData.vanha_lukema) {
            showError('Mittarinvaihdossa vanhan mittarin lukema on pakollinen.');
            return;
        }

        try {
            const url    = currentEditId
                ? `${API_BASE_URL}/electricity/${currentEditId}`
                : `${API_BASE_URL}/electricity`;
            const method = currentEditId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: authHeaders(),
                body: JSON.stringify(electricityData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save electricity reading');
            }

            showSuccess(currentEditId ? 'Electricity reading updated successfully!' : 'Electricity reading added successfully!');
            this.hideAddElectricityForm();
            this.loadElectricityData();

        } catch (error) {
            console.error('Error saving electricity reading:', error);
            showError(error.message);
        }
    },

    async exportElectricityToCsv() {
        try {
            const response = await fetch(`${API_BASE_URL}/electricity`, { headers: authHeaders() });
            const electricityData = await response.json();

            if (electricityData.length === 0) { showError('No electricity data to export'); return; }

            const headers = [
                'Property', 'Address', 'Property ID', 'Year', 'Month', 'Reading Date',
                'Electricity Reading (kWh)', 'Electricity Consumption (kWh)', 'Meter Change', 'Old Meter Reading (kWh)', 'Notes'
            ];

            const csvContent = [
                headers.join(','),
                ...electricityData.map(r => [
                    `"${r.kiinteisto || r.kiinteistotunnus || ''}"`,
                    `"${r.osoite || ''}"`,
                    `"${r.kiinteistotunnus || ''}"`,
                    r.vuosi || '',
                    `"${r.kuukausi || ''}"`,
                    r.lukemapva ? new Date(r.lukemapva).toLocaleDateString('fi-FI') : '',
                    r.sahkolukema || '',
                    r.kulutus_sahko || '',
                    r.mittarinvaihto ? 'Kyllä' : '',
                    r.vanha_lukema || '',
                    `"${r.muuta || ''}"`
                ].join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.setAttribute('href', URL.createObjectURL(blob));
            link.setAttribute('download', `electricity_consumption_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showSuccess('Electricity consumption data exported successfully!');
        } catch (error) {
            console.error('Error exporting electricity data:', error);
            showError('Failed to export electricity consumption data');
        }
    },

    // CHART FUNCTIONALITY
    setupChart(electricityData) {
        this.populateYearSelectors(electricityData);
        this.createChart(electricityData);
    },

    populateYearSelectors(electricityData) {
        const years = [...new Set(electricityData.map(i => i.vuosi))].sort((a, b) => b - a);
        const currentYear = new Date().getFullYear();
        const yearSelect = document.getElementById('electricity-year-select');
        yearSelect.innerHTML = '';
        years.forEach(year => {
            const opt = document.createElement('option');
            opt.value = year;
            opt.textContent = year;
            if (year === currentYear || year === years[0]) opt.selected = true;
            yearSelect.appendChild(opt);
        });
        yearSelect.removeEventListener('change', this.handleChartControlChange);
        yearSelect.addEventListener('change', this.handleChartControlChange.bind(this, electricityData));
    },

    handleChartControlChange(electricityData) {
        const yearSelect  = document.getElementById('electricity-year-select');
        const selectedYears = Array.from(yearSelect.selectedOptions).map(o => parseInt(o.value));
        this.updateChart(electricityData, selectedYears);
    },

    createChart(electricityData) {
        const ctx = document.getElementById('electricityChart').getContext('2d');
        if (this.chartInstance) this.chartInstance.destroy();

        const yearSelect    = document.getElementById('electricity-year-select');
        const selectedYears = Array.from(yearSelect.selectedOptions).map(o => parseInt(o.value));
        const chartData     = this.prepareChartData(electricityData, selectedYears);

        this.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Electricity Consumption - ${selectedYears.join(', ')}`,
                        font: { size: 16, weight: 'bold' }
                    },
                    legend: { display: true, position: 'top' }
                },
                scales: {
                    y: { beginAtZero: true, title: { display: true, text: 'Consumption (kWh)' } },
                    x: { title: { display: true, text: 'Month' } }
                }
            }
        });
    },

    prepareChartData(electricityData, selectedYears) {
        const months = ['Tammi','Helmi','Maalis','Huhti','Touko','Kesä','Heinä','Elo','Syys','Loka','Marras','Joulu'];
        const colors       = ['rgba(255,99,132,0.6)','rgba(54,162,235,0.6)','rgba(255,206,86,0.6)','rgba(75,192,192,0.6)','rgba(153,102,255,0.6)','rgba(255,159,64,0.6)'];
        const borderColors = ['rgba(255,99,132,1)','rgba(54,162,235,1)','rgba(255,206,86,1)','rgba(75,192,192,1)','rgba(153,102,255,1)','rgba(255,159,64,1)'];

        selectedYears.sort((a, b) => a - b);
        return {
            labels: months,
            datasets: selectedYears.map((year, i) => ({
                label: `${year} - Electricity (kWh)`,
                data: this.getYearlyData(electricityData, year, months).electricity,
                backgroundColor: colors[i % colors.length],
                borderColor: borderColors[i % borderColors.length],
                borderWidth: 1
            }))
        };
    },

    getYearlyData(electricityData, year, months) {
        const electricity = new Array(12).fill(0);
        electricityData.filter(i => i.vuosi === year).forEach(item => {
            const idx = months.indexOf(item.kuukausi);
            if (idx !== -1) electricity[idx] += parseFloat(item.kulutus_sahko) || 0;
        });
        return { electricity };
    },

    updateChart(electricityData, selectedYears) {
        if (!this.chartInstance) return;
        this.chartInstance.options.plugins.title.text =
            `Electricity Consumption - Years: ${selectedYears.join(', ')}`;
        this.chartInstance.data = this.prepareChartData(electricityData, selectedYears);
        this.chartInstance.update();
    },

    // PAGINATION
    updatePagination() {
        const totalPages = Math.ceil(this.totalItems / this.pageSize);
        const startItem  = (this.currentPage - 1) * this.pageSize + 1;
        const endItem    = Math.min(this.currentPage * this.pageSize, this.totalItems);

        document.getElementById('electricityCurrentRange').textContent = `${startItem}-${endItem}`;
        document.getElementById('electricityTotalItems').textContent   = this.totalItems;
        document.getElementById('electricityPrevBtn').disabled         = this.currentPage === 1;
        document.getElementById('electricityNextBtn').disabled         = this.currentPage === totalPages;
        this.updatePageNumbers(totalPages);
    },

    updatePageNumbers(totalPages) {
        const pageNumbers = document.getElementById('electricityPageNumbers');
        let html = '';
        for (let i = 1; i <= totalPages; i++) {
            if (i === this.currentPage) {
                html += `<button class="page-number active" onclick="electricity.goToPage(${i})">${i}</button>`;
            } else if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                html += `<button class="page-number" onclick="electricity.goToPage(${i})">${i}</button>`;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                html += '<span class="page-ellipsis">...</span>';
            }
        }
        pageNumbers.innerHTML = html;
    },

    changePage(direction) {
        const totalPages = Math.ceil(this.totalItems / this.pageSize);
        this.currentPage = Math.max(1, Math.min(totalPages, this.currentPage + direction));
        this.displayElectricityData(this.allData);
    },

    goToPage(page) {
        this.currentPage = page;
        this.displayElectricityData(this.allData);
    },

    changePageSize() {
        this.pageSize    = parseInt(document.getElementById('electricityPageSize').value);
        this.currentPage = 1;
        this.displayElectricityData(this.allData);
    }
};

// Global wrappers
function showAddElectricityForm()    { electricity.showAddElectricityForm(); }
function hideAddElectricityForm()    { electricity.hideAddElectricityForm(); }
function loadElectricityData()       { electricity.loadElectricityData(); }
function exportElectricityToCsv()    { electricity.exportElectricityToCsv(); }
function changeElectricityPage(dir)  { electricity.changePage(dir); }
function changeElectricityPageSize() { electricity.changePageSize(); }

window.electricity = electricity;

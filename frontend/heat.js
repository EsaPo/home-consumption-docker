// heat.js
const heat = {
    // Variables for pagination
    currentPage: 1,
    pageSize: 10, // Match HTML default
    totalItems: 0,
    allData: [],
    chartInstance: null,

    // HEAT CONSUMPTION FUNCTIONALITY
    async loadHeatData() {
        try {
            showHeatLoading();
            const response = await fetch(`${API_BASE_URL}/heat`, { headers: authHeaders() });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const heatData = await response.json();
            this.displayHeatData(heatData);
            this.setupChart(heatData);
            hideHeatLoading();

        } catch (error) {
            console.error('Error loading heat data:', error);
            showError('Failed to load heat data. Please check if the server is running on port 2992.');
            hideHeatLoading();
        }
    },

    displayHeatData(heatData) {
        this.allData = heatData;
        this.totalItems = heatData.length;

        const tableBody = document.getElementById('heatTableBody');
        const table = document.getElementById('heatTable');
        const pagination = document.getElementById('heatPagination');

        tableBody.innerHTML = '';

        if (heatData.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="10" style="text-align: center; padding: 40px;">No heat readings found. Add your first reading!</td></tr>';
            pagination.classList.add('hidden');
        } else {
            const startIndex = (this.currentPage - 1) * this.pageSize;
            const endIndex = Math.min(startIndex + this.pageSize, heatData.length);
            const pageData = heatData.slice(startIndex, endIndex);

            pageData.forEach(reading => {
                const row = this.createHeatRow(reading);
                tableBody.appendChild(row);
            });

            this.updatePagination();
            pagination.classList.remove('hidden');
        }

        table.classList.remove('hidden');
    },

    createHeatRow(reading) {
        const row = document.createElement('tr');
        const consumptionClass = (reading.kulutus_lampo > 0 || reading.kulutus_virtaama > 0) ? 'consumption-highlight-heat' : '';

        row.innerHTML = `
            <td>${reading.kiinteisto || reading.kiinteistotunnus}${reading.mittarinvaihto ? '<span style="background:#fef3c7;color:#b45309;border:1px solid #fde68a;font-size:0.72rem;padding:1px 7px;border-radius:50px;font-weight:600;margin-left:4px">🔄 Vaihto</span>' : ''}</td>
            <td>${reading.osoite || '-'}</td>
            <td>${reading.vuosi}</td>
            <td>${reading.kuukausi}</td>
            <td>${new Date(reading.lukemapva).toLocaleDateString('fi-FI')}</td>
            <td>${reading.lampolukema} MWh${reading.mittarinvaihto ? '<br><small style="color:var(--text-3)">Vanha: ' + reading.vanha_lampolukema + ' MWh</small>' : ''}</td>
            <td>${reading.virtaamalukema} m³${reading.mittarinvaihto ? '<br><small style="color:var(--text-3)">Vanha: ' + reading.vanha_virtaamalukema + ' m³</small>' : ''}</td>
            <td><span class="${consumptionClass}">${reading.kulutus_lampo > 0 ? reading.kulutus_lampo + ' MWh' : '-'}</span></td>
            <td><span class="${consumptionClass}">${reading.kulutus_virtaama > 0 ? reading.kulutus_virtaama + ' m³' : '-'}</span></td>
            <td>${reading.muuta || '-'}</td>
            <td class="actions-cell">
                <button onclick="heat.editHeatReading(${reading.id})" class="success">✏️ Edit</button>
                <button onclick="showDeleteModal('heat', ${reading.id}, '${reading.kiinteisto || reading.kiinteistotunnus} - ${reading.kuukausi} ${reading.vuosi}')" class="danger">🗑️ Delete</button>
            </td>
        `;
        return row;
    },

    async loadPropertiesForSelect() {
        try {
            const response = await fetch(`${API_BASE_URL}/property`, { headers: authHeaders() });
            const properties = await response.json();

            const select = document.getElementById('heat_kiinteistotunnus');
            select.innerHTML = '<option value="">Select Property...</option>';

            properties.forEach(property => {
                const option = document.createElement('option');
                option.value = property.kiinteistotunnus;
                option.textContent = `${property.kiinteisto || property.kiinteistotunnus} - ${property.osoite}`;
                select.appendChild(option);
            });

        } catch (error) {
            console.error('Error loading properties for select:', error);
        }
    },

    showAddHeatForm() {
        document.getElementById('addHeatForm').classList.remove('hidden');
        document.getElementById('heatForm').reset();
        currentEditId = null;
        document.querySelector('#addHeatForm h2').textContent = 'Add Heat Reading';
        document.querySelector('#addHeatForm button[type="submit"]').innerHTML = '💾 Save Reading';
        document.getElementById('heat_vuosi').value = new Date().getFullYear();
        this.toggleMeterChangeFields();
    },

    hideAddHeatForm() {
        document.getElementById('addHeatForm').classList.add('hidden');
        document.getElementById('heatForm').reset();
        currentEditId = null;
        // Reset form title and button text to default state
        document.querySelector('#addHeatForm h2').textContent = 'Add Heat Reading';
        document.querySelector('#addHeatForm button[type="submit"]').innerHTML = '💾 Save Reading';
        this.toggleMeterChangeFields();
    },

    toggleMeterChangeFields() {
        const cb     = document.getElementById('heat_mittarinvaihto');
        const fields = document.getElementById('heatMeterChangeFields');
        if (!cb || !fields) return;
        fields.style.display = cb.checked ? 'block' : 'none';
        if (!cb.checked) {
            const l = document.getElementById('heat_vanha_lampolukema');
            const v = document.getElementById('heat_vanha_virtaamalukema');
            if (l) l.value = '';
            if (v) v.value = '';
        }
    },

    async editHeatReading(id) {
        try {
            const response = await fetch(`${API_BASE_URL}/heat`, { headers: authHeaders() });
            const heatData = await response.json();
            const reading = heatData.find(r => r.id === id);

            if (reading) {
                document.getElementById('heat_kiinteistotunnus').value = reading.kiinteistotunnus;
                document.getElementById('heat_vuosi').value = reading.vuosi;
                document.getElementById('heat_kuukausi').value = reading.kuukausi;
                document.getElementById('heat_lukemapva').value = reading.lukemapva;
                document.getElementById('heat_lampolukema').value = reading.lampolukema;
                document.getElementById('heat_virtaamalukema').value = reading.virtaamalukema;
                document.getElementById('heat_muuta').value = reading.muuta || '';

                const cb = document.getElementById('heat_mittarinvaihto');
                if (cb) {
                    cb.checked = !!reading.mittarinvaihto;
                    this.toggleMeterChangeFields();
                    if (reading.mittarinvaihto) {
                        if (reading.vanha_lampolukema)    document.getElementById('heat_vanha_lampolukema').value    = reading.vanha_lampolukema;
                        if (reading.vanha_virtaamalukema) document.getElementById('heat_vanha_virtaamalukema').value = reading.vanha_virtaamalukema;
                    }
                }

                currentEditId = id;
                document.querySelector('#addHeatForm h2').textContent = 'Edit Heat Reading';
                document.querySelector('#addHeatForm button[type="submit"]').innerHTML = '✏️ Update Reading';
                document.getElementById('addHeatForm').classList.remove('hidden');
                document.getElementById('addHeatForm').scrollIntoView({ behavior: 'smooth' });
            }
        } catch (error) {
            console.error('Error loading heat reading for edit:', error);
            showError('Failed to load heat reading data for editing');
        }
    },

    async handleHeatFormSubmit() {
        const formData = new FormData(document.getElementById('heatForm'));
        const heatData = {};

        for (let [key, value] of formData.entries()) {
            if (['lampolukema','virtaamalukema','vanha_lampolukema','vanha_virtaamalukema'].includes(key)) {
                heatData[key] = value !== '' ? parseFloat(value) : null;
            } else if (key === 'vuosi') {
                heatData[key] = parseInt(value);
            } else {
                heatData[key] = value || null;
            }
        }
        const cb = document.getElementById('heat_mittarinvaihto');
        heatData.mittarinvaihto = cb && cb.checked ? 1 : 0;
        if (heatData.mittarinvaihto && (!heatData.vanha_lampolukema || !heatData.vanha_virtaamalukema)) {
            showError('Mittarinvaihdossa vanhan mittarin molemmat lukemat ovat pakollisia.');
            return;
        }

        try {
            let response;
            if (currentEditId) {
                response = await fetch(`${API_BASE_URL}/heat/${currentEditId}`, {
                    method: 'PUT',
                    headers: authHeaders(),
                    body: JSON.stringify(heatData)
                });
            } else {
                response = await fetch(`${API_BASE_URL}/heat`, {
                    method: 'POST',
                    headers: authHeaders(),
                    body: JSON.stringify(heatData)
                });
            }

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save heat reading');
            }

            showSuccess(currentEditId ? 'Heat reading updated successfully!' : 'Heat reading added successfully!');
            this.hideAddHeatForm();
            this.loadHeatData();

        } catch (error) {
            console.error('Error saving heat reading:', error);
            showError(error.message);
        }
    },

    async exportHeatToCsv() {
        try {
            const response = await fetch(`${API_BASE_URL}/heat`, { headers: authHeaders() });
            const heatData = await response.json();

            if (heatData.length === 0) {
                showError('No heat data to export');
                return;
            }

            // Create CSV headers
            const headers = [
                'Property', 'Address', 'Property ID', 'Year', 'Month', 'Reading Date',
                'Heat Reading (MWh)', 'Flow Reading (m³)', 'Heat Consumption (MWh)',
                'Flow Consumption (m³)', 'Meter Change', 'Old Heat Reading (MWh)', 'Old Flow Reading (m³)', 'Notes'
            ];

            // Convert data to CSV format
            const csvContent = [
                headers.join(','),
                ...heatData.map(reading => [
                    `"${reading.kiinteisto || reading.kiinteistotunnus || ''}"`,
                    `"${reading.osoite || ''}"`,
                    `"${reading.kiinteistotunnus || ''}"`,
                    reading.vuosi || '',
                    `"${reading.kuukausi || ''}"`,
                    reading.lukemapva ? new Date(reading.lukemapva).toLocaleDateString('fi-FI') : '',
                    reading.lampolukema || '',
                    reading.virtaamalukema || '',
                    reading.kulutus_lampo || '',
                    reading.kulutus_virtaama || '',
                    reading.mittarinvaihto ? 'Kyllä' : '',
                    reading.vanha_lampolukema || '',
                    reading.vanha_virtaamalukema || '',
                    `"${reading.muuta || ''}"`
                ].join(','))
            ].join('\n');

            // Create and download file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `heat_consumption_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showSuccess('Heat consumption data exported successfully!');
        } catch (error) {
            console.error('Error exporting heat data:', error);
            showError('Failed to export heat consumption data');
        }
    },

    // CHART FUNCTIONALITY
    setupChart(heatData) {
        this.populateYearSelectors(heatData);
        // Initial chart creation with default selections
        this.createChart(heatData);
    },

    populateYearSelectors(heatData) {
        const years = [...new Set(heatData.map(item => item.vuosi))].sort((a, b) => b - a);
        const currentYear = new Date().getFullYear();

        const yearSelect = document.getElementById('heat-year-select');
        yearSelect.innerHTML = '';

        // Add options for each year to the multi-select dropdown
        years.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            // Select current year by default if available, otherwise select the latest year
            if (year === currentYear || (years.length > 0 && year === years[0])) { // Select the latest year if currentYear not found
                option.selected = true;
            }
            yearSelect.appendChild(option);
        });

        // Ensure the flow consumption checkbox exists and is checked by default
        let showFlowConsumptionCheckbox = document.getElementById('showFlowConsumption');
        if (!showFlowConsumptionCheckbox) {
            const chartControls = document.querySelector('.chart-controls');
            showFlowConsumptionCheckbox = document.createElement('input');
            showFlowConsumptionCheckbox.type = 'checkbox';
            showFlowConsumptionCheckbox.id = 'showFlowConsumption';
            showFlowConsumptionCheckbox.checked = true; // Default to checked
            
            const label = document.createElement('label');
            label.htmlFor = 'showFlowConsumption';
            label.textContent = ' Show Flow Consumption';
            label.style.marginLeft = '20px';

            chartControls.appendChild(label);
            label.prepend(showFlowConsumptionCheckbox); // Put checkbox inside label for better click area
        }

        // Add event listeners
        yearSelect.removeEventListener('change', this.handleChartControlChange);
        yearSelect.addEventListener('change', this.handleChartControlChange.bind(this, heatData));

        showFlowConsumptionCheckbox.removeEventListener('change', this.handleChartControlChange);
        showFlowConsumptionCheckbox.addEventListener('change', this.handleChartControlChange.bind(this, heatData));
    },

    handleChartControlChange(heatData) {
        const yearSelect = document.getElementById('heat-year-select');
        const selectedOptions = Array.from(yearSelect.selectedOptions);
        const selectedYears = selectedOptions.map(option => parseInt(option.value));
        
        this.updateChart(heatData, selectedYears);
    },

    createChart(heatData) {
        const ctx = document.getElementById('heatChart').getContext('2d');

        // Destroy existing chart if it exists
        if (this.chartInstance) {
            this.chartInstance.destroy();
        }

        // Get initial selected years (the ones populated by populateYearSelectors)
        const yearSelect = document.getElementById('heat-year-select');
        const selectedOptions = Array.from(yearSelect.selectedOptions);
        const selectedYears = selectedOptions.map(option => parseInt(option.value));

        const chartData = this.prepareChartData(heatData, selectedYears);

        this.chartInstance = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Heat Consumption - ${selectedYears.length > 1 ? 'Years ' + selectedYears.join(', ') : (selectedYears[0] || 'No Year Selected')}`,
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Consumption (MWh / m³)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Month'
                        }
                    }
                }
            }
        });
    },

    prepareChartData(heatData, selectedYears) {
        const months = ['Tammi', 'Helmi', 'Maalis', 'Huhti', 'Touko', 'Kesä',
                       'Heinä', 'Elo', 'Syys', 'Loka', 'Marras', 'Joulu'];
        const datasets = [];
        const showFlow = document.getElementById('showFlowConsumption').checked;

        // Define a set of consistent colors for years
        const colors = [
            'rgba(255, 99, 132, 0.6)', // Red
            'rgba(54, 162, 235, 0.6)', // Blue
            'rgba(255, 206, 86, 0.6)', // Yellow
            'rgba(75, 192, 192, 0.6)', // Green
            'rgba(153, 102, 255, 0.6)',// Purple
            'rgba(255, 159, 64, 0.6)', // Orange
            'rgba(199, 199, 199, 0.6)',// Grey
            'rgba(83, 102, 134, 0.6)', // Dark Blue Grey
            'rgba(110, 203, 110, 0.6)',// Light Green
            'rgba(200, 50, 50, 0.6)',  // Dark Red
        ];
        const borderColors = [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)',
            'rgba(153, 102, 255, 1)',
            'rgba(255, 159, 64, 1)',
            'rgba(199, 199, 199, 1)',
            'rgba(83, 102, 134, 1)',
            'rgba(110, 203, 110, 1)',
            'rgba(200, 50, 50, 1)',
        ];

        selectedYears.sort((a, b) => a - b); // Sort years for consistent color assignment

        selectedYears.forEach((year, index) => {
            const yearData = this.getYearlyData(heatData, year, months);
            const colorIndex = index % colors.length; // Cycle through colors

            datasets.push({
                label: `${year} - Heat (MWh)`,
                data: yearData.heat,
                backgroundColor: colors[colorIndex],
                borderColor: borderColors[colorIndex],
                borderWidth: 1,
                // Add a unique ID to distinguish heat/flow for a given year if needed for complex interactions
                // type: 'bar' // Explicitly set type if mixing types later
            });

            if (showFlow) {
                datasets.push({
                    label: `${year} - Flow (m³)`,
                    data: yearData.flow,
                    backgroundColor: colors[colorIndex].replace('0.6)', '0.3)'), // Lighter shade for flow
                    borderColor: borderColors[colorIndex].replace('1)', '0.6)'), // Lighter border
                    borderWidth: 1,
                    // type: 'bar'
                });
            }
        });

        return {
            labels: months,
            datasets: datasets
        };
    },

    getYearlyData(heatData, year, months) {
        const heatConsumption = new Array(12).fill(0);
        const flowConsumption = new Array(12).fill(0);

        // Filter data for the specific year and aggregate by month
        const yearData = heatData.filter(item => item.vuosi === year);

        yearData.forEach(item => {
            // Find month index using item.kuukausi (e.g., "Tammi") against the months array
            // Note: Your data uses Finnish month names. Ensure they match the 'months' array.
            const monthIndex = months.indexOf(item.kuukausi);
            if (monthIndex !== -1) {
                heatConsumption[monthIndex] += item.kulutus_lampo || 0;
                flowConsumption[monthIndex] += item.kulutus_virtaama || 0;
            }
        });

        return {
            heat: heatConsumption,
            flow: flowConsumption
        };
    },

    updateChart(heatData, selectedYears) {
        if (!this.chartInstance) return;

        // Update chart title based on selected years
        const titleText = selectedYears.length > 0
            ? `Heat Consumption - Years: ${selectedYears.join(', ')}`
            : 'Heat Consumption';

        this.chartInstance.options.plugins.title.text = titleText;

        const newData = this.prepareChartData(heatData, selectedYears);
        this.chartInstance.data = newData;
        this.chartInstance.update();
    },

    // PAGINATION FUNCTIONS
    updatePagination() {
        const totalPages = Math.ceil(this.totalItems / this.pageSize);
        const startItem = (this.currentPage - 1) * this.pageSize + 1;
        const endItem = Math.min(this.currentPage * this.pageSize, this.totalItems);

        document.getElementById('heatCurrentRange').textContent = `${startItem}-${endItem}`;
        document.getElementById('heatTotalItems').textContent = this.totalItems;

        document.getElementById('heatPrevBtn').disabled = this.currentPage === 1;
        document.getElementById('heatNextBtn').disabled = this.currentPage === totalPages;

        this.updatePageNumbers(totalPages);
    },

    updatePageNumbers(totalPages) {
        const pageNumbers = document.getElementById('heatPageNumbers');
        let html = '';

        for (let i = 1; i <= totalPages; i++) {
            if (i === this.currentPage) {
                html += `<button class="page-number active" onclick="heat.goToPage(${i})">${i}</button>`;
            } else if (i === 1 || i === totalPages || (i >= this.currentPage - 2 && i <= this.currentPage + 2)) {
                html += `<button class="page-number" onclick="heat.goToPage(${i})">${i}</button>`;
            } else if (i === this.currentPage - 3 || i === this.currentPage + 3) {
                html += '<span class="page-ellipsis">...</span>';
            }
        }

        pageNumbers.innerHTML = html;
    },

    changePage(direction) {
        const totalPages = Math.ceil(this.totalItems / this.pageSize);
        this.currentPage = Math.max(1, Math.min(totalPages, this.currentPage + direction));
        this.displayHeatData(this.allData);
    },

    goToPage(page) {
        this.currentPage = page;
        this.displayHeatData(this.allData);
    },

    changePageSize() {
        this.pageSize = parseInt(document.getElementById('heatPageSize').value);
        this.currentPage = 1;
        this.displayHeatData(this.allData);
    }
};

// Global functions for HTML onclick handlers
function showAddHeatForm() {
    heat.showAddHeatForm();
}

function hideAddHeatForm() {
    heat.hideAddHeatForm();
}

function loadHeatData() {
    heat.loadHeatData();
}

function exportHeatToCsv() {
    heat.exportHeatToCsv();
}

function changeHeatPage(direction) {
    heat.changePage(direction);
}

function changeHeatPageSize() {
    heat.changePageSize();
}

// Make sure the heat object is globally accessible
window.heat = heat;
